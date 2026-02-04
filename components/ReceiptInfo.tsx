'use client'

interface ReceiptInfoProps {
  receiptNumber: number
  memberNumber?: number
  amount: number
}

export function ReceiptInfo({ receiptNumber, memberNumber, amount }: ReceiptInfoProps) {
  return (
    <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-6 shadow-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Receipt Number */}
        <div className="text-center">
          <div className="bg-white rounded-lg p-4 shadow-md">
            <div className="text-green-600 text-4xl mb-2">🧾</div>
            <div className="text-sm text-gray-600 mb-1">Receipt Number</div>
            <div className="text-3xl font-bold text-green-600">
              #{receiptNumber}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Independent of membership number
            </div>
          </div>
        </div>

        {/* Member Number */}
        {memberNumber && (
          <div className="text-center">
            <div className="bg-white rounded-lg p-4 shadow-md">
              <div className="text-blue-600 text-4xl mb-2">👤</div>
              <div className="text-sm text-gray-600 mb-1">Member Number</div>
              <div className="text-3xl font-bold text-blue-600">
                #{memberNumber}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Member specific
              </div>
            </div>
          </div>
        )}

        {/* Amount */}
        <div className="text-center">
          <div className="bg-white rounded-lg p-4 shadow-md">
            <div className="text-purple-600 text-4xl mb-2">💰</div>
            <div className="text-sm text-gray-600 mb-1">Amount Paid</div>
            <div className="text-3xl font-bold text-purple-600">
              {amount} EGP
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Total Paid
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-lg p-4 border-l-4 border-blue-500">
        <div className="flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div className="flex-1">
            <h4 className="font-bold text-gray-800 mb-1">Numbering System</h4>
            <p className="text-sm text-gray-600">
              <strong>Receipt number</strong> is automatically generated sequentially (1000, 1001, 1002...)
              and is <strong>completely independent</strong> of membership number. You can change the starting number from settings ⚙️
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}