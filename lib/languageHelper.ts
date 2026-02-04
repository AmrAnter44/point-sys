import { NextRequest } from 'next/server'

/**
 * استخراج اللغة من request headers أو cookies
 * الافتراضي: العربية
 */
export function getLanguageFromRequest(request: NextRequest): 'ar' | 'en' {
  // محاولة الحصول على اللغة من header
  const langHeader = request.headers.get('accept-language')

  // محاولة الحصول على اللغة من cookie
  const langCookie = request.cookies.get('language')?.value

  // إذا وجدت في cookie، استخدمها
  if (langCookie === 'ar' || langCookie === 'en') {
    return langCookie
  }

  // إذا وجدت في header وتحتوي على 'en'، استخدم الإنجليزية
  if (langHeader && langHeader.toLowerCase().includes('en')) {
    return 'en'
  }

  // الافتراضي: العربية
  return 'ar'
}
