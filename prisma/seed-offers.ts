import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedOffers() {
  console.log('🌱 بدء seed للعروض الأربعة الجديدة...')

  try {
    // 1. حذف العروض القديمة
    const deletedCount = await prisma.offer.deleteMany({})
    console.log(`✅ تم حذف ${deletedCount.count} عرض قديم`)

    // 2. إضافة العروض الجديدة
    const offers = [
      // Challenger (1 شهر)
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
        freezingDays: 0,
        icon: '🥉',
        isActive: true
      },
      // Fighter (3 أشهر)
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
        freezingDays: 15,
        icon: '🥊',
        isActive: true
      },
      // Champion (6 أشهر)
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
        freezingDays: 30,
        icon: '🏆',
        isActive: true
      },
      // Elite (سنوي)
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
        upgradeAllowedDays: 0,
        onboardingSessions: 1,
        followUpSessions: 4,
        groupClasses: 0,
        poolSessions: 999, // Unlimited
        paddleSessions: 8,
        freezingDays: 90,
        icon: '👑',
        isActive: true
      }
    ]

    // إضافة كل عرض
    for (const offer of offers) {
      const created = await prisma.offer.create({ data: offer })
      console.log(`✅ تم إضافة ${created.name} - ${created.price} ج.م`)
    }

    console.log('\n✅ تم seed العروض بنجاح!')
    console.log('\n📊 العروض المضافة:')
    console.log('  1. Challenger - 1,500 ج.م - 30 يوم')
    console.log('  2. Fighter - 3,800 ج.م - 90 يوم')
    console.log('  3. Champion - 6,000 ج.م - 180 يوم')
    console.log('  4. Elite - 7,500 ج.م - 365 يوم')

  } catch (error) {
    console.error('❌ خطأ في seed العروض:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedOffers()
  .then(() => {
    console.log('\n🎉 تم الانتهاء من seed بنجاح!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ فشل seed:', error)
    process.exit(1)
  })
