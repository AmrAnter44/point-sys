import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'

// GET - جلب كل العروض
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const offers = await prisma.offer.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { duration: 'asc' }
    })

    return NextResponse.json(offers)
  } catch (error) {
    console.error('Error fetching offers:', error)
    // إرجاع array فارغ في حالة الخطأ بدلاً من object
    return NextResponse.json([], { status: 500 })
  }
}

// POST - إنشاء عرض جديد
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية الإعدادات (الأدمن فقط)
    await requirePermission(request, 'canAccessSettings')

    const body = await request.json()
    const {
      name,
      duration,
      price,
      freePTSessions,
      inBodyScans,
      invitations,
      movementAssessments,
      nutritionSessions,
      monthlyAttendanceGoal,
      upgradeAllowedDays,
      onboardingSessions,
      followUpSessions,
      groupClasses,
      poolSessions,
      paddleSessions,
      freezingDays,
      attendanceLimit,
      icon
    } = body

    // التحقق من البيانات المطلوبة
    if (!name || !duration || price === undefined) {
      return NextResponse.json(
        { error: 'الاسم والمدة والسعر مطلوبة' },
        { status: 400 }
      )
    }

    const offer = await prisma.offer.create({
      data: {
        name,
        duration: parseInt(duration),
        price: parseFloat(price),
        freePTSessions: parseInt(freePTSessions) || 0,
        inBodyScans: parseInt(inBodyScans) || 0,
        invitations: parseInt(invitations) || 0,
        movementAssessments: parseInt(movementAssessments) || 0,
        nutritionSessions: parseInt(nutritionSessions) || 0,
        monthlyAttendanceGoal: parseInt(monthlyAttendanceGoal) || 0,
        upgradeAllowedDays: parseInt(upgradeAllowedDays) || 0,
        onboardingSessions: parseInt(onboardingSessions) || 0,
        followUpSessions: parseInt(followUpSessions) || 0,
        groupClasses: parseInt(groupClasses) || 0,
        poolSessions: parseInt(poolSessions) || 0,
        paddleSessions: parseInt(paddleSessions) || 0,
        freezingDays: parseInt(freezingDays) || 0,
        attendanceLimit: parseInt(attendanceLimit) || 0,
        icon: icon || '📅'
      }
    })

    return NextResponse.json(offer, { status: 201 })
  } catch (error: any) {
    console.error('Error creating offer:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إدارة العروض' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل إنشاء العرض' }, { status: 500 })
  }
}

// PUT - تحديث العرض
export async function PUT(request: Request) {
  try {
    // ✅ التحقق من صلاحية الإعدادات (الأدمن فقط)
    await requirePermission(request, 'canAccessSettings')

    const body = await request.json()
    const {
      id,
      name,
      duration,
      price,
      freePTSessions,
      inBodyScans,
      invitations,
      movementAssessments,
      nutritionSessions,
      monthlyAttendanceGoal,
      upgradeAllowedDays,
      onboardingSessions,
      followUpSessions,
      groupClasses,
      poolSessions,
      paddleSessions,
      freezingDays,
      attendanceLimit,
      icon
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'معرف العرض مطلوب' },
        { status: 400 }
      )
    }

    // إنشاء object للبيانات المراد تحديثها
    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (duration !== undefined) updateData.duration = parseInt(duration)
    if (price !== undefined) updateData.price = parseFloat(price)
    if (freePTSessions !== undefined) updateData.freePTSessions = parseInt(freePTSessions)
    if (inBodyScans !== undefined) updateData.inBodyScans = parseInt(inBodyScans)
    if (invitations !== undefined) updateData.invitations = parseInt(invitations)
    if (movementAssessments !== undefined) updateData.movementAssessments = parseInt(movementAssessments)
    if (nutritionSessions !== undefined) updateData.nutritionSessions = parseInt(nutritionSessions)
    if (monthlyAttendanceGoal !== undefined) updateData.monthlyAttendanceGoal = parseInt(monthlyAttendanceGoal)
    if (upgradeAllowedDays !== undefined) updateData.upgradeAllowedDays = parseInt(upgradeAllowedDays)
    if (onboardingSessions !== undefined) updateData.onboardingSessions = parseInt(onboardingSessions)
    if (followUpSessions !== undefined) updateData.followUpSessions = parseInt(followUpSessions)
    if (groupClasses !== undefined) updateData.groupClasses = parseInt(groupClasses)
    if (poolSessions !== undefined) updateData.poolSessions = parseInt(poolSessions)
    if (paddleSessions !== undefined) updateData.paddleSessions = parseInt(paddleSessions)
    if (freezingDays !== undefined) updateData.freezingDays = parseInt(freezingDays)
    if (attendanceLimit !== undefined) updateData.attendanceLimit = parseInt(attendanceLimit)
    if (icon !== undefined) updateData.icon = icon

    const offer = await prisma.offer.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(offer)
  } catch (error: any) {
    console.error('Error updating offer:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إدارة العروض' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل تحديث العرض' }, { status: 500 })
  }
}

// DELETE - حذف عرض
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من صلاحية الإعدادات (الأدمن فقط)
    await requirePermission(request, 'canAccessSettings')

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'معرف العرض مطلوب' },
        { status: 400 }
      )
    }

    await prisma.offer.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'تم حذف العرض بنجاح' })
  } catch (error: any) {
    console.error('Error deleting offer:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إدارة العروض' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل حذف العرض' }, { status: 500 })
  }
}
