'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { InvitationModal, SimpleServiceModal } from '../../components/ServiceDeductionModals'
import { useLanguage } from '@/contexts/LanguageContext'
import { convertPointsToEGP } from '../../lib/loyaltySystem'

interface SearchResult {
  type: 'member' | 'pt'
  data: any
}

type SearchMode = 'id' | 'name'

export default function SearchPage() {
  const router = useRouter()
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

  // دالة للتحقق من حالة التجميد وحساب الأيام المتبقية
  const getFreezeStatus = (member: any) => {
    if (!member.freezeStartDate || !member.freezeEndDate) {
      return null
    }

    const now = new Date()
    const freezeStart = new Date(member.freezeStartDate)
    const freezeEnd = new Date(member.freezeEndDate)

    // التحقق إذا كان في فترة التجميد حالياً
    if (now >= freezeStart && now <= freezeEnd) {
      // حساب عدد الأيام المتبقية في التجميد
      const remainingDays = Math.ceil((freezeEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        isFrozen: true,
        remainingDays: remainingDays
      }
    }

    return null
  }

  const [searchMode, setSearchMode] = useState<SearchMode>('id')
  const [memberId, setMemberId] = useState('')
  const [searchName, setSearchName] = useState('')
  const [searchPhone, setSearchPhone] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [lastSearchTime, setLastSearchTime] = useState<Date | null>(null)
  const [attendanceMessage, setAttendanceMessage] = useState<{type: 'success' | 'error', text: string, staff?: any} | null>(null)
  const [memberLoyalty, setMemberLoyalty] = useState<any>(null)
  const [attendanceInfo, setAttendanceInfo] = useState<{
    attendanceLimit: number
    attendanceDaysUsed: number
    attendanceRemaining: number | null
    isUnlimited: boolean
    attendanceLimitWarning: boolean
  } | null>(null)
  const memberIdRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // حالة الـ modals
  const [invitationModal, setInvitationModal] = useState<{isOpen: boolean, memberId: string, memberName: string}>({ isOpen: false, memberId: '', memberName: '' })
  const [serviceModal, setServiceModal] = useState<{isOpen: boolean, type: 'freePT' | 'inBody' | 'movementAssessment' | 'nutrition' | 'physiotherapy' | 'onboarding' | 'followUp' | 'groupClass' | 'pool' | 'paddle', memberId: string, memberName: string}>({ isOpen: false, type: 'freePT', memberId: '', memberName: '' })

  // حفظ آخر بحث للتحديث
  const [lastSearchValue, setLastSearchValue] = useState<{type: 'id' | 'name', value: string}>({ type: 'id', value: '' })

  useEffect(() => {
    if (searchMode === 'id') {
      memberIdRef.current?.focus()
    } else {
      nameRef.current?.focus()
    }
  }, [searchMode])

  // 🆕 دالة تشغيل صوت النجاح (اشتراك نشط)
  const playSuccessSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const ctx = audioContextRef.current
      
      // نغمة نجاح قوية (3 نغمات صاعدة)
      const times = [0, 0.15, 0.3]
      const frequencies = [523.25, 659.25, 783.99] // C5, E5, G5
      
      times.forEach((time, index) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequencies[index], ctx.currentTime + time)
        
        // صوت عالي جداً
        gainNode.gain.setValueAtTime(0.8, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.3)
        
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.3)
      })
    } catch (error) {
      console.error('Error playing success sound:', error)
    }
  }

  // 🆕 دالة تشغيل صوت الإنذار (اشتراك منتهي أو غير موجود)
  const playAlarmSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const ctx = audioContextRef.current
      
      // صوت إنذار قوي ومتكرر
      const alarmPattern = [
        { freq: 2000, time: 0 },
        { freq: 600, time: 0.15 },
        { freq: 2000, time: 0.3 },
        { freq: 600, time: 0.45 },
        { freq: 2000, time: 0.6 },
        { freq: 600, time: 0.75 },
      ]
      
      alarmPattern.forEach(({ freq, time }) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        oscillator.type = 'square' // موجة مربعة لصوت أقوى
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime + time)
        
        // صوت عالي جداً للإنذار
        gainNode.gain.setValueAtTime(0.9, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.15)
        
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.15)
      })
    } catch (error) {
      console.error('Error playing alarm sound:', error)
    }
  }

  // 🆕 دالة تشغيل صوت التحذير (اشتراك قريب من الانتهاء)
  const playWarningSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const ctx = audioContextRef.current
      
      // نغمة تحذير (نغمتين)
      const times = [0, 0.2]
      const frequencies = [440, 370] // A4, F#4
      
      times.forEach((time, index) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        oscillator.type = 'triangle'
        oscillator.frequency.setValueAtTime(frequencies[index], ctx.currentTime + time)
        
        // صوت متوسط للتحذير
        gainNode.gain.setValueAtTime(0.7, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.25)
        
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.25)
      })
    } catch (error) {
      console.error('Error playing warning sound:', error)
    }
  }

  // 🆕 دالة فحص حالة العضو وتشغيل الصوت المناسب
  const checkMemberStatusAndPlaySound = (member: any) => {
    const isActive = member.isActive
    const expiryDate = member.expiryDate ? new Date(member.expiryDate) : null
    const today = new Date()

    if (!isActive || (expiryDate && expiryDate < today)) {
      // اشتراك منتهي - صوت إنذار
      playAlarmSound()
      return 'expired'
    } else if (expiryDate) {
      const diffTime = expiryDate.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays <= 7) {
        // اشتراك قريب من الانتهاء - صوت تحذير
        playWarningSound()
        return 'warning'
      } else {
        // اشتراك نشط - صوت نجاح
        playSuccessSound()
        return 'active'
      }
    } else {
      // لا يوجد تاريخ انتهاء - صوت نجاح
      playSuccessSound()
      return 'active'
    }
  }

  // 🆕 دالة تسجيل دخول العضو تلقائياً
  const handleMemberCheckIn = async (memberId: string) => {
    try {
      const response = await fetch('/api/member-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, method: 'scan' }),
      })

      const data = await response.json()

      if (response.ok) {
        // حفظ معلومات حد الحضور
        setAttendanceInfo({
          attendanceLimit: data.attendanceLimit || 0,
          attendanceDaysUsed: data.attendanceDaysUsed || 0,
          attendanceRemaining: data.attendanceRemaining,
          isUnlimited: data.isUnlimited || false,
          attendanceLimitWarning: data.attendanceLimitWarning || false
        })

        // تشغيل صوت تحذير إذا وصل للحد
        if (data.attendanceLimitWarning) {
          playAlarmSound()
        }

        if (!data.alreadyCheckedIn) {
          console.log('✅ تم تسجيل دخول العضو:', data.message)
        } else {
          console.log('ℹ️ العضو مسجل دخول بالفعل')
        }
      }
    } catch (error) {
      console.error('Error checking in member:', error)
      setAttendanceInfo(null)
    }
  }

  // دالة جلب نقاط الولاء
  const fetchMemberLoyalty = async (memberId: string) => {
    try {
      const response = await fetch(`/api/loyalty?memberId=${memberId}`)
      if (response.ok) {
        const data = await response.json()
        setMemberLoyalty(data)
      } else {
        setMemberLoyalty(null)
      }
    } catch (error) {
      console.error('Error fetching loyalty:', error)
      setMemberLoyalty(null)
    }
  }

  // Effect to fetch loyalty when results change
  useEffect(() => {
    if (results.length > 0 && results[0].type === 'member') {
      fetchMemberLoyalty(results[0].data.id)
    } else {
      setMemberLoyalty(null)
    }
  }, [results])

  const handleSearchById = async (silent: boolean = false) => {
    if (!memberId.trim()) {
      if (!silent) playAlarmSound()
      return
    }

    const inputValue = memberId.trim()

    // حفظ آخر قيمة بحث
    if (!silent) {
      setLastSearchValue({ type: 'id', value: inputValue })
    }

    // ✅ فحص إذا كان الرقم 9 خانات أو أكثر - موظف
    if (/^\d{9,}$/.test(inputValue)) {
      const numericCode = parseInt(inputValue, 10)

      if (numericCode < 100000000) {
        if (!silent) playAlarmSound()
        setAttendanceMessage({
          type: 'error',
          text: t('quickSearch.staffNumberError')
        })
        setMemberId('')
        setTimeout(() => setAttendanceMessage(null), 4000)
        return
      }

      // ✅ تحويل الرقم من 9 خانات إلى s + رقم
      // مثال: 100000022 -> s022
      const staffNumber = numericCode - 100000000
      const staffCode = `s${staffNumber.toString().padStart(3, '0')}`

      setLoading(true)
      setAttendanceMessage(null)

      try {
        // 🔧 تسجيل حضور الموظف
        const response = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffCode }),
        })

        const data = await response.json()

        if (response.ok) {
          if (!silent) playSuccessSound()
          setAttendanceMessage({
            type: 'success',
            text: data.message,
            staff: data.staff
          })
          setTimeout(() => setAttendanceMessage(null), 5000)
        } else {
          if (!silent) playAlarmSound()
          setAttendanceMessage({
            type: 'error',
            text: data.error || t('quickSearch.attendanceFailed')
          })
          setTimeout(() => setAttendanceMessage(null), 5000)
        }
      } catch (error) {
        console.error('Attendance error:', error)
        if (!silent) playAlarmSound()
        setAttendanceMessage({
          type: 'error',
          text: t('quickSearch.attendanceError')
        })
        setTimeout(() => setAttendanceMessage(null), 5000)
      } finally {
        setLoading(false)
        setMemberId('')
        setTimeout(() => {
          memberIdRef.current?.focus()
          memberIdRef.current?.select()
        }, 500)
      }
      
      return // إنهاء الدالة بعد تسجيل الحضور
    }

    // ✅ البحث العادي عن عضو برقم العضوية
    setLoading(true)
    setSearched(true)
    setAttendanceMessage(null)
    const foundResults: SearchResult[] = []

    try {
      const membersRes = await fetch('/api/members')
      const members = await membersRes.json()
      
      // البحث برقم العضوية (يستثني Other لأنهم memberNumber = null)
      const filteredMembers = members.filter((m: any) => 
        m.memberNumber !== null && m.memberNumber.toString() === inputValue
      )
      
      filteredMembers.forEach((member: any) => {
        foundResults.push({ type: 'member', data: member })
      })

      setResults(foundResults)
      setLastSearchTime(new Date())

      if (foundResults.length > 0) {
        const member = foundResults[0].data

        // 🆕 تسجيل دخول العضو تلقائياً إذا كان اشتراكه نشط
        if (member.isActive) {
          handleMemberCheckIn(member.id)
        }

        // فحص حالة العضو وتشغيل الصوت المناسب
        if (!silent) checkMemberStatusAndPlaySound(member)
      } else {
        // لم يتم العثور على نتائج - صوت إنذار
        if (!silent) playAlarmSound()
      }

      setMemberId('')
      setTimeout(() => {
        memberIdRef.current?.focus()
        memberIdRef.current?.select()
      }, 500)

    } catch (error) {
      console.error('Search error:', error)
      if (!silent) playAlarmSound()
    } finally {
      setLoading(false)
    }
  }

  const handleSearchByName = async (silent: boolean = false) => {
    if (!searchName.trim() && !searchPhone.trim()) {
      if (!silent) playAlarmSound()
      setAttendanceMessage({
        type: 'error',
        text: t('quickSearch.searchByNameError')
      })
      setTimeout(() => setAttendanceMessage(null), 3000)
      return
    }

    setLoading(true)
    setSearched(true)
    setAttendanceMessage(null)
    const foundResults: SearchResult[] = []

    try {
      const membersRes = await fetch('/api/members')
      const members = await membersRes.json()

      const ptRes = await fetch('/api/pt')
      const ptSessions = await ptRes.json()

      const filteredMembers = members.filter((m: any) => {
        const nameMatch = searchName.trim() 
          ? m.name.toLowerCase().includes(searchName.trim().toLowerCase())
          : true
        const phoneMatch = searchPhone.trim()
          ? m.phone.includes(searchPhone.trim())
          : true
        return nameMatch && phoneMatch
      })

      filteredMembers.forEach((member: any) => {
        foundResults.push({ type: 'member', data: member })
      })

      const filteredPT = ptSessions.filter((pt: any) => {
        const nameMatch = searchName.trim()
          ? pt.clientName.toLowerCase().includes(searchName.trim().toLowerCase())
          : true
        const phoneMatch = searchPhone.trim()
          ? pt.phone.includes(searchPhone.trim())
          : true
        return nameMatch && phoneMatch
      })

      filteredPT.forEach((pt: any) => {
        foundResults.push({ type: 'pt', data: pt })
      })

      setResults(foundResults)
      setLastSearchTime(new Date())

      if (foundResults.length > 0) {
        // 🆕 تسجيل دخول العضو تلقائياً إذا كانت النتيجة عضو ولديه اشتراك نشط
        if (foundResults[0].type === 'member' && foundResults[0].data.isActive) {
          handleMemberCheckIn(foundResults[0].data.id)
        }

        // 🆕 فحص حالة أول نتيجة
        if (!silent) {
          if (foundResults[0].type === 'member') {
            checkMemberStatusAndPlaySound(foundResults[0].data)
          } else {
            // PT دائماً صوت نجاح
            playSuccessSound()
          }
        }
      } else {
        // 🆕 لم يتم العثور على نتائج - صوت إنذار
        if (!silent) playAlarmSound()
      }

    } catch (error) {
      console.error('Search error:', error)
      if (!silent) playAlarmSound()
    } finally {
      setLoading(false)
    }
  }

  // دالة لإعادة تحديث آخر نتائج بحث بدون صوت
  const refreshResults = async () => {
    if (results.length === 0) return

    setLoading(true)
    try {
      // جلب البيانات الجديدة بناءً على آخر نتائج
      if (results[0].type === 'member') {
        const memberId = results[0].data.id
        const membersRes = await fetch('/api/members')
        const members = await membersRes.json()
        const updatedMember = members.find((m: any) => m.id === memberId)

        if (updatedMember) {
          setResults([{ type: 'member', data: updatedMember }])
        }
      }
    } catch (error) {
      console.error('Error refreshing results:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleIdKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchById()
    }
  }

  const handleNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchByName()
    }
  }

  const calculateRemainingDays = (expiryDate: string | null | undefined): number | null => {
    if (!expiryDate) return null
    
    const expiry = new Date(expiryDate)
    const today = new Date()
    const diffTime = expiry.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays
  }

  const handleViewMemberDetails = (memberId: string) => {
    router.push(`/members/${memberId}`)
  }

  const handleViewPTDetails = (ptId: string) => {
    router.push(`/pt/${ptId}`)
  }

  return (
    <div className="container mx-auto p-2 sm:p-3 md:p-4 min-h-screen" dir={direction}>
      <div className="mb-3 sm:mb-4">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
          <span>🔍</span>
          <span>{t('quickSearch.title')}</span>
        </h1>
      </div>

      {searchMode === 'id' && (
        <div className="bg-white p-3 sm:p-4 rounded-lg sm:rounded-xl shadow-lg mb-3 sm:mb-4 border-2 border-orange-200">
          <div className="mb-3 sm:mb-4">

            {/* 🆕 رسالة تسجيل الحضور */}
            {attendanceMessage && (
              <div className={`mb-2 sm:mb-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 animate-slideDown ${
                attendanceMessage.type === 'success'
                  ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-500'
                  : 'bg-gradient-to-r from-red-50 to-red-100 border-red-500'
              }`}>
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="text-2xl sm:text-3xl md:text-4xl">
                    {attendanceMessage.type === 'success' ? '✅' : '🚨'}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-base sm:text-lg md:text-xl font-bold mb-1 ${
                      attendanceMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {attendanceMessage.type === 'success' ? t('quickSearch.registrationSuccess') : t('quickSearch.registrationError')}
                    </h3>
                    <p className={`text-sm sm:text-base md:text-lg font-bold ${
                      attendanceMessage.type === 'success' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {attendanceMessage.text}
                    </p>
                    {attendanceMessage.staff && (
                      <div className="mt-2 sm:mt-3 bg-white/50 rounded-lg p-2 sm:p-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-gray-600">{t('nav.employee')}</p>
                            <p className="text-sm sm:text-base font-bold text-gray-800">{attendanceMessage.staff.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">{t('nav.position')}</p>
                            <p className="text-sm sm:text-base font-bold text-gray-800">{getPositionLabel(attendanceMessage.staff.position)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <div className="flex flex-col gap-2 w-1/5">
                <button
                  onClick={() => {
                    setSearchMode('id')
                    setSearched(false)
                    setResults([])
                  }}
                  className={`px-2 py-2 sm:py-3 md:py-4 lg:py-5 rounded-lg font-bold text-xs sm:text-sm md:text-base transition-all ${
                    searchMode === 'id'
                      ? 'bg-orange-600 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>🎯</span>
                    <span>{t('quickSearch.searchModeIdShort')}</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setSearchMode('name')
                    setSearched(false)
                    setResults([])
                  }}
                  className={`px-2 py-2 sm:py-3 md:py-4 lg:py-5 rounded-lg font-bold text-xs sm:text-sm md:text-base transition-all ${
                    (searchMode as SearchMode) === 'name'
                      ? 'bg-green-600 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>👤</span>
                    <span>{t('quickSearch.searchModeNameShort')}</span>
                  </div>
                </button>
              </div>
              <div className="flex-1 flex gap-2">
                <input
                  ref={memberIdRef}
                  type="text"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  onKeyPress={handleIdKeyPress}
                  className="flex-1 px-3 py-2 sm:px-4 sm:py-3 md:px-5 md:py-4 border-2 border-green-300 rounded-lg text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-center focus:border-green-600 focus:ring-2 focus:ring-green-200 transition"
                  placeholder={t('quickSearch.inputPlaceholder')}
                  autoFocus
                />
                <button
                  onClick={() => handleSearchById()}
                  disabled={loading || !memberId.trim()}
                  className="px-4 sm:px-6 md:px-8 bg-green-600 text-white text-2xl sm:text-3xl md:text-4xl rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition"
                >
                  {loading ? '⏳' : '🔍'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {searchMode === 'name' && (
        <div className="bg-white p-3 sm:p-4 rounded-lg sm:rounded-xl shadow-lg mb-3 sm:mb-4 border-2 border-green-200">

          {/* 🆕 رسالة الخطأ */}
          {attendanceMessage && (
            <div className="mb-2 sm:mb-3 p-2 sm:p-3 rounded-lg border-2 bg-red-50 border-red-500 animate-slideDown">
              <p className="text-sm sm:text-base font-bold text-red-700">
                {attendanceMessage.text}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex flex-col gap-2 w-1/5">
              <button
                onClick={() => {
                  setSearchMode('id')
                  setSearched(false)
                  setResults([])
                }}
                className={`px-2 py-2 sm:py-3 md:py-4 lg:py-5 rounded-lg font-bold text-xs sm:text-sm md:text-base transition-all ${
                  (searchMode as SearchMode) === 'id'
                    ? 'bg-orange-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span>🎯</span>
                  <span>{t('quickSearch.searchModeIdShort')}</span>
                </div>
              </button>
              <button
                onClick={() => {
                  setSearchMode('name')
                  setSearched(false)
                  setResults([])
                }}
                className={`px-2 py-2 sm:py-3 md:py-4 lg:py-5 rounded-lg font-bold text-xs sm:text-sm md:text-base transition-all ${
                  (searchMode as SearchMode) === 'name'
                    ? 'bg-green-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span>👤</span>
                  <span>{t('quickSearch.searchModeNameShort')}</span>
                </div>
              </button>
            </div>

            <div className="flex-1 flex gap-2">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">{t('quickSearch.nameLabel')}</label>
                  <input
                    ref={nameRef}
                    type="text"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    onKeyPress={handleNameKeyPress}
                    className="w-full px-2 py-2 md:px-3 md:py-2 border-2 border-green-300 rounded-lg text-xs sm:text-sm md:text-base focus:border-green-600 focus:ring-2 focus:ring-green-200 transition"
                    placeholder={t('quickSearch.namePlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">{t('quickSearch.phoneLabel')}</label>
                  <input
                    type="tel"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    onKeyPress={handleNameKeyPress}
                    className="w-full px-2 py-2 md:px-3 md:py-2 border-2 border-green-300 rounded-lg text-xs sm:text-sm md:text-base focus:border-green-600 focus:ring-2 focus:ring-green-200 transition"
                    placeholder={t('quickSearch.phonePlaceholder')}
                  />
                </div>
              </div>

              <button
                onClick={() => handleSearchByName()}
                disabled={loading || (!searchName.trim() && !searchPhone.trim())}
                className="self-end px-4 sm:px-6 md:px-8 py-2 md:py-2 bg-green-600 text-white text-2xl sm:text-3xl md:text-4xl rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition"
              >
                {loading ? '⏳' : '🔍'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lastSearchTime && (
        <div className="bg-gray-100 p-1.5 sm:p-2 rounded-lg text-center text-xs text-gray-600 mb-2 sm:mb-3">
          {t('quickSearch.lastSearch')} {lastSearchTime.toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
        </div>
      )}

      {searched && (
        <div className="bg-white rounded-lg sm:rounded-xl shadow-lg overflow-hidden border-2 border-green-200 animate-fadeIn">
          {loading ? (
            <div className="text-center py-8 sm:py-10 md:py-12">
              <div className="inline-block animate-spin text-2xl sm:text-3xl md:text-4xl mb-2 sm:mb-3">⏳</div>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 font-bold">{t('quickSearch.searching')}</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 sm:py-10 md:py-12 bg-red-50 animate-pulse">
              <div className="text-3xl sm:text-4xl md:text-5xl mb-3 sm:mb-4 animate-bounce">🚨</div>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-red-600 mb-2 px-4">{t('quickSearch.noResults')}</p>
              <p className="text-sm sm:text-base md:text-lg text-red-500 px-4">
                {searchMode === 'id'
                  ? `${t('quickSearch.noResultsFor')} "${memberId}"`
                  : `${t('quickSearch.noResultsFor')} "${searchName || searchPhone}"`
                }
              </p>
            </div>
          ) : (
            <div className="p-3 sm:p-4">
              <div className="mb-2 sm:mb-3 text-center">
                <span className="bg-green-100 text-green-800 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base md:text-lg font-bold">
                  ✅ {t('quickSearch.resultsFound')} {results.length} {results.length === 1 ? t('quickSearch.result') : t('quickSearch.results')}
                </span>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {results.map((result, index) => (
                  <div key={index} className="border-2 border-orange-200 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:bg-orange-50 transition">
                    {result.type === 'member' && (
                      <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0 mb-3">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-orange-300 bg-gray-100 flex-shrink-0">
                              {result.data.profileImage ? (
                                <img
                                  src={result.data.profileImage}
                                  alt={result.data.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              )}
                            </div>

                            <div>
                              <span className="bg-orange-500 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm md:text-base font-bold">
                                {t('quickSearch.memberBadge')}
                              </span>
                              <h3 className="text-base sm:text-lg md:text-xl font-bold mt-1 sm:mt-2">{result.data.name}</h3>
                            </div>
                          </div>
                          {/* ✅ عرض رقم العضوية فقط إذا كان موجود (ليس Other) */}
                          {result.data.memberNumber !== null && (
                            <span className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-600">
                              #{result.data.memberNumber}
                            </span>
                          )}
                          {result.data.memberNumber === null && (
                            <span className="text-sm sm:text-base md:text-lg font-bold text-gray-500 bg-gray-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
                              {t('quickSearch.other')}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 sm:mb-3">
                          <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                            <p className="text-xs text-gray-600">{t('search.phone')}</p>
                            <p className="text-sm sm:text-base md:text-lg font-bold">{result.data.phone}</p>
                          </div>
                          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-2 sm:p-3 rounded-lg border border-orange-200">
                            <p className="text-xs text-gray-600">⭐ {t('quickSearch.loyaltyBalance')}</p>
                            <p className="text-sm sm:text-base md:text-lg font-bold text-orange-600">
                              {memberLoyalty?.pointsBalance?.toLocaleString() || 0}
                              {memberLoyalty?.pointsBalance > 0 && (
                                <span className="text-xs text-orange-500 mr-1">
                                  (≈ {convertPointsToEGP(memberLoyalty.pointsBalance).toLocaleString()} ج.م)
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                            <p className="text-xs text-gray-600">{t('quickSearch.packageName')}</p>
                            <p className="text-sm sm:text-base md:text-lg font-bold text-blue-600">{result.data.currentOfferName || '-'}</p>
                          </div>
                          <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                            <p className="text-xs text-gray-600">{t('search.status')}</p>
                            {(() => {
                              const freezeStatus = getFreezeStatus(result.data)
                              if (freezeStatus && freezeStatus.isFrozen) {
                                return (
                                  <span className="inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-xs sm:text-sm md:text-base font-bold bg-blue-500 text-white">
                                    🧊 {t('members.frozen')} ({freezeStatus.remainingDays} {t('members.days')})
                                  </span>
                                )
                              }
                              return (
                                <span className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-xs sm:text-sm md:text-base font-bold ${
                                  result.data.isActive && (!result.data.expiryDate || new Date(result.data.expiryDate) >= new Date())
                                    ? 'bg-green-500 text-white'
                                    : 'bg-red-500 text-white animate-pulse'
                                }`}>
                                  {result.data.isActive && (!result.data.expiryDate || new Date(result.data.expiryDate) >= new Date()) ? t('quickSearch.active') : t('quickSearch.expired')}
                                </span>
                              )
                            })()}
                          </div>
                        </div>

                        {result.data.expiryDate && (
                          <div className="mb-2 sm:mb-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-2 sm:p-3">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0">
                              <div>
                                <p className="text-xs text-gray-600">{t('quickSearch.expiryDateLabel')}</p>
                                <p className="text-sm sm:text-base md:text-lg font-bold text-gray-800">
                                  {new Date(result.data.expiryDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                </p>
                              </div>
                              {(() => {
                                const days = calculateRemainingDays(result.data.expiryDate)
                                if (days === null) return null

                                if (days < 0) {
                                  return (
                                    <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                                      <p className="text-red-600 font-bold text-sm sm:text-base md:text-lg animate-pulse">
                                        {t('quickSearch.expiredSince')} {Math.abs(days)} {t('quickSearch.daysLeft')}
                                      </p>
                                    </div>
                                  )
                                } else if (days <= 7) {
                                  return (
                                    <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                                      <p className="text-orange-600 font-bold text-sm sm:text-base md:text-lg">
                                        {t('quickSearch.onlyDaysLeft')} {days} {t('quickSearch.daysLeftSuffix')}
                                      </p>
                                    </div>
                                  )
                                } else {
                                  return (
                                    <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                                      <p className="text-green-600 font-bold text-sm sm:text-base md:text-lg">
                                        {t('quickSearch.daysRemaining')} {days} {t('quickSearch.daysRemainingSuffix')}
                                      </p>
                                    </div>
                                  )
                                }
                              })()}
                            </div>
                          </div>
                        )}

                        {/* 🆕 عرض حد الحضور */}
                        {attendanceInfo && (
                          <div className={`mb-2 sm:mb-3 border-2 rounded-lg p-2 sm:p-3 ${
                            attendanceInfo.attendanceLimitWarning
                              ? 'bg-red-50 border-red-400 animate-pulse'
                              : attendanceInfo.isUnlimited
                                ? 'bg-blue-50 border-blue-300'
                                : attendanceInfo.attendanceRemaining !== null && attendanceInfo.attendanceRemaining <= 3
                                  ? 'bg-orange-50 border-orange-400'
                                  : 'bg-green-50 border-green-300'
                          }`}>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl sm:text-2xl">🚪</span>
                                <div>
                                  <p className="text-xs text-gray-600">{t('attendanceLimit.title')}</p>
                                  {attendanceInfo.isUnlimited ? (
                                    <p className="text-sm sm:text-base md:text-lg font-bold text-blue-600">{t('attendanceLimit.unlimitedSymbol')}</p>
                                  ) : (
                                    <p className="text-sm sm:text-base md:text-lg font-bold">
                                      {t('attendanceLimit.used').replace('{used}', String(attendanceInfo.attendanceDaysUsed)).replace('{total}', String(attendanceInfo.attendanceLimit))}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {!attendanceInfo.isUnlimited && (
                                <div className={`px-3 py-1.5 rounded-lg font-bold text-sm sm:text-base ${
                                  attendanceInfo.attendanceLimitWarning
                                    ? 'bg-red-500 text-white animate-bounce'
                                    : attendanceInfo.attendanceRemaining !== null && attendanceInfo.attendanceRemaining <= 3
                                      ? 'bg-orange-500 text-white'
                                      : 'bg-green-500 text-white'
                                }`}>
                                  {attendanceInfo.attendanceLimitWarning ? (
                                    <span>{t('attendanceLimit.warning')}</span>
                                  ) : (
                                    <span>{t('attendanceLimit.remaining').replace('{count}', String(attendanceInfo.attendanceRemaining))}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* عرض الملاحظات */}
                        {result.data.notes && (
                          <div className="mb-2 sm:mb-3 bg-orange-50 border-2 border-orange-400 rounded-lg p-2 sm:p-3">
                            <div className="flex items-start gap-1.5 mb-1">
                              <span className="text-base sm:text-lg">📝</span>
                              <p className="text-xs font-bold text-orange-800">{t('quickSearch.notesLabel')}</p>
                            </div>
                            <p className="text-xs sm:text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {result.data.notes}
                            </p>
                          </div>
                        )}

                        {/* عرض الخدمات المجانية المتبقية */}
                        {result.data.isActive && (
                          result.data.invitations > 0 ||
                          result.data.freePTSessions > 0 ||
                          result.data.inBodyScans > 0 ||
                          result.data.movementAssessments > 0 ||
                          result.data.nutritionSessions > 0 ||
                          result.data.physiotherapySessions > 0 ||
                          result.data.onboardingSessions > 0 ||
                          result.data.followUpSessions > 0 ||
                          result.data.groupClasses > 0 ||
                          result.data.poolSessions > 0 ||
                          result.data.paddleSessions > 0
                        ) && (
                          <div className="mb-2 sm:mb-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="text-lg sm:text-xl">🎁</span>
                              <p className="text-xs sm:text-sm font-bold text-purple-800">{t('quickSearch.freeServices')}</p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                              {/* الدعوات */}
                              {result.data.invitations > 0 && (
                                <div className="bg-white rounded-lg shadow-md p-2 border-r-4 border-purple-500">
                                  <div className="flex flex-col items-center gap-2 mb-2">
                                    <div className="text-3xl">🎟️</div>
                                    <p className="text-2xl font-bold text-purple-600">{result.data.invitations}</p>
                                  </div>
                                  <button
                                    onClick={() => setInvitationModal({ isOpen: true, memberId: result.data.id, memberName: result.data.name })}
                                    className="w-full bg-purple-600 text-white py-1 px-2 rounded text-xs hover:bg-purple-700"
                                  >
                                    {t('quickSearch.useButton')}
                                  </button>
                                </div>
                              )}

                              {/* جلسات PT المجانية */}
                              {result.data.freePTSessions > 0 && (
                                <div className="bg-white rounded-lg shadow-md p-2 border-r-4 border-green-500">
                                  <div className="flex flex-col items-center gap-2 mb-2">
                                    <div className="text-3xl">💪</div>
                                    <p className="text-2xl font-bold text-green-600">{result.data.freePTSessions}</p>
                                  </div>
                                  <button
                                    onClick={() => setServiceModal({ isOpen: true, type: 'freePT', memberId: result.data.id, memberName: result.data.name })}
                                    className="w-full bg-green-600 text-white py-1 px-2 rounded text-xs hover:bg-green-700"
                                  >
                                    {t('quickSearch.deductButton')}
                                  </button>
                                </div>
                              )}

                              {/* InBody المجاني */}
                              {result.data.inBodyScans > 0 && (
                                <div className="bg-white rounded-lg shadow-md p-2 border-r-4 border-orange-500">
                                  <div className="flex flex-col items-center gap-2 mb-2">
                                    <div className="text-3xl">⚖️</div>
                                    <p className="text-2xl font-bold text-orange-600">{result.data.inBodyScans}</p>
                                  </div>
                                  <button
                                    onClick={() => setServiceModal({ isOpen: true, type: 'inBody', memberId: result.data.id, memberName: result.data.name })}
                                    className="w-full bg-orange-600 text-white py-1 px-2 rounded text-xs hover:bg-orange-700"
                                  >
                                    {t('quickSearch.deductButton')}
                                  </button>
                                </div>
                              )}

                              {/* تقييم الحركة */}
                              {result.data.movementAssessments > 0 && (
                                <div className="bg-white rounded-lg shadow-md p-2 border-r-4 border-blue-500">
                                  <div className="flex flex-col items-center gap-2 mb-2">
                                    <div className="text-3xl">🏃</div>
                                    <p className="text-2xl font-bold text-blue-600">{result.data.movementAssessments}</p>
                                  </div>
                                  <button
                                    onClick={() => setServiceModal({ isOpen: true, type: 'movementAssessment', memberId: result.data.id, memberName: result.data.name })}
                                    className="w-full bg-blue-600 text-white py-1 px-2 rounded text-xs hover:bg-blue-700"
                                  >
                                    {t('quickSearch.deductButton')}
                                  </button>
                                </div>
                              )}

                              {/* جلسات التغذية */}
                              {result.data.nutritionSessions > 0 && (
                                <div className="bg-white rounded-lg shadow-md p-2 border-r-4 border-green-500">
                                  <div className="flex flex-col items-center gap-2 mb-2">
                                    <div className="text-3xl">🥗</div>
                                    <p className="text-2xl font-bold text-green-600">{result.data.nutritionSessions}</p>
                                  </div>
                                  <button
                                    onClick={() => setServiceModal({ isOpen: true, type: 'nutrition', memberId: result.data.id, memberName: result.data.name })}
                                    className="w-full bg-green-600 text-white py-1 px-2 rounded text-xs hover:bg-green-700"
                                  >
                                    {t('quickSearch.deductButton')}
                                  </button>
                                </div>
                              )}

                              {/* جلسات العلاج الطبيعي */}
                              {result.data.physiotherapySessions > 0 && (
                                <div className="bg-white rounded-lg shadow-md p-2 border-r-4 border-red-500">
                                  <div className="flex flex-col items-center gap-2 mb-2">
                                    <div className="text-3xl">🏥</div>
                                    <p className="text-2xl font-bold text-red-600">{result.data.physiotherapySessions}</p>
                                  </div>
                                  <button
                                    onClick={() => setServiceModal({ isOpen: true, type: 'physiotherapy', memberId: result.data.id, memberName: result.data.name })}
                                    className="w-full bg-red-600 text-white py-1 px-2 rounded text-xs hover:bg-red-700"
                                  >
                                    {t('quickSearch.deductButton')}
                                  </button>
                                </div>
                              )}

                              {/* جلسات التأهيل */}
                              {result.data.onboardingSessions > 0 && (
                                <div className="bg-white rounded-lg shadow-md p-2 border-r-4 border-indigo-500">
                                  <div className="flex flex-col items-center gap-2 mb-2">
                                    <div className="text-3xl">🎯</div>
                                    <p className="text-2xl font-bold text-indigo-600">{result.data.onboardingSessions}</p>
                                  </div>
                                  <button
                                    onClick={() => setServiceModal({ isOpen: true, type: 'onboarding', memberId: result.data.id, memberName: result.data.name })}
                                    className="w-full bg-indigo-600 text-white py-1 px-2 rounded text-xs hover:bg-indigo-700"
                                  >
                                    {t('quickSearch.deductButton')}
                                  </button>
                                </div>
                              )}

                              {/* جلسات المتابعة */}
                              {result.data.followUpSessions > 0 && (
                                <div className="bg-white rounded-lg shadow-md p-2 border-r-4 border-yellow-500">
                                  <div className="flex flex-col items-center gap-2 mb-2">
                                    <div className="text-3xl">📋</div>
                                    <p className="text-2xl font-bold text-yellow-600">{result.data.followUpSessions}</p>
                                  </div>
                                  <button
                                    onClick={() => setServiceModal({ isOpen: true, type: 'followUp', memberId: result.data.id, memberName: result.data.name })}
                                    className="w-full bg-yellow-600 text-white py-1 px-2 rounded text-xs hover:bg-yellow-700"
                                  >
                                    {t('quickSearch.deductButton')}
                                  </button>
                                </div>
                              )}

                              {/* الحصص الجماعية */}
                              {result.data.groupClasses > 0 && (
                                <div className="bg-white rounded-lg shadow-md p-2 border-r-4 border-pink-500">
                                  <div className="flex flex-col items-center gap-2 mb-2">
                                    <div className="text-3xl">👥</div>
                                    <p className="text-2xl font-bold text-pink-600">{result.data.groupClasses}</p>
                                  </div>
                                  <button
                                    onClick={() => setServiceModal({ isOpen: true, type: 'groupClass', memberId: result.data.id, memberName: result.data.name })}
                                    className="w-full bg-pink-600 text-white py-1 px-2 rounded text-xs hover:bg-pink-700"
                                  >
                                    {t('quickSearch.deductButton')}
                                  </button>
                                </div>
                              )}

                              {/* جلسات المسبح */}
                              {result.data.poolSessions > 0 && (
                                <div className="bg-white rounded-lg shadow-md p-2 border-r-4 border-cyan-500">
                                  <div className="flex flex-col items-center gap-2 mb-2">
                                    <div className="text-3xl">🏊</div>
                                    <p className="text-2xl font-bold text-cyan-600">{result.data.poolSessions}</p>
                                  </div>
                                  <button
                                    onClick={() => setServiceModal({ isOpen: true, type: 'pool', memberId: result.data.id, memberName: result.data.name })}
                                    className="w-full bg-cyan-600 text-white py-1 px-2 rounded text-xs hover:bg-cyan-700"
                                  >
                                    {t('quickSearch.deductButton')}
                                  </button>
                                </div>
                              )}

                              {/* جلسات البادل */}
                              {result.data.paddleSessions > 0 && (
                                <div className="bg-white rounded-lg shadow-md p-2 border-r-4 border-teal-500">
                                  <div className="flex flex-col items-center gap-2 mb-2">
                                    <div className="text-3xl">🏓</div>
                                    <p className="text-2xl font-bold text-teal-600">{result.data.paddleSessions}</p>
                                  </div>
                                  <button
                                    onClick={() => setServiceModal({ isOpen: true, type: 'paddle', memberId: result.data.id, memberName: result.data.name })}
                                    className="w-full bg-teal-600 text-white py-1 px-2 rounded text-xs hover:bg-teal-700"
                                  >
                                    {t('quickSearch.deductButton')}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-2">
                          <button
                            onClick={() => handleViewMemberDetails(result.data.id)}
                            className="w-full bg-gradient-to-r from-orange-600 to-orange-700 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all shadow-lg hover:shadow-xl font-bold text-xs sm:text-sm md:text-base flex items-center justify-center gap-1.5 sm:gap-2"
                          >
                            <span>👁️</span>
                            <span>{t('quickSearch.viewFullDetails')}</span>
                            <span>{direction === 'rtl' ? '➡️' : '⬅️'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {result.type === 'pt' && (
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="bg-green-500 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm md:text-base font-bold">
                              {t('quickSearch.ptBadge')}
                            </span>
                            <h3 className="text-base sm:text-lg md:text-xl font-bold mt-1 sm:mt-2">{result.data.clientName}</h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 sm:mb-3">
                          <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                            <p className="text-xs text-gray-600">{t('search.phone')}</p>
                            <p className="text-sm sm:text-base md:text-lg font-bold">{result.data.phone}</p>
                          </div>
                          <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                            <p className="text-xs text-gray-600">{t('quickSearch.coach')}</p>
                            <p className="text-sm sm:text-base md:text-lg font-bold">{result.data.coachName}</p>
                          </div>
                          <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                            <p className="text-xs text-gray-600">{t('quickSearch.sessionsRemaining')}</p>
                            <p className="text-sm sm:text-base md:text-lg font-bold text-green-600">{result.data.sessionsRemaining}</p>
                          </div>
                          <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                            <p className="text-xs text-gray-600">{t('quickSearch.pricePerSession')}</p>
                            <p className="text-sm sm:text-base md:text-lg font-bold">{result.data.pricePerSession} EGP</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleViewPTDetails(result.data.id)}
                          className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl font-bold text-xs sm:text-sm md:text-base flex items-center justify-center gap-1.5 sm:gap-2"
                        >
                          <span>👁️</span>
                          <span>{t('quickSearch.viewFullDetails')}</span>
                          <span>{direction === 'rtl' ? '➡️' : '⬅️'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <InvitationModal
        isOpen={invitationModal.isOpen}
        memberId={invitationModal.memberId}
        memberName={invitationModal.memberName}
        onClose={() => setInvitationModal({ isOpen: false, memberId: '', memberName: '' })}
        onSuccess={() => {
          // تحديث البيانات بدون صوت
          refreshResults()
        }}
      />

      <SimpleServiceModal
        isOpen={serviceModal.isOpen}
        serviceType={serviceModal.type}
        memberId={serviceModal.memberId}
        memberName={serviceModal.memberName}
        onClose={() => setServiceModal({ isOpen: false, type: 'freePT', memberId: '', memberName: '' })}
        onSuccess={() => {
          // تحديث البيانات بدون صوت
          refreshResults()
        }}
      />

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-slideDown {
          animation: slideDown 0.4s ease-out;
        }
      `}</style>
    </div>
  )
}