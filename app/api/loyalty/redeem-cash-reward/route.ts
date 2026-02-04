import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'canManageLoyaltyPoints')
    const { memberId } = await req.json()

    const result = await prisma.$transaction(async (tx) => {
      // الحصول على سجل النقاط
      const loyalty = await tx.memberLoyalty.findUnique({
        where: { memberId },
        include: { member: true }
      })

      if (!loyalty) {
        throw new Error('سجل نقاط الولاء غير موجود')
      }

      if (loyalty.pendingCashRewards <= 0) {
        throw new Error('لا توجد مكافآت نقدية قيد الاستلام')
      }

      // تقليل المكافآت المعلقة
      await tx.memberLoyalty.update({
        where: { id: loyalty.id },
        data: { pendingCashRewards: { decrement: 1 } }
      })

      // إنشاء مصروف
      const expense = await tx.expense.create({
        data: {
          type: 'referral_cash_reward',
          amount: 1000,
          description: `مكافأة الإحالات النقدية - ${loyalty.member.name}`,
          notes: `إجمالي الإحالات: ${loyalty.referralCount}`,
          memberId: memberId,
          isPaid: false
        }
      })

      // تسجيل العملية في سجل النقاط
      await tx.loyaltyTransaction.create({
        data: {
          loyaltyId: loyalty.id,
          memberId: memberId,
          type: 'redeem',
          points: 0,
          source: 'referral_cash_redeemed',
          description: 'استلام مكافأة الإحالات النقدية - 1000 ج.م',
          staffName: user.name,
          metadata: JSON.stringify({ expenseId: expense.id })
        }
      })

      return {
        expense,
        remainingRewards: loyalty.pendingCashRewards - 1
      }
    })

    return NextResponse.json({
      success: true,
      ...result
    })

  } catch (error: any) {
    console.error('❌ خطأ في استلام المكافأة النقدية:', error)
    return NextResponse.json(
      { error: error.message || 'حدث خطأ' },
      { status: 500 }
    )
  }
}
