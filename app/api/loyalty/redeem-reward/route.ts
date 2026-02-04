import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'

// المستويات الثابتة للمكافآت
const REDEMPTION_TIERS = {
  CASHBACK: {
    points: 500,
    creditAmount: 100,
    type: 'cashback',
    nameAr: 'رصيد 100 جنيه',
    nameEn: '100 EGP Credit'
  },
  DAY_ACCESS: {
    points: 1000,
    type: 'day_access',
    nameAr: 'يوم دخول واحد',
    nameEn: 'Single Day Access',
    subOptions: {
      POOL: { field: 'poolSessions', nameAr: 'يوم مسبح', nameEn: 'Pool Day Access' },
      PADEL: { field: 'paddleSessions', nameAr: 'يوم باديل', nameEn: 'Padel Day Access' }
    }
  },
  SPECIALIZED_SERVICE: {
    points: 1500,
    type: 'specialized_service',
    nameAr: 'خدمات متخصصة',
    nameEn: 'Specialized Services',
    subOptions: {
      NUTRITION: { field: 'nutritionSessions', nameAr: 'جلسة تغذية واحدة', nameEn: 'Single Nutrition Session' },
      PHYSIOTHERAPY: { field: 'physiotherapySessions', nameAr: 'جلسة علاج طبيعي واحدة', nameEn: 'Single Physiotherapy Session' }
    }
  },
  FREE_MONTH: {
    points: 3000,
    days: 30,
    type: 'free_days',
    nameAr: 'شهر مجاني',
    nameEn: 'Free Month'
  },
  FREE_YEAR: {
    points: 6000,
    days: 365,
    type: 'free_renewal',
    nameAr: 'سنة مجانية',
    nameEn: 'Free Year'
  }
}

