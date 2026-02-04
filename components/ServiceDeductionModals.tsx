'use client'

import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

interface InvitationModalProps {
  isOpen: boolean
  memberName: string
  memberId: string
  onClose: () => void
  onSuccess: () => void
}

export function InvitationModal({ isOpen, memberName, memberId, onClose, onSuccess }: InvitationModalProps) {
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!guestName.trim() || !guestPhone.trim()) {
      setMessage({ type: 'error', text: '⚠️ يرجى إدخال اسم ورقم هاتف الضيف' })
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          notes: notes.trim()
        })
      })

      if (response.ok) {
        setMessage({ type: 'success', text: '✅ تم تسجيل الدعوة بنجاح!' })
        setTimeout(() => {
          onSuccess()
          handleClose()
        }, 1500)
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: `❌ ${error.error || 'فشل تسجيل الدعوة'}` })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '❌ حدث خطأ أثناء التسجيل' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setGuestName('')
    setGuestPhone('')
    setNotes('')
    setMessage(null)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && !submitting && handleClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <span>🎟️</span>
              <span>استخدام دعوة</span>
            </h3>
            <p className="text-sm text-gray-600 mt-1">للعضو: {memberName}</p>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            <p className="font-bold">{message.text}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2">
              اسم الضيف <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              placeholder="أدخل اسم الضيف..."
              autoFocus
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">
              رقم هاتف الضيف <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              placeholder="01xxxxxxxxx"
              dir="ltr"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">
              ملاحظات (اختياري)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 resize-none"
              rows={3}
              placeholder="ملاحظات إضافية..."
              disabled={submitting}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !guestName.trim() || !guestPhone.trim()}
              className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold transition"
            >
              {submitting ? '⏳ جاري التسجيل...' : '✅ تسجيل الدعوة'}
            </button>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-bold disabled:opacity-50"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SimpleServiceModalProps {
  isOpen: boolean
  serviceType: 'freePT' | 'inBody' | 'movementAssessment' | 'nutrition' | 'physiotherapy' | 'onboarding' | 'followUp' | 'groupClass' | 'pool' | 'paddle'
  memberName: string
  memberId: string
  onClose: () => void
  onSuccess: () => void
}

export function SimpleServiceModal({ isOpen, serviceType, memberName, memberId, onClose, onSuccess }: SimpleServiceModalProps) {
  const { locale } = useLanguage()
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  if (!isOpen) return null

  const serviceNames = {
    ar: {
      freePT: 'جلسة PT مجانية',
      inBody: 'InBody',
      movementAssessment: 'تقييم حركة',
      nutrition: 'جلسة تغذية',
      physiotherapy: 'جلسة علاج طبيعي',
      onboarding: 'جلسة تأهيل',
      followUp: 'جلسة متابعة',
      groupClass: 'حصة جماعية',
      pool: 'جلسة مسبح',
      paddle: 'جلسة بادل'
    },
    en: {
      freePT: 'Free PT Session',
      inBody: 'InBody',
      movementAssessment: 'Movement Assessment',
      nutrition: 'Nutrition Session',
      physiotherapy: 'Physiotherapy Session',
      onboarding: 'Onboarding Session',
      followUp: 'Follow-up Session',
      groupClass: 'Group Class',
      pool: 'Pool Session',
      paddle: 'Paddle Session'
    }
  }

  const getServiceName = () => serviceNames[locale as 'ar' | 'en'][serviceType]

  const serviceIcons = {
    freePT: '💪',
    inBody: '⚖️',
    movementAssessment: '🏃',
    nutrition: '🥗',
    physiotherapy: '🏥',
    onboarding: '🎯',
    followUp: '📋',
    groupClass: '👥',
    pool: '🏊',
    paddle: '🏓'
  }

  const serviceColors = {
    freePT: { bg: 'green', hover: 'green' },
    inBody: { bg: 'blue', hover: 'blue' },
    movementAssessment: { bg: 'blue', hover: 'blue' },
    nutrition: { bg: 'green', hover: 'green' },
    physiotherapy: { bg: 'red', hover: 'red' },
    onboarding: { bg: 'indigo', hover: 'indigo' },
    followUp: { bg: 'yellow', hover: 'yellow' },
    groupClass: { bg: 'pink', hover: 'pink' },
    pool: { bg: 'cyan', hover: 'cyan' },
    paddle: { bg: 'teal', hover: 'teal' }
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/members/deduct-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          serviceType
        })
      })

      if (response.ok) {
        const successMsg = locale === 'ar'
          ? `✅ تم خصم ${getServiceName()} بنجاح!`
          : `✅ ${getServiceName()} deducted successfully!`
        setMessage({ type: 'success', text: successMsg })
        setTimeout(() => {
          onSuccess()
          handleClose()
        }, 1500)
      } else {
        const error = await response.json()
        const errorMsg = error.error || (locale === 'ar' ? 'فشل الخصم' : 'Deduction failed')
        setMessage({ type: 'error', text: `❌ ${errorMsg}` })
      }
    } catch (error) {
      const errorMsg = locale === 'ar' ? 'حدث خطأ أثناء الخصم' : 'Error occurred during deduction'
      setMessage({ type: 'error', text: `❌ ${errorMsg}` })
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setMessage(null)
    onClose()
  }

  const color = serviceColors[serviceType]

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && !submitting && handleClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">{serviceIcons[serviceType]}</div>
          <h3 className="text-2xl font-bold mb-2">
            {locale === 'ar' ? `تأكيد خصم ${getServiceName()}` : `Confirm Deduction of ${getServiceName()}`}
          </h3>
          <p className="text-gray-600">{locale === 'ar' ? `للعضو: ${memberName}` : `For member: ${memberName}`}</p>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            <p className="font-bold text-center">{message.text}</p>
          </div>
        )}

        {!message && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 text-center">
              {locale === 'ar'
                ? `⚠️ هل أنت متأكد من خصم ${getServiceName()} واحدة؟`
                : `⚠️ Are you sure you want to deduct one ${getServiceName()}?`
              }
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={submitting || message?.type === 'success'}
            className={`flex-1 bg-${color.bg}-600 text-white py-3 rounded-lg hover:bg-${color.hover}-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold transition`}
          >
            {submitting
              ? (locale === 'ar' ? '⏳ جاري الخصم...' : '⏳ Deducting...')
              : message?.type === 'success'
                ? (locale === 'ar' ? '✅ تم الخصم' : '✅ Deducted')
                : (locale === 'ar' ? '✅ تأكيد الخصم' : '✅ Confirm Deduction')
            }
          </button>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-bold disabled:opacity-50"
          >
            {message?.type === 'success'
              ? (locale === 'ar' ? 'إغلاق' : 'Close')
              : (locale === 'ar' ? 'إلغاء' : 'Cancel')
            }
          </button>
        </div>
      </div>
    </div>
  )
}
