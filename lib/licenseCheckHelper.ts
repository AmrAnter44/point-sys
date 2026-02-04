// lib/licenseCheckHelper.ts
// Helper to trigger license check after receipt creation

import { validateLicense } from './license'

/**
 * فحص الترخيص بعد إنشاء إيصال
 * يتم تشغيله في الخلفية ولا يمنع العملية
 */
export async function triggerLicenseCheckAfterReceipt() {
  // تشغيل الفحص في الخلفية (non-blocking)
  setImmediate(async () => {
    try {
      console.log('🔍 License check triggered after receipt creation')
      const result = await validateLicense()

      if (!result.isValid) {
        console.warn('⚠️ License is invalid:', result.message)
        // يمكن إضافة إجراءات إضافية هنا مثل إرسال webhook أو تسجيل
      } else {
        console.log('✅ License check passed after receipt creation')
      }
    } catch (error) {
      console.error('❌ Error during post-receipt license check:', error)
    }
  })
}

/**
 * فحص الترخيص قبل إنشاء إيصال (blocking)
 * يمنع العملية إذا كان الترخيص غير صالح
 */
export async function verifyLicenseBeforeReceipt(): Promise<{
  isValid: boolean
  message: string
}> {
  try {
    console.log('🔒 Verifying license before receipt creation')
    const result = await validateLicense()

    if (!result.isValid) {
      console.error('❌ License verification failed before receipt:', result.message)
    }

    return {
      isValid: result.isValid,
      message: result.message
    }
  } catch (error: any) {
    console.error('❌ License verification error:', error)
    return {
      isValid: false,
      message: 'License verification failed: ' + error.message
    }
  }
}
