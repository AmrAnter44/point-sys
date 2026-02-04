// contexts/LicenseContext.tsx
// Global license state management with automatic checking

'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { LicenseState } from '../types/license'
import { getCachedLicense, setCachedLicense } from '../lib/license'

interface LicenseContextType {
  licenseState: LicenseState
  recheckLicense: () => Promise<void>
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined)

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [licenseState, setLicenseState] = useState<LicenseState>({
    isValid: true, // افتراضياً true حتى يتم التحقق
    isLoading: true,
    message: '',
    lastChecked: null,
    error: null
  })

  // دالة التحقق من الترخيص
  const checkLicense = async () => {
    try {
      console.log('🚀 License check initiated from client-side')
      setLicenseState(prev => ({ ...prev, isLoading: true, error: null }))

      const response = await fetch('/api/license/check', {
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error('License check failed')
      }

      const data = await response.json()
      console.log('📨 License check response:', data)

      setLicenseState({
        isValid: data.isValid,
        isLoading: false,
        message: data.message,
        lastChecked: Date.now(),
        error: null
      })

      if (data.isValid) {
        console.log('✅ License is VALID - Application accessible')
      } else {
        console.log('🔒 License is INVALID - Application locked')
        console.log('   Reason:', data.message)
      }

      // حفظ في الـ cache
      if (data.isValid) {
        setCachedLicense(
          { enabled: true, message: data.message, sig: '' },
          true
        )
        console.log('💾 Valid license cached')
      }
    } catch (error: any) {
      console.error('❌ License check error:', error)

      // محاولة استخدام الـ cache
      const cached = getCachedLicense()

      if (cached && cached.isValid) {
        console.log('📦 Using cached license (network error)')
        // استخدام آخر حالة صحيحة
        setLicenseState({
          isValid: true,
          isLoading: false,
          message: cached.data?.message || 'Using cached license',
          lastChecked: cached.timestamp,
          error: 'Using cached data due to network error'
        })
      } else {
        console.log('❌ No valid cache available - Application locked')
        // لا يوجد cache صالح
        setLicenseState({
          isValid: false,
          isLoading: false,
          message: 'Unable to verify license',
          lastChecked: Date.now(),
          error: error.message
        })
      }
    }
  }

  // التحقق الأولي عند التحميل
  useEffect(() => {
    console.log('🔧 License system initialized - Performing initial check')
    checkLicense()
  }, [])

  // التحقق التلقائي كل 6 ساعات
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('⏰ Automatic license check (6-hour interval)')
      checkLicense()
    }, 6 * 60 * 60 * 1000) // 6 ساعات

    console.log('⏲️ License auto-check scheduled every 6 hours')
    return () => clearInterval(interval)
  }, [])

  return (
    <LicenseContext.Provider value={{ licenseState, recheckLicense: checkLicense }}>
      {children}
    </LicenseContext.Provider>
  )
}

export function useLicense() {
  const context = useContext(LicenseContext)
  if (!context) {
    throw new Error('useLicense must be used within LicenseProvider')
  }
  return context
}
