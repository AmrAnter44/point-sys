import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { earnPoints, calculatePurchasePoints } from '../../../../lib/loyaltySystem'
import { triggerLicenseCheckAfterReceipt } from '../../../../lib/licenseCheckHelper'

export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية تعديل الأعضاء (لأن دفع المتبقي يعدل بيانات العضو)
    const user = await requirePermission(request, 'canEditMembers')

    // ⭐ الحصول على معلومات الموظف
    const staffName = user.name || 'System'

    const { memberId, amount, paymentMethod, notes } = await request.json()

    if (!memberId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 })
    }

    // جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    // جلب رقم الإيصال التالي
    const lastReceipt = await prisma.receipt.findFirst({
      orderBy: { receiptNumber: 'desc' }
    })

    const receiptNumber = lastReceipt ? lastReceipt.receiptNumber + 1 : 1000

    // تفاصيل الإيصال
    const itemDetails = {
      memberNumber: member.memberNumber,
      memberName: member.name,
      paidAmount: amount,
      remainingAmount: member.remainingAmount - amount,
      paymentMethod: paymentMethod || 'cash',
      notes: notes || ''
    }

    // إنشاء الإيصال
    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        type: 'Payment', // نوع جديد: دفع متبقي
        amount,
        itemDetails: JSON.stringify(itemDetails),
        paymentMethod: paymentMethod || 'cash',
        memberId,
        staffName // ⭐ إضافة اسم الموظف
      }
    })

    // 🔒 فحص الترخيص بعد إنشاء الإيصال
    triggerLicenseCheckAfterReceipt()

    // ⭐ خصم المبلغ من remainingAmount
    await prisma.member.update({
      where: { id: memberId },
      data: {
        remainingAmount: {
          decrement: amount
        }
      }
    })

    // ⭐ منح نقاط الدفع
    if (amount > 0) {
      try {
        const paymentPoints = calculatePurchasePoints(amount)

        if (paymentPoints > 0) {
          await earnPoints({
            memberId,
            points: paymentPoints,
            source: 'purchase',
            description: `نقاط دفع جزئي: ${amount.toFixed(2)} ج.م`,
            receiptId: receipt.id
          })
          console.log(`⭐ تم منح ${paymentPoints} نقطة دفع للعضو`)
        }
      } catch (loyaltyError) {
        console.error('⚠️ خطأ في منح نقاط الدفع (غير حرج):', loyaltyError)
      }
    }

    return NextResponse.json(receipt)
  } catch (error: any) {
    console.error('Error creating payment receipt:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إنشاء إيصالات الدفع' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'فشل إنشاء الإيصال' },
      { status: 500 }
    )
  }
}