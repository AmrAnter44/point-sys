import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { awardUpgradePoints } from '@/lib/loyaltySystem'
import { getLanguageFromRequest } from '@/lib/languageHelper'

/**
 * POST /api/loyalty/upgrade
 * منح نقاط الترقية يدوياً (للاستخدام الاستثنائي)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    // TODO: Check permission canManageLoyaltyPoints
    // For now, allow ADMIN and MANAGER roles
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { memberId, oldOfferId, newOfferId } = await req.json()

    if (!memberId || !newOfferId) {
      return NextResponse.json({
        error: 'البيانات المطلوبة: memberId, newOfferId'
      }, { status: 400 })
    }

    const language = getLanguageFromRequest(req)

    const points = await awardUpgradePoints(
      memberId,
      oldOfferId || null,
      newOfferId,
      user.name || 'System',
      language
    )

    return NextResponse.json({
      success: true,
      points,
      message: `تم منح ${points} نقطة ترقية`
    })

  } catch (error: any) {
    console.error('❌ خطأ في منح نقاط الترقية:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