type RewardType = keyof typeof REDEMPTION_TIERS

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'canManageLoyaltyPoints')
    const { memberId, rewardType, subOption } = await req.json()

    // التحقق من نوع المكافأة
    if (!rewardType || !(rewardType in REDEMPTION_TIERS)) {
      return NextResponse.json({ error: 'نوع المكافأة غير صحيح' }, { status: 400 })
    }

    const tier = REDEMPTION_TIERS[rewardType as RewardType]

    // التحقق من الخيار الفرعي إذا كان مطلوباً
    if ('subOptions' in tier && tier.subOptions) {
      if (!subOption || !(subOption in tier.subOptions)) {
        return NextResponse.json({ error: 'يجب اختيار الخدمة المطلوبة' }, { status: 400 })
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. جلب بيانات العضو والنقاط
      const [member, loyalty] = await Promise.all([
        tx.member.findUnique({ where: { id: memberId } }),
        tx.memberLoyalty.findUnique({ where: { memberId } })
      ])

      if (!member) {
        throw new Error('العضو غير موجود')
      }

      if (!loyalty) {
        throw new Error('سجل النقاط غير موجود')
      }

      if (loyalty.pointsBalance < tier.points) {
        throw new Error('رصيد النقاط غير كافي')
      }

      // 2. خصم النقاط
      await tx.memberLoyalty.update({
        where: { id: loyalty.id },
        data: {
          pointsBalance: { decrement: tier.points },
          totalRedeemed: { increment: tier.points }
        }
      })

      let receiptData = null
      let memberUpdate = null

      // 3. تطبيق المكافأة حسب النوع
      if (tier.type === 'cashback') {
        // إضافة رصيد للعضو
        const creditAmount = 'creditAmount' in tier ? tier.creditAmount : 0
        memberUpdate = await tx.member.update({
          where: { id: memberId },
          data: {
            pointsCredit: { increment: creditAmount }
          }
        })
      } else if (tier.type === 'day_access' || tier.type === 'specialized_service') {
        // إضافة جلسة واحدة من الخدمة المحددة
        if ('subOptions' in tier && tier.subOptions && subOption) {
          const selectedSubOption = (tier.subOptions as any)[subOption]
          if (selectedSubOption && selectedSubOption.field) {
            const fieldName = selectedSubOption.field
            memberUpdate = await tx.member.update({
              where: { id: memberId },
              data: {
                [fieldName]: { increment: 1 }
              }
            })
          }
        }
      } else if (tier.type === 'free_days' || tier.type === 'free_renewal') {
        // تجديد بباقة Elite (السنة المجانية)
        const days = 'days' in tier ? tier.days : 0

        // جلب باقة Elite
        const eliteOffer = await tx.offer.findFirst({
          where: {
            name: { contains: 'Elite' }
          }
        })

        if (!eliteOffer) {
          throw new Error('باقة Elite غير موجودة')
        }

        // حساب تاريخ البداية والنهاية
        const currentExpiry = member.expiryDate ? new Date(member.expiryDate) : new Date()
        const startDate = currentExpiry > new Date() ? currentExpiry : new Date()
        const newExpiry = new Date(startDate)
        newExpiry.setTime(newExpiry.getTime() + (days * 24 * 60 * 60 * 1000))

        // تحديث العضو بباقة Elite كاملة
        memberUpdate = await tx.member.update({
          where: { id: memberId },
          data: {
            expiryDate: newExpiry,
            startDate: startDate,
            currentOfferId: eliteOffer.id,
            currentOfferName: eliteOffer.name,
            subscriptionPrice: eliteOffer.price,
            // إضافة مميزات باقة Elite (جمع مع الموجود)
            freePTSessions: { increment: eliteOffer.freePTSessions || 0 },
            inBodyScans: { increment: eliteOffer.inBodyScans || 0 },
            invitations: { increment: eliteOffer.invitations || 0 },
            movementAssessments: { increment: eliteOffer.movementAssessments || 0 },
            nutritionSessions: { increment: eliteOffer.nutritionSessions || 0 },
            monthlyAttendanceGoal: eliteOffer.monthlyAttendanceGoal || member.monthlyAttendanceGoal,
            onboardingSessions: { increment: eliteOffer.onboardingSessions || 0 },
            followUpSessions: { increment: eliteOffer.followUpSessions || 0 },
            groupClasses: { increment: eliteOffer.groupClasses || 0 },
            poolSessions: { increment: eliteOffer.poolSessions || 0 },
            paddleSessions: { increment: eliteOffer.paddleSessions || 0 },
            freezingDays: eliteOffer.freezingDays || member.freezingDays,
            upgradeAllowedDays: eliteOffer.upgradeAllowedDays || member.upgradeAllowedDays,
            isActive: true
          }
        })

        // إنشاء إيصال بقيمة 0 جنيه
        const receiptNumber = await getNextReceiptNumber(tx)
        receiptData = await tx.receipt.create({
          data: {
            receiptNumber,
            type: 'Points Redemption',
            amount: 0,
            paymentMethod: 'points',
            renewalType: 'gym_elite', // ✅ حفظ نوع التجديد
            itemDetails: JSON.stringify({
              memberNumber: member.memberNumber,
              memberName: member.name,
              phone: member.phone,
              rewardType,
              pointsUsed: tier.points,
              daysAdded: days,
              rewardName: tier.nameAr,
              offerName: eliteOffer.name,
              offerId: eliteOffer.id,
              subscriptionPrice: eliteOffer.price,
              paidAmount: 0,
              remainingAmount: 0,
              // حصص Elite
              freePTSessions: eliteOffer.freePTSessions || 0,
              inBodyScans: eliteOffer.inBodyScans || 0,
              invitations: eliteOffer.invitations || 0,
              movementAssessments: eliteOffer.movementAssessments || 0,
              nutritionSessions: eliteOffer.nutritionSessions || 0,
              onboardingSessions: eliteOffer.onboardingSessions || 0,
              followUpSessions: eliteOffer.followUpSessions || 0,
              groupClasses: eliteOffer.groupClasses || 0,
              poolSessions: eliteOffer.poolSessions || 0,
              paddleSessions: eliteOffer.paddleSessions || 0,
              // التواريخ
              previousExpiryDate: member.expiryDate,
              newStartDate: startDate,
              newExpiryDate: newExpiry,
              subscriptionDays: days,
              isRenewal: true,
              isPointsRedemption: true,
              staffName: user.name
            }),
            memberId,
            staffName: user.name
          }
        })
      }

      // 4. تسجيل الحركة في LoyaltyTransaction
      let description = `استبدال نقاط: ${tier.nameAr}`

      // إضافة تفاصيل الخيار الفرعي إذا وجد
      if ('subOptions' in tier && tier.subOptions && subOption) {
        const selectedSubOption = (tier.subOptions as any)[subOption]
        if (selectedSubOption && selectedSubOption.nameAr) {
          description += ` - ${selectedSubOption.nameAr}`
        }
      }

      description += ` (${tier.points} نقطة)`

      await tx.loyaltyTransaction.create({
        data: {
          loyaltyId: loyalty.id,
          memberId,
          type: 'redeem',
          points: -tier.points,
          source: 'redemption',
          description,
          receiptId: receiptData?.id,
          staffName: user.name,
          metadata: JSON.stringify({
            rewardType,
            subOption,
            tier,
            oldBalance: loyalty.pointsBalance,
            newBalance: loyalty.pointsBalance - tier.points
          })
        }
      })

      return {
        success: true,
        tier,
        memberUpdate,
        receipt: receiptData,
        newBalance: loyalty.pointsBalance - tier.points
      }
    })

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Redemption error:', error)
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء الاستبدال' },
      { status: 500 }
    )
  }
}

// دالة مساعدة للحصول على رقم الإيصال التالي
async function getNextReceiptNumber(tx: any): Promise<number> {
  const counter = await tx.receiptCounter.findFirst()

  if (!counter) {
    await tx.receiptCounter.create({ data: { current: 1001 } })
    return 1001
  }

  const newNumber = counter.current + 1
  await tx.receiptCounter.update({
    where: { id: counter.id },
    data: { current: newNumber }
  })

  return newNumber
}
