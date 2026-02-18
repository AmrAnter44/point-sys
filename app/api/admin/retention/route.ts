// app/api/admin/retention/route.ts
// حساب معدل استمرارية الأعضاء (Retention Rate)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'canViewMembers')

    const now = new Date()

    // حساب معدل الاستمرارية لآخر 6 أشهر
    const months = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)

      const monthLabel = monthStart.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })

      // الأعضاء الذين انتهت اشتراكاتهم في هذا الشهر
      const expiredMembers = await prisma.member.findMany({
        where: {
          expiryDate: {
            gte: monthStart,
            lte: monthEnd
          }
        },
        select: { id: true }
      })

      const expiredCount = expiredMembers.length

      if (expiredCount === 0) {
        months.push({ month: monthLabel, expired: 0, renewed: 0, rate: 0 })
        continue
      }

      const expiredIds = expiredMembers.map(m => m.id)

      // من بين هؤلاء - من جدد اشتراكه (له إيصال تجديد بعد انتهاء الاشتراك)
      const renewedCount = await prisma.receipt.count({
        where: {
          type: 'تجديد عضويه',
          memberId: { in: expiredIds },
          createdAt: {
            gte: monthStart,
            lte: new Date(monthEnd.getTime() + 30 * 24 * 60 * 60 * 1000) // شهر بعد للتجديد
          }
        }
      })

      // نحسب عدد الأعضاء الفريدين اللي جددوا
      const renewedMembersRaw = await prisma.receipt.findMany({
        where: {
          type: 'تجديد عضويه',
          memberId: { in: expiredIds },
          createdAt: {
            gte: monthStart,
            lte: new Date(monthEnd.getTime() + 30 * 24 * 60 * 60 * 1000)
          }
        },
        select: { memberId: true },
        distinct: ['memberId']
      })

      const uniqueRenewed = renewedMembersRaw.length
      const rate = expiredCount > 0 ? Math.round((uniqueRenewed / expiredCount) * 100) : 0

      months.push({
        month: monthLabel,
        expired: expiredCount,
        renewed: uniqueRenewed,
        rate
      })
    }

    // معدل الاستمرارية الإجمالي (آخر 30 يوم)
    const last30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const recentExpired = await prisma.member.findMany({
      where: {
        expiryDate: {
          gte: last30Start,
          lte: now
        }
      },
      select: { id: true }
    })

    const recentExpiredIds = recentExpired.map(m => m.id)
    let currentRate = 0
    let currentRenewed = 0

    if (recentExpiredIds.length > 0) {
      const recentRenewed = await prisma.receipt.findMany({
        where: {
          type: 'تجديد عضويه',
          memberId: { in: recentExpiredIds },
          createdAt: { gte: last30Start }
        },
        select: { memberId: true },
        distinct: ['memberId']
      })
      currentRenewed = recentRenewed.length
      currentRate = Math.round((currentRenewed / recentExpired.length) * 100)
    }

    return NextResponse.json({
      current: {
        rate: currentRate,
        expired: recentExpired.length,
        renewed: currentRenewed,
        period: 'آخر 30 يوم'
      },
      monthly: months
    })

  } catch (error: any) {
    console.error('Error fetching retention rate:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    return NextResponse.json({ error: 'فشل جلب معدل الاستمرارية' }, { status: 500 })
  }
}
