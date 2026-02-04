'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../../../contexts/LanguageContext'

interface StaffReport {
  staffId: string
  staffName: string
  renewalCount: number
  totalRevenue: number
  bonuses: {
    renewalBonuses: number
    topAchieverBase: number
    topAchieverMultiplier: number
    total: number
  }
}

interface AllStaffReport {
  summary: {
    month: string
    totalSalesStaff: number
    totalRenewals: number
    totalRevenue: number
    totalBonuses: number
    topPerformer: StaffReport | null
  }
  staffReports: StaffReport[]
}

interface FinalizePreview {
  month: string
  preview: boolean
  stats: {
    totalSalesStaff: number
    totalRenewals: number
  }
  topPerformers: Array<{
    staffId: string
    staffName: string
    renewalCount: number
    estimatedBonus: number
  }>
  allStaffRankings: Array<{
    rank: number
    staffName: string
    renewalCount: number
    totalRevenue: number
  }>
}

export default function AdminSalesReportPage() {
  const { t, direction } = useLanguage()
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [report, setReport] = useState<AllStaffReport | null>(null)
  const [preview, setPreview] = useState<FinalizePreview | null>(null)
  const [loading, setLoading] = useState(false)

  // تحديد الشهر الحالي
  useEffect(() => {
    const today = new Date()
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(currentMonth)
  }, [])

  // جلب التقرير عند اختيار الشهر
  useEffect(() => {
    if (selectedMonth) {
      fetchReport()
      fetchPreview()
    }
  }, [selectedMonth])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sales-commissions/monthly-report?month=${selectedMonth}`)
      if (res.ok) {
        const data = await res.json()
        setReport(data)
      }
    } catch (error) {
      console.error('Error fetching report:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPreview = async () => {
    try {
      const res = await fetch(`/api/sales-commissions/finalize?month=${selectedMonth}`)
      if (res.ok) {
        const data = await res.json()
        setPreview(data)
      }
    } catch (error) {
      console.error('Error fetching preview:', error)
    }
  }

  return (
    <div className="container mx-auto p-6" dir={direction}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <span>📊</span>
          <span>{direction === 'rtl' ? 'تقرير عمولات المبيعات - Admin' : 'Sales Commissions Report - Admin'}</span>
        </h1>
        <p className="text-gray-600">
          {direction === 'rtl' ? 'عرض وإدارة عمولات جميع موظفي المبيعات' : 'View and manage all sales staff commissions'}
        </p>
      </div>

      {/* Month Selector */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 max-w-xs">
            <label className="block text-sm font-medium mb-2">
              {direction === 'rtl' ? '📅 الشهر' : '📅 Month'}
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-2 border-2 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin text-4xl mb-2">⏳</div>
          <p className="text-gray-600">{direction === 'rtl' ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{direction === 'rtl' ? 'عدد الموظفين' : 'Staff Count'}</p>
              <p className="text-4xl font-bold">{report.summary.totalSalesStaff}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{direction === 'rtl' ? 'إجمالي التجديدات' : 'Total Renewals'}</p>
              <p className="text-4xl font-bold">{report.summary.totalRenewals}</p>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{direction === 'rtl' ? 'إجمالي الإيرادات' : 'Total Revenue'}</p>
              <p className="text-4xl font-bold">{report.summary.totalRevenue.toFixed(0)}</p>
              <p className="text-xs opacity-75">ج.م</p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{direction === 'rtl' ? 'إجمالي البونصات' : 'Total Bonuses'}</p>
              <p className="text-4xl font-bold">{report.summary.totalBonuses.toFixed(0)}</p>
              <p className="text-xs opacity-75">ج.م</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-6 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{direction === 'rtl' ? '🏆 Top Achiever' : '🏆 Top Achiever'}</p>
              <p className="text-2xl font-bold truncate">{report.summary.topPerformer?.staffName || '-'}</p>
              <p className="text-xs opacity-75">
                {report.summary.topPerformer ? `${report.summary.topPerformer.renewalCount} ${direction === 'rtl' ? 'تجديد' : 'renewals'}` : '-'}
              </p>
            </div>
          </div>

          {/* Top Achiever Preview */}
          {preview && preview.topPerformers.length > 0 && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>🏆</span>
                <span>{direction === 'rtl' ? 'Top Achiever هذا الشهر' : 'Top Achiever This Month'}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {preview.topPerformers.map((performer, index) => (
                  <div key={performer.staffId} className="bg-white p-4 rounded-lg border-2 border-yellow-400">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-lg">{performer.staffName}</span>
                      <span className="text-3xl">{index === 0 ? '🥇' : '🏆'}</span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      {performer.renewalCount} {direction === 'rtl' ? 'تجديد' : 'renewals'}
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {performer.estimatedBonus.toFixed(0)} ج.م
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {direction === 'rtl' ? '(1000 + ' : '(1000 + '}
                      {performer.renewalCount} × 50)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staff Rankings Table */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span>📋</span>
              <span>{direction === 'rtl' ? 'ترتيب الموظفين' : 'Staff Rankings'}</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-center text-sm font-semibold">
                      {direction === 'rtl' ? 'الترتيب' : 'Rank'}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">
                      {direction === 'rtl' ? 'الاسم' : 'Name'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">
                      {direction === 'rtl' ? 'التجديدات' : 'Renewals'}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">
                      {direction === 'rtl' ? 'الإيرادات' : 'Revenue'}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">
                      {direction === 'rtl' ? 'البونصات' : 'Bonuses'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {report.staffReports.map((staff, index) => (
                    <tr key={staff.staffId} className={`${
                      index === 0 ? 'bg-yellow-50 font-bold' : 'hover:bg-gray-50'
                    }`}>
                      <td className="px-4 py-3 text-center">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </td>
                      <td className="px-4 py-3">
                        {staff.staffName}
                        {index === 0 && <span className="ml-2 text-yellow-600">👑</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-lg font-bold text-orange-600">
                        {staff.renewalCount}
                      </td>
                      <td className="px-4 py-3 text-green-600">
                        {staff.totalRevenue.toFixed(0)} ج.م
                      </td>
                      <td className="px-4 py-3 text-green-600 font-bold">
                        {staff.bonuses.total.toFixed(0)} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-gray-50 p-12 rounded-lg text-center">
          <p className="text-xl text-gray-500">
            {direction === 'rtl' ? '📭 لا توجد بيانات' : '📭 No data available'}
          </p>
        </div>
      )}
    </div>
  )
}
