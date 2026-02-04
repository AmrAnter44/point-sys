// app/api/commissions/monthly-report/route.ts
// API لتحديث/جلب التقرير الشهري

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { getActiveClientsCount, getMonthlyStats } from '../../../../lib/commissions/helpers'
import { calculatePerformanceMultiplier } from '../../../../lib/commissions/performance'

// GET: جلب تقرير شهري لمدرب
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const coachId = searchParams.get('coachId')
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

    if (!coachId) {
      return NextResponse.json(
        { error: 'معرف المدرب مطلوب' },
        { status: 400 }
      )
    }

    const report = await prisma.monthlyCommissionReport.findUnique({
      where: {
        coachId_month: { coachId, month }
      },
      include: {
        coach: {
          select: {
            id: true,
            name: true,
            phone: true,
            position: true
          }
        }
      }
    })

    if (!report) {
      // إذا لم يكن التقرير موجود، قم بإنشائه
      const newReport = await updateMonthlyReport(coachId, month)
      return NextResponse.json(newReport)
    }

    return NextResponse.json(report)

  } catch (error: any) {
    console.error('❌ خطأ في جلب التقرير الشهري:', error)
    return NextResponse.json(
      { error: error.message || 'فشل جلب التقرير' },
      { status: 500 }
    )
  }
}

// POST: تحديث التقرير الشهري (يُستدعى تلقائياً)
export async function POST(request: Request) {
  try {
    const { coachId, month } = await request.json()

    if (!coachId) {
      return NextResponse.json(
        { error: 'معرف المدرب مطلوب' },
        { status: 400 }
      )
    }

    const updatedReport = await updateMonthlyReport(coachId, month)
    return NextResponse.json(updatedReport)

  } catch (error: any) {
    console.error('❌ خطأ في تحديث التقرير الشهري:', error)
    return NextResponse.json(
      { error: error.message || 'فشل تحديث التقرير' },
      { status: 500 }
    )
  }
}

// دالة مساعدة لتحديث التقرير الشهري
async function updateMonthlyReport(coachId: string, month?: string) {
  const targetMonth = month || new Date().toISOString().slice(0, 7)

  console.log(`📊 تحديث تقرير ${targetMonth} للمدرب ${coachId}`)

  // جلب جميع عمولات الشهر
  const commissions = await prisma.coachCommission.findMany({
    where: { coachId, month: targetMonth }
  })

  // حساب MRCB حسب المستوى
  const mrcbChallenger = commissions
    .filter(c => c.type === 'mrcb_challenger')
    .reduce((sum, c) => sum + c.amount, 0)

  const mrcbFighter = commissions
    .filter(c => c.type === 'mrcb_fighter')
    .reduce((sum, c) => sum + c.amount, 0)

  const mrcbChampion = commissions
    .filter(c => c.type === 'mrcb_champion')
    .reduce((sum, c) => sum + c.amount, 0)

  const mrcbElite = commissions
    .filter(c => c.type === 'mrcb_elite')
    .reduce((sum, c) => sum + c.amount, 0)

  const mrcbTotal = mrcbChallenger + mrcbFighter + mrcbChampion + mrcbElite

  const mrcbClientsCount = commissions.filter(c => c.type.startsWith('mrcb_')).length

  // حساب Upsells
  const upsellPhysioCommissions = commissions.filter(c => c.type === 'upsell_physio')
  const upsellPhysio = upsellPhysioCommissions.reduce((sum, c) => sum + c.amount, 0)
  const upsellPhysioCount = upsellPhysioCommissions.length

  const upsellNutritionCommissions = commissions.filter(c => c.type === 'upsell_nutrition')
  const upsellNutrition = upsellNutritionCommissions.reduce((sum, c) => sum + c.amount, 0)
  const upsellNutritionCount = upsellNutritionCommissions.length

  const upsellUpgradeCommissions = commissions.filter(c => c.type === 'upsell_upgrade')
  const upsellUpgrade = upsellUpgradeCommissions.reduce((sum, c) => sum + c.amount, 0)
  const upsellUpgradeCount = upsellUpgradeCommissions.length

  const upsellTotal = upsellPhysio + upsellNutrition + upsellUpgrade

  // جلب الإحصائيات للأداء
  const stats = await getMonthlyStats(coachId, targetMonth)
  const activeClientsCount = await getActiveClientsCount(coachId)

  // حساب Performance Multiplier
  const perf = calculatePerformanceMultiplier(
    stats.serviceReferrals,
    stats.membershipUpgrades,
    activeClientsCount
  )

  // إنشاء أو تحديث التقرير
  const report = await prisma.monthlyCommissionReport.upsert({
    where: {
      coachId_month: { coachId, month: targetMonth }
    },
    create: {
      coachId,
      month: targetMonth,
      mrcbChallenger,
      mrcbFighter,
      mrcbChampion,
      mrcbElite,
      mrcbClientsCount,
      mrcbTotal,
      upsellPhysio,
      upsellPhysioCount,
      upsellNutrition,
      upsellNutritionCount,
      upsellUpgrade,
      upsellUpgradeCount,
      upsellTotal,
      serviceReferrals: stats.serviceReferrals,
      membershipUpgrades: stats.membershipUpgrades,
      targetMet: perf.targetMet,
      targetDoubled: perf.targetDoubled,
      performanceMultiplier: perf.multiplier,
      activeClientsCount,
      performanceBonus: perf.totalBonus,
      grandTotal: mrcbTotal + upsellTotal + perf.totalBonus,
    },
    update: {
      mrcbChallenger,
      mrcbFighter,
      mrcbChampion,
      mrcbElite,
      mrcbClientsCount,
      mrcbTotal,
      upsellPhysio,
      upsellPhysioCount,
      upsellNutrition,
      upsellNutritionCount,
      upsellUpgrade,
      upsellUpgradeCount,
      upsellTotal,
      serviceReferrals: stats.serviceReferrals,
      membershipUpgrades: stats.membershipUpgrades,
      targetMet: perf.targetMet,
      targetDoubled: perf.targetDoubled,
      performanceMultiplier: perf.multiplier,
      activeClientsCount,
      performanceBonus: perf.totalBonus,
      grandTotal: mrcbTotal + upsellTotal + perf.totalBonus,
      updatedAt: new Date()
    },
    include: {
      coach: {
        select: {
          id: true,
          name: true,
          phone: true,
          position: true
        }
      }
    }
  })

  console.log(`✅ تم تحديث تقرير ${targetMonth} - الإجمالي: ${report.grandTotal} ج.م`)

  return report
}
