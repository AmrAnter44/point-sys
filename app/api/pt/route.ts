import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { triggerLicenseCheckAfterReceipt } from '../../../lib/licenseCheckHelper'
import { getNextReceiptNumber } from '../../../lib/receiptNumberGenerator'
// @ts-ignore
import bwipjs from 'bwip-js'

// GET - جلب كل جلسات PT
export async function GET(request: Request) {
  try {
    // ✅ التحقق من صلاحية عرض PT
    const user = await requirePermission(request, 'canViewPT')

    // فلترة البيانات حسب الدور
    const whereClause = user.role === 'COACH'
      ? { coachUserId: user.userId }  // الكوتش يرى عملائه فقط
      : {}  // الأدمن يرى الكل

    const ptSessions = await prisma.pT.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: { receipts: true }
    })

    // ⭐ جلب subscriptionType لكل عميل من جدول Members بناءً على رقم الهاتف
    const ptSessionsWithSubscription = await Promise.all(
      ptSessions.map(async (session) => {
        const member = await prisma.member.findFirst({
          where: { phone: session.phone },
          select: { subscriptionType: true }
        })
        return {
          ...session,
          subscriptionType: member?.subscriptionType || null
        }
      })
    )

    return NextResponse.json(ptSessionsWithSubscription)
  } catch (error: any) {
    console.error('Error fetching PT sessions:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض جلسات PT' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل جلب جلسات PT' }, { status: 500 })
  }
}

