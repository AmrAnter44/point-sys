'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '../../../hooks/usePermissions'

interface LogEntry {
  id: string
  action: string
  resource: string
  resourceId?: string | null
  details?: string | null
  createdAt: string
  user: {
    id: string
    name: string
    role: string
  }
}

interface User {
  id: string
  name: string
  role: string
}

const ACTION_LABELS: Record<string, string> = {
  create: '➕ إضافة',
  update: '✏️ تعديل',
  delete: '🗑️ حذف',
  renew: '🔄 تجديد',
  upgrade: '⬆️ ترقية',
  check_in: '✅ حضور',
  settle_commission: '💰 صرف كوميشن',
  add_points: '⭐ إضافة نقاط',
  redeem_points: '🎁 صرف نقاط',
  freeze: '❄️ تجميد',
  unfreeze: '☀️ إلغاء تجميد',
  change_coach: '🔃 تغيير كوتش',
  login: '🔑 دخول',
}

const RESOURCE_LABELS: Record<string, string> = {
  member: 'عضو',
  receipt: 'إيصال',
  commission: 'كوميشن',
  pt_session: 'سيشن PT',
  nutrition: 'تغذية',
  physio: 'فيزيو',
  staff: 'موظف',
  offer: 'باقة',
  loyalty: 'نقاط ولاء',
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  renew: 'bg-orange-100 text-orange-800',
  upgrade: 'bg-purple-100 text-purple-800',
  check_in: 'bg-teal-100 text-teal-800',
  settle_commission: 'bg-yellow-100 text-yellow-800',
  add_points: 'bg-indigo-100 text-indigo-800',
  redeem_points: 'bg-pink-100 text-pink-800',
  freeze: 'bg-cyan-100 text-cyan-800',
  login: 'bg-gray-100 text-gray-800',
}

export default function ActivityLogPage() {
  const router = useRouter()
  const { hasPermission, loading: permLoading } = usePermissions()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // فلاتر
  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterResource, setFilterResource] = useState('')
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')

  const fetchLogs = async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: p.toString(), limit: '50' })
      if (filterUser) params.set('userId', filterUser)
      if (filterAction) params.set('action', filterAction)
      if (filterResource) params.set('resource', filterResource)
      if (filterStart) params.set('startDate', filterStart)
      if (filterEnd) params.set('endDate', filterEnd)

      const res = await fetch(`/api/admin/activity-log?${params}`)
      const data = await res.json()

      if (res.ok) {
        setLogs(data.logs)
        setTotal(data.total)
        setTotalPages(data.totalPages)
        setPage(data.page)
        if (data.users) setUsers(data.users)
      }
    } catch (err) {
      console.error('Error fetching logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!permLoading) fetchLogs(1)
  }, [permLoading])

  const handleSearch = () => fetchLogs(1)

  if (permLoading) return <div className="p-8 text-center">جاري التحميل...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">📋 سجل النشاط</h1>
            <p className="text-gray-500 text-sm mt-1">كل العمليات اللي اتعملت مع مين ومتى</p>
          </div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
          >
            ← رجوع
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">كل الموظفين</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>

            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">كل العمليات</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <select
              value={filterResource}
              onChange={e => setFilterResource(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">كل الأنواع</option>
              {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <input
              type="date"
              value={filterStart}
              onChange={e => setFilterStart(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="من تاريخ"
            />

            <input
              type="date"
              value={filterEnd}
              onChange={e => setFilterEnd(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="إلى تاريخ"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              🔍 بحث
            </button>
            <button
              onClick={() => {
                setFilterUser('')
                setFilterAction('')
                setFilterResource('')
                setFilterStart('')
                setFilterEnd('')
                setTimeout(() => fetchLogs(1), 100)
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
            >
              مسح الفلاتر
            </button>
            <span className="mr-auto text-sm text-gray-500 self-center">
              {total} عملية
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">جاري التحميل...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p>لا يوجد سجلات</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-right">التوقيت</th>
                    <th className="px-4 py-3 text-right">الموظف</th>
                    <th className="px-4 py-3 text-right">العملية</th>
                    <th className="px-4 py-3 text-right">النوع</th>
                    <th className="px-4 py-3 text-right">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map(log => {
                    let details: any = null
                    try {
                      details = log.details ? JSON.parse(log.details) : null
                    } catch {
                      details = log.details
                    }

                    return (
                      <tr key={log.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          <div>{new Date(log.createdAt).toLocaleDateString('ar-EG')}</div>
                          <div className="text-xs">{new Date(log.createdAt).toLocaleTimeString('ar-EG')}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{log.user.name}</div>
                          <div className="text-xs text-gray-400">{log.user.role}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <div>{RESOURCE_LABELS[log.resource] || log.resource}</div>
                          {log.resourceId && (
                            <div className="text-xs text-gray-400 font-mono">{log.resourceId.slice(0, 8)}...</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs max-w-xs">
                          {typeof details === 'object' && details !== null ? (
                            <div className="space-y-0.5">
                              {Object.entries(details).slice(0, 3).map(([k, v]) => (
                                <div key={k}>
                                  <span className="text-gray-400">{k}:</span>{' '}
                                  <span className="font-medium">{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span>{String(details || '-')}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => fetchLogs(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 bg-white border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              ← السابق
            </button>
            <span className="px-3 py-1 text-sm text-gray-600 self-center">
              صفحة {page} من {totalPages}
            </span>
            <button
              onClick={() => fetchLogs(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1 bg-white border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              التالي →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
