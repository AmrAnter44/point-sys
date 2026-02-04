# خطة تنفيذ نظام اللغات المتعددة (i18n) لنظام X GYM

## 📋 ملخص المتطلبات

**الهدف:** إضافة نظام ترجمة متكامل يدعم اللغتين العربية والإنجليزية

**التفضيلات:**
- ✅ صفحة إعدادات مخصصة `/settings`
- ✅ حفظ اللغة في `localStorage`
- ✅ العربية كلغة افتراضية
- ✅ ترجمة شاملة لجميع الصفحات

---

## 🎯 المرحلة 1: اختيار المكتبة وإعدادها

### اختيار المكتبة: next-intl ✅

**لماذا next-intl؟**
- ✅ مصممة خصيصاً لـ Next.js 14 App Router
- ✅ دعم كامل لـ Server Components و Client Components
- ✅ خفيفة الوزن وسريعة
- ✅ دعم RTL/LTR تلقائي
- ✅ TypeScript support كامل
- ✅ دعم ممتاز للتواريخ والأرقام

**المقارنة مع react-i18next:**
| الميزة | next-intl | react-i18next |
|--------|-----------|---------------|
| Next.js 14 Support | ممتاز ✅ | جيد ⚠️ |
| App Router | دعم كامل | يحتاج wrapper |
| Server Components | دعم أصلي | معقد |
| الحجم | 14KB | 40KB+ |
| RTL Support | مدمج | يدوي |

### خطوات التثبيت

```bash
npm install next-intl
```

---

## 🏗️ المرحلة 2: البنية المقترحة

### هيكل الملفات الجديد

```
x gym/
├── messages/                    # 📁 ملفات الترجمة
│   ├── ar.json                 # العربية (افتراضي)
│   └── en.json                 # الإنجليزية
│
├── contexts/
│   ├── AdminDateContext.tsx
│   └── LanguageContext.tsx     # 🆕 Context للغة
│
├── app/
│   ├── settings/               # 🆕 صفحة الإعدادات
│   │   └── page.tsx
│   ├── layout.tsx              # ✏️ تعديل لدعم dir & lang
│   └── ...
│
├── components/
│   ├── LanguageSwitch.tsx      # 🆕 مكون تغيير اللغة
│   └── ...
│
├── lib/
│   └── i18n.ts                 # 🆕 تكوين i18n
│
└── middleware.ts                # ✏️ تعديل للغة
```

### تنظيم مفاتيح الترجمة

سنستخدم نهج **الملفات المنفصلة حسب القسم** داخل ملف JSON واحد:

```json
{
  "common": {
    "save": "حفظ",
    "cancel": "إلغاء",
    "delete": "حذف",
    "edit": "تعديل",
    "add": "إضافة",
    "search": "بحث",
    "loading": "جاري التحميل..."
  },
  "nav": {
    "home": "الرئيسية",
    "members": "الأعضاء",
    "pt": "PT",
    "coach": "كوتش",
    "staff": "الموظفين"
  },
  "auth": {
    "login": "تسجيل الدخول",
    "logout": "تسجيل الخروج",
    "email": "البريد الإلكتروني",
    "password": "كلمة المرور"
  },
  "members": {
    "title": "الأعضاء",
    "addMember": "إضافة عضو جديد",
    "membershipNumber": "رقم العضوية",
    "name": "الاسم",
    "phone": "رقم الهاتف"
  },
  "settings": {
    "title": "الإعدادات",
    "language": "اللغة",
    "changeLanguage": "تغيير اللغة",
    "arabic": "العربية",
    "english": "English"
  }
}
```

---

## 🔧 المرحلة 3: التنفيذ التقني التفصيلي

### 3.1 إنشاء ملفات الترجمة