// POST - إضافة جلسة PT جديدة
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إنشاء PT
    await requirePermission(request, 'canCreatePT')
    
    const body = await request.json()
    const {
      ptNumber,
      clientName,
      phone,
      sessionsPurchased,
      coachName,
      pricePerSession,
      totalPrice,
      startDate,
      expiryDate,
      paymentMethod,
      staffName,
      isOnlineCoaching
    } = body

    console.log('📝 إضافة جلسة PT جديدة:', { ptNumber, clientName, sessionsPurchased, isOnlineCoaching })

    // ✅ التحقق من الحقول المطلوبة
    // For online coaching, PT number is optional (will be auto-generated)
    if (!isOnlineCoaching && !ptNumber) {
      return NextResponse.json(
        { error: 'رقم PT مطلوب' },
        { status: 400 }
      )
    }

    if (!clientName || clientName.trim() === '') {
      return NextResponse.json(
        { error: 'اسم العميل مطلوب' },
        { status: 400 }
      )
    }

    if (!phone || phone.trim() === '') {
      return NextResponse.json(
        { error: 'رقم الهاتف مطلوب' },
        { status: 400 }
      )
    }

    if (!coachName || coachName.trim() === '') {
      return NextResponse.json(
        { error: 'اسم الكوتش مطلوب' },
        { status: 400 }
      )
    }

    if (!sessionsPurchased || sessionsPurchased <= 0) {
      return NextResponse.json(
        { error: 'عدد الجلسات مطلوب ويجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    if (pricePerSession === undefined || pricePerSession < 0) {
      return NextResponse.json(
        { error: 'سعر الجلسة مطلوب ولا يمكن أن يكون سالب' },
        { status: 400 }
      )
    }

    // ✅ تحديد رقم PT (إما من المستخدم أو توليد تلقائي للأونلاين كوتشينج)
    let finalPtNumber: number

    if (isOnlineCoaching && !ptNumber) {
      // توليد رقم PT تلقائياً للأونلاين كوتشينج
      const lastPT = await prisma.pT.findFirst({
        orderBy: { ptNumber: 'desc' },
        select: { ptNumber: true }
      })
      finalPtNumber = lastPT ? lastPT.ptNumber + 1 : 1
      console.log(`🌐 توليد رقم PT تلقائي للأونلاين كوتشينج: ${finalPtNumber}`)
    } else {
      finalPtNumber = parseInt(ptNumber)

      // التحقق من أن رقم PT غير مستخدم
      const existingPT = await prisma.pT.findUnique({
        where: { ptNumber: finalPtNumber }
      })

      if (existingPT) {
        console.error('❌ رقم PT مستخدم:', finalPtNumber)
        return NextResponse.json(
          { error: `رقم PT ${finalPtNumber} مستخدم بالفعل` },
          { status: 400 }
        )
      }
    }

    // التحقق من التواريخ
    if (startDate && expiryDate) {
      const start = new Date(startDate)
      const end = new Date(expiryDate)

      if (end <= start) {
        return NextResponse.json(
          { error: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية' },
          { status: 400 }
        )
      }

      // ✅ التحقق من مدة شهر واحد فقط (28-32 يوم)
      const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

      if (durationDays < 28 || durationDays > 32) {
        return NextResponse.json(
          { error: `اشتراكات البرايفت يجب أن تكون شهر واحد فقط. المدة المحددة: ${durationDays} يوم` },
          { status: 400 }
        )
      }
    }

    // البحث عن الكوتش بالاسم لربط coachUserId
    let coachUserId = null
    if (coachName) {
      const coachStaff = await prisma.staff.findFirst({
        where: { name: coachName },
        include: { user: true }
      })

      if (coachStaff && coachStaff.user) {
        coachUserId = coachStaff.user.id
        console.log(`✅ تم ربط الكوتش ${coachName} بـ userId: ${coachUserId}`)
      } else {
        console.warn(`⚠️ لم يتم العثور على حساب مستخدم للكوتش: ${coachName}`)
      }
    }

    // توليد Barcode (skip for online coaching)
    let barcodeText = ''
    let qrCodeImage = ''

    if (!isOnlineCoaching) {
      let isUnique = false

      // التأكد من أن الـ barcode فريد
      while (!isUnique) {
        barcodeText = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('')
        const existing = await prisma.pT.findUnique({
          where: { qrCode: barcodeText }
        })
        if (!existing) {
          isUnique = true
        }
      }

      console.log(`🔢 تم توليد Barcode عشوائي (16 رقم): ${barcodeText}`)

      // توليد Barcode كصورة
      try {
        const png = await bwipjs.toBuffer({
          bcid: 'code128',
          text: barcodeText,
          scale: 5,
          height: 15,
          includetext: true,
        })

        const base64 = png.toString('base64')
        qrCodeImage = `data:image/png;base64,${base64}`
        console.log('✅ تم توليد Barcode كصورة')
      } catch (barcodeError) {
        console.error('❌ فشل توليد صورة Barcode:', barcodeError)
      }
    } else {
      console.log('🌐 تخطي توليد Barcode للأونلاين كوتشينج')
    }

    // إنشاء جلسة PT
    const pt = await prisma.pT.create({
      data: {
        ptNumber: finalPtNumber,
        clientName,
        phone,
        sessionsPurchased,
        sessionsRemaining: sessionsPurchased,
        coachName,
        coachUserId,  // ✅ ربط الكوتش بـ userId
        pricePerSession,
        startDate: startDate ? new Date(startDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        qrCode: barcodeText || null,
        qrCodeImage: qrCodeImage || null,
        isOnlineCoaching: isOnlineCoaching || false
      },
    })

    console.log('✅ تم إنشاء جلسة PT:', pt.ptNumber)

    // إنشاء إيصال
    let receiptData = null
    try {
      // ✅ توليد رقم إيصال جديد بطريقة آمنة (atomic increment)
      const newReceiptNumber = await getNextReceiptNumber(prisma)

      // استخدام totalPrice المرسل من الفورم بدلاً من إعادة الحساب لتجنب أخطاء floating point
      const totalAmount = totalPrice || (sessionsPurchased * pricePerSession)

      let subscriptionDays = null
      if (startDate && expiryDate) {
        const start = new Date(startDate)
        const end = new Date(expiryDate)
        subscriptionDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }

      const receipt = await prisma.receipt.create({
        data: {
          receiptNumber: newReceiptNumber,
          type: 'اشتراك برايفت',
          amount: totalAmount,  // ✅ المبلغ الكامل
          paymentMethod: paymentMethod || 'cash',
          staffName: staffName || '',
          ptNumber: pt.ptNumber,  // ✅ إضافة ptNumber
          itemDetails: JSON.stringify({
            ptNumber: pt.ptNumber,
            clientName,
            phone: phone,
            sessionsPurchased,
            pricePerSession,
            totalAmount,
            coachName,
            startDate: startDate,
            expiryDate: expiryDate,
            subscriptionDays: subscriptionDays,
            isOnlineCoaching: isOnlineCoaching || false
          }),
        },
      })

      console.log('✅ تم إنشاء الإيصال:', receipt.receiptNumber)

      // 🔒 فحص الترخيص بعد إنشاء الإيصال
      triggerLicenseCheckAfterReceipt()

      receiptData = {
        receiptNumber: receipt.receiptNumber,
        amount: receipt.amount,
        paymentMethod: receipt.paymentMethod,
        staffName: receipt.staffName,
        itemDetails: JSON.parse(receipt.itemDetails),
        createdAt: receipt.createdAt
      }

    } catch (receiptError) {
      console.error('❌ خطأ في إنشاء الإيصال:', receiptError)
    }

    return NextResponse.json({
      pt,
      receipt: receiptData
    }, { status: 201 })
  } catch (error: any) {
    console.error('❌ خطأ في إضافة جلسة PT:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إضافة جلسات PT' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل إضافة جلسة PT' }, { status: 500 })
  }
}

// PUT - تحديث جلسة PT
export async function PUT(request: Request) {
  try {
    // ✅ التحقق من صلاحية تعديل PT
    await requirePermission(request, 'canEditPT')
    
    const body = await request.json()
    const { ptNumber, action, ...data } = body

    if (action === 'use_session') {
      const pt = await prisma.pT.findUnique({ where: { ptNumber: parseInt(ptNumber) } })
      
      if (!pt) {
        return NextResponse.json({ error: 'جلسة PT غير موجودة' }, { status: 404 })
      }

      if (pt.sessionsRemaining <= 0) {
        return NextResponse.json({ error: 'لا توجد جلسات متبقية' }, { status: 400 })
      }

      const updatedPT = await prisma.pT.update({
        where: { ptNumber: parseInt(ptNumber) },
        data: { sessionsRemaining: pt.sessionsRemaining - 1 },
      })

      return NextResponse.json(updatedPT)
    } else {
      const updateData: any = { ...data }

      if (data.startDate) {
        updateData.startDate = new Date(data.startDate)
      }
      if (data.expiryDate) {
        updateData.expiryDate = new Date(data.expiryDate)
      }

      // ✅ التحقق من مدة شهر واحد عند تحديث التواريخ
      if (updateData.startDate && updateData.expiryDate) {
        const start = updateData.startDate
        const end = updateData.expiryDate
        const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

        if (durationDays < 28 || durationDays > 32) {
          return NextResponse.json(
            { error: `اشتراكات البرايفت يجب أن تكون شهر واحد فقط. المدة المحددة: ${durationDays} يوم` },
            { status: 400 }
          )
        }
      }

      const pt = await prisma.pT.update({
        where: { ptNumber: parseInt(ptNumber) },
        data: updateData,
      })

      return NextResponse.json(pt)
    }
  } catch (error: any) {
    console.error('Error updating PT:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل جلسات PT' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل تحديث جلسة PT' }, { status: 500 })
  }
}

// DELETE - حذف جلسة PT
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من صلاحية حذف PT
    await requirePermission(request, 'canDeletePT')
    
    const { searchParams } = new URL(request.url)
    const ptNumber = searchParams.get('ptNumber')

    if (!ptNumber) {
      return NextResponse.json({ error: 'رقم PT مطلوب' }, { status: 400 })
    }

    await prisma.pT.delete({ where: { ptNumber: parseInt(ptNumber) } })
    return NextResponse.json({ message: 'تم الحذف بنجاح' })
  } catch (error: any) {
    console.error('Error deleting PT:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية حذف جلسات PT' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل حذف جلسة PT' }, { status: 500 })
  }
}