// lib/commissions/onboarding.ts
// حساب مكافأة On-boarding بناءً على مستوى الاشتراك

export const ONBOARDING_RATES = {
  Challenger: 0,   // 1 شهر - لا توجد عمولة onboarding
  Fighter: 150,    // 3 أشهر
  Champion: 200,   // 6 أشهر
  Elite: 250       // 12 شهر
}

/**
 * حساب مكافأة On-boarding بناءً على مدة الاشتراك
 * @param subscriptionMonths - عدد أشهر الاشتراك (1, 3, 6, 12)
 * @returns مبلغ المكافأة بالجنيه المصري
 */
export function calculateOnboardingBonus(subscriptionMonths: number): number {
  if (subscriptionMonths === 1) return 0   // Challenger - لا توجد عمولة onboarding
  if (subscriptionMonths === 3) return 150 // Fighter
  if (subscriptionMonths === 6) return 200 // Champion
  if (subscriptionMonths === 12) return 250 // Elite
  return 0
}

/**
 * الحصول على اسم المستوى بناءً على عدد الأشهر
 * @param subscriptionMonths - عدد أشهر الاشتراك
 * @returns اسم المستوى (Challenger, Fighter, Champion, Elite)
 */
export function getTierNameFromMonths(subscriptionMonths: number): string {
  if (subscriptionMonths === 1) return 'Challenger'
  if (subscriptionMonths === 3) return 'Fighter'
  if (subscriptionMonths === 6) return 'Champion'
  if (subscriptionMonths === 12) return 'Elite'
  return 'Unknown'
}

/**
 * الحصول على نوع العمولة للتسجيل في CoachCommission
 * @param subscriptionMonths - عدد أشهر الاشتراك
 * @returns نوع العمولة (onboarding_challenger, onboarding_fighter, etc.)
 */
export function getOnboardingCommissionType(subscriptionMonths: number): string {
  const tier = getTierNameFromMonths(subscriptionMonths).toLowerCase()
  return `onboarding_${tier}`
}
