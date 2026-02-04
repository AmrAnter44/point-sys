'use client'

import { useLanguage } from '../contexts/LanguageContext'

interface PaymentMethodSelectorProps {
  value: string
  onChange: (method: string) => void
  required?: boolean
}

export default function PaymentMethodSelector({ value, onChange, required = false }: PaymentMethodSelectorProps) {
  const { t } = useLanguage()

  const paymentMethods = [
    { value: 'cash', icon: '💵', color: 'bg-green-100 border-green-500' },
    { value: 'visa', icon: '💳', color: 'bg-blue-100 border-blue-500' },
    { value: 'instapay', icon: '📱', color: 'bg-purple-100 border-purple-500' },
    { value: 'wallet', icon: '💰', color: 'bg-orange-100 border-orange-500' },
  ]

  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {t('members.paymentMethods.label')} {required && <span className="text-red-600">*</span>}
      </label>
      
      <div className="grid grid-cols-2 gap-3">
        {paymentMethods.map((method) => (
          <button
            key={method.value}
            type="button"
            onClick={() => onChange(method.value)}
            className={`
              flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all
              ${value === method.value 
                ? `${method.color} border-2 shadow-md scale-105` 
                : 'bg-white border-gray-300 hover:border-gray-400'
              }
            `}
          >
            <span className="text-3xl">{method.icon}</span>
            <span className="font-medium text-sm">
              {t(`members.paymentMethods.${method.value}`)} {method.icon}
            </span>
          </button>
        ))}
      </div>
      
      {/* عرض الطريقة المختارة */}
      {value && (
        <div className="mt-3 text-center">
          <p className="text-sm text-gray-600">
            {t('members.paymentMethods.selectedMethod')}
            <span className="font-bold text-blue-600 mr-1">
              {t(`members.paymentMethods.${value}`)} {paymentMethods.find(m => m.value === value)?.icon}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

// دالة للحصول على أيقونة طريقة الدفع
export function getPaymentMethodIcon(method: string): string {
  const icons: { [key: string]: string } = {
    'cash': '💵',
    'visa': '💳',
    'instapay': '📱',
    'wallet': '💰'
  }
  return icons[method] || '💰'
}