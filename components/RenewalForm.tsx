'use client'

import { useState, useEffect } from 'react'
import PaymentMethodSelector from './Paymentmethodselector'
import { calculateDaysBetween, formatDateYMD } from '../lib/dateFormatter'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '@/contexts/LanguageContext'

interface Member {
  id: string
  memberNumber: number
  name: string
  phone: string
  inBodyScans: number
  invitations: number
  freePTSessions?: number
  subscriptionPrice: number
  remainingAmount?: number
  notes?: string
  isActive: boolean
  startDate?: string
  expiryDate?: string
  createdAt: string
}

interface Receipt {
  receiptNumber: number
  amount: number
  paymentMethod: string
  createdAt: string
  itemDetails: {
    memberNumber?: number
    memberName?: string
    subscriptionPrice?: number
    paidAmount?: number
    remainingAmount?: number
    freePTSessions?: number
    inBodyScans?: number
    invitations?: number
    startDate?: string
    expiryDate?: string
    subscriptionDays?: number
    staffName?: string
    [key: string]: any
  }
}

interface RenewalFormProps {
  member: Member
  onSuccess: (receipt?: Receipt) => void
  onClose: () => void
}

export default function RenewalForm({ member, onSuccess, onClose }: RenewalFormProps) {
  const { user } = usePermissions()
  const { t, direction, locale } = useLanguage()

  // ✅ التجديد يبدأ من آخر تاريخ انتهاء، وليس من اليوم
  const getDefaultStartDate = () => {
    if (member.expiryDate) {
      return formatDateYMD(member.expiryDate)
    }
    return formatDateYMD(new Date())
  }

  const [subscriptionPrice, setSubscriptionPrice] = useState('')
  const [startDate, setStartDate] = useState(getDefaultStartDate())
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState(member.notes || '')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [staffName, setStaffName] = useState(user?.name || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [offers, setOffers] = useState<any[]>([])
  const [successMessage, setSuccessMessage] = useState('')
  const [coaches, setCoaches] = useState<any[]>([])
  const [referringCoachId, setReferringCoachId] = useState('')
  const [selectedOfferId, setSelectedOfferId] = useState<string>('')
  const [selectedOfferName, setSelectedOfferName] = useState<string>('')

  useEffect(() => {
    if (user && !staffName) {
      setStaffName(user.name)
    }
  }, [user])

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const response = await fetch('/api/offers?activeOnly=true')
        const data = await response.json()
        if (Array.isArray(data)) {
          setOffers(data)
        } else {
          console.warn('⚠️ البيانات المستلمة ليست array:', data)
          setOffers([])
        }
      } catch (error) {
        console.error('❌ خطأ في جلب العروض:', error)
        setOffers([])
      }
    }

    fetchOffers()
  }, [])

  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        const response = await fetch('/api/staff')
        if (response.ok) {
          const data = await response.json()
          // ✅ عرض جميع الكوتشات (نشطين وغير نشطين)
          const allCoaches = data.filter(
            (staff: any) => staff.position?.includes('مدرب')
          )
          setCoaches(allCoaches)
        }
      } catch (error) {
        console.error('Error fetching coaches:', error)
      }
    }

    fetchCoaches()
  }, [])

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0
    return calculateDaysBetween(start, end)
  }

  const calculateExpiryFromMonths = (months: number) => {
    if (!startDate) return
    
    const start = new Date(startDate)
    const expiry = new Date(start)
    expiry.setMonth(expiry.getMonth() + months)
    
    setExpiryDate(formatDateYMD(expiry))
  }

  const calculatePaidAmount = () => {
    const price = parseInt(subscriptionPrice) || 0
    return price
  }

  const applyOffer = (offer: any) => {
    // ✅ التجديد يبدأ من آخر تاريخ انتهاء، وليس من اليوم
    const start = startDate || getDefaultStartDate()
    const expiry = new Date(start)
    expiry.setDate(expiry.getDate() + offer.duration)

    setSubscriptionPrice(offer.price.toString())
    setStartDate(start)
    setExpiryDate(formatDateYMD(expiry))
    setSelectedOfferId(offer.id)
    setSelectedOfferName(offer.name)

    setSuccessMessage(`✅ ${t('renewal.offerApplied', { offerName: offer.name })}`)
    setTimeout(() => setSuccessMessage(''), 2000)
  }

  const handleRenewal = async () => {
    if (!subscriptionPrice || parseInt(subscriptionPrice) <= 0) {
      setError(`⚠️ ${t('renewal.errors.invalidPrice')}`)
      return
    }

    if (!startDate || !expiryDate) {
      setError(`⚠️ ${t('renewal.errors.missingDates')}`)
      return
    }

    if (new Date(expiryDate) <= new Date(startDate)) {
      setError(`⚠️ ${t('renewal.errors.invalidDateRange')}`)
      return
    }

    setLoading(true)
    setError('')

    try {
      console.log('📄 إرسال طلب التجديد...')

      console.log('📤 إرسال طلب التجديد:', {
        staffName: user?.name,
        offerId: selectedOfferId,
        offerName: selectedOfferName
      })

      const response = await fetch('/api/members/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          subscriptionPrice: parseInt(subscriptionPrice),
          startDate,
          expiryDate,
          notes,
          paymentMethod,
          staffName: user?.name || '',
          referringCoachId,
          offerId: selectedOfferId || undefined,
          offerName: selectedOfferName || undefined
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        console.log('✅ تم التجديد بنجاح:', data)
        
        if (data.receipt) {
          onSuccess(data.receipt)
        } else {
          onSuccess()
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || `❌ ${t('renewal.errors.renewalFailed')}`)
      }
    } catch (error) {
      console.error('❌ خطأ في التجديد:', error)
      setError(`❌ ${t('renewal.errors.unexpectedError')}`)
    } finally {
      setLoading(false)
    }
  }

  const duration = calculateDays(startDate, expiryDate)
  const totalAmount = subscriptionPrice ? parseInt(subscriptionPrice) : 0

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        <div className="p-4 border-b bg-white">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <span>🔄</span>
                <span>{t('renewal.title')}</span>
              </h3>
              <p className="text-sm text-gray-600 mt-1">{t('renewal.subtitle')}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              type="button"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
        {successMessage && (
          <div className="bg-green-100 text-green-800 p-3 rounded-lg text-center font-medium text-sm mb-4">
            {successMessage}
          </div>
        )}

        {/* قسم العروض */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-4 mb-4">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-purple-800">
            <span>🎁</span>
            <span>{t('renewal.availableOffers')}</span>
          </h3>
          <p className="text-xs text-gray-600 mb-3">{t('renewal.selectOfferToAutoFill')}</p>

          {!Array.isArray(offers) || offers.length === 0 ? (
            <div className="text-center py-4 bg-white rounded-xl border-2 border-dashed border-gray-300">
              <p className="text-gray-500 text-xs">{t('renewal.noOffersAvailable')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('renewal.adminCanAddOffers')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {offers.map(offer => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => applyOffer(offer)}
                  className="bg-white border-2 border-orange-300 hover:border-orange-600 hover:bg-orange-50 rounded-xl p-4 transition transform hover:scale-105 hover:shadow-xl group text-right"
                >
                  <div className="text-3xl mb-2 text-center">{offer.icon}</div>
                  <div className="font-bold text-orange-800 mb-2 text-base text-center">{offer.name}</div>
                  <div className="text-2xl font-bold text-green-600 mb-3 text-center">{offer.price.toLocaleString()} {t('renewal.currency')}</div>
                  <div className="text-xs text-gray-700 space-y-1.5 bg-gray-50 p-2 rounded-lg max-h-60 overflow-y-auto">
                    <div className="font-semibold text-gray-800 border-b pb-1">⏱️ {t('renewal.duration')}: {offer.duration} {t('renewal.days')}</div>

                    <div className="font-medium text-gray-700 mt-2">💪 {t('renewal.training')}:</div>
                    <div className="pr-2">• {t('renewal.onboarding')}: {offer.onboardingSessions || 0}</div>
                    <div className="pr-2">• {t('renewal.followUp')}: {offer.followUpSessions || 0}</div>
                    <div className="pr-2">• PT: {offer.freePTSessions} {t('renewal.sessions')}</div>

                    <div className="font-medium text-gray-700 mt-2">🎁 {t('renewal.services')}:</div>
                    <div className="pr-2">⚖️ InBody: {offer.inBodyScans}</div>
                    <div className="pr-2">🏃 Movement: {offer.movementAssessments || 0}</div>
                    <div className="pr-2">🥗 {t('renewal.nutrition')}: {offer.nutritionSessions || 0}</div>
                    <div className="pr-2">🎟️ {t('renewal.invitations')}: {offer.invitations || 0}</div>

                    <div className="font-medium text-gray-700 mt-2">🏋️ {t('renewal.classes')}:</div>
                    <div className="pr-2">🥊 {t('renewal.groupClasses')}: {offer.groupClasses || 0}</div>
                    <div className="pr-2">🏊 {t('renewal.pool')}: {offer.poolSessions === 999 ? t('renewal.unlimited') : (offer.poolSessions || 0)}</div>
                    <div className="pr-2">🎾 {t('renewal.paddle')}: {offer.paddleSessions || 0}</div>
                    {(offer.medicalScreeningSessions || 0) > 0 && (
                      <div className="pr-2">🩺 كشف طبي: {offer.medicalScreeningSessions}</div>
                    )}

                    <div className="font-medium text-gray-700 mt-2">📊 {t('renewal.goals')}:</div>
                    <div className="pr-2">🎯 {t('renewal.attendance')}: {offer.monthlyAttendanceGoal || 0}/{t('renewal.month')}</div>
                    <div className="pr-2">❄️ {t('renewal.freezing')}: {offer.freezingDays || 0} {t('renewal.days')}</div>
                    {offer.upgradeAllowedDays > 0 && (
                      <div className="pr-2">⬆️ {t('renewal.upgradeWithin')}: {offer.upgradeAllowedDays} {t('renewal.days')}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className={`mt-3 bg-blue-100 p-2 rounded ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-blue-500`}>
            <p className="text-xs text-blue-800">
              <strong>💡 {t('renewal.note')}:</strong> {t('renewal.noteCanEditAfterOffer')}
            </p>
          </div>
        </div>

        <div className={`bg-blue-50 border-blue-500 p-3 rounded-lg mb-4 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'}`}>
          <h4 className="font-bold text-blue-900 mb-2 text-sm">{t('renewal.memberInfo')}</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <p className="text-blue-800">
              <strong>{t('renewal.name')}:</strong> {member.name}
            </p>
            <p className="text-blue-800">
              <strong>{t('renewal.memberNumber')}:</strong> #{member.memberNumber}
            </p>
            <p className="text-blue-800">
              <strong>{t('renewal.currentPT')}:</strong> {member.freePTSessions || 0}
            </p>
            <p className="text-blue-800">
              <strong>{t('renewal.currentInBody')}:</strong> {member.inBodyScans || 0}
            </p>
            <p className="text-blue-800">
              <strong>{t('renewal.currentInvitations')}:</strong> {member.invitations || 0}
            </p>
            {member.expiryDate && (
              <p className="text-blue-800">
                <strong>{t('renewal.previousExpiry')}:</strong> {formatDateYMD(member.expiryDate)}
              </p>
            )}
          </div>
          {member.expiryDate && (
            <div className="mt-3 bg-green-100 border-2 border-green-400 rounded-lg p-3">
              <p className="text-sm text-green-800 flex items-center gap-2">
                <span>✅</span>
                <span>
                  {locale === 'ar'
                    ? `التجديد سيبدأ من تاريخ الانتهاء الأخير: ${formatDateYMD(member.expiryDate)}`
                    : `Renewal will start from last expiry date: ${formatDateYMD(member.expiryDate)}`
                  }
                </span>
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border-r-4 border-red-500 p-3 rounded-lg mb-3">
            <p className="text-red-700 font-medium text-sm">{error}</p>
          </div>
        )}

        <form id="renewal-form" onSubmit={(e) => { e.preventDefault(); handleRenewal(); }} className="space-y-3">

          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
              <span>💰</span>
              <span>{t('renewal.renewalDetails')}</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  {t('renewal.subscriptionPrice')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={subscriptionPrice}
                  onChange={(e) => setSubscriptionPrice(e.target.value)}
                  className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                  placeholder={t('renewal.subscriptionPricePlaceholder')}
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  {t('renewal.staffName')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={staffName}
                  readOnly
                  className="w-full px-3 py-2 border-2 rounded-lg bg-gray-100 cursor-not-allowed text-sm"
                  placeholder={t('renewal.staffNamePlaceholder')}
                />
              </div>
            </div>

            {subscriptionPrice && (
              <div className="mt-2 bg-green-50 border-2 border-green-300 rounded-lg p-2">
                <p className="text-xs text-green-800">
                  💵 <strong>{t('renewal.paidAmount')}:</strong> {calculatePaidAmount()} {t('renewal.currency')}
                </p>
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
              <span>📅</span>
              <span>{t('renewal.subscriptionPeriod')}</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  {t('renewal.startDate')} <span className="text-red-600">*</span> <span className="text-xs text-gray-500">{t('renewal.dateFormat')}</span>
                </label>
                <input
                  type="text"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                  placeholder={t('renewal.startDatePlaceholder')}
                  pattern="\d{4}-\d{2}-\d{2}"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  {t('renewal.expiryDate')} <span className="text-red-600">*</span> <span className="text-xs text-gray-500">{t('renewal.dateFormat')}</span>
                </label>
                <input
                  type="text"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                  placeholder={t('renewal.expiryDatePlaceholder')}
                  pattern="\d{4}-\d{2}-\d{2}"
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <p className="text-xs font-medium mb-2">⚡ {t('renewal.quickAdd')}:</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 6, 9, 12].map(months => (
                  <button
                    key={months}
                    type="button"
                    onClick={() => calculateExpiryFromMonths(months)}
                    className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-xs transition font-medium"
                  >
                    + {months} {months === 1 ? t('renewal.month') : t('renewal.months')}
                  </button>
                ))}
              </div>
            </div>

            {duration > 0 && expiryDate && (
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-2">
                <p className="text-xs text-blue-800">
                  ⏱️ <strong>{t('renewal.subscriptionDuration')}:</strong> {duration} {t('renewal.days')}
                  {duration >= 30 &&
                    ` (${Math.floor(duration / 30)} ${Math.floor(duration / 30) === 1 ? t('renewal.month') : t('renewal.months')})`
                  }
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
              <span>💳</span>
              <span>{t('renewal.paymentMethod')}</span>
            </h4>
            <PaymentMethodSelector
              value={paymentMethod}
              onChange={setPaymentMethod}
            />
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <label className="block text-sm font-medium mb-2">
              📝 {t('renewal.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              rows={3}
              placeholder={t('renewal.notesPlaceholder')}
            />
          </div>
          </div>

          {/* Referring Coach */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <label className="block text-sm font-medium mb-2 text-gray-700">
              المدرب المُسوّق للتجديد (اختياري)
            </label>

            <select
              value={referringCoachId}
              onChange={(e) => setReferringCoachId(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            >
              <option value="">-- لا يوجد --</option>
              {coaches.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.name} {coach.phone && `(${coach.phone})`}
                </option>
              ))}
            </select>

            {referringCoachId && (
              <p className="text-sm text-green-600 mt-2">
                ✅ سيحصل المدرب على عمولة 5% من التجديد
              </p>
            )}
          </div>
        </form>
        </div>

        <div className="flex gap-3 bg-white p-3 border-t">
          <button
            type="submit"
            form="renewal-form"
            disabled={loading || duration <= 0}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-400 font-bold shadow-lg transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <span>{t('renewal.renewing')}</span>
              </span>
            ) : (
              t('renewal.renewButton')
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 font-bold"
          >
            {t('renewal.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}