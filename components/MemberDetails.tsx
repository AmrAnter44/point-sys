'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ReceiptToPrint } from '../components/ReceiptToPrint'
import PaymentMethodSelector from './Paymentmethodselector'
import { formatDateYMD, calculateRemainingDays } from '../lib/dateFormatter'
import ImageUpload from '../components/ImageUpload'
import BarcodeWhatsApp from '../components/BarcodeWhatsApp'
import { useLanguage } from '../contexts/LanguageContext'

interface Member {
  id: string
  memberNumber: number
  name: string
  phone: string
  profileImage?: string | null
  inBodyScans: number
  invitations: number
  freePTSessions?: number
  subscriptionPrice: number
  remainingAmount: number
  notes?: string
  isActive: boolean
  isFrozen: boolean
  freezeStartDate?: string
  freezeEndDate?: string
  startDate?: string
  expiryDate?: string
  createdAt: string
}

export default function MemberDetailPage() {
  const params = useParams()
  const router = useRouter()
  const memberId = params.id as string
  const { t } = useLanguage()

  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)

  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'cash',
    notes: ''
  })

  const [freezeData, setFreezeData] = useState({
    days: 0,
    reason: ''
  })

  const [activeModal, setActiveModal] = useState<string | null>(null)

  const fetchMember = async () => {
    try {
      const response = await fetch('/api/members')
      const members = await response.json()
      const foundMember = members.find((m: Member) => m.id === memberId)

      if (foundMember) {
        console.log('🔍 بيانات العضو:', {
          isFrozen: foundMember.isFrozen,
          freezeStartDate: foundMember.freezeStartDate,
          freezeEndDate: foundMember.freezeEndDate
        })
        setMember(foundMember)
      } else {
        setMessage(`❌ ${t('memberDetails.memberNotFound')}`)
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage(`❌ ${t('memberDetails.errorLoadingData')}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMember()
  }, [memberId])

  const handlePayment = async () => {
    if (!member || paymentData.amount <= 0) {
      alert(t('memberDetails.paymentModal.enterValidAmount'))
      return
    }

    if (paymentData.amount > member.remainingAmount) {
      alert(t('memberDetails.paymentModal.amountExceedsRemaining'))
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const newRemaining = member.remainingAmount - paymentData.amount

      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          remainingAmount: newRemaining
        })
      })

      if (response.ok) {
        const receiptResponse = await fetch('/api/receipts/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: member.id,
            amount: paymentData.amount,
            paymentMethod: paymentData.paymentMethod,
            notes: paymentData.notes
          })
        })

        if (receiptResponse.ok) {
          const receipt = await receiptResponse.json()
          setReceiptData({
            receiptNumber: receipt.receiptNumber,
            type: 'Payment',
            amount: receipt.amount,
            details: JSON.parse(receipt.itemDetails),
            date: new Date(receipt.createdAt),
            paymentMethod: paymentData.paymentMethod
          })
          setShowReceipt(true)
        }

        setMessage(`✅ ${t('memberDetails.paymentModal.paymentSuccess')}`)
        setTimeout(() => setMessage(''), 3000)

        setPaymentData({ amount: 0, paymentMethod: 'cash', notes: '' })
        setActiveModal(null)
        fetchMember()
      } else {
        setMessage(`❌ ${t('memberDetails.paymentModal.paymentFailed')}`)
      }
    } catch (error) {
      console.error(error)
      setMessage(`❌ ${t('common.error')}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUseInBody = async () => {
    if (!member || member.inBodyScans <= 0) {
      alert(t('memberDetails.noInBodySessionsRemaining'))
      return
    }

    if (!confirm(t('memberDetails.confirmUseInBody'))) return

    setLoading(true)
    try {
      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          inBodyScans: member.inBodyScans - 1
        })
      })

      if (response.ok) {
        setMessage(`✅ ${t('memberDetails.inBodyUsed')}`)
        setTimeout(() => setMessage(''), 3000)
        fetchMember()
      }
    } catch (error) {
      setMessage(`❌ ${t('common.error')}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUseInvitation = async () => {
    if (!member || member.invitations <= 0) {
      alert(t('memberDetails.noInvitationsRemaining'))
      return
    }

    if (!confirm(t('memberDetails.confirmUseInvitation'))) return

    setLoading(true)
    try {
      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          invitations: member.invitations - 1
        })
      })

      if (response.ok) {
        setMessage(`✅ ${t('memberDetails.invitationUsed')}`)
        setTimeout(() => setMessage(''), 3000)
        fetchMember()
      }
    } catch (error) {
      setMessage(`❌ ${t('common.error')}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUseFreePT = async () => {
    if (!member || member.freePTSessions <= 0) {
      alert(t('memberDetails.noFreePTRemaining'))
      return
    }

    if (!confirm(t('memberDetails.confirmUseFreePT'))) return

    setLoading(true)
    try {
      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          freePTSessions: member.freePTSessions - 1
        })
      })

      if (response.ok) {
        setMessage(`✅ ${t('memberDetails.freePTUsed')}`)
        setTimeout(() => setMessage(''), 3000)
        fetchMember()
      }
    } catch (error) {
      setMessage(`❌ ${t('common.error')}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFreeze = async () => {
    if (!member || !member.expiryDate || freezeData.days <= 0) {
      alert(t('memberDetails.freezeModal.enterValidDays'))
      return
    }

    setLoading(true)
    try {
      const currentExpiry = new Date(member.expiryDate)
      const newExpiry = new Date(currentExpiry)
      newExpiry.setDate(newExpiry.getDate() + freezeData.days)

      // تعيين تواريخ التجميد
      const freezeStart = new Date() // التجميد يبدأ من الآن
      const freezeEnd = new Date()
      freezeEnd.setDate(freezeEnd.getDate() + freezeData.days)

      const freezePayload = {
        id: member.id,
        expiryDate: newExpiry.toISOString(),
        freezeStartDate: freezeStart.toISOString(),
        freezeEndDate: freezeEnd.toISOString(),
        isFrozen: true
      }

      console.log('📤 إرسال بيانات التجميد:', freezePayload)

      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(freezePayload)
      })

      if (response.ok) {
        const updatedMember = await response.json()
        console.log('✅ رد الـ API بعد التحديث:', {
          isFrozen: updatedMember.isFrozen,
          freezeStartDate: updatedMember.freezeStartDate,
          freezeEndDate: updatedMember.freezeEndDate
        })

        setMessage(`✅ ${t('memberDetails.freezeModal.freezeSuccess', { days: freezeData.days.toString() })}`)
        setTimeout(() => setMessage(''), 3000)

        setFreezeData({ days: 0, reason: '' })
        setActiveModal(null)
        fetchMember()
      } else {
        const error = await response.json()
        console.error('❌ خطأ من الـ API:', error)
        setMessage(`❌ ${error.error || t('common.error')}`)
      }
    } catch (error) {
      console.error('❌ خطأ في التجميد:', error)
      setMessage(`❌ ${t('common.error')}`)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !member) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="text-6xl mb-4">⏳</div>
        <p className="text-xl">{t('memberDetails.loading')}</p>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="text-6xl mb-4">❌</div>
        <p className="text-xl mb-4">{t('memberDetails.memberNotFound')}</p>
        <button
          onClick={() => router.push('/members')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          {t('memberDetails.backToMembers')}
        </button>
      </div>
    )
  }

  // دالة للتحقق من حالة التجميد وحساب الأيام المتبقية
  const getFreezeStatus = (member: Member) => {
    console.log('🧊 فحص حالة التجميد:', {
      freezeStartDate: member.freezeStartDate,
      freezeEndDate: member.freezeEndDate,
      isFrozen: member.isFrozen
    })

    if (!member.freezeStartDate || !member.freezeEndDate) {
      console.log('❌ لا توجد تواريخ تجميد')
      return null
    }

    const now = new Date()
    const freezeStart = new Date(member.freezeStartDate)
    const freezeEnd = new Date(member.freezeEndDate)

    console.log('📅 المقارنة:', {
      now: now.toISOString(),
      freezeStart: freezeStart.toISOString(),
      freezeEnd: freezeEnd.toISOString(),
      isInRange: now >= freezeStart && now <= freezeEnd
    })

    // التحقق إذا كان في فترة التجميد حالياً
    if (now >= freezeStart && now <= freezeEnd) {
      // حساب عدد الأيام المتبقية في التجميد
      const remainingDays = Math.ceil((freezeEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      console.log('✅ العضو مجمد! الأيام المتبقية:', remainingDays)
      return {
        isFrozen: true,
        remainingDays: remainingDays
      }
    }

    console.log('❌ العضو ليس في فترة تجميد')
    return null
  }

  const isExpired = member.expiryDate ? new Date(member.expiryDate) < new Date() : false
  const daysRemaining = calculateRemainingDays(member.expiryDate)
  const freezeStatus = getFreezeStatus(member)

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">👤 {t('memberDetails.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600">{t('memberDetails.subtitle')}</p>
        </div>
        <button
          onClick={() => router.push('/members')}
          className="bg-gray-200 text-gray-700 px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-300 text-sm sm:text-base w-full sm:w-auto"
        >
          ← {t('memberDetails.back')}
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}

      <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-6 pb-6 border-b border-white border-opacity-20">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-white bg-opacity-20 flex-shrink-0">
            {member.profileImage ? (
              <img
                src={member.profileImage}
                alt={member.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <svg className="w-12 h-12 sm:w-16 sm:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-right">
            <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">{t('memberDetails.membershipNumber')}</p>
            <p className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-4">#{member.memberNumber}</p>
            <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">{t('memberDetails.memberName')}</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold">{member.name}</p>
          </div>

          <div className="text-center sm:text-left">
            <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">{t('memberDetails.phoneNumber')}</p>
            <p className="text-lg sm:text-xl md:text-2xl font-mono">{member.phone}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          <div className="bg-white bg-opacity-20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm opacity-90">{t('memberDetails.status')}</p>
            <p className="text-base sm:text-lg font-bold">
              {freezeStatus && freezeStatus.isFrozen
                ? `🧊 ${t('members.frozen')}`
                : member.isActive && !isExpired
                  ? `✅ ${t('memberDetails.active')}`
                  : `❌ ${t('memberDetails.expired')}`}
            </p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm opacity-90">{t('memberDetails.expiryDate')}</p>
            <p className="text-sm sm:text-base md:text-lg font-mono">
              {formatDateYMD(member.expiryDate)}
            </p>
            {daysRemaining !== null && daysRemaining > 0 && (
              <p className="text-xs opacity-75 mt-1">{t('memberDetails.daysRemaining', { days: daysRemaining.toString() })}</p>
            )}
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm opacity-90">{t('memberDetails.subscriptionPrice')}</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{member.subscriptionPrice} {t('members.egp')}</p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm opacity-90">{t('memberDetails.remainingAmount')}</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-300">{member.remainingAmount} {t('members.egp')}</p>
          </div>
        </div>
      </div>

      {/* ✅ إضافة Barcode WhatsApp Component */}
      <div className="mb-6">
        <BarcodeWhatsApp
          memberNumber={member.memberNumber}
          memberName={member.name}
          memberPhone={member.phone}
        />
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="bg-purple-100 p-2 sm:p-3 rounded-full">
            <span className="text-2xl sm:text-3xl">📷</span>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold">{t('memberDetails.editImage')}</h3>
            <p className="text-xs sm:text-sm text-gray-600">{t('memberDetails.editMemberImage')}</p>
          </div>
        </div>
        <button
          onClick={() => setActiveModal('edit-image')}
          disabled={loading}
          className="w-full bg-purple-600 text-white py-2.5 sm:py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-sm sm:text-base"
        >
          📷 {t('memberDetails.editImage')}
        </button>
      </div>

      {activeModal === 'edit-image' && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null)
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">📷 {t('memberDetails.editMemberImage')}</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <ImageUpload
              currentImage={member.profileImage}
              onImageChange={async (url) => {
                try {
                  const response = await fetch('/api/members', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      id: member.id,
                      profileImage: url
                    })
                  })

                  if (response.ok) {
                    setMessage(`✅ ${t('memberDetails.imageUpdatedSuccessfully')}`)
                    setTimeout(() => setMessage(''), 3000)
                    setActiveModal(null)
                    fetchMember()
                  }
                } catch (error) {
                  setMessage(`❌ ${t('memberDetails.failedToUpdateImage')}`)
                }
              }}
              disabled={loading}
            />

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full mt-4 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-r-4 border-green-500">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <p className="text-gray-600 text-xs sm:text-sm">InBody</p>
              <p className="text-3xl sm:text-4xl font-bold text-green-600">{member.inBodyScans}</p>
            </div>
            <div className="text-4xl sm:text-5xl">⚖️</div>
          </div>
          <button
            onClick={handleUseInBody}
            disabled={member.inBodyScans <= 0 || loading}
            className="w-full bg-green-600 text-white py-2 sm:py-2.5 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            استخدام حصة
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-r-4 border-purple-500">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <p className="text-gray-600 text-xs sm:text-sm">الدعوات</p>
              <p className="text-3xl sm:text-4xl font-bold text-purple-600">{member.invitations}</p>
            </div>
            <div className="text-4xl sm:text-5xl">🎟️</div>
          </div>
          <button
            onClick={handleUseInvitation}
            disabled={member.invitations <= 0 || loading}
            className="w-full bg-purple-600 text-white py-2 sm:py-2.5 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            استخدام دعوة
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-r-4 border-orange-500">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <p className="text-gray-600 text-xs sm:text-sm">حصص PT مجانية</p>
              <p className="text-3xl sm:text-4xl font-bold text-orange-600">{member.freePTSessions}</p>
            </div>
            <div className="text-4xl sm:text-5xl">💪</div>
          </div>
          <button
            onClick={handleUseFreePT}
            disabled={member.freePTSessions <= 0 || loading}
            className="w-full bg-orange-600 text-white py-2 sm:py-2.5 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            استخدام حصة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="bg-green-100 p-2 sm:p-3 rounded-full">
              <span className="text-2xl sm:text-3xl">💰</span>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold">دفع المبلغ المتبقي</h3>
              <p className="text-xs sm:text-sm text-gray-600">المتبقي: {member.remainingAmount} EGP</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('payment')}
            disabled={member.remainingAmount <= 0 || loading}
            className="w-full bg-green-600 text-white py-2.5 sm:py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-sm sm:text-base"
          >
            دفع مبلغ
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="bg-blue-100 p-2 sm:p-3 rounded-full">
              <span className="text-2xl sm:text-3xl">❄️</span>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold">تجميد الاشتراك (Freeze)</h3>
              <p className="text-xs sm:text-sm text-gray-600">إضافة أيام للاشتراك</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('freeze')}
            disabled={!member.expiryDate || loading}
            className="w-full bg-blue-600 text-white py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-sm sm:text-base"
          >
            تجميد الاشتراك
          </button>
        </div>
      </div>

      {activeModal === 'payment' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">💰 دفع المبلغ المتبقي</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600 text-3xl"
              >
                ×
              </button>
            </div>

            <div className="bg-yellow-50 border-r-4 border-yellow-500 p-4 rounded-lg mb-6">
              <p className="font-bold text-yellow-800">
                المبلغ المتبقي: {member.remainingAmount} EGP
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  المبلغ المدفوع <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                  max={member.remainingAmount}
                  className="w-full px-4 py-3 border-2 rounded-lg text-xl"
                  placeholder="0"
                />
              </div>

              <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-5">
                <PaymentMethodSelector
                  value={paymentData.paymentMethod}
                  onChange={(method) => setPaymentData({ ...paymentData, paymentMethod: method })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">ملاحظات</label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  className="w-full px-4 py-3 border-2 rounded-lg"
                  rows={3}
                  placeholder="ملاحظات إضافية..."
                />
              </div>

              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                <div className="flex justify-between text-lg">
                  <span>المتبقي بعد الدفع:</span>
                  <span className="font-bold text-green-600">
                    {(member.remainingAmount - paymentData.amount).toFixed(0)} EGP
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePayment}
                  disabled={loading || paymentData.amount <= 0}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-bold"
                >
                  {loading ? 'جاري المعالجة...' : '✅ تأكيد الدفع'}
                </button>
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'freeze' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">❄️ تجميد الاشتراك</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600 text-3xl"
              >
                ×
              </button>
            </div>

            <div className="bg-blue-50 border-r-4 border-blue-500 p-4 rounded-lg mb-6">
              <p className="text-sm text-blue-800 mb-2">
                تاريخ الانتهاء الحالي: <strong>{formatDateYMD(member.expiryDate)}</strong>
              </p>
              {daysRemaining !== null && (
                <p className="text-sm text-blue-800">
                  الأيام المتبقية: <strong>{daysRemaining > 0 ? daysRemaining : 0} يوم</strong>
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  عدد الأيام المراد إضافتها <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={freezeData.days}
                  onChange={(e) => setFreezeData({ ...freezeData, days: parseInt(e.target.value) || 0 })}
                  min="1"
                  className="w-full px-4 py-3 border-2 rounded-lg text-xl"
                  placeholder="عدد الأيام"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">السبب</label>
                <textarea
                  value={freezeData.reason}
                  onChange={(e) => setFreezeData({ ...freezeData, reason: e.target.value })}
                  className="w-full px-4 py-3 border-2 rounded-lg"
                  rows={3}
                  placeholder="سبب التجميد..."
                />
              </div>

              {freezeData.days > 0 && member.expiryDate && (
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                  <p className="text-sm text-green-800 mb-2">
                    التاريخ الجديد للانتهاء:
                  </p>
                  <p className="text-xl font-bold text-green-600">
                    {formatDateYMD(new Date(new Date(member.expiryDate).getTime() + freezeData.days * 24 * 60 * 60 * 1000))}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleFreeze}
                  disabled={loading || freezeData.days <= 0}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-bold"
                >
                  {loading ? 'جاري المعالجة...' : '✅ تأكيد التجميد'}
                </button>
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReceipt && receiptData && (
        <ReceiptToPrint
          receiptNumber={receiptData.receiptNumber}
          type={receiptData.type}
          amount={receiptData.amount}
          details={receiptData.details}
          date={receiptData.date}
          paymentMethod={receiptData.paymentMethod}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  )
}