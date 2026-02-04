'use client'

import { useState, useEffect } from 'react'
import { calculateDaysBetween, formatDateYMD, formatDurationInMonths } from '../lib/dateFormatter'
import PaymentMethodSelector from './Paymentmethodselector'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'

interface Staff {
  id: string
  name: string
  phone?: string
  position?: string
  isActive: boolean
}

interface PTSession {
  ptNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  coachName: string
  pricePerSession: number
  startDate?: string
  expiryDate?: string
}

interface PTRenewalFormProps {
  session: PTSession
  onSuccess: () => void
  onClose: () => void
}

export default function PTRenewalForm({ session, onSuccess, onClose }: PTRenewalFormProps) {
  const { user } = usePermissions()
  const { t, locale } = useLanguage()
  const [coaches, setCoaches] = useState<Staff[]>([])
  const [coachesLoading, setCoachesLoading] = useState(true)

  // ✅ التجديد يبدأ من آخر تاريخ انتهاء، وليس من اليوم
  const getDefaultStartDate = () => {
    if (session.expiryDate) {
      return formatDateYMD(session.expiryDate)
    }
    return formatDateYMD(new Date())
  }

  const [formData, setFormData] = useState({
    phone: session.phone,
    sessionsPurchased: 0,
    coachName: session.coachName,
    pricePerSession: session.pricePerSession,
    totalPrice: 0,
    startDate: getDefaultStartDate(),
    expiryDate: '',
    paymentMethod: 'cash',
    staffName: user?.name || '',
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchCoaches()
  }, [])

  useEffect(() => {
    if (user && !formData.staffName) {
      setFormData(prev => ({ ...prev, staffName: user.name }))
    }
  }, [user])

  // حساب السعر الإجمالي تلقائياً عند تغيير عدد الجلسات أو سعر الجلسة
  useEffect(() => {
    if (formData.sessionsPurchased > 0 && formData.pricePerSession > 0) {
      // تقريب لأقرب رقمين عشريين لتجنب مشاكل floating point
      const calculatedTotal = Math.round(formData.sessionsPurchased * formData.pricePerSession * 100) / 100
      setFormData(prev => ({ ...prev, totalPrice: calculatedTotal }))
    }
  }, [formData.sessionsPurchased, formData.pricePerSession])

  const fetchCoaches = async () => {
    try {
      const response = await fetch('/api/staff')
      const data: Staff[] = await response.json()
      const activeCoaches = data.filter(
        (staff) => staff.isActive && staff.position?.toLowerCase().includes('مدرب')
      )
      setCoaches(activeCoaches)
    } catch (error) {
      console.error('Error fetching coaches:', error)
    } finally {
      setCoachesLoading(false)
    }
  }

  const calculateDuration = () => {
    if (!formData.startDate || !formData.expiryDate) return null
    return calculateDaysBetween(formData.startDate, formData.expiryDate)
  }

  const calculateExpiryFromMonths = (months: number) => {
    if (!formData.startDate) return

    // ✅ فرض شهر واحد فقط
    if (months !== 1) {
      console.warn('⚠️ PT renewals: Only 1-month duration allowed')
      return
    }

    const start = new Date(formData.startDate)
    const expiry = new Date(start)
    expiry.setMonth(expiry.getMonth() + 1) // دائماً شهر واحد

    setFormData(prev => ({
      ...prev,
      expiryDate: formatDateYMD(expiry)
    }))
  }

  // ✅ حساب تلقائي عند تغيير startDate
  const handleStartDateChange = (startDate: string) => {
    setFormData(prev => ({ ...prev, startDate }))

    if (startDate && startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const start = new Date(startDate)
      const expiry = new Date(start)
      expiry.setMonth(expiry.getMonth() + 1)
      setFormData(prev => ({ ...prev, expiryDate: formatDateYMD(expiry) }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (formData.startDate && formData.expiryDate) {
      const start = new Date(formData.startDate)
      const end = new Date(formData.expiryDate)
      
      if (end <= start) {
        setMessage(`❌ ${t('ptRenew.errors.invalidDates')}`)
        setLoading(false)
        return
      }
    }

    try {
      const response = await fetch('/api/pt/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ptNumber: session.ptNumber,
          ...formData,
          staffName: user?.name || ''
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setMessage(`✅ ${t('ptRenew.messages.renewSuccess')}`)
        
        if (result.receipt) {
          try {
            const receiptsResponse = await fetch(`/api/receipts?ptNumber=${session.ptNumber}`)
            const receipts = await receiptsResponse.json()
            
            if (receipts.length > 0) {
              const latestReceipt = receipts[0]
              console.log('Receipt ready for print:', latestReceipt)
            }
          } catch (err) {
            console.error('Error fetching receipt:', err)
          }
        }

        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      } else {
        setMessage(`❌ ${result.error || t('ptRenew.errors.renewFailed')}`)
      }
    } catch (error) {
      console.error(error)
      setMessage(`❌ ${t('ptRenew.errors.connectionError')}`)
    } finally {
      setLoading(false)
    }
  }

  const duration = calculateDuration()
  const totalAmount = formData.sessionsPurchased * formData.pricePerSession
  const totalSessions = session.sessionsRemaining + formData.sessionsPurchased

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold mb-2">🔄 {t('ptRenew.title')}</h2>
              <p className="text-green-100">{t('ptRenew.subtitle')}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full w-10 h-10 flex items-center justify-center transition"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-green-50 border-r-4 border-green-500 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">{t('pt.ptNumber')}</p>
                <p className="text-2xl font-bold text-green-600">#{session.ptNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('pt.clientName')}</p>
                <p className="text-lg font-bold">{session.clientName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('ptRenew.currentCoach')}</p>
                <p className="text-lg">{session.coachName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('ptRenew.currentRemaining')}</p>
                <p className="text-2xl font-bold text-orange-600">{session.sessionsRemaining}</p>
              </div>
            </div>

            {session.expiryDate && (
              <div className="mt-4 pt-4 border-t border-green-200">
                <p className="text-sm text-gray-600">{t('ptRenew.currentExpiry')}</p>
                <p className="text-lg font-mono">{formatDateYMD(session.expiryDate)}</p>
              </div>
            )}
          </div>

          {session.expiryDate && (
            <div className="mb-4 bg-green-100 border-2 border-green-400 rounded-lg p-4">
              <p className="text-sm text-green-800 flex items-center gap-2">
                <span>✅</span>
                <span>
                  {locale === 'ar'
                    ? `التجديد سيبدأ من تاريخ الانتهاء الأخير: ${formatDateYMD(session.expiryDate)}`
                    : `Renewal will start from last expiry date: ${formatDateYMD(session.expiryDate)}`
                  }
                </span>
              </p>
            </div>
          )}

          {message && (
            <div className={`mb-4 p-4 rounded-lg ${message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span>📋</span>
                <span>{t('ptRenew.renewalData')}</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('pt.phoneNumber')}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border-2 rounded-lg"
                    placeholder="01xxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('ptRenew.newSessions')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.sessionsPurchased}
                    onChange={(e) => setFormData({ ...formData, sessionsPurchased: parseInt(e.target.value) || 0 })}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault()
                      }
                    }}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border-2 rounded-lg text-base md:text-lg"
                    placeholder={t('ptRenew.newSessions')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('pt.coachName')} <span className="text-red-600">*</span>
                  </label>
                  {coachesLoading ? (
                    <div className="w-full px-3 py-2 md:px-4 md:py-3 border-2 rounded-lg bg-gray-50 text-gray-500">
                      {t('pt.loadingCoaches')}
                    </div>
                  ) : coaches.length === 0 ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        required
                        value={formData.coachName}
                        onChange={(e) => setFormData({ ...formData, coachName: e.target.value })}
                        className="w-full px-3 py-2 md:px-4 md:py-3 border-2 border-gray-300 rounded-lg"
                        placeholder={t('pt.coachNamePlaceholder')}
                      />
                      <p className="text-xs text-amber-600">
                        ⚠️ {t('pt.noActiveCoaches')}
                      </p>
                    </div>
                  ) : (
                    <select
                      required
                      value={formData.coachName}
                      onChange={(e) => setFormData({ ...formData, coachName: e.target.value })}
                      className="w-full px-3 py-2 md:px-4 md:py-3 border-2 border-gray-300 rounded-lg bg-white"
                    >
                      <option value="">{t('pt.selectCoach')}</option>
                      {coaches.map((coach) => (
                        <option key={coach.id} value={coach.name}>
                          {coach.name} {coach.phone && `(${coach.phone})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('pt.pricePerSession')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.pricePerSession}
                    onChange={(e) => setFormData({ ...formData, pricePerSession: parseFloat(e.target.value) || 0 })}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault()
                      }
                    }}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border-2 rounded-lg text-base md:text-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="mt-4 bg-white border-2 border-blue-300 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('ptRenew.total')}:</span>
                  <span className="text-2xl font-bold text-green-600">{totalAmount} {t('pt.egp')}</span>
                </div>
                <div className="flex justify-between items-center mt-2 text-sm">
                  <span className="text-gray-600">{t('ptRenew.totalAfterRenew')}:</span>
                  <span className="text-lg font-bold text-orange-600">{totalSessions} {t('ptRenew.sessions')}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-5">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span>📅</span>
                <span>{t('ptRenew.newPeriod')}</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('pt.startDate')} <span className="text-red-600">*</span> <span className="text-xs text-gray-500">{t('pt.startDateFormat')}</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border-2 rounded-lg font-mono text-sm md:text-base"
                    placeholder={t('pt.startDatePlaceholder')}
                    pattern="\d{4}-\d{2}-\d{2}"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('pt.expiryDate')} <span className="text-red-600">*</span>
                    <span className="text-xs text-green-600 font-semibold"> (محسوب تلقائياً: 1 شهر)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.expiryDate}
                    readOnly
                    className="w-full px-3 py-2 md:px-4 md:py-3 border-2 border-green-300 bg-green-50 rounded-lg font-mono font-semibold text-green-800 text-sm md:text-base"
                    placeholder={t('pt.expiryDatePlaceholder')}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ⚠️ تاريخ الانتهاء يتم حسابه تلقائياً بعد شهر واحد من تاريخ البدء
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium mb-2">⚡ {t('pt.quickAdd')}:</p>
                <button
                  type="button"
                  onClick={() => calculateExpiryFromMonths(1)}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm transition font-bold"
                >
                  ✅ + 1 {t('pt.month')} (مدة ثابتة)
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  ℹ️ تجديدات البرايفت متاحة لمدة شهر واحد فقط
                </p>
              </div>

              {duration !== null && formData.expiryDate && (
                <div className="bg-white border-2 border-purple-300 rounded-lg p-4">
                  {duration > 0 ? (
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">⏱️</span>
                      <div>
                        <p className="font-bold text-purple-800 mb-1">{t('ptRenew.newDuration')}:</p>
                        <p className="text-xl font-mono">
                          {formatDurationInMonths(duration)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-red-600 flex items-center gap-2">
                      <span>❌</span>
                      <span>{t('ptRenew.errors.invalidDates')}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-5">
              <PaymentMethodSelector
                value={formData.paymentMethod}
                onChange={(method) => setFormData({ ...formData, paymentMethod: method })}
                required
              />
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span>📊</span>
                <span>{t('ptRenew.summary')}</span>
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('ptRenew.currentSessions')}:</span>
                  <span className="font-bold">{session.sessionsRemaining} {t('ptRenew.sessions')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('ptRenew.newSessions')}:</span>
                  <span className="font-bold text-green-600">+ {formData.sessionsPurchased} {t('ptRenew.sessions')}</span>
                </div>
                <div className="border-t-2 border-gray-300 pt-3">
                  <div className="flex justify-between text-xl">
                    <span className="font-bold">{t('ptRenew.totalAfterRenew')}:</span>
                    <span className="font-bold text-orange-600">{totalSessions} {t('ptRenew.sessions')}</span>
                  </div>
                </div>
                <div className="bg-green-100 border-r-4 border-green-500 p-3 rounded mt-3">
                  <div className="flex justify-between text-lg">
                    <span className="font-bold text-gray-800">{t('ptRenew.amountPaid')}:</span>
                    <span className="font-bold text-green-600">{totalAmount} {t('pt.egp')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || (duration !== null && duration <= 0)}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition font-bold text-lg"
              >
                {loading ? t('ptRenew.buttons.renewing') : `✅ ${t('ptRenew.buttons.renewSessions')}`}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                {t('ptRenew.buttons.cancel')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}