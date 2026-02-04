// app/api/commissions/all-coaches-income/route.ts
// API لحساب دخل جميع الكوتشات وتحديد Best Coach

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import {
  getCurrentSubscriptionMonth,
  getSubscriptionMonths,
  calculateMRCB,
  getTierName
} from '../../../../lib/commissions/mrcb'
import { getMonthlyStats } from '../../../../lib/commissions/helpers'
import { calculatePTCommission, getPTCommissionRate } from '../../../../lib/commissions/pt'
import {
  determineTopAchieverLevel,
  calculateTopAchieverBonus
} from '../../../../lib/commissions/topAchiever'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month') // YYYY-MM format

    if (!month) {
      return NextResponse.json(
        { error: 'يجب توفير month' },
        { status: 400 }
      )
    }

    // حساب بداية ونهاية الشهر
    const [year, monthNum] = month.split('-')
    const startDate = new Date(`${year}-${monthNum}-01`)
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59)

    // جلب جميع الكوتشات
    const allCoaches = await prisma.staff.findMany({
      where: {
        isActive: true,
        position: { contains: 'مدرب' }
      },
      select: { id: true, name: true, salary: true }
    })

    // حساب إجمالي العمولات لكل كوتش (للترتيب)
    const coachRankings: {
      coachId: string
      coachName: string
      totalCommissions: number
    }[] = []

    for (const coach of allCoaches) {
      // حساب On-boarding
      const onb = await prisma.coachCommission.findMany({
        where: {
          coachId: coach.id,
          month: month,
          type: { startsWith: 'onboarding_' }
        }
      })
      const onbTotal = onb.reduce((sum, comm) => sum + comm.amount, 0)

      // حساب Upsells
      const ups = await prisma.coachCommission.findMany({
        where: {
          coachId: coach.id,
          month: month,
          type: { in: ['physio_referral', 'nutrition_referral', 'upgrade_referral'] }
        }
      })
      const upsTotal = ups.reduce((sum, comm) => sum + comm.amount, 0)

      // حساب PT Revenue للكوتش (بنسبة 30% القاعدية للترتيب)
      const coachPTReceipts = await prisma.receipt.findMany({
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

      let coachPTRevenue = 0
      for (const rec of coachPTReceipts) {
        let ptNum = rec.ptNumber
        if (!ptNum) {
          try {
            const details = JSON.parse(rec.itemDetails)
            ptNum = details.ptNumber
          } catch (e) {}
        }
        if (!ptNum) continue

        const ptSession = await prisma.pT.findUnique({
          where: { ptNumber: ptNum },
          select: { coachUserId: true, coachName: true }
        })

        const isMatch = ptSession && (ptSession.coachUserId === coach.id || (!ptSession.coachUserId && ptSession.coachName === coach.name))
        if (isMatch) {
          coachPTRevenue += rec.amount
        }
      }

      const basePTCommission = coachPTRevenue * 0.30

      // حساب MRCB لهذا الكوتش
      const coachActiveClients = await prisma.member.findMany({
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

      let coachMRCB = 0
      for (const client of coachActiveClients) {
        if (!client.startDate || !client.subscriptionType) continue
        const subscriptionMonths = getSubscriptionMonths(client.subscriptionType)
        const currentMonth = getCurrentSubscriptionMonth(client.startDate, month)
        const mrcbAmount = calculateMRCB(client.subscriptionType, subscriptionMonths, currentMonth)
        if (mrcbAmount > 0) {
          coachMRCB += mrcbAmount
        }
      }

      // إجمالي العمولات (بدون المرتب)
      const totalCommissions = onbTotal + coachMRCB + upsTotal + basePTCommission

      coachRankings.push({
        coachId: coach.id,
        coachName: coach.name,
        totalCommissions: totalCommissions
      })
    }

    // ترتيب الكوتشات تنازلياً
    coachRankings.sort((a, b) => b.totalCommissions - a.totalCommissions)

    // الآن نحسب التفاصيل الكاملة لكل كوتش
    const coachesData = []

    for (const coach of allCoaches) {
      const coachRank = coachRankings.findIndex(r => r.coachId === coach.id) + 1

      // On-boarding
      const onboardingCommissions = await prisma.coachCommission.findMany({
        where: {
          coachId: coach.id,
          month: month,
          type: { startsWith: 'onboarding_' }
        }
      })
      const onboardingTotal = onboardingCommissions.reduce((sum, c) => sum + c.amount, 0)

      // MRCB
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

      // حساب Top Achiever
      const stats = await getMonthlyStats(coach.id, month)

      const topAchieverLevel = determineTopAchieverLevel(
        stats.serviceReferrals,
        stats.membershipUpgrades
      )

      const topAchieverBonus = calculateTopAchieverBonus(
        topAchieverLevel,
        activeClients.length
      )

      const achievedDouble = topAchieverLevel === 'double'

      // Upsells
      const physioCommissions = await prisma.coachCommission.findMany({
        where: { coachId: coach.id, month: month, type: 'physio_referral' }
      })
      const nutritionCommissions = await prisma.coachCommission.findMany({
        where: { coachId: coach.id, month: month, type: 'nutrition_referral' }
      })
      const upgradeCommissions = await prisma.coachCommission.findMany({
        where: { coachId: coach.id, month: month, type: 'upgrade_referral' }
      })

      const physioTotal = physioCommissions.reduce((sum, c) => sum + c.amount, 0)
      const nutritionTotal = nutritionCommissions.reduce((sum, c) => sum + c.amount, 0)
      const upgradeTotal = upgradeCommissions.reduce((sum, c) => sum + c.amount, 0)
      const upsellsTotal = physioTotal + nutritionTotal + upgradeTotal

      // PT Revenue
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

      let ptTotalRevenue = 0
      for (const rec of ptReceipts) {
        let ptNum = rec.ptNumber
        if (!ptNum) {
          try {
            const details = JSON.parse(rec.itemDetails)
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
          ptTotalRevenue += rec.amount
        }
      }

      const ptCommissionRate = getPTCommissionRate(achievedDouble) * 100 // تحويل إلى نسبة مئوية
      const ptCommission = calculatePTCommission(ptTotalRevenue, achievedDouble)

      const baseSalary = coach.salary || 0
      const grandTotal = baseSalary + onboardingTotal + mrcbTotal + topAchieverBonus + upsellsTotal + ptCommission

      coachesData.push({
        coachId: coach.id,
        coachName: coach.name,
        rank: coachRank,
        topAchieverLevel: topAchieverLevel,
        isTopAchiever: topAchieverLevel !== 'none',
        baseSalary: baseSalary,
        onboardingTotal: onboardingTotal,
        mrcbTotal: mrcbTotal,
        topAchieverBonus: topAchieverBonus,
        upsellsTotal: upsellsTotal,
        ptRevenue: ptTotalRevenue,
        ptCommission: ptCommission,
        ptCommissionRate: ptCommissionRate,
        activeClientsCount: activeClients.length,
        serviceReferrals: stats.serviceReferrals,
        membershipUpgrades: stats.membershipUpgrades,
        totalCommissions: onboardingTotal + mrcbTotal + topAchieverBonus + upsellsTotal + ptCommission,
        grandTotal: grandTotal
      })
    }

    // ترتيب حسب الترتيب
    coachesData.sort((a, b) => a.rank - b.rank)

    // فلترة Top Achievers
    const topAchievers = coachesData.filter(c => c.isTopAchiever)

    return NextResponse.json({
      month: month,
      totalCoaches: coachesData.length,
      topAchievers: topAchievers,
      coaches: coachesData
    })

  } catch (error: any) {
    console.error('❌ خطأ في حساب دخل جميع الكوتشات:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء حساب دخل الكوتشات', details: error.message },
      { status: 500 }
    )
  }
}
