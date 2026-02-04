// app/api/fix-staff-names/route.ts
// Fix staff names in old receipts

import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export async function POST(request: Request) {
  try {
    console.log('🔧 تصحيح أسماء الموظفين في الإيصالات القديمة...')

    // Update receipts with "عنتر ريسبشين" to "anter res"
    const result = await prisma.receipt.updateMany({
      where: {
        staffName: 'عنتر ريسبشين'
      },
      data: {
        staffName: 'anter res'
      }
    })

    console.log(`✅ تم تحديث ${result.count} إيصال`)

    return NextResponse.json({
      success: true,
      message: `تم تحديث ${result.count} إيصال بنجاح`,
      count: result.count
    })

  } catch (error: any) {
    console.error('❌ خطأ في التصحيح:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fix staff names' },
      { status: 500 }
    )
  }
}
