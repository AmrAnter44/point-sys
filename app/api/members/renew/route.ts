// app/api/members/renew/route.ts - مع إضافة staffName والصلاحيات
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { earnPoints, calculatePurchasePoints, calculateUpgradePoints } from '../../../../lib/loyaltySystem'
import { calculateUpsellCommission } from '../../../../lib/commissions/upsell'
import { triggerLicenseCheckAfterReceipt } from '../../../../lib/licenseCheckHelper'
import { getNextReceiptNumber } from '../../../../lib/receiptNumberGenerator'
import {
  isRenewalReceipt,
  getStaffIdFromReceipt,
  isSalesStaff,
  getMonthString,
  getStaffInfo
} from '../../../../lib/commissions/salesHelpers'
import {
  determineRenewalType,
  calculateSalesRenewalBonus,
  createSalesRenewalCommission,
  getRenewalTypeFromOffer,
  getRenewalTypeFromMonths
} from '../../../../lib/commissions/salesRenewal'
import { logActivity, ACTIONS, RESOURCES } from '../../../../lib/activityLog'

// تحويل مدة الباقة (بالأيام) إلى subscriptionType
function durationToSubscriptionType(days: number): string {
  if (days <= 35) return '1month'
  if (days <= 95) return '3months'
  if (days <= 185) return '6months'
  return '1year'
}

