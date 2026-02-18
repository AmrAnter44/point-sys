import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import { getLanguageFromRequest } from '../../../../lib/languageHelper'

export async function POST(request: NextRequest) {
  try {
    // التحقق من تسجيل الدخول
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    // Get language from request
    const language = getLanguageFromRequest(request)

    const body = await request.json()
    const { memberId, serviceType, physioStaffId } = body

    if (!memberId || !serviceType) {
      return NextResponse.json({
        error: language === 'ar' ? 'بيانات غير كاملة' : 'Incomplete data'
      }, { status: 400 })
    }

    // التحقق من نوع الخدمة
    if (!['invitation', 'freePT', 'inBody', 'movementAssessment', 'nutrition', 'physiotherapy', 'onboarding', 'followUp', 'groupClass', 'pool', 'paddle', 'medicalScreening'].includes(serviceType)) {
      return NextResponse.json({
        error: language === 'ar' ? 'نوع خدمة غير صحيح' : 'Invalid service type'
      }, { status: 400 })
    }

    // جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member) {
      return NextResponse.json({
        error: language === 'ar' ? 'العضو غير موجود' : 'Member not found'
      }, { status: 404 })
    }

    // التحقق من أن العضو نشط
    if (!member.isActive) {
      return NextResponse.json({
        error: language === 'ar' ? 'العضو غير نشط' : 'Member is not active'
      }, { status: 400 })
    }

    // تحديد الحقل المراد تحديثه
    let updateData: any = {}
    let serviceName = ''
    let currentValue = 0

    switch (serviceType) {
      case 'invitation':
        currentValue = member.invitations
        serviceName = language === 'ar' ? 'دعوة' : 'Invitation'
        if (currentValue <= 0) {
          return NextResponse.json({
            error: language === 'ar' ? 'لا توجد دعوات متبقية' : 'No invitations remaining'
          }, { status: 400 })
        }
        updateData = { invitations: currentValue - 1 }
        break

      case 'freePT':
        currentValue = member.freePTSessions
        serviceName = language === 'ar' ? 'جلسة PT مجانية' : 'Free PT Session'
        if (currentValue <= 0) {
          return NextResponse.json({
            error: language === 'ar' ? 'لا توجد جلسات PT مجانية متبقية' : 'No free PT sessions remaining'
          }, { status: 400 })
        }
        updateData = { freePTSessions: currentValue - 1 }
        break

      case 'inBody':
        currentValue = member.inBodyScans
        serviceName = 'InBody'
        if (currentValue <= 0) {
          return NextResponse.json({
            error: language === 'ar' ? 'لا توجد InBody متبقية' : 'No InBody scans remaining'
          }, { status: 400 })
        }
        updateData = { inBodyScans: currentValue - 1 }
        break

      case 'movementAssessment':
        currentValue = member.movementAssessments
        serviceName = language === 'ar' ? 'تقييم حركة' : 'Movement Assessment'
        if (currentValue <= 0) {
          return NextResponse.json({
            error: language === 'ar' ? 'لا توجد جلسات تقييم حركة متبقية' : 'No movement assessment sessions remaining'
          }, { status: 400 })
        }
        updateData = { movementAssessments: currentValue - 1 }
        break

      case 'nutrition':
        currentValue = member.nutritionSessions
        serviceName = language === 'ar' ? 'جلسة تغذية' : 'Nutrition Session'
        if (currentValue <= 0) {
          return NextResponse.json({
            error: language === 'ar' ? 'لا توجد جلسات تغذية متبقية' : 'No nutrition sessions remaining'
          }, { status: 400 })
        }
        updateData = { nutritionSessions: currentValue - 1 }
        break

      case 'physiotherapy':
        currentValue = member.physiotherapySessions
        serviceName = language === 'ar' ? 'جلسة علاج طبيعي' : 'Physiotherapy Session'
        if (currentValue <= 0) {
          return NextResponse.json({
            error: language === 'ar' ? 'لا توجد جلسات علاج طبيعي متبقية' : 'No physiotherapy sessions remaining'
          }, { status: 400 })
        }
        updateData = { physiotherapySessions: currentValue - 1 }
        break

      case 'onboarding':
        currentValue = member.onboardingSessions
        serviceName = language === 'ar' ? 'جلسة تأهيل' : 'Onboarding Session'
        if (currentValue <= 0) {
          return NextResponse.json({
            error: language === 'ar' ? 'لا توجد جلسات تأهيل متبقية' : 'No onboarding sessions remaining'
          }, { status: 400 })
        }
        updateData = { onboardingSessions: currentValue - 1 }
        break

      case 'followUp':
        currentValue = member.followUpSessions
        serviceName = language === 'ar' ? 'جلسة متابعة' : 'Follow-up Session'
        if (currentValue <= 0) {
          return NextResponse.json({
            error: language === 'ar' ? 'لا توجد جلسات متابعة متبقية' : 'No follow-up sessions remaining'
          }, { status: 400 })
        }
        updateData = { followUpSessions: currentValue - 1 }
        break

      case 'groupClass':
        currentValue = member.groupClasses
        serviceName = language === 'ar' ? 'حصة جماعية' : 'Group Class'
        if (currentValue <= 0) {
          return NextResponse.json({
            error: language === 'ar' ? 'لا توجد حصص جماعية متبقية' : 'No group classes remaining'
          }, { status: 400 })
        }
        updateData = { groupClasses: currentValue - 1 }
        break

      case 'pool':
        currentValue = member.poolSessions
        serviceName = language === 'ar' ? 'جلسة مسبح' : 'Pool Session'
        if (currentValue <= 0) {
          return NextResponse.json({
            error: language === 'ar' ? 'لا توجد جلسات مسبح متبقية' : 'No pool sessions remaining'
          }, { status: 400 })
        }
        updateData = { poolSessions: currentValue - 1 }
        break

      case 'paddle':
        currentValue = member.paddleSessions
        serviceName = language === 'ar' ? 'جلسة بادل' : 'Paddle Session'
        if (currentValue <= 0) {
          return NextResponse.json({
            error: language === 'ar' ? 'لا توجد جلسات بادل متبقية' : 'No paddle sessions remaining'
          }, { status: 400 })
        }
        updateData = { paddleSessions: currentValue - 1 }
        break

      case 'medicalScreening':
        currentValue = member.medicalScreeningSessions
        serviceName = language === 'ar' ? 'جلسة كشف طبي' : 'Medical Screening Session'
        if (currentValue <= 0) {
          return NextResponse.json({
            error: language === 'ar' ? 'لا توجد جلسات كشف طبي متبقية' : 'No medical screening sessions remaining'
          }, { status: 400 })
        }
        updateData = { medicalScreeningSessions: currentValue - 1 }
        break
    }

    // تحديث بيانات العضو
    await prisma.member.update({
      where: { id: memberId },
      data: updateData
    })

    // 💰 عمولة الكشف الطبي: 50 جنيه للفيزيوثيرابيست
    if (serviceType === 'medicalScreening' && physioStaffId) {
      try {
        await prisma.coachCommission.create({
          data: {
            coachId: physioStaffId,
            type: 'medical_screening',
            amount: 50,
            month: new Date().toISOString().slice(0, 7),
            status: 'pending',
            notes: `كشف طبي - عضو: ${member.name} (${member.memberNumber})`,
            calculationDetails: JSON.stringify({
              memberId: member.id,
              memberName: member.name,
              memberNumber: member.memberNumber,
              sessionFee: 50
            })
          }
        })
      } catch (err) {
        console.error('فشل إنشاء عمولة الكشف الطبي:', err)
      }
    }

    return NextResponse.json({
      success: true,
      message: language === 'ar'
        ? `تم خصم ${serviceName} بنجاح`
        : `${serviceName} deducted successfully`,
      newValue: currentValue - 1
    })

  } catch (error) {
    console.error('Error deducting service:', error)
    // Get language for error message
    const language = getLanguageFromRequest(request)
    return NextResponse.json({
      error: language === 'ar' ? 'حدث خطأ أثناء الخصم' : 'Error occurred during deduction'
    }, { status: 500 })
  }
}
