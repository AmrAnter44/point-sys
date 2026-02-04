// Nutrition Session Pricing System
// Prices and discount calculation for nutrition services

// ==================== Pricing Structure ====================

export const NUTRITION_PRICES = {
  single: {
    nonMember: 500,
    member: 450, // 10% instant discount for any gym member
  },
  '1month': {
    nonMember: 950,
    challenger: 850,   // Base member price
    fighter: 800,      // 5% discount
    champion: 750,     // 10% discount
    elite: 700,        // 15% discount
  },
  '2months': {
    nonMember: 1850,
    challenger: 1600,
    fighter: 1500,     // 5% discount
    champion: 1400,    // 10% discount
    elite: 1300,       // 15% discount
  },
  '3months': {
    nonMember: 2550,
    challenger: 2300,
    fighter: 2200,     // 5% discount
    champion: 2050,    // 10% discount
    elite: 1900,       // 15% discount
  },
}

// ==================== Package Details ====================

export const NUTRITION_PACKAGE_DETAILS = {
  single: {
    duration: 0,
    followUps: 0,
    inBodyScans: 0,
    mealUpdates: 0,
    strategyUpdates: 0,
    weeklyCheckRequired: false,
  },
  '1month': {
    duration: 1,
    followUps: 2,
    inBodyScans: 2,
    mealUpdates: 1,
    strategyUpdates: 0, // Fixed plan
    weeklyCheckRequired: true,
  },
  '2months': {
    duration: 2,
    followUps: 4,
    inBodyScans: 4,
    mealUpdates: 3,
    strategyUpdates: 2, // Every 3 weeks
    weeklyCheckRequired: true,
  },
  '3months': {
    duration: 3,
    followUps: 6,
    inBodyScans: 6,
    mealUpdates: 9,
    strategyUpdates: 8, // Every 10 days
    weeklyCheckRequired: true,
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
  // Single session: Any member gets 10% discount
  if (packageType === 'single') {
    return tier ? 10 : 0
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
 * Calculate nutrition package price with discounts applied
 * @param packageType - Type of package (single, 1month, 2months, 3months)
 * @param memberTier - Member tier (or null for non-members)
 * @returns Pricing details object
 */
export function calculateNutritionPrice(
  packageType: 'single' | '1month' | '2months' | '3months',
  memberTier: string | null
): {
  basePrice: number
  finalPrice: number
  discountAmount: number
  discountPercent: number
  packageDetails: typeof NUTRITION_PACKAGE_DETAILS.single
} {
  let basePrice: number
  let finalPrice: number

  // Get package details
  const packageDetails = NUTRITION_PACKAGE_DETAILS[packageType]

  // Calculate pricing
  if (packageType === 'single') {
    basePrice = NUTRITION_PRICES.single.nonMember
    finalPrice = memberTier ? NUTRITION_PRICES.single.member : basePrice
  } else {
    const packageKey = packageType as keyof typeof NUTRITION_PRICES
    basePrice = NUTRITION_PRICES[packageKey].nonMember

    if (!memberTier) {
      finalPrice = basePrice
    } else {
      const tier = memberTier.toLowerCase() as keyof typeof NUTRITION_PRICES['1month']
      finalPrice = NUTRITION_PRICES[packageKey][tier] || basePrice
    }
  }

  const discountAmount = basePrice - finalPrice
  const discountPercent = getDiscountPercent(memberTier, packageType)

  return {
    basePrice,
    finalPrice,
    discountAmount,
    discountPercent,
    packageDetails,
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
    '1month': { ar: 'شهر واحد', en: '1 Month' },
    '2months': { ar: 'شهرين', en: '2 Months' },
    '3months': { ar: '3 شهور', en: '3 Months' },
  }

  return packageNames[packageType as keyof typeof packageNames]?.[locale] || packageType
}

/**
 * Calculate expiry date based on package type
 * @param packageType - Package type
 * @param startDate - Start date
 * @returns Expiry date or null for single session
 */
export function calculateExpiryDate(
  packageType: string,
  startDate: Date = new Date()
): Date | null {
  const details = NUTRITION_PACKAGE_DETAILS[packageType as keyof typeof NUTRITION_PACKAGE_DETAILS]
  if (!details || details.duration === 0) return null

  const expiryDate = new Date(startDate)
  expiryDate.setMonth(expiryDate.getMonth() + details.duration)
  return expiryDate
}
