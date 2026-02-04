'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'
import PermissionDenied from '../../components/PermissionDenied'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'

interface Staff {
  id: string
  staffCode: string
  name: string
  position?: string
}

interface Attendance {
  id: string
  staffId: string
  staff: Staff
  checkIn: string
  checkOut: string | null
  duration: number | null
  notes: string | null
  createdAt: string
}

export default function AttendanceReportPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const { t, direction } = useLanguage()

  const getPositionLabel = (position: string | null | undefined): string => {
    if (!position) return '-'
    const POSITION_MAP: { [key: string]: string } = {
      'مدرب': 'trainer',
      'ريسبشن': 'receptionist',
      'بار': 'barista',
      'HK': 'housekeeping',
      'نظافة': 'housekeeping',
      'مدير': 'manager',
      'محاسب': 'accountant',
      'صيانة': 'maintenance',
      'أمن': 'security',
      'other': 'other',
    }
    const key = POSITION_MAP[position] || 'other'
    return t(`positions.${key}` as any)
  }

  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedStaff, setSelectedStaff] = useState<string>('')

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [attendanceToDelete, setAttendanceToDelete] = useState<Attendance | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchAttendance = async () => {
    setLoading(true)
    try {
      let url = '/api/attendance?'
      const params = []

      if (dateFrom) params.push(`dateFrom=${dateFrom}`)
      if (dateTo) params.push(`dateTo=${dateTo}`)
      if (selectedStaff) params.push(`staffId=${selectedStaff}`)

      url += params.join('&')

      const response = await fetch(url)
      const data = await response.json()

      // ✅ التحقق من أن البيانات array
      if (response.ok && Array.isArray(data)) {
        setAttendance(data)
      } else {
        console.error('Invalid attendance data:', data)
        setAttendance([])
      }
    } catch (error) {
      console.error('Error:', error)
      setAttendance([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/staff')
      const data = await response.json()

      // ✅ التحقق من أن البيانات array
      if (response.ok && Array.isArray(data)) {
        setStaff(data.filter((s: any) => s.isActive))
      } else {
        console.error('Invalid staff data:', data)
        setStaff([])
      }
    } catch (error) {
      console.error('Error:', error)
      setStaff([])
    }
  }

  useEffect(() => {
    fetchStaff()
    fetchAttendance()
  }, [])

  useEffect(() => {
    fetchAttendance()
  }, [dateFrom, dateTo, selectedStaff])

  const deleteAttendance = (record: Attendance) => {
    setAttendanceToDelete(record)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!attendanceToDelete) return

    setDeleteLoading(true)
    try {
      await fetch(`/api/attendance?id=${attendanceToDelete.id}`, { method: 'DELETE' })
      fetchAttendance()
      setShowDeleteModal(false)
      setAttendanceToDelete(null)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  // تنسيق مدة العمل
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0
      ? t('attendanceReport.hoursAndMinutes', { hours: hours.toString(), minutes: mins.toString() })
      : t('attendanceReport.minutes', { minutes: mins.toString() })
  }

  // إحصائيات بسيطة
  const totalDays = attendance.length
  const uniqueStaff = new Set(attendance.map((a) => a.staffId)).size
  const today = new Date().toDateString()
  const todayCount = attendance.filter((a) => {
    const date = new Date(a.checkIn).toDateString()
    return date === today
  }).length

  // حساب إجمالي ساعات العمل
  const totalWorkMinutes = attendance.reduce((sum, att) => {
    return sum + (att.duration || 0)
  }, 0)
  const totalWorkHours = Math.floor(totalWorkMinutes / 60)
  const totalWorkDays = Math.floor(totalWorkHours / 8) // افتراض 8 ساعات = يوم عمل

  // إحصائيات حسب الموظف
  const staffStats = attendance.reduce(
    (acc, att) => {
      const staffId = att.staffId
      if (!acc[staffId]) {
        acc[staffId] = {
          staffCode: att.staff.staffCode,
          name: att.staff.name,
          position: att.staff.position,
          totalDays: 0,
        }
      }

      acc[staffId].totalDays += 1

      return acc
    },
    {} as Record<
      string,
      { staffCode: string; name: string; position?: string; totalDays: number }
    >
  )

  // ✅ التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">{t('attendanceReport.loading')}</div>
      </div>
    )
  }

  if (!hasPermission('canViewReports')) {
    return <PermissionDenied message={t('attendanceReport.noPermission')} />
  }

  return (
    <div className="container mx-auto p-6" dir={direction}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">📊 {t('attendanceReport.title')}</h1>
          <p className="text-gray-600">{t('attendanceReport.subtitle')}</p>
        </div>
        <button
          onClick={() => router.push('/staff')}
          className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition"
        >
          {direction === 'rtl' ? '←' : '→'} {t('attendanceReport.backToStaff')}
        </button>
      </div>

      {/* فلاتر البحث */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-orange-100">
        <h3 className="text-xl font-bold mb-4">🔍 {t('attendanceReport.searchFilters')}</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2">{t('attendanceReport.dateFrom')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">{t('attendanceReport.dateTo')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">{t('attendanceReport.staff')}</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 transition"
            >
              <option value="">{t('attendanceReport.all')}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.staffCode} - {s.name} {s.position && `(${s.position})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm mb-1">{t('attendanceReport.totalAttendanceDays')}</p>
              <p className="text-4xl font-bold">{totalDays}</p>
            </div>
            <div className="text-5xl opacity-20">📊</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm mb-1">{t('attendanceReport.todayAttendance')}</p>
              <p className="text-4xl font-bold">{todayCount}</p>
            </div>
            <div className="text-5xl opacity-20">📅</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm mb-1">{t('attendanceReport.staffCount')}</p>
              <p className="text-4xl font-bold">{uniqueStaff}</p>
            </div>
            <div className="text-5xl opacity-20">👥</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm mb-1">{t('attendanceReport.totalWorkHours')}</p>
              <p className="text-4xl font-bold">{totalWorkHours}</p>
              <p className="text-orange-100 text-xs mt-1">({t('attendanceReport.workDays', { days: totalWorkDays.toString() })})</p>
            </div>
            <div className="text-5xl opacity-20">⏰</div>
          </div>
        </div>
      </div>

      {/* إحصائيات الموظفين */}
      {Object.keys(staffStats).length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">📋 {t('attendanceReport.staffStatistics')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(staffStats)
              .sort((a, b) => b[1].totalDays - a[1].totalDays)
              .map(([staffId, stats]) => (
                <div
                  key={staffId}
                  className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border-2 border-gray-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-lg">{stats.name}</p>
                      <p className="text-xs text-gray-500">
                        #{stats.staffCode} {stats.position && `• ${stats.position}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="bg-orange-100 rounded-lg p-2 text-center">
                      <p className="text-xs text-orange-600 mb-1">{t('attendanceReport.attendanceDays')}</p>
                      <p className="text-2xl font-bold text-orange-600">{stats.totalDays}</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* جدول السجلات */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600">
          <h3 className="text-xl font-bold text-white">📋 {t('attendanceReport.attendanceRecords')}</h3>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">{t('attendanceReport.loading')}</div>
        ) : attendance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('attendanceReport.date')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('attendanceReport.staffNumber')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('attendanceReport.name')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('attendanceReport.position')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('attendanceReport.checkInTime')}</th>
                  <th className="px-4 py-3 text-center">{t('attendanceReport.status')}</th>
                  <th className="px-4 py-3 text-center">{t('attendanceReport.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((att) => (
                  <tr key={att.id} className={`border-t hover:bg-gray-50 ${att.checkOut === null ? 'bg-green-50' : ''}`}>
                    <td className="px-4 py-3">
                      {new Date(att.checkIn).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-orange-500 text-white px-3 py-1 rounded-lg font-bold text-sm">
                        #{att.staff.staffCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold">{att.staff.name}</td>
                    <td className="px-4 py-3">{getPositionLabel(att.staff.position)}</td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(att.checkIn).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {att.checkOut === null ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500 text-white">
                          🟢 {t('attendanceReport.inside')}
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-500 text-white">
                          🔴 {t('attendanceReport.outside')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => deleteAttendance(att)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                      >
                        🗑️ {t('attendanceReport.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-xl">{t('attendanceReport.noRecords')}</p>
            <p className="text-sm mt-2">{t('attendanceReport.tryChangingFilters')}</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setAttendanceToDelete(null)
        }}
        onConfirm={confirmDelete}
        title={t('attendanceReport.deleteRecordTitle')}
        message={t('attendanceReport.deleteRecordMessage')}
        itemName={attendanceToDelete ? `${attendanceToDelete.staff.name} - ${new Date(attendanceToDelete.checkIn).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}` : ''}
        loading={deleteLoading}
      />
    </div>
  )
}
