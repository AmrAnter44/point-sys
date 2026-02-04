// lib/commissions/upsell.ts
// حساب عمولات البيع (5%)

export const UPSELL_COMMISSION_RATE = 0.05 // 5%

export function calculateUpsellCommission(
  amount: number,
  type: 'physiotherapy' | 'nutrition' | 'upgrade'
): number {
  return Math.round(amount * UPSELL_COMMISSION_RATE * 100) / 100
}
