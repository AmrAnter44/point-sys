'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../contexts/LanguageContext'

interface SessionInfo {
  id: string
  ptNumber: number
  clientName: string
  coachName: string
  sessionDate: string
  attended: boolean
  sessionsRemaining: number
}

export default function PTCheckInPage() {
  const router = useRouter()
  const { t, locale, direction } = useLanguage()
  const [qrCode, setQrCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!qrCode.trim() || qrCode.trim().length === 0) {
      setMessage(t('ptCheckIn.errors.enterCode'))
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/pt/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: qrCode.trim() })
      })

      const result = await response.json()

      if (response.ok) {
        setSessionInfo(result.session)
        setShowSuccess(true)
        setQrCode('')
        setMessage(t('ptCheckIn.successTitle'))
      } else {
        setMessage(`❌ ${result.error || t('ptCheckIn.errors.invalidCode')}`)
        setTimeout(() => setMessage(''), 5000)
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage(t('ptCheckIn.errors.connectionError'))
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setLoading(false)
    }
  }

  if (showSuccess && sessionInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-400 via-orange-500 to-purple-600 flex items-center justify-center p-4" dir={direction}>
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center">
          {/* Success Animation */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-4 animate-bounce">
              <span className="text-6xl">✅</span>
            </div>
            <h1 className="text-3xl font-bold text-green-700 mb-2">
              {t('ptCheckIn.successTitle')}
            </h1>
            <p className="text-gray-600">
              {t('ptCheckIn.successSubtitle')}
            </p>
          </div>

          {/* Session Details */}
          <div className="bg-gradient-to-br from-orange-50 to-purple-50 border-2 border-orange-300 rounded-2xl p-6 mb-6 text-right">
            <h3 className="text-lg font-bold text-orange-800 mb-4 text-center">
              {t('ptCheckIn.sessionDetails')}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-orange-200 pb-2">
                <span className="text-gray-600">{t('ptCheckIn.name')}</span>
                <span className="font-bold text-orange-900">{sessionInfo.clientName}</span>
              </div>
              <div className="flex justify-between items-center border-b border-orange-200 pb-2">
                <span className="text-gray-600">{t('ptCheckIn.ptNumber')}</span>
                <span className="font-bold text-orange-900">#{sessionInfo.ptNumber}</span>
              </div>
              <div className="flex justify-between items-center border-b border-orange-200 pb-2">
                <span className="text-gray-600">{t('ptCheckIn.coach')}</span>
                <span className="font-bold text-orange-900">{sessionInfo.coachName}</span>
              </div>
              <div className="flex justify-between items-center border-b border-orange-200 pb-2">
                <span className="text-gray-600">{t('ptCheckIn.date')}</span>
                <span className="font-bold text-orange-900">
                  {new Date(sessionInfo.sessionDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center bg-green-100 -mx-6 px-6 py-3 mt-4">
                <span className="text-green-800 font-semibold">{t('ptCheckIn.sessionsRemaining')}</span>
                <span className="text-3xl font-bold text-green-600">
                  {sessionInfo.sessionsRemaining}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => {
                setShowSuccess(false)
                setSessionInfo(null)
              }}
              className="w-full bg-gradient-to-r from-orange-600 to-purple-600 text-white py-4 rounded-xl hover:from-orange-700 hover:to-purple-700 font-bold text-lg shadow-lg"
            >
              {t('ptCheckIn.checkInAnother')}
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300 font-medium"
            >
              {t('ptCheckIn.backHome')}
            </button>
          </div>

          {/* Motivational Message */}
          <div className={`mt-6 bg-yellow-50 p-4 rounded-lg ${locale === 'ar' ? 'border-r-4' : 'border-l-4'} border-yellow-400`}>
            <p className="text-sm text-yellow-800">
              <strong>{t('ptCheckIn.tip')}</strong> {t('ptCheckIn.tipMessage')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-orange-600 to-cyan-500 flex items-center justify-center p-4" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-100 to-orange-100 rounded-full mb-4">
            <span className="text-5xl">🏋️</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {t('ptCheckIn.title')}
          </h1>
          <p className="text-gray-600">
            {t('ptCheckIn.subtitle')}
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl ${
            message.includes('✅')
              ? 'bg-green-100 text-green-800 border-2 border-green-300'
              : 'bg-red-100 text-red-800 border-2 border-red-300'
          }`}>
            {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleCheckIn} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('ptCheckIn.inputLabel')} <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              placeholder={t('ptCheckIn.inputPlaceholder')}
              className="w-full px-4 py-4 border-2 border-purple-300 rounded-xl focus:outline-none focus:border-purple-500 font-mono text-lg"
              autoFocus
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-2">
              {t('ptCheckIn.inputHelp')}
            </p>
          </div>

          {/* Character Counter */}
          {qrCode && (
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
              <p className="text-xs text-purple-700 mb-2">
                {t('ptCheckIn.codeEntered')} ({qrCode.length}):
              </p>
              <p className="font-mono text-sm text-purple-900 break-all select-all">
                {qrCode.match(/.{1,4}/g)?.join('-') || qrCode}
              </p>
              {qrCode.length === 32 ? (
                <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                  <span>✅</span>
                  <span>{t('ptCheckIn.codeLengthCorrect')}</span>
                </p>
              ) : (
                <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>{t('ptCheckIn.codeLengthIncorrect')}</span>
                </p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || qrCode.length !== 32}
            className="w-full bg-gradient-to-r from-purple-600 to-orange-600 text-white py-4 rounded-xl hover:from-purple-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-bold text-lg shadow-lg transition"
          >
            {loading ? t('ptCheckIn.checking') : t('ptCheckIn.checkInButton')}
          </button>
        </form>

        {/* Security Notice */}
        <div className={`mt-6 bg-orange-50 p-4 rounded-lg ${locale === 'ar' ? 'border-r-4' : 'border-l-4'} border-orange-500`}>
          <p className="text-xs text-orange-800">
            <strong>{t('ptCheckIn.securityNote')}</strong> {t('ptCheckIn.securityMessage')}
          </p>
        </div>

        {/* Help Section */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {t('ptCheckIn.noCodeQuestion')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {t('ptCheckIn.noCodeAnswer')}
          </p>
        </div>
      </div>
    </div>
  )
}