**الملف: `messages/ar.json`**
```json
{
  "common": {
    "save": "حفظ",
    "cancel": "إلغاء",
    "delete": "حذف",
    "edit": "تعديل",
    "add": "إضافة",
    "search": "بحث",
    "filter": "فلتر",
    "print": "طباعة",
    "export": "تصدير",
    "close": "إغلاق",
    "confirm": "تأكيد",
    "loading": "جاري التحميل...",
    "success": "تم بنجاح",
    "error": "حدث خطأ",
    "required": "مطلوب",
    "optional": "اختياري",
    "yes": "نعم",
    "no": "لا",
    "back": "رجوع",
    "next": "التالي",
    "previous": "السابق",
    "submit": "إرسال",
    "view": "عرض",
    "details": "التفاصيل",
    "noResults": "لا توجد نتائج"
  },
  "nav": {
    "home": "الرئيسية",
    "members": "الأعضاء",
    "pt": "PT",
    "coach": "كوتش",
    "rotations": "المناوبات",
    "dayUse": "يوم استخدام",
    "invitations": "الدعوات",
    "staff": "الموظفين",
    "receipts": "الإيصالات",
    "expenses": "المصروفات",
    "visitors": "الزوار",
    "followups": "المتابعات",
    "search": "البحث",
    "offers": "العروض",
    "closing": "التقفيل",
    "staffAttendance": "حضور موظفين",
    "memberAttendance": "حضور أعضاء",
    "settings": "الإعدادات"
  },
  "auth": {
    "login": "تسجيل الدخول",
    "logout": "تسجيل الخروج",
    "email": "البريد الإلكتروني",
    "password": "كلمة المرور",
    "loggingIn": "جاري تسجيل الدخول...",
    "loginFailed": "فشل تسجيل الدخول",
    "connectionError": "حدث خطأ في الاتصال",
    "gymSystem": "نظام إدارة الجيم",
    "welcome": "مرحباً {name}"
  },
  "members": {
    "title": "الأعضاء",
    "addMember": "إضافة عضو جديد",
    "editMember": "تعديل بيانات العضو",
    "memberDetails": "تفاصيل العضو",
    "membershipNumber": "رقم العضوية",
    "name": "الاسم",
    "phone": "رقم الهاتف",
    "email": "البريد الإلكتروني",
    "startDate": "تاريخ البداية",
    "endDate": "تاريخ الانتهاء",
    "subscriptionPrice": "سعر الاشتراك",
    "remainingAmount": "المبلغ المتبقي",
    "paymentMethod": "طريقة الدفع",
    "cash": "كاش",
    "visa": "فيزا",
    "instapay": "InstaPay",
    "status": "الحالة",
    "active": "نشط",
    "expired": "منتهي",
    "expiringSoon": "ينتهي قريباً",
    "hasRemaining": "عليهم متبقي",
    "notes": "ملاحظات",
    "inbody": "InBody",
    "invitations": "دعوات",
    "freePTSessions": "حصص PT مجانية",
    "memberSavedSuccessfully": "تم حفظ بيانات العضو بنجاح",
    "memberDeletedSuccessfully": "تم حذف العضو بنجاح",
    "errorSavingMember": "حدث خطأ أثناء حفظ بيانات العضو",
    "confirmDelete": "هل أنت متأكد من حذف هذا العضو؟",
    "renewalForm": "تجديد الاشتراك",
    "searchMembers": "البحث عن عضو..."
  },
  "settings": {
    "title": "الإعدادات",
    "language": "اللغة",
    "languageSettings": "إعدادات اللغة",
    "changeLanguage": "تغيير اللغة",
    "currentLanguage": "اللغة الحالية",
    "selectLanguage": "اختر اللغة",
    "arabic": "العربية 🇸🇦",
    "english": "English 🇬🇧",
    "languageChangedSuccessfully": "تم تغيير اللغة بنجاح",
    "restartRequired": "قد تحتاج لإعادة تحميل الصفحة لتطبيق التغييرات",
    "generalSettings": "الإعدادات العامة",
    "systemSettings": "إعدادات النظام",
    "appearance": "المظهر",
    "preferences": "التفضيلات"
  },
  "dashboard": {
    "title": "لوحة التحكم",
    "welcome": "مرحباً {name}",
    "welcomeMessage": "نظام شامل وسريع لإدارة جميع عمليات الصالة الرياضية",
    "quickStats": "إحصائيات سريعة",
    "todayRevenue": "إيرادات اليوم",
    "activeMembers": "الأعضاء النشطون",
    "newMembers": "أعضاء جدد",
    "expiringMembers": "ينتهي قريباً"
  },
  "permissions": {
    "deniedTitle": "ممنوع الدخول",
    "deniedMessage": "ليس لديك صلاحية عرض هذه الصفحة",
    "backToHome": "العودة للرئيسية"
  },
  "validation": {
    "required": "هذا الحقل مطلوب",
    "invalidEmail": "البريد الإلكتروني غير صحيح",
    "invalidPhone": "رقم الهاتف غير صحيح",
    "minLength": "يجب أن يكون الحد الأدنى {min} أحرف",
    "maxLength": "يجب أن يكون الحد الأقصى {max} أحرف",
    "numberOnly": "يجب إدخال أرقام فقط",
    "positiveNumber": "يجب أن يكون رقماً موجباً"
  },
  "time": {
    "today": "اليوم",
    "yesterday": "أمس",
    "thisWeek": "هذا الأسبوع",
    "thisMonth": "هذا الشهر",
    "lastMonth": "الشهر الماضي",
    "custom": "مخصص",
    "from": "من",
    "to": "إلى",
    "date": "التاريخ",
    "time": "الوقت",
    "dateTime": "التاريخ والوقت"
  }
}
```

