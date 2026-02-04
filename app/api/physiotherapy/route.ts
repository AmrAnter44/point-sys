import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { earnPoints, calculatePurchasePoints } from '../../../lib/loyaltySystem'
import { calculatePhysioPrice, getMemberTier, formatTierName } from '../../../lib/physiotherapyPricing'
import { calculateUpsellCommission } from '../../../lib/commissions/upsell'
import { getNextReceiptNumber } from '../../../lib/receiptNumberGenerator'

// ==================== GET - Fetch all physiotherapy packages ====================

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'canViewPhysio')

    // Check for memberId filter
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    // إذا كان هناك memberId محدد، نجلب فقط الباقات الخاصة بهذا العضو
    // وإلا نجلب كل الباقات
    const where = memberId ? {
      memberId,
      NOT: { memberId: null }
    } : {}

    const packages = await prisma.physiotherapyPackage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        receipts: true,
        sessions: true,
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
    console.error('Error fetching physiotherapy packages:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب الباقات' }, { status: 500 })
  }
}

// ==================== POST - Create new physiotherapy package ====================

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'canCreatePhysio')

    const body = await request.json()
    const {
      clientName,
      clientPhone,
      memberId,
      packageType,
      paymentMethod,
      staffName,
      referringCoachId
    } = body

    // Validation
    if (!clientName || !clientPhone || !packageType || !staffName) {
      return NextResponse.json(
        { error: 'جميع الحقول المطلوبة يجب ملؤها' },
        { status: 400 }
      )
    }

    // Validate package type
    const validPackageTypes = ['single', '5sessions', '10sessions', '15sessions']
    if (!validPackageTypes.includes(packageType)) {
      return NextResponse.json(
        { error: 'نوع الباقة غير صحيح' },
        { status: 400 }
      )
    }

    // Calculate member tier if memberId provided
    let memberTier: string | null = null
    let subscriptionDuration = 0

    if (memberId) {
      const member = await prisma.member.findUnique({
        where: { id: memberId },
        select: { startDate: true, expiryDate: true }
      })

      if (member && member.startDate && member.expiryDate) {
        subscriptionDuration = Math.floor(
          (member.expiryDate.getTime() - member.startDate.getTime()) / (1000 * 60 * 60 * 24)
        )
        memberTier = getMemberTier(subscriptionDuration)
      }
    }

    // Calculate pricing
    const pricing = calculatePhysioPrice(
      packageType as 'single' | '5sessions' | '10sessions' | '15sessions',
      memberTier
    )

    // Check for existing expired packages (renewal detection)
    const existingPackage = await prisma.physiotherapyPackage.findFirst({
      where: {
        clientPhone,
        sessionsUsed: {
          gte: prisma.physiotherapyPackage.fields.sessionsPurchased
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const isRenewal = !!existingPackage
    const receiptType = isRenewal ? 'Physiotherapy Renewal' : 'Physiotherapy'

    // Create physiotherapy package
    const physioPackage = await prisma.physiotherapyPackage.create({
      data: {
        clientName,
        clientPhone,
        memberId: memberId || null,
        packageType,
        sessionsPurchased: pricing.sessionCount,
        sessionsUsed: 0,
        pricePerSession: pricing.pricePerSession,
        totalPrice: pricing.finalPrice,
        discountAmount: pricing.discountAmount,
        discountPercent: pricing.discountPercent,
        memberTier: memberTier ? memberTier.charAt(0).toUpperCase() + memberTier.slice(1) : null,
        basePrice: pricing.basePrice,
        paymentMethod: paymentMethod || 'cash',
        staffName,
        referringCoachId: referringCoachId || null,
      },
    })

    // Create receipt
    // ✅ توليد رقم إيصال جديد بطريقة آمنة (atomic increment)
    const receiptNumber = await getNextReceiptNumber(prisma)

    // Prepare receipt details
    const receiptDetails = {
      clientName,
      clientPhone,
      packageType,
      sessionsPurchased: pricing.sessionCount,
      pricePerSession: pricing.pricePerSession,
      basePrice: pricing.basePrice,
      discount: pricing.discountAmount,
      discountPercent: pricing.discountPercent,
      memberTier: memberTier ? formatTierName(memberTier, 'ar') : 'غير عضو',
      totalPrice: pricing.finalPrice,
      staffName,
      isRenewal: isRenewal,
    }

    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        type: receiptType,
        amount: pricing.finalPrice,
        paymentMethod: paymentMethod || 'cash',
        itemDetails: JSON.stringify(receiptDetails),
        physiotherapyId: physioPackage.id,
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
      const upsellAmount = calculateUpsellCommission(pricing.finalPrice, 'physiotherapy')

      await prisma.coachCommission.create({
        data: {
          coachId: referringCoachId,
          type: 'upsell_physio',
          amount: upsellAmount,
          receiptId: receipt.id,
          month: new Date().toISOString().slice(0, 7), // "YYYY-MM"
          calculationDetails: JSON.stringify({
            packageType,
            baseAmount: pricing.finalPrice,
            rate: 0.05,
            sessions: pricing.sessionCount
          })
        }
      })
    }

    // Award loyalty points if member
    if (memberId) {
      const points = calculatePurchasePoints(pricing.finalPrice)

      if (points > 0) {
        await earnPoints({
          memberId,
          points,
          source: 'purchase',
          description: `شراء باقة علاج طبيعي - ${pricing.sessionCount} جلسة`,
          receiptId: receiptNumber.toString(),
          staffName,
          metadata: {
            packageType,
            sessionCount: pricing.sessionCount,
            totalPaid: pricing.finalPrice,
            discount: pricing.discountAmount
          }
        })
      }
    }

    return NextResponse.json(physioPackage, { status: 201 })
  } catch (error: any) {
    console.error('Error creating physiotherapy package:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'فشل إنشاء الباقة' },
      { status: 500 }
    )
  }
}

// ==================== DELETE - Delete physiotherapy package ====================

export async function DELETE(request: NextRequest) {
  try {
    await requirePermission(request, 'canDeletePhysio')

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'معرف الباقة مطلوب' }, { status: 400 })
    }

    // Delete package (will cascade to sessions and receipts)
    await prisma.physiotherapyPackage.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'تم حذف الباقة بنجاح' })
  } catch (error: any) {
    console.error('Error deleting package:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    return NextResponse.json({ error: 'فشل حذف الباقة' }, { status: 500 })
  }
}
