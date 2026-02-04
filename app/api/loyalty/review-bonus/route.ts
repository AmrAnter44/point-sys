import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { awardReviewBonus } from '@/lib/loyaltySystem'
import { getLanguageFromRequest } from '@/lib/languageHelper'

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { memberId } = await req.json()

    if (!memberId) {
      return NextResponse.json({
        error: 'memberId مطلوب'
      }, { status: 400 })
    }

    const language = getLanguageFromRequest(req)

    await awardReviewBonus(memberId, user.name || 'System', language)

    return NextResponse.json({
      success: true,
      points: 250
    })

  } catch (error: any) {
    console.error('❌ خطأ في منح نقاط المراجعة:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
