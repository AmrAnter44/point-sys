import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { generateMemberBarcode } from '../../../lib/barcodeGenerator'
import { triggerLicenseCheckAfterReceipt } from '../../../lib/licenseCheckHelper'
import { getNextReceiptNumber } from '../../../lib/receiptNumberGenerator'

// GET - جلب جميع باقات الكلاسات
export async function GET(request: Request) {
  try {
    const user = await requirePermission(request, 'canViewPT') // استخدام نفس صلاحية PT مؤقتاً

    // فلترة حسب الدور
    const whereClause = user.role === 'COACH'
      ? { instructorId: user.staffId || '' }
      : {}

    const packages = await prisma.classPackage.findMany({
      where: whereClause,
      include: {
        sessions: true,
        receipts: true,
        member: true,
        instructor: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(packages)
  } catch (error) {
    console.error('Error fetching class packages:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 })
  }
}

// POST - إنشاء باقة كلاسات جديدة
export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, 'canCreatePT') // استخدام نفس صلاحية PT مؤقتاً

    const body = await request.json()
    const {
      clientName,
      phone,
      memberId,
      subscriptionType,
      packageType,
      sessionsPurchased,
      instructorName,
      totalPrice,
      pricePerSession,
      paidAmount,
      paymentMethod,
      staffName,
    } = body

    console.log('📦 بيانات إنشاء باقة كلاسات:', {
      clientName,
      phone,
      memberId,
      packageType,
      sessionsPurchased,
    })

    // Validation
    if (!clientName || !phone || !packageType || !sessionsPurchased) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // البحث عن المدرب
    let instructorId = null
    if (instructorName) {
      const instructor = await prisma.staff.findFirst({
        where: { name: instructorName, isActive: true }
      })
      instructorId = instructor?.id || null
      console.log(`👨‍🏫 المدرب: ${instructorName} - ID: ${instructorId}`)
    }

    // Check for existing completed packages (renewal detection)
    const existingPackage = await prisma.classPackage.findFirst({
      where: {
        phone,
        sessionsRemaining: 0
      },
      orderBy: { createdAt: 'desc' }
    })

    const isRenewal = !!existingPackage
    const receiptType = isRenewal ? 'تجديد كلاسات' : 'باقة كلاسات'

    // Generate barcode فقط للأعضاء المشتركين
    let qrCode = null
    let qrCodeImage = null

    if (memberId && subscriptionType) {
      // التأكد من أن العضوية صالحة
      const member = await prisma.member.findUnique({
        where: { id: memberId }
      })

      if (member && member.expiryDate) {
        const barcodeData = await generateMemberBarcode('ClassPackage', member.expiryDate)
        qrCode = barcodeData.qrCode
        qrCodeImage = barcodeData.qrCodeImage
      }
    }

    // Create package
    const classPackage = await prisma.classPackage.create({
      data: {
        clientName,
        phone,
        memberId: memberId || null,
        subscriptionType: subscriptionType || null,
        packageType,
        sessionsPurchased: parseInt(sessionsPurchased),
        sessionsRemaining: parseInt(sessionsPurchased),
        instructorName: instructorName || null,
        instructorId,
        pricePerSession: parseFloat(pricePerSession),
        totalPrice: parseFloat(totalPrice),
        paidAmount: parseFloat(paidAmount) || parseFloat(totalPrice),
        remainingAmount: parseFloat(totalPrice) - (parseFloat(paidAmount) || parseFloat(totalPrice)),
        qrCode,
        qrCodeImage,
      },
    })

    console.log(`✅ تم إنشاء باقة كلاسات #${classPackage.packageNumber}`)

    // ✅ توليد رقم إيصال جديد بطريقة آمنة (atomic increment)
    const receiptNumber = await getNextReceiptNumber(prisma)

    // Create receipt
    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        type: receiptType,
        amount: parseFloat(paidAmount) || parseFloat(totalPrice),
        paymentMethod: paymentMethod || 'cash',
        staffName: staffName || user.name || 'Unknown',
        itemDetails: JSON.stringify({
          packageNumber: classPackage.packageNumber,
          clientName,
          phone,
          packageType,
          sessionsPurchased: parseInt(sessionsPurchased),
          pricePerSession: parseFloat(pricePerSession),
          totalPrice: parseFloat(totalPrice),
          paidAmount: parseFloat(paidAmount) || parseFloat(totalPrice),
          remainingAmount: classPackage.remainingAmount,
          instructorName,
          isRenewal: isRenewal,
          subscriptionType: subscriptionType,
        }),
      },
    })

    console.log(`🧾 تم إنشاء إيصال #${receipt.receiptNumber}`)

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

    // 🔒 فحص الترخيص بعد إنشاء الإيصال
    triggerLicenseCheckAfterReceipt()

    return NextResponse.json({
      success: true,
      package: classPackage,
      receipt,
    })
  } catch (error) {
    console.error('❌ Error creating class package:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to create package' }, { status: 500 })
  }
}
