// Physiotherapy Pricing System
// Prices and discount calculation for physiotherapy services

// ==================== Pricing Structure ====================

export const PHYSIO_PRICES = {
  single: {
    nonMember: 450,
    member: 400, // 11% instant discount for any gym member
  },
  package5: {
    nonMember: 2250,
    challenger: 1900,  // Base member price (no additional discount)
    fighter: 1800,     // 5% discount
    champion: 1700,    // 10% discount
    elite: 1600,       // 15% discount
  },
  package10: {
    nonMember: 4000,
    challenger: 3500,
    fighter: 3300,     // 5% discount
    champion: 3100,    // 10% discount
    elite: 2950,       // 15% discount
  },
  package15: {
    nonMember: 5250,
    challenger: 4500,
    fighter: 4250,     // 5% discount
    champion: 4000,    // 10% discount
    elite: 3800,       // 15% discount
  },
}

// ==================== Helper Functions ====================

/**
 * Calculate member tier based on subscription duration
 * @param subscriptionDurationDays - Number of days in the subscription
 * @returns Tier name (challenger, fighter, champion, elite)
 */
export function getMemberTier(subscriptionDurationDays: number): string {
  if (subscriptionDurationDays <= 30) return 'challenger'    // 1-30 days
  if (subscriptionDurationDays <= 90) return 'fighter'       // 31-90 days
  if (subscriptionDurationDays <= 180) return 'champion'     // 91-180 days
  return 'elite'                                             // 181+ days
}

/**
 * Get discount percentage for a specific tier and package type
 * @param tier - Member tier (or null for non-members)
 * @param packageType - Type of package
 * @returns Discount percentage
 */
export function getDiscountPercent(tier: string | null, packageType: string): number {
  // Single session: Any member gets 11% discount
  if (packageType === 'single') {
    return tier ? 11 : 0
  }

  // For packages: tier-based discounts
  if (!tier) return 0

  switch (tier.toLowerCase()) {
    case 'challenger': return 0   // Base member price, no additional discount
    case 'fighter': return 5
    case 'champion': return 10
    case 'elite': return 15
    default: return 0
  }
}

/**
 * Calculate physiotherapy price with discounts applied
 * @param packageType - Type of package (single, 5sessions, 10sessions, 15sessions)
 * @param memberTier - Member tier (or null for non-members)
 * @returns Pricing details object
 */
export function calculatePhysioPrice(
  packageType: 'single' | '5sessions' | '10sessions' | '15sessions',
  memberTier: string | null
): {
  basePrice: number
  finalPrice: number
  discountAmount: number
  discountPercent: number
  pricePerSession: number
  sessionCount: number
} {
  let basePrice: number
  let finalPrice: number
  let sessionCount: number

  // Determine session count
  switch (packageType) {
    case 'single':
      sessionCount = 1
      break
    case '5sessions':
      sessionCount = 5
      break
    case '10sessions':
      sessionCount = 10
      break
    case '15sessions':
      sessionCount = 15
      break
    default:
      sessionCount = 1
  }

  // Calculate pricing
  if (packageType === 'single') {
    basePrice = PHYSIO_PRICES.single.nonMember
    finalPrice = memberTier ? PHYSIO_PRICES.single.member : basePrice
  } else {
    // Determine which package pricing to use
    const packageKey = packageType === '5sessions' ? 'package5' :
                      packageType === '10sessions' ? 'package10' : 'package15'

    basePrice = PHYSIO_PRICES[packageKey].nonMember

    if (!memberTier) {
      finalPrice = basePrice
    } else {
      const tier = memberTier.toLowerCase() as keyof typeof PHYSIO_PRICES.package5
      finalPrice = PHYSIO_PRICES[packageKey][tier] || basePrice
    }
  }

  const discountAmount = basePrice - finalPrice
  const discountPercent = getDiscountPercent(memberTier, packageType)
  const pricePerSession = finalPrice / sessionCount

  return {
    basePrice,
    finalPrice,
    discountAmount,
    discountPercent,
    pricePerSession,
    sessionCount,
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
    challenger: { ar: 'Challenger - المبتدئ', en: 'Challenger' },
    fighter: { ar: 'Fighter - المقاتل', en: 'Fighter' },
    champion: { ar: 'Champion - البطل', en: 'Champion' },
    elite: { ar: 'Elite - النخبة', en: 'Elite' },
  }

  const tierLower = tier.toLowerCase() as keyof typeof tierMap
  return tierMap[tierLower]?.[locale] || tier
}

/**
 * Get package display name
 * @param packageType - Package type
 * @param locale - Language locale
 * @returns Display name
 */
export function getPackageName(
  packageType: string,
  locale: 'ar' | 'en'
): string {
  const packageNames = {
    single: { ar: 'جلسة واحدة', en: 'Single Session' },
    '5sessions': { ar: 'باقة 5 جلسات', en: '5 Sessions Package' },
    '10sessions': { ar: 'باقة 10 جلسات', en: '10 Sessions Package' },
    '15sessions': { ar: 'باقة 15 جلسة', en: '15 Sessions Package' },
  }

  return packageNames[packageType as keyof typeof packageNames]?.[locale] || packageType
}
