// app/api/members/change-coach/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { logActivity, ACTIONS, RESOURCES } from '../../../../lib/activityLog'

export async function POST(request: Request) {
  try {
    // التحقق من صلاحية تعديل الأعضاء
    const currentUser = await requirePermission(request, 'canEditMembers')

    const body = await request.json()
    const { memberId, newCoachId, reason } = body

    // التحقق من البيانات المطلوبة
    if (!memberId) {
      return NextResponse.json(
        { error: 'معرف العضو مطلوب' },
        { status: 400 }
      )
    }

    // التحقق من وجود العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        assignedCoach: {
          select: {
            id: true,
            name: true,
            staffCode: true
          }
        }
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      )
    }

    const oldCoachId = member.assignedCoachId
    const oldCoachName = member.assignedCoach?.name || 'بدون مدرب'

    // إذا كان newCoachId = null، نزيل المدرب
    let newCoachName = 'تم إزالة المدرب'
    if (newCoachId) {
      // التحقق من وجود المدرب الجديد
      const newCoach = await prisma.staff.findUnique({
        where: { id: newCoachId },
        select: {
          id: true,
          name: true,
          position: true,
          isActive: true
        }
      })

      if (!newCoach) {
        return NextResponse.json(
          { error: 'المدرب الجديد غير موجود' },
          { status: 404 }
        )
      }

      if (!newCoach.position?.includes('مدرب')) {
        return NextResponse.json(
          { error: 'الموظف المحدد ليس مدرباً' },
          { status: 400 }
        )
      }

      newCoachName = newCoach.name
    }

    // تحديث المدرب المعين للعضو
    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        assignedCoachId: newCoachId || null
      },
      include: {
        assignedCoach: {
          select: {
            id: true,
            name: true,
            staffCode: true
          }
        }
      }
    })

    // تحديث العمولات الشهرية MRCB المستقبلية (pending فقط)
    // العمولات السابقة تبقى كما هي للمدرب القديم
    if (newCoachId && oldCoachId && oldCoachId !== newCoachId) {
      const currentMonth = new Date().toISOString().slice(0, 7) // "YYYY-MM"

      // تحديث عمولات MRCB المعلقة (pending) فقط من الشهر الحالي فصاعداً
      const updatedCommissions = await prisma.coachCommission.updateMany({
        where: {
          memberId: memberId,
          coachId: oldCoachId,
          type: { startsWith: 'mrcb_' },
          status: 'pending',
          month: { gte: currentMonth }
        },
        data: {
          coachId: newCoachId
        }
      })

      console.log(`✅ تم تحويل ${updatedCommissions.count} عمولة شهرية من ${oldCoachName} إلى ${newCoachName}`)
    }

    // 📋 تسجيل النشاط
    logActivity({
      userId: currentUser.userId,
      action: ACTIONS.CHANGE_COACH,
      resource: RESOURCES.MEMBER,
      resourceId: memberId,
      details: JSON.stringify({
        memberName: member.name,
        oldCoach: oldCoachName,
        newCoach: newCoachName,
        reason: reason || ''
      })
    })

    return NextResponse.json({
      success: true,
      message: `تم تغيير المدرب بنجاح من ${oldCoachName} إلى ${newCoachName}`,
      member: updatedMember,
      details: {
        oldCoach: oldCoachName,
        newCoach: newCoachName
      }
    })

  } catch (error: any) {
    console.error('❌ خطأ في تغيير المدرب:', error)

    // التعامل مع أخطاء الصلاحيات
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل الأعضاء' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل تغيير المدرب' },
      { status: 500 }
    )
  }
}
