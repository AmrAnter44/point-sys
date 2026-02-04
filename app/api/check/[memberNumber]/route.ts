import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { earnPoints } from '../../../../lib/loyaltySystem'

// ترجمات
const translations = {
  ar: {
    subscriptionExpired: '🚨 اشتراكك منتهي',
    subscriptionExpiringSoon: '⚠️ اشتراكك ينتهي قريباً ({days} يوم)',
    subscriptionActive: '✅ اشتراكك نشط',
    happyBirthday: '🎂 عيد ميلاد سعيد! حصلت على 250 نقطة',
    memberNotFound: '🚨 رقم العضوية غير موجود',
    checkError: 'حدث خطأ في التحقق',
    memberNumberRequired: '❌ رقم العضوية مطلوب'
  },
  en: {
    subscriptionExpired: '🚨 Your subscription has expired',
    subscriptionExpiringSoon: '⚠️ Your subscription is expiring soon ({days} days)',
    subscriptionActive: '✅ Your subscription is active',
    happyBirthday: '🎂 Happy Birthday! You received 250 points',
    memberNotFound: '🚨 Member number not found',
    checkError: 'An error occurred during verification',
    memberNumberRequired: '❌ Member number is required'
  }
}

// دالة للحصول على الترجمة
function t(key: keyof typeof translations.ar, lang: string, replacements?: Record<string, string | number>): string {
  const language = (lang === 'en' ? 'en' : 'ar') as 'ar' | 'en'
  let text = translations[language][key] || translations.ar[key]

  if (replacements) {
    Object.keys(replacements).forEach(replaceKey => {
      text = text.replace(`{${replaceKey}}`, String(replacements[replaceKey]))
    })
  }

  return text
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: { memberNumber: string } }
) {
  try {
    // الحصول على اللغة من query parameters
    const url = new URL(request.url)
    const lang = url.searchParams.get('lang') || 'ar'

    const memberNumber = params.memberNumber

    if (!memberNumber) {
      return NextResponse.json(
        { error: t('memberNumberRequired', lang) },
        { status: 400 }
      )
    }

    // البحث عن العضو برقم العضوية
    const member = await prisma.member.findFirst({
      where: {
        memberNumber: parseInt(memberNumber)
      },
      select: {
        // ✅ معلومات آمنة فقط - بدون معلومات حساسة
        id: true,
        name: true,
        memberNumber: true,
        isActive: true,
        expiryDate: true,
        startDate: true,
        isFrozen: true,
        freezeStartDate: true,
        freezeEndDate: true,
        birthdate: true,
        lastBirthdayReward: true,
        attendanceLimit: true, // حد الحضور
        // ❌ لا نرجع: phone, subscriptionPrice, remainingAmount, staffName, notes
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: t('memberNotFound', lang) },
        { status: 404 }
      )
    }

    // حساب الأيام المتبقية
    let remainingDays: number | null = null
    let status: 'active' | 'warning' | 'expired' = 'expired'
    let message = ''
    const today = new Date()

    if (member.expiryDate) {
      const expiry = new Date(member.expiryDate)
      const diffTime = expiry.getTime() - today.getTime()
      remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (remainingDays < 0) {
        status = 'expired'
        message = t('subscriptionExpired', lang)
      } else if (remainingDays <= 7) {
        status = 'warning'
        message = t('subscriptionExpiringSoon', lang, { days: remainingDays })
      } else {
        status = 'active'
        message = t('subscriptionActive', lang)
      }
    } else {
      // لا يوجد تاريخ انتهاء
      status = member.isActive ? 'active' : 'expired'
      message = member.isActive ? t('subscriptionActive', lang) : t('subscriptionExpired', lang)
    }

    // ✅ حساب أيام الحضور الفريدة لهذا الاشتراك
    let attendanceDaysUsed = 0
    let attendanceRemaining: number | null = null
    const isUnlimited = (member.attendanceLimit || 0) === 0

    if (member.startDate && member.expiryDate) {
      const checkIns = await prisma.memberCheckIn.findMany({
        where: {
          memberId: member.id,
          checkInTime: {
            gte: member.startDate,
            lte: member.expiryDate
          }
        },
        select: { checkInTime: true }
      })

      // حساب الأيام الفريدة (عدة تشيكات في نفس اليوم = يوم واحد)
      const uniqueDates = new Set(
        checkIns.map(c => new Date(c.checkInTime).toDateString())
      )
      attendanceDaysUsed = uniqueDates.size

      // حساب المتبقي إذا كان هناك حد
      if (!isUnlimited) {
        attendanceRemaining = (member.attendanceLimit || 0) - attendanceDaysUsed
      }
    }

    // ✅ تسجيل الحضور إذا كان الاشتراك نشطاً أو محذر
    let birthdayBonus = false
    let attendanceLimitWarning = false
    if (status === 'active' || status === 'warning') {
      // فحص التجميد
      let isFrozen = false
      if (member.isFrozen && member.freezeEndDate) {
        const freezeEnd = new Date(member.freezeEndDate)
        if (today > freezeEnd) {
          // إلغاء التجميد تلقائياً
          await prisma.member.update({
            where: { id: member.id },
            data: {
              isFrozen: false,
              freezeStartDate: null,
              freezeEndDate: null
            }
          })
        } else {
          // لا يزال في فترة التجميد
          const freezeStart = member.freezeStartDate ? new Date(member.freezeStartDate) : null
          if (freezeStart && today >= freezeStart && today <= freezeEnd) {
            isFrozen = true
          }
        }
      }

      // تسجيل الحضور إذا لم يكن مجمداً
      if (!isFrozen) {
        try {
          await prisma.memberCheckIn.create({
            data: {
              memberId: member.id,
              checkInTime: today,
              checkInMethod: 'scan',
            },
          })

          console.log('✅ تم تسجيل حضور:', {
            memberId: member.id,
            memberNumber: member.memberNumber,
            memberName: member.name,
            checkInTime: today.toISOString()
          })

          // تحديث عداد الأيام بعد تسجيل الحضور (إذا كان يوم جديد)
          const todayStr = today.toDateString()
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
            const updatedUniqueDates = new Set(
              existingCheckIns.map(c => new Date(c.checkInTime).toDateString())
            )
            attendanceDaysUsed = updatedUniqueDates.size

            if (!isUnlimited) {
              attendanceRemaining = (member.attendanceLimit || 0) - attendanceDaysUsed
              // تحذير عند الوصول للحد (أو تجاوزه)
              if (attendanceRemaining !== null && attendanceRemaining <= 0) {
                attendanceLimitWarning = true
              }
            }
          }

          // التحقق من عيد الميلاد ومنح النقاط
          if (
            member.birthdate &&
            isBirthday(member.birthdate, today) &&
            shouldAwardBirthdayPoints(member.lastBirthdayReward, today)
          ) {
            try {
              await earnPoints({
                memberId: member.id,
                points: 250,
                source: 'birthday',
                description: 'مكافأة عيد الميلاد 🎂',
                staffName: 'System'
              })

              await prisma.member.update({
                where: { id: member.id },
                data: { lastBirthdayReward: today }
              })

              birthdayBonus = true
              message = t('happyBirthday', lang)
              console.log(`🎂 تم منح ${member.name} 250 نقطة لعيد ميلاده!`)
            } catch (error) {
              console.error('Error awarding birthday points:', error)
            }
          }
        } catch (error) {
          console.error('Error recording check-in:', error)
          // لا نوقف العملية إذا فشل تسجيل الحضور
        }
      }
    }

    // ✅ إرجاع معلومات آمنة فقط
    return NextResponse.json({
      name: member.name,
      memberNumber: member.memberNumber,
      status: status,
      message: message,
      expiryDate: member.expiryDate,
      remainingDays: remainingDays,
      isActive: member.isActive,
      birthdayBonus: birthdayBonus,
      // معلومات حد الحضور
      attendanceLimit: member.attendanceLimit || 0,
      attendanceDaysUsed: attendanceDaysUsed,
      attendanceRemaining: attendanceRemaining,
      isUnlimited: isUnlimited,
      attendanceLimitWarning: attendanceLimitWarning
    })

  } catch (error) {
    console.error('Check API error:', error)
    const url = new URL(request.url)
    const lang = url.searchParams.get('lang') || 'ar'
    return NextResponse.json(
      { error: t('checkError', lang) },
      { status: 500 }
    )
  }
}
