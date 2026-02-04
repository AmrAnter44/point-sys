import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { earnPoints, calculateReferralPoints } from '@/lib/loyaltySystem'

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { newMemberId } = await req.json()

    // Get new member details
    const newMember = await prisma.member.findUnique({
      where: { id: newMemberId }
    })

    if (!newMember) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    // Find matching invitation by phone
    const invitation = await prisma.invitation.findFirst({
      where: {
        guestPhone: newMember.phone
      },
      include: {
        member: true
      },
      orderBy: {
        createdAt: 'desc' // Get most recent invitation
      }
    })

    if (!invitation) {
      return NextResponse.json({
        message: 'لا توجد إحالة مطابقة',
        awarded: false
      })
    }

    // Check if already awarded
    const existingTransaction = await prisma.loyaltyTransaction.findFirst({
      where: {
        memberId: invitation.memberId,
        source: 'referral',
        invitationId: invitation.id
      }
    })

    if (existingTransaction) {
      return NextResponse.json({
        message: 'تم منح نقاط الإحالة من قبل',
        awarded: false
      })
    }

    // Calculate referral points
    const duration = newMember.expiryDate && newMember.startDate
      ? Math.floor((newMember.expiryDate.getTime() - newMember.startDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    const points = calculateReferralPoints(
      duration,
      newMember.currentOfferName || ''
    )

    if (points > 0) {
      await earnPoints({
        memberId: invitation.memberId,
        points,
        source: 'referral',
        description: `إحالة ${newMember.name} (${newMember.currentOfferName})`,
        invitationId: invitation.id,
        metadata: {
          referredMemberId: newMemberId,
          referredMemberName: newMember.name
        }
      })

      return NextResponse.json({
        success: true,
        points,
        referrerName: invitation.member.name,
        awarded: true
      })
    }

    return NextResponse.json({
      message: 'الإحالة لا تستوفي الشروط',
      awarded: false
    })

  } catch (error: any) {
    console.error('❌ خطأ في منح نقاط الإحالة:', error)
    return NextResponse.json(
      { error: error.message || 'حدث خطأ' },
      { status: 500 }
    )
  }
}
