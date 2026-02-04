'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../../contexts/LanguageContext'
import { useBarcodeScanner } from '../../contexts/BarcodeScannerContext'
import LinkModal from '../../components/LinkModal'

export default function SettingsPage() {
  const router = useRouter()
  const { locale, setLanguage, t, direction } = useLanguage()
  const { settings: scannerSettings, updateSettings } = useBarcodeScanner()
  const [user, setUser] = useState<any>(null)
  const [showLinkModal, setShowLinkModal] = useState(false)

  // Barcode scanner local settings state
  const [localScannerSettings, setLocalScannerSettings] = useState(scannerSettings)

  // Receipt settings state
  const [receiptStartNumber, setReceiptStartNumber] = useState<number>(1000)
  const [currentReceiptNumber, setCurrentReceiptNumber] = useState<number>(1000)
  const [savingReceipts, setSavingReceipts] = useState(false)
  const [receiptMessage, setReceiptMessage] = useState<string>('')

  // Member ID settings state
  const [memberStartNumber, setMemberStartNumber] = useState<number>(1001)
  const [currentMemberNumber, setCurrentMemberNumber] = useState<number>(1001)
  const [savingMembers, setSavingMembers] = useState(false)
  const [memberMessage, setMemberMessage] = useState<string>('')

  useEffect(() => {
    checkAuth()
    fetchReceiptSettings()
    fetchMemberSettings()
  }, [])

  // Sync local scanner settings with context
  useEffect(() => {
    setLocalScannerSettings(scannerSettings)
  }, [scannerSettings])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      router.push('/login')
    }
  }

  const fetchReceiptSettings = async () => {
    try {
      const response = await fetch('/api/receipts/next-number')
      if (response.ok) {
        const data = await response.json()
        setCurrentReceiptNumber(data.currentNumber || 1000)
        setReceiptStartNumber(data.nextNumber || 1001)
      }
    } catch (error) {
      console.error('Error fetching receipt settings:', error)
    }
  }

  const handleSaveReceiptSettings = async () => {
    try {
      setSavingReceipts(true)
      setReceiptMessage('')

      const response = await fetch('/api/receipts/next-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startNumber: receiptStartNumber
        })
      })

      const data = await response.json()

      if (response.ok) {
        setReceiptMessage('✅ ' + t('settings.settingsSavedSuccessfully'))
        setCurrentReceiptNumber(receiptStartNumber - 1)
        setTimeout(() => setReceiptMessage(''), 3000)
      } else {
        setReceiptMessage('❌ ' + (data.error || t('settings.settingsSaveFailed')))
      }
    } catch (error) {
      console.error('Error saving receipt settings:', error)
      setReceiptMessage('❌ ' + t('settings.settingsSaveFailed'))
    } finally {
      setSavingReceipts(false)
    }
  }

  const fetchMemberSettings = async () => {
    try {
      const response = await fetch('/api/members/next-number')
      if (response.ok) {
        const data = await response.json()
        setCurrentMemberNumber(data.nextNumber || 1001)
        setMemberStartNumber(data.nextNumber || 1001)
      }
    } catch (error) {
      console.error('Error fetching member settings:', error)
    }
  }

  const handleSaveMemberSettings = async () => {
    try {
      setSavingMembers(true)
      setMemberMessage('')

      const response = await fetch('/api/members/next-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startNumber: memberStartNumber
        })
      })

      const data = await response.json()

      if (response.ok) {
        setMemberMessage('✅ ' + t('settings.settingsSavedSuccessfully'))
        setCurrentMemberNumber(memberStartNumber)
        setTimeout(() => setMemberMessage(''), 3000)
      } else {
        setMemberMessage('❌ ' + (data.error || t('settings.settingsSaveFailed')))
      }
    } catch (error) {
      console.error('Error saving member settings:', error)
      setMemberMessage('❌ ' + t('settings.settingsSaveFailed'))
    } finally {
      setSavingMembers(false)
    }
  }

  const handleLanguageChange = (newLocale: 'ar' | 'en') => {
    setLanguage(newLocale)
  }

  return (
    <div className="max-w-4xl mx-auto p-6" dir={direction}>
      <div className="bg-white rounded-2xl shadow-lg p-8">
        {/* العنوان */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <span>⚙️</span>
            <span>{t('settings.title')}</span>
          </h1>
          <p className="text-gray-600 mt-2">{t('settings.systemSettings')}</p>
        </div>

        {/* قسم إدارة المستخدمين */}
        {user?.role === 'ADMIN' && (
          <div className="border-t pt-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span>👑</span>
              <span>{t('settings.adminSettings')}</span>
            </h2>

            <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border-2 border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">
                    {t('dashboard.manageUsers')}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {t('settings.manageUsersDescription')}
                  </p>
                </div>
                <Link
                  href="/admin/users"
                  className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-bold flex items-center gap-2 transition-colors"
                >
                  <span>👥</span>
                  <span>{t('settings.goToUsers')}</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* قسم إعدادات الإيصالات */}
        {user?.role === 'ADMIN' && (
          <div className="border-t pt-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span>🧾</span>
              <span>{t('settings.receiptsSettings')}</span>
            </h2>

            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 border-2 border-orange-200">
              <div className="space-y-4">
                {/* معلومات الرقم الحالي */}
                <div className="bg-white/50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">{t('settings.currentReceiptNumber')}</p>
                  <p className="text-2xl font-bold text-orange-600">#{currentReceiptNumber}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('settings.nextReceiptWillBe')} #{currentReceiptNumber + 1}</p>
                </div>

                {/* تحديد رقم البداية */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <span>🔢</span>
                      <span>{t('settings.receiptStartNumber')}</span>
                    </span>
                  </label>
                  <input
                    type="number"
                    value={receiptStartNumber}
                    onChange={(e) => setReceiptStartNumber(Number(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder={locale === 'ar' ? 'مثال: 1000' : 'Example: 1000'}
                    min="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 {t('settings.nextReceiptWillStartFrom')}
                  </p>
                </div>

                {/* زر الحفظ */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSaveReceiptSettings}
                    disabled={savingReceipts}
                    className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{savingReceipts ? '⏳' : '💾'}</span>
                    <span>{savingReceipts ? t('settings.saving') : t('settings.saveSettings')}</span>
                  </button>

                  <button
                    onClick={fetchReceiptSettings}
                    className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 font-bold flex items-center gap-2 transition-all"
                  >
                    <span>🔄</span>
                    <span>{t('settings.reload')}</span>
                  </button>
                </div>

                {/* رسالة النتيجة */}
                {receiptMessage && (
                  <div className={`p-3 rounded-lg ${receiptMessage.includes('✅') ? 'bg-green-100 border border-green-300 text-green-800' : 'bg-red-100 border border-red-300 text-red-800'}`}>
                    {receiptMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* قسم إعدادات أرقام الأعضاء */}
        {user?.role === 'ADMIN' && (
          <div className="border-t pt-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span>👥</span>
              <span>{t('settings.memberIdSettings')}</span>
            </h2>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200">
              <div className="space-y-4">
                {/* معلومات الرقم الحالي */}
                <div className="bg-white/50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">{t('settings.currentMemberNumber')}</p>
                  <p className="text-2xl font-bold text-blue-600">#{currentMemberNumber}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('settings.nextMemberWillGet')} #{currentMemberNumber}</p>
                </div>

                {/* تحديد رقم البداية */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <span>🔢</span>
                      <span>{t('settings.memberStartNumber')}</span>
                    </span>
                  </label>
                  <input
                    type="number"
                    value={memberStartNumber}
                    onChange={(e) => setMemberStartNumber(Number(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder={locale === 'ar' ? 'مثال: 1001' : 'Example: 1001'}
                    min="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 {t('settings.nextMemberWillStartFrom')}
                  </p>
                </div>

                {/* زر الحفظ */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSaveMemberSettings}
                    disabled={savingMembers}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{savingMembers ? '⏳' : '💾'}</span>
                    <span>{savingMembers ? t('settings.saving') : t('settings.saveSettings')}</span>
                  </button>

                  <button
                    onClick={fetchMemberSettings}
                    className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 font-bold flex items-center gap-2 transition-all"
                  >
                    <span>🔄</span>
                    <span>{t('settings.reload')}</span>
                  </button>
                </div>

                {/* رسالة النتيجة */}
                {memberMessage && (
                  <div className={`p-3 rounded-lg ${memberMessage.includes('✅') ? 'bg-green-100 border border-green-300 text-green-800' : 'bg-red-100 border border-red-300 text-red-800'}`}>
                    {memberMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* قسم العروض - Offers */}
        {user?.role === 'ADMIN' && (
          <div className="border-t pt-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span>🎁</span>
              <span>{t('settings.offers')}</span>
            </h2>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">
                    {t('settings.manageOffers')}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {t('settings.manageOffersDescription')}
                  </p>
                </div>
                <Link
                  href="/offers"
                  className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-bold flex items-center gap-2 transition-colors"
                >
                  <span>🎁</span>
                  <span>{t('settings.goToOffers')}</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* قسم مشاركة اللينك */}
        <div className="border-t pt-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>🔗</span>
            <span>{t('settings.shareLink')}</span>
          </h2>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  {t('settings.shareSystemLink')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('settings.shareLinkDescription')}
                </p>
              </div>
              <button
                onClick={() => setShowLinkModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg"
              >
                <span>🔗</span>
                <span>{t('settings.viewLink')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* قسم ماسح الباركود - Barcode Scanner */}
        <div className="border-t pt-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>📱</span>
            <span>{t('settings.barcodeScanner')}</span>
          </h2>

          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border-2 border-purple-200">
            <div className="space-y-4">

              {/* تفعيل/تعطيل */}
              <div className="flex items-center justify-between p-4 bg-white/60 rounded-lg">
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <span>⚡</span>
                    <span>{t('settings.enableBarcodeScanner')}</span>
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {t('settings.barcodeScannerDescription')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const val = !localScannerSettings.enabled
                    setLocalScannerSettings({ ...localScannerSettings, enabled: val })
                    updateSettings({ enabled: val })
                  }}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    localScannerSettings.enabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                    localScannerSettings.enabled ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>

              {/* السلوك */}
              <div className="p-4 bg-white/60 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="flex items-center gap-2">
                    <span>🎯</span>
                    <span>{t('settings.scanBehavior')}</span>
                  </span>
                </label>
                <select
                  value={localScannerSettings.behavior}
                  onChange={(e) => {
                    const val = e.target.value as 'open-modal' | 'disabled'
                    setLocalScannerSettings({ ...localScannerSettings, behavior: val })
                    updateSettings({ behavior: val })
                  }}
                  disabled={!localScannerSettings.enabled}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="open-modal">{t('settings.openModalAndSearch')}</option>
                  <option value="disabled">{t('settings.disabled')}</option>
                </select>
              </div>

              {/* طول Barcode */}
              <div className="p-4 bg-white/60 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="flex items-center gap-2">
                    <span>📏</span>
                    <span>{t('settings.minBarcodeLength')}</span>
                  </span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={localScannerSettings.minBarcodeLength}
                  onChange={(e) => setLocalScannerSettings({
                    ...localScannerSettings,
                    minBarcodeLength: parseInt(e.target.value) || 3
                  })}
                  onBlur={() => updateSettings({ minBarcodeLength: localScannerSettings.minBarcodeLength })}
                  disabled={!localScannerSettings.enabled}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 {t('settings.minBarcodeLengthDescription')}
                </p>
              </div>

              {/* الصوت */}
              <div className="flex items-center justify-between p-4 bg-white/60 rounded-lg">
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <span>🔊</span>
                    <span>{t('settings.enableSoundFeedback')}</span>
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {t('settings.soundFeedbackDescription')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const val = !localScannerSettings.enableSoundFeedback
                    setLocalScannerSettings({ ...localScannerSettings, enableSoundFeedback: val })
                    updateSettings({ enableSoundFeedback: val })
                  }}
                  disabled={!localScannerSettings.enabled}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    localScannerSettings.enableSoundFeedback ? 'bg-green-500' : 'bg-gray-300'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                    localScannerSettings.enableSoundFeedback ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>

              {/* تجاهل المكرر */}
              <div className="flex items-center justify-between p-4 bg-white/60 rounded-lg">
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <span>🚫</span>
                    <span>{t('settings.ignoreDuplicateScans')}</span>
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {t('settings.ignoreDuplicateScansDescription')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const val = !localScannerSettings.ignoreDuplicateScans
                    setLocalScannerSettings({ ...localScannerSettings, ignoreDuplicateScans: val })
                    updateSettings({ ignoreDuplicateScans: val })
                  }}
                  disabled={!localScannerSettings.enabled}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    localScannerSettings.ignoreDuplicateScans ? 'bg-green-500' : 'bg-gray-300'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                    localScannerSettings.ignoreDuplicateScans ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>

              {/* مدة Timeout */}
              {localScannerSettings.ignoreDuplicateScans && (
                <div className="p-4 bg-white/60 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <span>⏱️</span>
                      <span>{t('settings.duplicateScanTimeout')}</span>
                    </span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={localScannerSettings.duplicateScanTimeout}
                    onChange={(e) => setLocalScannerSettings({
                      ...localScannerSettings,
                      duplicateScanTimeout: parseInt(e.target.value) || 3
                    })}
                    onBlur={() => updateSettings({ duplicateScanTimeout: localScannerSettings.duplicateScanTimeout })}
                    disabled={!localScannerSettings.enabled}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 {t('settings.duplicateScanTimeoutDescription')}
                  </p>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* قسم اللغة */}
        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>🌐</span>
            <span>{t('settings.languageSettings')}</span>
          </h2>

          <div className="bg-gray-50 rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('settings.currentLanguage')}
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* زر العربية */}
              <button
                onClick={() => handleLanguageChange('ar')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  locale === 'ar'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🇸🇦</span>
                  <div className="text-right flex-1">
                    <div className="font-bold text-lg">العربية</div>
                    <div className="text-sm text-gray-600">Arabic</div>
                  </div>
                  {locale === 'ar' && (
                    <span className="text-blue-500 text-xl">✓</span>
                  )}
                </div>
              </button>

              {/* زر الإنجليزية */}
              <button
                onClick={() => handleLanguageChange('en')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  locale === 'en'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🇬🇧</span>
                  <div className="text-left flex-1">
                    <div className="font-bold text-lg">English</div>
                    <div className="text-sm text-gray-600">الإنجليزية</div>
                  </div>
                  {locale === 'en' && (
                    <span className="text-blue-500 text-xl">✓</span>
                  )}
                </div>
              </button>
            </div>

            {/* رسالة معلومات */}
            <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg text-blue-800 text-sm">
              ℹ️ {t('settings.languageChangedSuccessfully')}
            </div>
          </div>
        </div>

        {/* قسم الدعم الفني */}
        <div className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>📞</span>
            <span>{t('settings.technicalSupport')}</span>
          </h2>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span>💬</span>
                  <span>{t('settings.technicalSupport')}</span>
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  {t('settings.supportDescription')}
                </p>
                <p className="text-sm font-semibold text-green-700 flex items-center gap-2">
                  <span>📱</span>
                  <span>01028518754</span>
                </p>
              </div>
              <a
                href="https://wa.me/201028518754"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg"
              >
                <span className="text-xl">💬</span>
                <span>{t('settings.contactSupport')}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Powered by FitBoost */}
        <div className="border-t pt-6 mt-6">
          <div className="text-center">
            <a
              href="https://www.fitboost.website/en"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              <span className="text-sm text-gray-500">{t('settings.poweredBy')}</span>
              <img
                src="/FB.png"
                alt="FitBoost"
                className="h-6 w-auto"
              />
            </a>
          </div>
        </div>
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <LinkModal onClose={() => setShowLinkModal(false)} />
      )}
    </div>
  )
}
