import { prisma } from './prisma'

// ==================== Types ====================

interface EarnPointsParams {
  memberId: string
  points: number
  source: 'purchase' | 'upgrade' | 'referral' | 'birthday' | 'goal' | 'review' | 'session'
  description: string
  receiptId?: string
  invitationId?: string
  staffName?: string
  metadata?: Record<string, any>
}

// ==================== Translation Helper ====================

const translations = {
  ar: {
    goalAchievement: {
      prefix: 'تحقيق هدف',
      weight_loss: 'خسارة وزن',
      muscle_gain: 'بناء عضلات',
      strength: 'تحطيم رقم قياسي'
    },
    upgradePoints: {
      prefix: 'نقاط ترقية الباقة من',
      to: 'إلى',
      undefined: 'غير محدد'
    },
    reviewBonus: 'مكافأة المراجعة العامة (Google/Facebook)',
    sessionAttendance: {
      prefix: 'حضور',
      nutrition: 'جلسة تغذية',
      physio: 'جلسة فيزيو',
      pt: 'جلسة PT'
    }
  },
  en: {
    goalAchievement: {
      prefix: 'Goal Achievement',
      weight_loss: 'Weight Loss',
      muscle_gain: 'Muscle Gain',
      strength: 'Personal Record'
    },
    upgradePoints: {
      prefix: 'Package upgrade points from',
      to: 'to',
      undefined: 'undefined'
    },
    reviewBonus: 'Public Review Bonus (Google/Facebook)',
    sessionAttendance: {
      prefix: 'Attended',
      nutrition: 'Nutrition Session',
      physio: 'Physiotherapy Session',
      pt: 'PT Session'
    }
  }
}

function t(lang: 'ar' | 'en', key: string): any {
  const keys = key.split('.')
  let value: any = translations[lang]
  for (const k of keys) {
    value = value[k]
    if (!value) return key
  }
  return value
}

// ==================== Constants ====================

/**
 * معدل تحويل النقاط إلى جنيه مصري
 * Based on CASHBACK reward: 500 points = 100 EGP
 */
export const POINTS_TO_EGP_RATE = 0.2 // 1 point = 0.2 EGP (or 5 points = 1 EGP)

/**
 * تحويل النقاط إلى جنيه مصري
 */
export function convertPointsToEGP(points: number): number {
  return points * POINTS_TO_EGP_RATE
}

// ==================== Point Calculation ====================

/**
 * حساب نقاط الشراء: 1 نقطة لكل 10 جنيه
 */
export function calculatePurchasePoints(amountPaid: number): number {
  return Math.floor(amountPaid / 10)
}

/**
 * حساب نقاط الترقية: 500 نقطة لكل مستوى
 */
