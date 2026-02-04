import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { recordSessionAttendance } from '../../../../lib/loyaltySystem'
import { getLanguageFromRequest } from '../../../../lib/languageHelper'

// ==================== POST - Record session usage ====================

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'canCreateDayUse')

    const body = await request.json()
    const { packageId, notes, staffName } = body

    // Validation
    if (!packageId) {
      return NextResponse.json(
        { error: 'معرف الباقة مطلوب' },
        { status: 400 }
      )
    }

    // Fetch package
    const physioPackage = await prisma.physiotherapyPackage.findUnique({
      where: { id: packageId }
    })

    if (!physioPackage) {
      return NextResponse.json({ error: 'الباقة غير موجودة' }, { status: 404 })
    }

    // Check if sessions remain
    if (physioPackage.sessionsUsed >= physioPackage.sessionsPurchased) {
      return NextResponse.json(
        { error: 'لا توجد جلسات متبقية في هذه الباقة' },
        { status: 400 }
      )
    }

    // Create session record
    await prisma.physiotherapySession.create({
      data: {
        packageId,
        clientName: physioPackage.clientName,
        sessionDate: new Date(),
        notes: notes || null,
        staffName: staffName || null,
      },
    })

    // Update package sessions used
    await prisma.physiotherapyPackage.update({
      where: { id: packageId },
      data: {
        sessionsUsed: { increment: 1 },
      },
    })

    // منح 25 نقطة ولاء إذا كان العميل عضواً
    if (physioPackage.memberId) {
      try {
        const language = getLanguageFromRequest(request)
        await recordSessionAttendance(
          physioPackage.memberId,
          'physio',
          staffName || 'System',
          language
        )
        console.log(`✅ تم منح 25 نقطة لـ ${physioPackage.clientName} عند حضور جلسة علاج طبيعي`)
      } catch (error) {
        console.error('Error awarding physio session points:', error)
        // لا نوقف العملية إذا فشلت النقاط
      }
    }

    return NextResponse.json({ message: 'تم تسجيل الجلسة بنجاح' })
  } catch (error: any) {
    console.error('Error recording session:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'فشل تسجيل الجلسة' },
      { status: 500 }
    )
  }
}