**الملف: `messages/en.json`**
```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "add": "Add",
    "search": "Search",
    "filter": "Filter",
    "print": "Print",
    "export": "Export",
    "close": "Close",
    "confirm": "Confirm",
    "loading": "Loading...",
    "success": "Success",
    "error": "Error",
    "required": "Required",
    "optional": "Optional",
    "yes": "Yes",
    "no": "No",
    "back": "Back",
    "next": "Next",
    "previous": "Previous",
    "submit": "Submit",
    "view": "View",
    "details": "Details",
    "noResults": "No results found"
  },
  "nav": {
    "home": "Home",
    "members": "Members",
    "pt": "PT",
    "coach": "Coach",
    "rotations": "Rotations",
    "dayUse": "Day Use",
    "invitations": "Invitations",
    "staff": "Staff",
    "receipts": "Receipts",
    "expenses": "Expenses",
    "visitors": "Visitors",
    "followups": "Follow-ups",
    "search": "Search",
    "offers": "Offers",
    "closing": "Closing",
    "staffAttendance": "Staff Attendance",
    "memberAttendance": "Member Attendance",
    "settings": "Settings"
  },
  "auth": {
    "login": "Login",
    "logout": "Logout",
    "email": "Email",
    "password": "Password",
    "loggingIn": "Logging in...",
    "loginFailed": "Login failed",
    "connectionError": "Connection error occurred",
    "gymSystem": "Gym Management System",
    "welcome": "Welcome {name}"
  },
  "members": {
    "title": "Members",
    "addMember": "Add New Member",
    "editMember": "Edit Member",
    "memberDetails": "Member Details",
    "membershipNumber": "Membership Number",
    "name": "Name",
    "phone": "Phone Number",
    "email": "Email",
    "startDate": "Start Date",
    "endDate": "End Date",
    "subscriptionPrice": "Subscription Price",
    "remainingAmount": "Remaining Amount",
    "paymentMethod": "Payment Method",
    "cash": "Cash",
    "visa": "Visa",
    "instapay": "InstaPay",
    "status": "Status",
    "active": "Active",
    "expired": "Expired",
    "expiringSoon": "Expiring Soon",
    "hasRemaining": "Has Balance",
    "notes": "Notes",
    "inbody": "InBody",
    "invitations": "Invitations",
    "freePTSessions": "Free PT Sessions",
    "memberSavedSuccessfully": "Member saved successfully",
    "memberDeletedSuccessfully": "Member deleted successfully",
    "errorSavingMember": "Error saving member",
    "confirmDelete": "Are you sure you want to delete this member?",
    "renewalForm": "Renewal Form",
    "searchMembers": "Search members..."
  },
  "settings": {
    "title": "Settings",
    "language": "Language",
    "languageSettings": "Language Settings",
    "changeLanguage": "Change Language",
    "currentLanguage": "Current Language",
    "selectLanguage": "Select Language",
    "arabic": "العربية 🇸🇦",
    "english": "English 🇬🇧",
    "languageChangedSuccessfully": "Language changed successfully",
    "restartRequired": "You may need to reload the page to apply changes",
    "generalSettings": "General Settings",
    "systemSettings": "System Settings",
    "appearance": "Appearance",
    "preferences": "Preferences"
  },
  "dashboard": {
    "title": "Dashboard",
    "welcome": "Welcome {name}",
    "welcomeMessage": "Comprehensive and fast system for managing all gym operations",
    "quickStats": "Quick Stats",
    "todayRevenue": "Today's Revenue",
    "activeMembers": "Active Members",
    "newMembers": "New Members",
    "expiringMembers": "Expiring Soon"
  },
  "permissions": {
    "deniedTitle": "Access Denied",
    "deniedMessage": "You don't have permission to view this page",
    "backToHome": "Back to Home"
  },
  "validation": {
    "required": "This field is required",
    "invalidEmail": "Invalid email",
    "invalidPhone": "Invalid phone number",
    "minLength": "Minimum length is {min} characters",
    "maxLength": "Maximum length is {max} characters",
    "numberOnly": "Numbers only",
    "positiveNumber": "Must be a positive number"
  },
  "time": {
    "today": "Today",
    "yesterday": "Yesterday",
    "thisWeek": "This Week",
    "thisMonth": "This Month",
    "lastMonth": "Last Month",
    "custom": "Custom",
    "from": "From",
    "to": "To",
    "date": "Date",
    "time": "Time",
    "dateTime": "Date & Time"
  }
}
```

