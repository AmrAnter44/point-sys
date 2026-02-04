// app/api/commissions/finalize/route.ts
// لإغلاق الشهر وتحديد أفضل مدرب

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { determineTopPerformer } from '../../../../lib/commissions/helpers'

export async function POST(request: Request) {
  try {
    const { month } = await request.json()

    if (!month) {
      return NextResponse.json(
        { error: 'الشهر مطلوب (YYYY-MM)' },
        { status: 400 }
      )
    }

    console.log(`🔒 إغلاق شهر ${month}...`)

    // 1. تحديد أفضل مدرب (أعلى إجمالي عمولات)
    const topCoachId = await determineTopPerformer(month)

    if (!topCoachId) {
      return NextResponse.json(
        { error: 'لا توجد تقارير لهذا الشهر' },
        { status: 404 }
      )
    }

    console.log(`🏆 أفضل مدرب: ${topCoachId}`)

    // 2. جلب جميع التقارير لهذا الشهر
    const reports = await prisma.monthlyCommissionReport.findMany({
      where: { month },
      include: {
        coach: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    let updatedReports = 0

    // 3. تحديث جميع التقارير
    for (const report of reports) {
      const isTop = report.coachId === topCoachId

      // حساب الإجمالي الجديد (إضافة مكافأة أفضل مدرب إن وُجدت)
      const newGrandTotal = report.mrcbTotal + report.upsellTotal + report.performanceBonus + (isTop ? 1000 : 0)

      await prisma.monthlyCommissionReport.update({
        where: { id: report.id },
        data: {
          isTopPerformer: isTop,
          topPerformerBonus: isTop ? 1000 : 0,
          grandTotal: newGrandTotal,
          status: 'finalized',
          finalizedAt: new Date()
        }
      })

      updatedReports++

      // 4. إنشاء سجل عمولة لأفضل مدرب
      if (isTop) {
        // التحقق إذا كانت العمولة موجودة بالفعل
        const existingBonus = await prisma.coachCommission.findFirst({
          where: {
            coachId: topCoachId,
            month: month,
            type: 'top_performer'
          }
        })

        if (!existingBonus) {
          await prisma.coachCommission.create({
            data: {
              coachId: topCoachId,
              type: 'top_performer',
              amount: 1000,
              month: month,
              notes: `أفضل مدرب لشهر ${month} - إجمالي العمولات: ${newGrandTotal} ج.م`,
              calculationDetails: JSON.stringify({
                totalCommissions: report.mrcbTotal + report.upsellTotal + report.performanceBonus,
                rank: 1
              })
            }
          })

          console.log(`💰 تم منح مكافأة أفضل مدرب (1,000 ج.م) للمدرب ${report.coach.name}`)
        }
      }
    }

    // 5. جلب اسم أفضل مدرب للإرجاع
    const topCoach = reports.find(r => r.coachId === topCoachId)?.coach

    console.log(`✅ تم إغلاق شهر ${month} - عدد المدربين: ${updatedReports}`)

    return NextResponse.json({
      success: true,
      month,
      topPerformer: {
        coachId: topCoachId,
        coachName: topCoach?.name || 'غير معروف',
        totalCommissions: reports.find(r => r.coachId === topCoachId)?.grandTotal || 0
      },
      totalReports: updatedReports
    })

  } catch (error: any) {
    console.error('❌ خطأ في إغلاق الشهر:', error)
    return NextResponse.json(
      { error: error.message || 'فشل إغلاق الشهر' },
      { status: 500 }
    )
  }
}

// GET: جلب جميع التقارير لشهر معين (للإدارة)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

    const reports = await prisma.monthlyCommissionReport.findMany({
      where: { month },
      include: {
        coach: {
          select: {
            id: true,
            name: true,
            phone: true,
            position: true
          }
        }
      },
      orderBy: {
        grandTotal: 'desc'
      }
    })

    return NextResponse.json({
      month,
      reports,
      totalReports: reports.length,
      totalCommissions: reports.reduce((sum, r) => sum + r.grandTotal, 0),
      isFinalized: reports.length > 0 && reports[0].status === 'finalized'
    })

  } catch (error: any) {
    console.error('❌ خطأ في جلب التقارير:', error)
    return NextResponse.json(
      { error: error.message || 'فشل جلب التقارير' },
      { status: 500 }
    )
  }
}
