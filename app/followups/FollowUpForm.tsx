'use client'

import React, { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

interface FollowUpFormProps {
  visitors: any[]
  expiredMembers: any[]
  expiringMembers: any[]
  dayUseRecords: any[]
  invitations: any[]
  initialVisitorId?: string
  onSubmit: (formData: {
    visitorId: string
    salesName: string
    notes: string
    result: string
    nextFollowUpDate: string
    contacted: boolean
  }) => Promise<void>
  onClose: () => void
}

export default function FollowUpForm({
  visitors,
  expiredMembers,
  expiringMembers,
  dayUseRecords,
  invitations,
  initialVisitorId = '',
  onSubmit,
  onClose
}: FollowUpFormProps) {
  const { t, direction } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    visitorId: initialVisitorId,
    salesName: '',
    notes: '',
    result: '',
    nextFollowUpDate: '',
    contacted: false
  })

  // تحديث visitorId لما يتغير من الخارج
  useEffect(() => {
    if (initialVisitorId) {
      setFormData(prev => ({ ...prev, visitorId: initialVisitorId }))
    }
  }, [initialVisitorId])

  // البحث عن بيانات الزائر/العضو المختار
  const getSelectedVisitorInfo = () => {
    if (!formData.visitorId) return null

    // البحث في الزوار
    const visitor = visitors.find(v => v.id === formData.visitorId)
    if (visitor) return { name: visitor.name, phone: visitor.phone, type: t('followups.form.types.visitor') }

    // البحث في الأعضاء المنتهيين (ID = expired-xxx)
    const expMember = expiredMembers.find((m: any) => m.id === formData.visitorId)
    if (expMember) {
      // إزالة "(عضو منتهي)" من الاسم إذا كان موجود
      const cleanName = expMember.name.replace(' (عضو منتهي)', '').trim()
      return { name: cleanName, phone: expMember.phone, type: t('followups.form.types.expiredMember') }
    }

    // البحث في الأعضاء القريبين من الانتهاء (ID = expiring-xxx)
    const expiringMember = expiringMembers.find((m: any) => m.id === formData.visitorId)
    if (expiringMember) {
      // إزالة "(باقي X يوم)" من الاسم
      const cleanName = expiringMember.name.replace(/\s*\(باقي \d+ يوم\)/, '').trim()
      return { name: cleanName, phone: expiringMember.phone, type: t('followups.form.types.expiringMember') }
    }

    // البحث في Day Use
    const dayUse = dayUseRecords.find(r => `dayuse-${r.id}` === formData.visitorId)
    if (dayUse) return { name: dayUse.name, phone: dayUse.phone, type: t('followups.form.types.dayUse') }

    // البحث في Invitations
    const invitation = invitations.find(inv => `invitation-${inv.id}` === formData.visitorId)
    if (invitation) return { name: invitation.guestName, phone: invitation.guestPhone, type: t('followups.form.types.invitation') }

    return null
  }

  const selectedInfo = getSelectedVisitorInfo()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(formData)
      // Reset form
      setFormData({
        visitorId: '',
        salesName: '',
        notes: '',
        result: '',
        nextFollowUpDate: '',
        contacted: false
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        <div className="sticky top-0 bg-orange-600 text-white p-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>📝</span>
            <span>{t('followups.form.title')}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* عرض معلومات الزائر/العضو المختار */}
          {selectedInfo ? (
            <div className="bg-gradient-to-r from-orange-50 to-indigo-50 border-2 border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="bg-orange-600 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold">
                  {selectedInfo.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-gray-800">{selectedInfo.name}</h3>
                    <span className="text-xs px-2 py-1 bg-orange-600 text-white rounded-full">
                      {selectedInfo.type}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">📱 {selectedInfo.phone}</p>
                </div>
              </div>
              {/* Hidden input to store visitorId */}
              <input type="hidden" name="visitorId" value={formData.visitorId} />
            </div>
          ) : (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-600 font-medium">{t('followups.form.noMemberSelected')}</p>
              <p className="text-red-500 text-sm mt-1">{t('followups.form.pleaseSelectMember')}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              {t('followups.form.salesName')} {t('followups.form.required')}
            </label>
            <input
              type="text"
              required
              value={formData.salesName}
              onChange={(e) => setFormData({ ...formData, salesName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              placeholder={t('followups.form.salesNamePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {t('followups.form.notes')} {t('followups.form.required')}
            </label>
            <textarea
              required
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              rows={3}
              placeholder={t('followups.form.notesPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t('followups.form.result')}</label>
              <select
                value={formData.result}
                onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              >
                <option value="">{t('followups.form.selectResult')}</option>
                <option value="interested">{t('followups.form.interested')}</option>
                <option value="not-interested">{t('followups.form.notInterested')}</option>
                <option value="postponed">{t('followups.form.postponed')}</option>
                <option value="subscribed">{t('followups.form.subscribed')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('followups.form.nextFollowUpDate')}</label>
              <input
                type="date"
                value={formData.nextFollowUpDate}
                onChange={(e) => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer p-2 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              checked={formData.contacted}
              onChange={(e) => setFormData({ ...formData, contacted: e.target.checked })}
              className="rounded w-4 h-4"
            />
            <span className="text-sm font-medium">{t('followups.form.contactedCheckbox')}</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 text-white py-2.5 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 font-semibold"
          >
            {loading ? t('followups.form.saving') : t('followups.form.save')}
          </button>
        </form>
      </div>
    </div>
  )
}
