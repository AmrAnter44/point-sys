import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { awardGoalAchievement } from '@/lib/loyaltySystem'
import { getLanguageFromRequest } from '@/lib/languageHelper'

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

    const { memberId, goalType } = await req.json()

    if (!memberId || !goalType) {
      return NextResponse.json({
        error: 'البيانات المطلوبة: memberId, goalType'
      }, { status: 400 })
    }

    if (!['weight_loss', 'muscle_gain', 'strength'].includes(goalType)) {
      return NextResponse.json({
        error: 'goalType غير صالح'
      }, { status: 400 })
    }

    const language = getLanguageFromRequest(req)

    await awardGoalAchievement(
      memberId,
      goalType as 'weight_loss' | 'muscle_gain' | 'strength',
      user.name || 'System',
      language
    )

    return NextResponse.json({
      success: true,
      points: 500,
      goalType
    })

  } catch (error: any) {
    console.error('❌ خطأ في منح نقاط الهدف:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
