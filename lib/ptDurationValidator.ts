/**
 * PT Duration Validator - فرض مدة شهر واحد فقط لاشتراكات البرايفت
 *
 * يوفر هذا الملف دوال للتحقق من صحة مدة اشتراكات PT
 * ويفرض أن تكون جميع الاشتراكات شهر واحد فقط (28-32 يوم)
 */

export const PT_DURATION_CONFIG = {
  MIN_DAYS: 28,  // الحد الأدنى (فبراير في سنة عادية)
  MAX_DAYS: 32,  // الحد الأقصى (شهر + يوم إضافي للتعامل مع edge cases)
  STANDARD_MONTHS: 1, // المدة القياسية: شهر واحد فقط
} as const

export interface DurationValidationResult {
  isValid: boolean
  durationDays: number
  error?: string
}

/**
 * التحقق من صحة مدة اشتراك PT
 * @param startDate - تاريخ بداية الاشتراك
 * @param expiryDate - تاريخ انتهاء الاشتراك
 * @returns نتيجة التحقق مع المدة بالأيام ورسالة خطأ إن وُجدت
 */
export function validatePTDuration(
  startDate: Date | string,
  expiryDate: Date | string
): DurationValidationResult {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate

  // التحقق من أن تاريخ الانتهاء بعد تاريخ البداية
  if (end <= start) {
    return {
      isValid: false,
      durationDays: 0,
      error: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية'
    }
  }

  // حساب المدة بالأيام
  const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  // التحقق من أن المدة ضمن النطاق المسموح (28-32 يوم = شهر واحد)
  if (durationDays < PT_DURATION_CONFIG.MIN_DAYS || durationDays > PT_DURATION_CONFIG.MAX_DAYS) {
    return {
      isValid: false,
      durationDays,
      error: `اشتراكات البرايفت يجب أن تكون شهر واحد فقط. المدة المحددة: ${durationDays} يوم`
    }
  }

  return {
    isValid: true,
    durationDays,
  }
}

/**
 * حساب تاريخ الانتهاء بعد شهر واحد بالضبط من تاريخ البداية
 * @param startDate - تاريخ البداية
 * @returns تاريخ الانتهاء (بعد شهر واحد)
 */
export function calculateOneMonthExpiry(startDate: Date | string): Date {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const expiry = new Date(start)
  expiry.setMonth(expiry.getMonth() + PT_DURATION_CONFIG.STANDARD_MONTHS)
  return expiry
}