export async function calculateUpgradePoints(
  oldOfferId: string | null,
  newOfferId: string,
  memberStartDate: Date | null
): Promise<number> {
  // Get offers
  const [oldOffer, newOffer] = await Promise.all([
    oldOfferId ? prisma.offer.findUnique({ where: { id: oldOfferId } }) : null,
    prisma.offer.findUnique({ where: { id: newOfferId } })
  ])

  if (!newOffer) return 0
  if (!oldOffer) return 0 // Not an upgrade, new member

  // Determine tier levels (based on duration)
  const getTier = (duration: number) => {
    if (duration <= 30) return 1   // Challenger
    if (duration <= 90) return 2   // Fighter
    if (duration <= 180) return 3  // Champion
    return 4                        // Elite
  }

  const oldTier = getTier(oldOffer.duration)
  const newTier = getTier(newOffer.duration)

  // Only award if it's an upgrade
  if (newTier <= oldTier) return 0

  // Check if within upgrade window
  if (memberStartDate && newOffer.upgradeAllowedDays > 0) {
    const daysSinceStart = Math.floor(
      (Date.now() - memberStartDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Only award if within the allowed upgrade period
    if (daysSinceStart > newOffer.upgradeAllowedDays) {
      return 0 // خارج فترة الترقية المسموحة
    }
  }

  const tierDifference = newTier - oldTier
  return tierDifference * 500 // 500 points per tier level
}

/**
 * حساب نقاط الإحالة
 */
export function calculateReferralPoints(
  invitedMemberDuration: number,
  invitedOfferName: string
): number {
  // Elite package gets 600 points
  if (invitedOfferName.toLowerCase().includes('elite')) {
    return 600
  }

  // 3+ months (90 days) gets 500 points
  if (invitedMemberDuration >= 90) {
    return 500
  }

  return 0
}

// ==================== Point Management ====================

/**
 * منح نقاط للعضو
 */
export async function earnPoints(params: EarnPointsParams): Promise<void> {
  const {
    memberId,
    points,
    source,
    description,
    receiptId,
    invitationId,
    staffName,
    metadata
  } = params

  if (points <= 0) return

  await prisma.$transaction(async (tx) => {
    // Get or create loyalty record
    let loyalty = await tx.memberLoyalty.findUnique({
      where: { memberId }
    })

    if (!loyalty) {
      loyalty = await tx.memberLoyalty.create({
        data: {
          memberId,
          pointsBalance: 0,
          totalEarned: 0,
          totalRedeemed: 0
        }
      })
    }

    // Update loyalty totals
    await tx.memberLoyalty.update({
      where: { id: loyalty.id },
      data: {
        pointsBalance: { increment: points },
        totalEarned: { increment: points }
      }
    })

    // Create transaction record
    await tx.loyaltyTransaction.create({
      data: {
        loyaltyId: loyalty.id,
        memberId,
        type: 'earn',
        points,
        source,
        description,
        receiptId,
        invitationId,
        staffName,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    })
  })

  console.log(`✅ تم منح ${points} نقطة للعضو ${memberId} - ${source}`)
}

/**
 * خصم نقاط من العضو (للاستخدام المستقبلي)
 */
export async function redeemPoints(
  memberId: string,
  points: number,
  description: string,
  staffName?: string
): Promise<void> {
  if (points <= 0) throw new Error('النقاط يجب أن تكون أكبر من صفر')

  await prisma.$transaction(async (tx) => {
    const loyalty = await tx.memberLoyalty.findUnique({
      where: { memberId }
    })

    if (!loyalty) throw new Error('لا يوجد سجل نقاط لهذا العضو')
    if (loyalty.pointsBalance < points) throw new Error('رصيد النقاط غير كافي')

    // Update loyalty totals
    await tx.memberLoyalty.update({
      where: { id: loyalty.id },
      data: {
        pointsBalance: { decrement: points },
        totalRedeemed: { increment: points }
      }
    })

    // Create transaction record
    await tx.loyaltyTransaction.create({
      data: {
        loyaltyId: loyalty.id,
        memberId,
        type: 'redeem',
        points: -points, // Negative for redemptions
        source: 'redemption',
        description,
        staffName
      }
    })
  })
}

// ==================== Manual Points ====================

/**
 * منح نقاط تحقيق هدف
 */
export async function awardGoalAchievement(
  memberId: string,
  goalType: 'weight_loss' | 'muscle_gain' | 'strength',
  staffName: string,
  language: 'ar' | 'en' = 'ar'
): Promise<void> {
  // Increment goal count first
  await prisma.memberLoyalty.upsert({
    where: { memberId },
    create: {
      memberId,
      goalAchievementsCount: 1
    },
    update: {
      goalAchievementsCount: { increment: 1 }
    }
  })

  // Award points (earnPoints has its own transaction)
  const prefix = t(language, 'goalAchievement.prefix')
  const goalLabel = t(language, `goalAchievement.${goalType}`)

  await earnPoints({
    memberId,
    points: 500,
    source: 'goal',
    description: `${prefix}: ${goalLabel}`,
    staffName,
    metadata: { goalType }
  })
}

/**
 * منح نقاط ترقية يدوياً
 */
export async function awardUpgradePoints(
  memberId: string,
  oldOfferId: string | null,
  newOfferId: string,
  staffName: string,
  language: 'ar' | 'en' = 'ar'
): Promise<number> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { startDate: true, currentOfferName: true }
  })

  if (!member) {
    throw new Error(language === 'ar' ? 'العضو غير موجود' : 'Member not found')
  }

  const newOffer = await prisma.offer.findUnique({
    where: { id: newOfferId },
    select: { name: true }
  })

  const oldOffer = oldOfferId
    ? await prisma.offer.findUnique({
        where: { id: oldOfferId },
        select: { name: true }
      })
    : null

  const upgradePoints = await calculateUpgradePoints(
    oldOfferId,
    newOfferId,
    member.startDate
  )

  if (upgradePoints <= 0) {
    throw new Error(language === 'ar' ? 'لا توجد نقاط ترقية لهذا التغيير' : 'No upgrade points for this change')
  }

  const prefix = t(language, 'upgradePoints.prefix')
  const to = t(language, 'upgradePoints.to')
  const undefined_text = t(language, 'upgradePoints.undefined')

  await earnPoints({
    memberId,
    points: upgradePoints,
    source: 'upgrade',
    description: `${prefix} ${oldOffer?.name || undefined_text} ${to} ${newOffer?.name || undefined_text}`,
    staffName
  })

  return upgradePoints
}

/**
 * منح نقاط المراجعة (مرة واحدة)
 */
export async function awardReviewBonus(
  memberId: string,
  staffName: string,
  language: 'ar' | 'en' = 'ar'
): Promise<void> {
  const loyalty = await prisma.memberLoyalty.findUnique({
    where: { memberId }
  })

  if (loyalty?.hasReviewBonus) {
    throw new Error(language === 'ar' ? 'العضو حصل على نقاط المراجعة من قبل' : 'Member already received review bonus')
  }

  // Mark review bonus as claimed first
  await prisma.memberLoyalty.upsert({
    where: { memberId },
    create: {
      memberId,
      hasReviewBonus: true
    },
    update: {
      hasReviewBonus: true
    }
  })

  // Award points (earnPoints has its own transaction)
  await earnPoints({
    memberId,
    points: 250,
    source: 'review',
    description: t(language, 'reviewBonus'),
    staffName
  })
}

/**
 * تسجيل حضور جلسة
 */
export async function recordSessionAttendance(
  memberId: string,
  sessionType: 'nutrition' | 'physio' | 'pt',
  staffName: string,
  language: 'ar' | 'en' = 'ar'
): Promise<void> {
  const prefix = t(language, 'sessionAttendance.prefix')
  const sessionLabel = t(language, `sessionAttendance.${sessionType}`)

  await earnPoints({
    memberId,
    points: 25,
    source: 'session',
    description: `${prefix} ${sessionLabel}`,
    staffName,
    metadata: { sessionType }
  })
}
