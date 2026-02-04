'use client'

import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import SuccessDialog from './SuccessDialog'
import { useLanguage } from '../contexts/LanguageContext'

interface RedemptionModalProps {
  isOpen: boolean
  memberId: string
  memberName: string
  currentPoints: number
  onClose: () => void
  onSuccess: () => void
}

const REWARDS = [
  {
    type: 'CASHBACK',
    points: 500,
    icon: '💰',
    titleKey: 'memberDetails.loyaltyPoints.redemption.cashbackReward',
    descKey: 'memberDetails.loyaltyPoints.redemption.cashbackDesc',
    color: 'from-green-400 to-emerald-500'
  },
  {
    type: 'DAY_ACCESS',
    points: 1000,
    icon: '🏊',
    titleKey: 'memberDetails.loyaltyPoints.redemption.dayAccessReward',
    descKey: 'memberDetails.loyaltyPoints.redemption.dayAccessDesc',
    color: 'from-cyan-400 to-blue-500',
    hasSubOptions: true,
    subOptions: [
      { value: 'POOL', labelKey: 'memberDetails.loyaltyPoints.redemption.poolDayAccess', icon: '🏊' },
      { value: 'PADEL', labelKey: 'memberDetails.loyaltyPoints.redemption.padelDayAccess', icon: '🎾' }
    ]
  },
  {
    type: 'SPECIALIZED_SERVICE',
    points: 1500,
    icon: '💪',
    titleKey: 'memberDetails.loyaltyPoints.redemption.specializedServiceReward',
    descKey: 'memberDetails.loyaltyPoints.redemption.specializedServiceDesc',
    color: 'from-teal-400 to-green-500',
    hasSubOptions: true,
    subOptions: [
      { value: 'NUTRITION', labelKey: 'memberDetails.loyaltyPoints.redemption.nutritionSession', icon: '🥗' },
      { value: 'PHYSIOTHERAPY', labelKey: 'memberDetails.loyaltyPoints.redemption.physiotherapySession', icon: '🏥' }
    ]
  },
  {
    type: 'FREE_MONTH',
    points: 3000,
    icon: '📅',
    titleKey: 'memberDetails.loyaltyPoints.redemption.freeMonthReward',
    descKey: 'memberDetails.loyaltyPoints.redemption.freeMonthDesc',
    color: 'from-blue-400 to-cyan-500'
  },
  {
    type: 'FREE_YEAR',
    points: 6000,
    icon: '🏆',
    titleKey: 'memberDetails.loyaltyPoints.redemption.freeYearReward',
    descKey: 'memberDetails.loyaltyPoints.redemption.freeYearDesc',
    color: 'from-purple-400 to-pink-500'
  }
]