// POST - تجديد اشتراك عضو
export async function POST(request: Request) {
  console.log('🚀🚀🚀 بداية API تجديد الاشتراك - الوقت:', new Date().toISOString())

  try {
    // ✅ التحقق من صلاحية تعديل الأعضاء
    const currentUser = await requirePermission(request, 'canEditMembers')

    const body = await request.json()
    const {
      memberId,
      subscriptionPrice,
      remainingAmount = 0,
      freePTSessions = 0,
      inBodyScans = 0,
      invitations = 0,
      startDate,
      expiryDate,
      notes,
      paymentMethod,
      staffName,
      offerId,      // ⭐ معرف الباقة الجديدة
      offerName,    // ⭐ اسم الباقة الجديدة
      referringCoachId, // ⭐ المدرب المُسوّق
      // Package Benefits
      movementAssessments = 0,
      nutritionSessions = 0,
      monthlyAttendanceGoal = 0,
      onboardingSessions = 0,
      followUpSessions = 0,
      groupClasses = 0,
      poolSessions = 0,
      paddleSessions = 0,
      medicalScreeningSessions = 0,
      freezingDays = 0,
      upgradeAllowedDays = 0,
      attendanceLimit = 0
    } = body

    console.log('🔄 تجديد اشتراك عضو:', {
      memberId,
      subscriptionPrice,
      freePTSessions,
      inBodyScans,
      invitations,
      startDate,
      expiryDate,
      paymentMethod,
      staffName,
      offerId
    })

    // جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    // ⭐ جلب بيانات الباقة إذا تم تحديدها
    let additionalFreePT = freePTSessions || 0
    let additionalInBody = inBodyScans || 0
    let additionalInvitations = invitations || 0
    let additionalMovementAssessments = movementAssessments || 0
    let additionalNutritionSessions = nutritionSessions || 0
    let additionalOnboardingSessions = onboardingSessions || 0
    let additionalFollowUpSessions = followUpSessions || 0
    let additionalGroupClasses = groupClasses || 0
    let additionalPoolSessions = poolSessions || 0
    let additionalPaddleSessions = paddleSessions || 0
    let additionalMedicalScreeningSessions = medicalScreeningSessions || 0
    let additionalFreezingDays = freezingDays || 0
    let updatedMonthlyAttendanceGoal = monthlyAttendanceGoal || member.monthlyAttendanceGoal
    let updatedUpgradeAllowedDays = upgradeAllowedDays || member.upgradeAllowedDays
    let updatedAttendanceLimit = attendanceLimit || 0 // حد الحضور (0 = غير محدود)
    let updatedSubscriptionType: string | undefined = undefined // سيُحدَّث عند اختيار باقة
    let offerDurationDays: number | undefined = undefined // مدة الباقة بالأيام

    if (offerId) {
      console.log('📦 جلب بيانات الباقة:', offerId)
      const offer = await prisma.offer.findUnique({
        where: { id: offerId }
      })

      if (offer) {
        console.log('✅ تم العثور على الباقة:', offer.name)
        // استخدام قيم الباقة بدلاً من القيم الافتراضية
        additionalFreePT = offer.freePTSessions || 0
        additionalInBody = offer.inBodyScans || 0
        additionalInvitations = offer.invitations || 0
        additionalMovementAssessments = offer.movementAssessments || 0
        additionalNutritionSessions = offer.nutritionSessions || 0
        additionalOnboardingSessions = offer.onboardingSessions || 0
        additionalFollowUpSessions = offer.followUpSessions || 0
        additionalGroupClasses = offer.groupClasses || 0
        additionalPoolSessions = offer.poolSessions || 0
        additionalPaddleSessions = offer.paddleSessions || 0
        additionalMedicalScreeningSessions = offer.medicalScreeningSessions || 0
        additionalFreezingDays = offer.freezingDays || 0
        updatedMonthlyAttendanceGoal = offer.monthlyAttendanceGoal || 0
        updatedUpgradeAllowedDays = offer.upgradeAllowedDays || 0
        updatedAttendanceLimit = offer.attendanceLimit || 0 // حد الحضور من الباقة
        updatedSubscriptionType = durationToSubscriptionType(offer.duration)
        offerDurationDays = offer.duration

        console.log('📊 خدمات الباقة:', {
          freePTSessions: additionalFreePT,
          inBodyScans: additionalInBody,
          invitations: additionalInvitations,
          movementAssessments: additionalMovementAssessments,
          nutritionSessions: additionalNutritionSessions,
          onboardingSessions: additionalOnboardingSessions,
          followUpSessions: additionalFollowUpSessions,
          groupClasses: additionalGroupClasses,
          poolSessions: additionalPoolSessions,
          paddleSessions: additionalPaddleSessions,
          freezingDays: additionalFreezingDays
        })
      } else {
        console.warn('⚠️ لم يتم العثور على الباقة')
      }
    }

    // حساب حصص PT الجديدة (الحالية + الإضافية)
    const currentFreePT = member.freePTSessions || 0
    const totalFreePT = currentFreePT + additionalFreePT

    // حساب InBody الجديد (الحالي + الإضافي)
    const currentInBody = member.inBodyScans || 0
    const totalInBody = currentInBody + additionalInBody

    // حساب Invitations الجديد (الحالي + الإضافي)
    const currentInvitations = member.invitations || 0
    const totalInvitations = currentInvitations + additionalInvitations

    // حساب Package Benefits (الحالي + الإضافي)
    const totalMovementAssessments = (member.movementAssessments || 0) + additionalMovementAssessments
    const totalNutritionSessions = (member.nutritionSessions || 0) + additionalNutritionSessions
    const totalOnboardingSessions = (member.onboardingSessions || 0) + additionalOnboardingSessions
    const totalFollowUpSessions = (member.followUpSessions || 0) + additionalFollowUpSessions
    const totalGroupClasses = (member.groupClasses || 0) + additionalGroupClasses
    const totalPoolSessions = (member.poolSessions || 0) + additionalPoolSessions
    const totalPaddleSessions = (member.paddleSessions || 0) + additionalPaddleSessions
    const totalMedicalScreeningSessions = (member.medicalScreeningSessions || 0) + additionalMedicalScreeningSessions
    const totalFreezingDays = (member.freezingDays || 0) + additionalFreezingDays

    console.log('💪 حصص PT: الحالية =', currentFreePT, '+ الإضافية =', additionalFreePT, '= الإجمالي =', totalFreePT)
    console.log('⚖️ InBody: الحالي =', currentInBody, '+ الإضافي =', additionalInBody, '= الإجمالي =', totalInBody)
    console.log('🎟️ Invitations: الحالية =', currentInvitations, '+ الإضافية =', additionalInvitations, '= الإجمالي =', totalInvitations)

    // ⭐ حفظ معلومات الباقة القديمة للمقارنة
    const oldOfferId = member.currentOfferId
    const oldOfferName = member.currentOfferName

    // تحديث بيانات العضو
    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        subscriptionPrice,
        remainingAmount: remainingAmount || 0,
        freePTSessions: totalFreePT,
        inBodyScans: totalInBody,
        invitations: totalInvitations,
        movementAssessments: totalMovementAssessments,
        nutritionSessions: totalNutritionSessions,
        monthlyAttendanceGoal: updatedMonthlyAttendanceGoal,
        onboardingSessions: totalOnboardingSessions,
        followUpSessions: totalFollowUpSessions,
        groupClasses: totalGroupClasses,
        poolSessions: totalPoolSessions,
        paddleSessions: totalPaddleSessions,
        medicalScreeningSessions: totalMedicalScreeningSessions,
        freezingDays: totalFreezingDays,
        upgradeAllowedDays: updatedUpgradeAllowedDays,
        attendanceLimit: updatedAttendanceLimit, // حد الحضور الجديد
        startDate: startDate ? new Date(startDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isActive: true,
        notes: notes || member.notes,
        currentOfferId: offerId || oldOfferId,
        currentOfferName: offerName || oldOfferName,
        ...(updatedSubscriptionType && { subscriptionType: updatedSubscriptionType }),
        referringCoachId: referringCoachId || member.referringCoachId,
      },
    })

    console.log('✅ تم تحديث بيانات العضو - PT:', updatedMember.freePTSessions, 'InBody:', updatedMember.inBodyScans, 'Invitations:', updatedMember.invitations)

    // إنشاء إيصال التجديد
    try {
      // ✅ توليد رقم إيصال جديد بطريقة آمنة (atomic increment)
      const availableReceiptNumber = await getNextReceiptNumber(prisma)

      console.log('✅ سيتم استخدام رقم الإيصال:', availableReceiptNumber)

      const paidAmount = subscriptionPrice - (remainingAmount || 0)

      // حساب مدة الاشتراك
      let subscriptionDays = null
      if (startDate && expiryDate) {
        const start = new Date(startDate)
        const end = new Date(expiryDate)
        subscriptionDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }

      // ✅ تحديد renewalType للعمولات
      let renewalType: string | null = null
      const offerNameToUse = offerName || member.currentOfferName

      if (offerNameToUse) {
        renewalType = getRenewalTypeFromOffer(offerNameToUse)
        console.log('🎁 تم تحديد renewalType من اسم الباقة:', { offerNameUsed: offerNameToUse, renewalType })
      }

      // ✅ fallback: لو مفيش renewalType (اسم الباقة عربي مثلاً) نحدده من مدة الباقة
      if (!renewalType && offerId) {
        const offerForType = await prisma.offer.findUnique({ where: { id: offerId }, select: { duration: true } })
        if (offerForType) {
          renewalType = getRenewalTypeFromMonths(
            offerForType.duration <= 35 ? 1 :
            offerForType.duration <= 95 ? 3 :
            offerForType.duration <= 185 ? 6 : 12
          )
          console.log('🔄 تم تحديد renewalType من مدة الباقة:', { duration: offerForType.duration, renewalType })
        }
      }

      // ✅ fallback ثانٍ: من subscriptionDays المحسوبة
      if (!renewalType && subscriptionDays) {
        renewalType = getRenewalTypeFromMonths(
          subscriptionDays <= 35 ? 1 :
          subscriptionDays <= 95 ? 3 :
          subscriptionDays <= 185 ? 6 : 12
        )
        console.log('🔄 تم تحديد renewalType من عدد أيام الاشتراك:', { subscriptionDays, renewalType })
      }

      if (!renewalType) console.warn('⚠️ لم يتم تحديد renewalType - لن يتم حساب عمولة المبيعات')

      const receipt = await prisma.receipt.create({
        data: {
          receiptNumber: availableReceiptNumber,
          type: 'تجديد عضويه',
          amount: paidAmount,
          paymentMethod: paymentMethod || 'cash',
          staffName: staffName.trim(),
          renewalType: renewalType, // ✅ حفظ renewalType للعمولات
          itemDetails: JSON.stringify({
            memberNumber: member.memberNumber,
            memberName: member.name,
            phone: member.phone,
            subscriptionPrice,
            paidAmount,
            remainingAmount: remainingAmount || 0,
            offerName: offerNameToUse, // ✅ حفظ اسم الباقة (جديدة أو حالية)
            // حصص PT في الإيصال
            freePTSessions: additionalFreePT,
            previousFreePTSessions: currentFreePT,
            totalFreePTSessions: totalFreePT,
            // InBody في الإيصال
            inBodyScans: additionalInBody,
            previousInBodyScans: currentInBody,
            totalInBodyScans: totalInBody,
            // Invitations في الإيصال
            invitations: additionalInvitations,
            previousInvitations: currentInvitations,
            totalInvitations: totalInvitations,
            // التواريخ
            previousExpiryDate: member.expiryDate,
            newStartDate: startDate,
            newExpiryDate: expiryDate,
            subscriptionDays: subscriptionDays,
            isRenewal: true,
            staffName: staffName.trim(),
          }),
          memberId: member.id,
          referringCoachId: referringCoachId || null,
        },
      })

      console.log('✅ تم إنشاء إيصال التجديد:', receipt.receiptNumber)

      // 💰 Create sales renewal bonus if applicable
      try {
        console.log('💰 محاولة حساب عمولة المبيعات للإيصال:', {
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          staffName: staffName.trim(),
          receiptType: receipt.type
        })

        // Check if it's a renewal receipt
        if (isRenewalReceipt(receipt)) {
          console.log('✅ الإيصال هو تجديد، متابعة حساب العمولة...')

          // Check if commission already exists
          const existingCommission = await prisma.coachCommission.findFirst({
            where: {
              receiptId: receipt.id,
              type: { startsWith: 'sales_renewal_' }
            }
          })

          if (existingCommission) {
            console.log('⚠️ العمولة موجودة مسبقاً')
          } else {
            // Get staff ID from receipt
            const staffId = await getStaffIdFromReceipt(receipt)

            if (staffId) {
              console.log('👤 تم العثور على الموظف:', staffId)

              // Get staff info including isTopSales
              const staffInfo = await getStaffInfo(staffId)

              if (staffInfo) {
                // Verify staff is sales personnel
                const isSales = await isSalesStaff(staffId)

                if (isSales) {
                  console.log('✅ الموظف هو موظف مبيعات', {
                    name: staffInfo.name,
                    isTopSales: staffInfo.isTopSales
                  })

                  // Determine renewal type
                  const renewalType = determineRenewalType(receipt)

                  if (renewalType) {
                    console.log('📊 نوع التجديد:', renewalType)

                    // Calculate bonus amount with top sales bonus
                    const bonusAmount = calculateSalesRenewalBonus(renewalType, staffInfo.isTopSales)
                    console.log('💵 مبلغ العمولة:', bonusAmount, 'ج.م')

                    // Create commission
                    const commission = await createSalesRenewalCommission({
                      staffId,
                      renewalType,
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
                    console.warn('⚠️ لا يمكن تحديد نوع التجديد')
                  }
                } else {
                  console.warn('⚠️ الموظف ليس موظف مبيعات')
                }
              } else {
                console.warn('⚠️ لم يتم العثور على الموظف')
              }
            }
          }
        } else {
          console.log('ℹ️ الإيصال ليس تجديداً')
        }
      } catch (salesBonusError) {
        // Don't fail renewal if bonus creation fails
        console.error('⚠️ خطأ في حساب عمولة المبيعات (غير حرج):', salesBonusError)
      }

      // 🔒 فحص الترخيص بعد إنشاء الإيصال
      triggerLicenseCheckAfterReceipt()

      // Create commission record if coach referred this renewal
      if (referringCoachId && paidAmount > 0) {
        const upsellAmount = calculateUpsellCommission(paidAmount, 'upgrade')

        await prisma.coachCommission.create({
          data: {
            coachId: referringCoachId,
            type: 'upsell_upgrade',
            amount: upsellAmount,
            receiptId: receipt.id,
            memberId: member.id,
            month: new Date().toISOString().slice(0, 7),
            calculationDetails: JSON.stringify({
              renewalAmount: paidAmount,
              rate: 0.05,
              subscriptionPrice
            })
          }
        })
      }

      // ⭐ منح نقاط الشراء (التجديد العادي)
      if (paidAmount > 0) {
        try {
          const purchasePoints = calculatePurchasePoints(paidAmount, offerDurationDays)

          if (purchasePoints > 0) {
            await earnPoints({
              memberId: member.id,
              points: purchasePoints,
              source: 'purchase',
              description: `نقاط تجديد الاشتراك: ${paidAmount.toFixed(2)} ج.م`,
              receiptId: receipt.id,
              staffName: staffName?.trim() || 'System'
            })
            console.log(`⭐ تم منح ${purchasePoints} نقطة شراء للعضو`)
          }
        } catch (loyaltyError) {
          console.error('⚠️ خطأ في منح نقاط الشراء (غير حرج):', loyaltyError)
        }
      }

      // ⭐ منح نقاط الترقية (إذا كانت ترقية)
      if (offerId && oldOfferId && offerId !== oldOfferId) {
        try {
          const upgradePoints = await calculateUpgradePoints(
            oldOfferId,
            offerId,
            member.startDate
          )

          if (upgradePoints > 0) {
            await earnPoints({
              memberId: member.id,
              points: upgradePoints,
              source: 'upgrade',
              description: `نقاط ترقية الباقة من ${oldOfferName || 'غير محدد'} إلى ${offerName || 'غير محدد'}`,
              receiptId: receipt.id,
              staffName: staffName?.trim() || 'System'
            })
            console.log(`🚀 تم منح ${upgradePoints} نقطة ترقية للعضو`)
          } else {
            console.log('ℹ️ لا توجد نقاط ترقية (ليست ترقية حقيقية أو خارج فترة الترقية)')
          }
        } catch (upgradeError) {
          console.error('⚠️ خطأ في منح نقاط الترقية (غير حرج):', upgradeError)
        }
      }

      // 📋 تسجيل النشاط
      logActivity({
        userId: currentUser.userId,
        action: ACTIONS.RENEW,
        resource: RESOURCES.MEMBER,
        resourceId: member.id,
        details: JSON.stringify({
          memberName: member.name,
          offerName: offerName || member.currentOfferName,
          price: subscriptionPrice,
          staffName: staffName?.trim()
        })
      })

      return NextResponse.json({
        member: updatedMember,
        receipt: {
          receiptNumber: receipt.receiptNumber,
          amount: receipt.amount,
          paymentMethod: receipt.paymentMethod,
          staffName: receipt.staffName,
          itemDetails: JSON.parse(receipt.itemDetails),
          createdAt: receipt.createdAt
        }
      }, { status: 200 })

    } catch (receiptError: any) {
      console.error('❌ خطأ في إنشاء إيصال التجديد:', receiptError)
      console.error('❌ تفاصيل الخطأ:', {
        message: receiptError?.message,
        code: receiptError?.code,
        meta: receiptError?.meta,
        stack: receiptError?.stack
      })
      return NextResponse.json({
        member: updatedMember,
        receipt: null,
        warning: 'تم التجديد لكن فشل إنشاء الإيصال',
        error: receiptError?.message || String(receiptError)
      }, { status: 200 })
    }

  } catch (error: any) {
    console.error('❌ خطأ في تجديد الاشتراك:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تجديد الاشتراكات' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ 
      error: 'فشل تجديد الاشتراك' 
    }, { status: 500 })
  }
}