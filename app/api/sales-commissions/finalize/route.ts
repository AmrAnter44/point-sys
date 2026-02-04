// app/api/sales-commissions/finalize/route.ts
// Finalize sales commissions for a month and award top achiever

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import {
  getSalesStaffMonthlyStats,
  determineTopAchiever,
  awardTopAchieverBonus
} from '../../../../lib/commissions/salesTopAchiever'
import { getMonthString } from '../../../../lib/commissions/salesHelpers'
import { requirePermission } from '../../../../lib/auth'

/**
 * POST - Finalize sales commissions and award top achiever
 * Should be called at end of month by admin
 */
export async function POST(request: Request) {
  try {
    // Require admin permission
    await requirePermission(request, 'canAccessAdmin')

    const body = await request.json()
    const month = body.month || getMonthString()

    console.log(`🔒 Finalizing sales commissions for ${month}...`)

    // Get all sales staff stats
    const stats = await getSalesStaffMonthlyStats(month)

    if (stats.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No sales staff found for this month'
      })
    }

    // Determine top achiever(s)
    const topPerformers = determineTopAchiever(stats)

    if (topPerformers.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No top performer identified (no renewals)'
      })
    }

    console.log(`🏆 Top performer(s): ${topPerformers.map(p => p.staffName).join(', ')}`)

    // Award top achiever bonus
    const awards = await awardTopAchieverBonus(month, topPerformers)

    // Update all renewal commissions to 'approved' status
    await prisma.coachCommission.updateMany({
      where: {
        month: month,
        type: {
          startsWith: 'sales_renewal_'
        },
        status: 'pending'
      },
      data: {
        status: 'approved'
      }
    })

    const updatedCount = await prisma.coachCommission.count({
      where: {
        month: month,
        type: {
          startsWith: 'sales_'
        },
        status: 'approved'
      }
    })

    console.log(`✅ Finalized ${updatedCount} sales commissions for ${month}`)

    return NextResponse.json({
      success: true,
      month,
      stats: {
        totalSalesStaff: stats.length,
        totalRenewals: stats.reduce((sum, s) => sum + s.renewalCount, 0),
        totalCommissions: updatedCount
      },
      topPerformers: awards.map(a => ({
        staffId: a.staffId,
        staffName: a.staffName,
        totalBonus: a.totalBonus
      })),
      tieInfo: topPerformers.length > 1 ? {
        tiedCount: topPerformers.length,
        renewalCount: topPerformers[0].renewalCount
      } : null
    })

  } catch (error: any) {
    console.error('❌ Error finalizing sales commissions:', error)

    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Admin permission required' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to finalize commissions' },
      { status: 500 }
    )
  }
}

/**
 * GET - Preview finalization (dry run)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || getMonthString()

    const stats = await getSalesStaffMonthlyStats(month)
    const topPerformers = determineTopAchiever(stats)

    return NextResponse.json({
      month,
      preview: true,
      stats: {
        totalSalesStaff: stats.length,
        totalRenewals: stats.reduce((sum, s) => sum + s.renewalCount, 0)
      },
      topPerformers: topPerformers.map(p => ({
        staffId: p.staffId,
        staffName: p.staffName,
        renewalCount: p.renewalCount,
        estimatedBonus: 1000 + (p.renewalCount * 50)
      })),
      allStaffRankings: stats
        .sort((a, b) => b.renewalCount - a.renewalCount)
        .map((s, index) => ({
          rank: index + 1,
          staffName: s.staffName,
          renewalCount: s.renewalCount,
          totalRevenue: s.totalRevenue
        }))
    })

  } catch (error: any) {
    console.error('❌ Error previewing finalization:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to preview' },
      { status: 500 }
    )
  }
}
