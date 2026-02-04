// app/api/commissions/sync-mrcb/route.ts
// Cron Job يومي لحساب MRCB للأعضاء النشطين

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import {
  calculateMRCB,
  getCurrentSubscriptionMonth,
  getSubscriptionMonths,
  getTierName
} from '../../../../lib/commissions/mrcb'

export async function POST(request: Request) {
  try {
    console.log('🔄 بدء مزامنة MRCB...')

    // 1. جلب جميع الأعضاء النشطين مع كوتش
    const members = await prisma.member.findMany({
      where: {
        isActive: true,
        assignedCoachId: { not: null },
        expiryDate: { gte: new Date() }
      }
    })

    const currentMonth = new Date().toISOString().slice(0, 7) // "YYYY-MM"
    let processedCount = 0
    let skippedCount = 0

    console.log(`📊 وُجد ${members.length} عضو نشط مع كوتش`)

    for (const member of members) {
      if (!member.assignedCoachId || !member.startDate || !member.subscriptionType) {
        skippedCount++
        continue
      }

      const subscriptionMonths = getSubscriptionMonths(member.subscriptionType)
      const currentSubMonth = getCurrentSubscriptionMonth(member.startDate, currentMonth)

      const mrcbAmount = calculateMRCB(
        member.subscriptionType,
        subscriptionMonths,
        currentSubMonth
      )

      if (mrcbAmount > 0) {
        // التحقق إذا كانت العمولة موجودة بالفعل
        const existing = await prisma.coachCommission.findFirst({
          where: {
            coachId: member.assignedCoachId,
            memberId: member.id,
            month: currentMonth,
            type: { startsWith: 'mrcb_' }
          }
        })

        if (!existing) {
          const tierName = getTierName(subscriptionMonths)

          await prisma.coachCommission.create({
            data: {
              coachId: member.assignedCoachId,
              type: `mrcb_${tierName.toLowerCase()}`,
              amount: mrcbAmount,
              memberId: member.id,
              month: currentMonth,
              calculationDetails: JSON.stringify({
                subscriptionType: member.subscriptionType,
                currentMonth: currentSubMonth,
                tier: tierName,
                memberNumber: member.memberNumber,
                memberName: member.name
              })
            }
          })

          processedCount++
        } else {
          skippedCount++
        }
      } else {
        skippedCount++
      }
    }

    console.log(`✅ تمت معالجة ${processedCount} عمولة MRCB جديدة`)
    console.log(`⏭️ تم تخطي ${skippedCount} عضو (موجود مسبقاً أو غير مؤهل)`)

    // تحديث تقارير جميع المدربين النشطين
    const coaches = await prisma.staff.findMany({
      where: {
        isActive: true,
        position: { contains: 'مدرب' }
      }
    })

    console.log(`🔄 تحديث تقارير ${coaches.length} مدرب...`)

    // Note: updateMonthlyReport سيتم تنفيذه في monthly-report/route.ts
    // هنا فقط نسجل العمولات، التقرير سيُحدث عند الحاجة

    return NextResponse.json({
      success: true,
      processed: processedCount,
      skipped: skippedCount,
      totalMembers: members.length,
      month: currentMonth
    })

  } catch (error: any) {
    console.error('❌ خطأ في مزامنة MRCB:', error)
    return NextResponse.json(
      { error: error.message || 'فشل مزامنة MRCB' },
      { status: 500 }
    )
  }
}
