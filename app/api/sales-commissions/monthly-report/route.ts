// app/api/sales-commissions/monthly-report/route.ts
// Monthly sales commission report for individual staff or all sales staff

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { getSalesStaffMonthlyStats } from '../../../../lib/commissions/salesTopAchiever'
import { getMonthString } from '../../../../lib/commissions/salesHelpers'

/**
 * GET - Get sales commission report for a staff member or all staff
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const month = searchParams.get('month') || getMonthString()

    if (staffId) {
      // Individual staff report
      return await getIndividualReport(staffId, month)
    } else {
      // All sales staff report
      return await getAllStaffReport(month)
    }

  } catch (error: any) {
    console.error('❌ Error fetching sales report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch report' },
      { status: 500 }
    )
  }
}

async function getIndividualReport(staffId: string, month: string) {
  console.log('📊 جلب تقرير فردي:', { staffId, month })

  // Verify staff is sales
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { id: true, name: true, position: true, isActive: true }
  })

  console.log('👤 بيانات الموظف:', staff)

  if (!staff || staff.position !== 'ريسبشن') {
    console.warn('⚠️ الموظف غير موجود أو ليس موظف مبيعات:', {
      found: !!staff,
      position: staff?.position,
      expected: 'ريسبشن'
    })
    return NextResponse.json(
      { error: 'Staff not found or not sales personnel' },
      { status: 404 }
    )
  }

  // Get all commissions for this staff this month
  const commissions = await prisma.coachCommission.findMany({
    where: {
      coachId: staffId,
      month: month,
      type: {
        startsWith: 'sales_'
      }
    },
    include: {
      receipt: true,
      member: true
    },
    orderBy: { createdAt: 'desc' }
  })

  console.log('💰 عدد العمولات المُسترجعة:', commissions.length)

  // أيضاً: جلب جميع العمولات لهذا الموظف بدون فلترة الشهر للتأكد
  const allCommissions = await prisma.coachCommission.findMany({
    where: {
      coachId: staffId,
      type: {
        startsWith: 'sales_'
      }
    },
    select: { id: true, month: true, type: true, amount: true }
  })

  console.log('📋 جميع عمولات هذا الموظف (كل الأشهر):', allCommissions)

  // Categorize commissions
  const renewalCommissions = commissions.filter(c => c.type.startsWith('sales_renewal_'))
  const topAchieverBase = commissions.find(c => c.type === 'sales_top_achiever_base')
  const topAchieverMultiplier = commissions.find(c => c.type === 'sales_top_achiever_renewal_multiplier')

  // Calculate totals
  const renewalTotal = renewalCommissions.reduce((sum, c) => sum + c.amount, 0)
  const topAchieverTotal = (topAchieverBase?.amount || 0) + (topAchieverMultiplier?.amount || 0)
  const grandTotal = renewalTotal + topAchieverTotal

  // Breakdown by renewal type
  const renewalBreakdown = renewalCommissions.reduce((acc, c) => {
    const type = c.type.replace('sales_renewal_', '')
    if (!acc[type]) {
      acc[type] = { count: 0, total: 0 }
    }
    acc[type].count++
    acc[type].total += c.amount
    return acc
  }, {} as Record<string, { count: number; total: number }>)

  return NextResponse.json({
    staff: {
      id: staff.id,
      name: staff.name,
      position: staff.position
    },
    month,
    summary: {
      renewalCount: renewalCommissions.length,
      renewalTotal,
      topAchieverTotal,
      isTopAchiever: !!topAchieverBase,
      grandTotal,
      status: commissions[0]?.status || 'pending'
    },
    renewalBreakdown,
    commissions: commissions.map(c => ({
      id: c.id,
      type: c.type,
      amount: c.amount,
      status: c.status,
      createdAt: c.createdAt,
      receiptNumber: c.receipt?.receiptNumber,
      memberName: c.member?.name,
      details: c.calculationDetails ? JSON.parse(c.calculationDetails) : null
    }))
  })
}

async function getAllStaffReport(month: string) {
  const stats = await getSalesStaffMonthlyStats(month)

  // Sort by total bonuses DESC
  const sorted = [...stats].sort((a, b) => b.bonuses.total - a.bonuses.total)

  const summary = {
    month,
    totalSalesStaff: stats.length,
    totalRenewals: stats.reduce((sum, s) => sum + s.renewalCount, 0),
    totalRevenue: stats.reduce((sum, s) => sum + s.totalRevenue, 0),
    totalBonuses: stats.reduce((sum, s) => sum + s.bonuses.total, 0),
    topPerformer: sorted[0] || null
  }

  return NextResponse.json({
    summary,
    staffReports: sorted
  })
}
