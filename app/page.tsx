// app/page.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useLanguage } from '../contexts/LanguageContext'

export default function HomePage() {
  const router = useRouter()
  const { t, locale, direction } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  
  const [stats, setStats] = useState({
    members: 0,
    activePT: 0,
    todayRevenue: 0,
    totalReceipts: 0,
    todayCheckIns: 0,
  })

  const [revenueChartData, setRevenueChartData] = useState<any[]>([])
  const [attendanceChartData, setAttendanceChartData] = useState<any[]>([])
  const [receiptsData, setReceiptsData] = useState<any[]>([])
  const [retentionData, setRetentionData] = useState<{ rate: number; expired: number; renewed: number } | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  // إعادة تحميل البيانات عند تغيير اللغة
  useEffect(() => {
    if (user) {
      fetchStats()
    }
  }, [locale])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)

        // إذا كان المستخدم مدرب، يوجه لصفحته الخاصة
        if (data.user.role === 'COACH') {
          router.push('/coach')
          return
        }

        fetchStats()
      } else {
        // لو مش مسجل دخول، يروح على صفحة اللوجن
        router.push('/login')
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      // جلب الأعضاء
      const membersRes = await fetch('/api/members')
      const members = await membersRes.json()

      // جلب جلسات PT
      const ptRes = await fetch('/api/pt')
      const ptSessions = await ptRes.json()

      // جلب الإيصالات
      const receiptsRes = await fetch('/api/receipts')
      const receipts = await receiptsRes.json()

      // جلب إحصائيات الحضور
      const statsRes = await fetch('/api/member-checkin/stats')
      const statsData = await statsRes.json()

      // حساب إيرادات اليوم
      const today = new Date().toDateString()
      const todayReceipts = receipts.filter((r: any) => {
        return new Date(r.createdAt).toDateString() === today
      })
      const todayRevenue = todayReceipts.reduce((sum: number, r: any) => sum + r.amount, 0)

      // حساب PT النشطة
      const activePT = ptSessions.filter((pt: any) => pt.sessionsRemaining > 0).length

      setStats({
        members: Array.isArray(members) ? members.length : 0,
        activePT,
        todayRevenue,
        totalReceipts: receipts.length,
        todayCheckIns: statsData.stats?.totalCheckIns || 0,
      })

      // 📊 تجهيز بيانات جراف الإيرادات (آخر 14 يوم)
      const last14Days = []
      for (let i = 13; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
        const dateKey = date.toDateString()

        const dayReceipts = receipts.filter((r: any) => {
          return new Date(r.createdAt).toDateString() === dateKey
        })
        const dayRevenue = dayReceipts.reduce((sum: number, r: any) => sum + r.amount, 0)
        const dayCount = dayReceipts.length

        last14Days.push({
          date: dateStr,
          fullDate: date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US'),
          revenue: dayRevenue,
          count: dayCount
        })
      }
      setRevenueChartData(last14Days)
      setReceiptsData(receipts)

      // 📊 تجهيز بيانات جراف الحضور (آخر 24 ساعة)
      const now = new Date()
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const historyRes = await fetch(`/api/member-checkin/history?startDate=${last24Hours.toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}`)
      const historyData = await historyRes.json()

      // تقسيم آخر 24 ساعة إلى فترات (كل 2 ساعة)
      const hourlyData: any[] = []
      for (let i = 0; i < 12; i++) {
        const slotStart = new Date(last24Hours.getTime() + i * 2 * 60 * 60 * 1000)
        const slotEnd = new Date(slotStart.getTime() + 2 * 60 * 60 * 1000)

        const slotCheckIns = historyData.checkIns?.filter((c: any) => {
          const checkInTime = new Date(c.checkInTime)
          return checkInTime >= slotStart && checkInTime < slotEnd
        }) || []

        hourlyData.push({
          time: slotStart.toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          fullTime: slotStart.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US'),
          attendance: slotCheckIns.length
        })
      }
      setAttendanceChartData(hourlyData)

      // 📈 جلب معدل الاستمرارية
      try {
        const retentionRes = await fetch('/api/admin/retention')
        if (retentionRes.ok) {
          const retentionJson = await retentionRes.json()
          setRetentionData(retentionJson.current)
        }
      } catch { /* non-critical */ }

    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleLogout = async () => {
    if (!confirm(t('dashboard.confirmLogout'))) return

    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  // مكون Tooltip مخصص للإيرادات
  const CustomRevenueTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-xl border-2 border-orange-600">
          <p className="font-bold text-gray-800 mb-2">{payload[0].payload.fullDate}</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
            <p className="text-sm text-gray-600">
              {t('dashboard.revenue')}: <span className="font-bold text-orange-700">{payload[0].value.toLocaleString()}</span> {t('members.egp')}
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {t('receipts.stats.todayReceipts')}: {payload[0].payload.count}
          </p>
        </div>
      )
    }
    return null
  }

  // مكون Tooltip مخصص للحضور
  const CustomAttendanceTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-xl border-2 border-green-500">
          <p className="font-bold text-gray-800 mb-2">{payload[0].payload.fullTime}</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <p className="text-sm text-gray-600">
              {t('dashboard.attendance')}: <span className="font-bold text-green-600">{payload[0].value}</span> {t('members.members')}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  // لو لسه بيتحقق من الـ Authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">⏳</div>
          <p className="text-xl text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6" dir={direction}>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{t('dashboard.welcome', { name: user?.name })} 👋</h1>
        <p className="text-gray-600">{t('dashboard.welcomeMessage')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">{t('dashboard.totalMembers')}</p>
              <p className="text-3xl font-bold">{stats.members}</p>
            </div>
            <div className="text-4xl">👥</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">{t('dashboard.activePTSessions')}</p>
              <p className="text-3xl font-bold">{stats.activePT}</p>
            </div>
            <div className="text-4xl">💪</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">{t('dashboard.todayRevenue')}</p>
              <p className="text-3xl font-bold">{stats.todayRevenue.toFixed(0)}</p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">{t('dashboard.totalReceipts')}</p>
              <p className="text-3xl font-bold">{stats.totalReceipts}</p>
            </div>
            <div className="text-4xl">🧾</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-lg shadow-md border-2 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-800 text-sm font-semibold">{t('dashboard.todayAttendance')}</p>
              <p className="text-3xl font-bold text-orange-900">{stats.todayCheckIns}</p>
            </div>
            <div className="text-4xl">📊</div>
          </div>
        </div>

        {retentionData !== null && (
          <div className={`p-6 rounded-lg shadow-md border-2 ${
            retentionData.rate >= 70 ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-500' :
            retentionData.rate >= 40 ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-500' :
            'bg-gradient-to-br from-red-50 to-red-100 border-red-500'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700">معدل الاستمرارية</p>
                <p className="text-3xl font-bold">{retentionData.rate}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {retentionData.renewed} من {retentionData.expired} جددوا (آخر 30 يوم)
                </p>
              </div>
              <div className="text-4xl">
                {retentionData.rate >= 70 ? '🔥' : retentionData.rate >= 40 ? '📈' : '📉'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 📊 الجرافات - إيرادات وحضور */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-8">
        {/* جراف الإيرادات - 30% */}
        <div className="lg:col-span-3">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-2xl shadow-xl border-2 border-orange-300 hover:shadow-2xl transition-shadow duration-300 h-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-2xl">💰</span>
                  <span>{t('dashboard.revenueLast14Days')}</span>
                </h2>
                <p className="text-xs text-gray-600 mt-1">{t('dashboard.revenueChartSubtitle')}</p>
              </div>
            </div>
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={revenueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ea580c" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#ea580c" stopOpacity={0.6}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.5} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    style={{ fontSize: '10px', fontWeight: 600 }}
                    tick={{ fill: '#475569' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    stroke="#64748b"
                    style={{ fontSize: '10px', fontWeight: 600 }}
                    tick={{ fill: '#475569' }}
                  />
                  <Tooltip content={<CustomRevenueTooltip />} />
                  <Bar
                    dataKey="revenue"
                    fill="url(#revenueBarGradient)"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px]">
                <div className="text-5xl mb-4 animate-pulse">📊</div>
                <p className="text-gray-400 font-semibold text-sm">{t('dashboard.loadingData')}</p>
              </div>
            )}
          </div>
        </div>

        {/* جراف الحضور - 70% */}
        <div className="lg:col-span-7">
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl shadow-xl border-2 border-green-300 hover:shadow-2xl transition-shadow duration-300 h-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-3xl">📊</span>
                  <span>{t('dashboard.attendanceLast24Hours')}</span>
                </h2>
                <p className="text-sm text-gray-600 mt-1">{t('dashboard.attendanceChartSubtitle')}</p>
              </div>
            </div>
            {attendanceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={attendanceChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.5} />
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    style={{ fontSize: '12px', fontWeight: 600 }}
                    tick={{ fill: '#475569' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    style={{ fontSize: '12px', fontWeight: 600 }}
                    tick={{ fill: '#475569' }}
                  />
                  <Tooltip content={<CustomAttendanceTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="attendance"
                    stroke="#10b981"
                    strokeWidth={4}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 6, stroke: '#fff' }}
                    activeDot={{ r: 8, stroke: '#fff', strokeWidth: 3 }}
                    fill="url(#attendanceGradient)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px]">
                <div className="text-6xl mb-4 animate-pulse">📊</div>
                <p className="text-gray-400 font-semibold">{t('dashboard.loadingData')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 📈 معدل الاستمرارية الشهري */}
      {retentionData !== null && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-blue-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">📈</span>
            <span>معدل الاستمرارية</span>
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 items-center mb-4">
            <div className={`text-center p-4 rounded-xl flex-shrink-0 ${
              retentionData.rate >= 70 ? 'bg-green-50 border-2 border-green-400' :
              retentionData.rate >= 40 ? 'bg-yellow-50 border-2 border-yellow-400' :
              'bg-red-50 border-2 border-red-400'
            }`}>
              <div className="text-4xl font-bold">{retentionData.rate}%</div>
              <div className="text-xs text-gray-500 mt-1">آخر 30 يوم</div>
              <div className="text-xs text-gray-600 mt-1">
                {retentionData.renewed} جدد من {retentionData.expired}
              </div>
            </div>
            <div className="text-sm text-gray-500 flex-1">
              <p className="font-semibold mb-1">كيف يُحسب؟</p>
              <p>نسبة الأعضاء الذين جددوا اشتراكهم من بين الأعضاء الذين انتهت اشتراكاتهم في نفس الفترة.</p>
              <div className="mt-2 flex gap-3 flex-wrap text-xs">
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded">70%+ ممتاز</span>
                <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded">40-70% جيد</span>
                <span className="bg-red-100 text-red-700 px-2 py-1 rounded">أقل من 40% يحتاج تحسين</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

  )
}