import { prisma } from './prisma'
import { earnPoints } from './loyaltySystem'

export async function handleReferralReward(
  referrerId: string,
  newMemberId: string
): Promise<void> {
  // الحصول على أو إنشاء سجل النقاط
  let loyalty = await prisma.memberLoyalty.findUnique({
    where: { memberId: referrerId }
  })

  if (!loyalty) {
    loyalty = await prisma.memberLoyalty.create({
      data: {
        memberId: referrerId,
        referralCount: 0,
        pendingCashRewards: 0
      }
    })
  }

  const newReferralCount = loyalty.referralCount + 1

  // تحديث عداد الإحالات
  await prisma.memberLoyalty.update({
    where: { id: loyalty.id },
    data: { referralCount: newReferralCount }
  })

  // الإحالة الأولى: منح 1000 نقطة
  if (newReferralCount === 1) {
    await earnPoints({
      memberId: referrerId,
      points: 1000,
      source: 'referral',
      description: 'مكافأة الإحالة الأولى - 1000 نقطة',
      metadata: {
        referredMemberId: newMemberId,
        referralNumber: 1
      }
    })
  }

  // كل 5 إحالات: منح 1000 ج.م نقدية (قيد الاستلام)
  if (newReferralCount % 5 === 0) {
    await prisma.memberLoyalty.update({
      where: { id: loyalty.id },
      data: { pendingCashRewards: { increment: 1 } }
    })

    // تسجيل عملية في سجل النقاط
    const updatedLoyalty = await prisma.memberLoyalty.findUnique({
      where: { memberId: referrerId }
    })

    if (updatedLoyalty) {
      await prisma.loyaltyTransaction.create({
        data: {
          loyaltyId: updatedLoyalty.id,
          memberId: referrerId,
          type: 'earn',
          points: 0,
          source: 'referral_cash_pending',
          description: `إحالة رقم ${newReferralCount} - مكافأة 1000 ج.م (قيد الاستلام)`,
          metadata: JSON.stringify({
            referredMemberId: newMemberId,
            referralNumber: newReferralCount,
            cashReward: 1000
          })
        }
      })
    }
  }

  console.log(`✅ تم معالجة مكافأة الإحالة للعضو ${referrerId} - الإحالة رقم ${newReferralCount}`)
}
