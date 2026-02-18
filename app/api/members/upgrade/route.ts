import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import {
  checkUpgradeEligibility,
  calculateUpgradePrice,
  calculateNewExpiryDate,
  getUpgradeableOffers
} from '../../../../lib/upgradeValidation'
import {
  earnPoints,
  calculatePurchasePoints,
  calculateUpgradePoints
} from '../../../../lib/loyaltySystem'
import { calculateUpsellCommission } from '../../../../lib/commissions/upsell'
import {
  getStaffIdFromReceipt,
  isSalesStaff,
  getMonthString,
  getStaffInfo
} from '../../../../lib/commissions/salesHelpers'
import {
  calculateSalesRenewalBonus,
  createSalesRenewalCommission,
  getRenewalTypeFromOffer
} from '../../../../lib/commissions/salesRenewal'
import { calculateOnboardingBonus, getOnboardingCommissionType } from '../../../../lib/commissions/onboarding'
import { logActivity, ACTIONS, RESOURCES } from '../../../../lib/activityLog'

// GET - جلب الباقات المتاحة للترقية
export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canViewMembers')

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json(
        { error: 'معرف العضو مطلوب' },
        { status: 400 }
      )
    }

    // التحقق من الأهلية
    const eligibility = await checkUpgradeEligibility(memberId)

    if (!eligibility.eligible) {
      return NextResponse.json({
        eligible: false,
        reason: eligibility.reason,
        offers: []
      })
    }

    // جلب الباقات المتاحة
    const offers = await getUpgradeableOffers(memberId)

    return NextResponse.json({
      eligible: true,
      daysRemaining: eligibility.daysRemaining,
      currentOffer: eligibility.currentOffer,
      isExpired: eligibility.isExpired,
      warning: eligibility.warning,
      offers
    })

  } catch (error: any) {
    console.error('خطأ في جلب باقات الترقية:', error)

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

    return NextResponse.json(
      { error: 'فشل جلب باقات الترقية' },
      { status: 500 }
    )
  }
}

