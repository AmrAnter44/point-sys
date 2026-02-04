const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  حذف جميع العروض القديمة...')

  // حذف جميع العروض القديمة
  await prisma.offer.deleteMany({})
  console.log('✅ تم حذف جميع العروض القديمة')

  console.log('\n📦 إضافة الباقات الأربعة الجديدة...\n')

  // 1. Challenger - شهر واحد
  const challenger = await prisma.offer.create({
    data: {
      name: '🥊 Challenger',
      duration: 30, // شهر واحد
      price: 1500,
      freePTSessions: 0, // لا توجد جلسات PT مجانية
      inBodyScans: 1,
      invitations: 1, // دعوة واحدة فقط
      movementAssessments: 1,
      nutritionSessions: 1,
      monthlyAttendanceGoal: 12,
      upgradeAllowedDays: 7, // مسموح بالترقية خلال أول 7 أيام
      onboardingSessions: 1, // جلسة تعريف واحدة
      followUpSessions: 0,
      groupClasses: 0, // غير متاحة
      poolSessions: 0, // غير متاح
      paddleSessions: 0, // غير متاح
      freezingDays: 0, // غير متاحة
      icon: '🥊',
      isActive: true
    }
  })
  console.log('✅ تم إضافة باقة Challenger:', challenger.name)

  // 2. Fighter - 3 شهور
  const fighter = await prisma.offer.create({
    data: {
      name: '🥊 Fighter',
      duration: 90, // 3 شهور
      price: 3800,
      freePTSessions: 0, // لا توجد جلسات PT مجانية
      inBodyScans: 3,
      invitations: 5, // 5 دعوات
      movementAssessments: 3,
      nutritionSessions: 3,
      monthlyAttendanceGoal: 15,
      upgradeAllowedDays: 30, // مسموح خلال أول شهر
      onboardingSessions: 1, // جلسة تعريف
      followUpSessions: 1, // جلسة متابعة
      groupClasses: 6, // 6 حصص
      poolSessions: 0, // غير متاح
      paddleSessions: 0, // غير متاح
      freezingDays: 15, // 15 يوم
      icon: '🥊',
      isActive: true
    }
  })
  console.log('✅ تم إضافة باقة Fighter:', fighter.name)

  // 3. Champion - 6 شهور
  const champion = await prisma.offer.create({
    data: {
      name: '🥊 Champion',
      duration: 180, // 6 شهور
      price: 6000,
      freePTSessions: 0, // لا توجد جلسات PT مجانية
      inBodyScans: 6,
      invitations: 10, // 10 دعوات
      movementAssessments: 6,
      nutritionSessions: 6,
      monthlyAttendanceGoal: 18,
      upgradeAllowedDays: 60, // مسموح خلال أول شهرين
      onboardingSessions: 1, // جلسة تعريف
      followUpSessions: 2, // 2 جلسات متابعة
      groupClasses: 18, // 18 حصة
      poolSessions: 6, // 6 جلسات مسبح
      paddleSessions: 2, // 2 بادل
      freezingDays: 30, // 30 يوم
      icon: '🥊',
      isActive: true
    }
  })
  console.log('✅ تم إضافة باقة Champion:', champion.name)

  // 4. Elite - سنوي
  const elite = await prisma.offer.create({
    data: {
      name: '🏆 Elite',
      duration: 365, // سنة
      price: 7500,
      freePTSessions: 0, // لا توجد جلسات PT مجانية
      inBodyScans: 12,
      invitations: 22, // 22 دعوة
      movementAssessments: 12,
      nutritionSessions: 12,
      monthlyAttendanceGoal: 20,
      upgradeAllowedDays: 0, // غير متاحة (أعلى فئة)
      onboardingSessions: 1, // جلسة تعريف
      followUpSessions: 4, // 4 جلسات متابعة
      groupClasses: 30, // 30 حصة
      poolSessions: 999, // مسبح غير محدود
      paddleSessions: 8, // 8 جلسات بادل
      freezingDays: 90, // 90 يوم
      icon: '🏆',
      isActive: true
    }
  })
  console.log('✅ تم إضافة باقة Elite:', elite.name)

  console.log('\n🎉 تم إضافة جميع الباقات بنجاح!')
  console.log('\n📊 ملخص الباقات:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('1. Challenger - شهر واحد - 1,500 ج.م - توفير 1,000 ج.م')
  console.log('2. Fighter - 3 شهور - 3,800 ج.م - توفير 2,200 ج.م')
  console.log('3. Champion - 6 شهور - 6,000 ج.م - توفير 2,500 ج.م')
  console.log('4. Elite - سنوي - 7,500 ج.م - توفير 3,300 ج.م')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ خطأ:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
