'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'
import PermissionDenied from '../../components/PermissionDenied'
import { formatDateYMD } from '../../lib/dateFormatter'
import { useConfirm } from '../../hooks/useConfirm'
import ConfirmDialog from '../../components/ConfirmDialog'
import {
  calculatePTPrice,
  getMemberTier,
  formatTierName,
  getAvailableSessionCounts,
  isValidSessionCount,
} from '../../lib/ptPricing'

interface Staff {
  id: string
  name: string
  phone?: string
  position?: string
  isActive: boolean
}

interface PTSession {
  ptNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  coachName: string
  pricePerSession: number
  startDate: string | null
  expiryDate: string | null
  createdAt: string
  subscriptionType?: string | null
  isOnlineCoaching?: boolean
}

interface Member {
  id: string
  memberNumber: number
  name: string
  phone: string
  startDate: string
  expiryDate: string
  subscriptionType: string | null
}

export default function PTPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading, user } = usePermissions()
  const { t, direction } = useLanguage()
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()

  const [sessions, setSessions] = useState<PTSession[]>([])
  const [coaches, setCoaches] = useState<Staff[]>([])
  const [coachEarnings, setCoachEarnings] = useState<any>(null) // ⭐ عمولات المدربين
  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState<PTSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [coachesLoading, setCoachesLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // فلاتر إضافية
  const [filterCoach, setFilterCoach] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring' | 'expired'>('all')
  const [filterSessions, setFilterSessions] = useState<'all' | 'low' | 'zero'>('all')
  const [filterPackage, setFilterPackage] = useState('all')
  const [filterMonth, setFilterMonth] = useState('all')

  // ⭐ States جديدة للبحث عن العضو والتسعير
  const [memberData, setMemberData] = useState<Member | null>(null)
  const [searchingMember, setSearchingMember] = useState(false)
  const [pricingPreview, setPricingPreview] = useState<ReturnType<typeof calculatePTPrice> | null>(null)
  const [searchingById, setSearchingById] = useState(false)

  const [formData, setFormData] = useState({
    ptNumber: '',
    clientName: '',
    phone: '',
    sessionsPurchased: 8,
    coachName: '',
    pricePerSession: 0,
    totalPrice: 0,
    startDate: formatDateYMD(new Date()),
    expiryDate: '',
    paymentMethod: 'cash' as 'cash' | 'visa' | 'instapay',
    staffName: user?.name || '',
    isOnlineCoaching: false,
  })

  useEffect(() => {
    fetchSessions()
    fetchCoaches()
    fetchCoachEarnings()
  }, [])

  useEffect(() => {
    if (user && !formData.staffName) {
      setFormData(prev => ({ ...prev, staffName: user.name }))
    }
  }, [user])

  // ⭐ حساب الأسعار تلقائياً عند تغيير عدد الجلسات أو بيانات العضو (كمعاينة فقط)
  useEffect(() => {
    if (formData.sessionsPurchased && isValidSessionCount(formData.sessionsPurchased)) {
      const memberTier = memberData?.subscriptionType || null
      const pricing = calculatePTPrice(formData.sessionsPurchased as 8 | 12 | 16 | 20 | 24, memberTier)
      setPricingPreview(pricing)

      // تحديث الأسعار في النموذج فقط إذا كانت القيمة الحالية صفر (أي عند أول تحميل أو تغيير الجلسات)
      if (formData.totalPrice === 0 || !editingSession) {
        setFormData(prev => ({
          ...prev,
          totalPrice: pricing.totalPrice,
          pricePerSession: pricing.pricePerSession,
        }))
      }
    }
  }, [formData.sessionsPurchased, memberData])

  // ⭐ دالة الحصول على المستوى من بيانات العضو
  const calculateMemberTier = (member: Member): string | null => {
    // إرجاع subscriptionType مباشرةً من بيانات العضو
    return member.subscriptionType
  }

  // ⭐ دالة البحث عن عضو برقم العضوية
  const searchMemberById = async (memberId: string) => {
    if (!memberId || memberId.length < 1) {
      setMemberData(null)
      return
    }

    setSearchingById(true)
    try {
      const response = await fetch('/api/members')
      const members = await response.json()
      const member = members.find((m: Member) => m.memberNumber?.toString() === memberId)

      if (member) {
        setMemberData(member)
        setFormData(prev => ({
          ...prev,
          clientName: member.name,
          phone: member.phone,
        }))
      } else {
        setMemberData(null)
      }
    } catch (error) {
      console.error('Error searching member by ID:', error)
      setMemberData(null)
    } finally {
      setSearchingById(false)
    }
  }

  // ⭐ دالة البحث عن عضو بالهاتف
  const searchMemberByPhone = async (phone: string) => {
    if (!phone || phone.length < 8) {
      setMemberData(null)
      return
    }

    setSearchingMember(true)
    try {
      const response = await fetch(`/api/members/search?phone=${phone}`)
      if (response.ok) {
        const members = await response.json()
        if (members.length > 0) {
          const member = members[0]
          setMemberData(member)
          setFormData(prev => ({
            ...prev,
            clientName: member.name,
          }))
        } else {
          setMemberData(null)
        }
      }
    } catch (error) {
      console.error('Error searching member:', error)
      setMemberData(null)
    } finally {
      setSearchingMember(false)
    }
  }

  // ⭐ دالة تغيير رقم الهاتف مع البحث
  const handlePhoneChange = (phone: string) => {
    setFormData(prev => ({ ...prev, phone }))
    if (phone.length >= 8) {
      searchMemberByPhone(phone)
    } else {
      setMemberData(null)
    }
  }

  // ⭐ دالة تغيير عدد الجلسات (يحسب السعر تلقائياً)
  const handleSessionCountChange = (count: number) => {
    if (isValidSessionCount(count)) {
      setFormData(prev => ({ ...prev, sessionsPurchased: count }))
    }
  }

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/pt')

      if (response.status === 401) {
        router.push('/login')
        return
      }

      if (response.status === 403) {
        return
      }

      const data = await response.json()
      setSessions(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCoaches = async () => {
    try {
      const response = await fetch('/api/staff')
      const data: Staff[] = await response.json()
      // ✅ عرض جميع الكوتشات (نشطين وغير نشطين) لحسابات الريسبشن
      const allCoaches = data.filter(
        (staff) => staff.position?.toLowerCase().includes('مدرب')
      )
      setCoaches(allCoaches)
    } catch (error) {
      console.error('Error fetching coaches:', error)
    } finally {
      setCoachesLoading(false)
    }
  }

  // ⭐ دالة جلب عمولات المدربين
  const fetchCoachEarnings = async () => {
    try {
      const response = await fetch('/api/pt/coach-earnings')
      if (response.ok) {
        const data = await response.json()
        setCoachEarnings(data)
      }
    } catch (error) {
      console.error('Error fetching coach earnings:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      ptNumber: '',
      clientName: '',
      phone: '',
      sessionsPurchased: 8,
      coachName: '',
      pricePerSession: 0,
      totalPrice: 0,
      startDate: formatDateYMD(new Date()),
      expiryDate: '',
      paymentMethod: 'cash',
      staffName: user?.name || '',
      isOnlineCoaching: false,
    })
    setMemberData(null)
    setPricingPreview(null)
    setEditingSession(null)
    setShowForm(false)
  }

  // دالة لتحديث السعر الإجمالي عند تغيير سعر الحصة أو عدد الحصص
  const handlePricePerSessionChange = (value: number) => {
    // تقريب لأقرب رقمين عشريين لتجنب مشاكل floating point
    const roundedValue = Math.round(value * 100) / 100
    const totalPrice = Math.round(roundedValue * formData.sessionsPurchased * 100) / 100
    setFormData({ ...formData, pricePerSession: roundedValue, totalPrice })
  }

  // دالة لتحديث سعر الحصة عند تغيير السعر الإجمالي
  const handleTotalPriceChange = (value: number) => {
    // تقريب لأقرب رقمين عشريين
    const roundedValue = Math.round(value * 100) / 100
    const pricePerSession = formData.sessionsPurchased > 0
      ? Math.round((roundedValue / formData.sessionsPurchased) * 100) / 100
      : 0
    setFormData({ ...formData, totalPrice: roundedValue, pricePerSession })
  }

  // دالة لتحديث عدد الحصص وإعادة حساب الأسعار
  const handleSessionsChange = (value: number) => {
    const pricePerSession = value > 0
      ? Math.round((formData.totalPrice / value) * 100) / 100
      : 0
    setFormData({ ...formData, sessionsPurchased: value, pricePerSession })
  }

  const calculateExpiryFromMonths = (months: number) => {
    if (!formData.startDate) return

    // ✅ فرض شهر واحد فقط
    if (months !== 1) {
      console.warn('⚠️ PT subscriptions: Only 1-month duration allowed')
      return
    }

    const start = new Date(formData.startDate)
    const expiry = new Date(start)
    expiry.setMonth(expiry.getMonth() + 1) // دائماً شهر واحد

    setFormData(prev => ({
      ...prev,
      expiryDate: formatDateYMD(expiry)
    }))
  }

  // ✅ حساب تلقائي عند تغيير startDate
  const handleStartDateChange = (startDate: string) => {
    setFormData(prev => ({ ...prev, startDate }))

    if (startDate && startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const start = new Date(startDate)
      const expiry = new Date(start)
      expiry.setMonth(expiry.getMonth() + 1)
      setFormData(prev => ({ ...prev, expiryDate: formatDateYMD(expiry) }))
    }
  }

  const handleEdit = (session: PTSession) => {
    const totalPrice = session.sessionsPurchased * session.pricePerSession
    setFormData({
      ptNumber: session.ptNumber.toString(),
      clientName: session.clientName,
      phone: session.phone,
      sessionsPurchased: session.sessionsPurchased,
      coachName: session.coachName,
      pricePerSession: session.pricePerSession,
      totalPrice: totalPrice,
      startDate: session.startDate ? formatDateYMD(session.startDate) : '',
      expiryDate: session.expiryDate ? formatDateYMD(session.expiryDate) : '',
      paymentMethod: 'cash',
      staffName: user?.name || '',
      isOnlineCoaching: session.isOnlineCoaching || false,
    })
    setEditingSession(session)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const url = '/api/pt'
      const method = editingSession ? 'PUT' : 'POST'
      const body = editingSession
        ? { ptNumber: editingSession.ptNumber, ...formData, staffName: user?.name || '' }
        : { ...formData, staffName: user?.name || '' }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (response.ok) {
        setMessage(editingSession ? t('pt.messages.sessionUpdated') : t('pt.messages.sessionAdded'))
        setTimeout(() => setMessage(''), 3000)
        fetchSessions()
        resetForm()
      } else {
        setMessage(`${t('pt.messages.operationFailed')} - ${result.error || ''}`)
      }
    } catch (error) {
      console.error(error)
      setMessage(t('pt.messages.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (ptNumber: number) => {
    const confirmed = await confirm({
      title: t('pt.deleteConfirm.title'),
      message: t('pt.deleteConfirm.message', { ptNumber: ptNumber.toString() }),
      confirmText: t('pt.deleteConfirm.confirm'),
      cancelText: t('pt.deleteConfirm.cancel'),
      type: 'danger'
    })

    if (!confirmed) return

    try {
      const response = await fetch(`/api/pt?ptNumber=${ptNumber}`, { method: 'DELETE' })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('pt.messages.deleteFailed'))
      }

      setMessage(t('pt.messages.sessionDeleted'))
      fetchSessions()
    } catch (error: any) {
      console.error('Error:', error)
      setMessage(`${t('pt.messages.deleteFailed')} - ${error.message || ''}`)
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const handleRenew = (session: PTSession) => {
    router.push(`/pt/renew?ptNumber=${session.ptNumber}`)
  }

  const handleRegisterSession = (session: PTSession) => {
    router.push(`/pt/sessions/register?ptNumber=${session.ptNumber}`)
  }

  const filteredSessions = sessions.filter((session) => {
    // البحث النصي
    const matchesSearch =
      session.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.coachName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.ptNumber.toString().includes(searchTerm) ||
      session.phone.includes(searchTerm)

    // فلتر المدرب
    const matchesCoach = filterCoach === '' || session.coachName === filterCoach

    // فلتر الحالة
    let matchesStatus = true
    if (filterStatus !== 'all') {
      const isExpired = session.expiryDate && new Date(session.expiryDate) < new Date()
      const isExpiringSoon =
        session.expiryDate &&
        new Date(session.expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
        !isExpired

      if (filterStatus === 'expired') matchesStatus = isExpired
      else if (filterStatus === 'expiring') matchesStatus = isExpiringSoon
      else if (filterStatus === 'active') matchesStatus = !isExpired && !isExpiringSoon
    }

    // فلتر الجلسات
    let matchesSessions = true
    if (filterSessions === 'zero') matchesSessions = session.sessionsRemaining === 0
    else if (filterSessions === 'low') matchesSessions = session.sessionsRemaining > 0 && session.sessionsRemaining <= 3

    // فلتر الباقة (حسب عدد الجلسات)
    const matchesPackage =
      filterPackage === 'all' ||
      session.sessionsPurchased.toString() === filterPackage

    // فلتر الشهر (حسب تاريخ الإنشاء)
    let matchesMonth = true
    if (filterMonth !== 'all' && session.createdAt) {
      const createdDate = new Date(session.createdAt)
      const createdMonth = createdDate.getMonth() + 1 // 1-12
      matchesMonth = createdMonth.toString() === filterMonth
    }

    return matchesSearch && matchesCoach && matchesStatus && matchesSessions && matchesPackage && matchesMonth
  })

  const totalSessions = sessions.reduce((sum, s) => sum + s.sessionsPurchased, 0)
  const remainingSessions = sessions.reduce((sum, s) => sum + s.sessionsRemaining, 0)
  const activePTs = sessions.filter((s) => s.sessionsRemaining > 0).length

  // ✅ التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">{t('pt.loading')}</div>
      </div>
    )
  }

  if (!hasPermission('canViewPT')) {
    return <PermissionDenied message={t('pt.noPermission')} />
  }

  const isCoach = user?.role === 'COACH'

  return (
    <div className="container mx-auto p-4 sm:p-6" dir={direction}>
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">💪 {t('pt.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600">
            {isCoach ? t('pt.viewSessions') : t('pt.manageSessions')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => router.push('/pt/commission')}
            className="flex-1 min-w-[140px] sm:flex-none bg-gradient-to-r from-purple-600 to-purple-700 text-white px-3 sm:px-6 py-2 rounded-lg hover:from-purple-700 hover:to-purple-800 transition shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span>💰</span>
            <span>{t('pt.commissionCalculator')}</span>
          </button>
          <button
            onClick={() => router.push('/pt/sessions/history')}
            className="flex-1 min-w-[140px] sm:flex-none bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-3 sm:px-6 py-2 rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span>📊</span>
            <span>{t('pt.attendanceLog')}</span>
          </button>
          {!isCoach && (
            <button
              onClick={() => {
                resetForm()
                setShowForm(!showForm)
              }}
              className="w-full sm:w-auto bg-orange-600 text-white px-3 sm:px-6 py-2 rounded-lg hover:bg-orange-700 transition flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {showForm ? t('pt.hideForm') : `➕ ${t('pt.addNewSession')}`}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message}
        </div>
      )}

      {!isCoach && showForm && (
        <div className="bg-white p-6 rounded-xl shadow-lg mb-6 border-2 border-orange-100">
          <h2 className="text-xl font-semibold mb-4">
            {editingSession ? t('pt.editSession') : t('pt.addSession')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Online Coaching Checkbox */}
            {!editingSession && (
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isOnlineCoaching}
                    onChange={(e) => {
                      setFormData({ ...formData, isOnlineCoaching: e.target.checked, ptNumber: '' })
                      if (e.target.checked) {
                        setMemberData(null)
                      }
                    }}
                    className="w-5 h-5 text-blue-600"
                  />
                  <span className="text-sm font-semibold text-blue-800">
                    💻 Online Coaching (No PT Number Required)
                  </span>
                </label>
                {formData.isOnlineCoaching && (
                  <p className="text-xs text-blue-600 mt-1">
                    ℹ️ عند تفعيل Online Coaching، لا يتطلب رقم PT ولن يتم ربطه بعضو معين
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!formData.isOnlineCoaching && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium">
                      {t('pt.ptId')} / رقم العضوية <span className="text-red-600">*</span>
                    </label>
                    {memberData && !editingSession && (
                      <button
                        type="button"
                        onClick={() => {
                          setMemberData(null)
                          setFormData(prev => ({ ...prev, ptNumber: '', clientName: '', phone: '' }))
                        }}
                        className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                      >
                        ✕ مسح
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    required={!formData.isOnlineCoaching}
                    disabled={!!editingSession}
                    value={formData.ptNumber}
                    onChange={(e) => {
                      const value = e.target.value
                      setFormData({ ...formData, ptNumber: value })
                      // البحث التلقائي عن العضو إذا كان رقم PT جديد
                      if (!editingSession && value) {
                        searchMemberById(value)
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100"
                    placeholder="رقم PT الجديد أو رقم عضوية موجود"
                  />
                {searchingById && !editingSession && (
                  <p className="text-xs text-orange-600 mt-1">🔍 جاري البحث عن العضو...</p>
                )}
                {memberData && !editingSession && (
                  <div className="mt-2 p-3 bg-green-50 border-2 border-green-300 rounded-lg">
                    <p className="text-sm text-green-700 font-semibold">✅ عضو موجود - تم التعبئة التلقائية</p>
                    <div className="mt-2 space-y-1 text-xs">
                      <p><span className="font-semibold">الاسم:</span> {memberData.name}</p>
                      <p><span className="font-semibold">الهاتف:</span> {memberData.phone}</p>
                      {memberData.subscriptionType && (
                        <p><span className="font-semibold">الباقة:</span> {memberData.subscriptionType}</p>
                      )}
                    </div>
                  </div>
                )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pt.clientName')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder={t('pt.clientNamePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pt.phoneNumber')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder={t('pt.phonePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pt.coachName')} <span className="text-red-600">*</span>
                </label>
                {coachesLoading ? (
                  <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500">
                    {t('pt.loadingCoaches')}
                  </div>
                ) : coaches.length === 0 ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      required
                      value={formData.coachName}
                      onChange={(e) => setFormData({ ...formData, coachName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder={t('pt.coachNamePlaceholder')}
                    />
                    <p className="text-xs text-amber-600">
                      ⚠️ {t('pt.noActiveCoaches')}
                    </p>
                  </div>
                ) : (
                  <select
                    required
                    value={formData.coachName}
                    onChange={(e) => setFormData({ ...formData, coachName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="">{t('pt.selectCoach')}</option>
                    {coaches.map((coach) => (
                      <option key={coach.id} value={coach.name}>
                        {coach.name} {coach.phone && `(${coach.phone})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('pt.sessionsCount')} <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {getAvailableSessionCounts().map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => handleSessionCountChange(count)}
                      className={`px-3 py-2 rounded-lg border-2 font-semibold transition-all ${
                        formData.sessionsPurchased === count
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">اختر عدد الجلسات من الباقات المتاحة</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pt.totalPrice')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.totalPrice}
                  onChange={(e) => handleTotalPriceChange(parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      e.preventDefault()
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg font-bold"
                  placeholder={t('pt.totalPricePlaceholder')}
                />
                <p className="text-xs text-gray-500 mt-1">
                  السعر الإجمالي للباقة (يمكن التعديل يدوياً)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pt.pricePerSession')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.pricePerSession}
                  onChange={(e) => handlePricePerSessionChange(parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      e.preventDefault()
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg font-semibold"
                  placeholder={t('pt.pricePerSessionPlaceholder')}
                />
                <p className="text-xs text-gray-500 mt-1">
                  سعر الجلسة الواحدة (يمكن التعديل يدوياً)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pt.startDate')} <span className="text-xs text-gray-500">{t('pt.startDateFormat')}</span>
                </label>
                <input
                  type="text"
                  value={formData.startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg font-mono"
                  placeholder={t('pt.startDatePlaceholder')}
                  pattern="\d{4}-\d{2}-\d{2}"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pt.expiryDate')}
                  <span className="text-xs text-green-600 font-semibold"> (محسوب تلقائياً: 1 شهر)</span>
                </label>
                <input
                  type="text"
                  value={formData.expiryDate}
                  readOnly
                  className="w-full px-3 py-2 border-2 border-green-300 bg-green-50 rounded-lg font-mono font-semibold text-green-800"
                  placeholder={t('pt.expiryDatePlaceholder')}
                />
                <p className="text-xs text-gray-500 mt-1">
                  ⚠️ تاريخ الانتهاء يتم حسابه تلقائياً بعد شهر واحد من تاريخ البدء
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">⚡ {t('pt.quickAdd')}:</p>
              <button
                type="button"
                onClick={() => calculateExpiryFromMonths(1)}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm transition font-bold"
              >
                ✅ + 1 {t('pt.month')} (مدة ثابتة)
              </button>
              <p className="text-xs text-gray-500 mt-2">
                ℹ️ اشتراكات البرايفت متاحة لمدة شهر واحد فقط
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('pt.paymentMethod')}</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    paymentMethod: e.target.value as 'cash' | 'visa' | 'instapay',
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="cash">{t('pt.cash')}</option>
                <option value="visa">{t('pt.visa')}</option>
                <option value="instapay">{t('pt.instapay')}</option>
              </select>
            </div>

            {pricingPreview && formData.sessionsPurchased > 0 && (
              <div className="bg-gradient-to-r from-orange-50 to-green-50 border-2 border-orange-200 rounded-lg p-4">
                <h3 className="text-lg font-bold text-orange-900 mb-3">💰 ملخص الأسعار</h3>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">السعر الأساسي</span>
                    <span className="font-semibold text-gray-800">
                      {pricingPreview.basePrice.toFixed(0)} {t('pt.egp')}
                    </span>
                  </div>

                  {pricingPreview.discountAmount > 0 && (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-orange-600">الخصم ({pricingPreview.discountPercent}%)</span>
                        <span className="font-semibold text-orange-600">
                          - {pricingPreview.discountAmount.toFixed(0)} {t('pt.egp')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-green-700 font-medium">المبلغ الموفر</span>
                        <span className="font-bold text-green-700">
                          🎉 {pricingPreview.discountAmount.toFixed(0)} {t('pt.egp')}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="border-t-2 border-orange-300 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-orange-900">{t('pt.finalTotal')}</span>
                      <span className="text-2xl font-bold text-orange-600">
                        {formData.totalPrice.toFixed(0)} {t('pt.egp')}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-sm bg-white bg-opacity-50 rounded p-2">
                    <span className="text-gray-700">{t('pt.pricePerSessionSingle')}</span>
                    <span className="font-semibold text-gray-900">
                      {formData.pricePerSession.toFixed(0)} {t('pt.egp')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center mt-2 text-sm border-t pt-2">
                    <span className="font-semibold text-orange-700">{t('pt.paidAmount')}</span>
                    <span className="font-bold text-orange-600">
                      {formData.totalPrice.toFixed(0)} {t('pt.egp')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:bg-gray-400"
              >
                {loading ? t('pt.saving') : editingSession ? t('pt.updateButton') : t('pt.addSessionButton')}
              </button>
              {editingSession && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  {t('pt.cancelButton')}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm mb-1">{t('pt.totalSessions')}</p>
              <p className="text-4xl font-bold">{totalSessions}</p>
            </div>
            <div className="text-5xl opacity-20">💪</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm mb-1">{t('pt.remainingSessions')}</p>
              <p className="text-4xl font-bold">{remainingSessions}</p>
            </div>
            <div className="text-5xl opacity-20">⏳</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm mb-1">{t('pt.activePTs')}</p>
              <p className="text-4xl font-bold">{activePTs}</p>
            </div>
            <div className="text-5xl opacity-20">🔥</div>
          </div>
        </div>

        {/* ⭐ بطاقة عمولات التسجيل */}
        {coachEarnings && (
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-6 shadow-lg">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <p className="text-orange-100 text-sm mb-1">{t('pt.coachRegistrationEarnings')}</p>
                  <p className="text-3xl font-bold">{coachEarnings.grandTotal.toLocaleString()} {t('common.currency')}</p>
                  <p className="text-xs text-orange-100 mt-1">
                    {coachEarnings.coachEarnings.reduce((sum: number, c: any) => sum + c.memberCount, 0)} {t('pt.membersRegistered')}
                  </p>
                </div>
                <div className="text-5xl opacity-20">💰</div>
              </div>

              {/* تفاصيل المدربين (قابلة للتوسيع) */}
              <details className="mt-auto">
                <summary className="cursor-pointer text-sm text-orange-100 hover:text-white flex items-center gap-2 mt-2">
                  <span>📊</span>
                  <span>{t('pt.viewCoachDetails')}</span>
                </summary>
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {coachEarnings.coachEarnings.map((coach: any) => (
                    <div
                      key={coach.coachId}
                      className="text-sm bg-orange-700/40 rounded-lg p-2 flex justify-between items-center"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">{coach.coachName}</div>
                        <div className="text-xs text-orange-100 mt-1">
                          {coach.memberCount} {t('pt.perMember')}
                        </div>
                      </div>
                      <div className="text-lg font-bold">
                        {coach.totalEarnings.toLocaleString()} {t('common.currency')}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="mb-4">
          <input
            type="text"
            placeholder={`🔍 ${t('pt.searchPlaceholder')}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border-2 rounded-lg text-lg"
          />
        </div>

        {/* الفلاتر */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* فلتر المدرب */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('pt.filterByCoach')}</label>
            <select
              value={filterCoach}
              onChange={(e) => setFilterCoach(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg"
            >
              <option value="">{t('pt.allCoaches')}</option>
              {Array.from(new Set(sessions.map(s => s.coachName))).sort().map(coach => (
                <option key={coach} value={coach}>{coach}</option>
              ))}
            </select>
          </div>

          {/* فلتر الحالة */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('pt.filterByStatus')}</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 border-2 rounded-lg"
            >
              <option value="all">{t('pt.allStatus')}</option>
              <option value="active">{t('pt.statusActive')}</option>
              <option value="expiring">{t('pt.statusExpiring')}</option>
              <option value="expired">{t('pt.statusExpired')}</option>
            </select>
          </div>

          {/* فلتر الجلسات */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('pt.filterBySessions')}</label>
            <select
              value={filterSessions}
              onChange={(e) => setFilterSessions(e.target.value as any)}
              className="w-full px-3 py-2 border-2 rounded-lg"
            >
              <option value="all">{t('pt.allSessions')}</option>
              <option value="low">{t('pt.sessionsLow')}</option>
              <option value="zero">{t('pt.sessionsZero')}</option>
            </select>
          </div>

          {/* فلتر الباقة */}
          <div>
            <label className="block text-sm font-medium mb-1.5">🎁 {t('pt.packageFilter')}</label>
            <select
              value={filterPackage}
              onChange={(e) => setFilterPackage(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg"
            >
              <option value="all">{t('pt.allPackages')}</option>
              <option value="8">8 - {t('pt.sessions8')}</option>
              <option value="12">12 - {t('pt.sessions12')}</option>
              <option value="16">16 - {t('pt.sessions16')}</option>
              <option value="20">20 - {t('pt.sessions20')}</option>
              <option value="24">24 - {t('pt.sessions24')}</option>
            </select>
          </div>

          {/* فلتر الشهر */}
          <div>
            <label className="block text-sm font-medium mb-1.5">📅 {t('pt.monthFilter')}</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg"
            >
              <option value="all">{t('pt.allMonths')}</option>
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
        {(filterCoach || filterStatus !== 'all' || filterSessions !== 'all' || filterPackage !== 'all' || filterMonth !== 'all') && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                setFilterCoach('')
                setFilterStatus('all')
                setFilterSessions('all')
                setFilterPackage('all')
                setFilterMonth('all')
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
            >
              🔄 {t('pt.resetFilters')}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">{t('pt.loading')}</div>
      ) : (
        <>
          {/* Desktop Table - Hidden on mobile/tablet */}
          <div className="hidden lg:block bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-right">{t('pt.ptNumber')}</th>
                    <th className="px-4 py-3 text-right">{t('pt.client')}</th>
                    <th className="px-4 py-3 text-right">{t('pt.coach')}</th>
                    <th className="px-4 py-3 text-right">{t('pt.sessions')}</th>
                    <th className="px-4 py-3 text-right">{t('pt.total')}</th>
                    <th className="px-4 py-3 text-right">{t('pt.dates')}</th>
                    {!isCoach && <th className="px-4 py-3 text-right">{t('pt.actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session) => {
                    const isExpiringSoon =
                      session.expiryDate &&
                      new Date(session.expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    const isExpired = session.expiryDate && new Date(session.expiryDate) < new Date()

                    return (
                      <tr
                        key={session.ptNumber}
                        className={`border-t hover:bg-gray-50 ${
                          isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-bold text-orange-600">#{session.ptNumber}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold">{session.clientName}</p>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {session.subscriptionType && (
                                <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {session.subscriptionType}
                                </span>
                              )}
                              {session.isOnlineCoaching && (
                                <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-100 text-cyan-800">
                                  💻 Online
                                </span>
                              )}
                            </div>
                            <a
                              href={`https://wa.me/+20${session.phone.startsWith('0') ? session.phone.substring(1) : session.phone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-green-600 hover:text-green-700 hover:underline font-medium block mt-1"
                            >
                              {session.phone}
                            </a>
                          </div>
                        </td>
                        <td className="px-4 py-3">{session.coachName}</td>
                        <td className="px-4 py-3">
                          <div className="text-center">
                            <p
                              className={`font-bold ${
                                session.sessionsRemaining === 0
                                  ? 'text-red-600'
                                  : session.sessionsRemaining <= 3
                                  ? 'text-orange-600'
                                  : 'text-green-600'
                              }`}
                            >
                              {session.sessionsRemaining}
                            </p>
                            <p className="text-xs text-gray-500">{t('pt.of')} {session.sessionsPurchased}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-green-600">
                          {(session.sessionsPurchased * session.pricePerSession).toFixed(0)} {t('pt.egp')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-mono">
                            {session.startDate && (
                              <p>{t('pt.from')} {formatDateYMD(session.startDate)}</p>
                            )}
                            {session.expiryDate && (
                              <p className={isExpired ? 'text-red-600 font-bold' : ''}>
                                {t('pt.to')} {formatDateYMD(session.expiryDate)}
                              </p>
                            )}
                            {isExpired && <p className="text-red-600 font-bold">{t('pt.expired')}</p>}
                            {!isExpired && isExpiringSoon && (
                              <p className="text-orange-600 font-bold">{t('pt.expiringSoon')}</p>
                            )}
                          </div>
                        </td>
                        {!isCoach && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => handleRegisterSession(session)}
                                disabled={session.sessionsRemaining === 0}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                              >
                                {t('pt.attendance')}
                              </button>
                              <button
                                onClick={() => handleRenew(session)}
                                className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                              >
                                {t('pt.renew')}
                              </button>
                              <button
                                onClick={() => handleDelete(session.ptNumber)}
                                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 flex items-center gap-1"
                              >
                                {t('pt.delete')}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile/Tablet Cards - Hidden on desktop */}
          <div className="lg:hidden space-y-3">
            {filteredSessions.map((session) => {
              const isExpiringSoon =
                session.expiryDate &&
                new Date(session.expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              const isExpired = session.expiryDate && new Date(session.expiryDate) < new Date()

              return (
                <div
                  key={session.ptNumber}
                  className={`bg-white rounded-xl shadow-md overflow-hidden border-2 hover:shadow-lg transition ${
                    isExpired ? 'border-red-300 bg-red-50' : isExpiringSoon ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  {/* Header */}
                  <div className={`p-2.5 ${isExpired ? 'bg-red-600' : isExpiringSoon ? 'bg-orange-600' : 'bg-gradient-to-r from-purple-600 to-purple-700'}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-bold text-white">#{session.ptNumber}</div>
                      <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        session.sessionsRemaining === 0 ? 'bg-red-500' : session.sessionsRemaining <= 3 ? 'bg-orange-500' : 'bg-green-500'
                      } text-white`}>
                        {session.sessionsRemaining} / {session.sessionsPurchased} {t('pt.session')}
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3 space-y-2.5">
                    {/* Client Info */}
                    <div className="pb-2.5 border-b-2 border-gray-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">👤</span>
                        <span className="text-xs text-gray-500 font-semibold">{t('pt.client')}</span>
                      </div>
                      <div className="text-base font-bold text-gray-800">{session.clientName}</div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {session.subscriptionType && (
                          <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {session.subscriptionType}
                          </span>
                        )}
                        {session.isOnlineCoaching && (
                          <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-100 text-cyan-800">
                            💻 Online
                          </span>
                        )}
                      </div>
                      <a
                        href={`https://wa.me/+20${session.phone.startsWith('0') ? session.phone.substring(1) : session.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono text-green-600 hover:text-green-700 hover:underline mt-1 block font-medium"
                      >
                        {session.phone}
                      </a>
                    </div>

                    {/* Coach */}
                    <div className="pb-2.5 border-b-2 border-gray-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">🏋️</span>
                        <span className="text-xs text-gray-500 font-semibold">{t('pt.coach')}</span>
                      </div>
                      <div className="text-base font-bold text-gray-800">{session.coachName}</div>
                    </div>

                    {/* Total Price */}
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-sm">💵</span>
                        <span className="text-xs text-green-700 font-semibold">{t('pt.total')}</span>
                      </div>
                      <div className="text-base font-bold text-green-600">
                        {(session.sessionsPurchased * session.pricePerSession).toFixed(0)} {t('pt.egp')}
                      </div>
                    </div>

                    {/* Dates */}
                    {(session.startDate || session.expiryDate) && (
                      <div className={`border-2 rounded-lg p-2.5 ${
                        isExpired ? 'bg-red-50 border-red-300' : isExpiringSoon ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">📅</span>
                          <span className={`text-xs font-semibold ${
                            isExpired ? 'text-red-700' : isExpiringSoon ? 'text-orange-700' : 'text-gray-700'
                          }`}>{t('pt.period')}</span>
                        </div>
                        <div className="space-y-1 text-xs font-mono">
                          {session.startDate && (
                            <div className="text-gray-700">{t('pt.from')} {formatDateYMD(session.startDate)}</div>
                          )}
                          {session.expiryDate && (
                            <div className={isExpired ? 'text-red-600 font-bold' : 'text-gray-700'}>
                              {t('pt.to')} {formatDateYMD(session.expiryDate)}
                            </div>
                          )}
                          {isExpired && (
                            <div className="text-red-600 font-bold">{t('pt.expired')}</div>
                          )}
                          {!isExpired && isExpiringSoon && (
                            <div className="text-orange-600 font-bold">{t('pt.expiringSoon')}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!isCoach && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handleRegisterSession(session)}
                          disabled={session.sessionsRemaining === 0}
                          className="bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-1"
                        >
                          {t('pt.attendance')}
                        </button>
                        <button
                          onClick={() => handleRenew(session)}
                          className="bg-purple-600 text-white py-2 rounded-lg text-sm hover:bg-purple-700 font-bold flex items-center justify-center gap-1"
                        >
                          {t('pt.renew')}
                        </button>
                        <button
                          onClick={() => handleDelete(session.ptNumber)}
                          className="bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700 font-bold flex items-center justify-center gap-1 col-span-2"
                        >
                          <span>🗑️</span>
                          <span>{t('pt.deleteSubscription')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {filteredSessions.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-xl">{searchTerm ? t('pt.noSearchResults') : t('pt.noSessions')}</p>
            </div>
          )}
        </>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        type={options.type}
      />
    </div>
  )
}