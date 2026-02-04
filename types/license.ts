// types/license.ts
// TypeScript types for remote licensing system

export interface LicenseData {
  enabled: boolean
  message: string
  sig: string
}

export interface LicenseState {
  isValid: boolean
  isLoading: boolean
  message: string
  lastChecked: number | null
  error: string | null
}

export interface LicenseCache {
  data: LicenseData | null
  timestamp: number
  isValid: boolean
}
