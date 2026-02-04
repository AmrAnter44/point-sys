// lib/commissions/helpers.ts
// دوال مساعدة للعمولات

import { prisma } from '../prisma'

// جلب عدد العملاء النشطين للمدرب
export async function getActiveClientsCount(coachId: string): Promise<number> {
  const count = await prisma.member.count({
    where: {
      assignedCoachId: coachId,
      isActive: true,
      expiryDate: {
        gte: new Date() // الاشتراك لم ينتهِ بعد
      }
    }
  })

  return count
}

// جلب إحصائيات الشهر للمدرب
export async function getMonthlyStats(
  coachId: string,
  month: string // "YYYY-MM"
) {
  const [year, monthNum] = month.split('-')
  const startDate = new Date(`${year}-${monthNum}-01`)
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59)

  // عدد إحالات الخدمات (Physio + Nutrition)
  const physioCount = await prisma.physiotherapyPackage.count({
    where: {
      referringCoachId: coachId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }
  })

  const nutritionCount = await prisma.nutritionPackage.count({
    where: {
      referringCoachId: coachId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }
  })

  const serviceReferrals = physioCount + nutritionCount

  // عدد ترقيات العضويات
  const membershipUpgrades = await prisma.receipt.count({
    where: {
      referringCoachId: coachId,
      type: 'Membership Upgrade',
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }
  })

  return {
    serviceReferrals,
    membershipUpgrades,
    physioCount,
    nutritionCount
  }
}

// تحديد أفضل مدرب للشهر (أعلى إجمالي عمولات)
export async function determineTopPerformer(month: string): Promise<string | null> {
  const reports = await prisma.monthlyCommissionReport.findMany({
    where: { month },
    orderBy: { grandTotal: 'desc' },
    take: 1
  })

  return reports.length > 0 ? reports[0].coachId : null
}