### 3.2 إنشاء LanguageContext

**الملف: `contexts/LanguageContext.tsx`**

```typescript
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Language = 'ar' | 'en'
type Direction = 'rtl' | 'ltr'

interface LanguageContextType {
  locale: Language
  direction: Direction
  setLanguage: (lang: Language) => void
  t: (key: string, params?: Record<string, string>) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Language>('ar')
  const [messages, setMessages] = useState<any>({})

  useEffect(() => {
    // جلب اللغة المحفوظة من localStorage
    const savedLocale = localStorage.getItem('locale') as Language
    if (savedLocale && (savedLocale === 'ar' || savedLocale === 'en')) {
      setLocale(savedLocale)
    }
  }, [])

  useEffect(() => {
    // تحميل ملف الترجمة المناسب
    import(`../messages/${locale}.json`).then((msgs) => {
      setMessages(msgs.default)
    })

    // تحديث dir و lang في html
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  const setLanguage = (lang: Language) => {
    setLocale(lang)
    localStorage.setItem('locale', lang)
  }

  // دالة الترجمة البسيطة
  const t = (key: string, params?: Record<string, string>): string => {
    const keys = key.split('.')
    let value: any = messages

    for (const k of keys) {
      value = value?.[k]
    }

    if (typeof value !== 'string') {
      console.warn(`Translation missing for key: ${key}`)
      return key
    }

    // استبدال المتغيرات
    if (params) {
      Object.entries(params).forEach(([param, val]) => {
        value = value.replace(`{${param}}`, val)
      })
    }

    return value
  }

  const direction: Direction = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <LanguageContext.Provider value={{ locale, direction, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
```

### 3.3 تعديل app/layout.tsx

