import { prisma } from './prisma'
import {
  checkAttendanceDiscountEligibility,
  calculateAttendanceDiscountAmount,
  getTierFromDuration
} from './attendanceDiscount'

// ==================== Types ====================

interface UpgradeEligibility {
  eligible: boolean
  reason?: string
  daysRemaining?: number
  currentOffer?: any
  warning?: string  // تحذير بدون منع الترقية
  isExpired?: boolean  // هل انتهت فترة الترقية المسموحة
}

interface AttendanceEligibility {
  eligible: boolean
  currentAverage: number
  requiredAverage: number
  discountPercent: number
  discountReason: string
  totalCheckIns: number
  monthsElapsed: number
}

interface UpgradePrice {
  upgradePrice: number
  oldOfferPrice: number
  newOfferPrice: number
  attendanceDiscount?: number
  attendanceEligibility?: AttendanceEligibility | null
}

interface UpgradeableOffer {
  id: string
  name: string
  duration: number
  price: number
  upgradePrice: number
  freePTSessions: number
  inBodyScans: number
  invitations: number
  movementAssessments: number
  nutritionSessions: number
  monthlyAttendanceGoal: number
  upgradeAllowedDays: number
  onboardingSessions: number
  followUpSessions: number
  groupClasses: number
  poolSessions: number
  paddleSessions: number
  freezingDays: number
  icon: string
}

// ==================== Main Functions ====================

/**
 * التحقق من أهلية العضو للترقية
 */
export async function checkUpgradeEligibility(
  memberId: string
): Promise<UpgradeEligibility> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      isActive: true,
      startDate: true,
      expiryDate: true,
      currentOfferId: true,
      currentOfferName: true
    }
  })

  if (!member) {
    return { eligible: false, reason: 'العضو غير موجود' }
  }

  if (!member.isActive) {
    return { eligible: false, reason: 'العضو غير نشط' }
  }

  if (!member.startDate || !member.expiryDate) {
    return { eligible: false, reason: 'لا يوجد اشتراك نشط' }
  }

  if (!member.currentOfferId) {
    return { eligible: false, reason: 'لا يوجد اشتراك حالي' }
  }

  // جلب الباقة الحالية
  const currentOffer = await prisma.offer.findUnique({
    where: { id: member.currentOfferId }
  })

  if (!currentOffer) {
    return { eligible: false, reason: 'الباقة الحالية غير موجودة' }
  }

  // التحقق من أن الباقة ليست Elite (أعلى مستوى)
  if (currentOffer.upgradeAllowedDays === 0) {
    return {
      eligible: false,
      reason: 'أنت في أعلى باقة متاحة (Elite)',
      currentOffer
    }
  }

  // حساب عدد الأيام منذ بداية الاشتراك
  const daysSinceStart = Math.floor(
    (Date.now() - member.startDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  const daysRemaining = currentOffer.upgradeAllowedDays - daysSinceStart

  // ✅ السماح بالترقية حتى لو انتهت الفترة المسموحة، مع إظهار تحذير
  if (daysSinceStart > currentOffer.upgradeAllowedDays) {
    const daysOverdue = daysSinceStart - currentOffer.upgradeAllowedDays
    return {
      eligible: true,
      daysRemaining: 0,
      currentOffer,
      isExpired: true,
      warning: `⚠️ انتهت فترة الترقية المسموحة منذ ${daysOverdue} يوم، لكن يمكنك المتابعة`
    }
  }

  return {
    eligible: true,
    daysRemaining,
    currentOffer,
    isExpired: false
  }
}

/**
 * حساب سعر الترقية (الفرق بين الباقتين) مع خصم الحضور
 */
export async function calculateUpgradePrice(
  currentOfferId: string,
  newOfferId: string,
  memberId?: string,
  subscriptionStartDate?: Date
): Promise<UpgradePrice> {
  const [currentOffer, newOffer] = await Promise.all([
    prisma.offer.findUnique({ where: { id: currentOfferId } }),
    prisma.offer.findUnique({ where: { id: newOfferId } })
  ])

  if (!currentOffer || !newOffer) {
    throw new Error('إحدى الباقات غير موجودة')
  }

  // حساب سعر الترقية الأساسي
  const baseUpgradePrice = newOffer.price - currentOffer.price

  if (baseUpgradePrice <= 0) {
    throw new Error('الباقة الجديدة يجب أن تكون أعلى سعراً من الحالية')
  }

  // حساب خصم الحضور (إذا توفرت البيانات)
  let attendanceDiscount = 0
  let attendanceEligibility: AttendanceEligibility | null = null

  if (memberId && subscriptionStartDate) {
    const currentTier = getTierFromDuration(currentOffer.duration.toString())
    const targetTier = getTierFromDuration(newOffer.duration.toString())

    attendanceEligibility = await checkAttendanceDiscountEligibility(
      memberId,
      currentTier,
      targetTier,
      subscriptionStartDate
    )

    if (attendanceEligibility.eligible) {
      attendanceDiscount = calculateAttendanceDiscountAmount(
        baseUpgradePrice,
        attendanceEligibility.discountPercent
      )
    }
  }

  // السعر النهائي = السعر الأساسي - خصم الحضور
  const finalUpgradePrice = baseUpgradePrice - attendanceDiscount

  return {
    upgradePrice: finalUpgradePrice,
    oldOfferPrice: currentOffer.price,
    newOfferPrice: newOffer.price,
    attendanceDiscount,
    attendanceEligibility
  }
}

/**
 * حساب تاريخ النهاية الجديد بناءً على:
 * تاريخ الانتهاء الحالي + (مدة الباقة الجديدة - مدة الباقة الحالية)
 * بهذا الشكل العضو يحتفظ بأيامه المتبقية ويضاف عليها الفرق فقط
 */
export function calculateNewExpiryDate(
  currentExpiryDate: Date,
  newOfferDuration: number,
  currentOfferDuration: number
): Date {
  const extraDays = newOfferDuration - currentOfferDuration
  const newExpiry = new Date(currentExpiryDate)
  newExpiry.setDate(newExpiry.getDate() + extraDays)
  return newExpiry
}

/**
 * الحصول على الباقات المتاحة للترقية
 */
export async function getUpgradeableOffers(
  memberId: string
): Promise<UpgradeableOffer[]> {
  // التحقق من الأهلية
  const eligibility = await checkUpgradeEligibility(memberId)

  if (!eligibility.eligible) {
    return []
  }

  const currentOffer = eligibility.currentOffer
  if (!currentOffer) return []

  // جلب جميع الباقات النشطة
  const allOffers = await prisma.offer.findMany({
    where: { isActive: true },
    orderBy: { duration: 'asc' }
  })

  // فلترة الباقات الأعلى فقط
  const upgradeableOffers = allOffers
    .filter(offer =>
      offer.duration > currentOffer.duration &&
      offer.price > currentOffer.price
    )
    .map(offer => ({
      ...offer,
      upgradePrice: offer.price - currentOffer.price
    }))

  return upgradeableOffers
}

/**
 * دالة مساعدة للحصول على tier level
 */
export function getOfferTier(duration: number): number {
  if (duration <= 30) return 1   // Challenger
  if (duration <= 90) return 2   // Fighter
  if (duration <= 180) return 3  // Champion
  return 4                        // Elite
}
