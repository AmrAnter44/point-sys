'use client'

import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

interface BarcodeWhatsAppProps {
  memberNumber: number
  memberName: string
  memberPhone: string
}

export default function BarcodeWhatsApp({ memberNumber, memberName, memberPhone }: BarcodeWhatsAppProps) {
  const { t, direction } = useLanguage()
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [barcodeImage, setBarcodeImage] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [popup, setPopup] = useState<{ show: boolean; type: 'success' | 'error' | 'warning'; message: string }>({
    show: false,
    type: 'success',
    message: ''
  })

  const showPopup = (type: 'success' | 'error' | 'warning', message: string) => {
    setPopup({ show: true, type, message });
    setTimeout(() => {
      setPopup({ show: false, type: 'success', message: '' });
    }, 3000);
  };

  // توليد الباركود عن طريق API
  const handleGenerateBarcode = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: memberNumber.toString() }),
      })

      const data = await res.json()
      if (data.barcode) {
        setBarcodeImage(data.barcode)
        setShowBarcodeModal(true)
      } else {
        showPopup('error', t('barcode.errorGenerating'))
      }
    } catch (error) {
      console.error('Error generating barcode:', error)
      showPopup('error', t('barcode.errorGenerating'))
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadBarcode = () => {
    if (!barcodeImage) return
    const a = document.createElement('a')
    a.href = barcodeImage
    a.download = `barcode-${memberNumber}.png`
    a.click()
  }

  const handleSendBarcode = () => {
    if (!barcodeImage) {
      showPopup('warning', t('barcode.mustGenerateFirst'))
      return
    }

    handleDownloadBarcode()

    setTimeout(() => {
      const baseMessage = t('barcode.whatsappMessage', { memberNumber: memberNumber.toString(), memberName })

      // إضافة الشروط والأحكام
      const termsAndConditions = `\n\n━━━━━━━━━━━━━━━━━━━━\n*شروط وأحكام*\n━━━━━━━━━━━━━━━━━━━━\nالساده الاعضاء حرصا منا على تقديم خدمه افضل وحفاظا على سير النظام العام للمكان بشكل مرضى يرجى الالتزام بالتعليمات الاتيه :\n\n١- الاشتراك لا يرد الا خلال ٢٤ ساعه بعد خصم قيمه الحصه\n٢- لا يجوز التمرين بخلاف الزى الرياضى\n٣- ممنوع اصطحاب الاطفال او الماكولات داخل الجيم\n٤- الاداره غير مسئوله عن المتعلقات الشخصيه`

      const message = baseMessage + termsAndConditions
      const phone = memberPhone.replace(/\D/g, '') // تنظيف رقم الهاتف
      const url = `https://wa.me/2${phone}?text=${encodeURIComponent(message)}`
      window.open(url, '_blank')

      showPopup('success', t('barcode.downloadedOpenWhatsApp'))
    }, 500)
  }

  return (
    <>
      {/* زر عرض/إرسال الباركود - أيقونة صغيرة */}
      <button
        onClick={handleGenerateBarcode}
        disabled={loading}
        className="bg-white bg-opacity-20 hover:bg-opacity-30 p-1.5 rounded-lg transition-all disabled:opacity-50"
        title={t('barcode.viewBarcode')}
      >
        <span className="text-lg">📱</span>
      </button>

      {/* Modal عرض الباركود */}
      {showBarcodeModal && barcodeImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowBarcodeModal(false) }}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-4" onClick={(e) => e.stopPropagation()} dir={direction}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold">🔢 {t('barcode.membershipBarcode')}</h3>
              <button
                onClick={() => setShowBarcodeModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-center">
              <p className="text-xs text-blue-600 mb-1">{t('barcode.member')}</p>
              <p className="text-base font-bold text-blue-800">{memberName}</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">#{memberNumber}</p>
            </div>

            <div className="bg-white border border-blue-200 rounded-lg p-4 mb-3 flex justify-center">
              <div className="relative inline-block">
                {/* Barcode */}
                <img
                  src={barcodeImage}
                  alt={`Barcode ${memberNumber}`}
                  className="max-w-full h-auto"
                  style={{ minWidth: '250px' }}
                />

                {/* Logo في نص الباركود */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="bg-white rounded-lg shadow-lg p-2 border border-blue-400">
                    <img
                      src="/icon.png"
                      alt="Gym Logo"
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleDownloadBarcode}
                className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 text-sm font-bold flex items-center justify-center gap-2"
              >
                <span>💾</span>
                <span>{t('barcode.downloadImage')}</span>
              </button>

              <button
                onClick={() => {
                  handleSendBarcode()
                  setShowBarcodeModal(false)
                }}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 text-sm font-bold flex items-center justify-center gap-2"
              >
                <span>📲</span>
                <span>{t('barcode.downloadAndSendViaWhatsApp')}</span>
              </button>

              <button
                onClick={() => setShowBarcodeModal(false)}
                className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 text-sm font-bold"
              >
                {t('barcode.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup للرسائل */}
      {popup.show && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 10000 }}>
          <div
            className={`
              rounded-2xl shadow-2xl p-6 max-w-sm mx-4 transform transition-all duration-300
              ${popup.type === 'success' ? 'bg-gradient-to-br from-green-500 to-green-600' : ''}
              ${popup.type === 'error' ? 'bg-gradient-to-br from-red-500 to-red-600' : ''}
              ${popup.type === 'warning' ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' : ''}
            `}
          >
            <div className="flex items-center gap-4 text-white">
              <div className="text-5xl">
                {popup.type === 'success' && '✅'}
                {popup.type === 'error' && '❌'}
                {popup.type === 'warning' && '⚠️'}
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold">{popup.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
