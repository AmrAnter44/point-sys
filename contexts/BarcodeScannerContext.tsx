'use client'

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'

// ✅ Type Definitions
interface BarcodeScannerSettings {
  enabled: boolean
  minBarcodeLength: number
  maxTimeBetweenChars: number
  behavior: 'open-modal' | 'disabled'
  enableSoundFeedback: boolean
  ignoreDuplicateScans: boolean
  duplicateScanTimeout: number
}

interface BarcodeScannerContextType {
  settings: BarcodeScannerSettings
  updateSettings: (s: Partial<BarcodeScannerSettings>) => void
  isScanning: boolean
  lastScannedCode: string | null
  manualTriggerScan: (code: string) => void
}

interface BufferItem {
  char: string
  time: number
}

// ✅ Default Settings
const DEFAULT_SETTINGS: BarcodeScannerSettings = {
  enabled: true,
  minBarcodeLength: 3,
  maxTimeBetweenChars: 50,
  behavior: 'open-modal',
  enableSoundFeedback: true,
  ignoreDuplicateScans: true,
  duplicateScanTimeout: 3
}

const STORAGE_KEY = 'barcodeScannerSettings'

// ✅ Context
const BarcodeScannerContext = createContext<BarcodeScannerContextType | undefined>(undefined)

// ✅ Provider Component
export function BarcodeScannerProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BarcodeScannerSettings>(DEFAULT_SETTINGS)
  const [isScanning, setIsScanning] = useState(false)
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null)

  const bufferRef = useRef<BufferItem[]>([])
  const lastScanRef = useRef<{ code: string; time: number } | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // ✅ Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setSettings({ ...DEFAULT_SETTINGS, ...parsed })
        console.log('📱 Barcode Scanner: Settings loaded from localStorage', parsed)
      }
    } catch (error) {
      console.error('❌ Failed to load barcode scanner settings:', error)
    }
  }, [])

  // ✅ Save settings to localStorage
  const updateSettings = (newSettings: Partial<BarcodeScannerSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        console.log('💾 Barcode Scanner: Settings saved', updated)
      } catch (error) {
        console.error('❌ Failed to save barcode scanner settings:', error)
      }
      return updated
    })
  }

  // ✅ Play beep sound
  const playBeep = () => {
    if (!settings.enableSoundFeedback) return

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = 1000
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.1)

      console.log('🔊 Beep played')
    } catch (error) {
      console.error('❌ Failed to play beep:', error)
    }
  }

  // ✅ Check if should ignore duplicate scan
  const shouldIgnoreDuplicate = (code: string, now: number): boolean => {
    if (!settings.ignoreDuplicateScans) return false

    const lastScan = lastScanRef.current
    if (!lastScan) return false

    const timeDiff = (now - lastScan.time) / 1000 // seconds
    const isDuplicate = lastScan.code === code && timeDiff < settings.duplicateScanTimeout

    if (isDuplicate) {
      console.log(`🚫 Duplicate scan ignored: "${code}" (${timeDiff.toFixed(1)}s ago)`)
    }

    return isDuplicate
  }

  // ✅ Manual trigger for testing or external use
  const manualTriggerScan = (code: string) => {
    if (!settings.enabled) return

    const now = Date.now()
    if (shouldIgnoreDuplicate(code, now)) return

    console.log(`🎯 Manual scan triggered: "${code}"`)
    setLastScannedCode(code)
    lastScanRef.current = { code, time: now }
    playBeep()
  }

  // ✅ Global barcode detection listener
  useEffect(() => {
    if (!settings.enabled) {
      console.log('⏸️ Barcode Scanner: Disabled')
      return
    }

    console.log('🚀 Barcode Scanner: Active', settings)

    const handleKeyDown = (e: KeyboardEvent) => {
      // ✅ Ignore if typing in input/textarea
      const activeElement = document.activeElement
      const tag = activeElement?.tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea') {
        return
      }

      // ✅ Ignore modifier keys
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }

      const now = Date.now()

      // ✅ Enter key = end of barcode
      if (e.key === 'Enter') {
        const buffer = bufferRef.current

        if (buffer.length >= settings.minBarcodeLength) {
          e.preventDefault()
          const code = buffer.map(item => item.char).join('')

          // Check duplicate
          if (shouldIgnoreDuplicate(code, now)) {
            bufferRef.current = []
            setIsScanning(false)
            return
          }

          // ✅ Valid barcode detected
          console.log(`✅ Barcode detected: "${code}" (${buffer.length} chars)`)
          setLastScannedCode(code)
          lastScanRef.current = { code, time: now }
          playBeep()

          bufferRef.current = []
          setIsScanning(false)
        } else {
          // Not enough characters
          bufferRef.current = []
          setIsScanning(false)
        }
        return
      }

      // ✅ Collect single characters
      if (e.key.length === 1) {
        const buffer = bufferRef.current
        const lastItem = buffer[buffer.length - 1]
        const lastTime = lastItem?.time || now

        const timeDiff = now - lastTime

        if (timeDiff <= settings.maxTimeBetweenChars) {
          // Fast typing - likely barcode
          buffer.push({ char: e.key, time: now })
          setIsScanning(true)
        } else {
          // Slow typing - reset buffer
          bufferRef.current = [{ char: e.key, time: now }]
          setIsScanning(false)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      console.log('🛑 Barcode Scanner: Cleanup')
    }
  }, [settings])

  // ✅ Auto-clear buffer after 500ms of inactivity
  useEffect(() => {
    const interval = setInterval(() => {
      const buffer = bufferRef.current
      if (buffer.length > 0) {
        const now = Date.now()
        const lastItem = buffer[buffer.length - 1]
        if (now - lastItem.time > 500) {
          bufferRef.current = []
          setIsScanning(false)
        }
      }
    }, 100)

    return () => clearInterval(interval)
  }, [])

  const value: BarcodeScannerContextType = {
    settings,
    updateSettings,
    isScanning,
    lastScannedCode,
    manualTriggerScan
  }

  return (
    <BarcodeScannerContext.Provider value={value}>
      {children}
    </BarcodeScannerContext.Provider>
  )
}

// ✅ Custom Hook
export function useBarcodeScanner() {
  const context = useContext(BarcodeScannerContext)
  if (!context) {
    throw new Error('useBarcodeScanner must be used within BarcodeScannerProvider')
  }
  return context
}
