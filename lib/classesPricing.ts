// lib/classesPricing.ts - نظام تسعير الكلاسات

// جدول الأسعار الثابت
export const CLASS_PRICES = {
  single: {
    all: 200, // سعر موحد للجميع
  },
  '10sessions': {
    nonMember: 1800,
    '1month': 1500,
    '3months': 1200,
    '6months': 900,
    '1year': 600,
  },
}

export type PackageType = 'single' | '10sessions'
export type MemberTier = 'nonMember' | '1month' | '3months' | '6months' | '1year'

export interface ClassPricing {
  packageType: PackageType
  sessions: number
  basePrice: number
  discountPercent: number
  totalPrice: number
  pricePerSession: number
  tier: MemberTier
}

/**
 * حساب سعر باقة الكلاسات حسب النوع والعضوية
 */
export function calculateClassPrice(
  packageType: PackageType,
  subscriptionType: string | null
): ClassPricing {
  const tier = getMemberTier(subscriptionType)

  if (packageType === 'single') {
    return {
      packageType: 'single',
      sessions: 1,
      basePrice: 200,
      discountPercent: 0,
      totalPrice: 200,
      pricePerSession: 200,
      tier,
    }
  }

  // باقة 10 جلسات
  const tierPrice = CLASS_PRICES['10sessions'][tier]
  const basePrice = CLASS_PRICES['10sessions'].nonMember
  const discount = basePrice - tierPrice
  const discountPercent = Math.round((discount / basePrice) * 100)

  return {
    packageType: '10sessions',
    sessions: 10,
    basePrice,
    discountPercent,
    totalPrice: tierPrice,
    pricePerSession: Math.round(tierPrice / 10),
    tier,
  }
}

/**
 * تحديد مستوى العضو
 */
export function getMemberTier(subscriptionType: string | null): MemberTier {
  if (!subscriptionType) return 'nonMember'

  if (subscriptionType === '1month') return '1month'
  if (subscriptionType === '3months') return '3months'
  if (subscriptionType === '6months') return '6months'
  if (subscriptionType === '1year') return '1year'

  return 'nonMember'
}

/**
 * تنسيق اسم المستوى
 */
export function formatTierName(tier: string | null, lang: 'ar' | 'en' = 'ar'): string {
  const names = {
    ar: {
      nonMember: 'غير مشترك',
      '1month': 'شهر واحد',
      '3months': '3 شهور',
      '6months': '6 شهور',
      '1year': 'سنة',
    },
    en: {
      nonMember: 'Non-Member',
      '1month': '1 Month',
      '3months': '3 Months',
      '6months': '6 Months',
      '1year': '1 Year',
    },
  }

  return names[lang][tier as MemberTier] || names[lang].nonMember
}

/**
 * حساب نسبة الخصم
 */
export function getDiscountPercent(packageType: PackageType, tier: MemberTier): number {
  if (packageType === 'single') return 0

  const basePrice = CLASS_PRICES['10sessions'].nonMember
  const tierPrice = CLASS_PRICES['10sessions'][tier]
  return Math.round(((basePrice - tierPrice) / basePrice) * 100)
}

/**
 * الحصول على سعر الباقة حسب المستوى
 */
export function getPackagePrice(packageType: PackageType, tier: MemberTier): number {
  if (packageType === 'single') {
    return CLASS_PRICES.single.all
  }

  return CLASS_PRICES['10sessions'][tier]
}

/**
 * التحقق من صحة نوع الباقة
 */
export function isValidPackageType(packageType: string): packageType is PackageType {
  return packageType === 'single' || packageType === '10sessions'
}
