// app/members/[id]/page.tsx - إصلاح الأرقام العشرية
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ReceiptToPrint } from '../../../components/ReceiptToPrint'
import PaymentMethodSelector from '../../../components/Paymentmethodselector'
import RenewalForm from '../../../components/RenewalForm'
import UpgradeForm from '../../../components/UpgradeForm'
import { formatDateYMD, calculateRemainingDays } from '../../../lib/dateFormatter'
import BarcodeWhatsApp from '../../../components/BarcodeWhatsApp'
import { usePermissions } from '../../../hooks/usePermissions'
import PermissionDenied from '../../../components/PermissionDenied'
import { useLanguage } from '../../../contexts/LanguageContext'
import LoyaltyPointsCard from '../../../components/LoyaltyPointsCard'
import RedemptionModal from '../../../components/RedemptionModal'
import { convertPointsToEGP } from '../../../lib/loyaltySystem'

interface Member {
  id: string
  memberNumber: number
  name: string
  phone: string
  nationalId?: string | null      // ⭐ الرقم القومي
  email?: string | null            // ⭐ البريد الإلكتروني
  inBodyScans: number
  invitations: number
  freePTSessions?: number
  subscriptionPrice: number
  subscriptionType?: string | null
  pointsCredit?: number
  remainingAmount?: number
  notes?: string
  isActive: boolean
  startDate?: string
  expiryDate?: string
  createdAt: string
  movementAssessments?: number
  nutritionSessions?: number
  monthlyAttendanceGoal?: number
  onboardingSessions?: number
  followUpSessions?: number
  groupClasses?: number
  poolSessions?: number
  paddleSessions?: number
  freezingDays?: number
  upgradeAllowedDays?: number
  isFrozen?: boolean
  freezeStartDate?: string | null
  freezeEndDate?: string | null
  currentOfferId?: string | null
  assignedCoach?: {
    id: string
    name: string
    staffCode: string
  } | null
}

interface Receipt {
  receiptNumber: number
  amount: number
  paymentMethod: string
  createdAt: string
  itemDetails: {
    memberNumber?: number
    memberName?: string
    subscriptionPrice?: number
    paidAmount?: number
    freePTSessions?: number
    inBodyScans?: number
    invitations?: number
    startDate?: string
    expiryDate?: string
    subscriptionDays?: number
    [key: string]: any
  }
}

