'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../../../contexts/LanguageContext'

interface CoachSummary {
  coachId: string
  coachName: string
  rank: number
  topAchieverLevel: 'none' | 'basic' | 'double'
  isTopAchiever: boolean
  baseSalary: number
  onboardingTotal: number
  mrcbTotal: number
  topAchieverBonus: number
  upsellsTotal: number
  ptRevenue: number
  ptCommission: number
  ptCommissionRate: number
  activeClientsCount: number
  serviceReferrals: number
  membershipUpgrades: number
  totalCommissions: number
  grandTotal: number
}

interface AllCoachesData {
  month: string
  totalCoaches: number
  topAchievers: CoachSummary[]
  coaches: CoachSummary[]
}

export default function CoachIncomePage() {
  const { t, direction } = useLanguage()
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [allCoachesData, setAllCoachesData] = useState<AllCoachesData | null>(null)
  const [calculating, setCalculating] = useState(false)

  // تحديد الشهر الحالي كافتراضي
  useEffect(() => {
    const today = new Date()
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(currentMonth)
  }, [])

  // حساب تلقائي عند تحميل الصفحة
  useEffect(() => {
    if (selectedMonth) {
      handleCalculateAll()
    }
  }, [selectedMonth])

  const handleCalculateAll = async () => {
    if (!selectedMonth) {
      alert(t('coachIncome.selectMonthFirst'))
      return
    }

    setCalculating(true)
    try {
      const response = await fetch(`/api/commissions/all-coaches-income?month=${selectedMonth}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('coachIncome.errorOccurred'))
      }

      setAllCoachesData(data)
    } catch (error: any) {
      console.error('Error calculating all coaches income:', error)
      alert(error.message || t('coachIncome.errorCalculating'))
    } finally {
      setCalculating(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
  }

  return (
    <div className="container mx-auto p-6" dir={direction}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-5xl">🏆</div>
          <div>
            <h1 className="text-4xl font-bold">{t('coachIncome.title')}</h1>
            <p className="text-gray-600 mt-1">{t('coachIncome.allCoachesSubtitle')}</p>
          </div>
        </div>
      </div>

      {/* Month Selection */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-bold mb-2 text-gray-700">
              📅 {t('coachIncome.month')}
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleCalculateAll}
              disabled={!selectedMonth || calculating}
              className="px-8 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-bold text-lg shadow-lg transform transition hover:scale-105 active:scale-95"
            >
              {calculating ? `⏳ ${t('coachIncome.calculating')}` : `🔄 ${t('coachIncome.refreshData')}`}
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {calculating && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="text-9xl mb-6 animate-bounce">⏳</div>
          <p className="text-gray-500 text-xl">{t('coachIncome.calculatingAll')}</p>
        </div>
      )}

      {/* Results */}
      {!calculating && allCoachesData && (
        <>
          {/* Top Achievers Section */}
          {allCoachesData.topAchievers && allCoachesData.topAchievers.length > 0 && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                🏆 Top Achievers - {selectedMonth}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allCoachesData.topAchievers.map((coach) => (
                  <div
                    key={coach.coachId}
                    className={`rounded-xl p-6 shadow-xl border-4 ${
                      coach.topAchieverLevel === 'double'
                        ? 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 border-yellow-300'
                        : 'bg-gradient-to-r from-green-400 via-green-500 to-teal-500 border-green-300'
                    } text-white`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-6xl">
                        {coach.topAchieverLevel === 'double' ? '🏆' : '⭐'}
                      </div>
                      <div className="text-right">
                        <div className="text-sm opacity-90 font-semibold">
                          {coach.topAchieverLevel === 'double' ? 'Double Target' : 'Basic Target'}
                        </div>
                        <div className="text-4xl font-black">
                          +{coach.topAchieverLevel === 'double' ? '100' : '50'}
                        </div>
                        <div className="text-xs opacity-90">ج.م / MRCB</div>
                      </div>
                    </div>

                    <div className="text-2xl font-black mb-3">{coach.coachName}</div>

                    <div className="space-y-2 text-sm opacity-95">
                      <div className="flex items-center justify-between">
                        <span>✅ Referrals:</span>
                        <span className="font-bold">{coach.serviceReferrals}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>📈 Upgrades:</span>
                        <span className="font-bold">{coach.membershipUpgrades}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>👥 Active Clients:</span>
                        <span className="font-bold">{coach.activeClientsCount}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/30">
                      <div className="text-sm opacity-90">Top Achiever Bonus</div>
                      <div className="text-3xl font-black">
                        {formatCurrency(coach.topAchieverBonus)} ج.م
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-xl">
              <div className="text-sm opacity-90 mb-1">{t('coachIncome.totalCoaches')}</div>
              <div className="text-5xl font-black">{allCoachesData.totalCoaches}</div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-xl">
              <div className="text-sm opacity-90 mb-1">{t('coachIncome.totalSalaries')}</div>
              <div className="text-5xl font-black">
                {formatCurrency(allCoachesData.coaches.reduce((sum, c) => sum + c.baseSalary, 0))}
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-xl">
              <div className="text-sm opacity-90 mb-1">{t('coachIncome.summary.totalCommissions')}</div>
              <div className="text-5xl font-black">
                {formatCurrency(allCoachesData.coaches.reduce((sum, c) => sum + c.totalCommissions, 0))}
              </div>
            </div>
          </div>

          {/* Coaches Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                  <tr>
                    <th className="px-4 py-4 text-center font-bold">{t('coachIncome.rank')}</th>
                    <th className="px-4 py-4 text-right font-bold">{t('coachIncome.coach')}</th>
                    <th className="px-4 py-4 text-center font-bold">{t('coachIncome.salary')}</th>
                    <th className="px-4 py-4 text-center font-bold">{t('coachIncome.tabs.onboarding')}</th>
                    <th className="px-4 py-4 text-center font-bold">{t('coachIncome.tabs.mrcb')}</th>
                    <th className="px-4 py-4 text-center font-bold">Top Achiever Bonus</th>
                    <th className="px-4 py-4 text-center font-bold">{t('coachIncome.tabs.upsells')}</th>
                    <th className="px-4 py-4 text-center font-bold">PT</th>
                    <th className="px-4 py-4 text-center font-bold">{t('coachIncome.ptRate')}</th>
                    <th className="px-4 py-4 text-center font-bold">{t('coachIncome.summary.totalCommissions')}</th>
                    <th className="px-4 py-4 text-center font-bold">{t('coachIncome.summary.grandTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allCoachesData.coaches.map((coach, idx) => (
                    <tr
                      key={coach.coachId}
                      className="border-t hover:bg-gray-50 transition"
                    >
                      {/* الترتيب */}
                      <td className="px-4 py-4 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-200 text-gray-700 rounded-full text-xl font-bold">
                          #{coach.rank}
                        </div>
                      </td>

                      {/* الكوتش */}
                      <td className="px-4 py-4">
                        <div className="font-bold text-lg">{coach.coachName}</div>
                        {coach.isTopAchiever && (
                          <div className={`text-xs font-bold mt-1 ${
                            coach.topAchieverLevel === 'double'
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          }`}>
                            {coach.topAchieverLevel === 'double'
                              ? '🏆 Top Achiever (Double)'
                              : '⭐ Top Achiever (Basic)'}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          👥 {coach.activeClientsCount} Active |
                          ✅ {coach.serviceReferrals} Refs |
                          📈 {coach.membershipUpgrades} Ups
                        </div>
                      </td>

                      {/* المرتب */}
                      <td className="px-4 py-4 text-center font-semibold">
                        {formatCurrency(coach.baseSalary)}
                      </td>

                      {/* On-boarding */}
                      <td className="px-4 py-4 text-center font-semibold text-green-600">
                        {formatCurrency(coach.onboardingTotal)}
                      </td>

                      {/* MRCB */}
                      <td className="px-4 py-4 text-center font-semibold text-blue-600">
                        {formatCurrency(coach.mrcbTotal)}
                      </td>

                      {/* Top Achiever Bonus */}
                      <td className="px-4 py-4 text-center">
                        {coach.topAchieverBonus > 0 ? (
                          <div className={`font-bold ${
                            coach.topAchieverLevel === 'double'
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          }`}>
                            +{formatCurrency(coach.topAchieverBonus)}
                          </div>
                        ) : (
                          <div className="text-gray-400">-</div>
                        )}
                      </td>

                      {/* Upsells */}
                      <td className="px-4 py-4 text-center font-semibold text-purple-600">
                        {formatCurrency(coach.upsellsTotal)}
                      </td>

                      {/* PT */}
                      <td className="px-4 py-4 text-center">
                        <div className="font-semibold text-orange-600">
                          {formatCurrency(coach.ptCommission)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {t('coachIncome.from')} {formatCurrency(coach.ptRevenue)}
                        </div>
                      </td>

                      {/* نسبة PT */}
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-bold ${
                            coach.ptCommissionRate >= 50
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {coach.ptCommissionRate.toFixed(0)}%
                        </span>
                      </td>

                      {/* إجمالي العمولات */}
                      <td className="px-4 py-4 text-center font-bold text-purple-700">
                        {formatCurrency(coach.totalCommissions)}
                      </td>

                      {/* الإجمالي الكلي */}
                      <td className="px-4 py-4 text-center">
                        <div className="text-2xl font-black text-green-600">
                          {formatCurrency(coach.grandTotal)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 font-bold">
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-right">
                      {t('coachIncome.summary.grandTotal')}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {formatCurrency(allCoachesData.coaches.reduce((sum, c) => sum + c.baseSalary, 0))}
                    </td>
                    <td className="px-4 py-4 text-center text-green-600">
                      {formatCurrency(allCoachesData.coaches.reduce((sum, c) => sum + c.onboardingTotal, 0))}
                    </td>
                    <td className="px-4 py-4 text-center text-blue-600">
                      {formatCurrency(allCoachesData.coaches.reduce((sum, c) => sum + c.mrcbTotal, 0))}
                    </td>
                    <td className="px-4 py-4 text-center text-yellow-600">
                      {formatCurrency(allCoachesData.coaches.reduce((sum, c) => sum + c.topAchieverBonus, 0))}
                    </td>
                    <td className="px-4 py-4 text-center text-purple-600">
                      {formatCurrency(allCoachesData.coaches.reduce((sum, c) => sum + c.upsellsTotal, 0))}
                    </td>
                    <td className="px-4 py-4 text-center text-orange-600">
                      {formatCurrency(allCoachesData.coaches.reduce((sum, c) => sum + c.ptCommission, 0))}
                    </td>
                    <td className="px-4 py-4 text-center">-</td>
                    <td className="px-4 py-4 text-center text-purple-700">
                      {formatCurrency(allCoachesData.coaches.reduce((sum, c) => sum + c.totalCommissions, 0))}
                    </td>
                    <td className="px-4 py-4 text-center text-green-600 text-2xl">
                      {formatCurrency(allCoachesData.coaches.reduce((sum, c) => sum + c.grandTotal, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 space-y-4">
            {/* Top Achiever System Explanation */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-lg p-6 border-2 border-blue-200">
              <h3 className="text-xl font-bold mb-4 text-gray-800">🏆 نظام Top Achiever</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 bg-white rounded-lg p-4 shadow-sm">
                  <span className="text-3xl">⭐</span>
                  <div className="flex-1">
                    <div className="font-bold text-green-700 text-lg mb-1">Basic Target</div>
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold">الشروط:</span> 5 إحالات خدمات (Nutrition + Physio) + 3 ترقيات عضويات
                    </div>
                    <div className="text-sm text-green-600 font-bold mt-1">
                      المكافأة: +50 ج.م لكل عميل نشط (MRCB) + نسبة 30% على PT
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white rounded-lg p-4 shadow-sm">
                  <span className="text-3xl">🏆</span>
                  <div className="flex-1">
                    <div className="font-bold text-yellow-700 text-lg mb-1">Double Target</div>
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold">الشروط:</span> 10 إحالات خدمات (Nutrition + Physio) + 6 ترقيات عضويات
                    </div>
                    <div className="text-sm text-yellow-600 font-bold mt-1">
                      المكافأة: +100 ج.م لكل عميل نشط (MRCB) + نسبة 50% على PT
                    </div>
                  </div>
                </div>

                <div className="bg-blue-100 rounded-lg p-3 text-sm text-gray-700">
                  <span className="font-bold">ملاحظة:</span> يمكن لأكثر من كوتش تحقيق Top Achiever في نفس الشهر. التقييم شهري (ليس تراكمي).
                </div>
              </div>
            </div>

            {/* Column Explanations */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold mb-4">🔍 {t('coachIncome.columnExplanation')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-bold text-green-600">{t('coachIncome.tabs.onboarding')}:</span> {t('coachIncome.onboardingDesc')}
                </div>
                <div>
                  <span className="font-bold text-blue-600">{t('coachIncome.tabs.mrcb')}:</span> {t('coachIncome.mrcbDesc')}
                </div>
                <div>
                  <span className="font-bold text-yellow-600">Top Achiever Bonus:</span> مكافأة إضافية لكل عميل نشط عند تحقيق الأهداف
                </div>
                <div>
                  <span className="font-bold text-purple-600">{t('coachIncome.tabs.upsells')}:</span> {t('coachIncome.upsellsDesc')}
                </div>
                <div>
                  <span className="font-bold text-orange-600">PT:</span> {t('coachIncome.ptDesc')}
                </div>
                <div>
                  <span className="font-bold text-gray-700">PT Rate:</span> نسبة عمولة PT (30% عادي، 50% لـ Double Target)
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!calculating && !allCoachesData && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="text-9xl mb-6">🧮</div>
          <p className="text-gray-500 text-xl text-center">
            {t('coachIncome.selectMonthAndRefresh')}
          </p>
        </div>
      )}
    </div>
  )
}
