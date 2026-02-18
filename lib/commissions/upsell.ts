// lib/commissions/upsell.ts
// حساب عمولات البيع

// 30% لو الجيم جايبله الكلاينت (عضو في الجيم)
export const UPSELL_COMMISSION_RATE_MEMBER = 0.30

// 50% لو الكوتش نفسه باع أو الكلاينت من برة (مش عضو)
export const UPSELL_COMMISSION_RATE_OUTSIDE = 0.50

/**
 * Calculate upsell commission based on client type
 * @param amount - Total package price
 * @param type - Service type
 * @param isMember - true if client is a gym member (gym brought the client), false if outside
 */
export function calculateUpsellCommission(
  amount: number,
  type: 'physiotherapy' | 'nutrition' | 'upgrade',
  isMember: boolean = false
): number {
  const rate = isMember ? UPSELL_COMMISSION_RATE_MEMBER : UPSELL_COMMISSION_RATE_OUTSIDE
  return Math.round(amount * rate * 100) / 100
}
