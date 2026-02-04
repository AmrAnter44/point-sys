// components/LicenseBlocker.tsx
// Full-screen blocking modal when license is invalid

'use client'

import { useLicense } from '../contexts/LicenseContext'

export function LicenseBlocker() {
  const { licenseState, recheckLicense } = useLicense()

  // لا تعرض شيء إذا كان قيد التحميل أو صالح
  if (licenseState.isLoading || licenseState.isValid) {
    return null
  }

  // عرض modal القفل
  console.log('🚫 License Blocker ACTIVATED - Displaying lock screen')
  console.log('   Message:', licenseState.message)
  console.log('   Error:', licenseState.error)

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      style={{ zIndex: 99999 }}
    >
      <div className="max-w-2xl mx-4 bg-gradient-to-br from-red-600 to-red-800 rounded-3xl shadow-2xl p-8 text-white">
        {/* Icon */}
        <div className="text-center mb-6">
          <div className="text-8xl mb-4">🔒</div>
          <h1 className="text-4xl font-black mb-2">النظام معطل</h1>
          <p className="text-xl opacity-90">System Locked</p>
        </div>




        {/* Recheck Button */}
        <div className="text-center mb-6">
          <button
            onClick={() => {
              console.log('🔄 User clicked recheck button')
              recheckLicense()
            }}
            disabled={licenseState.isLoading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed transition px-8 py-3 rounded-xl font-bold text-lg w-full"
          >
            {licenseState.isLoading ? '⏳ جاري التحقق...' : '🔄 إعادة التحقق من الترخيص'}
          </button>
        </div>

        {/* Contact Info */}
        <div className="text-center space-y-2">
          <p className="text-sm opacity-75">للحصول على المساعدة، يرجى التواصل:</p>
          <div className="flex flex-col gap-2">
            <a
              href="tel:+201028518754"
              className="bg-white/20 hover:bg-white/30 transition px-6 py-3 rounded-xl font-bold"
            >
              📞 اتصل بنا
            </a>
            <a
              href="https://wa.me/201028518754"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-600 transition px-6 py-3 rounded-xl font-bold"
            >
              💬 واتساب
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-white/20 text-center">

        </div>
      </div>
    </div>
  )
}
