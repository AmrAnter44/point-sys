// app/api/loyalty/manual-points/route.ts
import { NextResponse } from 'next/server'
import { requirePermission } from '../../../../lib/auth'
import { earnPoints } from '../../../../lib/loyaltySystem'
import { verifyAuth } from '../../../../lib/auth'

export async function POST(request: Request) {
  try {
    // التحقق من صلاحية إدارة نقاط الولاء
    await requirePermission(request, 'canManageLoyaltyPoints')

    const body = await request.json()
    const { memberId, points, reason, staffName } = body

    // التحقق من البيانات المطلوبة
    if (!memberId) {
      return NextResponse.json(
        { error: 'معرف العضو مطلوب' },
        { status: 400 }
      )
    }

    if (!points || typeof points !== 'number') {
      return NextResponse.json(
        { error: 'عدد النقاط مطلوب ويجب أن يكون رقماً' },
        { status: 400 }
      )
    }

    if (points === 0) {
      return NextResponse.json(
        { error: 'عدد النقاط يجب أن يكون أكبر أو أصغر من صفر' },
        { status: 400 }
      )
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: 'السبب مطلوب' },
        { status: 400 }
      )
    }

    // الحصول على معلومات المستخدم الحالي
    const user = await verifyAuth(request)
    const actualStaffName = staffName || user?.name || 'Admin'

    // إضافة أو خصم النقاط
    const result = await earnPoints({
      memberId: memberId,
      points: points, // يمكن أن يكون موجب (إضافة) أو سالب (خصم)
      source: points > 0 ? 'manual_add' : 'manual_deduct',
      description: reason.trim(),
      staffName: actualStaffName
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || 'فشل تحديث النقاط' },
        { status: 400 }
      )
    }

    console.log(`✅ تم ${points > 0 ? 'إضافة' : 'خصم'} ${Math.abs(points)} نقطة ${points > 0 ? 'إلى' : 'من'} العضو بواسطة ${actualStaffName}`)
    console.log(`   السبب: ${reason.trim()}`)

    return NextResponse.json({
      success: true,
      message: `تم ${points > 0 ? 'إضافة' : 'خصم'} ${Math.abs(points)} نقطة بنجاح`,
      points: points,
      newBalance: result.newBalance,
      reason: reason.trim()
    })

  } catch (error: any) {
    console.error('❌ خطأ في إضافة النقاط يدوياً:', error)

    // التعامل مع أخطاء الصلاحيات
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إدارة نقاط الولاء' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل تحديث النقاط' },
      { status: 500 }
    )
  }
}
