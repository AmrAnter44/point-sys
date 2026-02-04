// lib/commissions/salesTopAchiever.ts
// Top Achiever Sales Bonus calculation

import { prisma } from '../prisma'

export const TOP_ACHIEVER_BASE = 1000 // EGP
export const TOP_ACHIEVER_RENEWAL_MULTIPLIER = 50 // EGP per renewal

export interface SalesStaffStats {
  staffId: string
  staffName: string
  renewalCount: number
  totalRevenue: number
  bonuses: {
    renewalBonuses: number
    topAchieverBase: number
    topAchieverMultiplier: number
    total: number
  }
}

/**
 * Get all sales staff renewal stats for a month
 */
export async function getSalesStaffMonthlyStats(
  month: string
): Promise<SalesStaffStats[]> {
  // Get all sales staff
  const salesStaff = await prisma.staff.findMany({
    where: {
      position: 'ريسبشن',
      isActive: true
    }
  })

  const stats: SalesStaffStats[] = []

  for (const staff of salesStaff) {
    // Get renewal commissions for this staff this month
    const renewalCommissions = await prisma.coachCommission.findMany({
      where: {
        coachId: staff.id,
        month: month,
        type: {
          startsWith: 'sales_renewal_'
        }
      },
      include: {
        receipt: true
      }
    })

    const renewalCount = renewalCommissions.length
    const renewalBonuses = renewalCommissions.reduce((sum, c) => sum + c.amount, 0)
    const totalRevenue = renewalCommissions.reduce((sum, c) => {
      return sum + (c.receipt?.amount || 0)
    }, 0)

    stats.push({
      staffId: staff.id,
      staffName: staff.name,
      renewalCount,
      totalRevenue,
      bonuses: {
        renewalBonuses,
        topAchieverBase: 0, // Will be set for winner
        topAchieverMultiplier: 0, // Will be set for winner
        total: renewalBonuses
      }
    })
  }

  return stats
}

/**
 * Determine top achiever(s) for the month
 * Returns array to handle ties
 */
export function determineTopAchiever(
  stats: SalesStaffStats[]
): SalesStaffStats[] {
  if (stats.length === 0) return []

  // Sort by renewal count DESC, then by revenue DESC
  const sorted = [...stats].sort((a, b) => {
    if (b.renewalCount !== a.renewalCount) {
      return b.renewalCount - a.renewalCount
    }
    return b.totalRevenue - a.totalRevenue
  })

  const topCount = sorted[0].renewalCount

  // Handle ties - all staff with same top renewal count
  const topPerformers = sorted.filter(s => s.renewalCount === topCount)

  return topPerformers
}

/**
 * Calculate top achiever bonus
 */
export function calculateTopAchieverBonus(renewalCount: number): {
  base: number
  multiplier: number
  total: number
} {
  const base = TOP_ACHIEVER_BASE
  const multiplier = renewalCount * TOP_ACHIEVER_RENEWAL_MULTIPLIER
  const total = base + multiplier

  return { base, multiplier, total }
}

/**
 * Award top achiever bonus(es)
 */
export async function awardTopAchieverBonus(
  month: string,
  topPerformers: SalesStaffStats[]
) {
  const results = []

  for (const performer of topPerformers) {
    const bonus = calculateTopAchieverBonus(performer.renewalCount)

    // Create base bonus record
    const baseCommission = await prisma.coachCommission.create({
      data: {
        coachId: performer.staffId,
        type: 'sales_top_achiever_base',
        amount: bonus.base,
        month: month,
        status: 'approved',
        calculationDetails: JSON.stringify({
          renewalCount: performer.renewalCount,
          totalRevenue: performer.totalRevenue,
          rank: 1,
          tiedWith: topPerformers.length > 1 ? topPerformers.map(p => p.staffName) : null
        })
      }
    })

    // Create renewal multiplier bonus record
    const multiplierCommission = await prisma.coachCommission.create({
      data: {
        coachId: performer.staffId,
        type: 'sales_top_achiever_renewal_multiplier',
        amount: bonus.multiplier,
        month: month,
        status: 'approved',
        calculationDetails: JSON.stringify({
          renewalCount: performer.renewalCount,
          ratePerRenewal: TOP_ACHIEVER_RENEWAL_MULTIPLIER,
          totalMultiplier: bonus.multiplier
        })
      }
    })

    results.push({
      staffId: performer.staffId,
      staffName: performer.staffName,
      baseCommission,
      multiplierCommission,
      totalBonus: bonus.total
    })
  }

  return results
}
