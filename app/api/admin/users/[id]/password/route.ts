// app/api/admin/users/[id]/password/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { requireAdmin } from '../../../../../../lib/auth'
import bcrypt from 'bcryptjs'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request)

    const { newPassword } = await request.json()

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { id: params.id } })
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: params.id },
      data: { password: hashedPassword }
    })

    console.log(`✅ تم تغيير كلمة مرور المستخدم: ${user.name}`)

    return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' })

  } catch (error: any) {
    console.error('Error changing password:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }

    return NextResponse.json({ error: 'فشل تغيير كلمة المرور' }, { status: 500 })
  }
}
