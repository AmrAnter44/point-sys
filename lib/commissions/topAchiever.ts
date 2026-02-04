// lib/commissions/topAchiever.ts
// نظام Top Achiever للكوتشات - استبدال Best Coach

/**
 * متطلبات Top Achiever
 */
export const TOP_ACHIEVER_REQUIREMENTS = {
  basic: {
    serviceReferrals: 5,    // Nutrition + Physio
    membershipUpgrades: 3
  },
  double: {
    serviceReferrals: 10,
    membershipUpgrades: 6
  }
}

/**
 * مكافأة Top Achiever لكل MRCB
 */
export const TOP_ACHIEVER_BONUS_PER_MRCB = {
  basic: 50,   // 50 ج.م لكل MRCB
  double: 100  // 100 ج.م لكل MRCB
}

/**
 * تحديد مستوى Top Achiever بناءً على الأداء الشهري
 * @param serviceReferrals - عدد إحالات الخدمات (Nutrition + Physiotherapy)
 * @param membershipUpgrades - عدد ترقيات العضويات
 * @returns مستوى Top Achiever ('none' | 'basic' | 'double')
 */
export function determineTopAchieverLevel(
  serviceReferrals: number,
  membershipUpgrades: number
): 'none' | 'basic' | 'double' {
  // التحقق من Double Target (10 إحالات + 6 ترقيات)
  if (
    serviceReferrals >= TOP_ACHIEVER_REQUIREMENTS.double.serviceReferrals &&
    membershipUpgrades >= TOP_ACHIEVER_REQUIREMENTS.double.membershipUpgrades
  ) {
    return 'double'
  }

  // التحقق من Basic Target (5 إحالات + 3 ترقيات)
  if (
    serviceReferrals >= TOP_ACHIEVER_REQUIREMENTS.basic.serviceReferrals &&
    membershipUpgrades >= TOP_ACHIEVER_REQUIREMENTS.basic.membershipUpgrades
  ) {
    return 'basic'
  }

  // لم يحقق الشروط
  return 'none'
}

/**
 * حساب إجمالي مكافأة Top Achiever للشهر
 * @param level - مستوى Top Achiever
 * @param activeClientsCount - عدد العملاء النشطين
 * @returns إجمالي المكافأة بالجنيه المصري
 *
 * @example
 * // كوتش حقق Basic Target ولديه 10 عملاء نشطين
 * calculateTopAchieverBonus('basic', 10) // 50 × 10 = 500 ج.م
 *
 * @example
 * // كوتش حقق Double Target ولديه 10 عملاء نشطين
 * calculateTopAchieverBonus('double', 10) // 100 × 10 = 1,000 ج.م
 */
export function calculateTopAchieverBonus(
  level: 'none' | 'basic' | 'double',
  activeClientsCount: number
): number {
  if (level === 'double') {
    return TOP_ACHIEVER_BONUS_PER_MRCB.double * activeClientsCount
  }

  if (level === 'basic') {
    return TOP_ACHIEVER_BONUS_PER_MRCB.basic * activeClientsCount
  }

  return 0
}

/**
 * الحصول على وصف مستوى Top Achiever
 * @param level - مستوى Top Achiever
 * @returns الوصف بالعربية
 */
export function getTopAchieverDescription(level: 'none' | 'basic' | 'double'): string {
  if (level === 'double') {
    return 'Top Achiever (Double Target) 🏆'
  }

  if (level === 'basic') {
    return 'Top Achiever (Basic Target) ⭐'
  }

  return 'لم يحقق Top Achiever'
}

/**
 * الحصول على المكافأة لكل MRCB حسب المستوى
 * @param level - مستوى Top Achiever
 * @returns المكافأة لكل MRCB بالجنيه المصري
 */
export function getBonusPerMRCB(level: 'none' | 'basic' | 'double'): number {
  if (level === 'double') {
    return TOP_ACHIEVER_BONUS_PER_MRCB.double
  }

  if (level === 'basic') {
    return TOP_ACHIEVER_BONUS_PER_MRCB.basic
  }

  return 0
}