```typescript
import './globals.css'
import type { Metadata } from 'next'
import ClientLayout from '../components/ClientLayout'

export const metadata: Metadata = {
  title: 'نظام إدارة الصالة الرياضية - X GYM',
  description: 'نظام شامل لإدارة صالات الرياضة مع البحث السريع',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // ⚠️ سنزيل lang و dir من هنا لأن LanguageContext سيتولاها
    <html>
      <head>
        <link rel="icon" href="/icon.png" />
      </head>
      <body className="bg-gray-50 min-h-screen">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
```

### 3.4 تعديل ClientLayout.tsx

```typescript
'use client'

import { AdminDateProvider } from '../contexts/AdminDateContext'
import { LanguageProvider } from '../contexts/LanguageContext'
import Navbar from './Navbar'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AdminDateProvider>
        <Navbar />
        <main className="pt-20 px-4">
          {children}
        </main>
      </AdminDateProvider>
    </LanguageProvider>
  )
}
```

### 3.5 إنشاء مكون LanguageSwitch

**الملف: `components/LanguageSwitch.tsx`**

```typescript
'use client'

import { useLanguage } from '../contexts/LanguageContext'

export default function LanguageSwitch() {
  const { locale, setLanguage, t } = useLanguage()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLanguage(locale === 'ar' ? 'en' : 'ar')}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition flex items-center gap-2"
        title={t('settings.changeLanguage')}
      >
        <span className="text-lg">🌐</span>
        <span className="font-medium">
          {locale === 'ar' ? 'EN' : 'عربي'}
        </span>
      </button>
    </div>
  )
}
```

### 3.6 إنشاء صفحة الإعدادات

**الملف: `app/settings/page.tsx`**

```typescript
'use client'

import { useLanguage } from '../../contexts/LanguageContext'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionDenied from '../../components/PermissionDenied'

export default function SettingsPage() {
  const { locale, setLanguage, t } = useLanguage()
  const { hasPermission } = usePermissions()

  // فقط الأدمن والموظفين يمكنهم الوصول للإعدادات (اختياري)
  // يمكنك تغيير هذا حسب احتياجاتك
  if (!hasPermission('canAccessSettings')) {
    return <PermissionDenied />
  }

  const handleLanguageChange = (newLocale: 'ar' | 'en') => {
    setLanguage(newLocale)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        {/* العنوان */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <span>⚙️</span>
            <span>{t('settings.title')}</span>
          </h1>
          <p className="text-gray-600 mt-2">{t('settings.systemSettings')}</p>
        </div>

        {/* قسم اللغة */}
        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>🌐</span>
            <span>{t('settings.languageSettings')}</span>
          </h2>

          <div className="bg-gray-50 rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('settings.currentLanguage')}
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* زر العربية */}
              <button
                onClick={() => handleLanguageChange('ar')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  locale === 'ar'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🇸🇦</span>
                  <div className="text-right flex-1">
                    <div className="font-bold text-lg">العربية</div>
                    <div className="text-sm text-gray-600">Arabic</div>
                  </div>
                  {locale === 'ar' && (
                    <span className="text-blue-500 text-xl">✓</span>
                  )}
                </div>
              </button>

              {/* زر الإنجليزية */}
              <button
                onClick={() => handleLanguageChange('en')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  locale === 'en'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🇬🇧</span>
                  <div className="text-left flex-1">
                    <div className="font-bold text-lg">English</div>
                    <div className="text-sm text-gray-600">الإنجليزية</div>
                  </div>
                  {locale === 'en' && (
                    <span className="text-blue-500 text-xl">✓</span>
                  )}
                </div>
              </button>
            </div>

            {/* رسالة نجاح */}
            <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg text-green-800 text-sm">
              ℹ️ {t('settings.languageChangedSuccessfully')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 3.7 تعديل Navbar لإضافة زر الإعدادات

في الملف `components/Navbar.tsx`، أضف:

```typescript
// في قسم allLinks
const allLinks = [
  // ... الروابط الموجودة
  { href: '/settings', label: 'الإعدادات', icon: '⚙️', permission: null, roleRequired: null },
]
```

---

## 📝 المرحلة 4: استراتيجية الترجمة

### طريقة الاستخدام في الكود

**قبل:**
```typescript
<h1>الرئيسية</h1>
<button>حفظ</button>
<p>مرحباً {user?.name}</p>
```

**بعد:**
```typescript
import { useLanguage } from '../contexts/LanguageContext'

