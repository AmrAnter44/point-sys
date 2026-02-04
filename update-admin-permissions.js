// update-admin-permissions.js - تحديث صلاحيات الإدمن
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function updateAdminPermissions() {
  try {
    console.log('🔍 البحث عن مستخدمي الأدمن...')

    // جلب كل مستخدمي الأدمن
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN'
      },
      include: {
        permissions: true
      }
    })

    console.log(`✅ تم العثور على ${admins.length} أدمن`)

    for (const admin of admins) {
      console.log(`\n📝 تحديث صلاحيات: ${admin.name} (${admin.email})`)

      if (admin.permissions) {
        // تحديث الصلاحيات الموجودة
        await prisma.permission.update({
          where: {
            id: admin.permissions.id
          },
          data: {
            // صلاحيات الأعضاء
            canViewMembers: true,
            canCreateMembers: true,
            canEditMembers: true,
            canDeleteMembers: true,

            // صلاحيات PT
            canViewPT: true,
            canCreatePT: true,
            canEditPT: true,
            canDeletePT: true,

            // صلاحيات الموظفين
            canViewStaff: true,
            canCreateStaff: true,
            canEditStaff: true,
            canDeleteStaff: true,

            // صلاحيات الإيصالات
            canViewReceipts: true,
            canEditReceipts: true,
            canDeleteReceipts: true,

            // صلاحيات المصروفات
            canViewExpenses: true,
            canCreateExpense: true,
            canEditExpense: true,
            canDeleteExpense: true,

            // صلاحيات الزوار
            canViewVisitors: true,
            canCreateVisitor: true,
            canEditVisitor: true,
            canDeleteVisitor: true,

            // صلاحيات المتابعات
            canViewFollowUps: true,
            canCreateFollowUp: true,
            canEditFollowUp: true,
            canDeleteFollowUp: true,

            // صلاحيات يوم الاستخدام
            canViewDayUse: true,
            canCreateDayUse: true,
            canEditDayUse: true,
            canDeleteDayUse: true,

            // صلاحيات التقارير والإعدادات
            canViewReports: true,
            canViewFinancials: true,
            canViewAttendance: true,
            canAccessClosing: true,
            canAccessSettings: true,
            canAccessAdmin: true,
          }
        })
        console.log('✅ تم تحديث الصلاحيات بنجاح')
      } else {
        // إنشاء صلاحيات جديدة
        await prisma.permission.create({
          data: {
            userId: admin.id,
            // صلاحيات الأعضاء
            canViewMembers: true,
            canCreateMembers: true,
            canEditMembers: true,
            canDeleteMembers: true,

            // صلاحيات PT
            canViewPT: true,
            canCreatePT: true,
            canEditPT: true,
            canDeletePT: true,

            // صلاحيات الموظفين
            canViewStaff: true,
            canCreateStaff: true,
            canEditStaff: true,
            canDeleteStaff: true,

            // صلاحيات الإيصالات
            canViewReceipts: true,
            canEditReceipts: true,
            canDeleteReceipts: true,

            // صلاحيات المصروفات
            canViewExpenses: true,
            canCreateExpense: true,
            canEditExpense: true,
            canDeleteExpense: true,

            // صلاحيات الزوار
            canViewVisitors: true,
            canCreateVisitor: true,
            canEditVisitor: true,
            canDeleteVisitor: true,

            // صلاحيات المتابعات
            canViewFollowUps: true,
            canCreateFollowUp: true,
            canEditFollowUp: true,
            canDeleteFollowUp: true,

            // صلاحيات يوم الاستخدام
            canViewDayUse: true,
            canCreateDayUse: true,
            canEditDayUse: true,
            canDeleteDayUse: true,

            // صلاحيات التقارير والإعدادات
            canViewReports: true,
            canViewFinancials: true,
            canViewAttendance: true,
            canAccessClosing: true,
            canAccessSettings: true,
            canAccessAdmin: true,
          }
        })
        console.log('✅ تم إنشاء الصلاحيات بنجاح')
      }
    }

    console.log('\n🎉 تم تحديث صلاحيات جميع الأدمن بنجاح!')
  } catch (error) {
    console.error('❌ حدث خطأ:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateAdminPermissions()
