// lib/commissions/pt.ts
// حساب عمولة الكوتش من جلسات PT

/**
 * نسب العمولة بناءً على مستوى الكوتش
 */
export const PT_COMMISSION_RATES = {
  STANDARD: 0.30,  // 30% للكوتش العادي
  TOP_ACHIEVER_DOUBLE: 0.50  // 50% للكوتش الذي حقق Top Achiever - Double Target
}

/**
 * حساب عمولة PT بناءً على الإيرادات ومستوى الأداء
 * @param ptRevenue - إجمالي إيرادات PT للكوتش
 * @param achievedDoubleTarget - هل حقق الكوتش Double Target؟ (10 إحالات + 6 ترقيات)
 * @returns مبلغ العمولة بالجنيه المصري
 */
export function calculatePTCommission(
  ptRevenue: number,
  achievedDoubleTarget: boolean
): number {
  const rate = achievedDoubleTarget
    ? PT_COMMISSION_RATES.TOP_ACHIEVER_DOUBLE
    : PT_COMMISSION_RATES.STANDARD

  return ptRevenue * rate
}

/**
 * الحصول على نسبة العمولة بناءً على مستوى الأداء
 * @param achievedDoubleTarget - هل حقق الكوتش Double Target؟
 * @returns نسبة العمولة (0.30 أو 0.50)
 */
export function getPTCommissionRate(achievedDoubleTarget: boolean): number {
  return achievedDoubleTarget
    ? PT_COMMISSION_RATES.TOP_ACHIEVER_DOUBLE
    : PT_COMMISSION_RATES.STANDARD
}

/**
 * تحديد مستوى الكوتش بناءً على الأداء
 * @param achievedDoubleTarget - هل حقق الكوتش Double Target؟
 * @returns مستوى الكوتش (Standard أو TopAchiever)
 */
export function getCoachLevel(achievedDoubleTarget: boolean): 'Standard' | 'TopAchiever' {
  return achievedDoubleTarget ? 'TopAchiever' : 'Standard'
}
