// app/api/member-checkin/checkout/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

// POST: تسجيل خروج عضو
export async function POST(request: Request) {
  try {
    const { memberId, checkInId } = await request.json()

    if (!memberId) {
      return NextResponse.json({ error: 'يجب توفير رقم العضو' }, { status: 400 })
    }

    const now = new Date()

    // إذا تم تحديد checkInId مباشرة
    if (checkInId) {
      const checkIn = await prisma.memberCheckIn.findUnique({ where: { id: checkInId } })
      if (!checkIn) {
        return NextResponse.json({ error: 'سجل الدخول غير موجود' }, { status: 404 })
      }
      if (checkIn.checkOutTime) {
        return NextResponse.json({ error: 'تم تسجيل الخروج مسبقاً' }, { status: 400 })
      }
      const updated = await prisma.memberCheckIn.update({
        where: { id: checkInId },
        data: { checkOutTime: now }
      })
      const durationMinutes = Math.round((now.getTime() - new Date(updated.checkInTime).getTime()) / 60000)
      return NextResponse.json({ success: true, checkOutTime: now, durationMinutes })
    }

    // البحث عن آخر دخول بدون خروج
    const lastCheckIn = await prisma.memberCheckIn.findFirst({
      where: {
        memberId,
        checkOutTime: null
      },
      orderBy: { checkInTime: 'desc' }
    })

    if (!lastCheckIn) {
      return NextResponse.json({ error: 'لا يوجد دخول مسجل بدون خروج' }, { status: 404 })
    }

    const updated = await prisma.memberCheckIn.update({
      where: { id: lastCheckIn.id },
      data: { checkOutTime: now }
    })

    const durationMinutes = Math.round((now.getTime() - new Date(lastCheckIn.checkInTime).getTime()) / 60000)

    return NextResponse.json({
      success: true,
      checkOutTime: now,
      checkInTime: lastCheckIn.checkInTime,
      durationMinutes
    })

  } catch (error) {
    console.error('خطأ في تسجيل الخروج:', error)
    return NextResponse.json({ error: 'فشل تسجيل الخروج' }, { status: 500 })
  }
}

// GET: جلب حالة الدخول الحالية
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'يجب توفير رقم العضو' }, { status: 400 })
    }

    const lastCheckIn = await prisma.memberCheckIn.findFirst({
      where: { memberId, checkOutTime: null },
      orderBy: { checkInTime: 'desc' }
    })

    return NextResponse.json({
      isCheckedIn: !!lastCheckIn,
      checkIn: lastCheckIn || null
    })
  } catch (error) {
    return NextResponse.json({ error: 'فشل جلب حالة الدخول' }, { status: 500 })
  }
}
