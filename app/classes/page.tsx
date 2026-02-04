'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionDenied from '../../components/PermissionDenied'
import PaymentMethodSelector from '../../components/Paymentmethodselector'
import { calculateClassPrice, formatTierName, PackageType, ClassPricing } from '../../lib/classesPricing'

interface Member {
  id: string
  memberNumber: number
  name: string
  phone: string
  startDate: string
  expiryDate: string
  subscriptionType: string | null
}

interface ClassPackage {
  packageNumber: number
  clientName: string
  phone: string
  memberId: string | null
  subscriptionType: string | null
  packageType: string
  sessionsPurchased: number
  sessionsRemaining: number
  instructorName: string | null
  pricePerSession: number
  totalPrice: number
  paidAmount: number
  remainingAmount: number
  qrCode: string | null
  qrCodeImage: string | null
  createdAt: string
  sessions?: any[]
  member?: Member | null
}

export default function ClassesPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading, user } = usePermissions()

  const [packages, setPackages] = useState<ClassPackage[]>([])
  const [filteredPackages, setFilteredPackages] = useState<ClassPackage[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  // Member search
  const [memberPhone, setMemberPhone] = useState('')
  const [memberData, setMemberData] = useState<Member | null>(null)
  const [searchingMember, setSearchingMember] = useState(false)

  // Pricing preview
  const [pricingPreview, setPricingPreview] = useState<ClassPricing | null>(null)

  // Form data
  const [formData, setFormData] = useState({
    clientName: '',
    phone: '',
    memberId: '',
    subscriptionType: '',
    packageType: '10sessions' as PackageType,
    sessionsPurchased: 10,
    instructorName: '',
    totalPrice: 0,
    pricePerSession: 0,
    paidAmount: 0,
    paymentMethod: 'cash' as 'cash' | 'visa' | 'instapay' | 'wallet',
    staffName: user?.name || '',
  })

  // Filters
  const [filterInstructor, setFilterInstructor] = useState('')
  const [filterPackageType, setFilterPackageType] = useState<'all' | 'single' | '10sessions'>('all')
  const [filterSessions, setFilterSessions] = useState<'all' | 'low' | 'zero'>('all')
  const [searchText, setSearchText] = useState('')

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<ClassPackage | null>(null)
  const [registerNotes, setRegisterNotes] = useState('')
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)

  useEffect(() => {
    if (hasPermission('canViewPT')) {
      fetchPackages()
    }
  }, [hasPermission])

  useEffect(() => {
    if (user && !formData.staffName) {
      setFormData(prev => ({ ...prev, staffName: user.name }))
    }
  }, [user])

  const fetchPackages = async () => {
    try {
      const response = await fetch('/api/classes')

      if (response.status === 401) {
        router.push('/login')
        return
      }

      if (response.status === 403) {
        return
      }

      const data = await response.json()
      setPackages(data)
      setFilteredPackages(data)
    } catch (error) {
      console.error('Error fetching packages:', error)
    } finally {
      setLoading(false)
    }
  }

  // Member search handler
  const handleMemberSearch = async (phone: string) => {
    if (phone.length < 10) {
      setMemberData(null)
      setPricingPreview(null)
      return
    }

    setSearchingMember(true)
    try {
      const response = await fetch(`/api/members/search?phone=${phone}`)
      const data = await response.json()

      if (data.member) {
        setMemberData(data.member)
        setFormData(prev => ({
          ...prev,
          clientName: data.member.name,
          phone: data.member.phone,
          memberId: data.member.id,
          subscriptionType: data.member.subscriptionType || '',
        }))

        // حساب السعر تلقائياً
        const pricing = calculateClassPrice(formData.packageType, data.member.subscriptionType)
        setPricingPreview(pricing)
        setFormData(prev => ({
          ...prev,
          totalPrice: pricing.totalPrice,
          pricePerSession: pricing.pricePerSession,
          paidAmount: pricing.totalPrice,
        }))
      } else {
        setMemberData(null)
        setPricingPreview(null)
        setFormData(prev => ({
          ...prev,
          clientName: '',
          phone: phone,
          memberId: '',
          subscriptionType: '',
        }))

        // حساب سعر non-member
        const pricing = calculateClassPrice(formData.packageType, null)
        setPricingPreview(pricing)
        setFormData(prev => ({
          ...prev,
          totalPrice: pricing.totalPrice,
          pricePerSession: pricing.pricePerSession,
          paidAmount: pricing.totalPrice,
        }))
      }
    } catch (error) {
      console.error('Error searching member:', error)
      setMemberData(null)
    } finally {
      setSearchingMember(false)
    }
  }

  // Package type change handler
  const handlePackageTypeChange = (packageType: PackageType) => {
    setFormData(prev => ({ ...prev, packageType }))

    const sessions = packageType === 'single' ? 1 : 10
    setFormData(prev => ({ ...prev, sessionsPurchased: sessions }))

    // إعادة حساب السعر
    const pricing = calculateClassPrice(packageType, formData.subscriptionType || null)
    setPricingPreview(pricing)
    setFormData(prev => ({
      ...prev,
      totalPrice: pricing.totalPrice,
      pricePerSession: pricing.pricePerSession,
      paidAmount: pricing.totalPrice,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('✅ تم إضافة باقة الكلاسات بنجاح!')
        setShowForm(false)
        fetchPackages()

        // Reset form
        setFormData({
          clientName: '',
          phone: '',
          memberId: '',
          subscriptionType: '',
          packageType: '10sessions',
          sessionsPurchased: 10,
          instructorName: '',
          totalPrice: 0,
          pricePerSession: 0,
          paidAmount: 0,
          paymentMethod: 'cash',
          staffName: user?.name || '',
        })
        setMemberPhone('')
        setMemberData(null)
        setPricingPreview(null)
      } else {
        setMessage(`❌ ${data.error || 'فشل إضافة الباقة'}`)
      }
    } catch (error) {
      setMessage('❌ حدث خطأ في الاتصال')
      console.error('Error:', error)
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(''), 5000)
    }
  }

  const handleRegisterSession = async () => {
    if (!selectedPackage) return

    try {
      const response = await fetch('/api/classes/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageNumber: selectedPackage.packageNumber,
          notes: registerNotes,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('✅ تم تسجيل الجلسة بنجاح!')
        setShowRegisterModal(false)
        setSelectedPackage(null)
        setRegisterNotes('')
        fetchPackages()
      } else {
        setMessage(`❌ ${data.error || 'فشل تسجيل الجلسة'}`)
      }
    } catch (error) {
      setMessage('❌ حدث خطأ في الاتصال')
    } finally {
      setTimeout(() => setMessage(''), 5000)
    }
  }

  // Filtering
  useEffect(() => {
    let filtered = packages

    if (searchText) {
      filtered = filtered.filter(pkg =>
        pkg.clientName.toLowerCase().includes(searchText.toLowerCase()) ||
        pkg.phone.includes(searchText) ||
        pkg.packageNumber.toString().includes(searchText) ||
        (pkg.instructorName && pkg.instructorName.toLowerCase().includes(searchText.toLowerCase()))
      )
    }

    if (filterInstructor) {
      filtered = filtered.filter(pkg => pkg.instructorName === filterInstructor)
    }

    if (filterPackageType !== 'all') {
      filtered = filtered.filter(pkg => pkg.packageType === filterPackageType)
    }

    if (filterSessions === 'low') {
      filtered = filtered.filter(pkg => pkg.sessionsRemaining > 0 && pkg.sessionsRemaining <= 3)
    } else if (filterSessions === 'zero') {
      filtered = filtered.filter(pkg => pkg.sessionsRemaining === 0)
    }

    setFilteredPackages(filtered)
  }, [searchText, filterInstructor, filterPackageType, filterSessions, packages])

  const uniqueInstructors = Array.from(new Set(packages.map(p => p.instructorName).filter(Boolean)))

  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">جاري التحميل...</div>
      </div>
    )
  }

  if (!hasPermission('canViewPT')) {
    return <PermissionDenied message="ليس لديك صلاحية لعرض صفحة الكلاسات" />
  }

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">🏋️ إدارة الكلاسات</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700"
        >
          {showForm ? 'إخفاء النموذج' : '➕ إضافة باقة كلاسات'}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-6 text-center font-bold ${
          message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">إضافة باقة كلاسات جديدة</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Member Search */}
            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
              <label className="block text-sm font-medium mb-2">
                🔍 رقم الهاتف (للبحث عن عضو)
              </label>
              <input
                type="tel"
                value={memberPhone}
                onChange={(e) => {
                  setMemberPhone(e.target.value)
                  handleMemberSearch(e.target.value)
                }}
                className="w-full px-3 py-2 border-2 rounded-lg"
                placeholder="01234567890"
                dir="ltr"
              />

              {searchingMember && (
                <p className="text-sm text-gray-500 mt-2">🔄 جاري البحث...</p>
              )}

              {memberData && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 font-semibold">✅ عضو موجود</p>
                  <p className="text-xs text-gray-700 mt-1">
                    الاسم: <span className="font-bold">{memberData.name}</span>
                  </p>
                  <p className="text-xs text-gray-700">
                    المستوى: <span className="font-bold">{formatTierName(memberData.subscriptionType, 'ar')}</span>
                  </p>
                </div>
              )}

              {!memberData && memberPhone.length >= 10 && !searchingMember && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-700 font-semibold">⚠️ غير مشترك</p>
                  <p className="text-xs text-gray-700">سيتم تسجيله كـ "غير مشترك"</p>
                </div>
              )}
            </div>

            {/* Client Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">الاسم *</label>
                <input
                  type="text"
                  required
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  className="w-full px-3 py-2 border-2 rounded-lg"
                  placeholder="اسم العميل"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border-2 rounded-lg"
                  placeholder="01234567890"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Package Type */}
            <div>
              <label className="block text-sm font-medium mb-2">نوع الباقة *</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handlePackageTypeChange('single')}
                  className={`px-4 py-3 rounded-lg font-medium border-2 ${
                    formData.packageType === 'single'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
                  }`}
                >
                  جلسة واحدة (200 ج.م)
                </button>

                <button
                  type="button"
                  onClick={() => handlePackageTypeChange('10sessions')}
                  className={`px-4 py-3 rounded-lg font-medium border-2 ${
                    formData.packageType === '10sessions'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
                  }`}
                >
                  باقة 10 جلسات
                </button>
              </div>
            </div>

            {/* Pricing Preview */}
            {pricingPreview && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <h3 className="font-bold text-green-800 mb-2">💰 تفاصيل التسعير</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">عدد الجلسات:</p>
                    <p className="font-bold text-lg">{pricingPreview.sessions} جلسة</p>
                  </div>
                  <div>
                    <p className="text-gray-600">المستوى:</p>
                    <p className="font-bold text-lg">{formatTierName(pricingPreview.tier, 'ar')}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">السعر الأساسي:</p>
                    <p className="font-bold text-lg">{pricingPreview.basePrice} ج.م</p>
                  </div>
                  <div>
                    <p className="text-gray-600">نسبة الخصم:</p>
                    <p className="font-bold text-lg text-green-600">{pricingPreview.discountPercent}%</p>
                  </div>
                  <div className="col-span-2 border-t-2 border-green-300 pt-2">
                    <p className="text-gray-600">السعر النهائي:</p>
                    <p className="font-bold text-2xl text-green-600">{pricingPreview.totalPrice} ج.م</p>
                    <p className="text-xs text-gray-600">({pricingPreview.pricePerSession} ج.م/جلسة)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Instructor */}
            <div>
              <label className="block text-sm font-medium mb-1">المدرب (اختياري)</label>
              <input
                type="text"
                value={formData.instructorName}
                onChange={(e) => setFormData({ ...formData, instructorName: e.target.value })}
                className="w-full px-3 py-2 border-2 rounded-lg"
                placeholder="اسم المدرب"
              />
            </div>

            {/* Payment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">المبلغ المدفوع *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.paidAmount}
                  onChange={(e) => setFormData({ ...formData, paidAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border-2 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">طريقة الدفع</label>
                <PaymentMethodSelector
                  value={formData.paymentMethod}
                  onChange={(method) => setFormData({ ...formData, paymentMethod: method as any })}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-bold"
            >
              {loading ? '⏳ جاري الحفظ...' : '✅ حفظ الباقة'}
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <h3 className="font-bold mb-3">🔍 البحث والفلترة</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">بحث</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg"
              placeholder="اسم، هاتف، رقم باقة..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">المدرب</label>
            <select
              value={filterInstructor}
              onChange={(e) => setFilterInstructor(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg"
            >
              <option value="">الكل</option>
              {uniqueInstructors.map(instructor => (
                <option key={instructor} value={instructor || ''}>
                  {instructor}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">نوع الباقة</label>
            <select
              value={filterPackageType}
              onChange={(e) => setFilterPackageType(e.target.value as any)}
              className="w-full px-3 py-2 border-2 rounded-lg"
            >
              <option value="all">الكل</option>
              <option value="single">جلسة واحدة</option>
              <option value="10sessions">10 جلسات</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">الجلسات المتبقية</label>
            <select
              value={filterSessions}
              onChange={(e) => setFilterSessions(e.target.value as any)}
              className="w-full px-3 py-2 border-2 rounded-lg"
            >
              <option value="all">الكل</option>
              <option value="low">قليلة (1-3)</option>
              <option value="zero">صفر</option>
            </select>
          </div>
        </div>
      </div>

      {/* Packages Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="text-center py-12">جاري التحميل...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-right">رقم الباقة</th>
                  <th className="px-4 py-3 text-right">اسم العميل</th>
                  <th className="px-4 py-3 text-right">الهاتف</th>
                  <th className="px-4 py-3 text-right">نوع الباقة</th>
                  <th className="px-4 py-3 text-right">الجلسات</th>
                  <th className="px-4 py-3 text-right">المدرب</th>
                  <th className="px-4 py-3 text-right">السعر</th>
                  <th className="px-4 py-3 text-right">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredPackages.map((pkg) => (
                  <tr key={pkg.packageNumber} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-orange-600">#{pkg.packageNumber}</td>
                    <td className="px-4 py-3">{pkg.clientName}</td>
                    <td className="px-4 py-3" dir="ltr">{pkg.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-sm ${
                        pkg.packageType === 'single'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {pkg.packageType === 'single' ? 'جلسة واحدة' : '10 جلسات'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${
                        pkg.sessionsRemaining === 0 ? 'text-red-600' :
                        pkg.sessionsRemaining <= 3 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {pkg.sessionsRemaining} / {pkg.sessionsPurchased}
                      </span>
                    </td>
                    <td className="px-4 py-3">{pkg.instructorName || '-'}</td>
                    <td className="px-4 py-3">{pkg.totalPrice} ج.م</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedPackage(pkg)
                            setShowRegisterModal(true)
                          }}
                          disabled={pkg.sessionsRemaining === 0}
                          className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                        >
                          تسجيل جلسة
                        </button>

                        {pkg.qrCode && (
                          <button
                            onClick={() => {
                              setSelectedPackage(pkg)
                              setShowBarcodeModal(true)
                            }}
                            className="bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 text-sm"
                          >
                            Barcode
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredPackages.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-500">
                لا توجد باقات
              </div>
            )}
          </div>
        )}
      </div>

      {/* Register Session Modal */}
      {showRegisterModal && selectedPackage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">تسجيل جلسة كلاس</h3>

            <div className="mb-4 p-3 bg-orange-50 rounded-lg">
              <p className="text-sm"><span className="font-bold">العميل:</span> {selectedPackage.clientName}</p>
              <p className="text-sm"><span className="font-bold">الجلسات المتبقية:</span> {selectedPackage.sessionsRemaining}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">ملاحظات (اختياري)</label>
              <textarea
                value={registerNotes}
                onChange={(e) => setRegisterNotes(e.target.value)}
                className="w-full px-3 py-2 border-2 rounded-lg"
                rows={3}
                placeholder="أي ملاحظات..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRegisterSession}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
              >
                ✅ تأكيد التسجيل
              </button>
              <button
                onClick={() => {
                  setShowRegisterModal(false)
                  setSelectedPackage(null)
                  setRegisterNotes('')
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Modal */}
      {showBarcodeModal && selectedPackage && selectedPackage.qrCodeImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Barcode - باقة #{selectedPackage.packageNumber}</h3>

            <div className="flex justify-center mb-4">
              <img
                src={selectedPackage.qrCodeImage}
                alt="Barcode"
                className="max-w-full"
              />
            </div>

            <p className="text-center text-sm text-gray-600 mb-4 font-mono">
              {selectedPackage.qrCode}
            </p>

            <button
              onClick={() => {
                setShowBarcodeModal(false)
                setSelectedPackage(null)
              }}
              className="w-full bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
