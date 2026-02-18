// app/api/bar-income/route.ts
// Bar income tracking endpoint
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { getNextReceiptNumber } from '../../../lib/receiptNumberGenerator'

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'canAccessSettings')

    const body = await request.json()
    const { amount, note, date } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'المبلغ مطلوب ويجب أن يكون أكبر من صفر' }, { status: 400 })
    }

    const receiptNumber = await getNextReceiptNumber(prisma)

    // Create the bar income as a receipt with type 'Bar'
    const barDate = date ? new Date(date) : new Date()

    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        type: 'Bar',
        amount: parseFloat(amount),
        paymentMethod: 'cash',
        staffName: user.name || 'System',
        itemDetails: JSON.stringify({
          note: note || 'إيراد البار',
          date: barDate.toISOString().split('T')[0]
        }),
        createdAt: barDate
      }
    })

    return NextResponse.json({
      success: true,
      message: `تم تسجيل إيراد البار: ${amount} ج.م`,
      receipt
    })
  } catch (error: any) {
    console.error('Error creating bar income:', error)
    if (error.message === 'Unauthorized' || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    return NextResponse.json({ error: 'فشل تسجيل إيراد البار' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'canViewFinancials')

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // YYYY-MM

    let where: any = { type: 'Bar' }

    if (month) {
      const [year, mon] = month.split('-').map(Number)
      const start = new Date(year, mon - 1, 1)
      const end = new Date(year, mon, 0, 23, 59, 59)
      where.createdAt = { gte: start, lte: end }
    }

    const barReceipts = await prisma.receipt.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(barReceipts)
  } catch (error: any) {
    console.error('Error fetching bar income:', error)
    return NextResponse.json({ error: 'فشل جلب إيرادات البار' }, { status: 500 })
  }
}