// POST - تنفيذ ترقية الاشتراك
export async function POST(request: Request) {
  try {
    const currentUser = await requirePermission(request, 'canEditMembers')

    const body = await request.json()
    const { memberId, newOfferId, paymentMethod, staffName, notes, referringCoachId, customPrice } = body

    console.log('🚀 بدء عملية ترقية الاشتراك:', { memberId, newOfferId })

    // التحقق من البيانات المطلوبة
    if (!memberId || !newOfferId || !staffName) {
      return NextResponse.json(
        { error: 'البيانات المطلوبة ناقصة' },
        { status: 400 }
      )
    }

    // التحقق من أهلية الترقية
    const eligibility = await checkUpgradeEligibility(memberId)

    if (!eligibility.eligible) {
      return NextResponse.json(
        { error: eligibility.reason || 'غير مؤهل للترقية' },
        { status: 400 }
      )
    }

    // جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member || !member.currentOfferId || !member.startDate) {
      return NextResponse.json(
        { error: 'بيانات العضو غير صحيحة' },
        { status: 400 }
      )
    }

    // حساب سعر الترقية (مع خصم الحضور إن كان مؤهلاً)
    const priceDetails = await calculateUpgradePrice(
      member.currentOfferId,
      newOfferId,
      member.id,              // معرف العضو لحساب خصم الحضور
      member.startDate        // تاريخ بداية الاشتراك
    )

    // جلب تفاصيل الباقة الجديدة
    const newOffer = await prisma.offer.findUnique({
      where: { id: newOfferId }
    })

    if (!newOffer) {
      return NextResponse.json(
        { error: 'الباقة الجديدة غير موجودة' },
        { status: 404 }
      )
    }

    // حساب تاريخ النهاية الجديد
    // الصيغة الصحيحة: تاريخ انتهاء الحالي + (مدة الباقة الجديدة - مدة الباقة الحالية)
    const currentOfferDuration = eligibility.currentOffer?.duration || 0
    const upgradeDate = new Date() // تاريخ الترقية = اليوم
    const currentExpiryDate = member.expiryDate || upgradeDate
    const newExpiryDate = calculateNewExpiryDate(
      currentExpiryDate,
      newOffer.duration,
      currentOfferDuration
    )

    // حفظ معلومات الباقة القديمة
    const oldOfferId = member.currentOfferId
    const oldOfferName = member.currentOfferName
    const oldSessions = {
      freePTSessions: member.freePTSessions,
      inBodyScans: member.inBodyScans,
      invitations: member.invitations
    }
    const oldExpiryDate = member.expiryDate

    console.log('📊 تفاصيل الترقية:', {
      oldOffer: oldOfferName,
      newOffer: newOffer.name,
      upgradePrice: priceDetails.upgradePrice,
      oldSessions,
      newSessions: {
        freePTSessions: newOffer.freePTSessions,
        inBodyScans: newOffer.inBodyScans,
        invitations: newOffer.invitations
      }
    })

    // تحديث بيانات العضو (استبدال الحصص، وليس تراكم)
    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        currentOfferId: newOfferId,
        currentOfferName: newOffer.name,
        subscriptionPrice: newOffer.price,
        remainingAmount: 0, // إعادة تعيين
        freePTSessions: newOffer.freePTSessions, // استبدال
        inBodyScans: newOffer.inBodyScans, // استبدال
        invitations: newOffer.invitations, // استبدال
        movementAssessments: newOffer.movementAssessments || 0, // استبدال
        nutritionSessions: newOffer.nutritionSessions || 0, // استبدال
        monthlyAttendanceGoal: newOffer.monthlyAttendanceGoal || 0, // استبدال
        onboardingSessions: newOffer.onboardingSessions || 0, // استبدال
        followUpSessions: newOffer.followUpSessions || 0, // استبدال
        groupClasses: newOffer.groupClasses || 0, // استبدال
        poolSessions: newOffer.poolSessions || 0, // استبدال
        paddleSessions: newOffer.paddleSessions || 0, // استبدال
        freezingDays: newOffer.freezingDays || 0, // استبدال
        upgradeAllowedDays: newOffer.upgradeAllowedDays || 0, // استبدال
        expiryDate: newExpiryDate,
        startDate: upgradeDate, // ✅ إعادة تعيين من تاريخ الترقية لبدء عداد الحضور من الصفر
        notes: notes || member.notes,
        referringCoachId: referringCoachId || member.referringCoachId,
      }
    })

    console.log('✅ تم تحديث بيانات العضو')

    // إنشاء إيصال الترقية
    let receipt = null
    try {
      let counter = await prisma.receiptCounter.findUnique({
        where: { id: 1 }
      })

      if (!counter) {
        counter = await prisma.receiptCounter.create({
          data: { id: 1, current: 1000 }
        })
      }

      // البحث عن رقم إيصال متاح
      let receiptNumber = counter.current
      let attempts = 0
      const MAX_ATTEMPTS = 100

      while (attempts < MAX_ATTEMPTS) {
        const existing = await prisma.receipt.findUnique({
          where: { receiptNumber }
        })

        if (!existing) break

        receiptNumber++
        attempts++
      }

      const paidAmount = (customPrice !== undefined && customPrice !== null && !isNaN(customPrice))
        ? Number(customPrice)
        : priceDetails.upgradePrice

      // ✅ تحديد renewalType للعمولات من اسم الباقة الجديدة
      const renewalType = getRenewalTypeFromOffer(newOffer.name)
      console.log('🎁 تم تحديد renewalType من الباقة الجديدة:', { offerName: newOffer.name, renewalType })

      receipt = await prisma.receipt.create({
        data: {
          receiptNumber,
          type: 'Membership Upgrade',
          amount: paidAmount,
          paymentMethod: paymentMethod || 'cash',
          staffName: staffName.trim(),
          memberId: member.id,
          referringCoachId: referringCoachId || null,
          renewalType: renewalType, // ✅ حفظ renewalType للعمولات
          itemDetails: JSON.stringify({
            memberNumber: member.memberNumber,
            memberName: member.name,
            phone: member.phone,

            upgradeType: 'subscription_upgrade',
            isUpgrade: true,

            oldOfferId,
            oldOfferName,
            oldOfferPrice: priceDetails.oldOfferPrice,
            oldOfferDuration: eligibility.currentOffer?.duration,

            newOfferId,
            newOfferName: newOffer.name,
            newOfferPrice: priceDetails.newOfferPrice,
            newOfferDuration: newOffer.duration,

            upgradePrice: priceDetails.upgradePrice,
            paidAmount,
            remainingAmount: 0,

            // معلومات خصم الحضور
            attendanceDiscount: priceDetails.attendanceDiscount || 0,
            attendanceEligible: priceDetails.attendanceEligibility?.eligible || false,
            attendanceDetails: priceDetails.attendanceEligibility ? {
              currentAverage: priceDetails.attendanceEligibility.currentAverage,
              requiredAverage: priceDetails.attendanceEligibility.requiredAverage,
              discountPercent: priceDetails.attendanceEligibility.discountPercent,
              totalCheckIns: priceDetails.attendanceEligibility.totalCheckIns,
              monthsElapsed: priceDetails.attendanceEligibility.monthsElapsed,
              discountReason: priceDetails.attendanceEligibility.discountReason
            } : null,

            oldSessions,
            newSessions: {
              freePTSessions: newOffer.freePTSessions,
              inBodyScans: newOffer.inBodyScans,
              invitations: newOffer.invitations
            },

            dates: {
              startDate: upgradeDate,
              oldExpiryDate,
              newExpiryDate
            },

            staffName: staffName.trim()
          })
        }
      })

      await prisma.receiptCounter.update({
        where: { id: 1 },
        data: { current: receiptNumber + 1 }
      })

      console.log('✅ تم إنشاء إيصال الترقية:', receipt.receiptNumber)

      // Create commission record if coach referred this upgrade (using onboarding bonus system)
      if (referringCoachId) {
        const subscriptionMonths = newOffer.duration
        const onboardingAmount = calculateOnboardingBonus(subscriptionMonths)

        if (onboardingAmount > 0) {
          await prisma.coachCommission.create({
            data: {
              coachId: referringCoachId,
              type: getOnboardingCommissionType(subscriptionMonths),
              amount: onboardingAmount,
              receiptId: receipt.id,
              memberId: member.id,
              month: new Date().toISOString().slice(0, 7),
              status: 'approved',
              calculationDetails: JSON.stringify({
                upgradeType: 'subscription_upgrade',
                oldOfferName: oldOfferName,
                newOfferName: newOffer.name,
                newOfferDuration: subscriptionMonths,
                onboardingAmount: onboardingAmount,
                tier: subscriptionMonths === 1 ? 'Challenger' : subscriptionMonths === 3 ? 'Fighter' : subscriptionMonths === 6 ? 'Champion' : 'Elite'
              })
            }
          })

          console.log(`✅ تم إضافة عمولة Onboarding ${onboardingAmount} ج.م للمدرب على الترقية`)
        } else {
          console.log(`⚠️ لا توجد عمولة onboarding للترقية (${subscriptionMonths} شهر)`)
        }
      }

      // 💰 حساب عمولة المبيعات للترقية
      try {
        console.log('💰 محاولة حساب عمولة المبيعات للترقية:', {
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          staffName: staffName.trim(),
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

      // منح نقاط الشراء
      if (paidAmount > 0) {
        try {
          const purchasePoints = calculatePurchasePoints(paidAmount)

          if (purchasePoints > 0) {
            await earnPoints({
              memberId: member.id,
              points: purchasePoints,
              source: 'purchase',
              description: `نقاط ترقية الاشتراك: ${paidAmount.toFixed(2)} ج.م`,
              receiptId: receipt.id,
              staffName: staffName.trim()
            })
            console.log(`⭐ تم منح ${purchasePoints} نقطة شراء`)
          }
        } catch (loyaltyError) {
          console.error('⚠️ خطأ في منح نقاط الشراء:', loyaltyError)
        }
      }

      // منح نقاط الترقية
      try {
        const upgradePoints = await calculateUpgradePoints(
          oldOfferId,
          newOfferId,
          member.startDate
        )

        if (upgradePoints > 0) {
          await earnPoints({
            memberId: member.id,
            points: upgradePoints,
            source: 'upgrade',
            description: `نقاط ترقية الباقة من ${oldOfferName} إلى ${newOffer.name}`,
            receiptId: receipt.id,
            staffName: staffName.trim()
          })
          console.log(`🚀 تم منح ${upgradePoints} نقطة ترقية`)
        }
      } catch (upgradeError) {
        console.error('⚠️ خطأ في منح نقاط الترقية:', upgradeError)
      }

    } catch (receiptError) {
      console.error('❌ خطأ في إنشاء الإيصال:', receiptError)
    }

    // 📋 تسجيل النشاط
    logActivity({
      userId: currentUser.userId,
      action: ACTIONS.UPGRADE,
      resource: RESOURCES.MEMBER,
      resourceId: member.id,
      details: JSON.stringify({
        memberName: member.name,
        oldOffer: oldOfferName,
        newOffer: newOffer.name,
        price: priceDetails.upgradePrice,
        staffName: staffName?.trim()
      })
    })

    return NextResponse.json({
      member: updatedMember,
      receipt: receipt ? {
        receiptNumber: receipt.receiptNumber,
        amount: receipt.amount,
        paymentMethod: receipt.paymentMethod,
        staffName: receipt.staffName,
        itemDetails: JSON.parse(receipt.itemDetails),
        createdAt: receipt.createdAt
      } : null,
      upgradeDetails: {
        oldOffer: oldOfferName,
        newOffer: newOffer.name,
        upgradePrice: priceDetails.upgradePrice,
        attendanceDiscount: priceDetails.attendanceDiscount || 0,
        attendanceEligibility: priceDetails.attendanceEligibility,
        oldSessions,
        newSessions: {
          freePTSessions: newOffer.freePTSessions,
          inBodyScans: newOffer.inBodyScans,
          invitations: newOffer.invitations
        }
      }
    }, { status: 200 })

  } catch (error: any) {
    console.error('❌ خطأ في ترقية الاشتراك:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية ترقية الاشتراكات' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'فشل ترقية الاشتراك' },
      { status: 500 }
    )
  }
}
