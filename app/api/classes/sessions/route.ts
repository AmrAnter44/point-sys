import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

// POST - تسجيل حضور جلسة
export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, 'canRegisterPTAttendance') // نفس صلاحية PT

    const body = await request.json()
    const { packageNumber, notes } = body

    console.log(`📝 تسجيل جلسة كلاس - باقة #${packageNumber}`)

    // التحقق من وجود الباقة
    const classPackage = await prisma.classPackage.findUnique({
      where: { packageNumber: parseInt(packageNumber) }
    })

    if (!classPackage) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    if (classPackage.sessionsRemaining <= 0) {
      return NextResponse.json({ error: 'No sessions remaining' }, { status: 400 })
    }

    // تسجيل الجلسة
    const classSession = await prisma.classSession.create({
      data: {
        packageNumber: classPackage.packageNumber,
        clientName: classPackage.clientName,
        instructorName: classPackage.instructorName || '',
        sessionDate: new Date(),
        attended: true,
        attendedAt: new Date(),
        attendedBy: user.name || 'Unknown',
        notes: notes || null,
      },
    })

    console.log(`✅ تم تسجيل جلسة #${classSession.id}`)

    // تقليل الجلسات المتبقية
    await prisma.classPackage.update({
      where: { packageNumber: classPackage.packageNumber },
      data: { sessionsRemaining: classPackage.sessionsRemaining - 1 }
    })

    console.log(`📊 الجلسات المتبقية: ${classPackage.sessionsRemaining - 1}`)

    return NextResponse.json({
      success: true,
      session: classSession,
      remainingSessions: classPackage.sessionsRemaining - 1,
    })
  } catch (error) {
    console.error('❌ Error registering session:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to register session' }, { status: 500 })
  }
}

// DELETE - حذف جلسة (إرجاع الجلسة المتبقية)
export async function DELETE(request: Request) {
  try {
    const user = await requirePermission(request, 'canDeletePT') // نفس صلاحية PT

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    console.log(`🗑️ حذف جلسة #${sessionId}`)

    const classSession = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: { package: true }
    })

    if (!classSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // حذف الجلسة
    await prisma.classSession.delete({
      where: { id: sessionId }
    })

    // إرجاع الجلسة للباقة
    await prisma.classPackage.update({
      where: { packageNumber: classSession.package.packageNumber },
      data: { sessionsRemaining: classSession.package.sessionsRemaining + 1 }
    })

    console.log(`✅ تم حذف الجلسة وإرجاع الجلسة للباقة`)
    console.log(`📊 الجلسات المتبقية: ${classSession.package.sessionsRemaining + 1}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Error deleting session:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
  }
}
