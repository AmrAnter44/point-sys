import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

// POST - استبدال جميع العروض بالعروض الجديدة الأربعة
export async function POST(request: NextRequest) {
  try {
    // ✅ التحقق من صلاحية الإعدادات (الأدمن فقط)
    await requirePermission(request, 'canAccessSettings')

    console.log('🚀 بدء عملية استبدال العروض...')

    // 1. حذف جميع العروض القديمة
    const deletedCount = await prisma.offer.deleteMany({})
    console.log(`✅ تم حذف ${deletedCount.count} عرض قديم`)

    // 2. إضافة العروض الجديدة الأربعة
    const newOffers = await prisma.offer.createMany({
      data: [
        // العرض 1: Challenger (1 شهر)
        {
          name: 'Challenger',
          duration: 30,
          price: 1500,
          freePTSessions: 0,
          inBodyScans: 1,
          invitations: 1,
          movementAssessments: 1,
          nutritionSessions: 1,
          monthlyAttendanceGoal: 12,
          upgradeAllowedDays: 7,
          onboardingSessions: 1,
          followUpSessions: 0,
          groupClasses: 0,
          poolSessions: 0,
          paddleSessions: 0,
          medicalScreeningSessions: 0,
          freezingDays: 0,
          icon: '🥉',
          isActive: true
        },
        // العرض 2: Fighter (3 أشهر)
        {
          name: 'Fighter',
          duration: 90,
          price: 3800,
          freePTSessions: 0,
          inBodyScans: 3,
          invitations: 5,
          movementAssessments: 3,
          nutritionSessions: 3,
          monthlyAttendanceGoal: 15,
          upgradeAllowedDays: 30,
          onboardingSessions: 1,
          followUpSessions: 1,
          groupClasses: 0,
          poolSessions: 0,
          paddleSessions: 0,
          medicalScreeningSessions: 1,
          freezingDays: 15,
          icon: '🥊',
          isActive: true
        },
        // العرض 3: Champion (6 أشهر)
        {
          name: 'Champion',
          duration: 180,
          price: 6000,
          freePTSessions: 0,
          inBodyScans: 6,
          invitations: 10,
          movementAssessments: 6,
          nutritionSessions: 6,
          monthlyAttendanceGoal: 18,
          upgradeAllowedDays: 60,
          onboardingSessions: 1,
          followUpSessions: 2,
          groupClasses: 0,
          poolSessions: 6,
          paddleSessions: 2,
          medicalScreeningSessions: 2,
          freezingDays: 30,
          icon: '🏆',
          isActive: true
        },
        // العرض 4: Elite (سنوي)
        {
          name: 'Elite',
          duration: 365,
          price: 7500,
          freePTSessions: 0,
          inBodyScans: 12,
          invitations: 22,
          movementAssessments: 12,
          nutritionSessions: 12,
          monthlyAttendanceGoal: 20,
          upgradeAllowedDays: 0, // أعلى مستوى - لا يمكن الترقية
          onboardingSessions: 1,
          followUpSessions: 4,
          groupClasses: 0,
          poolSessions: 999, // Unlimited
          paddleSessions: 8,
          medicalScreeningSessions: 4,
          freezingDays: 90,
          icon: '👑',
          isActive: true
        }
      ]
    })

    console.log(`✅ تم إضافة ${newOffers.count} عرض جديد`)

    // 3. جلب العروض الجديدة للتأكيد
    const offers = await prisma.offer.findMany({
      orderBy: { duration: 'asc' }
    })

    console.log('✅✅✅ تم استبدال العروض بنجاح!')
    console.log('📊 العروض الجديدة:')
    offers.forEach(offer => {
      console.log(`  • ${offer.name} - ${offer.price} ج.م - ${offer.duration} يوم`)
    })

    return NextResponse.json({
      success: true,
      message: `✅ تم استبدال العروض بنجاح! تم حذف ${deletedCount.count} عرض قديم وإضافة ${newOffers.count} عرض جديد.`,
      deletedCount: deletedCount.count,
      addedCount: newOffers.count,
      offers
    })

  } catch (error: any) {
    console.error('❌ خطأ في استبدال العروض:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إدارة العروض' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        error: 'فشل استبدال العروض',
        details: error.message
      },
      { status: 500 }
    )
  }
}
