import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { recordSessionAttendance } from '../../../lib/loyaltySystem'
import { getLanguageFromRequest } from '../../../lib/languageHelper'

// GET - جلب سجلات استخدام حصص العلاج الطبيعي المجانية مع فلاتر
export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'canViewPhysio')


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

    const sessions = await prisma.freePhysiotherapySessionUsage.findMany({
      where,
      orderBy: { usedAt: 'desc' }
    })

    return NextResponse.json(sessions)
  } catch (error: any) {
    console.error('Error fetching free physiotherapy sessions:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب السجلات' },
      { status: 500 }
    )
  }
}

// POST - تسجيل استخدام حصة علاج طبيعي مجانية
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'canCreatePhysio')

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
    if (member.physiotherapySessions <= 0) {
      return NextResponse.json(
        { error: 'لا توجد حصص علاج طبيعي مجانية متاحة لهذا العضو' },
        { status: 400 }
      )
    }

    // تسجيل الاستخدام
    const usage = await prisma.freePhysiotherapySessionUsage.create({
      data: {
        memberId: member.id,
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
        physiotherapySessions: member.physiotherapySessions - 1
      }
    })

    // منح 25 نقطة ولاء تلقائياً
    const language = getLanguageFromRequest(request)
    await recordSessionAttendance(
      memberId,
      'physio',
      user.name,
      language
    )

    console.log(`✅ تم منح 25 نقطة لـ ${member.name} عند استخدام حصة علاج طبيعي`)

    return NextResponse.json({
      success: true,
      usage,
      remainingSessions: member.physiotherapySessions - 1
    })
  } catch (error: any) {
    console.error('Error recording physiotherapy session usage:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء تسجيل الحصة' },
      { status: 500 }
    )
  }
}
