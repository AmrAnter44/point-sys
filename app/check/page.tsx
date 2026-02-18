'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function CheckMembershipPage() {
  const { t, locale, direction } = useLanguage()
  const [memberNumber, setMemberNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const checkoutInputRef = useRef<HTMLInputElement>(null)
  const [checkoutNumber, setCheckoutNumber] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<{ name: string; duration: number } | null>(null)
  const [checkoutError, setCheckoutError] = useState('')
  const audioContextRef = useRef<AudioContext | null>(null)

  // ✅ تم إزالة منطق الخروج التلقائي - نسجل وقت الدخول فقط
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ✅ auto-dismiss result after 10 seconds
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => {
        setResult(null)
        inputRef.current?.focus()
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [result])

  const playSuccessSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const times = [0, 0.15, 0.3]
      const frequencies = [523.25, 659.25, 783.99]

      times.forEach((time, index) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequencies[index], ctx.currentTime + time)
        gainNode.gain.setValueAtTime(0.8, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.3)
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.3)
      })
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  const playAlarmSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const alarmPattern = [
        { freq: 2000, time: 0 },
        { freq: 600, time: 0.15 },
        { freq: 2000, time: 0.3 },
      ]

      alarmPattern.forEach(({ freq, time }) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'square'
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime + time)
        gainNode.gain.setValueAtTime(0.9, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.15)
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.15)
      })
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  const playWarningSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const times = [0, 0.2]
      const frequencies = [440, 370]

      times.forEach((time, index) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'triangle'
        oscillator.frequency.setValueAtTime(frequencies[index], ctx.currentTime + time)
        gainNode.gain.setValueAtTime(0.7, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.25)
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.25)
      })
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  const handleCheck = async () => {
    if (!memberNumber.trim()) {
      playAlarmSound()
      setError(`⚠️ ${t('attendance.enterMembershipNumber')}`)
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch(`/api/check/${memberNumber.trim()}?lang=${locale}`)
      const data = await response.json()

      if (response.ok) {
        setResult(data)

        // تشغيل الصوت المناسب
        if (data.attendanceLimitWarning) {
          // تحذير عند الوصول لحد الحضور
          playAlarmSound()
        } else if (data.status === 'active') {
          playSuccessSound()
        } else if (data.status === 'warning') {
          playWarningSound()
        } else {
          playAlarmSound()
        }
      } else {
        playAlarmSound()
        setError(data.error || t('attendance.error'))
      }
    } catch (error) {
      console.error('Check error:', error)
      playAlarmSound()
      setError(t('attendance.connectionError'))
    } finally {
      setLoading(false)
      setMemberNumber('')
      setTimeout(() => inputRef.current?.focus(), 500)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCheck()
    }
  }

  const handleCheckout = async () => {
    if (!checkoutNumber.trim()) return
    setCheckoutLoading(true)
    setCheckoutError('')
    setCheckoutResult(null)
    try {
      // أولاً: نجيب memberId من رقم العضوية
      const memberRes = await fetch(`/api/members?memberNumber=${checkoutNumber.trim()}`)
      const memberData = await memberRes.json()
      const member = Array.isArray(memberData) ? memberData[0] : memberData
      if (!member?.id) {
        setCheckoutError('العضو غير موجود')
        setCheckoutLoading(false)
        setCheckoutNumber('')
        return
      }
      const res = await fetch('/api/member-checkin/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id })
      })
      const data = await res.json()
      if (res.ok) {
        setCheckoutResult({ name: member.name, duration: data.durationMinutes || 0 })
        setTimeout(() => {
          setCheckoutResult(null)
          checkoutInputRef.current?.focus()
        }, 5000)
      } else {
        setCheckoutError(data.error || 'فشل تسجيل الخروج')
      }
    } catch {
      setCheckoutError('خطأ في الاتصال')
    } finally {
      setCheckoutLoading(false)
      setCheckoutNumber('')
      setTimeout(() => checkoutInputRef.current?.focus(), 300)
    }
  }

  const calculateRemainingDays = (expiryDate: string): number => {
    const expiry = new Date(expiryDate)
    const today = new Date()
    const diffTime = expiry.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4" dir={direction}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src='/icon.png' alt="logo" className='w-12 h-12 sm:w-16 sm:h-16'/>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-blue-600">X GYM</h1>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            🔍 {t('attendance.verifyMembership')}
          </h2>
          <p className="text-sm sm:text-base text-gray-600">
            {t('attendance.enterNumberToVerify')}
          </p>
        </div>

        {/* Search Box */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 border-4 border-blue-500 mb-6">
          <div className="mb-6">
            <label className="block text-lg sm:text-xl font-bold mb-4 text-gray-800 text-center">
              {t('attendance.membershipNumber')}
            </label>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-xl animate-shake">
                <p className="text-red-700 font-bold text-center">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={memberNumber}
                onChange={(e) => setMemberNumber(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 px-4 py-3 sm:px-6 sm:py-4 border-4 border-blue-300 rounded-xl text-2xl sm:text-3xl md:text-4xl font-bold text-center focus:border-blue-600 focus:ring-4 focus:ring-blue-200 transition text-gray-800"
                placeholder="1001"
                disabled={loading}
              />
              <button
                onClick={handleCheck}
                disabled={loading || !memberNumber.trim()}
                className="px-6 py-3 sm:px-8 sm:py-4 bg-blue-600 text-white text-xl sm:text-2xl font-bold rounded-xl hover:bg-blue-700 disabled:bg-gray-400 transition shadow-lg"
              >
                {loading ? '⏳' : '🔍'}
              </button>
            </div>

            <p className="text-xs sm:text-sm text-gray-500 mt-3 text-center">
              💡 {t('attendance.pressEnterToSearch')}
            </p>
          </div>
        </div>

        {/* Checkout Box */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 border-4 border-purple-500 mb-6">
          <div className="mb-2">
            <label className="block text-lg sm:text-xl font-bold mb-4 text-gray-800 text-center">
              🚪 تسجيل الخروج
            </label>

            {checkoutError && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 rounded-xl">
                <p className="text-red-700 font-bold text-center text-sm">{checkoutError}</p>
              </div>
            )}

            {checkoutResult && (
              <div className="mb-4 p-4 bg-purple-50 border-2 border-purple-500 rounded-xl animate-slideIn text-center">
                <div className="text-3xl mb-1">👋</div>
                <p className="font-bold text-purple-800 text-lg">{checkoutResult.name}</p>
                <p className="text-sm text-purple-600">
                  مدة الزيارة: {checkoutResult.duration} دقيقة
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <input
                ref={checkoutInputRef}
                type="text"
                value={checkoutNumber}
                onChange={(e) => setCheckoutNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheckout()}
                className="flex-1 px-4 py-3 sm:px-6 sm:py-4 border-4 border-purple-300 rounded-xl text-2xl sm:text-3xl font-bold text-center focus:border-purple-600 focus:ring-4 focus:ring-purple-200 transition text-gray-800"
                placeholder="1001"
                disabled={checkoutLoading}
              />
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading || !checkoutNumber.trim()}
                className="px-6 py-3 sm:px-8 sm:py-4 bg-purple-600 text-white text-xl sm:text-2xl font-bold rounded-xl hover:bg-purple-700 disabled:bg-gray-400 transition shadow-lg"
              >
                {checkoutLoading ? '⏳' : '🚪'}
              </button>
            </div>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className={`bg-white rounded-2xl shadow-2xl p-6 sm:p-8 border-4 animate-slideIn ${
            result.status === 'active'
              ? 'border-green-500'
              : result.status === 'warning'
              ? 'border-yellow-500'
              : 'border-red-500'
          }`}>
            <div className="text-center mb-6">
              <div className="text-6xl sm:text-7xl md:text-8xl mb-4">
                {result.status === 'active' ? '✅' : result.status === 'warning' ? '⚠️' : '🚨'}
              </div>

              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 text-gray-800">
                {result.name}
              </h3>

              <p className="text-lg sm:text-xl text-gray-600 mb-4">
                {t('attendance.membershipNumber')}: <span className="font-bold text-orange-600">#{result.memberNumber}</span>
              </p>

              <div className={`inline-block px-6 py-3 rounded-xl text-xl sm:text-2xl font-bold ${
                result.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : result.status === 'warning'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {result.message}
              </div>
            </div>

            {result.expiryDate && (
              <div className={`rounded-xl p-6 ${
                result.status === 'active'
                  ? 'bg-green-50 border-2 border-green-300'
                  : result.status === 'warning'
                  ? 'bg-yellow-50 border-2 border-yellow-300'
                  : 'bg-red-50 border-2 border-red-300'
              }`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('attendance.expiryDate')}</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-800">
                      {new Date(result.expiryDate).toLocaleDateString('ar-EG')}
                    </p>
                  </div>

                  {result.remainingDays !== undefined && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{t('attendance.daysRemaining')}</p>
                      <p className={`text-xl sm:text-2xl font-bold ${
                        result.remainingDays > 7
                          ? 'text-green-600'
                          : result.remainingDays > 0
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}>
                        {result.remainingDays > 0
                          ? t('attendance.daysCount', { days: result.remainingDays.toString() })
                          : result.remainingDays === 0
                          ? t('attendance.expiresToday')
                          : t('attendance.expiredSince', { days: Math.abs(result.remainingDays).toString() })
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 🆕 عرض حد الحضور */}
            {result.attendanceLimit !== undefined && (
              <div className={`rounded-xl p-6 mt-4 ${
                result.attendanceLimitWarning
                  ? 'bg-red-50 border-2 border-red-400 animate-pulse'
                  : result.isUnlimited
                    ? 'bg-blue-50 border-2 border-blue-300'
                    : result.attendanceRemaining !== null && result.attendanceRemaining <= 3
                      ? 'bg-orange-50 border-2 border-orange-300'
                      : 'bg-green-50 border-2 border-green-300'
              }`}>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl sm:text-4xl">🚪</span>
                    <div className="text-center sm:text-right">
                      <p className="text-sm text-gray-600">{t('attendanceLimit.title')}</p>
                      {result.isUnlimited ? (
                        <p className="text-xl sm:text-2xl font-bold text-blue-600">{t('attendanceLimit.unlimitedSymbol')}</p>
                      ) : (
                        <p className="text-xl sm:text-2xl font-bold text-gray-800">
                          {t('attendanceLimit.used').replace('{used}', String(result.attendanceDaysUsed)).replace('{total}', String(result.attendanceLimit))}
                        </p>
                      )}
                    </div>
                  </div>

                  {!result.isUnlimited && (
                    <div className={`px-6 py-3 rounded-xl font-bold text-lg sm:text-xl ${
                      result.attendanceLimitWarning
                        ? 'bg-red-500 text-white animate-bounce'
                        : result.attendanceRemaining !== null && result.attendanceRemaining <= 3
                          ? 'bg-orange-500 text-white'
                          : 'bg-green-500 text-white'
                    }`}>
                      {result.attendanceLimitWarning ? (
                        <span>{t('attendanceLimit.warning')}</span>
                      ) : (
                        <span>{t('attendanceLimit.remaining').replace('{count}', String(result.attendanceRemaining))}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* السيشنات المتبقية */}
            {result.status !== 'expired' && (
              <div className="mt-4 bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
                <p className="text-sm font-bold text-blue-800 mb-3 text-center">📋 السيشنات المتبقية</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  {result.freePTSessions > 0 && (
                    <div className="bg-white rounded-lg p-2 shadow-sm">
                      <p className="text-xs text-gray-500">PT سيشن</p>
                      <p className="text-xl font-bold text-blue-600">{result.freePTSessions}</p>
                    </div>
                  )}
                  {result.inBodyScans > 0 && (
                    <div className="bg-white rounded-lg p-2 shadow-sm">
                      <p className="text-xs text-gray-500">InBody</p>
                      <p className="text-xl font-bold text-green-600">{result.inBodyScans}</p>
                    </div>
                  )}
                  {result.invitations > 0 && (
                    <div className="bg-white rounded-lg p-2 shadow-sm">
                      <p className="text-xs text-gray-500">دعوات</p>
                      <p className="text-xl font-bold text-purple-600">{result.invitations}</p>
                    </div>
                  )}
                  {result.nutritionSessions > 0 && (
                    <div className="bg-white rounded-lg p-2 shadow-sm">
                      <p className="text-xs text-gray-500">تغذية</p>
                      <p className="text-xl font-bold text-orange-600">{result.nutritionSessions}</p>
                    </div>
                  )}
                  {result.freePTSessions === 0 && result.inBodyScans === 0 && result.invitations === 0 && result.nutritionSessions === 0 && (
                    <div className="col-span-4 text-gray-500 text-sm">لا توجد سيشنات متبقية</div>
                  )}
                </div>
                {result.upgradeDaysRemaining !== null && result.upgradeDaysRemaining > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-200 text-center">
                    <p className="text-xs text-gray-500">⬆️ نافذة الترقية</p>
                    <p className="text-lg font-bold text-indigo-600">{result.upgradeDaysRemaining} يوم متبقي للترقية</p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setResult(null)
                  setError('')
                  setMemberNumber('')
                  inputRef.current?.focus()
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-bold transition"
              >
                {t('attendance.searchAnother')}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600 text-sm">
          <p>🔒 {t('attendance.securePageVerifyOnly')}</p>
          <p className="mt-2">{t('attendance.contactManagement')}</p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        .animate-slideIn {
          animation: slideIn 0.4s ease-out;
        }

        .animate-shake {
          animation: shake 0.4s ease-out;
        }
      `}</style>
    </div>
  )
}
