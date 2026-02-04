// update-coach-permissions.js
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function updateCoachPermissions() {
  try {
    console.log('🔄 جاري تحديث صلاحيات الكوتشات...')

    // جلب جميع المستخدمين بدور COACH
    const coaches = await prisma.user.findMany({
      where: { role: 'COACH' },
      include: { permissions: true }
    })

    console.log(`📊 تم العثور على ${coaches.length} كوتش`)

    for (const coach of coaches) {
      if (coach.permissions) {
        // تحديث الصلاحيات الموجودة
        await prisma.permission.update({
          where: { userId: coach.id },
          data: {
            canViewPT: true,
            canRegisterPTAttendance: true,
            // إزالة صلاحيات غير ضرورية
            canViewMembers: false,
            canCreateMembers: false,
            canEditMembers: false,
            canDeleteMembers: false,
            canCreatePT: false,
            canEditPT: false,
            canDeletePT: false,
            canViewStaff: false,
            canCreateStaff: false,
            canEditStaff: false,
            canDeleteStaff: false,
            canViewReceipts: false,
            canEditReceipts: false,
            canDeleteReceipts: false,
            canViewExpenses: false,
            canCreateExpense: false,
            canEditExpense: false,
            canDeleteExpense: false,
            canViewVisitors: false,
            canCreateVisitor: false,
            canEditVisitor: false,
            canDeleteVisitor: false,
            canViewFollowUps: false,
            canCreateFollowUp: false,
            canEditFollowUp: false,
            canDeleteFollowUp: false,
            canViewDayUse: false,
            canCreateDayUse: false,
            canEditDayUse: false,
            canDeleteDayUse: false,
            canViewReports: false,
            canViewFinancials: false,
            canViewAttendance: false,
            canAccessClosing: false,
            canAccessSettings: false,
            canAccessAdmin: false
          }
        })
        console.log(`✅ تم تحديث صلاحيات الكوتش: ${coach.name}`)
      } else {
        // إنشاء صلاحيات جديدة
        await prisma.permission.create({
          data: {
            userId: coach.id,
            canViewPT: true,
            canRegisterPTAttendance: true,
            canViewMembers: false,
            canCreateMembers: false,
            canEditMembers: false,
            canDeleteMembers: false,
            canCreatePT: false,
            canEditPT: false,
            canDeletePT: false,
            canViewStaff: false,
            canCreateStaff: false,
            canEditStaff: false,
            canDeleteStaff: false,
            canViewReceipts: false,
            canEditReceipts: false,
            canDeleteReceipts: false,
            canViewExpenses: false,
            canCreateExpense: false,
            canEditExpense: false,
            canDeleteExpense: false,
            canViewVisitors: false,
            canCreateVisitor: false,
            canEditVisitor: false,
            canDeleteVisitor: false,
            canViewFollowUps: false,
            canCreateFollowUp: false,
            canEditFollowUp: false,
            canDeleteFollowUp: false,
            canViewDayUse: false,
            canCreateDayUse: false,
            canEditDayUse: false,
            canDeleteDayUse: false,
            canViewReports: false,
            canViewFinancials: false,
            canViewAttendance: false,
            canAccessClosing: false,
            canAccessSettings: false,
            canAccessAdmin: false
          }
        })
        console.log(`✅ تم إنشاء صلاحيات للكوتش: ${coach.name}`)
      }
    }

    console.log('✅ تم تحديث صلاحيات جميع الكوتشات بنجاح!')

  } catch (error) {
    console.error('❌ خطأ في تحديث الصلاحيات:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateCoachPermissions()
