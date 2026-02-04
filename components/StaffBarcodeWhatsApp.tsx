'use client'

import { useState } from 'react'

interface StaffBarcodeWhatsAppProps {
  staffCode: string
  staffName: string
  staffPhone?: string  // ✅ اختياري الآن
}

export default function StaffBarcodeWhatsApp({ staffCode, staffName, staffPhone }: StaffBarcodeWhatsAppProps) {
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
      // ✅ نستخرج الرقم من staffCode (بدون s أو S)
      // مثال: s22 -> 22, s001 -> 1, s444 -> 444
      const numericCode = staffCode.replace(/[sS]/g, '')

      // ✅ الموظفين: 9 أرقام (100000000 + الرقم)
      // s022 -> 100000022, s444 -> 100000444, s007 -> 100000007
      const barcodeText = (100000000 + parseInt(numericCode, 10)).toString()

      const res = await fetch('/api/barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: barcodeText }),
      })

      const data = await res.json()
      if (data.barcode) {
        setBarcodeImage(data.barcode)
        setShowBarcodeModal(true)
      } else {
        showPopup('error', 'حدث خطأ أثناء توليد الباركود')
      }
    } catch (error) {
      console.error('Error generating barcode:', error)
      showPopup('error', 'حدث خطأ أثناء توليد الباركود')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadBarcode = () => {
    if (!barcodeImage) return
    const a = document.createElement('a')
    a.href = barcodeImage
    a.download = `barcode-staff-${staffCode}.png`
    a.click()
  }

  const handleSendBarcode = () => {
    if (!barcodeImage) {
      showPopup('warning', 'يجب توليد الباركود أولاً')
      return
    }

    if (!staffPhone) {
      showPopup('warning', 'لا يوجد رقم هاتف لهذا الموظف')
      return
    }

    handleDownloadBarcode()

    setTimeout(() => {
      const displayCode = staffCode.toLowerCase().startsWith('s')
        ? staffCode.toUpperCase()
        : `S${staffCode}`
      const message = `Barcode الموظف #${displayCode} (${staffName})\n\n🌐 *الموقع الإلكتروني:*\nhttps://www.xgym.website/`
      const phone = staffPhone.replace(/\D/g, '') // تنظيف رقم الهاتف
      const url = `https://wa.me/2${phone}?text=${encodeURIComponent(message)}`
      window.open(url, '_blank')

      showPopup('success', 'تم تحميل صورة الباركود! سيتم فتح واتساب الآن')
    }, 500)
  }

  return (
    <>
      {/* أزرار مدمجة صغيرة */}
      <div className="flex gap-2">
        {/* زر عرض الباركود - يظهر للجميع */}
        <button
          onClick={handleGenerateBarcode}
          disabled={loading}
          className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm flex items-center gap-1"
          title="عرض Barcode"
        >
          🔢
        </button>

        {/* زر واتساب - يظهر فقط للموظفين الذين لديهم رقم هاتف */}
        {staffPhone && (
          <button
            onClick={handleSendBarcode}
            disabled={loading}
            className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm flex items-center gap-1"
            title="إرسال Barcode عبر واتساب"
          >
            📲
          </button>
        )}
      </div>

      {/* Modal عرض الباركود */}
      {showBarcodeModal && barcodeImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowBarcodeModal(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">🔢 Barcode الموظف</h3>
              <button
                onClick={() => setShowBarcodeModal(false)}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-6 text-center">
              <p className="text-sm text-purple-600 mb-2">الموظف</p>
              <p className="text-xl font-bold text-purple-800">{staffName}</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">
                #{staffCode.toLowerCase().startsWith('s') ? staffCode.toUpperCase() : `S${staffCode}`}
              </p>
            </div>

            {/* Logo أعلى الباركود */}
            <div className="flex justify-center mb-4">
              <div className="bg-white rounded-lg shadow-lg p-3 border-2 border-purple-400">
                <img
                  src="/icon.png"
                  alt="Gym Logo"
                  className="w-16 h-16 object-contain"
                />
              </div>
            </div>

            {/* الباركود بدون تداخل */}
            <div className="bg-white border-2 border-purple-200 rounded-lg p-6 mb-6 flex justify-center">
              <img
                src={barcodeImage}
                alt={`Barcode S${staffCode}`}
                className="max-w-full h-auto"
                style={{ minWidth: '300px' }}
              />
            </div>

            <div className="space-y-3">
              <button
                onClick={handleDownloadBarcode}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-bold flex items-center justify-center gap-2"
              >
                <span>💾</span>
                <span>تحميل الصورة</span>
              </button>

              {/* زر واتساب - يظهر فقط إذا كان هناك رقم هاتف */}
              {staffPhone && (
                <button
                  onClick={() => {
                    handleSendBarcode()
                    setShowBarcodeModal(false)
                  }}
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold flex items-center justify-center gap-2"
                >
                  <span>📲</span>
                  <span>تحميل وإرسال عبر واتساب</span>
                </button>
              )}

              <button
                onClick={() => setShowBarcodeModal(false)}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-bold"
              >
                إغلاق
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
