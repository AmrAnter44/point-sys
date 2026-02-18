'use client'

import { useState, useEffect } from 'react'
import PaymentMethodSelector from './Paymentmethodselector'
import { formatDateYMD } from '../lib/dateFormatter'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'
import { calculateOnboardingBonus } from '../lib/commissions/onboarding'

interface Member {
  id: string
  memberNumber: number
  name: string
  phone: string
  freePTSessions?: number
  inBodyScans: number
  invitations: number
  subscriptionPrice: number
  remainingAmount?: number
  currentOfferId?: string | null
  currentOfferName?: string | null
  startDate?: string
  expiryDate?: string
}

interface UpgradeableOffer {
  id: string
  name: string
  duration: number
  price: number
  upgradePrice: number
  freePTSessions: number
  inBodyScans: number
  invitations: number
  movementAssessments: number
  nutritionSessions: number
  monthlyAttendanceGoal: number
  upgradeAllowedDays: number
  onboardingSessions: number
  followUpSessions: number
  groupClasses: number
  poolSessions: number
  paddleSessions: number
  freezingDays: number
  icon: string
}

interface Receipt {
  receiptNumber: number
  amount: number
  paymentMethod: string
  createdAt: string
  itemDetails: any
}

interface UpgradeFormProps {
  member: Member
  onSuccess: (receipt?: Receipt) => void
  onClose: () => void
}

