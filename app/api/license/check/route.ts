// app/api/license/check/route.ts
// API endpoint for checking license validity

import { NextResponse } from 'next/server'
import { validateLicense } from '../../../../lib/license'

export async function GET() {
  try {
    const result = await validateLicense()

    return NextResponse.json({
      isValid: result.isValid,
      message: result.message,
      timestamp: Date.now()
    })
  } catch (error: any) {
    console.error('License check error:', error)

    return NextResponse.json(
      {
        isValid: false,
        message: 'License verification failed',
        error: error.message
      },
      { status: 500 }
    )
  }
}

// تعطيل الـ cache لهذا الـ endpoint
export const dynamic = 'force-dynamic'
export const revalidate = 0
