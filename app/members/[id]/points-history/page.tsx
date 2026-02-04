'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import { convertPointsToEGP } from '@/lib/loyaltySystem'

interface Transaction {
  id: string
  type: string
  source: string
  points: number
  description: string
  staffName: string | null
  createdAt: string
}

interface Loyalty {
  pointsBalance: number
  totalEarned: number
  totalRedeemed: number
  transactions: Transaction[]
}

interface Member {
  id: string
  name: string
  memberNumber: number | null
  loyalty: Loyalty | null
}

export default function PointsHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const { t, direction } = useLanguage()
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMember = async () => {
      try {
        const response = await fetch(`/api/members/${params.id}`)
        const data = await response.json()

        if (!response.ok) {
          router.push('/members')
          return
        }

        setMember(data)
      } catch (error) {
        console.error('Error fetching member:', error)
        router.push('/members')
      } finally {
        setLoading(false)
      }
    }

    fetchMember()
  }, [params.id, router])

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center py-12">
          {t('memberDetails.loading')}
        </div>
      </div>
    )
  }

  if (!member) {
    return null
  }

  const getSourceLabel = (source: string) => {
    const emoji: Record<string, string> = {
      purchase: '💳',
      upgrade: '⬆️',
      referral: '👥',
      birthday: '🎂',
      goal: '🏆',
      review: '⭐',
      session: '📚'
    }
    return `${emoji[source] || ''} ${t(`memberDetails.loyaltyPoints.history.sources.${source}`) || source}`
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl" dir={direction}>
      <div className="mb-6">
        <Link
          href={`/members/${params.id}`}
          className="text-orange-600 hover:underline text-sm"
        >
          ← {t('memberDetails.loyaltyPoints.history.backToMember')}
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {t('memberDetails.loyaltyPoints.history.title')}
        </h1>
        <p className="text-gray-600">
          {member.name} - {t('memberDetails.loyaltyPoints.history.memberNumber')}: {member.memberNumber || t('memberDetails.loyaltyPoints.history.undefined')}
        </p>

        {member.loyalty && (
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-yellow-50 border-r-4 border-yellow-500 p-4 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">{t('memberDetails.loyaltyPoints.history.currentBalance')}</p>
              <p className="text-3xl font-bold text-yellow-600">
                {member.loyalty.pointsBalance.toLocaleString()}
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                ≈ {convertPointsToEGP(member.loyalty.pointsBalance).toLocaleString()} ج.م
              </p>
            </div>
            <div className="bg-green-50 border-r-4 border-green-500 p-4 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">{t('memberDetails.loyaltyPoints.totalEarned')}</p>
              <p className="text-3xl font-bold text-green-600">
                {member.loyalty.totalEarned.toLocaleString()}
              </p>
            </div>
            <div className="bg-purple-50 border-r-4 border-purple-500 p-4 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">{t('memberDetails.loyaltyPoints.totalRedeemed')}</p>
              <p className="text-3xl font-bold text-purple-600">
                {member.loyalty.totalRedeemed.toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t('memberDetails.loyaltyPoints.history.date')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t('memberDetails.loyaltyPoints.history.type')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t('memberDetails.loyaltyPoints.history.description')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  {t('memberDetails.loyaltyPoints.history.points')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {member.loyalty?.transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(transaction.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      {getSourceLabel(transaction.source)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-800">
                    {transaction.description}
                    {transaction.staffName && (
                      <span className="text-gray-500 text-xs block mt-1">
                        {t('memberDetails.loyaltyPoints.history.byStaff')}: {transaction.staffName}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold">
                    <span className={transaction.type === 'earn' ? 'text-green-600' : 'text-red-600'}>
                      {transaction.type === 'earn' ? '+' : '-'}{Math.abs(transaction.points)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(!member.loyalty || member.loyalty.transactions.length === 0) && (
            <div className="text-center py-12 text-gray-500">
              {t('memberDetails.loyaltyPoints.history.noTransactions')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
