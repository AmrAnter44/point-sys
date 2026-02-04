'use client'

import { useState, useEffect } from 'react'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'
import PermissionDenied from '../../components/PermissionDenied'
import PaymentMethodSelector from '../../components/Paymentmethodselector'
import { ReceiptToPrint } from '../../components/ReceiptToPrint'
import { calculateNutritionPrice, getMemberTier, getPackageName } from '../../lib/nutritionPricing'

interface NutritionPackage {
  id: string
  clientName: string
  clientPhone: string
  memberId: string | null
  packageType: string
  duration: number
  followUpsIncluded: number
  followUpsUsed: number
  inBodyScansIncluded: number
  totalPrice: number
  discountAmount: number
  discountPercent: number
  memberTier: string | null
  basePrice: number
  createdAt: string
  expiryDate: string | null
  member?: {
    memberNumber: number | null
    name: string
  } | null
}

export default function NutritionPage() {
  const { hasPermission, user, loading: permissionsLoading } = usePermissions()
  const { t, locale, direction } = useLanguage()
  const [packages, setPackages] = useState<NutritionPackage[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [coaches, setCoaches] = useState<any[]>([])
  const [isRenewing, setIsRenewing] = useState(false)
  const [filterMonth, setFilterMonth] = useState('all')
  const [filterPackage, setFilterPackage] = useState('all')
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    memberId: '',
    packageType: 'single',
    paymentMethod: 'cash',
    staffName: user?.name || '',
    referringCoachId: '',
  })
  const [pricingPreview, setPricingPreview] = useState<any>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [loadingMember, setLoadingMember] = useState(false)
  const [memberData, setMemberData] = useState<any>(null)
  const [memberNumberDisplay, setMemberNumberDisplay] = useState('')

  useEffect(() => {
    fetchPackages()
    fetchCoaches()
  }, [])

  useEffect(() => {
    if (user && !formData.staffName) {
      setFormData(prev => ({ ...prev, staffName: user.name }))
    }
  }, [user])

  // Auto-fill member data when memberNumber changes
  useEffect(() => {
    const fetchMemberData = async () => {
      const memberNumber = memberNumberDisplay?.trim()

      // إذا كان فارغ، امسح البيانات
      if (!memberNumber) {
        setMemberData(null)
        setFormData(prev => ({ ...prev, memberId: '', clientName: '', clientPhone: '' }))
        return
      }

      // التأكد أنه رقم فقط
      if (!/^\d+$/.test(memberNumber)) {
        setMemberData(null)
        setFormData(prev => ({ ...prev, memberId: '' }))
        return
      }

      setLoadingMember(true)
      try {
        console.log('🔍 البحث برقم العضوية:', memberNumber)
        const response = await fetch(`/api/members?memberNumber=${memberNumber}`)

        if (response.ok) {
          const members = await response.json()
          if (members.length > 0) {
            const member = members[0]
            console.log('✅ تم العثور على العضو:', member.name)
            setMemberData(member) // حفظ بيانات العضو للأسعار
            setFormData(prev => ({
              ...prev,
              clientName: member.name,
              clientPhone: member.phone,
              memberId: member.id // حفظ الـ ID داخلياً فقط
            }))
          } else {
            console.log('❌ لم يتم العثور على عضو برقم العضوية:', memberNumber)
            setMemberData(null)
            setFormData(prev => ({ ...prev, memberId: '' }))
          }
        }
      } catch (error) {
        console.error('خطأ في جلب بيانات العضو:', error)
      } finally {
        setLoadingMember(false)
      }
    }

    // تأخير البحث قليلاً لتجنب الطلبات المتكررة
    const timeoutId = setTimeout(fetchMemberData, 500)
    return () => clearTimeout(timeoutId)
  }, [memberNumberDisplay])

  useEffect(() => {
    if (formData.packageType) {
      const tier = memberData ? getMemberTier(calculateMemberDuration(memberData)) : null
      const pricing = calculateNutritionPrice(formData.packageType as any, tier)
      setPricingPreview(pricing)
    }
  }, [formData.packageType, memberData])

  const fetchPackages = async () => {
    try {
      const response = await fetch('/api/nutrition')
      if (response.ok) {
        const data = await response.json()
        setPackages(data)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const calculateMemberDuration = (member: any): number => {
    if (!member.startDate || !member.expiryDate) return 0
    return Math.floor((new Date(member.expiryDate).getTime() - new Date(member.startDate).getTime()) / (1000 * 60 * 60 * 24))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // Clean memberId: convert empty string to null
      const submitData = {
        ...formData,
        memberId: formData.memberId || null,
        staffName: user?.name || ''
      }

      const response = await fetch('/api/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      if (response.ok) {
        const result = await response.json()
        try {
          const receiptsResponse = await fetch(`/api/receipts`)
          const allReceipts = await receiptsResponse.json()
          const receipts = allReceipts.filter((r: any) => r.nutritionId === result.id)
          if (receipts.length > 0) {
            const receipt = receipts[0]
            setReceiptData({
              receiptNumber: receipt.receiptNumber,
              type: receipt.type,
              amount: receipt.amount,
              details: JSON.parse(receipt.itemDetails),
              date: new Date(receipt.createdAt),
              paymentMethod: formData.paymentMethod
            })
            setShowReceipt(true)
          }
        } catch (err) {
          console.error('Error:', err)
        }
        setMessage(t('nutrition.messages.success'))
        setTimeout(() => setMessage(''), 3000)
        fetchPackages()
        resetForm()
      } else {
        const error = await response.json()
        setMessage(`${t('nutrition.messages.failed')} - ${error.error}`)
      }
    } catch (error) {
      console.error(error)
      setMessage(t('nutrition.messages.error'))
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      clientName: '',
      clientPhone: '',
      memberId: '',
      packageType: 'single',
      paymentMethod: 'cash',
      staffName: user?.name || '',
      referringCoachId: '',
    })
    setMemberData(null)
    setMemberNumberDisplay('')
    setPricingPreview(null)
    setShowForm(false)
  }

  const handleRenew = (pkg: NutritionPackage) => {
    setFormData({
      clientName: pkg.clientName,
      clientPhone: pkg.clientPhone,
      memberId: pkg.memberId || '',
      packageType: pkg.packageType,
      paymentMethod: 'cash',
      staffName: user?.name || '',
      referringCoachId: '',
    })
    setIsRenewing(true)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleUseSession = async (packageId: string) => {
    try {
      const response = await fetch('/api/nutrition/use-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId,
          staffName: user?.name || '',
        }),
      })

      if (response.ok) {
        setMessage(t('nutrition.messages.sessionRecorded'))
        setTimeout(() => setMessage(''), 3000)
        fetchPackages()
      } else {
        const error = await response.json()
        setMessage(`${t('nutrition.messages.sessionFailed')} - ${error.error}`)
        setTimeout(() => setMessage(''), 5000)
      }
    } catch (error) {
      console.error(error)
      setMessage(t('nutrition.messages.sessionError'))
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('nutrition.deleteConfirm'))) return
    try {
      const response = await fetch(`/api/nutrition?id=${id}`, { method: 'DELETE' })
      if (response.ok) {
        setMessage(t('nutrition.messages.deleteSuccess'))
        fetchPackages()
      } else {
        setMessage(t('nutrition.messages.deleteFailed'))
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage(t('nutrition.messages.deleteError'))
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const filteredPackages = packages.filter((pkg) => {
    // فلتر البحث
    const matchesSearch = pkg.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.clientPhone.includes(searchTerm)

    // فلتر الشهر
    let matchesMonth = true
    if (filterMonth !== 'all' && pkg.createdAt) {
      const createdDate = new Date(pkg.createdAt)
      const createdMonth = createdDate.getMonth() + 1 // 1-12
      matchesMonth = createdMonth.toString() === filterMonth
    }

    // فلتر الباقة (حسب duration)
    const matchesPackage =
      filterPackage === 'all' ||
      pkg.duration.toString() === filterPackage

    return matchesSearch && matchesMonth && matchesPackage
  })

  // حساب إجمالي الدخل من الباقات المفلترة
  const totalRevenue = filteredPackages.reduce((sum, pkg) => sum + pkg.totalPrice, 0)

  // عرض شاشة التحميل أثناء فحص الصلاحيات
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">{t('nutrition.loading')}</p>
        </div>
      </div>
    )
  }

  if (!hasPermission('canViewNutrition')) {
    return <PermissionDenied message={t('nutrition.noPermission')} />
  }

  return (
    <div className="container mx-auto p-4 sm:p-6" dir={direction}>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">🥗 {t('nutrition.title')}</h1>
        <p className="text-sm sm:text-base text-gray-600">{t('nutrition.subtitle')}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => {
            setShowForm(!showForm)
            if (showForm) {
              // Reset form when closing
              setFormData({
                clientName: '',
                clientPhone: '',
                memberId: '',
                packageType: 'single',
                paymentMethod: 'cash',
                staffName: user?.name || '',
                referringCoachId: '',
              })
              setMemberNumberDisplay('')
              setIsRenewing(false)
            }
          }} className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition">
            {showForm ? t('nutrition.hideForm') : `➕ ${t('nutrition.addNewPackage')}`}
          </button>
          <button
            onClick={() => window.location.href = '/nutrition/free-sessions'}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            <span>📋</span>
            <span>{t('nutrition.viewFreeSessions')}</span>
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.includes('✅') || message.includes('نجاح') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-lg mb-6 border-2 border-orange-100">
          <h2 className="text-xl font-semibold mb-4">{isRenewing ? `🔄 ${t('nutrition.renewPackage')}` : t('nutrition.addPackage')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Member Number - Optional */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium mb-1 text-blue-900">
                👤 {t('nutrition.memberId')} <span className="text-xs text-blue-600">({t('common.optional')})</span>
              </label>
              <input
                type="text"
                placeholder={t('nutrition.memberIdPlaceholder')}
                value={memberNumberDisplay}
                onChange={(e) => setMemberNumberDisplay(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:border-blue-500 focus:outline-none"
              />
              {loadingMember && (
                <p className="text-xs text-blue-600 mt-1">⏳ جاري البحث عن العضو...</p>
              )}
              {!loadingMember && (
                <p className="text-xs text-gray-600 mt-1">{t('nutrition.memberIdHint')}</p>
              )}
            </div>

            {/* Client Name */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('nutrition.clientName')} <span className="text-red-600">*</span></label>
              <input
                type="text"
                required
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder={t('nutrition.clientNamePlaceholder')}
              />
            </div>

            {/* Client Phone */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('nutrition.clientPhone')} <span className="text-red-600">*</span></label>
              <input
                type="tel"
                required
                value={formData.clientPhone}
                onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder={t('nutrition.clientPhonePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('nutrition.packageType')} <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'single', label: t('nutrition.singleSession') },
                  { value: '1month', label: t('nutrition.package1Month') },
                  { value: '2months', label: t('nutrition.package2Months') },
                  { value: '3months', label: t('nutrition.package3Months') },
                ].map((option) => (
                  <button key={option.value} type="button"
                    onClick={() => setFormData({ ...formData, packageType: option.value })}
                    className={`p-4 rounded-lg border-2 transition ${formData.packageType === option.value ? 'bg-orange-100 border-orange-500 shadow-md' : 'bg-white border-gray-300 hover:border-gray-400'}`}>
                    <div className="font-semibold">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {pricingPreview && (
              <div className="bg-gradient-to-br from-green-50 to-orange-50 border-2 border-green-200 rounded-lg p-4">
                <h3 className="font-semibold mb-3">{t('nutrition.pricingSummary')}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>{t('nutrition.basePrice')}:</span>
                    <span className="font-semibold">{pricingPreview.basePrice} {t('common.currency')}</span>
                  </div>
                  {pricingPreview.discountAmount > 0 && (
                    <>
                      <div className="flex justify-between text-red-600">
                        <span>{t('nutrition.discount')} ({pricingPreview.discountPercent}%):</span>
                        <span className="font-semibold">- {pricingPreview.discountAmount} {t('common.currency')}</span>
                      </div>
                      <div className="flex justify-between text-green-700 font-bold border-t pt-2">
                        <span>{t('nutrition.savedAmount')}:</span>
                        <span>{pricingPreview.discountAmount} {t('common.currency')}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>{t('nutrition.totalPrice')}:</span>
                    <span className="text-orange-600">{pricingPreview.finalPrice} {t('common.currency')}</span>
                  </div>
                  {pricingPreview.packageDetails.duration > 0 && (
                    <div className="bg-white p-2 rounded mt-2 text-xs">
                      <p>📋 {t('nutrition.followUps')}: {pricingPreview.packageDetails.followUps}</p>
                      <p>🔬 {t('nutrition.inBodyScans')}: {pricingPreview.packageDetails.inBodyScans}</p>
                      <p>🍽️ {t('nutrition.mealUpdates')}: {pricingPreview.packageDetails.mealUpdates}</p>
                      <p>⚡ {t('nutrition.strategyUpdates')}: {pricingPreview.packageDetails.strategyUpdates}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Referring Coach */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                {t('nutrition.referringCoach')}
              </label>

              <select
                value={formData.referringCoachId}
                onChange={(e) => setFormData({ ...formData, referringCoachId: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
              >
                <option value="">{t('nutrition.referringCoachPlaceholder')}</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.name} {coach.phone && `(${coach.phone})`}
                  </option>
                ))}
              </select>

              {formData.referringCoachId && (
                <div className="mt-2 bg-green-50 border-2 border-green-200 rounded-lg p-2">
                  <span className="text-sm text-green-800">
                    {t('nutrition.coachCommissionNote')}
                  </span>
                </div>
              )}

              <p className="text-xs text-gray-500 mt-1">
                {t('nutrition.coachCommissionHint')}
              </p>
            </div>

            <PaymentMethodSelector value={formData.paymentMethod}
              onChange={(method) => setFormData({ ...formData, paymentMethod: method })} required />

            <div className="flex gap-3">
              <button type="submit" disabled={loading}
                className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:bg-gray-400">
                {loading ? t('nutrition.saving') : t('nutrition.confirmPurchase')}
              </button>
              <button type="button" onClick={resetForm}
                className="px-6 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* إجمالي الدخل */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg shadow-lg p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">{t('nutrition.totalRevenue')}</p>
            <p className="text-3xl font-bold">{totalRevenue.toLocaleString()} {locale === 'ar' ? 'ج.م' : 'EGP'}</p>
            <p className="text-xs opacity-75 mt-1">{filteredPackages.length} {t('nutrition.packages')}</p>
          </div>
          <div className="text-5xl opacity-80">💰</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        {/* البحث */}
        <div className="mb-4">
          <input
            type="text"
            placeholder={`🔍 ${t('nutrition.searchPlaceholder')}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border-2 rounded-lg text-lg"
          />
        </div>

        {/* الفلاتر */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* فلتر الباقة */}
          <div>
            <label className="block text-sm font-medium mb-1.5">🎁 {t('nutrition.packageFilter')}</label>
            <select
              value={filterPackage}
              onChange={(e) => setFilterPackage(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg"
            >
              <option value="all">{t('nutrition.allPackages')}</option>
              <option value="1">1 - {t('nutrition.duration1')}</option>
              <option value="3">3 - {t('nutrition.duration3')}</option>
              <option value="6">6 - {t('nutrition.duration6')}</option>
            </select>
          </div>

          {/* فلتر الشهر */}
          <div>
            <label className="block text-sm font-medium mb-1.5">📅 {t('nutrition.monthFilter')}</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg"
            >
              <option value="all">{t('nutrition.allMonths')}</option>
              <option value="1">{t('months.january')}</option>
              <option value="2">{t('months.february')}</option>
              <option value="3">{t('months.march')}</option>
              <option value="4">{t('months.april')}</option>
              <option value="5">{t('months.may')}</option>
              <option value="6">{t('months.june')}</option>
              <option value="7">{t('months.july')}</option>
              <option value="8">{t('months.august')}</option>
              <option value="9">{t('months.september')}</option>
              <option value="10">{t('months.october')}</option>
              <option value="11">{t('months.november')}</option>
              <option value="12">{t('months.december')}</option>
            </select>
          </div>
        </div>

        {/* زر إعادة تعيين الفلاتر */}
        {(filterMonth !== 'all' || filterPackage !== 'all') && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                setFilterMonth('all')
                setFilterPackage('all')
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
            >
              🔄 {t('nutrition.resetFilters')}
            </button>
          </div>
        )}
      </div>

      {loading ? (<div className="text-center py-12">{t('common.loading')}</div>) : (
        <div className="space-y-4">
          {filteredPackages.map((pkg) => {
            const followUpsRemaining = pkg.followUpsIncluded - pkg.followUpsUsed
            return (
              <div key={pkg.id} className="bg-white border-r-4 border-green-500 rounded-lg shadow-md p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold">{pkg.clientName}</h3>
                    <p className="text-sm text-gray-600">{pkg.clientPhone}</p>
                    {pkg.member?.memberNumber && (
                      <p className="text-xs text-blue-600 font-semibold mt-1">
                        #{pkg.member.memberNumber}
                      </p>
                    )}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${followUpsRemaining === 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                    {followUpsRemaining} / {pkg.followUpsIncluded} {t('nutrition.followUps')}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-orange-50 p-2 rounded">
                    <div className="text-xs text-gray-600">{t('nutrition.packageTypeLabel')}</div>
                    <div className="font-semibold">{getPackageName(pkg.packageType, locale)}</div>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <div className="text-xs text-gray-600">{t('nutrition.totalPriceLabel')}</div>
                    <div className="font-semibold">{pkg.totalPrice} {t('common.currency')}</div>
                  </div>
                  {pkg.memberTier && (
                    <div className="bg-purple-50 p-2 rounded">
                      <div className="text-xs text-gray-600">{t('nutrition.memberTierLabel')}</div>
                      <div className="font-semibold">{pkg.memberTier}</div>
                    </div>
                  )}
                  {pkg.discountAmount > 0 && (
                    <div className="bg-orange-50 p-2 rounded">
                      <div className="text-xs text-gray-600">{t('nutrition.discountLabel')}</div>
                      <div className="font-semibold text-red-600">{pkg.discountAmount} {t('common.currency')} ({pkg.discountPercent}%)</div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {followUpsRemaining > 0 && (
                    <button
                      onClick={() => handleUseSession(pkg.id)}
                      className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition"
                    >
                      ✓ {t('nutrition.useSession')}
                    </button>
                  )}
                  <button onClick={() => handleRenew(pkg)} className="flex-1 bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700">
                    🔄 {t('nutrition.renew')}
                  </button>
                  <button onClick={() => handleDelete(pkg.id)} className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700">
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            )
          })}

          {filteredPackages.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
              <div className="text-6xl mb-4">🥗</div>
              <p className="text-xl">{t('nutrition.noPackages')}</p>
            </div>
          )}
        </div>
      )}

      {showReceipt && receiptData && (
        <ReceiptToPrint receiptNumber={receiptData.receiptNumber} type={receiptData.type}
          amount={receiptData.amount} details={receiptData.details} date={receiptData.date}
          paymentMethod={receiptData.paymentMethod} onClose={() => setShowReceipt(false)} />
      )}
    </div>
  )
}