export default function RedemptionModal({
  isOpen,
  memberId,
  memberName,
  currentPoints,
  onClose,
  onSuccess
}: RedemptionModalProps) {
  const { t, locale } = useLanguage()
  const [selectedReward, setSelectedReward] = useState<string | null>(null)
  const [selectedSubOption, setSelectedSubOption] = useState<string | null>(null)
  const [showSubOptions, setShowSubOptions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [message, setMessage] = useState('')

  const handleRewardClick = (rewardType: string, requiredPoints: number) => {
    if (currentPoints < requiredPoints) return

    const reward = REWARDS.find(r => r.type === rewardType)
    setSelectedReward(rewardType)

    // If reward has sub-options, show sub-option selector
    if (reward?.hasSubOptions) {
      setShowSubOptions(true)
    } else {
      setShowConfirm(true)
    }
  }

  const handleSubOptionSelect = (subOption: string) => {
    setSelectedSubOption(subOption)
    setShowSubOptions(false)
    setShowConfirm(true)
  }

  const handleConfirmRedeem = async () => {
    if (!selectedReward) return

    setLoading(true)
    setShowConfirm(false)

    try {
      const body: any = { memberId, rewardType: selectedReward }

      // Include sub-option if selected
      if (selectedSubOption) {
        body.subOption = selectedSubOption
      }

      const response = await fetch('/api/loyalty/redeem-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (response.ok) {
        const reward = REWARDS.find(r => r.type === selectedReward)
        setMessage(t('memberDetails.loyaltyPoints.redemption.successMessage').replace('{points}', `${reward?.points.toLocaleString()} ${t('memberDetails.loyaltyPoints.redemption.points')}`))
        setShowSuccess(true)

        setTimeout(() => {
          onSuccess()
          handleClose()
        }, 2000)
      } else {
        setMessage(`❌ ${data.error}`)
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      setMessage(`❌ ${t('memberDetails.loyaltyPoints.redemption.error')}`)
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedReward(null)
    setSelectedSubOption(null)
    setShowSubOptions(false)
    setShowConfirm(false)
    setShowSuccess(false)
    setMessage('')
    onClose()
  }

  if (!isOpen) return null

  const selectedRewardData = REWARDS.find(r => r.type === selectedReward)

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 rounded-t-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">{t('memberDetails.loyaltyPoints.redemption.title')}</h2>
                <p className="text-white/90 text-sm mt-1">{memberName}</p>
              </div>
              <button
                onClick={handleClose}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Current Points */}
            <div className="mt-4 bg-white/20 rounded-lg p-3 backdrop-blur-sm">
              <p className="text-white/80 text-sm">{t('memberDetails.loyaltyPoints.redemption.currentBalance')}</p>
              <p className="text-3xl font-bold text-white">{currentPoints.toLocaleString()} {t('memberDetails.loyaltyPoints.redemption.points')}</p>
            </div>
          </div>

          {/* Rewards Grid */}
          <div className="p-6 space-y-4">
            {REWARDS.map((reward) => {
              const canAfford = currentPoints >= reward.points

              return (
                <button
                  key={reward.type}
                  onClick={() => handleRewardClick(reward.type, reward.points)}
                  disabled={!canAfford || loading}
                  className={`w-full text-left rounded-xl p-5 transition-all transform ${
                    canAfford
                      ? 'bg-gradient-to-r ' + reward.color + ' hover:scale-105 shadow-lg cursor-pointer'
                      : 'bg-gray-200 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-5xl">{reward.icon}</div>
                      <div>
                        <h3 className={`text-xl font-bold ${canAfford ? 'text-white' : 'text-gray-600'}`}>
                          {t(reward.titleKey)}
                        </h3>
                        <p className={`text-sm ${canAfford ? 'text-white/90' : 'text-gray-500'}`}>
                          {t(reward.descKey)}
                        </p>
                        <p className={`text-lg font-semibold mt-1 ${canAfford ? 'text-white' : 'text-gray-600'}`}>
                          {reward.points.toLocaleString()} {t('memberDetails.loyaltyPoints.redemption.points')}
                        </p>
                      </div>
                    </div>

                    {canAfford ? (
                      <div className="bg-white/20 rounded-full px-4 py-2 text-white font-medium">
                        {t('memberDetails.loyaltyPoints.redemption.redeemNow')}
                      </div>
                    ) : (
                      <div className="bg-gray-300 rounded-full px-4 py-2 text-gray-600 text-sm">
                        {t('memberDetails.loyaltyPoints.redemption.notAvailable')}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Message */}
          {message && (
            <div className="px-6 pb-4">
              <div className={`p-3 rounded-lg ${
                message.includes('❌') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}>
                {message}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="bg-gray-50 p-4 rounded-b-2xl">
            <button
              onClick={handleClose}
              className="w-full py-3 bg-gray-300 hover:bg-gray-400 rounded-lg font-medium transition-colors"
            >
              {t('memberDetails.loyaltyPoints.redemption.close')}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Option Selection Modal */}
      {showSubOptions && selectedRewardData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-orange-400 to-yellow-500 p-6 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">
                {t('memberDetails.loyaltyPoints.redemption.chooseOption')}
              </h3>
              <p className="text-white/90 text-sm mt-1">
                {t(selectedRewardData.titleKey)}
              </p>
            </div>

            <div className="p-6 space-y-3">
              {selectedRewardData.subOptions?.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSubOptionSelect(option.value)}
                  className="w-full p-4 bg-gradient-to-r from-orange-400 to-yellow-500 hover:from-orange-500 hover:to-yellow-600 text-white rounded-xl transition-all transform hover:scale-105 shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{option.icon}</span>
                    <span className="text-lg font-semibold">{t(option.labelKey)}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="bg-gray-50 p-4 rounded-b-2xl">
              <button
                onClick={() => setShowSubOptions(false)}
                className="w-full py-3 bg-gray-300 hover:bg-gray-400 rounded-lg font-medium transition-colors"
              >
                {t('memberDetails.loyaltyPoints.redemption.cancelButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {showConfirm && selectedRewardData && (
        <ConfirmDialog
          isOpen={showConfirm}
          title={t('memberDetails.loyaltyPoints.redemption.confirmTitle')}
          message={t('memberDetails.loyaltyPoints.redemption.confirmMessage')
            .replace('{points}', `${selectedRewardData.points.toLocaleString()} ${t('memberDetails.loyaltyPoints.redemption.points')}`)
            .replace('{reward}', t(selectedRewardData.titleKey))}
          confirmText={t('memberDetails.loyaltyPoints.redemption.confirmButton')}
          cancelText={t('memberDetails.loyaltyPoints.redemption.cancelButton')}
          onConfirm={handleConfirmRedeem}
          onCancel={() => setShowConfirm(false)}
          type="info"
        />
      )}

      {/* Success Dialog */}
      {showSuccess && (
        <SuccessDialog
          isOpen={showSuccess}
          title={t('memberDetails.loyaltyPoints.redemption.successTitle')}
          message={message}
          onClose={() => setShowSuccess(false)}
          type="success"
        />
      )}
    </>
  )
}
