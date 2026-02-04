import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { earnPoints, calculatePurchasePoints } from '../../../lib/loyaltySystem'
import {  calculateNutritionPrice, getMemberTier, formatTierName, calculateExpiryDate } from '../../../lib/nutritionPricing'
import { calculateUpsellCommission } from '../../../lib/commissions/upsell'
import { getNextReceiptNumber } from '../../../lib/receiptNumberGenerator'

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'canViewNutrition')

    // Check for memberId filter
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    // إذا كان هناك memberId محدد، نجلب فقط الباقات الخاصة بهذا العضو
    // وإلا نجلب كل الباقات
    const where = memberId ? {
      memberId,
      NOT: { memberId: null }
    } : {}

    const packages = await prisma.nutritionPackage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        receipts: true,
        followUps: true,
        member: {
          select: {
            memberNumber: true,
            name: true
          }
        }
      }
    })
    return NextResponse.json(packages)
  } catch (error: any) {
    console.error('Error fetching nutrition packages:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    return NextResponse.json({ error: 'فشل جلب الباقات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'canCreateNutrition')
    const body = await request.json()
    const { clientName, clientPhone, memberId, packageType, paymentMethod, staffName, referringCoachId } = body

    if (!clientName || !clientPhone || !packageType || !staffName) {
      return NextResponse.json({ error: 'جميع الحقول المطلوبة يجب ملؤها' }, { status: 400 })
    }

    const validPackageTypes = ['single', '1month', '2months', '3months']
    if (!validPackageTypes.includes(packageType)) {
      return NextResponse.json({ error: 'نوع الباقة غير صحيح' }, { status: 400 })
    }

    let memberTier: string | null = null
    if (memberId) {
      const member = await prisma.member.findUnique({
        where: { id: memberId },
        select: { startDate: true, expiryDate: true }
      })
      if (member && member.startDate && member.expiryDate) {
        const subscriptionDuration = Math.floor(
          (member.expiryDate.getTime() - member.startDate.getTime()) / (1000 * 60 * 60 * 24)
        )
        memberTier = getMemberTier(subscriptionDuration)
      }
    }

    const pricing = calculateNutritionPrice(packageType as any, memberTier)
    const expiryDate = calculateExpiryDate(packageType)

    // Check for existing expired packages (renewal detection)
    const existingPackage = await prisma.nutritionPackage.findFirst({
      where: {
        clientPhone,
        expiryDate: {
          lt: new Date()
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const isRenewal = !!existingPackage
    const receiptType = isRenewal ? 'Nutrition Renewal' : 'Nutrition'

    const nutritionPackage = await prisma.nutritionPackage.create({
      data: {
        clientName,
        clientPhone,
        memberId: memberId || null,
        packageType,
        duration: pricing.packageDetails.duration,
        followUpsIncluded: pricing.packageDetails.followUps,
        inBodyScansIncluded: pricing.packageDetails.inBodyScans,
        mealUpdates: pricing.packageDetails.mealUpdates,
        strategyUpdates: pricing.packageDetails.strategyUpdates,
        totalPrice: pricing.finalPrice,
        discountAmount: pricing.discountAmount,
        discountPercent: pricing.discountPercent,
        memberTier: memberTier ? memberTier.charAt(0).toUpperCase() + memberTier.slice(1) : null,
        basePrice: pricing.basePrice,
        paymentMethod: paymentMethod || 'cash',
        staffName,
        expiryDate,
        referringCoachId: referringCoachId || null,
      },
    })

    // ✅ توليد رقم إيصال جديد بطريقة آمنة (atomic increment)
    const receiptNumber = await getNextReceiptNumber(prisma)

    const receiptDetails = {
      clientName,
      clientPhone,
      packageType,
      duration: pricing.packageDetails.duration,
      followUps: pricing.packageDetails.followUps,
      inBodyScans: pricing.packageDetails.inBodyScans,
      mealUpdates: pricing.packageDetails.mealUpdates,
      strategyUpdates: pricing.packageDetails.strategyUpdates,
      basePrice: pricing.basePrice,
      discount: pricing.discountAmount,
      discountPercent: pricing.discountPercent,
      memberTier: memberTier ? formatTierName(memberTier, 'ar') : 'غير عضو',
      totalPrice: pricing.finalPrice,
      staffName,
      expiryDate,
      isRenewal: isRenewal,
    }

    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        type: receiptType,
        amount: pricing.finalPrice,
        paymentMethod: paymentMethod || 'cash',
        itemDetails: JSON.stringify(receiptDetails),
        nutritionId: nutritionPackage.id,
        memberId: memberId || null,
        staffName,
        referringCoachId: referringCoachId || null,
      },
    })

    // 💰 Create sales renewal bonus if applicable
    if (isRenewal) {
      try {
        const salesBonusResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sales-commissions/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiptId: receipt.id })
        })

        if (salesBonusResponse.ok) {
          const salesBonusData = await salesBonusResponse.json()
          if (salesBonusData.eligible && !salesBonusData.alreadyProcessed) {
            console.log(`💰 Sales renewal bonus created: ${salesBonusData.commission.amount} EGP`)
          }
        }
      } catch (salesBonusError) {
        // Don't fail package creation if bonus creation fails
        console.error('⚠️ Sales bonus error (non-critical):', salesBonusError)
      }
    }

    // Create commission record if coach referred this sale
    if (referringCoachId) {
      const upsellAmount = calculateUpsellCommission(pricing.finalPrice, 'nutrition')

      await prisma.coachCommission.create({
        data: {
          coachId: referringCoachId,
          type: 'upsell_nutrition',
          amount: upsellAmount,
          receiptId: receipt.id,
          month: new Date().toISOString().slice(0, 7),
          calculationDetails: JSON.stringify({
            packageType,
            baseAmount: pricing.finalPrice,
            rate: 0.05,
            duration: pricing.packageDetails.duration
          })
        }
      })
    }

    if (memberId) {
      const points = calculatePurchasePoints(pricing.finalPrice)
      if (points > 0) {
        await earnPoints({
          memberId,
          points,
          source: 'purchase',
          description: `شراء باقة تغذية - ${packageType}`,
          receiptId: receiptNumber.toString(),
          staffName,
          metadata: {
            packageType,
            duration: pricing.packageDetails.duration,
            totalPaid: pricing.finalPrice,
            discount: pricing.discountAmount
          }
        })
      }
    }

    return NextResponse.json(nutritionPackage, { status: 201 })
  } catch (error: any) {
    console.error('Error creating nutrition package:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message || 'فشل إنشاء الباقة' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requirePermission(request, 'canDeleteNutrition')
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'معرف الباقة مطلوب' }, { status: 400 })
    }
    await prisma.nutritionPackage.delete({ where: { id } })
    return NextResponse.json({ message: 'تم حذف الباقة بنجاح' })
  } catch (error: any) {
    console.error('Error deleting package:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    return NextResponse.json({ error: 'فشل حذف الباقة' }, { status: 500 })
  }
}
