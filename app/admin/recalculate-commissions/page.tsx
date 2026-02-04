'use client'

import { useState } from 'react'

export default function RecalculateCommissionsPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleRecalculate = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/sales-commissions/recalculate', {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data.results)
      } else {
        setError(data.error || 'فشلت العملية')
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">إعادة حساب عمولات المبيعات</h1>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          هذه الصفحة ستقوم بفحص جميع إيصالات التجديد وإنشاء العمولات المفقودة للموظفين.
        </p>
      </div>

      <button
        onClick={handleRecalculate}
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'جاري المعالجة...' : 'إعادة حساب العمولات'}
      </button>

      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-bold">خطأ:</p>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h2 className="font-bold text-green-800 mb-2">✅ اكتملت المعالجة!</h2>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">معالج</p>
                <p className="text-2xl font-bold text-gray-800">{result.processed}</p>
              </div>
              <div>
                <p className="text-gray-600">تم إنشاؤها</p>
                <p className="text-2xl font-bold text-green-600">{result.created}</p>
              </div>
              <div>
                <p className="text-gray-600">تم تخطيها</p>
                <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
              </div>
              <div>
                <p className="text-gray-600">أخطاء</p>
                <p className="text-2xl font-bold text-red-600">{result.errors}</p>
              </div>
            </div>
          </div>

          {result.details && result.details.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-bold mb-3">التفاصيل:</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {result.details.map((detail: any, index: number) => (
                  <div
                    key={index}
                    className={`p-3 rounded border ${
                      detail.status === 'created'
                        ? 'bg-green-50 border-green-200'
                        : detail.status === 'error'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold">إيصال #{detail.receiptNumber}</p>
                        {detail.status === 'created' && (
                          <p className="text-sm text-green-700">
                            تم إنشاء عمولة: {detail.amount} ج.م ({detail.renewalType})
                          </p>
                        )}
                        {detail.status === 'skipped' && (
                          <p className="text-sm text-gray-600">
                            تم التخطي: {detail.reason}
                            {detail.staffName && ` - ${detail.staffName}`}
                          </p>
                        )}
                        {detail.status === 'error' && (
                          <p className="text-sm text-red-700">خطأ: {detail.error}</p>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          detail.status === 'created'
                            ? 'bg-green-200 text-green-800'
                            : detail.status === 'error'
                            ? 'bg-red-200 text-red-800'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {detail.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
