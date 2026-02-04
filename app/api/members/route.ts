// app/api/members/route.ts - مع فحص الصلاحيات
import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { earnPoints, calculatePurchasePoints } from '../../../lib/loyaltySystem'
import { handleReferralReward } from '../../../lib/referralRewards'
import { handleCoachRegistrationEarning } from '../../../lib/coachEarnings'
import { triggerLicenseCheckAfterReceipt } from '../../../lib/licenseCheckHelper'
import {
  getStaffIdFromReceipt,
  isSalesStaff,
  getMonthString,
  getStaffInfo
} from '../../../lib/commissions/salesHelpers'
import {
  calculateSalesRenewalBonus,
  createSalesRenewalCommission,
  getRenewalTypeFromOffer,
  getRenewalTypeFromMonths
} from '../../../lib/commissions/salesRenewal'

// 🔧 دالة للبحث عن رقم إيصال متاح (integers فقط)
async function getNextAvailableReceiptNumber(startingNumber: number): Promise<number> {
  let currentNumber = parseInt(startingNumber.toString())
  let attempts = 0
  const MAX_ATTEMPTS = 100
  
  while (attempts < MAX_ATTEMPTS) {
    const existingReceipt = await prisma.receipt.findUnique({
      where: { receiptNumber: currentNumber }
    })
    
    if (!existingReceipt) {
      console.log(`✅ رقم إيصال متاح: ${currentNumber}`)
      return currentNumber
    }
    
    console.log(`⚠️ رقم ${currentNumber} موجود، تجربة ${currentNumber + 1}...`)
    currentNumber++
    attempts++
  }
  
  throw new Error(`فشل إيجاد رقم إيصال متاح بعد ${MAX_ATTEMPTS} محاولة`)
}

// GET - جلب كل الأعضاء أو البحث عن عضو محدد
export async function GET(request: Request) {
  try {
    // ✅ التحقق من صلاحية عرض الأعضاء
    await requirePermission(request, 'canViewMembers')

    const { searchParams } = new URL(request.url)
    const memberNumber = searchParams.get('memberNumber')
    const phone = searchParams.get('phone')
    const id = searchParams.get('id')

    console.log('🔍 بدء جلب الأعضاء...', { memberNumber, phone, id })

    // بناء شروط البحث
    let where: any = {}

    if (id) {
      // البحث بالـ ID المباشر
      where.id = id
    } else if (memberNumber) {
      // البحث برقم العضوية
      const parsedNumber = parseInt(memberNumber)
      if (!isNaN(parsedNumber)) {
        where.memberNumber = parsedNumber
      }
    } else if (phone) {
      // البحث برقم الهاتف
      where.phone = { contains: phone }
    }

    const members = await prisma.member.findMany({
      where,
      orderBy: { memberNumber: 'desc' },
      include: {
        receipts: true,
        assignedCoach: {
          select: {
            id: true,
            name: true,
            staffCode: true
          }
        }
      }
    })

    console.log('✅ تم جلب', members.length, 'عضو')

    if (!Array.isArray(members)) {
      console.error('❌ Prisma لم يرجع array:', typeof members)
      return NextResponse.json([], { status: 200 })
    }

    return NextResponse.json(members, { status: 200 })
  } catch (error: any) {
    console.error('❌ Error fetching members:', error)
    
    // التعامل مع أخطاء الصلاحيات
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض الأعضاء' },
        { status: 403 }
      )
    }
    
    return NextResponse.json([], { 
      status: 200,
      headers: {
        'X-Error': 'Failed to fetch members'
      }
    })
  }
}

