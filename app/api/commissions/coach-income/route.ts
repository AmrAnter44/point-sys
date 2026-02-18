// app/api/commissions/coach-income/route.ts
// API لحساب دخل الكوتش الشامل من جميع المصادر

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const coachId = searchParams.get('coachId')
    const month = searchParams.get('month') // YYYY-MM format

    if (!coachId || !month) {
      return NextResponse.json(
        { error: 'يجب توفير coachId و month' },
        { status: 400 }
      )
    }

    // التحقق من وجود الكوتش
    const coach = await prisma.staff.findUnique({
      where: { id: coachId },
      select: { name: true, salary: true, position: true }
    })

    if (!coach) {
      return NextResponse.json(
        { error: 'المدرب غير موجود' },
        { status: 404 }
      )
    }

    // حساب بداية ونهاية الشهر
    const [year, monthNum] = month.split('-')
    const startDate = new Date(`${year}-${monthNum}-01`)
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59)

    // ===== 1. المرتب الأساسي =====
    const baseSalary = coach.salary || 0

    // ===== 2. On-boarding Bonuses =====
    const onboardingCommissions = await prisma.coachCommission.findMany({
      where: {
        coachId: coachId,
        month: month,
        type: { startsWith: 'onboarding_' }
      },
      include: {
        member: {
          select: {
            memberNumber: true,
            name: true,
            subscriptionType: true,
            subscriptionPrice: true
          }
        }
      }
    })

    const onboardingTotal = onboardingCommissions.reduce((sum, c) => sum + c.amount, 0)
    const onboardingDetails = onboardingCommissions.map(c => ({
      memberNumber: c.member?.memberNumber,
      memberName: c.member?.name,
      tier: c.type.replace('onboarding_', ''),
      subscriptionType: c.member?.subscriptionType,
      subscriptionPrice: c.member?.subscriptionPrice,
      amount: c.amount
    }))

    // ===== 3. MRCB (Monthly Recurring Commission Bonus) =====
    const activeClients = await prisma.member.findMany({
      where: {
        assignedCoachId: coachId,
        isActive: true,
        expiryDate: { gte: new Date() }
      },
      select: {
        id: true,
        memberNumber: true,
        name: true,
        subscriptionType: true,
        subscriptionPrice: true,
        startDate: true,
        expiryDate: true
      }
    })

    let mrcbTotal = 0
    const mrcbBreakdown = {
      challenger: { count: 0, amount: 0 },
      fighter: { count: 0, amount: 0 },
      champion: { count: 0, amount: 0 },
      elite: { count: 0, amount: 0 }
    }
    const mrcbClientsList: any[] = []

    for (const client of activeClients) {
      if (!client.startDate || !client.subscriptionType) continue

      const subscriptionMonths = getSubscriptionMonths(client.subscriptionType)
      const currentMonth = getCurrentSubscriptionMonth(client.startDate, month)
      const mrcbAmount = calculateMRCB(client.subscriptionType, subscriptionMonths, currentMonth)

      if (mrcbAmount > 0) {
        const tier = getTierName(subscriptionMonths).toLowerCase()
        mrcbTotal += mrcbAmount

        // تحديث Breakdown
        if (tier === 'challenger') {
          mrcbBreakdown.challenger.count++
          mrcbBreakdown.challenger.amount += mrcbAmount
        } else if (tier === 'fighter') {
          mrcbBreakdown.fighter.count++
          mrcbBreakdown.fighter.amount += mrcbAmount
        } else if (tier === 'champion') {
          mrcbBreakdown.champion.count++
          mrcbBreakdown.champion.amount += mrcbAmount
        } else if (tier === 'elite') {
          mrcbBreakdown.elite.count++
          mrcbBreakdown.elite.amount += mrcbAmount
        }

        // إضافة للقائمة
        mrcbClientsList.push({
          memberNumber: client.memberNumber,
          memberName: client.name,
          tier: getTierName(subscriptionMonths),
          subscriptionType: client.subscriptionType,
          subscriptionPrice: client.subscriptionPrice,
          monthNumber: currentMonth,
          mrcbAmount: mrcbAmount
        })
      }
    }

    // ===== 4. Performance Metrics & Best Coach Ranking =====
    const stats = await getMonthlyStats(coachId, month)
    const serviceReferrals = stats.serviceReferrals
    const membershipUpgrades = stats.membershipUpgrades

    const targetMet = serviceReferrals >= 5 && membershipUpgrades >= 3

    // 🏆 حساب ترتيب Best Coach بناءً على أعلى عمولات (بدون المرتب)
    const allCoaches = await prisma.staff.findMany({
      where: {
        position: { contains: 'كوتش' }
      },
      select: { id: true, name: true }
    })

    // حساب إجمالي العمولات لكل كوتش
    const coachRankings: { coachId: string; coachName: string; totalCommissions: number }[] = []

    for (const c of allCoaches) {
      // حساب On-boarding
      const onb = await prisma.coachCommission.findMany({
        where: {
          coachId: c.id,
          month: month,
          type: { startsWith: 'onboarding_' }
        }
      })
      const onbTotal = onb.reduce((sum, comm) => sum + comm.amount, 0)

      // حساب Upsells
      const ups = await prisma.coachCommission.findMany({
        where: {
          coachId: c.id,
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

        const isMatch = ptSession && (ptSession.coachUserId === c.id || (!ptSession.coachUserId && ptSession.coachName === c.name))
        if (isMatch) {
          coachPTRevenue += rec.amount
        }
      }

      const basePTCommission = coachPTRevenue * 0.30 // النسبة القاعدية للترتيب

      // حساب MRCB لهذا الكوتش
      const coachActiveClients = await prisma.member.findMany({
        where: {
          assignedCoachId: c.id,
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
        coachId: c.id,
        coachName: c.name,
        totalCommissions: totalCommissions
      })
    }

    // ترتيب الكوتشات تنازلياً
    coachRankings.sort((a, b) => b.totalCommissions - a.totalCommissions)

    // تحديد هل الكوتش الحالي هو Best Coach
    const isBestCoach = coachRankings.length > 0 && coachRankings[0].coachId === coachId
    const coachRank = coachRankings.findIndex(r => r.coachId === coachId) + 1

    // تحديد Multiplier بناءً على Best Coach
    let performanceMultiplier = 0
    if (isBestCoach) {
      performanceMultiplier = 100
    } else if (targetMet) {
      performanceMultiplier = 50
    }

    const activeClientsCount = activeClients.length
    const performanceBonus = performanceMultiplier * activeClientsCount

    // ===== 5. Upsell Commissions =====
    // Physio (40% من السعر)
    const physioCommissions = await prisma.coachCommission.findMany({
      where: {
        coachId: coachId,
        month: month,
        type: 'upsell_physio'
      }
    })
    const physioTotal = physioCommissions.reduce((sum, c) => sum + c.amount, 0)
    const physioCount = physioCommissions.length
    const physioRevenue = physioTotal / 0.40

    // Nutrition - لا عمولة على مبيعات النيوتريشن، فقط 30 جنيه على السيشنات المجانية
    const nutritionTotal = 0
    const nutritionCount = 0
    const nutritionRevenue = 0

    // Upgrades (5% من السعر)
    const upgradeCommissions = await prisma.coachCommission.findMany({
      where: {
        coachId: coachId,
        month: month,
        type: 'upgrade_referral'
      }
    })
    const upgradeTotal = upgradeCommissions.reduce((sum, c) => sum + c.amount, 0)
    const upgradeCount = upgradeCommissions.length
    const upgradeRevenue = upgradeTotal / 0.05

    // Free Nutrition Sessions (30 جنيه لكل سيشن)
    const freeNutritionCommissions = await prisma.coachCommission.findMany({
      where: {
        coachId: coachId,
        month: month,
        type: 'nutrition_free_session'
      }
    })
    const freeNutritionTotal = freeNutritionCommissions.reduce((sum, c) => sum + c.amount, 0)
    const freeNutritionCount = freeNutritionCommissions.length

    // Medical Screening (50 جنيه لكل جلسة)
    const medicalScreeningCommissions = await prisma.coachCommission.findMany({
      where: {
        coachId: coachId,
        month: month,
        type: 'medical_screening'
      }
    })
    const medicalScreeningTotal = medicalScreeningCommissions.reduce((sum, c) => sum + c.amount, 0)
    const medicalScreeningCount = medicalScreeningCommissions.length

    const upsellsTotal = physioTotal + nutritionTotal + upgradeTotal + freeNutritionTotal + medicalScreeningTotal

    // ===== 6. PT Sessions =====
    // حساب جميع إيرادات PT من الإيصالات في هذا الشهر (عند الشراء)
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
    let ptSessionsTotal = 0
    const ptClientsSet = new Set<string>()

    // معالجة كل إيصال PT
    for (const receipt of ptReceipts) {
      // محاولة الحصول على ptNumber من الحقل المباشر أو من itemDetails
      let ptNum = receipt.ptNumber

      if (!ptNum) {
        try {
          const details = JSON.parse(receipt.itemDetails)
          ptNum = details.ptNumber
        } catch (e) {
          console.error('Error parsing receipt itemDetails:', e)
        }
      }

      if (!ptNum) continue

      // التحقق من أن PT session تابع لهذا الكوتش
      const ptSession = await prisma.pT.findUnique({
        where: { ptNumber: ptNum },
        select: {
          coachUserId: true,
          coachName: true,
          clientName: true
        }
      })

      // البحث بـ coachUserId أولاً، ثم fallback للبحث بالاسم
      const isCoachMatch = ptSession && (
        ptSession.coachUserId === coachId ||
        (!ptSession.coachUserId && ptSession.coachName === coach.name)
      )

      if (isCoachMatch) {
        // إضافة الإيراد (المبلغ المدفوع فعلياً من الإيصال)
        ptTotalRevenue += receipt.amount

        // إضافة العميل للمجموعة
        if (ptSession.clientName) {
          ptClientsSet.add(ptSession.clientName)
        }

        // استخراج عدد الجلسات من itemDetails
        try {
          const details = JSON.parse(receipt.itemDetails)
          if (details.sessionsPurchased) {
            ptSessionsTotal += details.sessionsPurchased
          }
        } catch (e) {
          console.error('Error parsing receipt itemDetails:', e)
        }
      }
    }

    // حساب إجمالي الجلسات المتبقية والمكتملة (من كل PT sessions للكوتش)
    const allCoachPTSessions = await prisma.pT.findMany({
      where: {
        OR: [
          { coachUserId: coachId },
          {
            coachUserId: null,
            coachName: coach.name
          }
        ]
      },
      select: {
        sessionsPurchased: true,
        sessionsRemaining: true
      }
    })

    // إجمالي كل الجلسات المشتراة (من كل الأشهر)
    const ptSessionsTotalAll = allCoachPTSessions.reduce((sum, pt) => sum + pt.sessionsPurchased, 0)
    const ptSessionsRemaining = allCoachPTSessions.reduce((sum, pt) => sum + pt.sessionsRemaining, 0)
    const ptSessionsCompleted = ptSessionsTotalAll - ptSessionsRemaining
    const ptClientsCount = ptClientsSet.size

    // حساب نسبة العمولة (30% أو 50% بناءً على Best Coach)
    const ptCommissionRate = getPTCommissionRate(isBestCoach)
    const ptCommission = calculatePTCommission(ptTotalRevenue, isBestCoach)

    // ===== 7. Top Performer Bonus (مستقبلاً) =====
    const topPerformerBonus = 0

    // ===== Grand Total =====
    const grandTotal =
      baseSalary +
      onboardingTotal +
      mrcbTotal +
      performanceBonus +
      upsellsTotal +
      ptCommission +
      topPerformerBonus

    // ===== Response =====
    const response = {
      coachId: coachId,
      coachName: coach.name,
      month: month,

      baseSalary: baseSalary,

      onboarding: {
        total: onboardingTotal,
        newClients: onboardingDetails
      },

      mrcb: {
        total: mrcbTotal,
        breakdown: mrcbBreakdown,
        activeClients: mrcbClientsList
      },

      performance: {
        serviceReferrals: serviceReferrals,
        membershipUpgrades: membershipUpgrades,
        targetMet: targetMet,
        isBestCoach: isBestCoach,
        coachRank: coachRank,
        multiplier: performanceMultiplier,
        activeClientsCount: activeClientsCount,
        bonus: performanceBonus
      },

      ranking: {
        isBestCoach: isBestCoach,
        rank: coachRank,
        totalCoaches: coachRankings.length,
        leaderboard: coachRankings.slice(0, 5).map((r, idx) => ({
          rank: idx + 1,
          coachName: r.coachName,
          totalCommissions: r.totalCommissions,
          isCurrent: r.coachId === coachId
        }))
      },

      upsells: {
        total: upsellsTotal,
        physio: { count: physioCount, revenue: physioRevenue, commission: physioTotal },
        nutrition: { count: nutritionCount, revenue: nutritionRevenue, commission: nutritionTotal },
        upgrades: { count: upgradeCount, revenue: upgradeRevenue, commission: upgradeTotal },
        freeNutritionSessions: { count: freeNutritionCount, commission: freeNutritionTotal },
        medicalScreening: { count: medicalScreeningCount, commission: medicalScreeningTotal }
      },

      pt: {
        totalRevenue: ptTotalRevenue,
        sessionsSoldThisMonth: ptSessionsTotal, // الجلسات المباعة في هذا الشهر فقط
        sessionsTotal: ptSessionsTotalAll, // إجمالي كل الجلسات
        sessionsCompleted: ptSessionsCompleted,
        sessionsRemaining: ptSessionsRemaining,
        clients: ptClientsCount,
        commissionRate: ptCommissionRate,
        commission: ptCommission
      },

      topPerformerBonus: topPerformerBonus,

      grandTotal: grandTotal
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('❌ خطأ في حساب دخل الكوتش:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء حساب دخل الكوتش', details: error.message },
      { status: 500 }
    )
  }
}
