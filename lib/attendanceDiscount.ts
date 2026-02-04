// lib/attendanceDiscount.ts
// حساب خصومات الترقية بناءً على الحضور

import { prisma } from './prisma'

// 1. تحديد أهداف الحضور لكل مستوى (زيارات شهرية)
export const ATTENDANCE_GOALS = {
  'Challenger': 12,   // شهر واحد - 12 زيارة
  'Fighter': 15,      // 3 أشهر - متوسط 15 زيارة/شهر
  'Champion': 18,     // 6 أشهر - متوسط 18 زيارة/شهر
  'Elite': 20         // 12 شهر - متوسط 20 زيارة/شهر
} as const

// 2. تحديد نسب الخصم حسب مسار الترقية
export const UPGRADE_ATTENDANCE_DISCOUNTS = {
  'Challenger->Fighter': 0.05,    // 5%
  'Fighter->Champion': 0.10,      // 10%
  'Champion->Elite': 0.15         // 15%
} as const

// 3. دالة حساب متوسط الحضور الشهري
export async function calculateMonthlyAttendanceAverage(
  memberId: string,
  subscriptionStartDate: Date
): Promise<{
  totalCheckIns: number
  monthsElapsed: number
  monthlyAverage: number
}> {
  const now = new Date()

  // حساب عدد الأيام منذ بداية الاشتراك
  const daysElapsed = Math.floor(
    (now.getTime() - subscriptionStartDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  // حساب عدد الأشهر (على الأقل 0.5 شهر لتجنب القسمة على صفر)
  const monthsElapsed = Math.max(daysElapsed / 30, 0.5)

  // عدد مرات الحضور منذ بداية الاشتراك
  const totalCheckIns = await prisma.memberCheckIn.count({
    where: {
      memberId,
      checkInTime: {
        gte: subscriptionStartDate,
        lte: now
      }
    }
  })

  // حساب المتوسط الشهري
  const monthlyAverage = totalCheckIns / monthsElapsed

  return {
    totalCheckIns,
    monthsElapsed: Math.round(monthsElapsed * 10) / 10, // تقريب لأقرب رقم عشري
    monthlyAverage: Math.round(monthlyAverage * 10) / 10
  }
}

// 4. دالة التحقق من الأهلية للخصم
export async function checkAttendanceDiscountEligibility(
  memberId: string,
  currentTier: string,
  targetTier: string,
  subscriptionStartDate: Date
): Promise<{
  eligible: boolean
  currentAverage: number
  requiredAverage: number
  discountPercent: number
  discountReason: string
  totalCheckIns: number
  monthsElapsed: number
}> {
  // حساب متوسط الحضور الشهري
  const { totalCheckIns, monthsElapsed, monthlyAverage } =
    await calculateMonthlyAttendanceAverage(memberId, subscriptionStartDate)

  // تحديد مسار الترقية
  const upgradePath = `${currentTier}->${targetTier}` as keyof typeof UPGRADE_ATTENDANCE_DISCOUNTS

  // الحصول على نسبة الخصم لهذا المسار
  const discountPercent = UPGRADE_ATTENDANCE_DISCOUNTS[upgradePath] || 0

  // إذا لم يكن هناك خصم محدد لهذا المسار
  if (discountPercent === 0) {
    return {
      eligible: false,
      currentAverage: monthlyAverage,
      requiredAverage: 0,
      discountPercent: 0,
      discountReason: 'لا يوجد خصم حضور لهذا المسار',
      totalCheckIns,
      monthsElapsed
    }
  }

  // الحصول على الهدف المطلوب للمستوى الحالي
  const requiredAverage = ATTENDANCE_GOALS[currentTier as keyof typeof ATTENDANCE_GOALS] || 0

  // التحقق من تحقيق الهدف
  const eligible = monthlyAverage >= requiredAverage

  const discountReason = eligible
    ? `تحقق هدف الحضور: ${monthlyAverage.toFixed(1)} ≥ ${requiredAverage} زيارة/شهر`
    : `لم يتحقق هدف الحضور: ${monthlyAverage.toFixed(1)} < ${requiredAverage} زيارة/شهر`

  return {
    eligible,
    currentAverage: monthlyAverage,
    requiredAverage,
    discountPercent: eligible ? discountPercent : 0,
    discountReason,
    totalCheckIns,
    monthsElapsed
  }
}

// 5. دالة حساب قيمة الخصم
export function calculateAttendanceDiscountAmount(
  upgradePrice: number,
  discountPercent: number
): number {
  return Math.round(upgradePrice * discountPercent * 100) / 100
}

// 6. دالة استنتاج المستوى من مدة الاشتراك
export function getTierFromDuration(duration: string): string {
  switch (duration) {
    case '1month':
      return 'Challenger'
    case '3months':
      return 'Fighter'
    case '6months':
      return 'Champion'
    case '1year':
      return 'Elite'
    default:
      return 'Unknown'
  }
}

// 7. دالة مساعدة: الحصول على وصف الخصم بالعربية
export function getDiscountDescription(
  currentTier: string,
  targetTier: string,
  discountPercent: number
): string {
  const percentFormatted = (discountPercent * 100).toFixed(0)
  return `خصم ${percentFormatted}% عند الترقية من ${currentTier} إلى ${targetTier}`
}