const { t } = useLanguage()

<h1>{t('nav.home')}</h1>
<button>{t('common.save')}</button>
<p>{t('auth.welcome', { name: user?.name })}</p>
```

### مثال كامل: تحويل صفحة Login

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../contexts/LanguageContext'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (response.ok) {
        const redirectUrl = data.user?.role === 'COACH' ? '/coach' : '/members'
        window.location.href = redirectUrl
      } else {
        setError(data.error || t('auth.loginFailed'))
      }
    } catch (error) {
      setError(t('auth.connectionError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold text-gray-800">{t('auth.login')}</h1>
          <p className="text-gray-600 mt-2">{t('auth.gymSystem')}</p>
        </div>

        {error && (
          <div className="bg-red-100 border-r-4 border-red-500 text-red-700 p-4 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('auth.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="email"
              required
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition font-bold text-lg"
          >
            {loading ? t('auth.loggingIn') : t('auth.login')}
          </button>
        </form>
      </div>
    </div>
  )
}
```

---

## 🎯 المرحلة 5: الملفات الحرجة والأولويات

### المستوى 1 - حرج جداً (يجب البدء بهم)

1. ✅ **contexts/LanguageContext.tsx** - إنشاء Context
2. ✅ **messages/ar.json** - ملف الترجمة العربي
3. ✅ **messages/en.json** - ملف الترجمة الإنجليزي
4. ✅ **components/ClientLayout.tsx** - لف التطبيق بالـ Provider
5. ✅ **app/layout.tsx** - إزالة lang و dir الثابتين
6. ✅ **app/settings/page.tsx** - صفحة الإعدادات
7. ✅ **components/LanguageSwitch.tsx** - مكون تغيير اللغة

### المستوى 2 - مهم (الصفحات الرئيسية)

8. **app/page.tsx** - الصفحة الرئيسية
9. **app/login/page.tsx** - صفحة تسجيل الدخول
10. **components/Navbar.tsx** - شريط التنقل
11. **app/members/page.tsx** - صفحة الأعضاء
12. **components/MemberForm.tsx** - نموذج الأعضاء
13. **components/PermissionDenied.tsx** - صفحة عدم الصلاحية

### المستوى 3 - متوسط (باقي الصفحات)

14. **app/pt/page.tsx**
15. **app/staff/page.tsx**
16. **app/receipts/page.tsx**
17. **app/expenses/page.tsx**
18. **app/visitors/page.tsx**
19. **app/followups/page.tsx**
20. وباقي الصفحات...

### المستوى 4 - منخفض (المكونات الفرعية)

21. **components/RenewalForm.tsx**
22. **components/PTRenewalForm.tsx**
23. **components/MemberDetails.tsx**
24. وباقي المكونات...

---

## 🌍 المرحلة 6: اعتبارات خاصة

### 6.1 التواريخ والأرقام

```typescript
// في LanguageContext أو helper منفصل

export const formatDate = (date: Date, locale: 'ar' | 'en') => {
  return date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export const formatTime = (date: Date, locale: 'ar' | 'en') => {
  return date.toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const formatNumber = (num: number, locale: 'ar' | 'en') => {
  return num.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')
}

export const formatCurrency = (amount: number, locale: 'ar' | 'en') => {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: 'EGP'
  }).format(amount)
}
```

### 6.2 Tailwind RTL Support

أضف في `tailwind.config.ts`:

```typescript
module.exports = {
  // ...
  plugins: [
    // إذا احتجت plugin خاص للـ RTL
  ],
}
```

استخدم:
```typescript
// بدلاً من ml-4
className="ms-4" // margin-inline-start

// بدلاً من mr-4
className="me-4" // margin-inline-end

// بدلاً من text-left
className="text-start"

// بدلاً من text-right
className="text-end"
```

