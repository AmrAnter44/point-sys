// PT Session Pricing System
// Prices and discount calculation for PT services

// ==================== Pricing Structure ====================

export const PT_PRICES = {
  '8sessions': {
    nonMember: 3500,
    '1month': 2000,
    '3months': 1900,
    '6months': 1800,
    '1year': 1700,
  },
  '12sessions': {
    nonMember: 4300,
    '1month': 2800,
    '3months': 2660,
    '6months': 2520,
    '1year': 2380,
  },
  '16sessions': {
    nonMember: 5100,
    '1month': 3600,
    '3months': 3420,
    '6months': 3240,
    '1year': 3060,
  },
  '20sessions': {
    nonMember: 5900,
    '1month': 4400,
    '3months': 4180,
    '6months': 3960,
    '1year': 3740,
  },
  '24sessions': {
    nonMember: 6700,
    '1month': 5000,
    '3months': 4750,
    '6months': 4500,
    '1year': 4250,
  },
}

// ==================== Helper Functions ====================

/**
 * Get member tier from subscriptionType
 * @param subscriptionType - Type of subscription ("1month", "3months", "6months", "1year")
 * @returns Tier name or null
 */
export function getMemberTier(subscriptionType: string | null): string | null {
  // Simply return the subscriptionType as-is
  return subscriptionType
}

/**
 * Get discount percentage for a specific tier and package type
 * @param tier - Member tier (or null for non-members)
 * @param sessionCount - Number of sessions
 * @returns Discount percentage
 */
export function getDiscountPercent(tier: string | null, sessionCount: number): number {
  if (!tier) return 0

  const packageKey = `${sessionCount}sessions` as keyof typeof PT_PRICES
  const prices = PT_PRICES[packageKey]

  if (!prices) return 0

  const memberPrice = prices[tier as keyof typeof prices] || prices.nonMember
  const basePrice = prices.nonMember

  const discountAmount = basePrice - memberPrice
  const discountPercent = (discountAmount / basePrice) * 100

  return Math.round(discountPercent * 10) / 10 // Round to 1 decimal place
}

/**
 * Calculate PT package price with discounts applied
 * @param sessionCount - Number of sessions (8, 12, 16, 20, 24)
 * @param memberTier - Member tier (or null for non-members)
 * @returns Pricing details object
 */
export function calculatePTPrice(
  sessionCount: 8 | 12 | 16 | 20 | 24,
  memberTier: string | null
): {
  totalPrice: number
  pricePerSession: number
  basePrice: number
  discountAmount: number
  discountPercent: number
} {
  const packageKey = `${sessionCount}sessions` as keyof typeof PT_PRICES
  const prices = PT_PRICES[packageKey]

  if (!prices) {
    throw new Error(`Invalid session count: ${sessionCount}`)
  }

  const basePrice = prices.nonMember
  let totalPrice: number

  if (!memberTier) {
    totalPrice = basePrice
  } else {
    const tierKey = memberTier as keyof typeof prices
    totalPrice = prices[tierKey] || basePrice
  }

  const pricePerSession = totalPrice / sessionCount
  const discountAmount = basePrice - totalPrice
  const discountPercent = getDiscountPercent(memberTier, sessionCount)

  return {
    totalPrice,
    pricePerSession: Math.round(pricePerSession * 100) / 100, // Round to 2 decimals
    basePrice,
    discountAmount,
    discountPercent,
  }
}

/**
 * Format tier name for display (localized)
 * @param tier - Tier name (or null)
 * @param locale - Language locale ('ar' or 'en')
 * @returns Formatted tier name
 */
export function formatTierName(tier: string | null, locale: 'ar' | 'en'): string {
  if (!tier) return locale === 'ar' ? 'غير عضو' : 'Non-Member'

  const tierMap = {
    '1month': { ar: 'شهر واحد', en: '1 Month' },
    '3months': { ar: '3 شهور', en: '3 Months' },
    '6months': { ar: '6 شهور', en: '6 Months' },
    '1year': { ar: 'سنة', en: '1 Year' },
  }

  return tierMap[tier as keyof typeof tierMap]?.[locale] || tier
}

/**
 * Get all available session counts
 * @returns Array of available session counts
 */
export function getAvailableSessionCounts(): number[] {
  return [8, 12, 16, 20, 24]
}

/**
 * Check if a session count is valid
 * @param count - Session count to check
 * @returns True if valid
 */
export function isValidSessionCount(count: number): count is 8 | 12 | 16 | 20 | 24 {
  return [8, 12, 16, 20, 24].includes(count)
}
