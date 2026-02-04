import './globals.css'
import type { Metadata } from 'next'
import ClientLayout from '../components/ClientLayout'

export const metadata: Metadata = {
  title: 'نظام إدارة الصالة الرياضية - X GYM',
  description: 'نظام شامل لإدارة صالات الرياضة مع البحث السريع',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html>
      <head>
        <link rel="icon" href="/icon.png" />
      </head>
      <body className="bg-gray-50 min-h-screen">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}