'use client'

import { ReactNode } from 'react'
import { AdminDateProvider } from '../contexts/AdminDateContext'
import { LanguageProvider } from '../contexts/LanguageContext'
import { LicenseProvider } from '../contexts/LicenseContext'
import { BarcodeScannerProvider } from '../contexts/BarcodeScannerContext'
import { LicenseBlocker } from './LicenseBlocker'
import Navbar from './Navbar'
import { PreventInputScroll } from '../app/PreventInputScroll'

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <LicenseProvider>
      <LicenseBlocker />
      <LanguageProvider>
        <AdminDateProvider>
          <BarcodeScannerProvider>
            <PreventInputScroll />
            <Navbar />
            <main>{children}</main>
          </BarcodeScannerProvider>
        </AdminDateProvider>
      </LanguageProvider>
    </LicenseProvider>
  )
}
