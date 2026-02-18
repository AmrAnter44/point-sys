import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { logActivity, ACTIONS, RESOURCES } from '../../../../lib/activityLog'

// PATCH - تسوية كوميشنات كوتش لشهر معين (تحديد "تم الصرف")
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requirePermission(request, 'canViewMembers')

    const body = await request.json()
    const { coachId, month, coachName } = body

    if (!coachId || !month) {
      return NextResponse.json(
        { error: 'coachId و month مطلوبان' },
        { status: 400 }
      )
    }

    const now = new Date()

    // تحديث كل الكوميشنات لهذا الكوتش في هذا الشهر
    const result = await prisma.coachCommission.updateMany({
      where: {
        coachId,
        month,
        status: { not: 'paid' }
      },
      data: {
        status: 'paid',
        paidAt: now,
      }
    })

    // 📋 تسجيل النشاط
    logActivity({
      userId: currentUser.userId,
      action: ACTIONS.SETTLE_COMMISSION,
      resource: RESOURCES.COMMISSION,
      resourceId: coachId,
      details: JSON.stringify({
        coachName: coachName || coachId,
        month,
        count: result.count
      })
    })

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      coachId,
      month,
      paidAt: now,
      message: `تم تسوية ${result.count} عمولة للكوتش`
    })

  } catch (error: any) {
    console.error('Error settling commissions:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    return NextResponse.json({ error: 'فشل تسوية الكوميشنات' }, { status: 500 })
  }
}

// GET - جلب حالة التسوية لشهر معين
export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'canViewMembers')

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')

    if (!month) {
      return NextResponse.json({ error: 'month مطلوب' }, { status: 400 })
    }

    // جلب الكوتشات اللي اتسووا في هذا الشهر
    const settledCoaches = await prisma.coachCommission.groupBy({
      by: ['coachId'],
      where: {
        month,
        status: 'paid'
      },
      _max: { paidAt: true },
      _count: { id: true }
    })

    const settledMap: Record<string, { paidAt: Date | null; count: number }> = {}
    for (const item of settledCoaches) {
      settledMap[item.coachId] = {
        paidAt: item._max.paidAt,
        count: item._count.id
      }
    }

    return NextResponse.json({ settled: settledMap })

  } catch (error: any) {
    console.error('Error fetching settlement status:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    return NextResponse.json({ error: 'فشل جلب حالة التسوية' }, { status: 500 })
  }
}
