import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { recordSessionAttendance } from '../../../../lib/loyaltySystem'
import { getLanguageFromRequest } from '../../../../lib/languageHelper'

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'canCreateDayUse')
    const body = await request.json()
    const { packageId, weight, bodyFat, muscleMass, measurements, notes, staffName } = body

    if (!packageId) {
      return NextResponse.json({ error: 'معرف الباقة مطلوب' }, { status: 400 })
    }

    const nutritionPackage = await prisma.nutritionPackage.findUnique({ where: { id: packageId } })
    if (!nutritionPackage) {
      return NextResponse.json({ error: 'الباقة غير موجودة' }, { status: 404 })
    }

    if (nutritionPackage.followUpsUsed >= nutritionPackage.followUpsIncluded) {
      return NextResponse.json({ error: 'لا توجد متابعات متبقية' }, { status: 400 })
    }

    await prisma.nutritionFollowUp.create({
      data: {
        packageId,
        clientName: nutritionPackage.clientName,
        followUpDate: new Date(),
        weight: weight || null,
        bodyFat: bodyFat || null,
        muscleMass: muscleMass || null,
        measurements: measurements ? JSON.stringify(measurements) : null,
        notes: notes || null,
        staffName: staffName || null,
      },
    })

    await prisma.nutritionPackage.update({
      where: { id: packageId },
      data: { followUpsUsed: { increment: 1 } },
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

    return NextResponse.json({ message: 'تم تسجيل المتابعة بنجاح' })
  } catch (error: any) {
    console.error('Error recording follow-up:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message || 'فشل تسجيل المتابعة' }, { status: 500 })
  }
}
