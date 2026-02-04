import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'memberId مطلوب' }, { status: 400 })
    }

    const loyalty = await prisma.memberLoyalty.findUnique({
      where: { memberId }
    })

    if (!loyalty) {
      return NextResponse.json(null)
    }

    return NextResponse.json(loyalty)
  } catch (error: any) {
    console.error('❌ خطأ في جلب بيانات النقاط:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
