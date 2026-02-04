// lib/commissions/salesRenewal.ts
// Calculate sales renewal bonuses

import { prisma } from '../prisma'

export const SALES_RENEWAL_RATES = {
  // Gym Membership Renewals
  gym_challenger: 50,   // 1 month
  gym_fighter: 100,     // 3 months
  gym_champion: 150,    // 6 months
  gym_elite: 250,       // 12 months

  // Service Renewals
  physio: 50,
  nutrition: 50,
  pt: 100,

  // Classes (based on duration/tier)
  classes_challenger: 50,
  classes_fighter: 100,
  classes_champion: 150,
  classes_elite: 250,
} as const

export type SalesRenewalType = keyof typeof SALES_RENEWAL_RATES

/**
 * Calculate sales renewal bonus amount
 */
export function calculateSalesRenewalBonus(
  renewalType: SalesRenewalType,
  isTopSales: boolean = false
): number {
  const baseAmount = SALES_RENEWAL_RATES[renewalType]
  const topBonus = isTopSales ? 50 : 0  // Top sales staff يحصل على +50 ج.م

  console.log('💵 حساب العمولة:', {
    renewalType,
    baseAmount,
    isTopSales,
    topBonus,
    totalAmount: baseAmount + topBonus
  })

  return baseAmount + topBonus
}

/**
 * Determine renewal type from receipt data
 */
export function determineRenewalType(
  receipt: {
    type: string
    itemDetails: string
    renewalType?: string | null
  }
): SalesRenewalType | null {
  console.log('📋 تحديد نوع التجديد:', {
    receiptType: receipt.type,
    renewalType: receipt.renewalType
  })

  // ✅ If renewalType is already stored in receipt, use it directly
  if (receipt.renewalType) {
    console.log('✅ استخدام renewalType المحفوظ في الإيصال:', receipt.renewalType)
    return receipt.renewalType as SalesRenewalType
  }

  // Fallback: Try to determine from itemDetails (للإيصالات القديمة)
  console.log('⚠️ renewalType غير موجود، محاولة الاستنتاج من itemDetails...')

  try {
    const details = JSON.parse(receipt.itemDetails)
    console.log('📄 تفاصيل الإيصال:', details)

    // Member renewal
    if (receipt.type === 'تجديد عضويه') {
      // Check for offer-based renewal (الباقات)
      if (details.offerName) {
        const offerName = details.offerName.toLowerCase()
        console.log('🎁 تجديد بباقة:', details.offerName)

        if (offerName.includes('elite') || offerName.includes('🏆')) return 'gym_elite'
        if (offerName.includes('champion') || offerName.includes('🥇')) return 'gym_champion'
        if (offerName.includes('fighter') || offerName.includes('🥊')) return 'gym_fighter'
        if (offerName.includes('challenger') || offerName.includes('🔰')) return 'gym_challenger'
      }

      // Check for subscription type (النظام القديم)
      if (details.subscriptionType) {
        const months = getSubscriptionMonths(details.subscriptionType)
        if (months === 1) return 'gym_challenger'
        if (months === 3) return 'gym_fighter'
        if (months === 6) return 'gym_champion'
        if (months === 12) return 'gym_elite'
      }
    }

    // PT renewal
    if (receipt.type === 'تجديد برايفت') return 'pt'

    // Physio renewal
    if (receipt.type === 'تجديد علاج طبيعي') return 'physio'

    // Nutrition renewal
    if (receipt.type === 'تجديد تغذية') return 'nutrition'

    // Classes renewal
    if (receipt.type === 'تجديد كلاسات') {
      const tier = details.subscriptionType || details.packageTier
      if (tier === '1month') return 'classes_challenger'
      if (tier === '3months') return 'classes_fighter'
      if (tier === '6months') return 'classes_champion'
      if (tier === '1year') return 'classes_elite'
      return 'classes_challenger' // Default
    }

  } catch (e) {
    console.error('❌ خطأ في تحليل itemDetails:', e)
  }

  return null
}

/**
 * Helper to get subscription months from type string
 */
function getSubscriptionMonths(subscriptionType: string | null | undefined): number {
  if (!subscriptionType) return 0
  if (subscriptionType === '1month') return 1
  if (subscriptionType === '3months') return 3
  if (subscriptionType === '6months') return 6
  if (subscriptionType === '1year') return 12
  return 0
}

/**
 * Determine renewal type from offer name
 * Use this when creating receipts to set renewalType field
 */
export function getRenewalTypeFromOffer(offerName: string): SalesRenewalType | null {
  const name = offerName.toLowerCase()

  // Gym memberships
  if (name.includes('elite') || name.includes('🏆')) return 'gym_elite'
  if (name.includes('champion') || name.includes('🥇')) return 'gym_champion'
  if (name.includes('fighter') || name.includes('🥊')) return 'gym_fighter'
  if (name.includes('challenger') || name.includes('🔰')) return 'gym_challenger'

  return null
}

/**
 * Determine renewal type from subscription months
 * Use this when creating receipts without offers
 */
export function getRenewalTypeFromMonths(months: number): SalesRenewalType | null {
  if (months === 1) return 'gym_challenger'
  if (months === 3) return 'gym_fighter'
  if (months === 6) return 'gym_champion'
  if (months === 12) return 'gym_elite'
  return null
}

/**
 * Create sales renewal commission record
 */
export async function createSalesRenewalCommission(
  data: {
    staffId: string
    renewalType: SalesRenewalType
    amount: number
    receiptId: string
    memberId?: string
    month: string
  }
) {
  const commissionType = `sales_renewal_${data.renewalType}`

  console.log('💾 إنشاء سجل عمولة في قاعدة البيانات:', {
    coachId: data.staffId,
    type: commissionType,
    amount: data.amount,
    receiptId: data.receiptId,
    memberId: data.memberId,
    month: data.month,
    status: 'pending'
  })

  const commission = await prisma.coachCommission.create({
    data: {
      coachId: data.staffId, // Using coachId field for sales staff
      type: commissionType,
      amount: data.amount,
      receiptId: data.receiptId,
      memberId: data.memberId || null,
      month: data.month,
      status: 'pending',
      calculationDetails: JSON.stringify({
        renewalType: data.renewalType,
        bonusRate: data.amount,
        source: 'sales_renewal_bonus'
      })
    }
  })

  console.log('✅ تم إنشاء العمولة بنجاح:', {
    id: commission.id,
    coachId: commission.coachId,
    type: commission.type,
    amount: commission.amount
  })

  return commission
}
