import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إلغاء الإيصالات
    const user = await requirePermission(request, 'canEditReceipts')

    const body = await request.json()
    const { receiptId, reason } = body

    if (!receiptId) {
      return NextResponse.json(
        { error: 'معرف الإيصال مطلوب' },
        { status: 400 }
      )
    }

    // جلب الإيصال للتأكد من وجوده
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId }
    })

    if (!receipt) {
      return NextResponse.json(
        { error: 'الإيصال غير موجود' },
        { status: 404 }
      )
    }

    if (receipt.isCancelled) {
      return NextResponse.json(
        { error: 'هذا الإيصال ملغي بالفعل' },
        { status: 400 }
      )
    }

    // ✅ إلغاء الإيصال
    const cancelledReceipt = await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledBy: user.name,
        cancellationReason: reason || 'لا يوجد سبب محدد'
      }
    })

    // ✅ إنشاء مصروف بنفس المبلغ برقم الإيصال الملغي
    const expense = await prisma.expense.create({
      data: {
        type: 'إلغاء إيصال',
        description: `إلغاء إيصال #${receipt.receiptNumber} - ${receipt.type}`,
        amount: receipt.amount,
        notes: `تم إلغاء الإيصال رقم ${receipt.receiptNumber}. السبب: ${reason || 'لا يوجد سبب محدد'}`
      }
    })

    console.log(`✅ تم إلغاء الإيصال #${receipt.receiptNumber} وإنشاء مصروف #${expense.id}`)

    return NextResponse.json({
      success: true,
      receipt: cancelledReceipt,
      expense: expense,
      message: `تم إلغاء الإيصال #${receipt.receiptNumber} بنجاح وتسجيل المصروف`
    })

  } catch (error: any) {
    console.error('❌ خطأ في إلغاء الإيصال:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إلغاء الإيصالات' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل إلغاء الإيصال: ' + error.message },
      { status: 500 }
    )
  }
}
