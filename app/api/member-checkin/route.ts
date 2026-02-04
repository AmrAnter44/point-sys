import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { earnPoints } from '../../../lib/loyaltySystem'

// دالة للتحقق من عيد الميلاد
function isBirthday(birthdate: Date | null, today: Date): boolean {
  if (!birthdate) return false

  const birth = new Date(birthdate)
  return (
    birth.getDate() === today.getDate() &&
    birth.getMonth() === today.getMonth()
  )
}

// دالة للتحقق من أن العضو لم يحصل على مكافأة عيد الميلاد لهذا العام
function shouldAwardBirthdayPoints(lastBirthdayReward: Date | null, today: Date): boolean {
  if (!lastBirthdayReward) return true

  const lastReward = new Date(lastBirthdayReward)
  return lastReward.getFullYear() !== today.getFullYear()
}

// POST: تسجيل دخول عضو
export async function POST(request: Request) {
  try {
    const { memberId, method = 'scan' } = await request.json()

    if (!memberId) {
      return NextResponse.json(
        { error: 'يجب توفير رقم العضو' },
        { status: 400 }
      )
    }

    // التحقق من وجود العضو وأن اشتراكه نشط
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    })

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      )
    }

    if (!member.isActive) {
      return NextResponse.json(
        { error: 'اشتراك العضو منتهي' },
        { status: 400 }
      )
    }

    // إنشاء تسجيل دخول جديد
    const now = new Date()

    // فحص التجميد وإلغاء التجميد تلقائياً إذا انتهت الفترة
    if (member.isFrozen && member.freezeEndDate) {
      const freezeEnd = new Date(member.freezeEndDate)

      if (now > freezeEnd) {
        // إلغاء التجميد تلقائياً
        await prisma.member.update({
          where: { id: memberId },
          data: {
            isFrozen: false,
            freezeStartDate: null,
            freezeEndDate: null
          }
        })
      } else {
        // لا يزال العضو في فترة التجميد
        const freezeStart = member.freezeStartDate ? new Date(member.freezeStartDate) : null
        if (freezeStart && now >= freezeStart && now <= freezeEnd) {
          const daysRemaining = Math.ceil((freezeEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          return NextResponse.json(
            {
              error: `الاشتراك مجمد حالياً`,
              isFrozen: true,
              freezeEndDate: freezeEnd.toISOString(),
              daysRemaining
            },
            { status: 403 }
          )
        }
      }
    }

    // ✅ حساب أيام الحضور الفريدة قبل التسجيل
    let attendanceDaysUsed = 0
    let attendanceRemaining: number | null = null
    const isUnlimited = (member.attendanceLimit || 0) === 0

    console.log('📍 تسجيل حضور جديد:', {
      memberId,
      memberName: member.name,
      checkInTime: now.toISOString(),
      localTime: now.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })
    })

    const checkIn = await prisma.memberCheckIn.create({
      data: {
        memberId,
        checkInTime: now,
        checkInMethod: method,
      },
    })

    // ✅ حساب أيام الحضور الفريدة بعد التسجيل
    let attendanceLimitWarning = false
    if (member.startDate && member.expiryDate) {
      const existingCheckIns = await prisma.memberCheckIn.findMany({
        where: {
          memberId: member.id,
          checkInTime: {
            gte: member.startDate,
            lte: member.expiryDate
          }
        },
        select: { checkInTime: true }
      })

      // حساب الأيام الفريدة
      const uniqueDates = new Set(
        existingCheckIns.map(c => new Date(c.checkInTime).toDateString())
      )
      attendanceDaysUsed = uniqueDates.size

      if (!isUnlimited) {
        attendanceRemaining = (member.attendanceLimit || 0) - attendanceDaysUsed
        // تحذير عند الوصول للحد
        if (attendanceRemaining !== null && attendanceRemaining <= 0) {
          attendanceLimitWarning = true
        }
      }
    }

    // التحقق من عيد الميلاد ومنح النقاط
    let birthdayBonus = false
    if (
      member.birthdate &&
      isBirthday(member.birthdate, now) &&
      shouldAwardBirthdayPoints(member.lastBirthdayReward, now)
    ) {
      try {
        // منح 250 نقطة عيد ميلاد
        await earnPoints({
          memberId,
          points: 250,
          source: 'birthday',
          description: 'مكافأة عيد الميلاد 🎂',
          staffName: 'System'
        })

        // تحديث تاريخ آخر مكافأة عيد ميلاد
        await prisma.member.update({
          where: { id: memberId },
          data: { lastBirthdayReward: now }
        })

        birthdayBonus = true
        console.log(`🎂 تم منح ${member.name} 250 نقطة لعيد ميلاده!`)
      } catch (error) {
        console.error('Error awarding birthday points:', error)
        // لا نوقف عملية المسح إذا فشلت النقاط
      }
    }

    return NextResponse.json({
      success: true,
      checkIn,
      message: birthdayBonus
        ? '🎂 تم تسجيل الدخول بنجاح - عيد ميلاد سعيد! حصلت على 250 نقطة'
        : 'تم تسجيل الدخول بنجاح',
      alreadyCheckedIn: false,
      birthdayBonus,
      // معلومات حد الحضور
      attendanceLimit: member.attendanceLimit || 0,
      attendanceDaysUsed,
      attendanceRemaining,
      isUnlimited,
      attendanceLimitWarning
    })
  } catch (error) {
    console.error('Error in member check-in:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تسجيل الدخول' },
      { status: 500 }
    )
  }
}

// GET: الحصول على حالة تسجيل دخول عضو معين
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json(
        { error: 'يجب توفير رقم العضو' },
        { status: 400 }
      )
    }

    // إرجاع آخر تسجيل دخول للعضو
    const latestCheckIn = await prisma.memberCheckIn.findFirst({
      where: {
        memberId,
      },
      include: {
        member: {
          select: {
            name: true,
            memberNumber: true,
          },
        },
      },
      orderBy: {
        checkInTime: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      checkIn: latestCheckIn,
      isCheckedIn: !!latestCheckIn,
    })
  } catch (error) {
    console.error('Error getting check-in status:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء الاستعلام' },
      { status: 500 }
    )
  }
}
