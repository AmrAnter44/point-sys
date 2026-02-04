import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { recordSessionAttendance } from '@/lib/loyaltySystem'
import { getLanguageFromRequest } from '@/lib/languageHelper'

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { memberId, sessionType } = await req.json()

    if (!memberId || !sessionType) {
      return NextResponse.json({
        error: 'البيانات المطلوبة: memberId, sessionType'
      }, { status: 400 })
    }

    if (!['nutrition', 'physio', 'pt'].includes(sessionType)) {
      return NextResponse.json({
        error: 'sessionType غير صالح'
      }, { status: 400 })
    }

    const language = getLanguageFromRequest(req)

    await recordSessionAttendance(
      memberId,
      sessionType as 'nutrition' | 'physio' | 'pt',
      user.name || 'System',
      language
    )

    return NextResponse.json({
      success: true,
      points: 25,
      sessionType
    })

  } catch (error: any) {
    console.error('❌ خطأ في تسجيل حضور الجلسة:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
