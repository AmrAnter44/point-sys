'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const DAYS_OF_WEEK = [
  { key: 'Monday', label: 'الإثنين', order: 1 },
  { key: 'Tuesday', label: 'الثلاثاء', order: 2 },
  { key: 'Wednesday', label: 'الأربعاء', order: 3 },
  { key: 'Thursday', label: 'الخميس', order: 4 },
  { key: 'Friday', label: 'الجمعة', order: 5 },
  { key: 'Saturday', label: 'السبت', order: 6 },
  { key: 'Sunday', label: 'الأحد', order: 7 },
]

export default function CoachRotationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rotations, setRotations] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')

      if (!response.ok) {
        router.push('/login')
        return
      }

      const data = await response.json()
      setUser(data.user)

      if (data.user.role !== 'COACH') {
        router.push('/')
        return
      }

      fetchRotations()
    } catch (error) {
      console.error('Error checking authentication:', error)
      router.push('/login')
    }
  }

  const fetchRotations = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/rotations')
      if (response.ok) {
        const data = await response.json()
        setRotations(data)
      }
    } catch (error) {
      console.error('Error fetching rotations:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDayLabel = (dayKey: string) => {
    const day = DAYS_OF_WEEK.find((d) => d.key === dayKey)
    return day?.label || dayKey
  }

  const groupedRotations = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day.key] = rotations.filter((r) => r.dayOfWeek === day.key)
    return acc
  }, {} as Record<string, any[]>)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">📅 جداول المناوبات</h1>
              <p className="text-gray-600 mt-2">مواعيد عملك الأسبوعية</p>
            </div>
            <button
              onClick={() => router.push('/coach')}
              className="px-6 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 font-bold"
            >
              ← رجوع
            </button>
          </div>
        </div>

        {/* Weekly Schedule */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h2 className="text-2xl font-bold mb-6">الجدول الأسبوعي</h2>

          {rotations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl text-gray-500">لا توجد مناوبات مسجلة</p>
              <p className="text-gray-400 mt-2">تواصل مع الإدارة لإضافة جدولك</p>
            </div>
          ) : (
            <div className="space-y-4">
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day.key}
                  className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-500 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-800">{day.label}</h3>
                    {groupedRotations[day.key]?.length > 0 ? (
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">
                        ✅ مجدول
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-sm font-bold">
                        راحة
                      </span>
                    )}
                  </div>

                  {groupedRotations[day.key]?.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {groupedRotations[day.key].map((rotation) => (
                        <div
                          key={rotation.id}
                          className="bg-blue-50 p-3 rounded-lg flex items-center gap-3"
                        >
                          <div className="text-3xl">🕒</div>
                          <div>
                            <p className="font-bold text-lg text-blue-700">
                              {rotation.startTime} - {rotation.endTime}
                            </p>
                            <p className="text-sm text-gray-600">
                              المدة:{' '}
                              {calculateDuration(rotation.startTime, rotation.endTime)} ساعات
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly Summary */}
        {rotations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">أيام العمل</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {Object.keys(groupedRotations).filter(
                      (day) => groupedRotations[day].length > 0
                    ).length}
                  </p>
                </div>
                <div className="text-5xl">📅</div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">إجمالي المناوبات</p>
                  <p className="text-3xl font-bold text-green-600">{rotations.length}</p>
                </div>
                <div className="text-5xl">✅</div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">ساعات العمل الأسبوعية</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {calculateTotalWeeklyHours(rotations)}
                  </p>
                </div>
                <div className="text-5xl">⏰</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  return Math.round((endMinutes - startMinutes) / 60 * 10) / 10
}

function calculateTotalWeeklyHours(rotations: any[]): number {
  const total = rotations.reduce((sum, rotation) => {
    return sum + calculateDuration(rotation.startTime, rotation.endTime)
  }, 0)

  return Math.round(total * 10) / 10
}
