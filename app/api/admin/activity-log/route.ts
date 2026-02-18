import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'canViewMembers')

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const userId = searchParams.get('userId') || undefined
    const action = searchParams.get('action') || undefined
    const resource = searchParams.get('resource') || undefined
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {}

    if (userId) where.userId = userId
    if (action) where.action = action
    if (resource) where.resource = resource

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, role: true }
          }
        }
      }),
      prisma.activityLog.count({ where })
    ])

    // جلب كل المستخدمين للفلتر
    const users = await prisma.user.findMany({
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      users
    })

  } catch (error: any) {
    console.error('Error fetching activity logs:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    return NextResponse.json({ error: 'فشل جلب السجل' }, { status: 500 })
  }
}
