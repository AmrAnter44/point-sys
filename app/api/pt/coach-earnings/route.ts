import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'canViewPT')

    // الحصول على جميع المدربين
    const coaches = await prisma.staff.findMany({
      where: {
        position: { contains: 'مدرب' },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            assignedMembers: true // عدد الأعضاء المعينين
          }
        }
      }
    })

    // حساب العمولات (200 ج.م لكل عضو)
    const coachEarnings = coaches.map(coach => ({
      coachId: coach.id,
      coachName: coach.name,
      memberCount: coach._count.assignedMembers,
      totalEarnings: coach._count.assignedMembers * 200
    }))

    const grandTotal = coachEarnings.reduce((sum, c) => sum + c.totalEarnings, 0)

    return NextResponse.json({
      coachEarnings,
      grandTotal
    })

  } catch (error: any) {
    console.error('❌ خطأ في جلب عمولات المدربين:', error)
    return NextResponse.json(
      { error: error.message || 'حدث خطأ' },
      { status: 500 }
    )
  }
}
