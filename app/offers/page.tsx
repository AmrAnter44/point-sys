'use client'

import { useState, useEffect } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'
import { useLanguage } from '@/contexts/LanguageContext'

interface Offer {
  id: string
  name: string
  duration: number
  price: number
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
  medicalScreeningSessions: number
  freezingDays: number
  attendanceLimit: number
  icon: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function OffersPage() {
  const { t, direction } = useLanguage()
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [isReplacing, setIsReplacing] = useState(false)
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)

  // حالة نموذج إضافة/تعديل عرض
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    duration: 30,
    price: 0,
    freePTSessions: 0,
    inBodyScans: 0,
    invitations: 0,
    movementAssessments: 0,
    nutritionSessions: 0,
    monthlyAttendanceGoal: 0,
    upgradeAllowedDays: 0,
    onboardingSessions: 0,
    followUpSessions: 0,
    groupClasses: 0,
    poolSessions: 0,
    paddleSessions: 0,
    medicalScreeningSessions: 0,
    freezingDays: 0,
    attendanceLimit: 0,
    icon: '🎁'
  })

  // حالة modal الحذف
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [offerToDelete, setOfferToDelete] = useState<Offer | null>(null)

  useEffect(() => {
    fetchOffers()
  }, [])

  const fetchOffers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/offers')
      const data = await response.json()
      // التأكد من أن البيانات array
      if (Array.isArray(data)) {
        setOffers(data)
      } else {
        console.warn('⚠️ البيانات المستلمة ليست array:', data)
        setOffers([])
        setError(t('offers.messages.dataError'))
      }
    } catch (error) {
      console.error('Error fetching offers:', error)
      setOffers([])
      setError(t('offers.messages.fetchError'))
    } finally {
      setLoading(false)
    }
  }

  const handleStartEdit = (offer: Offer) => {
    setEditingOfferId(offer.id)
    setEditPrice(offer.price.toString())
  }

  const handleCancelEdit = () => {
    setEditingOfferId(null)
    setEditPrice('')
  }

  const handleUpdatePrice = async (offerId: string) => {
    setError('')
    setSuccess('')

    try {
      const offer = offers.find(o => o.id === offerId)
      if (!offer) return

      const response = await fetch('/api/offers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: offerId,
          price: parseFloat(editPrice)
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('offers.updatePriceError'))
      }

      setSuccess(`✅ ${t('offers.priceUpdated', { name: offer.name })}`)
      setEditingOfferId(null)
      setEditPrice('')
      fetchOffers()
    } catch (error: any) {
      setError(error.message || t('offers.updatePriceError'))
    }
  }

  const handleReplaceOffers = async () => {
    setShowReplaceConfirm(false)
    setIsReplacing(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/offers/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'فشل استبدال العروض')
      }

      setSuccess(data.message)
      fetchOffers()
    } catch (error: any) {
      setError(error.message || 'حدث خطأ أثناء استبدال العروض')
    } finally {
      setIsReplacing(false)
    }
  }

  // فتح نموذج إضافة عرض جديد
  const handleAddNew = () => {
    setEditingOffer(null)
    setFormData({
      name: '',
      duration: 30,
      price: 0,
      freePTSessions: 0,
      inBodyScans: 0,
      invitations: 0,
      movementAssessments: 0,
      nutritionSessions: 0,
      monthlyAttendanceGoal: 0,
      upgradeAllowedDays: 0,
      onboardingSessions: 0,
      followUpSessions: 0,
      groupClasses: 0,
      poolSessions: 0,
      paddleSessions: 0,
      medicalScreeningSessions: 0,
      freezingDays: 0,
      attendanceLimit: 0,
      icon: '🎁'
    })
    setShowOfferModal(true)
  }

  // فتح نموذج تعديل عرض
  const handleEdit = (offer: Offer) => {
    setEditingOffer(offer)
    setFormData({
      name: offer.name,
      duration: offer.duration,
      price: offer.price,
      freePTSessions: offer.freePTSessions,
      inBodyScans: offer.inBodyScans,
      invitations: offer.invitations,
      movementAssessments: offer.movementAssessments,
      nutritionSessions: offer.nutritionSessions,
      monthlyAttendanceGoal: offer.monthlyAttendanceGoal,
      upgradeAllowedDays: offer.upgradeAllowedDays,
      onboardingSessions: offer.onboardingSessions,
      followUpSessions: offer.followUpSessions,
      groupClasses: offer.groupClasses,
      poolSessions: offer.poolSessions,
      paddleSessions: offer.paddleSessions,
      medicalScreeningSessions: offer.medicalScreeningSessions || 0,
      freezingDays: offer.freezingDays,
      attendanceLimit: offer.attendanceLimit || 0,
      icon: offer.icon
    })
    setShowOfferModal(true)
  }

  // حفظ العرض (إضافة أو تعديل)
  const handleSaveOffer = async () => {
    setError('')
    setSuccess('')

    if (!formData.name || !formData.duration || formData.price === undefined) {
      setError('⚠️ ' + t('offers.messages.fillAllFields'))
      return
    }

    try {
      setLoading(true)
      const url = '/api/offers'
      const method = editingOffer ? 'PUT' : 'POST'
      const body = editingOffer
        ? { ...formData, id: editingOffer.id }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || (editingOffer ? t('offers.messages.saveError') : t('offers.messages.saveError')))
      }

      setSuccess(editingOffer ? `✅ ${t('offers.messages.updateSuccess')}` : `✅ ${t('offers.messages.addSuccess')}`)
      setShowOfferModal(false)
      fetchOffers()
    } catch (error: any) {
      setError(error.message || t('offers.messages.saveErrorGeneral'))
    } finally {
      setLoading(false)
    }
  }

  // فتح modal الحذف
  const handleDeleteClick = (offer: Offer) => {
    setOfferToDelete(offer)
    setShowDeleteConfirm(true)
  }

  // حذف العرض
  const handleDeleteOffer = async () => {
    if (!offerToDelete) return

    setShowDeleteConfirm(false)
    setError('')
    setSuccess('')

    try {
      setLoading(true)
      const response = await fetch(`/api/offers?id=${offerToDelete.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('offers.messages.deleteError'))
      }

      setSuccess(`✅ ${t('offers.messages.deleteSuccess')}`)
      fetchOffers()
    } catch (error: any) {
      setError(error.message || t('offers.messages.deleteErrorGeneral'))
    } finally {
      setLoading(false)
      setOfferToDelete(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100" dir={direction}>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">🎁 {t('offers.packagesTitle')}</h1>
              <p className="text-gray-600">{t('offers.packagesSubtitle')}</p>
            </div>
            <button
              onClick={handleAddNew}
              className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg transition"
            >
              <span>➕</span>
              <span>{t('offers.addNewOffer')}</span>
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 bg-red-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-xl">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 bg-green-50 border-2 border-green-200 text-green-700 px-6 py-4 rounded-xl">
              {success}
            </div>
          )}

          {/* زر استبدال العروض */}
          <div className="mb-6 bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-300 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-900 mb-2">
                  ⚠️ استبدال العروض الحالية بالعروض الجديدة
                </h3>
                <p className="text-sm text-red-700 mb-3">
                  هذا الإجراء سيحذف <strong>جميع</strong> العروض الحالية ويستبدلها بالعروض الأربعة الجديدة:
                  Challenger، Fighter، Champion، Elite
                </p>
                <ul className="text-xs text-red-600 space-y-1 mb-4">
                  <li>• سيتم حذف جميع العروض القديمة نهائياً</li>
                  <li>• الأعضاء الحاليون لن يتأثروا (currentOfferId سيبقى كما هو)</li>
                  <li>• التجديدات والترقيات الجديدة ستستخدم العروض الجديدة فقط</li>
                  <li>• هذا الإجراء لا يمكن التراجع عنه</li>
                </ul>
              </div>
              <button
                onClick={() => setShowReplaceConfirm(true)}
                disabled={isReplacing}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-bold transition shadow-lg"
              >
                {isReplacing ? '⏳ جارٍ الاستبدال...' : '🔄 استبدال العروض'}
              </button>
            </div>
          </div>

          {/* مودال التأكيد */}
          {showReplaceConfirm && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
              style={{ zIndex: 9999 }}
              onClick={() => setShowReplaceConfirm(false)}
            >
              <div
                className="bg-white rounded-2xl p-8 max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">⚠️</div>
                  <h3 className="text-2xl font-bold text-red-900 mb-2">تأكيد استبدال العروض</h3>
                  <p className="text-gray-700">
                    هل أنت متأكد من استبدال جميع العروض الحالية بالعروض الأربعة الجديدة؟
                  </p>
                </div>

                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-red-800 font-bold mb-2">تحذير:</p>
                  <ul className="text-xs text-red-700 space-y-1">
                    <li>• لا يمكن التراجع عن هذا الإجراء</li>
                    <li>• سيتم حذف جميع العروض القديمة</li>
                    <li>• الأعضاء الحاليون لن يتأثروا</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleReplaceOffers}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold transition"
                  >
                    ✓ نعم، استبدل العروض
                  </button>
                  <button
                    onClick={() => setShowReplaceConfirm(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-bold transition"
                  >
                    ✕ إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Offers Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-600 border-t-transparent"></div>
              <p className="mt-4 text-gray-600">{t('offers.loading')}</p>
            </div>
          ) : !Array.isArray(offers) || offers.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <p className="text-2xl text-gray-400 mb-2">🎁</p>
              <p className="text-gray-600">{t('offers.noPackages')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="bg-gradient-to-br from-white to-orange-50 border-2 border-orange-200 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all"
                >
                  {/* Header */}
                  <div className="text-center mb-6">
                    <span className="text-5xl block mb-3">{offer.icon}</span>
                    <h3 className="text-2xl font-bold text-gray-800 mb-1">{offer.name}</h3>
                    <p className="text-sm text-gray-500">
                      {offer.duration} {t('offers.days')} ({offer.duration === 30 ? t('offers.oneMonth') : offer.duration === 90 ? t('offers.threeMonths') : offer.duration === 180 ? t('offers.sixMonths') : t('offers.yearly')})
                    </p>
                  </div>

                  {/* Price */}
                  <div className="bg-white rounded-xl p-4 mb-4 border-2 border-orange-300">
                    {editingOfferId === offer.id ? (
                      <div className="space-y-2">
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-full px-3 py-2 border-2 border-orange-400 rounded-lg text-center text-xl font-bold focus:outline-none focus:border-orange-600"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdatePrice(offer.id)}
                            className="flex-1 bg-green-600 text-white py-1.5 rounded-lg font-bold hover:bg-green-700 text-sm"
                          >
                            ✓ {t('offers.save')}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="flex-1 bg-gray-400 text-white py-1.5 rounded-lg font-bold hover:bg-gray-500 text-sm"
                          >
                            ✕ {t('offers.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-3xl font-bold text-orange-600 text-center mb-2">
                          {offer.price.toLocaleString()} {t('offers.priceEGP')}
                        </div>
                        <button
                          onClick={() => handleStartEdit(offer)}
                          className="w-full bg-orange-600 text-white py-2 rounded-lg font-bold hover:bg-orange-700 transition text-sm"
                        >
                          ✏️ {t('offers.editPrice')}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="font-bold text-gray-700 mb-2">💪 {t('offers.integratedTraining')}</div>
                      <div className="text-gray-600">
                        • {offer.onboardingSessions} {t('offers.onboardingSession')}<br/>
                        • {offer.followUpSessions} {t('offers.followUpSessions')}<br/>
                        • {offer.freePTSessions} {t('offers.ptSession')}
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="font-bold text-gray-700 mb-2">🎁 {t('offers.includedServices')}</div>
                      <div className="text-gray-600 space-y-1">
                        <div>⚖️ InBody: {offer.inBodyScans}</div>
                        <div>🏃 {t('offers.movement')}: {offer.movementAssessments}</div>
                        <div>🥗 {t('offers.nutrition')}: {offer.nutritionSessions}</div>
                        <div>🎟️ {t('offers.invitationsLabel')}: {offer.invitations}</div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="font-bold text-gray-700 mb-2">🏋️ {t('offers.classesActivities')}</div>
                      <div className="text-gray-600 space-y-1">
                        <div>🥊 {t('offers.groupClasses')}: {offer.groupClasses}</div>
                        <div>🏊 {t('offers.pool')}: {offer.poolSessions === 999 ? t('offers.unlimited') : offer.poolSessions}</div>
                        <div>🎾 {t('offers.paddle')}: {offer.paddleSessions}</div>
                        {(offer.medicalScreeningSessions || 0) > 0 && (
                          <div>🩺 كشف طبي: {offer.medicalScreeningSessions}</div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="font-bold text-gray-700 mb-2">📊 {t('offers.goalsRules')}</div>
                      <div className="text-gray-600 space-y-1">
                        <div>🎯 {t('offers.monthlyAttendance')}: {offer.monthlyAttendanceGoal} {t('offers.visit')}</div>
                        <div>🚪 {t('offers.attendanceLimit')}: {offer.attendanceLimit === 0 ? t('offers.attendanceLimitUnlimited') : `${offer.attendanceLimit} ${t('offers.days')}`}</div>
                        <div>❄️ {t('offers.freezingDays')}: {offer.freezingDays} {t('offers.days')}</div>
                        {offer.upgradeAllowedDays > 0 && (
                          <div>⬆️ {t('offers.upgradeWithin')}: {offer.upgradeAllowedDays} {t('offers.days')}</div>
                        )}
                        {offer.upgradeAllowedDays === 0 && (
                          <div>⬆️ {t('offers.topTier')}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* أزرار التعديل والحذف */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleEdit(offer)}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-bold transition text-sm"
                    >
                      ✏️ {t('offers.edit')}
                    </button>
                    <button
                      onClick={() => handleDeleteClick(offer)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-bold transition text-sm"
                    >
                      🗑️ {t('offers.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal: إضافة/تعديل عرض */}
          {showOfferModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowOfferModal(false)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">
                    {editingOffer ? `✏️ ${t('offers.editOffer')}` : `➕ ${t('offers.newOffer')}`}
                  </h2>
                  <button
                    onClick={() => setShowOfferModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                  >
                    ×
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* معلومات أساسية */}
                  <div className="md:col-span-3 bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                    <h3 className="font-bold text-orange-900 mb-3">📋 المعلومات الأساسية</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">{t('offers.offerName')}</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 border-2 rounded-lg"
                          placeholder={t('offers.offerNamePlaceholder')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">{t('offers.duration')}</label>
                        <input
                          type="number"
                          value={formData.duration}
                          onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border-2 rounded-lg"
                          placeholder={t('offers.durationPlaceholder')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">{t('offers.price')}</label>
                        <input
                          type="number"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border-2 rounded-lg"
                          placeholder={t('offers.pricePlaceholder')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">{t('offers.icon')}</label>
                        <select
                          value={formData.icon}
                          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                          className="w-full px-3 py-2 border-2 rounded-lg text-2xl"
                        >
                          <option value="🎁">🎁 هدية</option>
                          <option value="⭐">⭐ نجمة</option>
                          <option value="💎">💎 ماسة</option>
                          <option value="👑">👑 تاج</option>
                          <option value="🏆">🏆 كأس</option>
                          <option value="🥇">🥇 ميدالية ذهبية</option>
                          <option value="🥈">🥈 ميدالية فضية</option>
                          <option value="🥉">🥉 ميدالية برونزية</option>
                          <option value="🔥">🔥 نار</option>
                          <option value="⚡">⚡ برق</option>
                          <option value="💪">💪 عضلات</option>
                          <option value="🏋️">🏋️ رفع أثقال</option>
                          <option value="🤸">🤸 جمباز</option>
                          <option value="🚀">🚀 صاروخ</option>
                          <option value="🎯">🎯 هدف</option>
                          <option value="🌟">🌟 نجمة متألقة</option>
                          <option value="✨">✨ بريق</option>
                          <option value="💫">💫 دوامة</option>
                          <option value="🎪">🎪 خيمة</option>
                          <option value="🎨">🎨 فن</option>
                          <option value="🎭">🎭 مسرح</option>
                          <option value="🎬">🎬 سينما</option>
                          <option value="🎸">🎸 جيتار</option>
                          <option value="🎵">🎵 موسيقى</option>
                          <option value="🎼">🎼 نوتة</option>
                          <option value="🏅">🏅 وسام</option>
                          <option value="🎖️">🎖️ ميدالية عسكرية</option>
                          <option value="🏁">🏁 علم سباق</option>
                          <option value="🚩">🚩 علم</option>
                          <option value="🎌">🎌 أعلام</option>
                          <option value="🔰">🔰 شارة مبتدئ</option>
                          <option value="⚜️">⚜️ زخرفة</option>
                          <option value="🌈">🌈 قوس قزح</option>
                          <option value="☀️">☀️ شمس</option>
                          <option value="⭐">⭐ نجمة خماسية</option>
                          <option value="🌠">🌠 نجم مذنب</option>
                          <option value="💥">💥 انفجار</option>
                          <option value="🎆">🎆 ألعاب نارية</option>
                          <option value="🎇">🎇 شرارة</option>
                          <option value="🎉">🎉 احتفال</option>
                          <option value="🎊">🎊 كرة احتفال</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* التدريب المدمج */}
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                    <h3 className="font-bold text-purple-900 mb-3">💪 {t('offers.integratedTraining')}</h3>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">{t('offers.onboardingSession')}</label>
                        <input
                          type="number"
                          value={formData.onboardingSessions}
                          onChange={(e) => setFormData({ ...formData, onboardingSessions: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border-2 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">{t('offers.followUpSessions')}</label>
                        <input
                          type="number"
                          value={formData.followUpSessions}
                          onChange={(e) => setFormData({ ...formData, followUpSessions: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border-2 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">{t('offers.freePTSessions')}</label>
                        <input
                          type="number"
                          value={formData.freePTSessions}
                          onChange={(e) => setFormData({ ...formData, freePTSessions: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border-2 rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* الخدمات المتضمنة */}
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                    <h3 className="font-bold text-green-900 mb-3">🎁 {t('offers.includedServices')}</h3>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">{t('offers.inBodyScans')}</label>
                        <input
                          type="number"
                          value={formData.inBodyScans}
                          onChange={(e) => setFormData({ ...formData, inBodyScans: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border-2 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">{t('offers.movement')}</label>
                        <input
                          type="number"
                          value={formData.movementAssessments}
                          onChange={(e) => setFormData({ ...formData, movementAssessments: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border-2 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">{t('offers.nutrition')}</label>
                        <input
                          type="number"
                          value={formData.nutritionSessions}
                          onChange={(e) => setFormData({ ...formData, nutritionSessions: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border-2 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">{t('offers.freeInvitations')}</label>
                        <input
                          type="number"
                          value={formData.invitations}
                          onChange={(e) => setFormData({ ...formData, invitations: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border-2 rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* الحصص والأنشطة */}
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <h3 className="font-bold text-blue-900 mb-3">🏋️ {t('offers.classesActivities')}</h3>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">{t('offers.groupClasses')}</label>
                        <input
                          type="number"
                          value={formData.groupClasses}
                          onChange={(e) => setFormData({ ...formData, groupClasses: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border-2 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">{t('offers.pool')}</label>
                        <input
                          type="number"
                          value={formData.poolSessions}
                          onChange={(e) => setFormData({ ...formData, poolSessions: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border-2 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">{t('offers.paddle')}</label>
                        <input
                          type="number"
                          value={formData.paddleSessions}
                          onChange={(e) => setFormData({ ...formData, paddleSessions: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border-2 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">🩺 كشف طبي</label>
                        <input
                          type="number"
                          value={(formData as any).medicalScreeningSessions || 0}
                          onChange={(e) => setFormData({ ...formData, medicalScreeningSessions: parseInt(e.target.value) || 0 } as any)}
                          className="w-full px-2 py-1 border-2 rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* الأهداف والقواعد */}
                  <div className="md:col-span-3 bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                    <h3 className="font-bold text-yellow-900 mb-3">📊 {t('offers.goalsRules')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">{t('offers.monthlyAttendance')}</label>
                        <input
                          type="number"
                          value={formData.monthlyAttendanceGoal}
                          onChange={(e) => setFormData({ ...formData, monthlyAttendanceGoal: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border-2 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">🚪 {t('offers.attendanceLimitDays')}</label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            value={formData.attendanceLimit}
                            onChange={(e) => setFormData({ ...formData, attendanceLimit: parseInt(e.target.value) || 0 })}
                            className="flex-1 px-3 py-2 border-2 rounded-lg"
                            disabled={formData.attendanceLimit === 0}
                            placeholder={`0 = ${t('offers.attendanceLimitUnlimited')}`}
                          />
                          <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={formData.attendanceLimit === 0}
                              onChange={(e) => setFormData({ ...formData, attendanceLimit: e.target.checked ? 0 : 12 })}
                              className="w-4 h-4"
                            />
                            ∞ {t('offers.attendanceLimitUnlimited')}
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">{t('offers.freezingDays')}</label>
                        <input
                          type="number"
                          value={formData.freezingDays}
                          onChange={(e) => setFormData({ ...formData, freezingDays: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border-2 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">{t('offers.upgradeWithin')}</label>
                        <input
                          type="number"
                          value={formData.upgradeAllowedDays}
                          onChange={(e) => setFormData({ ...formData, upgradeAllowedDays: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border-2 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* الأزرار */}
                  <div className="md:col-span-3 flex gap-3">
                    <button
                      onClick={handleSaveOffer}
                      disabled={loading}
                      className="flex-1 bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 font-bold"
                    >
                      {loading ? '⏳ جارٍ الحفظ...' : editingOffer ? `💾 ${t('offers.saveChanges')}` : `✅ ${t('offers.addOffer')}`}
                    </button>
                    <button
                      onClick={() => setShowOfferModal(false)}
                      className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-bold"
                    >
                      {t('offers.cancel')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal: تأكيد الحذف */}
          {showDeleteConfirm && offerToDelete && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(false)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">⚠️</div>
                  <h3 className="text-2xl font-bold text-red-900 mb-2">{t('offers.deleteConfirmTitle')}</h3>
                  <p className="text-gray-700">
                    {t('offers.deleteConfirmMessage', { name: offerToDelete.name })}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteOffer}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold transition"
                  >
                    {t('offers.confirmDelete')}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-bold transition"
                  >
                    {t('offers.cancelDelete')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
