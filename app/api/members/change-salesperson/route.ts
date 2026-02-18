// app/api/members/change-salesperson/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export async function POST(request: Request) {
  try {
    const currentUser = await requirePermission(request, 'canEditMembers')

    const body = await request.json()
    const { memberId, newSalespersonId } = body

    if (!memberId) {
      return NextResponse.json({ error: 'معرف العضو مطلوب' }, { status: 400 })
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, referringCoachId: true }
    })

    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    // التحقق من الموظف الجديد إذا وُجد
    let newSalespersonName = 'بدون موظف مبيعات'
    if (newSalespersonId) {
      const staff = await prisma.staff.findUnique({
        where: { id: newSalespersonId },
        select: { id: true, name: true, position: true, isActive: true }
      })
      if (!staff) {
        return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 })
      }
      newSalespersonName = staff.name
    }

    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: { referringCoachId: newSalespersonId || null },
      include: {
        referringCoach: {
          select: { id: true, name: true, staffCode: true, position: true }
        }
      }
    })

    console.log(`✅ تم تغيير موظف المبيعات للعضو ${member.name} إلى ${newSalespersonName}`)

    return NextResponse.json({
      success: true,
      message: `تم تغيير موظف المبيعات إلى ${newSalespersonName}`,
      member: updatedMember
    })

  } catch (error: any) {
    console.error('❌ خطأ في تغيير موظف المبيعات:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل تغيير موظف المبيعات' }, { status: 500 })
  }
}
