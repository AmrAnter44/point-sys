// lib/license.ts
// License validation utilities for remote licensing system

import crypto from 'crypto'
import { LicenseData, LicenseCache } from '../types/license'

/**
 * التحقق من صحة التوقيع
 * Verify signature using SHA1(SECRET_KEY + enabled)
 */
export function verifySignature(enabled: boolean, signature: string): boolean {
  const secretKey = process.env.LICENSE_SECRET_KEY || ''
  const expectedSig = crypto
    .createHash('sha1')
    .update(secretKey + enabled.toString())
    .digest('hex')

  console.log('🔐 License Signature Verification:')
  console.log('  • enabled:', enabled)
  console.log('  • Expected signature:', expectedSig)
  console.log('  • Received signature:', signature)
  console.log('  • Match:', expectedSig === signature)

  return expectedSig === signature
}

/**
 * جلب بيانات الترخيص من GitHub
 * Fetch license data from GitHub raw JSON
 */
export async function fetchLicenseData(): Promise<LicenseData | null> {
  try {
    const url = process.env.LICENSE_CHECK_URL
    console.log('📡 Fetching license from:', url)

    if (!url) throw new Error('LICENSE_CHECK_URL not configured')

    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    })

    console.log('📥 Response status:', response.status, response.statusText)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    console.log('📦 License data received:', data)
    return data
  } catch (error) {
    console.error('❌ License fetch error:', error)
    return null
  }
}

/**
 * التحقق الكامل من الترخيص
 * Complete license validation
 */
export async function validateLicense(): Promise<{
  isValid: boolean
  message: string
  data: LicenseData | null
}> {
  console.log('🔍 Starting license validation...')
  const data = await fetchLicenseData()

  if (!data) {
    console.log('❌ No license data received')
    return {
      isValid: false,
      message: 'Unable to verify license. Please check your internet connection.',
      data: null
    }
  }

  // التحقق من التوقيع
  const sigValid = verifySignature(data.enabled, data.sig)

  if (!sigValid) {
    console.log('❌ License signature validation FAILED')
    return {
      isValid: false,
      message: 'License signature is invalid. Please contact support.',
      data: null
    }
  }

  console.log('✅ Signature validation passed')

  // التحقق من enabled
  if (!data.enabled) {
    console.log('🔒 License is DISABLED (enabled=false)')
    return {
      isValid: false,
      message: data.message || 'License has been deactivated.',
      data: data
    }
  }

  console.log('✅ License validation successful - System UNLOCKED')
  return {
    isValid: true,
    message: data.message || 'License is valid.',
    data: data
  }
}

/**
 * إدارة الـ cache
 * Cache management functions
 */
const CACHE_KEY = 'license_cache'

export function getCachedLicense(): LicenseCache | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    return JSON.parse(cached)
  } catch {
    return null
  }
}

export function setCachedLicense(data: LicenseData, isValid: boolean): void {
  if (typeof window === 'undefined') return

  const cache: LicenseCache = {
    data,
    timestamp: Date.now(),
    isValid
  }

  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}

export function clearCachedLicense(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CACHE_KEY)
}