// POST - إضافة عضو جديد
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إضافة عضو
    await requirePermission(request, 'canCreateMembers')
    
    const body = await request.json()
    const {
      memberNumber,
      name,
      phone,
      nationalId,   // ⭐ الرقم القومي
      email,        // ⭐ البريد الإلكتروني
      profileImage,
      inBodyScans,
      invitations,
      freePTSessions,
      subscriptionPrice,
      subscriptionType,
      notes,
      startDate,
      expiryDate,
      paymentMethod,
      staffName,
      isOther,
      customCreatedAt,
      skipReceipt,  // ✅ خيار عدم إنشاء إيصال
      offerId,      // ⭐ معرف الباقة
      offerName,    // ⭐ اسم الباقة
      birthdate,    // ⭐ تاريخ الميلاد
      // Package Benefits
      movementAssessments,
      nutritionSessions,
      monthlyAttendanceGoal,
      onboardingSessions,
      followUpSessions,
      groupClasses,
      poolSessions,
      paddleSessions,
      freezingDays,
      upgradeAllowedDays,
      referredById,      // ⭐ معرف العضو المُحيل
      assignedCoachId    // ⭐ معرف المدرب المعين
    } = body

    console.log('📝 إضافة عضو جديد:', {
      memberNumber,
      name,
      profileImage,
      isOther,
      staffName: staffName || '(غير محدد)'
    })

    // ✅ التحقق من الحقول المطلوبة
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'اسم العضو مطلوب' },
        { status: 400 }
      )
    }

    if (!phone || phone.trim() === '') {
      return NextResponse.json(
        { error: 'رقم الهاتف مطلوب' },
        { status: 400 }
      )
    }

    if (!subscriptionPrice || subscriptionPrice <= 0) {
      return NextResponse.json(
        { error: 'سعر الاشتراك مطلوب ويجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    // تحويل كل الأرقام لـ integers
    let cleanMemberNumber = null
    
    if (isOther === true) {
      cleanMemberNumber = null
      console.log('✅ عضو Other (بدون رقم عضوية)')
    } else {
      if (!memberNumber) {
        return NextResponse.json(
          { error: 'رقم العضوية مطلوب' },
          { status: 400 }
        )
      }
      cleanMemberNumber = parseInt(memberNumber.toString())
      console.log('✅ عضو عادي برقم:', cleanMemberNumber)
    }
    
    const cleanInBodyScans = parseInt((inBodyScans || 0).toString())
    const cleanInvitations = parseInt((invitations || 0).toString())
    const cleanFreePTSessions = parseInt((freePTSessions || 0).toString())
    const cleanSubscriptionPrice = parseInt(subscriptionPrice.toString())
    const cleanMovementAssessments = parseInt((movementAssessments || 0).toString())
    const cleanNutritionSessions = parseInt((nutritionSessions || 0).toString())
    const cleanMonthlyAttendanceGoal = parseInt((monthlyAttendanceGoal || 0).toString())
    const cleanOnboardingSessions = parseInt((onboardingSessions || 0).toString())
    const cleanFollowUpSessions = parseInt((followUpSessions || 0).toString())
    const cleanGroupClasses = parseInt((groupClasses || 0).toString())
    const cleanPoolSessions = parseInt((poolSessions || 0).toString())
    const cleanPaddleSessions = parseInt((paddleSessions || 0).toString())
    const cleanFreezingDays = parseInt((freezingDays || 0).toString())
    const cleanUpgradeAllowedDays = parseInt((upgradeAllowedDays || 0).toString())

    // التحقق من أن رقم العضوية غير مستخدم (إذا لم يكن Other)
    if (cleanMemberNumber !== null) {
      const existingMember = await prisma.member.findUnique({
        where: { memberNumber: cleanMemberNumber }
      })
      
      if (existingMember) {
        console.error('❌ رقم العضوية مستخدم:', cleanMemberNumber)
        return NextResponse.json(
          { error: `رقم العضوية ${cleanMemberNumber} مستخدم بالفعل` }, 
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
    }

    // ⭐ التحقق من العضو المُحيل
    if (referredById) {
      const referrer = await prisma.member.findUnique({
        where: { id: referredById },
        select: { id: true, name: true, isActive: true }
      })

      if (!referrer) {
        return NextResponse.json(
          { error: 'العضو المُحيل غير موجود' },
          { status: 400 }
        )
      }

      if (!referrer.isActive) {
        return NextResponse.json(
          { error: 'العضو المُحيل غير نشط' },
          { status: 400 }
        )
      }
    }

    // ⭐ التحقق من المدرب
    if (assignedCoachId) {
      const coach = await prisma.staff.findUnique({
        where: { id: assignedCoachId },
        select: { id: true, name: true, position: true, isActive: true }
      })

      if (!coach) {
        return NextResponse.json(
          { error: 'المدرب غير موجود' },
          { status: 400 }
        )
      }

      // ✅ تم إزالة الفحص على isActive - السماح بجميع الكوتشات

      if (!coach.position?.includes('مدرب')) {
        return NextResponse.json(
          { error: 'الموظف المحدد ليس مدرباً' },
          { status: 400 }
        )
      }
    }

    // إنشاء العضو
    const memberData: any = {
      memberNumber: cleanMemberNumber,
      name,
      phone,
      nationalId: nationalId || null,  // ⭐ الرقم القومي (اختياري)
      email: email || null,            // ⭐ البريد الإلكتروني (اختياري)
      profileImage,
      inBodyScans: cleanInBodyScans,
      invitations: cleanInvitations,
      freePTSessions: cleanFreePTSessions,
      subscriptionPrice: cleanSubscriptionPrice,
      subscriptionType: subscriptionType || null,
      notes,
      startDate: startDate ? new Date(startDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      birthdate: birthdate ? new Date(birthdate) : null,
      currentOfferId: offerId || null,
      currentOfferName: offerName || null,
      movementAssessments: cleanMovementAssessments,
      nutritionSessions: cleanNutritionSessions,
      monthlyAttendanceGoal: cleanMonthlyAttendanceGoal,
      onboardingSessions: cleanOnboardingSessions,
      followUpSessions: cleanFollowUpSessions,
      groupClasses: cleanGroupClasses,
      poolSessions: cleanPoolSessions,
      paddleSessions: cleanPaddleSessions,
      freezingDays: cleanFreezingDays,
      upgradeAllowedDays: cleanUpgradeAllowedDays,
      referredById: referredById || null,      // ⭐ ربط العضو المُحيل
      assignedCoachId: assignedCoachId || null // ⭐ ربط المدرب المعين
    }

    // إذا كان هناك تاريخ مخصص من الأدمن، استخدمه
    if (customCreatedAt) {
      memberData.createdAt = new Date(customCreatedAt)
      console.log('⏰ استخدام تاريخ مخصص للعضو:', new Date(customCreatedAt))
    }

    const member = await prisma.member.create({
      data: memberData,
    })

    console.log('✅ تم إنشاء العضو:', member.id, 'رقم العضوية:', member.memberNumber)

    // تحديث MemberCounter بعد الحفظ الناجح
    if (cleanMemberNumber !== null) {
      try {
        let counter = await prisma.memberCounter.findUnique({ where: { id: 1 } })
        
        if (!counter) {
          await prisma.memberCounter.create({
            data: { id: 1, current: cleanMemberNumber + 1 }
          })
          console.log('📊 تم إنشاء MemberCounter بقيمة:', cleanMemberNumber + 1)
        } else {
          if (cleanMemberNumber >= counter.current) {
            await prisma.memberCounter.update({
              where: { id: 1 },
              data: { current: cleanMemberNumber + 1 }
            })
            console.log('🔄 تم تحديث MemberCounter إلى:', cleanMemberNumber + 1)
          } else {
            console.log('ℹ️ المحتوى الحالي للـ Counter أعلى، لا داعي للتحديث')
          }
        }
      } catch (counterError) {
        console.error('⚠️ خطأ في تحديث MemberCounter (غير حرج):', counterError)
      }
    }

    // ⭐ معالجة مكافأة الإحالة (إذا كان هناك مُحيل)
    let referralReward = null
    if (referredById) {
      try {
        await handleReferralReward(referredById, member.id)

        // جلب معلومات المُحيل للرسالة
        const referrer = await prisma.member.findUnique({
          where: { id: referredById },
          select: { name: true }
        })

        const loyalty = await prisma.memberLoyalty.findUnique({
          where: { memberId: referredById },
          select: { referralCount: true }
        })

        if (referrer && loyalty) {
          referralReward = {
            referrerName: referrer.name,
            referralNumber: loyalty.referralCount,
            points: loyalty.referralCount === 1 ? 1000 : 0,
            cashReward: loyalty.referralCount % 5 === 0 ? 1000 : 0
          }
        }
      } catch (error) {
        console.error('⚠️ خطأ في معالجة مكافأة الإحالة:', error)
        // لا نوقف العملية - المكافأة غير حرجة
      }
    }

    // ⭐ معالجة مكافأة On-boarding للمدرب (إذا كان هناك مدرب معين)
    if (assignedCoachId) {
      try {
        await handleCoachRegistrationEarning(
          assignedCoachId,
          member.id,
          member.memberNumber,
          member.subscriptionType
        )
      } catch (error) {
        console.error('⚠️ خطأ في إنشاء مكافأة On-boarding للمدرب:', error)
        // لا نوقف العملية - المكافأة غير حرجة
      }
    }

    // إنشاء إيصال (إلا إذا طلب المستخدم عدم إنشائه)
    let receiptData = null

    if (!skipReceipt) {
      // ✅ إنشاء الإيصال فقط إذا لم يتم تفعيل خيار عدم الإنشاء
      try {
      let counter = await prisma.receiptCounter.findUnique({ where: { id: 1 } })
      
      if (!counter) {
        console.log('📊 إنشاء عداد الإيصالات لأول مرة')
        counter = await prisma.receiptCounter.create({
          data: { id: 1, current: 1000 }
        })
      }

      console.log('🧾 رقم الإيصال من العداد:', counter.current)

      const availableReceiptNumber = await getNextAvailableReceiptNumber(counter.current)
      
      console.log('✅ سيتم استخدام رقم الإيصال:', availableReceiptNumber)

      let subscriptionDays = null
      if (startDate && expiryDate) {
        const start = new Date(startDate)
        const end = new Date(expiryDate)
        subscriptionDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }

      // ✅ تحديد renewalType للعمولات (من الباقة أو من المدة)
      let renewalType: string | null = null
      if (offerName) {
        renewalType = getRenewalTypeFromOffer(offerName)
        console.log('🎁 تم تحديد renewalType من الباقة:', { offerName, renewalType })
      } else if (subscriptionType) {
        // Fallback: تحديد من نوع الاشتراك
        const months = subscriptionType === '1month' ? 1
          : subscriptionType === '3months' ? 3
          : subscriptionType === '6months' ? 6
          : subscriptionType === '1year' ? 12
          : 0
        if (months > 0) {
          renewalType = getRenewalTypeFromMonths(months)
          console.log('📅 تم تحديد renewalType من المدة:', { subscriptionType, months, renewalType })
        }
      }

      const newReceiptData: any = {
        receiptNumber: availableReceiptNumber,
        type: 'Member',
        amount: cleanSubscriptionPrice,
        paymentMethod: paymentMethod || 'cash',
        staffName: staffName.trim(),
        renewalType: renewalType, // ✅ حفظ renewalType للعمولات
        itemDetails: JSON.stringify({
          memberNumber: cleanMemberNumber,
          memberName: name,
          phone: phone,
          subscriptionPrice: cleanSubscriptionPrice,
          paidAmount: cleanSubscriptionPrice,
          freePTSessions: cleanFreePTSessions,
          inBodyScans: cleanInBodyScans,
          invitations: cleanInvitations,
          startDate: startDate,
          expiryDate: expiryDate,
          subscriptionDays: subscriptionDays,
          staffName: staffName.trim(),
          isOther: isOther === true,
          offerName: offerName, // ✅ حفظ اسم الباقة
        }),
        memberId: member.id,
      }

      // إذا كان هناك تاريخ مخصص من الأدمن، استخدمه للإيصال أيضاً
      if (customCreatedAt) {
        newReceiptData.createdAt = new Date(customCreatedAt)
        console.log('⏰ استخدام تاريخ مخصص للإيصال:', new Date(customCreatedAt))
      }

      const receipt = await prisma.receipt.create({
        data: newReceiptData,
      })

      console.log('✅ تم إنشاء الإيصال:', receipt.receiptNumber)

      // 💰 حساب عمولة المبيعات للاشتراك الجديد
      try {
        console.log('💰 محاولة حساب عمولة المبيعات للإيصال:', {
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          staffName: staffName.trim(),
          receiptType: receipt.type,
          renewalType: renewalType
        })

        // تحقق من وجود renewalType
        if (renewalType) {
          // تحقق من عدم وجود عمولة مسبقة
          const existingCommission = await prisma.coachCommission.findFirst({
            where: {
              receiptId: receipt.id,
              type: { startsWith: 'sales_renewal_' }
            }
          })

          if (existingCommission) {
            console.log('⚠️ العمولة موجودة مسبقاً')
          } else {
            // الحصول على staffId من staffName
            const staffId = await getStaffIdFromReceipt({ staffName: receipt.staffName })

            if (staffId) {
              // الحصول على معلومات الموظف بما فيها isTopSales
              const staffInfo = await getStaffInfo(staffId)

              if (staffInfo) {
                // تحقق من أن الموظف هو موظف مبيعات
                const isSales = await isSalesStaff(staffId)

                if (isSales) {
                  // حساب قيمة العمولة مع مكافأة Top Sales
                  const bonusAmount = calculateSalesRenewalBonus(renewalType as any, staffInfo.isTopSales)

                  // إنشاء سجل العمولة
                  const commission = await createSalesRenewalCommission({
                    staffId,
                    renewalType: renewalType as any,
                    amount: bonusAmount,
                    receiptId: receipt.id,
                    memberId: receipt.memberId || undefined,
                    month: getMonthString(receipt.createdAt)
                  })

                  console.log('✅ تم إنشاء عمولة مبيعات بنجاح:', {
                    id: commission.id,
                    amount: commission.amount,
                    type: commission.type,
                    isTopSales: staffInfo.isTopSales
                  })
                } else {
                  console.log('ℹ️ الموظف ليس موظف مبيعات (ريسبشن)')
                }
              } else {
                console.log('⚠️ معلومات الموظف غير متوفرة')
              }
            } else {
              console.log('⚠️ لم يتم العثور على الموظف')
            }
          }
        } else {
          console.log('ℹ️ لا يوجد renewalType - تخطي حساب العمولة')
        }
      } catch (salesBonusError) {
        console.error('⚠️ خطأ في حساب عمولة المبيعات (غير حرج):', salesBonusError)
      }

      // 🔒 فحص الترخيص بعد إنشاء الإيصال
      triggerLicenseCheckAfterReceipt()

      const newCounterValue = availableReceiptNumber + 1
      await prisma.receiptCounter.update({
        where: { id: 1 },
        data: { current: newCounterValue }
      })

      console.log('🔄 تم تحديث عداد الإيصالات إلى:', newCounterValue)

      // ⭐ منح نقاط الشراء
      if (cleanSubscriptionPrice > 0) {
        try {
          const purchasePoints = calculatePurchasePoints(cleanSubscriptionPrice)

          if (purchasePoints > 0) {
            await earnPoints({
              memberId: member.id,
              points: purchasePoints,
              source: 'purchase',
              description: `نقاط شراء اشتراك: ${cleanSubscriptionPrice.toFixed(2)} ج.م`,
              receiptId: receipt.id,
              staffName: staffName?.trim() || 'System'
            })
            console.log(`⭐ تم منح ${purchasePoints} نقطة ولاء للعضو`)
          }
        } catch (loyaltyError) {
          console.error('⚠️ خطأ في منح نقاط الولاء (غير حرج):', loyaltyError)
        }
      }

      // ⭐ محاولة منح نقاط الإحالة (إذا كان هناك إحالة)
      try {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        await fetch(`${baseUrl}/api/loyalty/referral-complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newMemberId: member.id })
        })
      } catch (referralError) {
        console.log('⚠️ فشل فحص الإحالة:', referralError)
        // لا تفشل العملية الأساسية
      }

      receiptData = {
        receiptNumber: receipt.receiptNumber,
        amount: receipt.amount,
        paymentMethod: receipt.paymentMethod,
        staffName: receipt.staffName,
        createdAt: receipt.createdAt,
        itemDetails: JSON.parse(receipt.itemDetails)
      }

    } catch (receiptError) {
      console.error('❌ خطأ في إنشاء الإيصال:', receiptError)
      if (receiptError instanceof Error && receiptError.message.includes('Unique constraint')) {
        console.error('❌ رقم الإيصال مكرر! المحاولة مرة أخرى...')
      }
    }
    } else {
      console.log('🚫 تم تخطي إنشاء الإيصال (skipReceipt = true)')
    }

    return NextResponse.json({
      success: true,
      member: member,
      receipt: receiptData,
      referralReward: referralReward
    }, { status: 201 })

  } catch (error: any) {
    console.error('❌ خطأ في إضافة العضو:', error)
    
    // التعامل مع أخطاء الصلاحيات
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إضافة أعضاء' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل إضافة العضو' }, { status: 500 })
  }
}

// PUT - تحديث عضو
export async function PUT(request: Request) {
  try {
    // ✅ التحقق من صلاحية تعديل عضو
    await requirePermission(request, 'canEditMembers')

    const body = await request.json()
    console.log('📥 البيانات الواردة للـ PUT:', body)

    const { id, profileImage, ...data } = body
    console.log('🔍 البيانات بعد الفصل:', { id, profileImage, data })

    const updateData: any = {}
    
    // تحويل كل الأرقام لـ integers
    if (data.memberNumber !== undefined) {
      updateData.memberNumber = data.memberNumber ? parseInt(data.memberNumber.toString()) : null
    }
    if (data.inBodyScans !== undefined) {
      updateData.inBodyScans = parseInt(data.inBodyScans.toString())
    }
    if (data.invitations !== undefined) {
      updateData.invitations = parseInt(data.invitations.toString())
    }
    if (data.freePTSessions !== undefined) {
      updateData.freePTSessions = parseInt(data.freePTSessions.toString())
    }
    if (data.subscriptionPrice !== undefined) {
      updateData.subscriptionPrice = parseInt(data.subscriptionPrice.toString())
    }
    if (data.subscriptionType !== undefined) {
      updateData.subscriptionType = data.subscriptionType
    }
    if (data.remainingAmount !== undefined) {
      updateData.remainingAmount = parseInt(data.remainingAmount.toString())
    }

    // Package Benefits
    if (data.movementAssessments !== undefined) {
      updateData.movementAssessments = parseInt(data.movementAssessments.toString())
    }
    if (data.nutritionSessions !== undefined) {
      updateData.nutritionSessions = parseInt(data.nutritionSessions.toString())
    }
    if (data.onboardingSessions !== undefined) {
      updateData.onboardingSessions = parseInt(data.onboardingSessions.toString())
    }
    if (data.followUpSessions !== undefined) {
      updateData.followUpSessions = parseInt(data.followUpSessions.toString())
    }
    if (data.groupClasses !== undefined) {
      updateData.groupClasses = parseInt(data.groupClasses.toString())
    }
    if (data.poolSessions !== undefined) {
      updateData.poolSessions = parseInt(data.poolSessions.toString())
    }
    if (data.paddleSessions !== undefined) {
      updateData.paddleSessions = parseInt(data.paddleSessions.toString())
    }
    if (data.freezingDays !== undefined) {
      updateData.freezingDays = parseInt(data.freezingDays.toString())
    }
    if (data.monthlyAttendanceGoal !== undefined) {
      updateData.monthlyAttendanceGoal = parseInt(data.monthlyAttendanceGoal.toString())
    }
    if (data.upgradeAllowedDays !== undefined) {
      updateData.upgradeAllowedDays = parseInt(data.upgradeAllowedDays.toString())
    }

    if (profileImage !== undefined) {
      updateData.profileImage = profileImage
    }

    if (data.name) updateData.name = data.name
    if (data.phone) updateData.phone = data.phone
    if (data.nationalId !== undefined) updateData.nationalId = data.nationalId || null  // ⭐ الرقم القومي
    if (data.email !== undefined) updateData.email = data.email || null                // ⭐ البريد الإلكتروني
    if (data.notes !== undefined) updateData.notes = data.notes

    if (data.startDate) {
      updateData.startDate = new Date(data.startDate)
    }
    if (data.expiryDate) {
      updateData.expiryDate = new Date(data.expiryDate)
    }

    // Freeze Fields
    if (data.freezeStartDate !== undefined) {
      updateData.freezeStartDate = data.freezeStartDate ? new Date(data.freezeStartDate) : null
      console.log('🧊 تحديث freezeStartDate:', updateData.freezeStartDate)
    }
    if (data.freezeEndDate !== undefined) {
      updateData.freezeEndDate = data.freezeEndDate ? new Date(data.freezeEndDate) : null
      console.log('🧊 تحديث freezeEndDate:', updateData.freezeEndDate)
    }
    if (data.isFrozen !== undefined) {
      updateData.isFrozen = Boolean(data.isFrozen)
      console.log('🧊 تحديث isFrozen:', updateData.isFrozen)
    }

    console.log('📝 بيانات التحديث الكاملة:', JSON.stringify(updateData, null, 2))
    console.log('🆔 Member ID:', id)

    const member = await prisma.member.update({
      where: { id },
      data: updateData,
    })

    console.log('✅ العضو بعد التحديث من Prisma:', {
      id: member.id,
      name: member.name,
      isFrozen: member.isFrozen,
      freezeStartDate: member.freezeStartDate,
      freezeEndDate: member.freezeEndDate,
      expiryDate: member.expiryDate
    })

    return NextResponse.json(member)
  } catch (error: any) {
    console.error('Error updating member:', error)
    
    // التعامل مع أخطاء الصلاحيات
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل الأعضاء' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل تحديث العضو' }, { status: 500 })
  }
}

// DELETE - حذف عضو
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من صلاحية حذف عضو
    await requirePermission(request, 'canDeleteMembers')
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'رقم العضو مطلوب' }, { status: 400 })
    }

    await prisma.member.delete({ where: { id } })
    return NextResponse.json({ message: 'تم الحذف بنجاح' })
  } catch (error: any) {
    console.error('Error deleting member:', error)
    
    // التعامل مع أخطاء الصلاحيات
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية حذف الأعضاء' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل حذف العضو' }, { status: 500 })
  }
}