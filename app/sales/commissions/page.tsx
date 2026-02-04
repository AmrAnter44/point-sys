'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../../../contexts/LanguageContext'

interface SalesStaff {
  id: string
  name: string
  position: string
}

interface Commission {
  id: string
  type: string
  amount: number
  status: string
  createdAt: string
  receiptNumber?: number
  memberName?: string
  details: any
}

interface SalesReport {
  staff: {
    id: string
    name: string
    position: string
  }
  month: string
  summary: {
    renewalCount: number
    renewalTotal: number
    topAchieverTotal: number
    isTopAchiever: boolean
    grandTotal: number
    status: string
  }
  renewalBreakdown: {
    [key: string]: {
      count: number
      total: number
    }
  }
  commissions: Commission[]
}

export default function SalesCommissionsPage() {
  const { t, direction } = useLanguage()
  const [salesStaff, setSalesStaff] = useState<SalesStaff[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [report, setReport] = useState<SalesReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)

  // تحديد الشهر الحالي
  useEffect(() => {
    const today = new Date()
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(currentMonth)
  }, [])

  // جلب موظفي Sales
  useEffect(() => {
    fetchSalesStaff()
  }, [])

  // اختيار الموظف تلقائياً إذا كان واحد فقط
  useEffect(() => {
    if (salesStaff.length === 1 && !selectedStaff) {
      setSelectedStaff(salesStaff[0].id)
    }
  }, [salesStaff, selectedStaff])

  // جلب التقرير عند اختيار موظف أو شهر
  useEffect(() => {
    if (selectedStaff && selectedMonth) {
      fetchReport()
    }
  }, [selectedStaff, selectedMonth])

  const fetchSalesStaff = async () => {
    try {
      const res = await fetch('/api/staff')
      const data = await res.json()

      console.log('📋 جميع الموظفين:', data)

      // فلترة موظفي Sales فقط (position = "ريسبشن")
      const sales = data.filter((s: any) => s.position === 'ريسبشن' && s.isActive)

      console.log('💰 موظفي المبيعات فقط:', sales)
      console.log('⚠️ الموظفين غير المبيعات:', data.filter((s: any) => s.position !== 'ريسبشن' && s.isActive))

      setSalesStaff(sales)
    } catch (error) {
      console.error('Error fetching sales staff:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReport = async () => {
    if (!selectedStaff || !selectedMonth) return

    setFetching(true)
    try {
      const res = await fetch(`/api/sales-commissions/monthly-report?staffId=${selectedStaff}&month=${selectedMonth}`)
      if (res.ok) {
        const data = await res.json()
        setReport(data)
      } else {
        setReport(null)
      }
    } catch (error) {
      console.error('Error fetching report:', error)
      setReport(null)
    } finally {
      setFetching(false)
    }
  }

  const getRenewalTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'gym_challenger': direction === 'rtl' ? 'جيم - شهر واحد' : 'Gym - 1 Month',
      'gym_fighter': direction === 'rtl' ? 'جيم - 3 شهور' : 'Gym - 3 Months',
      'gym_champion': direction === 'rtl' ? 'جيم - 6 شهور' : 'Gym - 6 Months',
      'gym_elite': direction === 'rtl' ? 'جيم - سنة' : 'Gym - 1 Year',
      'pt': direction === 'rtl' ? 'تدريب شخصي' : 'Personal Training',
      'physio': direction === 'rtl' ? 'علاج طبيعي' : 'Physiotherapy',
      'nutrition': direction === 'rtl' ? 'تغذية' : 'Nutrition',
      'classes_challenger': direction === 'rtl' ? 'كلاسات - شهر' : 'Classes - 1 Month',
      'classes_fighter': direction === 'rtl' ? 'كلاسات - 3 شهور' : 'Classes - 3 Months',
      'classes_champion': direction === 'rtl' ? 'كلاسات - 6 شهور' : 'Classes - 6 Months',
      'classes_elite': direction === 'rtl' ? 'كلاسات - سنة' : 'Classes - 1 Year',
    }
    return labels[type] || type
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6" dir={direction}>
        <div className="text-center py-20">
          <div className="inline-block animate-spin text-6xl mb-4">⏳</div>
          <p className="text-xl text-gray-600">{direction === 'rtl' ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6" dir={direction}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <span>💰</span>
          <span>{direction === 'rtl' ? 'عمولات المبيعات' : 'Sales Commissions'}</span>
        </h1>
        <p className="text-gray-600">
          {direction === 'rtl' ? 'عرض البونصات والعمولات الشهرية' : 'View monthly bonuses and commissions'}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* اختيار الموظف */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {direction === 'rtl' ? '👤 موظف المبيعات' : '👤 Sales Staff'}
            </label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full px-4 py-2 border-2 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="">{direction === 'rtl' ? 'اختر موظف...' : 'Select staff...'}</option>
              {salesStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
          </div>

          {/* اختيار الشهر */}
          <div>
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

      {/* Report */}
      {fetching ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin text-4xl mb-2">⏳</div>
          <p className="text-gray-600">{direction === 'rtl' ? 'جاري تحميل التقرير...' : 'Loading report...'}</p>
        </div>
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{direction === 'rtl' ? 'عدد التجديدات' : 'Renewals'}</p>
              <p className="text-4xl font-bold">{report.summary.renewalCount}</p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{direction === 'rtl' ? 'بونص التجديدات' : 'Renewal Bonus'}</p>
              <p className="text-4xl font-bold">{report.summary.renewalTotal.toFixed(0)}</p>
              <p className="text-xs opacity-75">{direction === 'rtl' ? 'ج.م' : 'EGP'}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{direction === 'rtl' ? 'بونص Top Achiever' : 'Top Achiever Bonus'}</p>
              <p className="text-4xl font-bold">{report.summary.topAchieverTotal.toFixed(0)}</p>
              <p className="text-xs opacity-75">
                {report.summary.isTopAchiever ? (direction === 'rtl' ? '🏆 أنت الأفضل!' : '🏆 You\'re #1!') : '-'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-6 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{direction === 'rtl' ? 'الإجمالي' : 'Total'}</p>
              <p className="text-4xl font-bold">{report.summary.grandTotal.toFixed(0)}</p>
              <p className="text-xs opacity-75">{direction === 'rtl' ? 'ج.م' : 'EGP'}</p>
            </div>
          </div>

          {/* Renewal Breakdown */}
          {Object.keys(report.renewalBreakdown).length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>📊</span>
                <span>{direction === 'rtl' ? 'تفصيل التجديدات' : 'Renewals Breakdown'}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(report.renewalBreakdown).map(([type, data]) => (
                  <div key={type} className="border-2 border-orange-200 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">
                        {getRenewalTypeLabel(type)}
                      </span>
                      <span className="text-lg font-bold text-orange-600">
                        {data.count}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-green-600">{data.total.toFixed(0)}</span>
                      <span className="text-sm text-gray-500 ml-1">{direction === 'rtl' ? 'ج.م' : 'EGP'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commissions Table */}
          {report.commissions.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>🧾</span>
                <span>{direction === 'rtl' ? 'تفاصيل العمولات' : 'Commission Details'}</span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-right text-sm font-semibold">
                        {direction === 'rtl' ? 'التاريخ' : 'Date'}
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">
                        {direction === 'rtl' ? 'النوع' : 'Type'}
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">
                        {direction === 'rtl' ? 'إيصال #' : 'Receipt #'}
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">
                        {direction === 'rtl' ? 'العميل' : 'Client'}
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">
                        {direction === 'rtl' ? 'المبلغ' : 'Amount'}
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">
                        {direction === 'rtl' ? 'الحالة' : 'Status'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {report.commissions.map((comm) => (
                      <tr key={comm.id} className="hover:bg-orange-50">
                        <td className="px-4 py-3 text-sm">
                          {new Date(comm.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {comm.type.includes('top_achiever') ?
                            (direction === 'rtl' ? '🏆 Top Achiever' : '🏆 Top Achiever') :
                            getRenewalTypeLabel(comm.type.replace('sales_renewal_', ''))
                          }
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">
                          {comm.receiptNumber ? `#${comm.receiptNumber}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {comm.memberName || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-green-600">
                          {comm.amount.toFixed(0)} {direction === 'rtl' ? 'ج.م' : 'EGP'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            comm.status === 'approved' ? 'bg-green-100 text-green-800' :
                            comm.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {comm.status === 'approved' ? (direction === 'rtl' ? 'معتمد' : 'Approved') :
                             comm.status === 'paid' ? (direction === 'rtl' ? 'مدفوع' : 'Paid') :
                             (direction === 'rtl' ? 'قيد الانتظار' : 'Pending')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No data message */}
          {report.commissions.length === 0 && (
            <div className="bg-gray-50 p-12 rounded-lg text-center">
              <p className="text-xl text-gray-500">
                {direction === 'rtl' ? '📭 لا توجد عمولات في هذا الشهر' : '📭 No commissions this month'}
              </p>
            </div>
          )}
        </>
      ) : selectedStaff && selectedMonth ? (
        <div className="bg-gray-50 p-12 rounded-lg text-center">
          <p className="text-xl text-gray-500">
            {direction === 'rtl' ? '📭 لا توجد بيانات' : '📭 No data available'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
