'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../../contexts/LanguageContext'

interface PTSession {
  ptNumber: number
  clientName: string
  phone: string
  sessionsRemaining: number
  coachName: string
}

export default function RegisterPTSessionPage() {
  const router = useRouter()
  const { t, locale, direction } = useLanguage()
  const [sessions, setSessions] = useState<PTSession[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [generatedQRCode, setGeneratedQRCode] = useState<string | null>(null)
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null)
  const [showQRModal, setShowQRModal] = useState(false)

  const [formData, setFormData] = useState({
    ptNumber: '',
    date: new Date().toISOString().split('T')[0], // التاريخ الحالي
    time: new Date().toTimeString().slice(0, 5), // الوقت الحالي
    notes: ''
  })

  useEffect(() => {
    fetchPTSessions()
    
    // قراءة ptNumber من URL إذا وجد
    const params = new URLSearchParams(window.location.search)
    const ptNumber = params.get('ptNumber')
    if (ptNumber) {
      setFormData(prev => ({
        ...prev,
        ptNumber: ptNumber
      }))
    }
  }, [])

  const fetchPTSessions = async () => {
    try {
      const response = await fetch('/api/pt')
      const data = await response.json()
      // فلترة الجلسات التي لديها جلسات متبقية فقط
      setSessions(data.filter((pt: PTSession) => pt.sessionsRemaining > 0))
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')

    try {
      // دمج التاريخ والوقت
      const sessionDateTime = `${formData.date}T${formData.time}:00`

      const response = await fetch('/api/pt/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ptNumber: parseInt(formData.ptNumber),
          sessionDate: sessionDateTime,
          notes: formData.notes
        })
      })

      const result = await response.json()

      if (response.ok) {
        setMessage(t('ptSessionRegister.messages.success'))

        // حفظ QR code وعرض النافذة المنبثقة
        if (result.qrCode) {
          setGeneratedQRCode(result.qrCode)
          setQrCodeImage(result.qrCodeImage || null)
          setShowQRModal(true)
        }

        // إعادة تعيين النموذج
        setFormData({
          ptNumber: '',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          notes: ''
        })

        // تحديث القائمة
        fetchPTSessions()

        // إخفاء الرسالة بعد 3 ثواني
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage(`❌ ${result.error || t('ptSessionRegister.messages.failed')}`)
      }
    } catch (error) {
      console.error(error)
      setMessage(t('ptSessionRegister.messages.connectionError'))
    } finally {
      setSubmitting(false)
    }
  }

  const selectPT = (pt: PTSession) => {
    setFormData({
      ...formData,
      ptNumber: pt.ptNumber.toString()
    })
  }

  // فلترة الجلسات حسب البحث
  const filteredSessions = sessions.filter(pt =>
    pt.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pt.ptNumber.toString().includes(searchTerm) ||
    pt.phone.includes(searchTerm)
  )

  const selectedPT = sessions.find(pt => pt.ptNumber.toString() === formData.ptNumber)

  return (
    <div className="container mx-auto p-6" dir={direction}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('ptSessionRegister.title')}</h1>
          <p className="text-gray-600">{t('ptSessionRegister.subtitle')}</p>
        </div>
        <button
          onClick={() => router.push('/pt/sessions/history')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          {t('ptSessionRegister.attendanceLog')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* قائمة الجلسات المتاحة */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">{t('ptSessionRegister.availableSessions')}</h2>

          <div className="mb-4">
            <input
              type="text"
              placeholder={t('ptSessionRegister.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">{t('ptSessionRegister.loading')}</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? t('ptSessionRegister.noResults') : t('ptSessionRegister.noSessions')}
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredSessions.map((pt) => (
                <div
                  key={pt.ptNumber}
                  onClick={() => selectPT(pt)}
                  className={`border rounded-lg p-4 cursor-pointer transition ${
                    formData.ptNumber === pt.ptNumber.toString()
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-lg">{pt.clientName}</h3>
                      <p className="text-sm text-gray-600">{pt.phone}</p>
                    </div>
                    <span className="bg-green-600 text-white px-3 py-1 rounded-full font-bold text-sm">
                      #{pt.ptNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">{t('ptSessionRegister.coach')} {pt.coachName}</span>
                    <span className={`font-bold ${pt.sessionsRemaining <= 3 ? 'text-red-600' : 'text-green-600'}`}>
                      {pt.sessionsRemaining} {t('ptSessionRegister.sessionsRemaining')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* نموذج التسجيل */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">{t('ptSessionRegister.attendanceData')}</h2>

          {message && (
            <div className={`mb-4 p-4 rounded-lg ${message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message}
            </div>
          )}

          {selectedPT && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-lg mb-2">{t('ptSessionRegister.selectedSession')}</h3>
              <div className="space-y-1">
                <p><span className="font-semibold">{t('ptSessionRegister.ptNumber')}:</span> #{selectedPT.ptNumber}</p>
                <p><span className="font-semibold">{t('ptSessionRegister.client')}</span> {selectedPT.clientName}</p>
                <p><span className="font-semibold">{t('ptSessionRegister.coach')}</span> {selectedPT.coachName}</p>
                <p><span className="font-semibold">{t('ptSessionRegister.sessionsRemainingLabel')}</span>
                  <span className={`font-bold ${locale === 'ar' ? 'mr-2' : 'ml-2'} ${selectedPT.sessionsRemaining <= 3 ? 'text-red-600' : 'text-green-600'}`}>
                    {selectedPT.sessionsRemaining}
                  </span>
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('ptSessionRegister.ptNumberInput')} <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                required
                value={formData.ptNumber}
                onChange={(e) => setFormData({ ...formData, ptNumber: e.target.value })}
                className="w-full px-4 py-3 border-2 rounded-lg text-lg font-bold text-green-600"
                placeholder={t('ptSessionRegister.ptNumberPlaceholder')}
              />
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-5">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span>{t('ptSessionRegister.dateAndTime')}</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('ptSessionRegister.date')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 border-2 rounded-lg font-mono text-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('ptSessionRegister.time')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-4 py-3 border-2 rounded-lg font-mono text-lg"
                  />
                </div>
              </div>

              <div className="mt-4 bg-white border-2 border-purple-300 rounded-lg p-3">
                <p className="text-sm text-gray-600">{t('ptSessionRegister.selectedTime')}</p>
                <p className="text-lg font-mono font-bold text-purple-700">
                  {new Date(`${formData.date}T${formData.time}`).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {t('ptSessionRegister.notes')}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-3 border-2 rounded-lg resize-none"
                rows={3}
                placeholder={t('ptSessionRegister.notesPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !formData.ptNumber}
              className="w-full bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg transition"
            >
              {submitting ? t('ptSessionRegister.registering') : t('ptSessionRegister.registerButton')}
            </button>
          </form>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && generatedQRCode && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                  <span className="text-4xl">✅</span>
                </div>
                <h3 className="text-2xl font-bold text-green-700 mb-2">
                  {t('ptSessionRegister.qrModal.title')}
                </h3>
                <p className="text-gray-600 text-sm">
                  {t('ptSessionRegister.qrModal.subtitle')}
                </p>
              </div>

              {/* QR Code Display */}
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300 rounded-xl p-6 mb-4">
                {/* QR Code Image */}
                {qrCodeImage && (
                  <div className="bg-white rounded-xl p-4 mb-4 flex justify-center">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-3 font-medium">
                        {t('ptSessionRegister.qrModal.scanWithCoach')}
                      </p>
                      <img
                        src={qrCodeImage}
                        alt="QR Code"
                        className="w-64 h-64 mx-auto border-4 border-gray-200 rounded-lg shadow-lg"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        {t('ptSessionRegister.qrModal.scanInstruction')}
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-600 mb-3 font-medium">
                  {t('ptSessionRegister.qrModal.secureCode')}
                </p>
                <div className="bg-white rounded-lg p-4 mb-3">
                  <p className="font-mono text-lg font-bold text-purple-700 break-all select-all">
                    {generatedQRCode}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">{t('ptSessionRegister.qrModal.easyFormat')}</p>
                  <p className="font-mono text-sm font-medium text-blue-600 select-all">
                    {generatedQRCode.match(/.{1,4}/g)?.join('-')}
                  </p>
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedQRCode)
                  setMessage(t('ptSessionRegister.messages.codeCopied'))
                  setTimeout(() => setMessage(''), 2000)
                }}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium mb-3"
              >
                {t('ptSessionRegister.qrModal.copyButton')}
              </button>

              {/* WhatsApp Button */}
              <button
                onClick={() => {
                  const selectedPT = sessions.find(pt => pt.ptNumber.toString() === formData.ptNumber)
                  if (selectedPT) {
                    // رابط صفحة تسجيل الحضور
                    const checkInUrl = `${window.location.origin}/pt/check-in`
                    const sessionTime = new Date(formData.date + 'T' + formData.time).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')

                    const text = t('ptSessionRegister.whatsappMessage')
                      .replace('{clientName}', selectedPT.clientName)
                      .replace('{qrCode}', generatedQRCode)
                      .replace('{checkInUrl}', checkInUrl)
                      .replace('{sessionTime}', sessionTime)

                    const whatsappUrl = `https://wa.me/${selectedPT.phone}?text=${encodeURIComponent(text)}`
                    window.open(whatsappUrl, '_blank')
                  }
                }}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium mb-3"
              >
                {t('ptSessionRegister.qrModal.whatsappButton')}
              </button>

              {/* Close Button */}
              <button
                onClick={() => setShowQRModal(false)}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-medium"
              >
                {t('ptSessionRegister.qrModal.closeButton')}
              </button>

              {/* Security Note */}
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <strong>{t('ptSessionRegister.qrModal.securityNote')}</strong> {t('ptSessionRegister.qrModal.securityMessage')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}