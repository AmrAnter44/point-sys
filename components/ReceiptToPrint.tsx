'use client'

import React from 'react'
import { printReceiptFromData } from '../lib/printSystem'
import { useLanguage } from '../contexts/LanguageContext'

interface ReceiptProps {
  receiptNumber: number
  type: string
  amount: number
  details: any
  date: Date
  paymentMethod?: string
  onClose: () => void
}

export function ReceiptToPrint({ receiptNumber, type, amount, details, date, paymentMethod, onClose }: ReceiptProps) {
  const { t, locale } = useLanguage()
  const handlePrint = () => {
    printReceiptFromData(
      receiptNumber,
      type,
      amount,
      details,
      date,
      paymentMethod || details.paymentMethod || 'cash'
    )
  }

  const handleWhatsApp = () => {
    // جلب رقم الهاتف من التفاصيل
    const phone = details.phone || details.memberPhone || details.clientPhone

    if (!phone) {
      alert(t('receipts.whatsapp.noPhone'))
      return
    }

    // تنظيف رقم الهاتف (إزالة المسافات والرموز)
    let cleanPhone = phone.replace(/\s+/g, '').replace(/[^\d]/g, '')

    // إضافة كود مصر إذا لم يكن موجود
    if (!cleanPhone.startsWith('20')) {
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '20' + cleanPhone.substring(1)
      } else {
        cleanPhone = '20' + cleanPhone
      }
    }

    // إنشاء رسالة الواتساب
    const clientName = details.memberName || details.clientName || details.name || (locale === 'ar' ? 'العميل' : 'Client')
    const paymentMethodText = paymentMethod || details.paymentMethod || 'cash'
    const paymentMethodTranslated = t(`receipts.paymentMethods.${paymentMethodText}`)

    const dateFormatted = new Date(date).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')
    const currencyUnit = locale === 'ar' ? 'جنيه' : 'EGP'

    let message = t('receipts.whatsapp.greeting', { clientName }) + '\n\n'
    message += t('receipts.whatsapp.receiptIssued', { receiptNumber: receiptNumber.toString() }) + '\n'
    message += t('receipts.whatsapp.date', { date: dateFormatted }) + '\n'
    message += t('receipts.whatsapp.amount', { amount: amount.toString() }) + '\n'
    message += t('receipts.whatsapp.paymentMethod', { paymentMethod: paymentMethodTranslated }) + '\n'
    message += t('receipts.whatsapp.type', { type }) + '\n\n'
    message += t('receipts.whatsapp.thankYou')

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  // الطباعة التلقائية معطلة - يجب على المستخدم الضغط على زر الطباعة
  // React.useEffect(() => {
  //   const timer = setTimeout(() => {
  //     handlePrint()
  //   }, 300)
  //
  //   return () => clearTimeout(timer)
  // }, [])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 no-print">
      <div className="bg-white rounded-2xl p-6 max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800">{t('receipts.detail.printReceipt')}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl font-light transition"
          >
            ×
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="text-center text-gray-600">
            <div className="text-5xl mb-3">🖨️</div>
            <p className="font-medium">{t('receipts.table.receiptNumber')} <span className="text-blue-600">#{receiptNumber}</span></p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handlePrint}
            className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-medium text-lg shadow-md hover:shadow-lg"
          >
            🖨️ {t('receipts.actions.print')}
          </button>
          <button
            onClick={handleWhatsApp}
            className="w-full bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition font-medium text-lg shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            {locale === 'ar' ? 'إرسال عبر واتساب' : 'Send via WhatsApp'}
          </button>
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition font-medium"
          >
            {t('common.close')}
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          <p>💡 {locale === 'ar' ? 'تأكد من تشغيل الطابعة قبل الطباعة' : 'Make sure the printer is on before printing'}</p>
        </div>
      </div>
    </div>
  )
}