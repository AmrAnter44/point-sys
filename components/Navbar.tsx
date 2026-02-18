'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { usePermissions } from '../hooks/usePermissions'
import type { Permissions } from '../types/permissions'
import AdminDateOverride from './AdminDateOverride'
import { useAdminDate } from '../contexts/AdminDateContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useBarcodeScanner } from '../contexts/BarcodeScannerContext'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { hasPermission, user, isAdmin } = usePermissions()
  const { setCustomCreatedAt } = useAdminDate()
  const { t, locale } = useLanguage()
  const { lastScannedCode, settings: scannerSettings } = useBarcodeScanner()
  const [quickSearchId, setQuickSearchId] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchMessage, setSearchMessage] = useState<{type: 'success' | 'error' | 'warning', text: string, staff?: any} | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const allLinks = [
    { href: '/members', label: t('nav.members'), icon: '👥', permission: 'canViewMembers' as keyof Permissions, roleRequired: null },
    { href: '/pt', label: t('nav.pt'), icon: '💪', permission: 'canViewPT' as keyof Permissions, roleRequired: null },
    { href: '/physiotherapy', label: t('nav.physiotherapy'), icon: '🩺', permission: 'canViewDayUse' as keyof Permissions, roleRequired: null },
    { href: '/nutrition', label: t('nav.nutrition'), icon: '🥗', permission: 'canViewDayUse' as keyof Permissions, roleRequired: null },
    { href: '/coach/rotations', label: t('nav.rotations'), icon: '🔄', permission: 'canRegisterPTAttendance' as keyof Permissions, roleRequired: 'COACH' },
    { href: '/dayuse', label: t('nav.dayUse'), icon: '📊', permission: 'canViewDayUse' as keyof Permissions, roleRequired: null },
    { href: '/invitations', label: t('nav.invitations'), icon: '🎟️', permission: 'canViewVisitors' as keyof Permissions, roleRequired: null },
    { href: '/staff', label: t('nav.staff'), icon: '👷', permission: 'canViewStaff' as keyof Permissions, roleRequired: null },
    { href: '/receipts', label: t('nav.receipts'), icon: '🧾', permission: 'canViewReceipts' as keyof Permissions, roleRequired: null },
    { href: '/expenses', label: t('nav.expenses'), icon: '💸', permission: 'canViewExpenses' as keyof Permissions, roleRequired: null },
    { href: '/visitors', label: t('nav.visitors'), icon: '🚶', permission: 'canViewVisitors' as keyof Permissions, roleRequired: null },
    { href: '/followups', label: t('nav.followups'), icon: '📝', permission: 'canViewFollowUps' as keyof Permissions, roleRequired: null },
    { href: '/search', label: t('nav.search'), icon: '🔍', permission: 'canViewMembers' as keyof Permissions, roleRequired: null },
    { href: '/closing', label: t('nav.closing'), icon: '💰', permission: 'canAccessClosing' as keyof Permissions, roleRequired: null },
    { href: '/member-attendance', label: t('nav.memberAttendance'), icon: '🏋️', permission: 'canViewMembers' as keyof Permissions, roleRequired: null },
    { href: '/settings', label: t('nav.settings'), icon: '⚙️', permission: null, roleRequired: null },
  ]

  // Filter links based on permissions and role
  const links = allLinks.filter(link => {
    // Check permission
    if (link.permission && !hasPermission(link.permission)) return false

    // Check role if required
    if (link.roleRequired && user?.role !== link.roleRequired) return false

    return true
  })

  // Open search modal with Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearchModal(true)
        setSearchMessage(null)
        setTimeout(() => {
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
        }, 10)
      }
      // ESC to close
      if (e.key === 'Escape') {
        setShowSearchModal(false)
        setQuickSearchId('')
        setSearchMessage(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ✅ Global barcode scan handler
  useEffect(() => {
    if (!lastScannedCode || !scannerSettings.enabled) return

    if (scannerSettings.behavior === 'open-modal') {
      console.log(`🔍 Barcode scanned in Navbar: "${lastScannedCode}"`)

      // Open modal
      setShowSearchModal(true)
      setSearchMessage(null)

      // Fill input
      setQuickSearchId(lastScannedCode)

      // Focus and trigger search after a short delay
      setTimeout(() => {
        searchInputRef.current?.focus()
        setTimeout(() => {
          handleQuickSearch()
        }, 100)
      }, 50)
    }
  }, [lastScannedCode])

  const playSuccessSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const times = [0, 0.15, 0.3]
      const frequencies = [523.25, 659.25, 783.99]
      
      times.forEach((time, index) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequencies[index], ctx.currentTime + time)
        gainNode.gain.setValueAtTime(0.8, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.3)
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.3)
      })
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  const playAlarmSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const alarmPattern = [
        { freq: 2000, time: 0 },
        { freq: 600, time: 0.15 },
        { freq: 2000, time: 0.3 },
      ]
      
      alarmPattern.forEach(({ freq, time }) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'square'
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime + time)
        gainNode.gain.setValueAtTime(0.9, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.15)
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.15)
      })
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  const playWarningSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const times = [0, 0.2]
      const frequencies = [440, 370]
      
      times.forEach((time, index) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'triangle'
        oscillator.frequency.setValueAtTime(frequencies[index], ctx.currentTime + time)
        gainNode.gain.setValueAtTime(0.7, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.25)
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.25)
      })
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  // دالة للتحقق من حالة التجميد
  const getFreezeStatus = (member: any) => {
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

  const checkMemberStatusAndPlaySound = (member: any) => {
    // أولاً: فحص حالة التجميد
    const freezeStatus = getFreezeStatus(member)
    if (freezeStatus && freezeStatus.isFrozen) {
      playSuccessSound() // صوت نجاح للعضو المجمد
      return 'frozen'
    }

    const isActive = member.isActive
    const expiryDate = member.expiryDate ? new Date(member.expiryDate) : null
    const today = new Date()

    if (!isActive || (expiryDate && expiryDate < today)) {
      playAlarmSound()
      return 'expired'
    } else if (expiryDate) {
      const diffTime = expiryDate.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays <= 7) {
        playWarningSound()
        return 'warning'
      } else {
        playSuccessSound()
        return 'active'
      }
    } else {
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

      if (response.ok && !data.alreadyCheckedIn) {
        console.log('✅ تم تسجيل دخول العضو:', data.message)
      } else if (data.alreadyCheckedIn) {
        console.log('ℹ️ العضو مسجل دخول بالفعل')
      }
    } catch (error) {
      console.error('Error checking in member:', error)
    }
  }

  const handleQuickSearch = async () => {
    if (!quickSearchId.trim()) {
      playAlarmSound()
      setSearchMessage({ type: 'error', text: '⚠️ يرجى إدخال رقم العضوية أو رقم الموظف' })
      return
    }

    setIsSearching(true)
    setSearchMessage(null)

    const inputValue = quickSearchId.trim()

    // ✅ فحص إذا كان الرقم 9 خانات أو أكثر - موظف
    if (/^\d{9,}$/.test(inputValue)) {
      const numericCode = parseInt(inputValue, 10)

      if (numericCode < 100000000) {
        playAlarmSound()
        setSearchMessage({ type: 'error', text: '❌ رقم الموظف يجب أن يكون 9 أرقام (مثال: 100000022)' })
        setQuickSearchId('')
        setTimeout(() => {
          setSearchMessage(null)
          searchInputRef.current?.focus()
        }, 3000)
        setIsSearching(false)
        return
      }

      // ✅ تحويل الرقم من 9 خانات إلى s + رقم
      // مثال: 100000022 -> s022
      const staffNumber = numericCode - 100000000
      const staffCode = `s${staffNumber.toString().padStart(3, '0')}`

      try {
        const response = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffCode }),
        })

        const data = await response.json()

        if (response.ok) {
          playSuccessSound()
          setSearchMessage({ 
            type: 'success', 
            text: data.message,
            staff: data.staff
          })
        } else {
          playAlarmSound()
          setSearchMessage({ type: 'error', text: data.error || 'فشل تسجيل الحضور' })
        }
      } catch (error) {
        console.error('Attendance error:', error)
        playAlarmSound()
        setSearchMessage({ type: 'error', text: 'حدث خطأ في تسجيل الحضور' })
      }

      setQuickSearchId('')
      setTimeout(() => {
        setSearchMessage(null)
        searchInputRef.current?.focus()
      }, 1500)
      setIsSearching(false)
      return
    }

    // ✅ البحث العادي عن عضو
    try {
      const res = await fetch('/api/members')
      const members = await res.json()
      
      const member = members.find((m: any) => 
        m.memberNumber !== null && m.memberNumber.toString() === inputValue
      )

      if (member) {
        const status = checkMemberStatusAndPlaySound(member)

        // 🆕 تسجيل دخول العضو تلقائياً إذا كان اشتراكه نشط وليس مجمد
        if (member.isActive && status !== 'frozen') {
          handleMemberCheckIn(member.id)
        }

        if (status === 'frozen') {
          const freezeStatus = getFreezeStatus(member)
          setSearchMessage({
            type: 'success',
            text: t('checkStatus.memberSubscriptionFrozen', {
              name: member.name,
              days: String(freezeStatus?.remainingDays || 0),
              daysLabel: t('members.days')
            })
          })
        } else if (status === 'expired') {
          setSearchMessage({
            type: 'error',
            text: t('checkStatus.memberSubscriptionExpired', { name: member.name })
          })
        } else if (status === 'warning') {
          setSearchMessage({
            type: 'warning',
            text: t('checkStatus.memberSubscriptionExpiringSoon', { name: member.name })
          })
        } else {
          setSearchMessage({
            type: 'success',
            text: t('checkStatus.memberSubscriptionActive', { name: member.name })
          })
        }

        setQuickSearchId('')
        setTimeout(() => {
          setSearchMessage(null)
          searchInputRef.current?.focus()
        }, 1500)
      } else {
        playAlarmSound()
        setSearchMessage({
          type: 'error',
          text: t('checkStatus.memberNumberNotFound', { number: inputValue })
        })
        setQuickSearchId('')
        setTimeout(() => {
          setSearchMessage(null)
          searchInputRef.current?.focus()
        }, 1500)
      }
    } catch (error) {
      console.error('Quick search error:', error)
      playAlarmSound()
      setSearchMessage({ type: 'error', text: t('checkStatus.searchError') })
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuickSearch()
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const getRoleLabel = (role: string) => {
    const roleKey = role.toLowerCase()
    return t(`roles.${roleKey}` as any) || role
  }

  const getPositionLabel = (position: string | null): string => {
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

  return (
    <>
      {/* ✅ Navbar أفقية مع أيقونات عمودية على اليمين */}
      <nav className="bg-orange-700 backdrop-blur-md text-white shadow-xl sticky top-0 z-40 border-b border-white/10">
        <div className="w-full px-2 sm:px-4 relative z-10">
          <div className="flex items-center justify-between gap-2">
            {/* Hamburger Menu و Home Link - على اليسار */}
            <div className="flex items-center gap-2 flex-shrink-0 py-1.5">
              {/* Hamburger Menu - Mobile only */}
              <button
                onClick={() => setShowDrawer(!showDrawer)}
                className="lg:hidden p-1.5 hover:bg-white/20 rounded-lg transition-all hover:scale-110 active:scale-95"
                aria-label="القائمة"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Home Link */}
              <Link
                href="/"
                className="flex items-center hover:bg-white/20 rounded-lg transition-all hover:scale-110 active:scale-95 px-3 py-1.5 text-xl font-bold"
                title={t('nav.home')}
              >
                🏠
              </Link>
            </div>

            {/* روابط التنقل - في الوسط على Desktop */}
            <div className="hidden lg:flex lg:justify-center lg:flex-wrap gap-1 xl:gap-1.5 py-1.5 flex-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2 xl:px-2.5 py-1 xl:py-1.5 rounded-lg transition-all hover:bg-white/15 text-center flex items-center justify-center gap-1 hover:scale-105 active:scale-95 border border-transparent font-bold ${
                    pathname === link.href ? 'bg-white/20 border-white/30 shadow-lg' : 'hover:border-white/20'
                  }`}
                >
                  <span className="text-sm xl:text-base drop-shadow">{link.icon}</span>
                  <span className="text-sm whitespace-nowrap">{link.label}</span>
                </Link>
              ))}
            </div>

            {/* الأيقونات أفقية على اليمين */}
            <div className="flex flex-row gap-2 py-1.5 items-center">
              {/* User Icon - Dropdown */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center justify-center bg-white/10 backdrop-blur-sm p-1.5 rounded-full hover:bg-white/20 transition-all hover:scale-110 active:scale-95 border border-white/20"
                    title={user.name}
                  >
                    <div className="w-7 h-7 bg-gradient-to-br from-white/40 to-white/20 rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  {showUserMenu && (
                    <>
                      {/* Backdrop to close menu */}
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setShowUserMenu(false)}
                      />

                      {/* Menu */}
                      <div
                        dir={locale === 'ar' ? 'rtl' : 'ltr'}
                        className={`absolute mt-2 w-64 bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl overflow-hidden z-40 border-2 border-orange-600/50 ${
                          locale === 'ar' ? 'left-0' : 'right-0'
                        }`}>
                        {/* User Info */}
                        <div className="bg-orange-700 backdrop-blur-sm text-white p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center font-bold text-lg">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold">{user.name}</p>
                              <p className="text-xs text-white/80">{user.email}</p>
                              <p className="text-xs mt-1">{getRoleLabel(user.role)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Menu Items */}
                        <div className="py-2">
                          {user.role === 'ADMIN' && (
                            <>
                              <Link
                                href="/admin/users"
                                onClick={() => setShowUserMenu(false)}
                                className={`px-4 py-3 text-gray-700 hover:bg-orange-50/80 transition-all flex items-center gap-2 ${
                                  locale === 'ar' ? 'hover:translate-x-1' : 'hover:-translate-x-1'
                                }`}
                              >
                                <span>👥</span>
                                <span>{t('auth.manageUsers')}</span>
                              </Link>
                              <Link
                                href="/admin/activity-log"
                                onClick={() => setShowUserMenu(false)}
                                className={`px-4 py-3 text-gray-700 hover:bg-orange-50/80 transition-all flex items-center gap-2 ${
                                  locale === 'ar' ? 'hover:translate-x-1' : 'hover:-translate-x-1'
                                }`}
                              >
                                <span>📋</span>
                                <span>سجل النشاط</span>
                              </Link>
                            </>
                          )}

                          <button
                            onClick={handleLogout}
                            className={`w-full px-4 py-3 text-red-600 hover:bg-red-50/80 transition-all flex items-center gap-2 font-bold ${
                              locale === 'ar' ? 'text-right hover:translate-x-1' : 'text-left hover:-translate-x-1'
                            }`}
                          >
                            <span>🚪</span>
                            <span>{t('auth.logout')}</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Quick Search Button */}
              <button
                onClick={() => {
                  setShowSearchModal(true)
                  setSearchMessage(null)
                  setTimeout(() => searchInputRef.current?.focus(), 10)
                }}
                className="w-9 h-9 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-all hover:scale-110 active:scale-95 flex items-center justify-center font-bold flex-shrink-0 border border-white/20 shadow-lg"
                title="بحث سريع (Ctrl+K)"
              >
                <span className="text-base">🔍</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile/Tablet Drawer - ينزلق من اليمين */}
      {showDrawer && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-[100] lg:hidden animate-fadeIn"
            onClick={() => setShowDrawer(false)}
          />

          {/* Drawer */}
          <div className={`fixed top-0 h-full w-72 sm:w-80 bg-white/95 backdrop-blur-lg z-[101] shadow-2xl lg:hidden overflow-y-auto border-orange-600 ${
            locale === 'ar'
              ? 'right-0 animate-slideRight border-l-4'
              : 'left-0 animate-slideLeft border-r-4'
          }`}>
            {/* Header */}
            <div className="bg-orange-700 backdrop-blur-sm text-white p-4 flex items-center justify-between sticky top-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <span className="font-bold text-xl">{t('nav.menu')}</span>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation Links */}
            <div className="p-4 space-y-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setShowDrawer(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:translate-x-2 ${
                    pathname === link.href
                      ? 'bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 font-bold shadow-md border-r-4 border-orange-600'
                      : 'text-gray-700 hover:bg-gray-100/80'
                  }`}
                >
                  <span className="text-2xl drop-shadow">{link.icon}</span>
                  <span className="text-base">{link.label}</span>
                </Link>
              ))}
            </div>

            {/* User Info at Bottom */}
            {user && (
              <div className="p-4 border-t mt-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{user.name}</p>
                      <p className="text-xs text-gray-600">{getRoleLabel(user.role)}</p>
                    </div>
                  </div>

                  {user.role === 'ADMIN' && (
                    <>
                      <Link
                        href="/admin/users"
                        onClick={() => setShowDrawer(false)}
                        className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition mb-2"
                      >
                        <span>👥</span>
                        <span className="text-sm">{t('auth.manageUsers')}</span>
                      </Link>
                      <Link
                        href="/admin/activity-log"
                        onClick={() => setShowDrawer(false)}
                        className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition mb-2"
                      >
                        <span>📋</span>
                        <span className="text-sm">سجل النشاط</span>
                      </Link>
                    </>
                  )}

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-bold"
                  >
                    <span>🚪</span>
                    <span>{t('auth.logout')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Search Dropdown - Compact Version */}
      {showSearchModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998] bg-black/20"
            onClick={() => {
              setShowSearchModal(false)
              setQuickSearchId('')
              setSearchMessage(null)
            }}
          />

          {/* Dropdown Panel */}
          <div
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            className={`fixed top-16 z-[9999] w-96 max-w-[calc(100vw-2rem)] ${
              locale === 'ar' ? 'left-2 sm:left-4' : 'right-2 sm:right-4'
            }`}
          >
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-orange-600/30 overflow-hidden">
              {/* Header */}
              <div className="bg-orange-700 text-white p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔍</span>
                  <h3 className="font-bold text-base">{t('nav.quickSearch')}</h3>
                </div>
                <button
                  onClick={() => {
                    setShowSearchModal(false)
                    setQuickSearchId('')
                    setSearchMessage(null)
                  }}
                  className="hover:bg-white/20 rounded-lg p-1 transition text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Search Input */}
              <div className="p-4">
                <div className="flex gap-2 mb-3">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={quickSearchId}
                    onChange={(e) => setQuickSearchId(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={locale === 'ar' ? '1001 أو 100000022' : '1001 or 100000022'}
                    className="flex-1 px-3 py-2 border-2 border-orange-300 rounded-lg text-lg font-bold text-center focus:border-orange-600 focus:outline-none text-gray-800"
                    disabled={isSearching}
                    autoFocus
                  />
                  <button
                    onClick={handleQuickSearch}
                    disabled={isSearching || !quickSearchId.trim()}
                    className="px-4 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 disabled:bg-gray-400 active:scale-95"
                  >
                    {isSearching ? '⏳' : '🔍'}
                  </button>
                </div>

                {/* Instructions - Compact */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 mb-3">
                  <p className="text-xs text-orange-800">
                    <strong>{t('nav.searchMember')}</strong> {t('nav.searchMemberDesc')} <code className="bg-white px-1 rounded text-xs">1001</code>)
                  </p>
                  <p className="text-xs text-orange-800 mt-1">
                    <strong>{t('nav.staffCheckIn')}</strong> {t('nav.staffCheckInDesc')} <code className="bg-white px-1 rounded text-xs">100000022</code>)
                  </p>
                </div>

                {/* Message Area - Compact */}
                {searchMessage && (
                  <div className={`p-3 rounded-lg border-2 ${
                    searchMessage.type === 'success'
                      ? 'bg-green-50 border-green-400'
                      : searchMessage.type === 'warning'
                      ? 'bg-yellow-50 border-yellow-400'
                      : 'bg-red-50 border-red-400'
                  }`}>
                    <div className="flex items-start gap-2">
                      <div className="text-2xl flex-shrink-0">
                        {searchMessage.type === 'success' ? '✅' : searchMessage.type === 'warning' ? '⚠️' : '🚨'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${
                          searchMessage.type === 'success'
                            ? 'text-green-800'
                            : searchMessage.type === 'warning'
                            ? 'text-yellow-800'
                            : 'text-red-800'
                        }`}>
                          {searchMessage.text}
                        </p>
                        {searchMessage.staff && (
                          <div className="mt-2 bg-white/60 rounded p-2 text-xs">
                            <p><strong>{t('nav.employee')}:</strong> {searchMessage.staff.name}</p>
                            <p><strong>{t('nav.position')}:</strong> {getPositionLabel(searchMessage.staff.position)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Hint */}
                <div className="mt-3 text-center text-xs text-gray-500">
                  <kbd className="px-2 py-0.5 bg-gray-200 rounded text-xs">Enter</kbd> {t('nav.searchHintEnter')} · <kbd className="px-2 py-0.5 bg-gray-200 rounded text-xs">ESC</kbd> {t('nav.searchHintEsc')}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        @keyframes slideRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        @keyframes slideLeft {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .animate-slideRight {
          animation: slideRight 0.2s ease-out;
        }

        .animate-slideLeft {
          animation: slideLeft 0.2s ease-out;
        }
      `}</style>
    </>
  )
}