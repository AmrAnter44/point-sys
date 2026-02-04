'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../../../contexts/LanguageContext'

interface Session {
  id: string
  memberId: string
  memberNumber: number | null
  memberName: string
  memberPhone: string
  usedAt: string
  staffName: string | null
  notes: string | null
}

interface Member {
  id: string
  name: string
  phone: string
  nutritionSessions: number
}

export default function FreeNutritionSessionsPage() {
  const { t, direction } = useLanguage()
  const [sessions, setSessions] = useState<Session[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)
  const [message, setMessage] = useState('')

  // Form state
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [notes, setNotes] = useState('')

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchSessions()
    fetchMembers()
  }, [])

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/members')
      const data = await res.json()
      // فلترة الأعضاء اللي عندهم حصص متاحة
      const membersWithSessions = data.filter((m: Member) => m.nutritionSessions > 0)
      setMembers(membersWithSessions)
    } catch (error) {
      console.error('Error fetching members:', error)
    }
  }

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append('search', searchQuery)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const res = await fetch(`/api/free-nutrition-sessions?${params.toString()}`)
      const data = await res.json()
      setSessions(data)
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRecordSession = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedMemberId) {
      setMessage(`⚠️ ${t('freeNutritionSessions.messages.selectMemberFirst')}`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setRecording(true)
    try {
      const res = await fetch('/api/free-nutrition-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selectedMemberId,
          notes: notes || null
        })
      })

      const data = await res.json()

      if (res.ok) {
        setMessage(`✅ ${t('freeNutritionSessions.messages.success')} - ${t('freeNutritionSessions.messages.remainingSessions')}: ${data.remainingSessions}`)
        setTimeout(() => setMessage(''), 3000)
        setSelectedMemberId('')
        setNotes('')
        fetchSessions()
        fetchMembers() // تحديث قائمة الأعضاء
      } else {
        setMessage(`❌ ${data.error || t('freeNutritionSessions.messages.error')}`)
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      console.error('Error recording session:', error)
      setMessage(`❌ ${t('freeNutritionSessions.messages.error')}`)
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setRecording(false)
    }
  }

  const applyFilters = () => {
    fetchSessions()
  }

  const clearFilters = () => {
    setSearchQuery('')
    setStartDate('')
    setEndDate('')
    setTimeout(() => fetchSessions(), 100)
  }

  // حساب الإحصائيات
  const totalUsed = sessions.length
  const thisMonth = sessions.filter(s => {
    const sessionDate = new Date(s.usedAt)
    const now = new Date()
    return sessionDate.getMonth() === now.getMonth() && sessionDate.getFullYear() === now.getFullYear()
  }).length

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const selectedMember = members.find(m => m.id === selectedMemberId)

  return (
    <div className="container mx-auto p-6" dir={direction}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <span>🥗</span>
          <span>{t('freeNutritionSessions.title')}</span>
        </h1>
        <p className="text-gray-600 mt-2">{t('freeNutritionSessions.subtitle')}</p>
      </div>

      {/* Message */}
      {message && (
        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-700 rounded-lg shadow-md">
          {message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
          <div className="text-sm opacity-90 mb-1">{t('freeNutritionSessions.stats.totalUsed')}</div>
          <div className="text-5xl font-black">{totalUsed}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
          <div className="text-sm opacity-90 mb-1">{t('freeNutritionSessions.stats.thisMonth')}</div>
          <div className="text-5xl font-black">{thisMonth}</div>
        </div>
      </div>

      {/* Record Form */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span>📝</span>
          <span>{t('freeNutritionSessions.recordUsage')}</span>
        </h2>
        <form onSubmit={handleRecordSession} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-2">
                {t('freeNutritionSessions.selectMember')} *
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full px-4 py-2 border-2 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                required
              >
                <option value="">-- {t('freeNutritionSessions.selectMember')} --</option>
                {members.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name} - {member.phone} ({member.nutritionSessions} {t('freeNutritionSessions.messages.remainingSessions')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">
                {t('freeNutritionSessions.notes')}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('freeNutritionSessions.notesPlaceholder')}
                className="w-full px-4 py-2 border-2 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
            </div>
          </div>

          {selectedMember && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                ✅ <strong>{selectedMember.name}</strong> - {t('freeNutritionSessions.messages.remainingSessions')}: <strong>{selectedMember.nutritionSessions}</strong>
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={recording}
            className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 font-bold text-lg shadow-lg transition"
          >
            {recording ? t('freeNutritionSessions.recording') : t('freeNutritionSessions.record')}
          </button>
        </form>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span>🔍</span>
          <span>{t('freeNutritionSessions.filters.search')}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('freeNutritionSessions.filters.searchPlaceholder')}
              className="w-full px-4 py-2 border-2 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder={t('freeNutritionSessions.filters.dateFrom')}
              className="w-full px-4 py-2 border-2 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder={t('freeNutritionSessions.filters.dateTo')}
              className="w-full px-4 py-2 border-2 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>
        </div>
        <div className="flex gap-4 mt-4">
          <button
            onClick={applyFilters}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition"
          >
            {t('freeNutritionSessions.filters.apply')}
          </button>
          <button
            onClick={clearFilters}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-bold transition"
          >
            {t('freeNutritionSessions.filters.clear')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-green-500 to-green-600 text-white">
              <tr>
                <th className="px-4 py-3 text-center font-bold">{t('freeNutritionSessions.table.memberNumber')}</th>
                <th className="px-4 py-3 text-right font-bold">{t('freeNutritionSessions.table.memberName')}</th>
                <th className="px-4 py-3 text-center font-bold">{t('freeNutritionSessions.table.memberPhone')}</th>
                <th className="px-4 py-3 text-center font-bold">{t('freeNutritionSessions.table.usedAt')}</th>
                <th className="px-4 py-3 text-center font-bold">{t('freeNutritionSessions.table.staffName')}</th>
                <th className="px-4 py-3 text-center font-bold">{t('freeNutritionSessions.table.notes')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    ⏳ {t('common.loading')}
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    {t('freeNutritionSessions.table.noRecords')}
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-center">
                      {session.memberNumber ? (
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">
                          #{session.memberNumber}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">{session.memberName}</td>
                    <td className="px-4 py-3 text-center">{session.memberPhone}</td>
                    <td className="px-4 py-3 text-center text-sm">{formatDate(session.usedAt)}</td>
                    <td className="px-4 py-3 text-center">{session.staffName || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm">{session.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