export default function MemberDetailPage() {
  const params = useParams()
  const router = useRouter()
  const memberId = params.id as string
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const { t, direction } = useLanguage()

  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [showRenewalForm, setShowRenewalForm] = useState(false)
  const [showUpgradeForm, setShowUpgradeForm] = useState(false)
  const [lastReceiptNumber, setLastReceiptNumber] = useState<number | null>(null)
  const [ptSubscription, setPtSubscription] = useState<any>(null)
  const [loyalty, setLoyalty] = useState<any>(null)
  const [showRedemptionModal, setShowRedemptionModal] = useState(false)
  const [nutritionPackages, setNutritionPackages] = useState<any[]>([])
  const [physioPackages, setPhysioPackages] = useState<any[]>([])

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)

  const [freezeData, setFreezeData] = useState({
    days: 0,
    startDate: '',
    reason: ''
  })

  const [useFreezingDaysData, setUseFreezingDaysData] = useState({
    days: 0
  })

  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'cash',
    notes: ''
  })

  const [invitationData, setInvitationData] = useState({
    guestName: '',
    guestPhone: '',
    notes: ''
  })

  const [editBasicInfoData, setEditBasicInfoData] = useState({
    name: '',
    phone: '',
    nationalId: '',      // ⭐ الرقم القومي
    email: '',           // ⭐ البريد الإلكتروني
    subscriptionPrice: 0,
    subscriptionType: '1month',
    inBodyScans: 0,
    invitations: 0,
    freePTSessions: 0,
    notes: '',
    startDate: '',
    expiryDate: '',
    freezeStartDate: '',
    freezeEndDate: '',
    isFrozen: false,
    movementAssessments: 0,
    nutritionSessions: 0,
    onboardingSessions: 0,
    followUpSessions: 0,
    groupClasses: 0,
    poolSessions: 0,
    paddleSessions: 0,
    freezingDays: 0,
    monthlyAttendanceGoal: 0,
    upgradeAllowedDays: 0
  })

  const [activeModal, setActiveModal] = useState<string | null>(null)

  // سجل الحضور
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceStartDate, setAttendanceStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30) // آخر 30 يوم
    return date.toISOString().split('T')[0]
  })
  const [attendanceEndDate, setAttendanceEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const fetchMember = async () => {
    try {
      const response = await fetch('/api/members')
      const members = await response.json()
      const foundMember = members.find((m: Member) => m.id === memberId)

      if (foundMember) {
        // ✅ تحويل كل الأرقام لـ integers
        const memberWithDefaults = {
          ...foundMember,
          memberNumber: parseInt(foundMember.memberNumber?.toString() || '0'),
          freePTSessions: parseInt(foundMember.freePTSessions?.toString() || '0'),
          inBodyScans: parseInt(foundMember.inBodyScans?.toString() || '0'),
          invitations: parseInt(foundMember.invitations?.toString() || '0'),
          subscriptionPrice: parseInt(foundMember.subscriptionPrice?.toString() || '0'),
          remainingAmount: parseInt(foundMember.remainingAmount?.toString() || '0')
        }

        console.log('Member data:', memberWithDefaults)
        setMember(memberWithDefaults)

        // جلب آخر إيصال للعضو
        fetchLastReceipt(memberId)
      } else {
        setMessage(`❌ ${t('memberDetails.memberNotFound')}`)
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage(`❌ ${t('memberDetails.errorLoadingData')}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchAttendanceHistory = async () => {
    setAttendanceLoading(true)
    try {
      const response = await fetch(
        `/api/member-checkin/history?memberId=${memberId}&startDate=${attendanceStartDate}&endDate=${attendanceEndDate}`
      )
      const data = await response.json()

      if (data.success) {
        setAttendanceHistory(data.checkIns || [])
      } else {
        console.error('Error fetching attendance history')
        setAttendanceHistory([])
      }
    } catch (error) {
      console.error('Error fetching attendance history:', error)
      setAttendanceHistory([])
    } finally {
      setAttendanceLoading(false)
    }
  }

  const fetchLastReceipt = async (memberId: string) => {
    try {
      const response = await fetch(`/api/receipts?memberId=${memberId}`)
      if (response.ok) {
        const receipts = await response.json()
        if (receipts && receipts.length > 0) {
          // أول إيصال في القائمة هو الأحدث (orderBy createdAt desc)
          setLastReceiptNumber(receipts[0].receiptNumber)
        }
      }
    } catch (error) {
      console.error('Error fetching last receipt:', error)
    }
  }


  const fetchPTSubscription = async () => {
    if (!member) return

    try {
      const response = await fetch('/api/pt')
      if (response.ok) {
        const allPTs = await response.json()
        // البحث عن PT نشط للعضو بناءً على رقم الهاتف
        const activePT = allPTs.find((pt: any) =>
          pt.phone === member.phone &&
          pt.sessionsRemaining > 0 &&
          (!pt.expiryDate || new Date(pt.expiryDate) > new Date())
        )
        setPtSubscription(activePT || null)
      }
    } catch (error) {
      console.error('Error fetching PT subscription:', error)
      setPtSubscription(null)
    }
  }

  const fetchLoyalty = async () => {
    try {
      const response = await fetch(`/api/loyalty?memberId=${memberId}`)
      if (response.ok) {
        const data = await response.json()
        setLoyalty(data)
      } else {
        setLoyalty(null)
      }
    } catch (error) {
      console.error('Error fetching loyalty data:', error)
      setLoyalty(null)
    }
  }

  const fetchNutritionPackages = async () => {
    try {
      const response = await fetch(`/api/nutrition?memberId=${memberId}`)
      if (response.ok) {
        const data = await response.json()
        setNutritionPackages(data)
      }
    } catch (error) {
      console.error('Error fetching nutrition packages:', error)
    }
  }

  const fetchPhysioPackages = async () => {
    try {
      const response = await fetch(`/api/physiotherapy?memberId=${memberId}`)
      if (response.ok) {
        const data = await response.json()
        setPhysioPackages(data)
      }
    } catch (error) {
      console.error('Error fetching physio packages:', error)
    }
  }

  useEffect(() => {
    fetchMember()
    fetchAttendanceHistory()
    fetchLoyalty()
    fetchNutritionPackages()
    fetchPhysioPackages()
  }, [memberId])

  useEffect(() => {
    if (member) {
      fetchPTSubscription()
    }
  }, [member])

  const handlePayment = async () => {
    if (!member || paymentData.amount <= 0) {
      setMessage(`⚠️ ${t('memberDetails.paymentModal.enterValidAmount')}`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    if (paymentData.amount > member.remainingAmount) {
      setMessage(`⚠️ ${t('memberDetails.paymentModal.amountExceedsRemaining')}`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // ✅ تحويل لـ integer
      const cleanAmount = parseInt(paymentData.amount.toString())
      const newRemaining = member.remainingAmount - cleanAmount

      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          remainingAmount: newRemaining
        })
      })

      if (response.ok) {
        const receiptResponse = await fetch('/api/receipts/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: member.id,
            amount: cleanAmount,
            paymentMethod: paymentData.paymentMethod,
            notes: paymentData.notes
          })
        })

        if (receiptResponse.ok) {
          const receipt = await receiptResponse.json()
          setReceiptData({
            receiptNumber: receipt.receiptNumber,
            type: 'Payment',
            amount: receipt.amount,
            details: JSON.parse(receipt.itemDetails),
            date: new Date(receipt.createdAt),
            paymentMethod: paymentData.paymentMethod
          })
          setShowReceipt(true)
          setLastReceiptNumber(receipt.receiptNumber)
        }

        setMessage(`✅ ${t('memberDetails.paymentModal.paymentSuccess')}`)
        setTimeout(() => setMessage(''), 3000)

        setPaymentData({ amount: 0, paymentMethod: 'cash', notes: '' })
        setActiveModal(null)
        fetchMember()
      } else {
        setMessage(`❌ ${t('memberDetails.paymentModal.paymentFailed')}`)
      }
    } catch (error) {
      console.error(error)
      setMessage(`❌ ${t('memberDetails.error')}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUseInBody = async () => {
    if (!member || (member.inBodyScans ?? 0) <= 0) {
      setMessage(`⚠️ ${t('memberDetails.noInBodyRemaining')}`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setConfirmModal({
      show: true,
      title: `⚖️ ${t('memberDetails.useInBody')}`,
      message: t('memberDetails.confirmUseInBody'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: member.id,
              inBodyScans: (member.inBodyScans ?? 0) - 1
            })
          })

          if (response.ok) {
            setMessage(`✅ ${t('memberDetails.inBodyUsed')}`)
            setTimeout(() => setMessage(''), 3000)
            fetchMember()
          }
        } catch (error) {
          setMessage(`❌ ${t('memberDetails.error')}`)
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUseInvitation = async () => {
    if (!member || (member.invitations ?? 0) <= 0) {
      setMessage(`⚠️ ${t('memberDetails.noInvitationsRemaining')}`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setActiveModal('invitation')
  }

  const handleSubmitInvitation = async () => {
    if (!member) return

    if (!invitationData.guestName.trim() || !invitationData.guestPhone.trim()) {
      setMessage(`⚠️ ${t('memberDetails.invitationModal.enterGuestInfo')}`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          guestName: invitationData.guestName.trim(),
          guestPhone: invitationData.guestPhone.trim(),
          notes: invitationData.notes.trim() || undefined
        })
      })

      const result = await response.json()

      if (response.ok) {
        setMessage(`✅ ${t('memberDetails.invitationModal.invitationSuccess')}`)
        setTimeout(() => setMessage(''), 3000)

        setInvitationData({
          guestName: '',
          guestPhone: '',
          notes: ''
        })
        setActiveModal(null)

        fetchMember()
      } else {
        setMessage(`❌ ${result.error || t('memberDetails.invitationModal.invitationFailed')}`)
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      console.error(error)
      setMessage(`❌ ${t('memberDetails.connectionError')}`)
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleUseFreePT = async () => {
    if (!member || (member.freePTSessions ?? 0) <= 0) {
      setMessage(`⚠️ ${t('memberDetails.noFreePTRemaining')}`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setConfirmModal({
      show: true,
      title: `💪 ${t('memberDetails.useFreePT')}`,
      message: t('memberDetails.confirmUseFreePT'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: member.id,
              freePTSessions: (member.freePTSessions ?? 0) - 1
            })
          })

          if (response.ok) {
            setMessage(`✅ ${t('memberDetails.freePTUsed')}`)
            setTimeout(() => setMessage(''), 3000)
            fetchMember()
          }
        } catch (error) {
          setMessage(`❌ ${t('memberDetails.error')}`)
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUseMovementAssessment = async () => {
    if (!member || (member.movementAssessments ?? 0) <= 0) {
      setMessage(`⚠️ لا توجد تقييمات حركة متبقية`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setConfirmModal({
      show: true,
      title: `🏃 ${t('memberDetails.confirmModal.movementAssessment.title')}`,
      message: t('memberDetails.confirmModal.movementAssessment.message'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: member.id,
              movementAssessments: (member.movementAssessments ?? 0) - 1
            })
          })

          if (response.ok) {
            setMessage(`✅ تم استخدام تقييم حركة`)
            setTimeout(() => setMessage(''), 3000)
            fetchMember()
          }
        } catch (error) {
          setMessage(`❌ ${t('memberDetails.error')}`)
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUseNutritionSession = async () => {
    if (!member || (member.nutritionSessions ?? 0) <= 0) {
      setMessage(`⚠️ لا توجد جلسات تغذية متبقية`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setConfirmModal({
      show: true,
      title: `🥗 ${t('memberDetails.confirmModal.nutrition.title')}`,
      message: t('memberDetails.confirmModal.nutrition.message'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          // تسجيل استخدام الجلسة في سجل الجلسات المجانية
          const recordResponse = await fetch('/api/free-nutrition-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: member.id,
              notes: 'تم الاستخدام من صفحة العضو'
            })
          })

          if (recordResponse.ok) {
            setMessage(`✅ تم استخدام جلسة تغذية وتسجيلها في السجل`)
            setTimeout(() => setMessage(''), 3000)
            fetchMember()
          } else {
            const errorData = await recordResponse.json()
            setMessage(`❌ ${errorData.error || 'حدث خطأ'}`)
            setTimeout(() => setMessage(''), 3000)
          }
        } catch (error) {
          setMessage(`❌ ${t('memberDetails.error')}`)
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUseOnboardingSession = async () => {
    if (!member || (member.onboardingSessions ?? 0) <= 0) {
      setMessage(`⚠️ لا توجد جلسات تعريف متبقية`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setConfirmModal({
      show: true,
      title: `👋 ${t('memberDetails.confirmModal.onboarding.title')}`,
      message: t('memberDetails.confirmModal.onboarding.message'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: member.id,
              onboardingSessions: (member.onboardingSessions ?? 0) - 1
            })
          })

          if (response.ok) {
            setMessage(`✅ تم استخدام جلسة تعريف`)
            setTimeout(() => setMessage(''), 3000)
            fetchMember()
          }
        } catch (error) {
          setMessage(`❌ ${t('memberDetails.error')}`)
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUseFollowUpSession = async () => {
    if (!member || (member.followUpSessions ?? 0) <= 0) {
      setMessage(`⚠️ لا توجد جلسات متابعة متبقية`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setConfirmModal({
      show: true,
      title: `📋 ${t('memberDetails.confirmModal.followUp.title')}`,
      message: t('memberDetails.confirmModal.followUp.message'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: member.id,
              followUpSessions: (member.followUpSessions ?? 0) - 1
            })
          })

          if (response.ok) {
            setMessage(`✅ تم استخدام جلسة متابعة`)
            setTimeout(() => setMessage(''), 3000)
            fetchMember()
          }
        } catch (error) {
          setMessage(`❌ ${t('memberDetails.error')}`)
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUseGroupClass = async () => {
    if (!member || (member.groupClasses ?? 0) <= 0) {
      setMessage(`⚠️ لا توجد حصص جماعية متبقية`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setConfirmModal({
      show: true,
      title: `👥 ${t('memberDetails.confirmModal.groupClass.title')}`,
      message: t('memberDetails.confirmModal.groupClass.message'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: member.id,
              groupClasses: (member.groupClasses ?? 0) - 1
            })
          })

          if (response.ok) {
            setMessage(`✅ تم استخدام حصة جماعية`)
            setTimeout(() => setMessage(''), 3000)
            fetchMember()
          }
        } catch (error) {
          setMessage(`❌ ${t('memberDetails.error')}`)
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUsePoolSession = async () => {
    if (!member || (member.poolSessions ?? 0) <= 0) {
      setMessage(`⚠️ لا توجد جلسات مسبح متبقية`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    // إذا كانت 999 (غير محدود)، لا نخصم
    if (member.poolSessions === 999) {
      setMessage(`ℹ️ جلسات المسبح غير محدودة`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setConfirmModal({
      show: true,
      title: `🏊 ${t('memberDetails.confirmModal.pool.title')}`,
      message: t('memberDetails.confirmModal.pool.message'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: member.id,
              poolSessions: (member.poolSessions ?? 0) - 1
            })
          })

          if (response.ok) {
            setMessage(`✅ تم استخدام جلسة مسبح`)
            setTimeout(() => setMessage(''), 3000)
            fetchMember()
          }
        } catch (error) {
          setMessage(`❌ ${t('memberDetails.error')}`)
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUsePaddleSession = async () => {
    if (!member || (member.paddleSessions ?? 0) <= 0) {
      setMessage(`⚠️ لا توجد جلسات بادل متبقية`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setConfirmModal({
      show: true,
      title: `🎾 ${t('memberDetails.confirmModal.paddle.title')}`,
      message: t('memberDetails.confirmModal.paddle.message'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: member.id,
              paddleSessions: (member.paddleSessions ?? 0) - 1
            })
          })

          if (response.ok) {
            setMessage(`✅ تم استخدام جلسة بادل`)
            setTimeout(() => setMessage(''), 3000)
            fetchMember()
          }
        } catch (error) {
          setMessage(`❌ ${t('memberDetails.error')}`)
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUseFreezingDay = async () => {
    if (!member || (member.freezingDays ?? 0) <= 0) {
      setMessage(t('memberDetails.useFreezingDaysModal.noDaysAvailable'))
      setTimeout(() => setMessage(''), 3000)
      return
    }

    if (!member.expiryDate) {
      setMessage(t('memberDetails.useFreezingDaysModal.noExpiryDate'))
      setTimeout(() => setMessage(''), 3000)
      return
    }

    // فتح modal لإدخال عدد الأيام
    setActiveModal('use-freezing-days')
  }

  const handleApplyFreezingDays = async () => {
    if (!member || !member.expiryDate) return

    const daysToUse = useFreezingDaysData.days

    if (daysToUse <= 0) {
      setMessage(t('memberDetails.useFreezingDaysModal.enterValidDays'))
      setTimeout(() => setMessage(''), 3000)
      return
    }

    if (daysToUse > (member.freezingDays ?? 0)) {
      setMessage(t('memberDetails.useFreezingDaysModal.exceedsAvailable', { available: String(member.freezingDays ?? 0) }))
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setLoading(true)
    try {
      // حساب التاريخ الجديد
      const currentExpiry = new Date(member.expiryDate)
      const newExpiry = new Date(currentExpiry.getTime() + (daysToUse * 24 * 60 * 60 * 1000))

      // تعيين تواريخ التجميد
      const freezeStart = new Date()
      const freezeEnd = new Date()
      freezeEnd.setDate(freezeEnd.getDate() + daysToUse)

      const payload = {
        id: member.id,
        freezingDays: (member.freezingDays ?? 0) - daysToUse,
        expiryDate: newExpiry.toISOString(),
        freezeStartDate: freezeStart.toISOString(),
        freezeEndDate: freezeEnd.toISOString(),
        isFrozen: true
      }

      console.log('📤 استخدام أيام التجميد - البيانات المُرسلة:', payload)

      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const updatedMember = await response.json()
        console.log('✅ رد الـ API:', {
          isFrozen: updatedMember.isFrozen,
          freezeStartDate: updatedMember.freezeStartDate,
          freezeEndDate: updatedMember.freezeEndDate
        })

        setMessage(t('memberDetails.useFreezingDaysModal.useSuccess', { days: String(daysToUse) }))
        setTimeout(() => setMessage(''), 3000)
        setActiveModal(null)
        setUseFreezingDaysData({ days: 0 })
        fetchMember()
      } else {
        const error = await response.json()
        console.error('❌ خطأ:', error)
        setMessage(t('memberDetails.useFreezingDaysModal.useFailed'))
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      setMessage(`❌ ${t('memberDetails.error')}`)
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  // ⭐ دالة استلام المكافأة النقدية للإحالات
  const handleRedeemCashReward = async () => {
    if (!confirm(t('memberDetails.confirmRedeemCashReward'))) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/loyalty/redeem-cash-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member?.id })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ ${t('memberDetails.cashRewardRedeemedSuccess')}`)
        fetchMember()
        fetchLoyalty()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch (error) {
      setMessage(`❌ ${t('memberDetails.cashRewardRedeemError')}`)
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(''), 5000)
    }
  }

  const handleEditBasicInfo = async () => {
    if (!member || !editBasicInfoData.name.trim() || !editBasicInfoData.phone.trim()) {
      setMessage(`⚠️ ${t('memberDetails.editModal.enterNameAndPhone')}`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          name: editBasicInfoData.name.trim(),
          phone: editBasicInfoData.phone.trim(),
          nationalId: editBasicInfoData.nationalId.trim() || null,  // ⭐ الرقم القومي
          email: editBasicInfoData.email.trim() || null,            // ⭐ البريد الإلكتروني
          subscriptionPrice: parseInt(editBasicInfoData.subscriptionPrice.toString()),
          subscriptionType: editBasicInfoData.subscriptionType,
          inBodyScans: parseInt(editBasicInfoData.inBodyScans.toString()),
          invitations: parseInt(editBasicInfoData.invitations.toString()),
          freePTSessions: parseInt(editBasicInfoData.freePTSessions.toString()),
          notes: editBasicInfoData.notes.trim() || null,
          startDate: editBasicInfoData.startDate || null,
          expiryDate: editBasicInfoData.expiryDate || null,
          freezeStartDate: editBasicInfoData.freezeStartDate || null,
          freezeEndDate: editBasicInfoData.freezeEndDate || null,
          isFrozen: editBasicInfoData.isFrozen,
          movementAssessments: parseInt(editBasicInfoData.movementAssessments.toString()),
          nutritionSessions: parseInt(editBasicInfoData.nutritionSessions.toString()),
          onboardingSessions: parseInt(editBasicInfoData.onboardingSessions.toString()),
          followUpSessions: parseInt(editBasicInfoData.followUpSessions.toString()),
          groupClasses: parseInt(editBasicInfoData.groupClasses.toString()),
          poolSessions: parseInt(editBasicInfoData.poolSessions.toString()),
          paddleSessions: parseInt(editBasicInfoData.paddleSessions.toString()),
          freezingDays: parseInt(editBasicInfoData.freezingDays.toString()),
          monthlyAttendanceGoal: parseInt(editBasicInfoData.monthlyAttendanceGoal.toString()),
          upgradeAllowedDays: parseInt(editBasicInfoData.upgradeAllowedDays.toString())
        })
      })

      if (response.ok) {
        setMessage(`✅ ${t('memberDetails.editModal.updateSuccess')}`)
        setTimeout(() => setMessage(''), 3000)

        setEditBasicInfoData({
          name: '',
          phone: '',
          nationalId: '',      // ⭐ الرقم القومي
          email: '',           // ⭐ البريد الإلكتروني
          subscriptionPrice: 0,
          subscriptionType: '1month',
          inBodyScans: 0,
          invitations: 0,
          freePTSessions: 0,
          notes: '',
          startDate: '',
          expiryDate: '',
          freezeStartDate: '',
          freezeEndDate: '',
          isFrozen: false,
          movementAssessments: 0,
          nutritionSessions: 0,
          onboardingSessions: 0,
          followUpSessions: 0,
          groupClasses: 0,
          poolSessions: 0,
          paddleSessions: 0,
          freezingDays: 0,
          monthlyAttendanceGoal: 0,
          upgradeAllowedDays: 0
        })
        setActiveModal(null)
        fetchMember()
      } else {
        const result = await response.json()
        setMessage(`❌ ${result.error || t('memberDetails.editModal.updateFailed')}`)
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      console.error(error)
      setMessage(`❌ ${t('memberDetails.connectionError')}`)
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleFreeze = async () => {
    if (!member || !member.expiryDate || freezeData.days <= 0 || !freezeData.startDate) {
      setMessage(`⚠️ ${t('memberDetails.freezeModal.enterValidDays')}`)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setLoading(true)
    try {
      const cleanDays = parseInt(freezeData.days.toString())

      // حساب تواريخ التجميد
      const freezeStart = new Date(freezeData.startDate)
      const freezeEnd = new Date(freezeStart)
      freezeEnd.setDate(freezeEnd.getDate() + cleanDays)

      // إضافة نفس المدة لتاريخ انتهاء الاشتراك
      const currentExpiry = new Date(member.expiryDate)
      const newExpiry = new Date(currentExpiry)
      newExpiry.setDate(newExpiry.getDate() + cleanDays)

      const freezePayload = {
        id: member.id,
        expiryDate: newExpiry.toISOString(),
        freezeStartDate: freezeStart.toISOString(),
        freezeEndDate: freezeEnd.toISOString(),
        isFrozen: true
      }

      console.log('📤 إرسال بيانات التجميد:', freezePayload)

      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(freezePayload)
      })

      if (response.ok) {
        const updatedMember = await response.json()
        console.log('✅ رد الـ API:', {
          isFrozen: updatedMember.isFrozen,
          freezeStartDate: updatedMember.freezeStartDate,
          freezeEndDate: updatedMember.freezeEndDate
        })

        setMessage(t('memberDetails.freezeModal.freezeSuccess', { days: cleanDays.toString() }))
        setTimeout(() => setMessage(''), 3000)

        setFreezeData({ days: 0, startDate: '', reason: '' })
        setActiveModal(null)
        fetchMember()
      } else {
        const error = await response.json()
        console.error('❌ خطأ من API:', error)
        setMessage(`❌ ${error.error || t('memberDetails.error')}`)
      }
    } catch (error) {
      setMessage(`❌ ${t('memberDetails.error')}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGoalAchievement = async (goalType: string) => {
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/loyalty/goal-achievement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          goalType
        })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ تم منح ${data.points} نقطة بنجاح!`)
        setTimeout(() => {
          setMessage('')
          setActiveModal(null)
          fetchLoyalty()
        }, 1500)
      } else {
        setMessage(`❌ ${data.error}`)
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      setMessage('❌ حدث خطأ في منح النقاط')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleReviewBonus = async () => {
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/loyalty/review-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ تم منح ${data.points} نقطة بنجاح!`)
        setTimeout(() => {
          setMessage('')
          setActiveModal(null)
          fetchLoyalty()
        }, 1500)
      } else {
        setMessage(`❌ ${data.error}`)
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      setMessage('❌ حدث خطأ في منح النقاط')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleSessionAttendance = async (sessionType: string) => {
    setLoading(true)
    const tempMessage = message

    try {
      const response = await fetch('/api/loyalty/session-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          sessionType
        })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ تم تسجيل الحضور (+${data.points} نقطة)`)
        fetchLoyalty()
        setTimeout(() => {
          setMessage(tempMessage)
        }, 2000)
      } else {
        setMessage(`❌ ${data.error}`)
        setTimeout(() => setMessage(tempMessage), 3000)
      }
    } catch (error) {
      setMessage('❌ حدث خطأ في التسجيل')
      setTimeout(() => setMessage(tempMessage), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!member) return

    setConfirmModal({
      show: true,
      title: `⚠️ ${t('memberDetails.deleteModal.title')}`,
      message: t('memberDetails.deleteModal.confirmMessage', { name: member.name, number: member.memberNumber.toString() }),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch(`/api/members?id=${member.id}`, {
            method: 'DELETE'
          })

          if (response.ok) {
            setMessage(`✅ ${t('memberDetails.deleteModal.deleteSuccess')}`)
            setTimeout(() => {
              router.push('/members')
            }, 1500)
          } else {
            setMessage(`❌ ${t('memberDetails.deleteModal.deleteFailed')}`)
          }
        } catch (error) {
          console.error(error)
          setMessage(`❌ ${t('memberDetails.deleteModal.deleteError')}`)
        } finally {
          setLoading(false)
        }
      }
    })
  }



  if (loading && !member) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="text-6xl mb-4">⏳</div>
        <p className="text-xl">{t('memberDetails.loading')}</p>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="text-6xl mb-4">❌</div>
        <p className="text-xl mb-4">{t('memberDetails.memberNotFound')}</p>
        <button
          onClick={() => router.push('/members')}
          className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700"
        >
          {t('memberDetails.back')}
        </button>
      </div>
    )
  }

  const isExpired = member.expiryDate ? new Date(member.expiryDate) < new Date() : false
  const daysRemaining = calculateRemainingDays(member.expiryDate)

  // دالة للتحقق من حالة التجميد
  const getFreezeStatus = (member: Member) => {
    if (!member.freezeStartDate || !member.freezeEndDate) {
      return null
    }

    const now = new Date()
    const freezeStart = new Date(member.freezeStartDate)
    const freezeEnd = new Date(member.freezeEndDate)

    if (now >= freezeStart && now <= freezeEnd) {
      const remainingDays = Math.ceil((freezeEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        isFrozen: true,
        remainingDays: remainingDays
      }
    }

    return null
  }

  const freezeStatus = getFreezeStatus(member)

  return (
    <div className="container mx-auto p-3 md:p-4" dir="rtl">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h1 className="text-2xl font-bold">👤 {t('memberDetails.title')}</h1>
          <p className="text-sm text-gray-600">{t('memberDetails.subtitle')}</p>
        </div>
        <button
          onClick={() => router.push('/members')}
          className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded-lg hover:bg-gray-300 text-sm"
        >
          ← {t('memberDetails.back')}
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.includes('✅') ? 'bg-green-100 text-green-800' : message.includes('⚠️') ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}

      {/* عرض حالة التجميد */}
      {member.isFrozen && member.freezeStartDate && member.freezeEndDate && (
        <div className="mb-3 bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded-lg shadow">
          <div className="flex items-center mb-2">
            <span className="text-2xl ml-2">🔒</span>
            <h3 className="text-base font-bold text-yellow-800">الاشتراك مجمد حالياً</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-yellow-800 text-sm">
            <div>
              <p className="text-xs font-medium">📅 من:</p>
              <p className="font-bold">{formatDateYMD(member.freezeStartDate)}</p>
            </div>
            <div>
              <p className="text-xs font-medium">📅 إلى:</p>
              <p className="font-bold">{formatDateYMD(member.freezeEndDate)}</p>
            </div>
          </div>
          <p className="mt-2 text-yellow-700 text-xs font-medium">
            ⚠️ <strong>ملاحظة:</strong> العضو ممنوع من الدخول خلال فترة التجميد
          </p>
        </div>
      )}

      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl shadow-lg p-4 mb-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs opacity-90">{t('memberDetails.membershipNumber')}</p>
              <BarcodeWhatsApp
                memberNumber={member.memberNumber}
                memberName={member.name}
                memberPhone={member.phone}
              />
              {hasPermission('canEditMembers') && (
                <button
                  onClick={() => {
                    setEditBasicInfoData({
                      name: member.name,
                      phone: member.phone,
                      nationalId: member.nationalId || '',          // ⭐ الرقم القومي
                      email: member.email || '',                    // ⭐ البريد الإلكتروني
                      subscriptionPrice: member.subscriptionPrice,
                      subscriptionType: member.subscriptionType || '1month',
                      inBodyScans: member.inBodyScans ?? 0,
                      invitations: member.invitations ?? 0,
                      freePTSessions: member.freePTSessions ?? 0,
                      notes: member.notes || '',
                      startDate: member.startDate ? formatDateYMD(member.startDate) : '',
                      expiryDate: member.expiryDate ? formatDateYMD(member.expiryDate) : '',
                      freezeStartDate: member.freezeStartDate ? formatDateYMD(member.freezeStartDate) : '',
                      freezeEndDate: member.freezeEndDate ? formatDateYMD(member.freezeEndDate) : '',
                      isFrozen: member.isFrozen ?? false,
                      movementAssessments: member.movementAssessments ?? 0,
                      nutritionSessions: member.nutritionSessions ?? 0,
                      onboardingSessions: member.onboardingSessions ?? 0,
                      followUpSessions: member.followUpSessions ?? 0,
                      groupClasses: member.groupClasses ?? 0,
                      poolSessions: member.poolSessions ?? 0,
                      paddleSessions: member.paddleSessions ?? 0,
                      freezingDays: member.freezingDays ?? 0,
                      monthlyAttendanceGoal: member.monthlyAttendanceGoal ?? 0,
                      upgradeAllowedDays: member.upgradeAllowedDays ?? 0
                    })
                    setActiveModal('edit-basic-info')
                  }}
                  disabled={loading}
                  className="bg-blue-500 hover:bg-blue-600 p-2 rounded-full transition-all disabled:opacity-50 shadow-md"
                  title={t('memberDetails.editModal.editButton')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-2xl md:text-3xl font-bold">#{member.memberNumber}</p>
          </div>
          <div>
            <p className="text-xs opacity-90 mb-1">{t('memberDetails.memberName')}</p>
            <p className="text-lg md:text-xl font-bold truncate">{member.name}</p>
            {member.subscriptionType && (
              <span className="inline-block px-2 py-0.5 mt-1 text-xs font-semibold rounded-full bg-white bg-opacity-30">
                {member.subscriptionType}
              </span>
            )}
          </div>
          <div>
            <p className="text-xs opacity-90 mb-1">{t('memberDetails.phoneNumber')}</p>
            <p className="text-base md:text-lg font-mono">{member.phone}</p>
          </div>
          {member.nationalId && (
            <div>
              <p className="text-xs opacity-90 mb-1">{t('members.form.nationalId')}</p>
              <p className="text-base md:text-lg font-mono">{member.nationalId}</p>
            </div>
          )}
          {member.email && (
            <div>
              <p className="text-xs opacity-90 mb-1">{t('members.form.email')}</p>
              <p className="text-base md:text-lg font-mono">{member.email}</p>
            </div>
          )}
          <div>
            <p className="text-xs opacity-90 mb-1">👨‍🏫 {t('memberDetails.assignedCoach')}</p>
            <p className="text-base md:text-lg font-bold truncate">
              {member.assignedCoach ? member.assignedCoach.name : '---'}
            </p>
            {member.assignedCoach && (
              <p className="text-xs opacity-75">#{member.assignedCoach.staffCode}</p>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-white border-opacity-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-white bg-opacity-20 rounded-lg p-2">
              <p className="text-xs opacity-90">{t('memberDetails.status')}</p>
              <p className="text-sm font-bold">
                {freezeStatus && freezeStatus.isFrozen
                  ? `🧊 ${t('members.frozen')}`
                  : member.isActive && !isExpired
                    ? `✅ ${t('memberDetails.active')}`
                    : `❌ ${t('memberDetails.expired')}`}
              </p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-2">
              <p className="text-xs opacity-90">{t('memberDetails.expiryDate')}</p>
              <p className="text-sm font-mono">
                {formatDateYMD(member.expiryDate)}
              </p>
              {daysRemaining !== null && daysRemaining > 0 && (
                <p className="text-xs opacity-75">{t('memberDetails.daysRemaining', { days: daysRemaining.toString() })}</p>
              )}
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-2">
              <p className="text-xs opacity-90">{t('memberDetails.subscriptionPrice')}</p>
              <p className="text-lg font-bold">{member.subscriptionPrice} {t('memberDetails.egp')}</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-2">
              <p className="text-xs opacity-90">{t('memberDetails.lastReceipt')}</p>
              <p className="text-lg font-bold text-green-300">
                {lastReceiptNumber ? `#${lastReceiptNumber}` : '---'}
              </p>
            </div>
          </div>
        </div>

        {/* عرض الملاحظات */}
        {member.notes && (
          <div className="mt-3 pt-3 border-t border-white border-opacity-20">
            <div className="bg-white bg-opacity-20 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-base">📝</span>
                <p className="text-xs opacity-90 font-semibold">{t('memberDetails.notes')}</p>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{member.notes}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-3">
        <div className="bg-white rounded-lg shadow-md p-3 border-r-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-gray-600 text-xs">{t('memberDetails.inBody')}</p>
              <p className="text-2xl font-bold text-green-600">{member.inBodyScans ?? 0}</p>
            </div>
            <div className="text-3xl">⚖️</div>
          </div>
          <button
            onClick={handleUseInBody}
            disabled={(member.inBodyScans ?? 0) <= 0 || loading}
            className="w-full bg-green-600 text-white py-1.5 px-2 rounded text-xs hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {t('memberDetails.useSession')}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-3 border-r-4 border-purple-500">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-gray-600 text-xs">{t('memberDetails.invitations')}</p>
              <p className="text-2xl font-bold text-purple-600">{member.invitations ?? 0}</p>
            </div>
            <div className="text-3xl">🎟️</div>
          </div>
          <button
            onClick={handleUseInvitation}
            disabled={(member.invitations ?? 0) <= 0 || loading}
            className="w-full bg-purple-600 text-white py-1.5 px-2 rounded text-xs hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {t('memberDetails.useInvitation')}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-3 border-r-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-gray-600 text-xs">{t('memberDetails.freePTSessions')}</p>
              <p className="text-2xl font-bold text-blue-600">{member.freePTSessions ?? 0}</p>
            </div>
            <div className="text-3xl">💪</div>
          </div>
          <button
            onClick={handleUseFreePT}
            disabled={(member.freePTSessions ?? 0) <= 0 || loading}
            className="w-full bg-blue-600 text-white py-1.5 px-2 rounded text-xs hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {t('memberDetails.useSession')}
          </button>
        </div>

      {/* Package Benefits - دمجها في نفس الصف */}
        <div className="bg-white rounded-lg shadow-md p-3 border-r-4 border-orange-400">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-gray-600 text-xs">{t('memberDetails.packageBenefits.movementAssessments')}</p>
              <p className="text-2xl font-bold text-orange-600">{member.movementAssessments ?? 0}</p>
            </div>
            <div className="text-3xl">🏃</div>
          </div>
          <button
            onClick={handleUseMovementAssessment}
            disabled={(member.movementAssessments ?? 0) <= 0 || loading}
            className="w-full bg-orange-500 text-white py-1.5 px-2 rounded text-xs hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {t('memberDetails.packageBenefits.use')}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-3 border-r-4 border-green-400">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-gray-600 text-xs">{t('memberDetails.packageBenefits.nutritionSessions')}</p>
              <p className="text-2xl font-bold text-green-600">{member.nutritionSessions ?? 0}</p>
            </div>
            <div className="text-3xl">🥗</div>
          </div>
          <button
            onClick={handleUseNutritionSession}
            disabled={(member.nutritionSessions ?? 0) <= 0 || loading}
            className="w-full bg-green-500 text-white py-1.5 px-2 rounded text-xs hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {t('memberDetails.packageBenefits.use')}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-3 border-r-4 border-yellow-400">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-gray-600 text-xs">{t('memberDetails.packageBenefits.onboardingSessions')}</p>
              <p className="text-2xl font-bold text-yellow-600">{member.onboardingSessions ?? 0}</p>
            </div>
            <div className="text-3xl">👋</div>
          </div>
          <button
            onClick={handleUseOnboardingSession}
            disabled={(member.onboardingSessions ?? 0) <= 0 || loading}
            className="w-full bg-yellow-500 text-white py-1.5 px-2 rounded text-xs hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {t('memberDetails.packageBenefits.use')}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-3 border-r-4 border-pink-400">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-gray-600 text-xs">{t('memberDetails.packageBenefits.followUpSessions')}</p>
              <p className="text-2xl font-bold text-pink-600">{member.followUpSessions ?? 0}</p>
            </div>
            <div className="text-3xl">📋</div>
          </div>
          <button
            onClick={handleUseFollowUpSession}
            disabled={(member.followUpSessions ?? 0) <= 0 || loading}
            className="w-full bg-pink-500 text-white py-1.5 px-2 rounded text-xs hover:bg-pink-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {t('memberDetails.packageBenefits.use')}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-3 border-r-4 border-indigo-400">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-gray-600 text-xs">{t('memberDetails.packageBenefits.groupClasses')}</p>
              <p className="text-2xl font-bold text-indigo-600">{member.groupClasses ?? 0}</p>
            </div>
            <div className="text-3xl">👥</div>
          </div>
          <button
            onClick={handleUseGroupClass}
            disabled={(member.groupClasses ?? 0) <= 0 || loading}
            className="w-full bg-indigo-500 text-white py-1.5 px-2 rounded text-xs hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {t('memberDetails.packageBenefits.use')}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-3 border-r-4 border-cyan-400">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-gray-600 text-xs">{t('memberDetails.packageBenefits.poolSessions')}</p>
              <p className="text-2xl font-bold text-cyan-600">{member.poolSessions === 999 ? '∞' : (member.poolSessions ?? 0)}</p>
            </div>
            <div className="text-3xl">🏊</div>
          </div>
          <button
            onClick={handleUsePoolSession}
            disabled={(member.poolSessions ?? 0) <= 0 || member.poolSessions === 999 || loading}
            className="w-full bg-cyan-500 text-white py-1.5 px-2 rounded text-xs hover:bg-cyan-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {member.poolSessions === 999 ? t('memberDetails.packageBenefits.unlimited') : t('memberDetails.packageBenefits.use')}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-3 border-r-4 border-teal-400">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-gray-600 text-xs">{t('memberDetails.packageBenefits.paddleSessions')}</p>
              <p className="text-2xl font-bold text-teal-600">{member.paddleSessions ?? 0}</p>
            </div>
            <div className="text-3xl">🎾</div>
          </div>
          <button
            onClick={handleUsePaddleSession}
            disabled={(member.paddleSessions ?? 0) <= 0 || loading}
            className="w-full bg-teal-500 text-white py-1.5 px-2 rounded text-xs hover:bg-teal-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {t('memberDetails.packageBenefits.use')}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-3 border-r-4 border-red-400">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-gray-600 text-xs">{t('memberDetails.packageBenefits.freezingDays')}</p>
              <p className="text-2xl font-bold text-red-600">{member.freezingDays ?? 0}</p>
            </div>
            <div className="text-3xl">❄️</div>
          </div>
          <button
            onClick={handleUseFreezingDay}
            disabled={(member.freezingDays ?? 0) <= 0 || loading}
            className="w-full bg-red-500 text-white py-1.5 px-2 rounded text-xs hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {t('memberDetails.packageBenefits.use')}
          </button>
        </div>
      </div>

      {/* ⭐ بطاقة إحصائيات الإحالة */}
      {loyalty && (
        <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-lg shadow p-3 mb-3">
          <h3 className="font-bold text-base mb-2 flex items-center gap-2 text-orange-800">
            <span>🤝</span>
            <span>{t('memberDetails.referrals')}</span>
          </h3>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-white rounded-lg p-2 border border-orange-100">
              <div className="text-xs text-gray-600 mb-1">{t('memberDetails.totalReferrals')}</div>
              <div className="text-2xl font-bold text-orange-600">
                {loyalty.referralCount || 0}
              </div>
              <div className="text-xs text-gray-500">{t('memberDetails.person')}</div>
            </div>

            <div className="bg-white rounded-lg p-2 border border-green-100">
              <div className="text-xs text-gray-600 mb-1">{t('memberDetails.pendingCashRewards')}</div>
              <div className="text-2xl font-bold text-green-600">
                {loyalty.pendingCashRewards || 0}
              </div>
              <div className="text-xs text-gray-500">
                ({(loyalty.pendingCashRewards || 0) * 1000} {t('common.currency')})
              </div>
            </div>
          </div>

          {(loyalty.pendingCashRewards || 0) > 0 && (
            <button
              onClick={handleRedeemCashReward}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition text-sm font-bold flex items-center justify-center gap-2 disabled:bg-gray-400"
            >
              <span>💰</span>
              <span>{t('memberDetails.redeemCashReward')}</span>
            </button>
          )}

          <div className="mt-2 bg-orange-100 rounded-lg p-2">
            <p className="text-xs text-orange-800">
              💡 <strong>{t('memberDetails.referralRewardsInfo')}</strong> {t('memberDetails.referralRewardsDetails')}
            </p>
          </div>
        </div>
      )}

      {/* PT Subscription Card */}
      {ptSubscription && (
        <div className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-lg shadow-lg p-3 mb-3 border-2 border-teal-300">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🏋️</span>
            <div className="flex-1">
              <h3 className="text-base font-bold">{t('memberDetails.ptSection.title')}</h3>
              <p className="text-xs opacity-90">{t('memberDetails.ptSection.subtitle')}</p>
            </div>
            <div className="bg-green-500 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <span>✅</span>
              <span>{t('memberDetails.ptSection.activeStatus')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-white/10 rounded-lg p-2 backdrop-blur-sm">
              <p className="text-xs opacity-80">{t('memberDetails.ptSection.ptNumber')}</p>
              <p className="text-lg font-bold">#{ptSubscription.ptNumber}</p>
            </div>

            <div className="bg-white/10 rounded-lg p-2 backdrop-blur-sm">
              <p className="text-xs opacity-80">{t('memberDetails.ptSection.coach')}</p>
              <p className="text-sm font-bold truncate">{ptSubscription.coachName}</p>
            </div>

            <div className="bg-white/10 rounded-lg p-2 backdrop-blur-sm">
              <p className="text-xs opacity-80">{t('memberDetails.ptSection.sessionsRemaining')}</p>
              <p className="text-lg font-bold text-yellow-300">
                {ptSubscription.sessionsRemaining} / {ptSubscription.sessionsPurchased}
              </p>
            </div>

            <div className="bg-white/10 rounded-lg p-2 backdrop-blur-sm">
              <p className="text-xs opacity-80">{t('memberDetails.ptSection.remainingAmount')}</p>
              <p className="text-lg font-bold text-yellow-300">
                {ptSubscription.remainingAmount} {t('memberDetails.egp')}
              </p>
            </div>
          </div>

          {ptSubscription.expiryDate && (
            <div className="mt-2 bg-white/10 rounded-lg p-2 backdrop-blur-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="opacity-90">📅 {t('memberDetails.ptSection.expiryDate')}</span>
                <span className="font-bold">{new Date(ptSubscription.expiryDate).toLocaleDateString('ar-EG')}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => router.push('/pt')}
            className="w-full mt-2 bg-white text-teal-600 py-2 rounded-lg hover:bg-gray-100 text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            <span>📊</span>
            <span>{t('memberDetails.ptSection.viewFullDetails')}</span>
          </button>
        </div>
      )}

      {/* Nutrition Packages Card */}
      {nutritionPackages.length > 0 && (
        <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-lg shadow-lg p-3 mb-3 border-2 border-orange-300">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🥗</span>
            <div className="flex-1">
              <h3 className="text-base font-bold">{t('memberDetails.nutritionSection.title')}</h3>
              <p className="text-xs opacity-90">{t('memberDetails.nutritionSection.subtitle')}</p>
            </div>
            <div className="bg-green-500 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <span>✅</span>
              <span>{t('memberDetails.nutritionSection.activeStatus')}</span>
            </div>
          </div>

          {nutritionPackages.map((pkg: any) => (
            <div key={pkg.id} className="bg-white/10 rounded-lg p-2 mb-2 backdrop-blur-sm">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/10 rounded-lg p-2">
                  <p className="text-xs opacity-80">{t('memberDetails.nutritionSection.packageType')}</p>
                  <p className="text-sm font-bold">{pkg.packageType}</p>
                </div>

                <div className="bg-white/10 rounded-lg p-2">
                  <p className="text-xs opacity-80">{t('memberDetails.nutritionSection.followUpsRemaining')}</p>
                  <p className="text-sm font-bold text-yellow-300">
                    {pkg.followUpsIncluded - pkg.followUpsUsed} / {pkg.followUpsIncluded}
                  </p>
                </div>

                <div className="bg-white/10 rounded-lg p-2">
                  <p className="text-xs opacity-80">{t('memberDetails.nutritionSection.totalPrice')}</p>
                  <p className="text-sm font-bold">{pkg.totalPrice} {t('memberDetails.egp')}</p>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() => router.push('/nutrition')}
            className="w-full mt-2 bg-white text-orange-600 py-2 rounded-lg hover:bg-gray-100 text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            <span>📊</span>
            <span>{t('memberDetails.nutritionSection.viewFullDetails')}</span>
          </button>
        </div>
      )}

      {/* Physiotherapy Packages Card */}
      {physioPackages.length > 0 && (
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg shadow-lg p-3 mb-3 border-2 border-blue-300">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🩺</span>
            <div className="flex-1">
              <h3 className="text-base font-bold">{t('memberDetails.physiotherapySection.title')}</h3>
              <p className="text-xs opacity-90">{t('memberDetails.physiotherapySection.subtitle')}</p>
            </div>
            <div className="bg-green-500 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <span>✅</span>
              <span>{t('memberDetails.physiotherapySection.activeStatus')}</span>
            </div>
          </div>

          {physioPackages.map((pkg: any) => (
            <div key={pkg.id} className="bg-white/10 rounded-lg p-2 mb-2 backdrop-blur-sm">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/10 rounded-lg p-2">
                  <p className="text-xs opacity-80">{t('memberDetails.physiotherapySection.packageType')}</p>
                  <p className="text-sm font-bold">{pkg.packageType}</p>
                </div>

                <div className="bg-white/10 rounded-lg p-2">
                  <p className="text-xs opacity-80">{t('memberDetails.physiotherapySection.sessionsRemaining')}</p>
                  <p className="text-sm font-bold text-yellow-300">
                    {pkg.sessionsPurchased - pkg.sessionsUsed} / {pkg.sessionsPurchased}
                  </p>
                </div>

                <div className="bg-white/10 rounded-lg p-2">
                  <p className="text-xs opacity-80">{t('memberDetails.physiotherapySection.totalPrice')}</p>
                  <p className="text-sm font-bold">{pkg.totalPrice} {t('memberDetails.egp')}</p>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() => router.push('/physiotherapy')}
            className="w-full mt-2 bg-white text-blue-600 py-2 rounded-lg hover:bg-gray-100 text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            <span>📊</span>
            <span>{t('memberDetails.physiotherapySection.viewFullDetails')}</span>
          </button>
        </div>
      )}

      {/* Loyalty Points Section */}
      {loyalty && (
        <div className="mb-3">
          <LoyaltyPointsCard
            pointsBalance={loyalty.pointsBalance}
            totalEarned={loyalty.totalEarned}
            totalRedeemed={loyalty.totalRedeemed}
          />

          {/* Action Buttons Row */}
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {/* Redeem Points Button */}
              <button
                onClick={() => setShowRedemptionModal(true)}
                disabled={!loyalty.pointsBalance || loyalty.pointsBalance < 500}
                className={`py-2 rounded-lg text-xs font-semibold text-white transition-all ${
                  loyalty.pointsBalance >= 500
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 shadow hover:shadow-lg'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                🎁 {t('memberDetails.loyaltyPoints.redeemButton')}
              </button>

              {/* View History Button */}
              <a
                href={`/members/${memberId}/points-history`}
                className="py-2 rounded-lg text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-all shadow hover:shadow-lg flex items-center justify-center gap-1"
              >
                <span>📜</span>
                <span>{t('memberDetails.loyaltyPoints.viewHistory')}</span>
              </a>

              {/* WhatsApp Points Notification Button */}
              <button
                onClick={() => {
                  const egpValue = convertPointsToEGP(loyalty.pointsBalance)
                  const memberNumber = member.memberNumber || 'N/A'
                  const message = `Hi ${member.name}! 🌟\n\n*Member #${memberNumber}*\n\nYour current loyalty points: *${loyalty.pointsBalance.toLocaleString()} points* (≈ ${egpValue.toLocaleString()} EGP)\n\nKeep up the great work! 💪 Stay consistent with your workouts and you'll earn even more rewards.\n\nEvery visit counts towards amazing benefits! 🎁\n\n_Keep pushing, keep earning!_ 🚀`
                  const phoneNumber = member.phone.startsWith('0') ? member.phone.substring(1) : member.phone
                  const whatsappUrl = `https://wa.me/+20${phoneNumber}?text=${encodeURIComponent(message)}`
                  window.open(whatsappUrl, '_blank')
                }}
                disabled={!loyalty.pointsBalance || loyalty.pointsBalance === 0}
                className={`py-2 rounded-lg text-xs font-semibold transition-all shadow hover:shadow-lg flex items-center justify-center gap-1 ${
                  loyalty.pointsBalance > 0
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-300 cursor-not-allowed text-gray-500'
                }`}
              >
                <span>💬</span>
                <span>WhatsApp</span>
              </button>
            </div>

            {loyalty.pointsBalance > 0 && loyalty.pointsBalance < 500 && (
              <p className="text-xs text-gray-500 text-center">
                {t('memberDetails.loyaltyPoints.needMorePointsToRedeem').replace('{count}', (500 - loyalty.pointsBalance).toString())}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Manual Loyalty Points Actions */}
      {hasPermission('canManageLoyaltyPoints') && (
        <div className="mb-3">
          <h3 className="text-base font-bold mb-2 text-gray-800">
            ⭐ {t('memberDetails.loyaltyPoints.manualGrant')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* Goal Achievement Button */}
            <button
              onClick={() => setActiveModal('goal-achievement')}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-3 rounded-lg shadow hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="text-right">
                  <p className="font-bold text-sm">🏆 {t('memberDetails.loyaltyPoints.goalAchievement')}</p>
                  <p className="text-xs text-white/90">+500 {t('memberDetails.loyaltyPoints.points')}</p>
                </div>
                <div className="text-3xl">🎯</div>
              </div>
            </button>

            {/* Review Bonus Button */}
            <button
              onClick={() => setActiveModal('review-bonus')}
              disabled={loyalty?.hasReviewBonus}
              className={`p-3 rounded-lg shadow transition-all ${
                loyalty?.hasReviewBonus
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:shadow-lg'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-right">
                  <p className="font-bold text-sm">
                    ⭐ {t('memberDetails.loyaltyPoints.reviewBonus')}
                    {loyalty?.hasReviewBonus && ' ✓'}
                  </p>
                  <p className="text-xs opacity-90">
                    {loyalty?.hasReviewBonus ? t('memberDetails.loyaltyPoints.granted') : `+250 ${t('memberDetails.loyaltyPoints.points')}`}
                  </p>
                </div>
                <div className="text-3xl">📝</div>
              </div>
            </button>
          </div>
        </div>
      )}


      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-200 p-3 rounded-full">
              <span className="text-3xl">🔄</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-green-800">{t('renewall.title')}</h3>
              <p className="text-sm text-green-700">{t('renewall.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={() => setShowRenewalForm(true)}
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-md hover:shadow-lg"
          >
            🔄 {t('renewall.renewButton')}
          </button>
        </div>

        {/* Upgrade Card */}
        {member?.isActive &&
         member?.currentOfferId &&
         member?.startDate &&
         member?.expiryDate && (
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-purple-200 p-3 rounded-full">
                <span className="text-3xl">🚀</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-purple-800">{t('memberDetails.upgradeSubscription.title')}</h3>
                <p className="text-sm text-purple-700">{t('memberDetails.upgradeSubscription.subtitle')}</p>
              </div>
            </div>
            <button
              onClick={() => setShowUpgradeForm(true)}
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-md hover:shadow-lg"
            >
              🚀 {t('memberDetails.upgradeSubscription.upgradeButton')}
            </button>
          </div>
        )}

        <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300 rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-red-200 p-3 rounded-full">
              <span className="text-3xl">🗑️</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-red-800">{t('memberDetails.deleteModal.title')}</h3>
              <p className="text-sm text-red-700">{t('memberDetails.deleteModal.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-md hover:shadow-lg"
          >
            🗑️ {t('memberDetails.deleteModal.deleteButton')}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && confirmModal.show && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" dir={direction}>
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold mb-3">{confirmModal.title}</h3>
              <p className="text-gray-600 text-lg">{confirmModal.message}</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm()
                }}
                className="flex-1 bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 font-bold"
              >
                ✅ {t('memberDetails.confirmModal.yes')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-bold"
              >
                ✖️ {t('memberDetails.confirmModal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: تجميد */}
      {activeModal === 'freeze' && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null)
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">❄️ {t('memberDetails.freezeModal.title')}</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <div className="bg-orange-50 border-r-4 border-orange-500 p-4 rounded-lg mb-6">
              <p className="text-sm text-orange-800 mb-2">
                {t('memberDetails.freezeModal.currentExpiryDate')}: <strong>{formatDateYMD(member.expiryDate)}</strong>
              </p>
              {daysRemaining !== null && (
                <p className="text-sm text-orange-800">
                  {t('memberDetails.freezeModal.daysRemaining')}: <strong>{daysRemaining > 0 ? daysRemaining : 0} {t('memberDetails.freezeModal.day')}</strong>
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  تاريخ بداية التجميد <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={freezeData.startDate}
                  onChange={(e) => setFreezeData({ ...freezeData, startDate: e.target.value })}
                  className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-orange-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('memberDetails.freezeModal.daysToAdd')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={freezeData.days || ''}
                  onChange={(e) => setFreezeData({ ...freezeData, days: parseInt(e.target.value) || 0 })}
                  min="1"
                  className="w-full px-4 py-3 border-2 rounded-lg text-xl focus:outline-none focus:border-orange-500"
                  placeholder={t('memberDetails.freezeModal.daysPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('memberDetails.freezeModal.reason')}</label>
                <textarea
                  value={freezeData.reason}
                  onChange={(e) => setFreezeData({ ...freezeData, reason: e.target.value })}
                  className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-orange-500"
                  rows={3}
                  placeholder={t('memberDetails.freezeModal.reasonPlaceholder')}
                />
              </div>

              {freezeData.days > 0 && freezeData.startDate && member.expiryDate && (
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-yellow-800">
                    🔒 <strong>فترة التجميد:</strong> من {formatDateYMD(new Date(freezeData.startDate))} إلى {formatDateYMD(new Date(new Date(freezeData.startDate).getTime() + freezeData.days * 24 * 60 * 60 * 1000))}
                  </p>
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>الدخول ممنوع</strong> خلال هذه الفترة
                  </p>
                </div>
              )}

              {freezeData.days > 0 && member.expiryDate && (
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                  <p className="text-sm text-green-800 mb-2">
                    {t('memberDetails.freezeModal.newExpiryDate')}:
                  </p>
                  <p className="text-xl font-bold text-green-600">
                    {formatDateYMD(new Date(new Date(member.expiryDate).getTime() + freezeData.days * 24 * 60 * 60 * 1000))}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleFreeze}
                  disabled={loading || freezeData.days <= 0 || !freezeData.startDate}
                  className="flex-1 bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 font-bold"
                >
                  {loading ? t('memberDetails.freezeModal.processing') : `✅ ${t('memberDetails.freezeModal.confirmFreeze')}`}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300"
                >
                  {t('memberDetails.confirmModal.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: استخدام أيام التجميد */}
      {activeModal === 'use-freezing-days' && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveModal(null)
              setUseFreezingDaysData({ days: 0 })
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">❄️ {t('memberDetails.useFreezingDaysModal.title')}</h3>
              <button
                onClick={() => {
                  setActiveModal(null)
                  setUseFreezingDaysData({ days: 0 })
                }}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">{t('memberDetails.useFreezingDaysModal.subtitle')}</p>

            <div className="bg-yellow-50 border-r-4 border-yellow-500 p-4 rounded-lg mb-4">
              <p className="text-sm text-yellow-800 mb-2">
                {t('memberDetails.useFreezingDaysModal.availableDays')}: <strong>{member.freezingDays ?? 0} {t('memberDetails.freezeModal.day')}</strong>
              </p>
              <p className="text-sm text-yellow-800">
                {t('memberDetails.useFreezingDaysModal.currentExpiryDate')}: <strong>{formatDateYMD(member.expiryDate)}</strong>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('memberDetails.useFreezingDaysModal.daysToUse')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={useFreezingDaysData.days || ''}
                  onChange={(e) => setUseFreezingDaysData({ days: parseInt(e.target.value) || 0 })}
                  min="1"
                  max={member.freezingDays ?? 0}
                  className="w-full px-4 py-3 border-2 rounded-lg text-xl focus:outline-none focus:border-yellow-500"
                  placeholder={t('memberDetails.useFreezingDaysModal.daysPlaceholder')}
                  autoFocus
                />
              </div>

              {useFreezingDaysData.days > 0 && member.expiryDate && (
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                  <p className="text-sm text-green-800 mb-2">
                    {t('memberDetails.useFreezingDaysModal.newExpiryDate')}:
                  </p>
                  <p className="text-xl font-bold text-green-600">
                    {formatDateYMD(new Date(new Date(member.expiryDate).getTime() + useFreezingDaysData.days * 24 * 60 * 60 * 1000))}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleApplyFreezingDays}
                  disabled={loading || useFreezingDaysData.days <= 0 || useFreezingDaysData.days > (member.freezingDays ?? 0)}
                  className="flex-1 bg-yellow-600 text-white py-3 rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 font-bold"
                >
                  {loading ? t('memberDetails.useFreezingDaysModal.processing') : `✅ ${t('memberDetails.useFreezingDaysModal.confirmUse')}`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null)
                    setUseFreezingDaysData({ days: 0 })
                  }}
                  className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300"
                >
                  {t('memberDetails.useFreezingDaysModal.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: تعديل البيانات الأساسية */}
      {activeModal === 'edit-basic-info' && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null)
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full p-3 my-2" onClick={(e) => e.stopPropagation()} dir={direction}>
            <div className="flex justify-between items-center mb-1.5">
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>✏️</span>
                <span>{t('memberDetails.editModal.title')}</span>
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <div className={`bg-orange-50 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-orange-500 p-1.5 rounded-lg mb-1.5`}>
              <p className="font-bold text-orange-800 text-xs">
                {t('memberDetails.editModal.memberNumber', { number: member.memberNumber.toString() })}
              </p>
            </div>

            <div className="space-y-1.5">
              {/* الصف الأول: البيانات الأساسية + بيانات الاشتراك */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                {/* البيانات الأساسية */}
                <div className="bg-gray-50 p-1.5 rounded-lg">
                  <h4 className="font-bold text-xs mb-1.5">📋 {t('memberDetails.editModal.sections.basicInfo')}</h4>
                  <div className="grid grid-cols-1 gap-1.5">
                    <div>
                      <label className="block text-xs font-medium mb-0.5">
                        {t('memberDetails.editModal.fields.name')} <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={editBasicInfoData.name}
                        onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, name: e.target.value })}
                        className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-orange-500 text-sm"
                        placeholder={t('memberDetails.editModal.fields.namePlaceholder')}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-0.5">
                        {t('memberDetails.editModal.fields.phone')} <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="tel"
                        value={editBasicInfoData.phone}
                        onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, phone: e.target.value })}
                        className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-orange-500 font-mono text-sm"
                        placeholder={t('memberDetails.editModal.fields.phonePlaceholder')}
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-0.5">
                        {t('members.form.nationalIdOptional')}
                      </label>
                      <input
                        type="text"
                        value={editBasicInfoData.nationalId}
                        onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, nationalId: e.target.value })}
                        className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-orange-500 font-mono text-sm"
                        placeholder={t('members.form.nationalIdPlaceholder')}
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-0.5">
                        {t('members.form.emailOptional')}
                      </label>
                      <input
                        type="email"
                        value={editBasicInfoData.email}
                        onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, email: e.target.value })}
                        className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-orange-500 font-mono text-sm"
                        placeholder={t('members.form.emailPlaceholder')}
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* بيانات الاشتراك */}
                <div className="bg-green-50 p-1.5 rounded-lg">
                  <h4 className="font-bold text-xs mb-1.5">💰 {t('memberDetails.editModal.sections.subscriptionData')}</h4>
                  <div className="grid grid-cols-1 gap-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-xs font-medium mb-0.5">
                          {t('memberDetails.editModal.fields.subscriptionPrice')}
                        </label>
                        <input
                          type="number"
                          value={editBasicInfoData.subscriptionPrice || ''}
                          onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, subscriptionPrice: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-green-500 text-sm"
                          placeholder="0"
                          min="0"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-0.5">
                          نوع الباقة <span className="text-red-600">*</span>
                        </label>
                        <select
                          value={editBasicInfoData.subscriptionType || '1month'}
                          onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, subscriptionType: e.target.value })}
                          className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-green-500 text-sm"
                        >
                          <option value="1month">شهر واحد</option>
                          <option value="3months">3 شهور</option>
                          <option value="6months">6 شهور</option>
                          <option value="1year">سنة</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-xs font-medium mb-0.5">
                          {t('memberDetails.editModal.fields.startDate')}
                        </label>
                        <input
                          type="date"
                          value={editBasicInfoData.startDate}
                          onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, startDate: e.target.value })}
                          className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-green-500 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-0.5">
                          {t('memberDetails.editModal.fields.expiryDate')}
                        </label>
                        <input
                          type="date"
                          value={editBasicInfoData.expiryDate}
                          onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, expiryDate: e.target.value })}
                          className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-green-500 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* الصف الثاني: الخدمات المجانية + بيانات التجميد */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                {/* الخدمات المجانية */}
                <div className="bg-purple-50 p-1.5 rounded-lg">
                  <h4 className="font-bold text-xs mb-1.5">🎁 {t('memberDetails.editModal.sections.freeServices')}</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-xs font-medium mb-0.5">
                        ⚖️ {t('memberDetails.editModal.fields.inBodyScans')}
                      </label>
                      <input
                        type="number"
                        value={editBasicInfoData.inBodyScans || ''}
                        onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, inBodyScans: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
                        placeholder="0"
                        min="0"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-0.5">
                        🎟️ {t('memberDetails.editModal.fields.invitations')}
                      </label>
                      <input
                        type="number"
                        value={editBasicInfoData.invitations || ''}
                        onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, invitations: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                {/* بيانات التجميد */}
                <div className="bg-orange-50 p-1.5 rounded-lg border-2 border-orange-200">
                  <h4 className="font-bold text-xs mb-1.5">❄️ بيانات التجميد</h4>
                  <div className="grid grid-cols-1 gap-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-xs font-medium mb-0.5">
                          تاريخ بداية التجميد
                        </label>
                        <input
                          type="date"
                          value={editBasicInfoData.freezeStartDate}
                          onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freezeStartDate: e.target.value })}
                          className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-orange-500 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-0.5">
                          تاريخ نهاية التجميد
                        </label>
                        <input
                          type="date"
                          value={editBasicInfoData.freezeEndDate}
                          onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freezeEndDate: e.target.value })}
                          className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-orange-500 text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editBasicInfoData.isFrozen}
                          onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, isFrozen: e.target.checked })}
                          className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                        />
                        <span className="text-xs font-medium">🔒 الاشتراك مجمد</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Package Benefits */}
              <div className="bg-blue-50 p-1.5 rounded-lg border-2 border-blue-200">
                <h4 className="font-bold text-xs mb-1.5">🎁 مزايا الباقة</h4>
                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
                  <div>
                    <label className="block text-xs font-medium mb-0.5">
                      🏃 تقييمات الحركة
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.movementAssessments || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, movementAssessments: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-0.5">
                      🥗 جلسات التغذية
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.nutritionSessions || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, nutritionSessions: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-0.5">
                      👋 جلسات التعريف
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.onboardingSessions || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, onboardingSessions: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-0.5">
                      📋 جلسات المتابعة
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.followUpSessions || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, followUpSessions: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-0.5">
                      👥 الحصص الجماعية
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.groupClasses || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, groupClasses: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-0.5">
                      🏊 جلسات المسبح
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.poolSessions || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, poolSessions: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-0.5">
                      🎾 جلسات البادل
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.paddleSessions || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, paddleSessions: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-0.5">
                      ❄️ أيام التجميد
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.freezingDays || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freezingDays: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-0.5">
                      🎯 هدف الحضور
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.monthlyAttendanceGoal || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, monthlyAttendanceGoal: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-0.5">
                      ⬆️ أيام الترقية
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.upgradeAllowedDays || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, upgradeAllowedDays: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* الملاحظات */}
              <div className="bg-yellow-50 p-1.5 rounded-lg">
                <h4 className="font-bold text-xs mb-1.5">📝 {t('memberDetails.editModal.sections.notes')}</h4>
                <textarea
                  value={editBasicInfoData.notes}
                  onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, notes: e.target.value })}
                  className="w-full px-2 py-1 border-2 rounded-lg focus:outline-none focus:border-yellow-500 text-sm"
                  rows={1}
                  placeholder={t('memberDetails.editModal.fields.notesPlaceholder')}
                />
              </div>

              {/* أزرار التحكم */}
              <div className="flex gap-1.5 pt-1.5 border-t">
                <button
                  type="button"
                  onClick={handleEditBasicInfo}
                  disabled={loading || !editBasicInfoData.name.trim() || !editBasicInfoData.phone.trim()}
                  className="flex-1 bg-orange-600 text-white py-1 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 font-bold text-sm"
                >
                  {loading ? t('memberDetails.editModal.buttons.saving') : `✅ ${t('memberDetails.editModal.buttons.save')}`}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3 bg-gray-200 text-gray-700 py-1 rounded-lg hover:bg-gray-300 font-bold text-sm"
                >
                  {t('memberDetails.editModal.buttons.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: إدخال تفاصيل الضيف (الدعوة) */}
      {activeModal === 'invitation' && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveModal(null)
              setInvitationData({ guestName: '', guestPhone: '', notes: '' })
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} dir={direction}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <span>🎟️</span>
                <span>{t('memberDetails.invitationModal.title')}</span>
              </h3>
              <button
                onClick={() => {
                  setActiveModal(null)
                  setInvitationData({ guestName: '', guestPhone: '', notes: '' })
                }}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <div className={`bg-purple-50 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-purple-500 p-4 rounded-lg mb-6`}>
              <p className="font-bold text-purple-800">
                {t('memberDetails.invitationModal.memberLabel', { name: member.name, number: member.memberNumber.toString() })}
              </p>
              <p className="text-sm text-purple-700 mt-1">
                {t('memberDetails.invitationModal.invitationsRemaining', { count: (member.invitations ?? 0).toString() })}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('memberDetails.invitationModal.guestName')} <span className="text-red-600">{t('memberDetails.invitationModal.required')}</span>
                </label>
                <input
                  type="text"
                  value={invitationData.guestName}
                  onChange={(e) => setInvitationData({ ...invitationData, guestName: e.target.value })}
                  className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-purple-500"
                  placeholder={t('memberDetails.invitationModal.guestNamePlaceholder')}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('memberDetails.invitationModal.guestPhone')} <span className="text-red-600">{t('memberDetails.invitationModal.required')}</span>
                </label>
                <input
                  type="tel"
                  value={invitationData.guestPhone}
                  onChange={(e) => setInvitationData({ ...invitationData, guestPhone: e.target.value })}
                  className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-purple-500 font-mono"
                  placeholder={t('memberDetails.invitationModal.guestPhonePlaceholder')}
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('memberDetails.invitationModal.notes')}</label>
                <textarea
                  value={invitationData.notes}
                  onChange={(e) => setInvitationData({ ...invitationData, notes: e.target.value })}
                  className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-purple-500"
                  rows={3}
                  placeholder={t('memberDetails.invitationModal.notesPlaceholder')}
                />
              </div>

              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <span className="text-xl">✅</span>
                  <div>
                    <p className="font-semibold">{t('memberDetails.invitationModal.actionsSummary')}</p>
                    <p className="text-sm">{t('memberDetails.invitationModal.action1')}</p>
                    <p className="text-sm">{t('memberDetails.invitationModal.action2')}</p>
                    <p className="text-sm">{t('memberDetails.invitationModal.action3')}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSubmitInvitation}
                  disabled={loading || !invitationData.guestName.trim() || !invitationData.guestPhone.trim()}
                  className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-bold"
                >
                  {loading ? t('memberDetails.invitationModal.saving') : `✅ ${t('memberDetails.invitationModal.registerInvitation')}`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null)
                    setInvitationData({ guestName: '', guestPhone: '', notes: '' })
                  }}
                  className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300"
                >
                  {t('memberDetails.invitationModal.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}




      {/* Goal Achievement Modal */}
      {activeModal === 'goal-achievement' && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                {t('memberDetails.loyaltyPoints.modals.goalAchievement.title')}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="bg-green-50 border-r-4 border-green-500 p-4 rounded-lg mb-4">
              <p className="text-green-800 font-medium">
                {t('memberDetails.loyaltyPoints.modals.goalAchievement.willGrant')}
              </p>
            </div>

            <p className="text-gray-700 mb-4 font-medium">
              {t('memberDetails.loyaltyPoints.modals.goalAchievement.selectType')}
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleGoalAchievement('weight_loss')}
                disabled={loading}
                className="w-full bg-orange-100 text-orange-800 py-3 px-4 rounded-lg hover:bg-orange-200 transition-colors text-right font-medium disabled:opacity-50"
              >
                {t('memberDetails.loyaltyPoints.modals.goalAchievement.weightLoss')}
              </button>
              <button
                onClick={() => handleGoalAchievement('muscle_gain')}
                disabled={loading}
                className="w-full bg-purple-100 text-purple-800 py-3 px-4 rounded-lg hover:bg-purple-200 transition-colors text-right font-medium disabled:opacity-50"
              >
                {t('memberDetails.loyaltyPoints.modals.goalAchievement.muscleGain')}
              </button>
              <button
                onClick={() => handleGoalAchievement('strength')}
                disabled={loading}
                className="w-full bg-orange-100 text-orange-800 py-3 px-4 rounded-lg hover:bg-orange-200 transition-colors text-right font-medium disabled:opacity-50"
              >
                {t('memberDetails.loyaltyPoints.modals.goalAchievement.strengthRecord')}
              </button>
            </div>

            {message && (
              <div className={`mt-4 p-3 rounded-lg ${
                message.includes('✅')
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review Bonus Modal */}
      {activeModal === 'review-bonus' && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                {t('memberDetails.loyaltyPoints.modals.reviewBonus.title')}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="bg-purple-50 border-r-4 border-purple-500 p-4 rounded-lg mb-4">
              <p className="text-purple-800 font-medium">
                {t('memberDetails.loyaltyPoints.modals.reviewBonus.willGrant')}
              </p>
            </div>

            <p className="text-gray-700 mb-4">
              {t('memberDetails.loyaltyPoints.modals.reviewBonus.confirmMessage')}
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleReviewBonus}
                disabled={loading}
                className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-bold"
              >
                {loading ? t('memberDetails.loyaltyPoints.modals.reviewBonus.granting') : t('memberDetails.loyaltyPoints.modals.reviewBonus.grantButton')}
              </button>
              <button
                onClick={() => setActiveModal(null)}
                className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300"
              >
                {t('memberDetails.loyaltyPoints.modals.reviewBonus.cancel')}
              </button>
            </div>

            {message && (
              <div className={`mt-4 p-3 rounded-lg ${
                message.includes('✅')
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* سجل الحضور */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-orange-100" dir={direction}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-lg">
              <span className="text-3xl">📊</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{t('memberDetails.attendanceLog.title')}</h2>
              <p className="text-sm text-gray-500">{t('memberDetails.attendanceLog.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gradient-to-br from-gray-50 to-orange-50 p-5 rounded-xl mb-6 border border-orange-200">
          <h3 className="text-sm font-bold text-gray-700 mb-3">🔍 {t('memberDetails.attendanceLog.filterByPeriod')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('memberDetails.attendanceLog.dateFrom')}</label>
              <input
                type="date"
                value={attendanceStartDate}
                onChange={(e) => setAttendanceStartDate(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('memberDetails.attendanceLog.dateTo')}</label>
              <input
                type="date"
                value={attendanceEndDate}
                onChange={(e) => setAttendanceEndDate(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 transition"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchAttendanceHistory}
                disabled={attendanceLoading}
                className="w-full bg-gradient-to-r from-orange-600 to-orange-700 text-white px-6 py-2 rounded-lg hover:from-orange-700 hover:to-orange-800 disabled:bg-gray-400 font-semibold shadow-md transition-all transform hover:scale-105"
              >
                {attendanceLoading ? `⏳ ${t('memberDetails.attendanceLog.loading')}` : `✓ ${t('memberDetails.attendanceLog.applyFilter')}`}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {attendanceLoading ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-gray-600">{t('memberDetails.attendanceLog.loadingData')}</p>
          </div>
        ) : attendanceHistory.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-xl text-gray-600">{t('memberDetails.attendanceLog.noRecordsForPeriod')}</p>
          </div>
        ) : (
          <>
            {/* إحصائيات سريعة */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border-2 border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-600 text-sm font-semibold mb-1">{t('memberDetails.attendanceLog.totalVisits')}</p>
                    <p className="text-3xl font-bold text-orange-700">{attendanceHistory.length}</p>
                  </div>
                  <div className="text-4xl opacity-50">📊</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border-2 border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-600 text-sm font-semibold mb-1">{t('memberDetails.attendanceLog.lastVisit')}</p>
                    <p className="text-lg font-bold text-green-700">
                      {new Date(attendanceHistory[0].checkInTime).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="text-4xl opacity-50">📅</div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-orange-500 to-orange-600">
                <tr>
                  <th className={`px-6 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} text-white font-bold`}>#</th>
                  <th className={`px-6 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} text-white font-bold`}>{t('memberDetails.attendanceLog.date')}</th>
                  <th className={`px-6 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} text-white font-bold`}>{t('memberDetails.attendanceLog.checkInTime')}</th>
                </tr>
              </thead>
              <tbody>
                {attendanceHistory.map((checkIn, index) => {
                  const checkInTime = new Date(checkIn.checkInTime)

                  return (
                    <tr key={checkIn.id} className="border-t hover:bg-orange-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-700">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-700">
                          {checkInTime.toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-lg font-bold text-sm">
                          {checkInTime.toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* نموذج التجديد */}
      {showRenewalForm && (
        <RenewalForm
          member={member}
          onSuccess={(receipt?: Receipt) => {
            if (receipt) {
              setReceiptData({
                receiptNumber: receipt.receiptNumber,
                type: t('renewall.membershipRenewal'),
                amount: receipt.amount,
                details: receipt.itemDetails,
                date: new Date(receipt.createdAt),
                paymentMethod: receipt.paymentMethod || 'cash'
              })
              setShowReceipt(true)
              setLastReceiptNumber(receipt.receiptNumber)
            }

            fetchMember()
            setShowRenewalForm(false)
            setMessage(`✅ ${t('renewall.renewalSuccessMessage')}`)
            setTimeout(() => setMessage(''), 3000)
          }}
          onClose={() => setShowRenewalForm(false)}
        />
      )}

      {/* Upgrade Form */}
      {showUpgradeForm && (
        <UpgradeForm
          member={member}
          onSuccess={(receipt?: Receipt) => {
            if (receipt) {
              setReceiptData({
                receiptNumber: receipt.receiptNumber,
                type: 'ترقية اشتراك',
                amount: receipt.amount,
                details: receipt.itemDetails,
                date: new Date(receipt.createdAt),
                paymentMethod: receipt.paymentMethod || 'cash'
              })
              setShowReceipt(true)
              setLastReceiptNumber(receipt.receiptNumber)
            }

            fetchMember()
            setShowUpgradeForm(false)
            setMessage('✅ تمت ترقية الاشتراك بنجاح!')
            setTimeout(() => setMessage(''), 3000)
          }}
          onClose={() => setShowUpgradeForm(false)}
        />
      )}

      {/* الإيصال */}
      {showReceipt && receiptData && (
        <ReceiptToPrint
          receiptNumber={receiptData.receiptNumber}
          type={receiptData.type}
          amount={receiptData.amount}
          details={receiptData.details}
          date={receiptData.date}
          paymentMethod={receiptData.paymentMethod}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {/* redemption Modal */}
      {showRedemptionModal && loyalty && member && (
        <RedemptionModal
          isOpen={showRedemptionModal}
          memberId={member.id}
          memberName={member.name}
          currentPoints={loyalty.pointsBalance}
          onClose={() => setShowRedemptionModal(false)}
          onSuccess={() => {
            fetchMember()
            fetchLoyalty()
          }}
        />
      )}
    </div>
  )
}