'use client'

import { useState, useRef, useEffect } from 'react'
import PaymentMethodSelector from '../components/Paymentmethodselector'
import { calculateDaysBetween, formatDateYMD } from '../lib/dateFormatter'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'
import { calculateOnboardingBonus, getOnboardingCommissionType } from '../lib/commissions/onboarding'
import { getSubscriptionMonths } from '../lib/commissions/mrcb'

interface MemberFormProps {
  onSuccess: () => void
  customCreatedAt?: Date | null
}

export default function MemberForm({ onSuccess, customCreatedAt }: MemberFormProps) {
  const { user } = usePermissions()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [nextMemberNumber, setNextMemberNumber] = useState<number | null>(null)
  const [nextReceiptNumber, setNextReceiptNumber] = useState<number | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [offers, setOffers] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [referralReward, setReferralReward] = useState<any>(null)
  const [showReferralPopup, setShowReferralPopup] = useState(false)

  const [formData, setFormData] = useState({
    memberNumber: '',
    name: '',
    phone: '',
    nationalId: '',      // ⭐ الرقم القومي (اختياري)
    email: '',           // ⭐ البريد الإلكتروني (اختياري)
    profileImage: '',
    inBodyScans: 0,
    invitations: 0,
    freePTSessions: 0,
    subscriptionPrice: 0,
    subscriptionType: '1month',  // ⭐ نوع الباقة
    notes: '',
    startDate: formatDateYMD(new Date()),
    expiryDate: '',
    paymentMethod: 'cash' as 'cash' | 'visa' | 'instapay' | 'wallet',
    staffName: user?.name || '',
    isOther: false,
    skipReceipt: false,  // ✅ خيار عدم إنشاء إيصال
    birthdate: '',       // ⭐ تاريخ الميلاد
    offerId: '',         // ⭐ معرف الباقة
    offerName: '',       // ⭐ اسم الباقة
    // Package Benefits
    movementAssessments: 0,
    nutritionSessions: 0,
    monthlyAttendanceGoal: 0,
    onboardingSessions: 0,
    followUpSessions: 0,
    groupClasses: 0,
    poolSessions: 0,
    paddleSessions: 0,
    medicalScreeningSessions: 0,
    freezingDays: 0,
    upgradeAllowedDays: 0,
    // Referral and Coach Assignment
    referredById: '',       // ⭐ معرف العضو المُحيل
    assignedCoachId: ''     // ⭐ معرف المدرب المعين
  })

  // ⭐ حالات جديدة للإحالة والمدرب
  const [memberSearchTerm, setMemberSearchTerm] = useState('')
  const [memberSearchResults, setMemberSearchResults] = useState<any[]>([])
  const [coaches, setCoaches] = useState<any[]>([])

  useEffect(() => {
    const fetchNextNumber = async () => {
      try {
        const response = await fetch('/api/members/next-number')
        const data = await response.json()

        console.log('📊 استجابة API:', data)

        if (data.nextNumber !== undefined && data.nextNumber !== null) {
          setNextMemberNumber(data.nextNumber)
          setFormData(prev => ({ ...prev, memberNumber: data.nextNumber.toString() }))
        } else {
          console.warn('⚠️ لم يتم إرجاع nextNumber، استخدام 1001')
          setNextMemberNumber(1001)
          setFormData(prev => ({ ...prev, memberNumber: '1001' }))
        }
      } catch (error) {
        console.error('❌ خطأ في جلب رقم العضوية:', error)
        setNextMemberNumber(1001)
        setFormData(prev => ({ ...prev, memberNumber: '1001' }))
        setMessage(`⚠️ ${t('members.form.errorFetchingNumber')}`)
        setTimeout(() => setMessage(''), 3000)
      }
    }

    const fetchNextReceiptNumber = async () => {
      try {
        const response = await fetch('/api/receipts/next-number')
        const data = await response.json()
        if (data.nextNumber !== undefined && data.nextNumber !== null) {
          setNextReceiptNumber(data.nextNumber)
        }
      } catch (error) {
        console.error('❌ خطأ في جلب رقم الإيصال:', error)
      }
    }

    const fetchOffers = async () => {
      try {
        const response = await fetch('/api/offers?activeOnly=true')
        const data = await response.json()
        // التأكد من أن البيانات array
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

    const fetchCoaches = async () => {
      try {
        const response = await fetch('/api/coaches')
        const data = await response.json()
        if (Array.isArray(data)) {
          setCoaches(data)
        } else {
          setCoaches([])
        }
      } catch (error) {
        console.error('❌ خطأ في جلب المدربين:', error)
        setCoaches([])
      }
    }

    fetchNextNumber()
    fetchNextReceiptNumber()
    fetchOffers()
    fetchCoaches()
  }, [])

  useEffect(() => {
    if (user && !formData.staffName) {
      setFormData(prev => ({ ...prev, staffName: user.name }))
    }
  }, [user])

  const handleOtherChange = (checked: boolean) => {
    console.log('🔄 تغيير Other:', checked)
    setFormData(prev => ({
      ...prev,
      isOther: checked,
      memberNumber: checked ? '' : (nextMemberNumber?.toString() || '')
    }))
  }

  // ⭐ دالة البحث عن الأعضاء للإحالة
  const searchMembers = async (term: string) => {
    if (term.length < 2) {
      setMemberSearchResults([])
      return
    }

    try {
      const response = await fetch('/api/members')
      const members = await response.json()

      const results = members.filter((m: any) =>
        m.isActive && (
          m.name.toLowerCase().includes(term.toLowerCase()) ||
          m.phone.includes(term) ||
          m.memberNumber?.toString().includes(term)
        )
      ).slice(0, 10) // حد أقصى 10 نتائج

      setMemberSearchResults(results)
    } catch (error) {
      console.error('❌ خطأ في البحث عن الأعضاء:', error)
    }
  }

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          // تصغير الصورة إذا كانت كبيرة جداً
          const maxDimension = 1200
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension
              width = maxDimension
            } else {
              width = (width / height) * maxDimension
              height = maxDimension
            }
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          // ضغط الصورة بجودة 0.7
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const reader = new FileReader()
                reader.readAsDataURL(blob)
                reader.onloadend = () => {
                  resolve(reader.result as string)
                }
              } else {
                reject(new Error('فشل ضغط الصورة'))
              }
            },
            'image/jpeg',
            0.7
          )
        }
        img.onerror = () => reject(new Error('فشل تحميل الصورة'))
      }
      reader.onerror = () => reject(new Error('فشل قراءة الملف'))
    })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMessage(`❌ ${t('members.form.selectImageOnly')}`)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage(`❌ ${t('members.form.imageSizeTooLarge')}`)
      return
    }

    try {
      setMessage(`🔄 ${t('members.form.compressingImage')}`)
      const compressedBase64 = await compressImage(file)
      setImagePreview(compressedBase64)
      setFormData(prev => ({ ...prev, profileImage: compressedBase64 }))
      setMessage('')
    } catch (error) {
      console.error('خطأ في ضغط الصورة:', error)
      setMessage(`❌ ${t('members.form.imageCompressionFailed')}`)
    }
  }

  const removeImage = () => {
    setImagePreview('')
    setFormData(prev => ({ ...prev, profileImage: '' }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const calculateExpiryFromMonths = (months: number) => {
    if (!formData.startDate) return
    
    const start = new Date(formData.startDate)
    const expiry = new Date(start)
    expiry.setMonth(expiry.getMonth() + months)
    
    setFormData(prev => ({ 
      ...prev, 
      expiryDate: formatDateYMD(expiry)
    }))
  }

  const calculateDuration = () => {
    if (!formData.startDate || !formData.expiryDate) return null
    return calculateDaysBetween(formData.startDate, formData.expiryDate)
  }

  // حساب onboarding bonus بناءً على نوع الاشتراك
  const getCoachOnboardingBonus = () => {
    const subscriptionMonths = getSubscriptionMonths(formData.subscriptionType)
    return calculateOnboardingBonus(subscriptionMonths)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (formData.startDate && formData.expiryDate) {
      const start = new Date(formData.startDate)
      const end = new Date(formData.expiryDate)

      if (end <= start) {
        setMessage(`❌ ${t('members.form.expiryMustBeAfterStart')}`)
        setLoading(false)
        return
      }
    }

    const cleanedData = {
      ...formData,
      isOther: formData.isOther,
      memberNumber: formData.isOther
        ? null
        : (formData.memberNumber ? parseInt(formData.memberNumber) : nextMemberNumber),
      inBodyScans: parseInt(formData.inBodyScans.toString()),
      invitations: parseInt(formData.invitations.toString()),
      freePTSessions: parseInt(formData.freePTSessions.toString()),
      subscriptionPrice: parseInt(formData.subscriptionPrice.toString()),
      movementAssessments: parseInt(formData.movementAssessments.toString()),
      nutritionSessions: parseInt(formData.nutritionSessions.toString()),
      monthlyAttendanceGoal: parseInt(formData.monthlyAttendanceGoal.toString()),
      onboardingSessions: parseInt(formData.onboardingSessions.toString()),
      followUpSessions: parseInt(formData.followUpSessions.toString()),
      groupClasses: parseInt(formData.groupClasses.toString()),
      poolSessions: parseInt(formData.poolSessions.toString()),
      paddleSessions: parseInt(formData.paddleSessions.toString()),
      medicalScreeningSessions: parseInt(formData.medicalScreeningSessions.toString()),
      freezingDays: parseInt(formData.freezingDays.toString()),
      upgradeAllowedDays: parseInt(formData.upgradeAllowedDays.toString()),
      staffName: user?.name || '',
      customCreatedAt: customCreatedAt ? customCreatedAt.toISOString() : null,
      referredById: formData.referredById || null,      // ⭐ العضو المُحيل
      assignedCoachId: formData.assignedCoachId || null // ⭐ المدرب المعين
    }

    console.log('📤 إرسال البيانات:', {
      isOther: cleanedData.isOther,
      memberNumber: cleanedData.memberNumber
    })

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedData),
      })

      const data = await response.json()

      if (response.ok) {
        if (formData.skipReceipt) {
          setMessage(`✅ ${t('members.form.memberAddedWithoutReceipt')}`)
        } else {
          // رسالة إضافة العضو بنجاح
          let successMsg = `✅ ${t('members.form.memberAddedSuccessfully')}`

          // إضافة رسالة إنشاء الإيصال إذا وُجد
          if (data.receipt) {
            successMsg += `\n🧾 ${t('members.form.receiptCreated', { receiptNumber: data.receipt.receiptNumber })}`
          }

          setMessage(successMsg)
        }

        // عرض popup للإحالة إذا وُجدت
        if (data.referralReward && (data.referralReward.points > 0 || data.referralReward.cashReward > 0)) {
          setReferralReward(data.referralReward)
          setShowReferralPopup(true)
        }

        // تحديث رقم الإيصال التالي
        const receiptResponse = await fetch('/api/receipts/next-number')
        const receiptData = await receiptResponse.json()
        if (receiptData.nextNumber) {
          setNextReceiptNumber(receiptData.nextNumber)
        }

        setTimeout(() => {
          if (!data.referralReward || (data.referralReward.points === 0 && data.referralReward.cashReward === 0)) {
            onSuccess()
          }
        }, 2000)
      } else {
        setMessage(`❌ ${data.error || t('common.error')}`)
      }
    } catch (error) {
      setMessage(`❌ ${t('members.form.errorConnection')}`)
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const duration = calculateDuration()

  // دالة تطبيق العرض
  const applyOffer = (offer: any) => {
    const startDate = formData.startDate || formatDateYMD(new Date())
    const expiryDate = new Date(startDate)
    expiryDate.setDate(expiryDate.getDate() + offer.duration)

    // ⭐ تحديد نوع الاشتراك بناءً على مدة الباقة
    let subscriptionType = '1month'
    if (offer.duration >= 360) {
      subscriptionType = '1year'
    } else if (offer.duration >= 180) {
      subscriptionType = '6months'
    } else if (offer.duration >= 90) {
      subscriptionType = '3months'
    } else {
      subscriptionType = '1month'
    }

    setFormData(prev => ({
      ...prev,
      subscriptionPrice: offer.price,
      subscriptionType: subscriptionType,  // ⭐ تحديد نوع الاشتراك تلقائياً
      freePTSessions: offer.freePTSessions,
      inBodyScans: offer.inBodyScans,
      invitations: offer.invitations,
      movementAssessments: offer.movementAssessments || 0,
      nutritionSessions: offer.nutritionSessions || 0,
      monthlyAttendanceGoal: offer.monthlyAttendanceGoal || 0,
      onboardingSessions: offer.onboardingSessions || 0,
      followUpSessions: offer.followUpSessions || 0,
      groupClasses: offer.groupClasses || 0,
      poolSessions: offer.poolSessions || 0,
      paddleSessions: offer.paddleSessions || 0,
      medicalScreeningSessions: offer.medicalScreeningSessions || 0,
      freezingDays: offer.freezingDays || 0,
      upgradeAllowedDays: offer.upgradeAllowedDays || 0,
      startDate,
      expiryDate: formatDateYMD(expiryDate),
      offerId: offer.id,        // ⭐ حفظ معرف الباقة
      offerName: offer.name     // ⭐ حفظ اسم الباقة
    }))

    setMessage(`✅ ${t('members.form.offerApplied', { offerName: offer.name })}`)
    setTimeout(() => setMessage(''), 2000)
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-3">
      {message && (
        <div className={`p-3 rounded-lg text-center font-medium text-sm ${
          message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* قسم العروض */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-4">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-purple-800">
          <span>🎁</span>
          <span>{t('members.form.availableOffers')}</span>
        </h3>
        <p className="text-xs text-gray-600 mb-3">{t('members.form.selectOfferToAutoFill')}</p>

        {!Array.isArray(offers) || offers.length === 0 ? (
          <div className="text-center py-4 bg-white rounded-xl border-2 border-dashed border-gray-300">
            <p className="text-gray-500 text-xs">{t('members.form.noOffersAvailable')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('members.form.adminCanAddOffers')}</p>
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
                <div className="text-2xl font-bold text-green-600 mb-3 text-center">{offer.price.toLocaleString()} {t('offers.priceEGP')}</div>
                <div className="text-xs text-gray-700 space-y-1.5 bg-gray-50 p-2 rounded-lg max-h-60 overflow-y-auto">
                  <div className="font-semibold text-gray-800 border-b pb-1">⏱️ {t('members.form.durationLabel')}: {offer.duration} {t('members.form.daysSingle')}</div>

                  <div className="font-medium text-gray-700 mt-2">💪 {t('members.form.trainingLabel')}:</div>
                  <div className="pr-2">• {t('members.form.onboarding')}: {offer.onboardingSessions || 0}</div>
                  <div className="pr-2">• {t('members.form.followUp')}: {offer.followUpSessions || 0}</div>
                  <div className="pr-2">• PT: {offer.freePTSessions} {t('members.form.session')}</div>

                  <div className="font-medium text-gray-700 mt-2">🎁 {t('members.form.servicesLabel')}:</div>
                  <div className="pr-2">⚖️ InBody: {offer.inBodyScans}</div>
                  <div className="pr-2">🏃 Movement: {offer.movementAssessments || 0}</div>
                  <div className="pr-2">🥗 {t('offers.nutrition')}: {offer.nutritionSessions || 0}</div>
                  <div className="pr-2">🎟️ {t('offers.invitationsLabel')}: {offer.invitations || 0}</div>

                  <div className="font-medium text-gray-700 mt-2">🏋️ {t('members.form.classesLabel')}:</div>
                  <div className="pr-2">🥊 {t('members.form.groupClasses')}: {offer.groupClasses || 0}</div>
                  <div className="pr-2">🏊 {t('members.form.pool')}: {offer.poolSessions === 999 ? t('members.form.unlimited') : (offer.poolSessions || 0)}</div>
                  <div className="pr-2">🎾 {t('members.form.paddle')}: {offer.paddleSessions || 0}</div>
                  {(offer.medicalScreeningSessions || 0) > 0 && (
                    <div className="pr-2">🩺 كشف طبي: {offer.medicalScreeningSessions}</div>
                  )}

                  <div className="font-medium text-gray-700 mt-2">📊 {t('members.form.goalsLabel')}:</div>
                  <div className="pr-2">🎯 {t('members.form.attendance')}: {offer.monthlyAttendanceGoal || 0}{t('members.form.perMonth')}</div>
                  <div className="pr-2">❄️ {t('members.form.freezing')}: {offer.freezingDays || 0} {t('members.form.daysSingle')}</div>
                  {offer.upgradeAllowedDays > 0 && (
                    <div className="pr-2">⬆️ {t('members.form.upgradeWithinDays')}: {offer.upgradeAllowedDays} {t('members.form.daysSingle')}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 bg-blue-100 border-r-4 border-blue-500 p-2 rounded">
          <p className="text-xs text-blue-800">
            <strong>💡 {t('members.notes')}:</strong> {t('members.form.noteCanEditAfterOffer')}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-3">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <span>👤</span>
          <span>{t('members.form.basicInformation')}</span>
        </h3>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium">
              {t('members.membershipNumber')} {!formData.isOther && '*'}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isOther}
                onChange={(e) => handleOtherChange(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-xs font-medium text-gray-700">{t('members.form.otherNoNumber')}</span>
            </label>
          </div>

          {formData.isOther ? (
            <div className="w-full px-3 py-2 border-2 border-dashed rounded-lg bg-gray-100 text-gray-500 text-center">
              {t('members.form.noMembershipNumber')}
            </div>
          ) : (
            <input
              type="number"
              required={!formData.isOther}
              value={formData.memberNumber}
              onChange={(e) => setFormData({ ...formData, memberNumber: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-lg"
              placeholder="مثال: 1001"
              disabled={formData.isOther}
            />
          )}

          {!formData.isOther && nextMemberNumber && (
            <p className="text-xs text-gray-500 mt-1">
              💡 {t('members.form.suggestedNextNumber', { number: nextMemberNumber.toString() })}
            </p>
          )}
        </div>

        {nextReceiptNumber && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧾</span>
              <div>
                <p className="text-xs font-medium text-green-800">{t('members.form.nextReceiptNumber')}</p>
                <p className="text-xl font-bold text-green-600">#{nextReceiptNumber}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">{t('members.form.nameRequired')}</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm"
              placeholder="أحمد محمد"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">{t('members.form.phoneRequired')}</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm"
              placeholder="01234567890"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">{t('members.form.nationalIdOptional')}</label>
            <input
              type="text"
              value={formData.nationalId}
              onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm"
              placeholder={t('members.form.nationalIdPlaceholder')}
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">{t('members.form.emailOptional')}</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm"
              placeholder={t('members.form.emailPlaceholder')}
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">{t('members.form.staffNameRequired')}</label>
            <input
              type="text"
              required
              value={formData.staffName}
              readOnly
              className="w-full px-3 py-2 border-2 rounded-lg bg-gray-100 cursor-not-allowed text-sm"
              placeholder="محمد علي"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-medium mb-1 text-gray-700">
            🎂 {t('members.form.birthdateOptional')}
          </label>
          <input
            type="date"
            value={formData.birthdate}
            onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            💡 {t('members.form.birthdayRewardNote')}
          </p>
        </div>

        {/* ⭐ قسم الإحالة */}
        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-3 mt-3">
          <h3 className="font-bold text-base mb-3 flex items-center gap-2">
            <span>🤝</span>
            <span>{t('members.form.referralSection')}</span>
          </h3>

          <div>
            <label className="block text-xs font-medium mb-1 text-gray-700">
              {t('members.form.whoReferredThisMember')}
            </label>

            <input
              type="text"
              value={memberSearchTerm}
              onChange={(e) => {
                setMemberSearchTerm(e.target.value)
                searchMembers(e.target.value)
              }}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
              placeholder={t('members.form.searchByNameNumberPhone')}
            />

            {/* نتائج البحث */}
            {memberSearchResults.length > 0 && (
              <div className="mt-1 max-h-60 overflow-y-auto bg-white border-2 border-orange-300 rounded-lg shadow-lg">
                {memberSearchResults.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, referredById: member.id })
                      setMemberSearchTerm(`${member.name} (#${member.memberNumber})`)
                      setMemberSearchResults([])
                    }}
                    className="w-full text-right px-3 py-2 hover:bg-orange-50 border-b last:border-b-0 text-sm"
                  >
                    <div className="font-semibold">{member.name}</div>
                    <div className="text-xs text-gray-600">
                      {t('members.form.membershipNumber')}: {member.memberNumber} | {member.phone}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {formData.referredById && (
              <div className="mt-2 bg-green-50 border-2 border-green-200 rounded-lg p-2 flex items-center justify-between">
                <span className="text-sm text-green-800">
                  ✅ {t('members.form.referrerWillReceivePoints')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, referredById: '' })
                    setMemberSearchTerm('')
                  }}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  {t('members.form.cancelReferral')}
                </button>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-2">
              💡 {t('members.form.referralRewards')}
              <br/>• {t('members.form.firstReferralReward')}
              <br/>• {t('members.form.fifthReferralReward')}
            </p>
          </div>
        </div>

        {/* ⭐ قسم تعيين المدرب */}
        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3 mt-3">
          <h3 className="font-bold text-base mb-3 flex items-center gap-2">
            <span>🏋️</span>
            <span>{t('members.form.coachSection')}</span>
          </h3>

          <div>
            <label className="block text-xs font-medium mb-1 text-gray-700">
              {t('members.form.assignedCoach')}
            </label>

            {coaches.length === 0 ? (
              <div className="text-sm text-gray-500 bg-gray-100 rounded-lg p-3">
                {t('members.form.noActiveCoaches')}
              </div>
            ) : (
              <select
                value={formData.assignedCoachId}
                onChange={(e) => setFormData({ ...formData, assignedCoachId: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
              >
                <option value="">{t('members.form.selectCoach')}</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.name} {coach.phone && `(${coach.phone})`}
                  </option>
                ))}
              </select>
            )}

            {formData.assignedCoachId && getCoachOnboardingBonus() > 0 && (
              <div className="mt-2 bg-green-50 border-2 border-green-200 rounded-lg p-2">
                <span className="text-sm text-green-800">
                  ✅ {t('members.form.coachWillReceiveCommission', { amount: getCoachOnboardingBonus().toString() })}
                </span>
              </div>
            )}

            {getCoachOnboardingBonus() > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                💡 {t('members.form.coachCommissionNote', { amount: getCoachOnboardingBonus().toString() })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <span>📷</span>
          <span>{t('members.form.profilePicture')}</span>
        </h3>

        <div className="flex flex-col items-center gap-4">
          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-32 h-32 rounded-full object-cover border-4 border-purple-400"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="w-32 h-32 rounded-full border-4 border-dashed border-purple-300 flex items-center justify-center bg-purple-100">
              <span className="text-4xl text-purple-400">👤</span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            id="profileImage"
          />
          
          <label
            htmlFor="profileImage"
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer transition"
          >
            {imagePreview ? `📷 ${t('members.form.changeImage')}` : `📷 ${t('members.form.uploadImage')}`}
          </label>

          <p className="text-xs text-gray-500 text-center">
            {t('members.form.imageSizeRecommendation')}<br/>
            {t('members.form.maxImageSize')}
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <span>📅</span>
          <span>{t('members.form.subscriptionPeriod')}</span>
        </h3>

        <div className="grid grid-cols-1 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              {t('members.startDate')} <span className="text-xs text-gray-500">(yyyy-mm-dd)</span>
            </label>
            <input
              type="text"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-lg font-mono text-sm"
              placeholder="2025-11-18"
              pattern="\d{4}-\d{2}-\d{2}"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              {t('members.expiryDate')} <span className="text-xs text-gray-500">(yyyy-mm-dd)</span>
            </label>
            <input
              type="text"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-lg font-mono text-sm"
              placeholder="2025-12-18"
              pattern="\d{4}-\d{2}-\d{2}"
            />
          </div>
        </div>

        <div className="mb-2">
          <p className="text-xs font-medium mb-2">⚡ {t('members.form.quickAdd')}:</p>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 6, 9, 12].map(months => (
              <button
                key={months}
                type="button"
                onClick={() => calculateExpiryFromMonths(months)}
                className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-xs transition"
              >
                + {months} {months === 1 ? t('members.form.month') : t('members.form.months')}
              </button>
            ))}
          </div>
        </div>

        {duration !== null && (
          <div className="bg-white border-2 border-blue-300 rounded-lg p-2">
            <p className="text-xs">
              <span className="font-medium">📊 {t('members.form.subscriptionDuration')}: </span>
              <span className="font-bold text-blue-600">
                {duration} {t('members.form.daysSingle')}
                {duration >= 30 && ` (${Math.floor(duration / 30)} ${Math.floor(duration / 30) === 1 ? t('members.form.month') : t('members.form.months')})`}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <span>💰</span>
          <span>{t('members.form.financialInformation')}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
          <div>
            <label className="block text-xs font-medium mb-1">{t('members.form.subscriptionPriceRequired')}</label>
            <input
              type="number"
              required
              min="0"
              value={formData.subscriptionPrice}
              onChange={(e) => setFormData({ ...formData, subscriptionPrice: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              {t('members.form.subscriptionType')} <span className="text-red-600">*</span>
            </label>
            <select
              required
              value={formData.subscriptionType}
              onChange={(e) => setFormData({ ...formData, subscriptionType: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-lg text-sm"
            >
              <option value="1month">{t('members.form.oneMonthOption')}</option>
              <option value="3months">{t('members.form.threeMonthsOption')}</option>
              <option value="6months">{t('members.form.sixMonthsOption')}</option>
              <option value="1year">{t('members.form.oneYearOption')}</option>
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-medium mb-2">{t('members.paymentMethod')}</label>
          <PaymentMethodSelector
            value={formData.paymentMethod}
            onChange={(method) => setFormData({
              ...formData,
              paymentMethod: method as 'cash' | 'visa' | 'instapay' | 'wallet'
            })}
          />
        </div>

        {/* ✅ خيار عدم إنشاء إيصال */}
        <div className="mt-3">
          <label className="flex items-center gap-2 cursor-pointer bg-yellow-50 border-2 border-yellow-300 rounded-lg p-2">
            <input
              type="checkbox"
              checked={formData.skipReceipt}
              onChange={(e) => setFormData({ ...formData, skipReceipt: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-xs font-bold text-yellow-800">
              🚫 {t('members.form.skipReceiptAdminOnly')}
            </span>
          </label>
        </div>
      </div>

      <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-3">
        <label className="block text-xs font-medium mb-2">📝 {t('members.notes')}</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border-2 rounded-lg text-sm"
          rows={2}
          placeholder={`${t('members.notes')}...`}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-bold transition"
        >
          {loading ? `⏳ ${t('members.form.saving')}` : `✅ ${t('members.form.saveMember')}`}
        </button>
      </div>
    </form>

    {/* Referral Reward Popup */}
    {showReferralPopup && referralReward && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl shadow-2xl max-w-md w-full p-6 border-4 border-green-400 animate-bounce-in">
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-green-800 mb-3">
              {t('members.form.referralRewardTitle')}
            </h3>

            <div className="bg-white rounded-xl p-4 mb-4 border-2 border-green-300">
              <p className="text-lg font-semibold text-gray-800 mb-2">
                👤 {referralReward.referrerName}
              </p>
              <p className="text-sm text-gray-600 mb-3">
                {t('members.form.referralNumber')}: #{referralReward.referralNumber}
              </p>

              {referralReward.points > 0 && (
                <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg p-3 mb-2 border-2 border-orange-300">
                  <div className="text-3xl font-bold text-orange-600">
                    🎁 {referralReward.points.toLocaleString()}
                  </div>
                  <div className="text-sm font-semibold text-orange-800">
                    {t('members.form.loyaltyPoints')}
                  </div>
                </div>
              )}

              {referralReward.cashReward > 0 && (
                <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg p-3 border-2 border-green-400">
                  <div className="text-3xl font-bold text-green-600">
                    💵 {referralReward.cashReward.toLocaleString()} {t('common.currency')}
                  </div>
                  <div className="text-sm font-semibold text-green-800">
                    {t('members.form.cashReward')}
                  </div>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-600 mb-4">
              {t('members.form.referralThankYou')}
            </p>

            <button
              onClick={() => {
                setShowReferralPopup(false)
                setReferralReward(null)
                onSuccess()
              }}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition w-full"
            >
              {t('common.close')} ✅
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
