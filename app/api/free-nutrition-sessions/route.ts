import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'

// GET - جلب سجلات استخدام حصص التغذية المجانية مع فلاتر
export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'canViewNutrition')

    const searchParams = request.nextUrl.searchParams
    const memberId = searchParams.get('memberId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const searchQuery = searchParams.get('search')

    // بناء الـ where clause
    const where: any = {}

    if (memberId) {
      where.memberId = memberId
    }

    if (startDate || endDate) {
      where.usedAt = {}
      if (startDate) {
        where.usedAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.usedAt.lte = end
      }
    }

    if (searchQuery) {
      where.OR = [
        { memberName: { contains: searchQuery, mode: 'insensitive' } },
        { memberPhone: { contains: searchQuery, mode: 'insensitive' } },
        { memberId: { contains: searchQuery, mode: 'insensitive' } }
      ]
    }

    const sessions = await prisma.freeNutritionSessionUsage.findMany({
      where,
      orderBy: { usedAt: 'desc' }
    })

    return NextResponse.json(sessions)
  } catch (error: any) {
    console.error('Error fetching free nutrition sessions:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب السجلات' },
      { status: 500 }
    )
  }
}

// POST - تسجيل استخدام حصة تغذية مجانية
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'canCreateNutrition')

    const body = await request.json()
    const { memberId, notes } = body

    if (!memberId) {
      return NextResponse.json(
        { error: 'يرجى تحديد العضو' },
        { status: 400 }
      )
    }

    // جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      )
    }

    // التحقق من وجود حصص متاحة
    if (member.nutritionSessions <= 0) {
      return NextResponse.json(
        { error: 'لا توجد حصص تغذية مجانية متاحة لهذا العضو' },
        { status: 400 }
      )
    }

    // تسجيل الاستخدام
    const usage = await prisma.freeNutritionSessionUsage.create({
      data: {
        memberId: member.id,
        memberNumber: member.memberNumber || null,
        memberName: member.name,
        memberPhone: member.phone,
        staffName: user.name,
        notes: notes || null
      }
    })

    // تقليل عدد الحصص المتبقية
    await prisma.member.update({
      where: { id: memberId },
      data: {
        nutritionSessions: member.nutritionSessions - 1
      }
    })

    return NextResponse.json({
      success: true,
      usage,
      remainingSessions: member.nutritionSessions - 1
    })
  } catch (error: any) {
    console.error('Error recording nutrition session usage:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء تسجيل الحصة' },
      { status: 500 }
    )
  }
}
