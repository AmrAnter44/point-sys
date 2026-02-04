'use client'

import { useLanguage } from '../contexts/LanguageContext'
import { convertPointsToEGP } from '../lib/loyaltySystem'

interface LoyaltyPointsCardProps {
  pointsBalance: number
  totalEarned: number
  totalRedeemed: number
}

export default function LoyaltyPointsCard({
  pointsBalance,
  totalEarned,
  totalRedeemed
}: LoyaltyPointsCardProps) {
  const { t } = useLanguage()
  const egpValue = convertPointsToEGP(pointsBalance)

  return (
    <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-lg p-6 border-r-4 border-orange-600 text-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <p className="text-white/90 text-sm font-medium">{t('memberDetails.loyaltyPoints.loyaltyPoints')}</p>
          <div className="flex items-baseline gap-3 mt-1">
            <p className="text-5xl font-bold">{pointsBalance.toLocaleString()}</p>
            <div className="bg-white/20 rounded-lg px-3 py-1 backdrop-blur-sm">
              <p className="text-sm font-semibold text-white">≈ {egpValue.toLocaleString()} ج.م</p>
            </div>
          </div>
          <p className="text-white/80 text-xs mt-2">
            ✨ {t('memberDetails.loyaltyPoints.totalEarned')}: {totalEarned.toLocaleString()}
          </p>
          <p className="text-white/80 text-xs">
            🎁 {t('memberDetails.loyaltyPoints.totalRedeemed')}: {totalRedeemed.toLocaleString()}
          </p>
        </div>
        <div className="text-6xl">⭐</div>
      </div>
    </div>
  )
}
