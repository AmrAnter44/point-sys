// lib/commissions/mrcb.ts
// حساب MRCB بناءً على المستوى والشهر الحالي للاشتراك

export const MRCB_RATES = {
  Challenger: { amount: 25, validMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },      // من الشهر الثاني فصاعداً (للتجديد)
  Fighter: { amount: 75, validMonths: [2, 3] },     // الشهر 2-3
  Champion: { amount: 100, validMonths: [2, 3, 4, 5, 6] }, // الشهر 2-6
  Elite: { amount: 150, validMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, // الشهر 2-12
}

export function calculateMRCB(
  subscriptionType: string,
  subscriptionMonths: number,
  currentMonth: number
): number {
  // تحديد المستوى من subscriptionType
  let tier: string
  if (subscriptionMonths === 1) tier = 'Challenger'
  else if (subscriptionMonths === 3) tier = 'Fighter'
  else if (subscriptionMonths === 6) tier = 'Champion'
  else if (subscriptionMonths === 12) tier = 'Elite'
  else return 0

  const config = MRCB_RATES[tier as keyof typeof MRCB_RATES]
  if (!config) return 0

  // التحقق إذا كان الشهر الحالي مؤهل للـ MRCB
  if (config.validMonths.includes(currentMonth)) {
    return config.amount
  }

  return 0
}

export function getCurrentSubscriptionMonth(
  startDate: Date,
  targetMonth: string // "YYYY-MM"
): number {
  const start = new Date(startDate)
  const target = new Date(targetMonth + '-01')

  const monthsDiff = (target.getFullYear() - start.getFullYear()) * 12
    + (target.getMonth() - start.getMonth()) + 1

  return Math.max(1, monthsDiff)
}

export function getSubscriptionMonths(subscriptionType: string | null): number {
  if (!subscriptionType) return 0
  if (subscriptionType === '1month') return 1
  if (subscriptionType === '3months') return 3
  if (subscriptionType === '6months') return 6
  if (subscriptionType === '1year') return 12
  return 0
}

export function getTierName(subscriptionMonths: number): string {
  if (subscriptionMonths === 1) return 'Challenger'
  if (subscriptionMonths === 3) return 'Fighter'
  if (subscriptionMonths === 6) return 'Champion'
  if (subscriptionMonths === 12) return 'Elite'
  return 'Unknown'
}
