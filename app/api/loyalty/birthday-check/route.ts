import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { earnPoints } from '@/lib/loyaltySystem'

/**
 * Cron job endpoint to check and award birthday points
 * Run daily at midnight
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (for security)
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    const currentMonth = today.getMonth() + 1
    const currentDay = today.getDate()
    const currentYear = today.getFullYear()

    // Find members with birthday today
    const members = await prisma.member.findMany({
      where: {
        birthdate: {
          not: null
        },
        isActive: true
      },
      include: {
        loyalty: true
      }
    })

    const results = []

    for (const member of members) {
      if (!member.birthdate) continue

      const birthdayMonth = member.birthdate.getMonth() + 1
      const birthdayDay = member.birthdate.getDate()

      // Check if today is their birthday
      if (birthdayMonth === currentMonth && birthdayDay === currentDay) {

        // Check if already rewarded this year
        if (member.lastBirthdayReward) {
          const lastRewardYear = member.lastBirthdayReward.getFullYear()
          if (lastRewardYear === currentYear) {
            results.push({
              memberId: member.id,
              name: member.name,
              status: 'already_rewarded'
            })
            continue
          }
        }

        // Award birthday points
        await earnPoints({
          memberId: member.id,
          points: 250,
          source: 'birthday',
          description: `🎂 مكافأة عيد ميلاد ${currentYear}`
        })

        // Update lastBirthdayReward
        await prisma.member.update({
          where: { id: member.id },
          data: {
            lastBirthdayReward: today
          }
        })

        results.push({
          memberId: member.id,
          name: member.name,
          status: 'awarded',
          points: 250
        })
      }
    }

    return NextResponse.json({
      success: true,
      date: today.toISOString(),
      processed: results.length,
      results
    })

  } catch (error: any) {
    console.error('❌ خطأ في فحص أعياد الميلاد:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
