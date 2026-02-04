import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { recordSessionAttendance } from '../../../../lib/loyaltySystem'
import { getLanguageFromRequest } from '../../../../lib/languageHelper'

// ==================== POST - Record nutrition session usage ====================

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
    const nutritionPackage = await prisma.nutritionPackage.findUnique({
      where: { id: packageId }
    })

    if (!nutritionPackage) {
      return NextResponse.json({ error: 'الباقة غير موجودة' }, { status: 404 })
    }

    // Check if follow-ups remain
    if (nutritionPackage.followUpsUsed >= nutritionPackage.followUpsIncluded) {
      return NextResponse.json(
        { error: 'لا توجد متابعات متبقية في هذه الباقة' },
        { status: 400 }
      )
    }

    // Create follow-up record
    await prisma.nutritionFollowUp.create({
      data: {
        packageId,
        clientName: nutritionPackage.clientName,
        followUpDate: new Date(),
        notes: notes || null,
        staffName: staffName || null,
      },
    })

    // Update package follow-ups used
    await prisma.nutritionPackage.update({
      where: { id: packageId },
      data: {
        followUpsUsed: { increment: 1 },
      },
    })

    // منح 25 نقطة ولاء إذا كان العميل عضواً
    if (nutritionPackage.memberId) {
      try {
        const language = getLanguageFromRequest(request)
        await recordSessionAttendance(
          nutritionPackage.memberId,
          'nutrition',
          staffName || 'System',
          language
        )
        console.log(`✅ تم منح 25 نقطة لـ ${nutritionPackage.clientName} عند حضور جلسة تغذية`)
      } catch (error) {
        console.error('Error awarding nutrition session points:', error)
        // لا نوقف العملية إذا فشلت النقاط
      }
    }

    return NextResponse.json({ message: 'تم تسجيل الجلسة بنجاح' })
  } catch (error: any) {
    console.error('Error recording nutrition session:', error)

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