### 6.3 الرموز التعبيرية (Emojis)

الـ Emojis عالمية ولا تحتاج ترجمة، لكن يمكنك تغيير بعضها:

```json
{
  "nav": {
    "home": {
      "ar": "🏠 الرئيسية",
      "en": "🏠 Home"
    }
  }
}
```

---

## ✅ المرحلة 7: خطة التنفيذ بالترتيب

### الأسبوع 1: الإعداد الأساسي

- [ ] 1. إنشاء مجلد `messages/`
- [ ] 2. إنشاء `messages/ar.json` مع الترجمات الأساسية
- [ ] 3. إنشاء `messages/en.json` مع الترجمات الأساسية
- [ ] 4. إنشاء `contexts/LanguageContext.tsx`
- [ ] 5. تعديل `components/ClientLayout.tsx` لإضافة LanguageProvider
- [ ] 6. تعديل `app/layout.tsx` لإزالة lang و dir الثابتين
- [ ] 7. إنشاء `components/LanguageSwitch.tsx`
- [ ] 8. إنشاء `app/settings/page.tsx`
- [ ] 9. اختبار تبديل اللغة

### الأسبوع 2: الصفحات الرئيسية

- [ ] 10. ترجمة `app/page.tsx` (الرئيسية)
- [ ] 11. ترجمة `app/login/page.tsx`
- [ ] 12. ترجمة `components/Navbar.tsx`
- [ ] 13. ترجمة `components/PermissionDenied.tsx`
- [ ] 14. اختبار التنقل بين الصفحات

### الأسبوع 3: صفحات الأعضاء

- [ ] 15. ترجمة `app/members/page.tsx`
- [ ] 16. ترجمة `components/MemberForm.tsx`
- [ ] 17. ترجمة `components/MemberDetails.tsx`
- [ ] 18. اختبار صفحات الأعضاء

### الأسبوع 4: باقي الصفحات

- [ ] 19. ترجمة صفحات PT
- [ ] 20. ترجمة صفحات Staff
- [ ] 21. ترجمة صفحات Receipts & Expenses
- [ ] 22. ترجمة صفحات Visitors & Followups

### الأسبوع 5: المراجعة والاختبار

- [ ] 23. مراجعة جميع الترجمات
- [ ] 24. اختبار RTL/LTR
- [ ] 25. اختبار التواريخ والأرقام
- [ ] 26. إصلاح أي مشاكل في التنسيق
- [ ] 27. اختبار النظام بالكامل

---

## 🚀 كيفية البدء

1. **قم بتثبيت next-intl** (اختياري - نحن نستخدم حل مخصص)
2. **أنشئ الملفات الأساسية** (messages/, LanguageContext)
3. **اختبر التبديل** بين اللغتين
4. **ابدأ الترجمة** صفحة تلو الأخرى
5. **راجع واختبر** كل صفحة

---

## 📌 ملاحظات مهمة

1. **localStorage** يحفظ اللغة لكل متصفح - إذا أردت مزامنة عبر الأجهزة، استخدم قاعدة البيانات
2. **RTL/LTR** يتبدل تلقائياً عند تغيير اللغة
3. **التواريخ والأرقام** تحتاج معالجة خاصة (ar-EG vs en-US)
4. **الترجمات** يجب أن تكون دقيقة ومفهومة للمستخدمين
5. **الاختبار** مهم جداً للتأكد من عدم كسر أي ميزة

---

## 🎯 النتيجة المتوقعة

بعد التنفيذ، سيكون لديك:

✅ نظام ترجمة كامل بالعربية والإنجليزية
✅ صفحة إعدادات احترافية لتغيير اللغة
✅ حفظ تلقائي للغة المختارة في localStorage
✅ تبديل تلقائي لاتجاه النص (RTL/LTR)
✅ دعم كامل للتواريخ والأرقام بكلا اللغتين
✅ تجربة مستخدم سلسة وسريعة

---

**هل أنت جاهز للبدء في التنفيذ؟** 🚀