export default function UpgradeForm({ member, onSuccess, onClose }: UpgradeFormProps) {
  const { user } = usePermissions()
  const { t, locale } = useLanguage()

  const [eligible, setEligible] = useState(false)
  const [eligibilityReason, setEligibilityReason] = useState('')
  const [daysRemaining, setDaysRemaining] = useState(0)
  const [currentOffer, setCurrentOffer] = useState<any>(null)
  const [offers, setOffers] = useState<UpgradeableOffer[]>([])
  const [selectedOfferId, setSelectedOfferId] = useState('')
  const [selectedOffer, setSelectedOffer] = useState<UpgradeableOffer | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [coaches, setCoaches] = useState<any[]>([])
  const [referringCoachId, setReferringCoachId] = useState('')
  const [customPrice, setCustomPrice] = useState<number | null>(null)
  const [attendanceInfo, setAttendanceInfo] = useState<{
    eligible: boolean
    currentAverage: number
    requiredAverage: number
    discountPercent: number
    discountAmount: number
  } | null>(null)

  useEffect(() => {
    fetchUpgradeableOffers()
    fetchCoaches()
  }, [])

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

  const fetchUpgradeableOffers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/members/upgrade?memberId=${member.id}`)
      const data = await response.json()

      if (data.eligible) {
        setEligible(true)
        setDaysRemaining(data.daysRemaining || 0)
        setCurrentOffer(data.currentOffer)
        setOffers(data.offers || [])
      } else {
        setEligible(false)
        setEligibilityReason(data.reason || t('memberDetails.upgradeSubscription.notEligible'))
      }
    } catch (error) {
      console.error('خطأ في جلب باقات الترقية:', error)
      setError('فشل جلب باقات الترقية')
    } finally {
      setLoading(false)
    }
  }

  const handleOfferSelect = async (offer: UpgradeableOffer) => {
    setSelectedOfferId(offer.id)
    setSelectedOffer(offer)
    setCustomPrice(null) // reset custom price on offer change
    setError('')

    // جلب تفاصيل خصم الحضور
    await fetchAttendanceDiscount(offer.id, offer.upgradePrice)
  }

  // حساب onboarding bonus بناءً على مدة العرض المختار
  const getCoachOnboardingBonus = () => {
    if (!selectedOffer) return 0
    const subscriptionMonths = selectedOffer.duration
    return calculateOnboardingBonus(subscriptionMonths)
  }

  const fetchAttendanceDiscount = async (newOfferId: string, baseUpgradePrice: number) => {
    try {
      // حساب تفاصيل السعر مع خصم الحضور
      const response = await fetch('/api/members/upgrade/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          currentOfferId: member.currentOfferId,
          newOfferId,
          startDate: member.startDate
        })
      })

      if (response.ok) {
        const data = await response.json()

        if (data.attendanceEligibility) {
          setAttendanceInfo({
            eligible: data.attendanceEligibility.eligible,
            currentAverage: data.attendanceEligibility.currentAverage,
            requiredAverage: data.attendanceEligibility.requiredAverage,
            discountPercent: data.attendanceEligibility.discountPercent,
            discountAmount: data.attendanceDiscount || 0
          })
        } else {
          setAttendanceInfo(null)
        }

        // تحديث سعر الترقية في الباقة المحددة
        if (data.upgradePrice !== undefined) {
          setSelectedOffer(prev => prev ? { ...prev, upgradePrice: data.upgradePrice } : null)
        }
      }
    } catch (error) {
      console.error('خطأ في جلب معلومات خصم الحضور:', error)
      setAttendanceInfo(null)
    }
  }

  const calculateNewExpiryDate = () => {
    if (!member.expiryDate || !selectedOffer || !currentOffer) return ''

    // الصيغة الصحيحة: تاريخ الانتهاء الحالي + فرق المدتين
    const extraDays = selectedOffer.duration - (currentOffer.duration || 0)
    const currentExpiry = new Date(member.expiryDate)
    const newExpiry = new Date(currentExpiry)
    newExpiry.setDate(newExpiry.getDate() + extraDays)

    return formatDateYMD(newExpiry)
  }

  const handleUpgradeSubmit = async () => {
    if (!selectedOfferId || !selectedOffer) {
      setError(t('memberDetails.upgradeSubscription.selectPackageError'))
      return
    }

    setShowConfirmation(false)
    setProcessing(true)
    setError('')

    try {
      const response = await fetch('/api/members/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          newOfferId: selectedOfferId,
          paymentMethod,
          staffName: user?.name || '',
          notes,
          referringCoachId,
          customPrice: customPrice !== null ? customPrice : undefined
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ تمت الترقية بنجاح:', data)

        if (data.receipt) {
          onSuccess(data.receipt)
        } else {
          onSuccess()
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'فشلت عملية الترقية')
      }
    } catch (error) {
      console.error('خطأ في الترقية:', error)
      setError('حدث خطأ غير متوقع')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
        style={{ zIndex: 9999 }}
      >
        <div className="bg-white rounded-2xl p-8 max-w-md">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">{t('memberDetails.upgradeSubscription.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!eligible) {
    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
        style={{ zIndex: 9999 }}
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl p-6 max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold mb-4">{t('memberDetails.upgradeSubscription.notEligible')}</h3>
            <p className="text-gray-600 mb-6">{eligibilityReason}</p>
            <button
              onClick={onClose}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
            >
              {t('memberDetails.upgradeSubscription.close')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <span>🚀</span>
            <span>{t('memberDetails.upgradeSubscription.title')}</span>
          </h3>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl leading-none"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {/* معلومات العضو الحالية */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
              <span>👤</span>
              <span>{t('memberDetails.upgradeSubscription.currentInfo')}</span>
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-600">{t('memberDetails.upgradeSubscription.name')}</p>
                <p className="font-bold text-blue-900">{member.name}</p>
              </div>
              <div>
                <p className="text-gray-600">{t('memberDetails.upgradeSubscription.memberNumber')}</p>
                <p className="font-bold text-blue-900">#{member.memberNumber}</p>
              </div>
              <div>
                <p className="text-gray-600">{t('memberDetails.upgradeSubscription.currentPackage')}</p>
                <p className="font-bold text-blue-900">{member.currentOfferName || t('memberDetails.upgradeSubscription.undefined')}</p>
              </div>
              <div>
                <p className="text-gray-600">{t('memberDetails.upgradeSubscription.startDate')}</p>
                <p className="font-bold text-blue-900">{member.startDate ? formatDateYMD(member.startDate) : '-'}</p>
              </div>
              <div>
                <p className="text-gray-600">{t('memberDetails.upgradeSubscription.currentEndDate')}</p>
                <p className="font-bold text-blue-900">{member.expiryDate ? formatDateYMD(member.expiryDate) : '-'}</p>
              </div>
              <div>
                <p className="text-gray-600">{t('memberDetails.upgradeSubscription.daysRemaining')}</p>
                <p className="font-bold text-green-600">{daysRemaining} {t('memberDetails.upgradeSubscription.days')}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-sm font-bold text-gray-700 mb-2">{t('memberDetails.upgradeSubscription.currentSessions')}:</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-600">PT</p>
                  <p className="font-bold text-lg text-purple-600">{member.freePTSessions}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-600">InBody</p>
                  <p className="font-bold text-lg text-purple-600">{member.inBodyScans}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-600">Invitations</p>
                  <p className="font-bold text-lg text-purple-600">{member.invitations}</p>
                </div>
              </div>
            </div>
          </div>

          {/* تحذيرات مهمة */}
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-yellow-900 mb-3 flex items-center gap-2">
              <span>⚠️</span>
              <span>{t('memberDetails.upgradeSubscription.importantWarnings')}</span>
            </h4>
            <ul className="space-y-2 text-sm text-yellow-900">
              <li className="flex items-start gap-2">
                <span>•</span>
                <span><strong>{t('memberDetails.upgradeSubscription.sessionReplacement')}:</strong> {t('memberDetails.upgradeSubscription.sessionReplacementDesc')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span><strong>{t('memberDetails.upgradeSubscription.startDateWarning')}:</strong> {t('memberDetails.upgradeSubscription.startDateWarningDesc')} ({member.startDate ? formatDateYMD(member.startDate) : '-'})</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span><strong>{t('memberDetails.upgradeSubscription.endDateWarning')}:</strong> {t('memberDetails.upgradeSubscription.endDateWarningDesc')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span><strong>{t('memberDetails.upgradeSubscription.amountWarning')}:</strong> {t('memberDetails.upgradeSubscription.amountWarningDesc')}</span>
              </li>
            </ul>
          </div>

          {/* الباقات المتاحة */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
              <span>🎁</span>
              <span>{t('memberDetails.upgradeSubscription.selectNewPackage')}</span>
            </h4>

            {offers.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border-2 border-dashed border-gray-300">
                <p className="text-gray-500">{t('memberDetails.upgradeSubscription.noPackagesAvailable')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {offers.map(offer => (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => handleOfferSelect(offer)}
                    className={`bg-white border-2 rounded-xl p-4 transition transform hover:scale-105 hover:shadow-xl text-right
                      ${selectedOfferId === offer.id
                        ? 'border-purple-600 bg-purple-50 shadow-lg'
                        : 'border-purple-300 hover:border-purple-500'
                      }`}
                  >
                    <div className="text-4xl mb-2 text-center">{offer.icon}</div>
                    <div className="font-bold text-purple-900 mb-2 text-lg text-center">{offer.name}</div>

                    <div className="text-center mb-3">
                      <div className="text-sm text-gray-600 line-through">
                        {offer.price.toLocaleString()} ج.م
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {offer.upgradePrice.toLocaleString()} ج.م
                      </div>
                      <div className="text-xs text-green-700">{t('memberDetails.upgradeSubscription.upgradePrice')}</div>
                    </div>

                    <div className="text-xs text-gray-700 space-y-1 bg-gray-50 p-3 rounded-lg">
                      <div className="font-semibold text-gray-800 border-b pb-1">
                        ⏱️ {t('memberDetails.upgradeSubscription.duration')}: {offer.duration} {t('memberDetails.upgradeSubscription.days')}
                      </div>
                      <div>💪 PT: {offer.freePTSessions}</div>
                      <div>⚖️ InBody: {offer.inBodyScans}</div>
                      <div>🎟️ Invitations: {offer.invitations}</div>
                      <div>🥗 Nutrition: {offer.nutritionSessions}</div>
                      <div>🥊 Group Classes: {offer.groupClasses}</div>
                    </div>

                    {selectedOfferId === offer.id && (
                      <div className="mt-2 bg-purple-600 text-white text-center py-1 rounded-lg text-sm">
                        ✓ {t('memberDetails.upgradeSubscription.selected')}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* معلومات خصم الحضور */}
          {selectedOffer && attendanceInfo && (
            <div
              className={`rounded-xl p-4 mb-4 border-2 ${
                attendanceInfo.eligible
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
                  : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">
                  {attendanceInfo.eligible ? '✅' : '❌'}
                </span>
                <div>
                  <h4 className={`font-bold text-lg ${attendanceInfo.eligible ? 'text-green-900' : 'text-gray-700'}`}>
                    {attendanceInfo.eligible ? t('memberDetails.upgradeSubscription.attendanceDiscount.eligible') : t('memberDetails.upgradeSubscription.attendanceDiscount.notEligible')}
                  </h4>
                  {attendanceInfo.eligible && (
                    <p className="text-sm text-green-700">
                      {t('memberDetails.upgradeSubscription.attendanceDiscount.discountPercent')} {(attendanceInfo.discountPercent * 100).toFixed(0)}% {t('memberDetails.upgradeSubscription.attendanceDiscount.onUpgradePrice')}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('memberDetails.upgradeSubscription.attendanceDiscount.currentAverage')}:</span>
                  <span className={`font-bold ${
                    attendanceInfo.currentAverage >= attendanceInfo.requiredAverage
                      ? 'text-green-600'
                      : 'text-gray-700'
                  }`}>
                    {attendanceInfo.currentAverage.toFixed(1)} {t('memberDetails.upgradeSubscription.attendanceDiscount.visitsPerMonth')}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('memberDetails.upgradeSubscription.attendanceDiscount.requiredAverage')}:</span>
                  <span className="font-bold text-gray-700">
                    {attendanceInfo.requiredAverage} {t('memberDetails.upgradeSubscription.attendanceDiscount.visitsPerMonth')}
                  </span>
                </div>

                {attendanceInfo.eligible && attendanceInfo.discountAmount > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-green-200">
                    <span className="text-green-700 font-semibold">{t('memberDetails.upgradeSubscription.attendanceDiscount.discountAmount')}:</span>
                    <span className="font-bold text-green-600 text-lg">
                      {attendanceInfo.discountAmount.toFixed(2)} ج.م
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* معاينة التغييرات */}
          {selectedOffer && (
            <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-300 rounded-xl p-4 mb-4">
              <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                <span>📊</span>
                <span>{t('memberDetails.upgradeSubscription.upgradeSummary')}</span>
              </h4>

              {/* مقارنة الباقات */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-600 mb-1">{t('memberDetails.upgradeSubscription.oldPackage')}</p>
                  <p className="font-bold text-red-600">{member.currentOfferName}</p>
                  <p className="text-sm text-gray-500">{currentOffer?.duration} {t('memberDetails.upgradeSubscription.days')}</p>
                </div>
                <div className="flex items-center justify-center">
                  <span className="text-3xl">→</span>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-600 mb-1">{t('memberDetails.upgradeSubscription.newPackage')}</p>
                  <p className="font-bold text-green-600">{selectedOffer.name}</p>
                  <p className="text-sm text-gray-500">{selectedOffer.duration} {t('memberDetails.upgradeSubscription.days')}</p>
                </div>
              </div>

              {/* السعر */}
              <div className="bg-white rounded-lg p-3 mb-3">
                <p className="text-sm font-bold text-gray-700 mb-2">💰 {t('memberDetails.upgradeSubscription.priceDetails')}:</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>{t('memberDetails.upgradeSubscription.oldPackagePrice')}:</span>
                    <span className="font-bold">{currentOffer?.price.toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('memberDetails.upgradeSubscription.newPackagePrice')}:</span>
                    <span className="font-bold">{selectedOffer.price.toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>{t('memberDetails.upgradeSubscription.difference')}:</span>
                    <span className="font-bold">
                      {(selectedOffer.price - (currentOffer?.price || 0)).toLocaleString()} ج.م
                    </span>
                  </div>
                  {attendanceInfo && attendanceInfo.eligible && attendanceInfo.discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>{t('memberDetails.upgradeSubscription.attendanceDiscountAmount')} ({(attendanceInfo.discountPercent * 100).toFixed(0)}%):</span>
                      <span className="font-bold">- {attendanceInfo.discountAmount.toFixed(2)} ج.م</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t-2 border-green-300">
                    <span className="font-bold">{t('memberDetails.upgradeSubscription.amountDue')}:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm line-through">
                        {selectedOffer.upgradePrice.toLocaleString()} ج.م
                      </span>
                      <input
                        type="number"
                        value={customPrice !== null ? customPrice : selectedOffer.upgradePrice}
                        onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
                        className="w-32 border-2 border-green-400 rounded px-2 py-1 text-green-700 font-bold text-sm focus:outline-none focus:border-green-600"
                        min="0"
                      />
                      <span className="text-sm text-gray-600">ج.م</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* الحصص */}
              <div className="bg-white rounded-lg p-3 mb-3">
                <p className="text-sm font-bold text-gray-700 mb-2">🎁 {t('memberDetails.upgradeSubscription.sessionsWillReplace')}:</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-600 mb-1">PT</p>
                    <p className="line-through text-red-600">{member.freePTSessions}</p>
                    <p className="text-green-600 font-bold">→ {selectedOffer.freePTSessions}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">InBody</p>
                    <p className="line-through text-red-600">{member.inBodyScans}</p>
                    <p className="text-green-600 font-bold">→ {selectedOffer.inBodyScans}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Invitations</p>
                    <p className="line-through text-red-600">{member.invitations}</p>
                    <p className="text-green-600 font-bold">→ {selectedOffer.invitations}</p>
                  </div>
                </div>
              </div>

              {/* التواريخ */}
              <div className="bg-white rounded-lg p-3">
                <p className="text-sm font-bold text-gray-700 mb-2">📅 {t('memberDetails.upgradeSubscription.dates')}:</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>{t('memberDetails.upgradeSubscription.startDate')}:</span>
                    <span className="font-bold text-orange-600">
                      {formatDateYMD(new Date())} (من اليوم - يبدأ العداد من الصفر)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{t('memberDetails.upgradeSubscription.currentEndDate')}:</span>
                    <div className="text-right">
                      <p className="line-through text-red-600">
                        {member.expiryDate ? formatDateYMD(member.expiryDate) : '-'}
                      </p>
                      <p className="text-green-600 font-bold">
                        → {calculateNewExpiryDate()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* طريقة الدفع والملاحظات */}
          {selectedOffer && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span>💳</span>
                    <span>{t('memberDetails.upgradeSubscription.paymentMethod')}</span>
                  </h4>
                  <PaymentMethodSelector
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                  />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-bold text-gray-800 mb-2">
                    📝 {t('memberDetails.upgradeSubscription.notes')}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
                    rows={3}
                    placeholder={t('memberDetails.upgradeSubscription.notesPlaceholder')}
                  />
                </div>
              </div>

              {/* Referring Coach */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  {t('memberDetails.upgradeSubscription.referringCoach')}
                </label>

                <select
                  value={referringCoachId}
                  onChange={(e) => setReferringCoachId(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                >
                  <option value="">{t('memberDetails.upgradeSubscription.noCoach')}</option>
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.name} {coach.phone && `(${coach.phone})`}
                    </option>
                  ))}
                </select>

                {referringCoachId && getCoachOnboardingBonus() > 0 && (
                  <p className="text-sm text-green-600 mt-2">
                    ✅ {t('members.form.coachWillReceiveCommission', { amount: getCoachOnboardingBonus().toString() })}
                  </p>
                )}

                {getCoachOnboardingBonus() > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    💡 {t('members.form.coachCommissionNote', { amount: getCoachOnboardingBonus().toString() })}
                  </p>
                )}
              </div>
            </>
          )}

          {/* رسالة خطأ */}
          {error && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3 mb-4">
              <p className="text-red-700 font-medium text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 bg-white p-4 border-t">
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!selectedOfferId || processing}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 font-bold shadow-lg transition-all"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{t('memberDetails.upgradeSubscription.upgrading')}</span>
              </span>
            ) : (
              `🚀 ${t('memberDetails.upgradeSubscription.confirmButton')}`
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 font-bold"
          >
            {t('memberDetails.upgradeSubscription.cancel')}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && selectedOffer && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4"
          style={{ zIndex: 10000 }}
          onClick={() => setShowConfirmation(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">⚠️</div>
              <h3 className="text-xl font-bold text-gray-900">{t('memberDetails.upgradeSubscription.confirmTitle')}</h3>
            </div>

            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-4 text-sm">
              <p className="font-bold mb-2">{t('memberDetails.upgradeSubscription.confirmMessage')}</p>
              <ul className="space-y-1 text-gray-700">
                <li>• {t('memberDetails.upgradeSubscription.confirmWarning1')}</li>
                <li>• {t('memberDetails.upgradeSubscription.confirmWarning2')}: <strong>{(customPrice !== null ? customPrice : selectedOffer.upgradePrice).toLocaleString()} ج.م</strong></li>
                <li>• {t('memberDetails.upgradeSubscription.confirmWarning3')}: <strong>{selectedOffer.name}</strong></li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleUpgradeSubmit}
                className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-bold"
              >
                ✅ {t('memberDetails.upgradeSubscription.confirmYes')}
              </button>
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-bold"
              >
                {t('memberDetails.upgradeSubscription.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
