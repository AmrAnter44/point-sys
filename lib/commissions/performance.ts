// lib/commissions/performance.ts
// دوال حساب Performance Multiplier و Best Coach

import { prisma } from '../prisma'
import { getSubscriptionMonths, getCurrentSubscriptionMonth, calculateMRCB } from './mrcb'

interface PerformanceResult {
  targetMet: boolean
  targetDoubled: boolean
  isBestCoach: boolean
  multiplier: number
  totalBonus: number
}

/**
 * حساب Performance Multiplier للكوتش
 * @param serviceReferrals عدد إحالات الخدمات (Physio + Nutrition)
 * @param membershipUpgrades عدد ترقيات العضويات
 * @param activeClientsCount عدد العملاء النشطين
 * @returns معلومات الأداء والمضاعف
 */
export function calculatePerformanceMultiplier(
  serviceReferrals: number,
  membershipUpgrades: number,
  activeClientsCount: number
): PerformanceResult {
  // الهدف: 5 إحالات خدمات + 3 ترقيات عضوية
  const targetMet = serviceReferrals >= 5 && membershipUpgrades >= 3

  // مضاعفة الهدف: 10 إحالات + 6 ترقيات
  const targetDoubled = serviceReferrals >= 10 && membershipUpgrades >= 6

  // المضاعف الأساسي (يمكن تعديله لاحقاً بناءً على Best Coach)
  let multiplier = 0
  if (targetDoubled) {
    multiplier = 75 // مكافأة أعلى لمضاعفة الهدف
  } else if (targetMet) {
    multiplier = 50
  }

  const totalBonus = multiplier * activeClientsCount

  return {
    targetMet,
    targetDoubled,
    isBestCoach: false, // سيتم تحديثه من مكان آخر
    multiplier,
    totalBonus
  }
}

/**
 * تحديد أفضل كوتش للشهر بناءً على إجمالي العمولات
 * @param month الشهر بصيغة YYYY-MM
 * @returns معرف أفضل كوتش أو null
 */
export async function determineBestCoach(month: string): Promise<string | null> {
  const [year, monthNum] = month.split('-')
  const startDate = new Date(`${year}-${monthNum}-01`)
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59)

  // جلب جميع الكوتشات
  const coaches = await prisma.staff.findMany({
    where: {
      position: { contains: 'كوتش' }
    },
    select: { id: true, name: true }
  })

  const coachRankings: { coachId: string; totalCommissions: number }[] = []

  for (const coach of coaches) {
    // حساب On-boarding
    const onboardingCommissions = await prisma.coachCommission.findMany({
      where: {
        coachId: coach.id,
        month: month,
        type: { startsWith: 'onboarding_' }
      }
    })
    const onboardingTotal = onboardingCommissions.reduce((sum, c) => sum + c.amount, 0)

    // حساب Upsells
    const upsellCommissions = await prisma.coachCommission.findMany({
      where: {
        coachId: coach.id,
        month: month,
        type: { in: ['physio_referral', 'nutrition_referral', 'upgrade_referral'] }
      }
    })
    const upsellTotal = upsellCommissions.reduce((sum, c) => sum + c.amount, 0)

    // حساب PT Revenue
    const ptReceipts = await prisma.receipt.findMany({
      where: {
        OR: [
          { type: 'اشتراك برايفت' },
          { type: 'تجديد برايفت' },
          { type: 'دفع باقي برايفت' }
        ],
        createdAt: { gte: startDate, lte: endDate }
      },
      select: {
        amount: true,
        itemDetails: true,
        ptNumber: true
      }
    })

    let ptRevenue = 0
    for (const receipt of ptReceipts) {
      let ptNum = receipt.ptNumber
      if (!ptNum) {
        try {
          const details = JSON.parse(receipt.itemDetails)
          ptNum = details.ptNumber
        } catch (e) {}
      }
      if (!ptNum) continue

      const ptSession = await prisma.pT.findUnique({
        where: { ptNumber: ptNum },
        select: { coachUserId: true, coachName: true }
      })

      const isMatch = ptSession && (
        ptSession.coachUserId === coach.id ||
        (!ptSession.coachUserId && ptSession.coachName === coach.name)
      )

      if (isMatch) {
        ptRevenue += receipt.amount
      }
    }

    const ptCommission = ptRevenue * 0.30 // النسبة القاعدية

    // حساب MRCB
    const activeClients = await prisma.member.findMany({
      where: {
        assignedCoachId: coach.id,
        isActive: true,
        expiryDate: { gte: new Date() }
      },
      select: {
        subscriptionType: true,
        startDate: true
      }
    })

    let mrcbTotal = 0
    for (const client of activeClients) {
      if (!client.startDate || !client.subscriptionType) continue
      const subscriptionMonths = getSubscriptionMonths(client.subscriptionType)
      const currentMonth = getCurrentSubscriptionMonth(client.startDate, month)
      const mrcbAmount = calculateMRCB(client.subscriptionType, subscriptionMonths, currentMonth)
      if (mrcbAmount > 0) {
        mrcbTotal += mrcbAmount
      }
    }

    // إجمالي العمولات (بدون المرتب)
    const totalCommissions = onboardingTotal + mrcbTotal + upsellTotal + ptCommission

    coachRankings.push({
      coachId: coach.id,
      totalCommissions
    })
  }

  // ترتيب تنازلياً
  coachRankings.sort((a, b) => b.totalCommissions - a.totalCommissions)

  // إرجاع أفضل كوتش
  return coachRankings.length > 0 ? coachRankings[0].coachId : null
}
