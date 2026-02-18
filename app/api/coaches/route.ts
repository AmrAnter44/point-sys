// app/api/coaches/route.ts
// Returns coaches list - accessible to any logged-in user (needed for member creation)
import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth } from '../../../lib/auth'

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    const coaches = await prisma.staff.findMany({
      where: {
        position: { contains: 'مدرب' }
      },
      select: {
        id: true,
        name: true,
        phone: true,
        position: true,
        staffCode: true,
        isActive: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(coaches)
  } catch (error: any) {
    console.error('Error fetching coaches:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    return NextResponse.json({ error: 'فشل جلب المدربين' }, { status: 500 })
  }
}
