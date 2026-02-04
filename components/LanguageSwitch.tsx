'use client'

import { useLanguage } from '../contexts/LanguageContext'

export default function LanguageSwitch() {
  const { locale, setLanguage } = useLanguage()

  return (
    <button
      onClick={() => setLanguage(locale === 'ar' ? 'en' : 'ar')}
      className="w-9 h-9 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-all hover:scale-110 active:scale-95 flex items-center justify-center font-bold flex-shrink-0 border border-white/20 shadow-lg"
      title={locale === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
    >
      <span className="text-xs font-bold">
        {locale === 'ar' ? 'EN' : 'عر'}
      </span>
    </button>
  )
}
