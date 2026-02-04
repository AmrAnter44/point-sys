import { prisma } from './prisma'
import { calculateOnboardingBonus, getOnboardingCommissionType } from './commissions/onboarding'
import { getSubscriptionMonths } from './commissions/mrcb'

/**
 * معالجة مكافأة On-boarding للمدرب عند تسجيل عضو جديد
 * @param coachId - معرف المدرب
 * @param memberId - معرف العضو
 * @param memberNumber - رقم العضوية
 * @param subscriptionType - نوع الاشتراك (1month, 3months, 6months, 1year)
 */
export async function handleCoachRegistrationEarning(
  coachId: string,
  memberId: string,
  memberNumber: number | null,
  subscriptionType: string | null
): Promise<void> {
  const coach = await prisma.staff.findUnique({
    where: { id: coachId },
    select: { name: true }
  })

  if (!coach) throw new Error('المدرب غير موجود')

  // حساب عدد الأشهر ومبلغ المكافأة
  const subscriptionMonths = getSubscriptionMonths(subscriptionType)
  const onboardingAmount = calculateOnboardingBonus(subscriptionMonths)

  if (onboardingAmount === 0) {
    console.log(`⚠️ لا توجد مكافأة on-boarding لنوع الاشتراك: ${subscriptionType}`)
    return
  }

  // الحصول على الشهر الحالي بصيغة YYYY-MM
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // إنشاء سجل في CoachCommission
  await prisma.coachCommission.create({
    data: {
      coachId: coachId,
      type: getOnboardingCommissionType(subscriptionMonths),
      amount: onboardingAmount,
      memberId: memberId,
      month: currentMonth,
      status: 'approved',
      calculationDetails: JSON.stringify({
        memberNumber: memberNumber,
        subscriptionType: subscriptionType,
        subscriptionMonths: subscriptionMonths,
        onboardingAmount: onboardingAmount
      })
    }
  })

  console.log(`✅ تم إضافة مكافأة On-boarding ${onboardingAmount} ج.م للمدرب ${coach.name} (عضو #${memberNumber})`)
}
