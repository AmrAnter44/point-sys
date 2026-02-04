import { NextResponse } from 'next/server'
import { calculateUpgradePrice } from '../../../../../lib/upgradeValidation'

// POST - حساب سعر الترقية مع خصم الحضور (بدون تنفيذ الترقية)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { memberId, currentOfferId, newOfferId, startDate } = body

    if (!memberId || !currentOfferId || !newOfferId) {
      return NextResponse.json(
        { error: 'البيانات المطلوبة ناقصة' },
        { status: 400 }
      )
    }

    // حساب سعر الترقية مع خصم الحضور
    const priceDetails = await calculateUpgradePrice(
      currentOfferId,
      newOfferId,
      memberId,
      startDate ? new Date(startDate) : undefined
    )

    return NextResponse.json({
      upgradePrice: priceDetails.upgradePrice,
      oldOfferPrice: priceDetails.oldOfferPrice,
      newOfferPrice: priceDetails.newOfferPrice,
      attendanceDiscount: priceDetails.attendanceDiscount || 0,
      attendanceEligibility: priceDetails.attendanceEligibility
    })

  } catch (error: any) {
    console.error('خطأ في حساب سعر الترقية:', error)
    return NextResponse.json(
      { error: error.message || 'فشل حساب سعر الترقية' },
      { status: 500 }
    )
  }
}
