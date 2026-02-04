// Unified print system - with staff name

interface ReceiptData {
  receiptNumber: number
  type: string
  amount: number
  details: any
  date: Date
}

// Function to convert receipt type to English
function getTypeLabel(type: string): string {
  const types: { [key: string]: string } = {
    'Member': 'Membership',
    'PT': 'Personal Training',
    'DayUse': 'Day Use',
    'InBody': 'InBody Scan'
  }
  return types[type] || type
}

// Function to format date: year-month-day
function formatDateYMD(dateString: string | Date): string {
  if (!dateString) return '-'
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Function to get payment method label in English
function getPaymentMethodLabel(method: string): string {
  const methods: { [key: string]: string } = {
    'cash': 'Cash 💵',
    'visa': 'Visa 💳',
    'instapay': 'InstaPay 📱',
    'wallet': 'E-Wallet 💰'
  }
  return methods[method] || 'Cash 💵'
}

// Function to generate unified receipt HTML
function generateReceiptHTML(data: ReceiptData): string {
  const { receiptNumber, type, amount, details, date } = data

  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  // Check if renewal receipt
  const isRenewal = type.includes('تجديد') || details.isRenewal === true

  // Payment method
  const paymentMethod = details.paymentMethod || 'cash'
  const paymentMethodLabel = getPaymentMethodLabel(paymentMethod)

  // Staff name
  const staffName = details.staffName || ''

  return `
<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=80mm">
  <title>Receipt ${receiptNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: 80mm auto;
      margin: 0;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      width: 80mm;
      padding: 8mm;
      background: white;
      color: #000;
      font-size: 13px;
      line-height: 1.4;
    }
    
    .header {
      text-align: center;
      border-bottom: 2px dashed #000;
      padding-bottom: 12px;
      margin-bottom: 15px;
    }
    
    .header h1 {
      font-size: 22px;
      font-weight: bold;
      margin-bottom: 6px;
    }
    
    .header p {
      font-size: 12px;
      margin: 3px 0;
      color: #333;
    }
    
    .type-badge {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: bold;
      display: inline-block;
      margin: 8px 0;
      color: white;
    }
    
    .type-badge.renewal {
      background: #10b981;
    }
    
    .type-badge.new {
      background: #3b82f6;
    }
    
    .payment-method-badge {
      background: #6366f1;
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: bold;
      display: inline-block;
      margin: 8px 0;
    }
    
    .staff-badge {
      background: #f59e0b;
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: bold;
      display: inline-block;
      margin: 8px 0;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 6px 0;
      font-size: 13px;
    }
    
    .info-row strong {
      font-weight: 600;
    }
    
    .details {
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      padding: 12px 0;
      margin: 12px 0;
    }
    
    .details h3 {
      font-size: 15px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .detail-item {
      margin: 6px 0;
      font-size: 13px;
    }
    
    .detail-item strong {
      font-weight: 600;
      margin-left: 5px;
    }
    
    .member-number {
      font-size: 19px;
      font-weight: bold;
      color: #2563eb;
      text-align: center;
      margin: 12px 0;
      padding: 10px;
      background: #eff6ff;
      border-radius: 6px;
      border: 2px solid #2563eb;
    }
    
    .date-box {
      background: #f0f9ff;
      border: 2px solid #3b82f6;
      border-radius: 8px;
      padding: 10px;
      margin: 10px 0;
      font-family: 'Courier New', monospace;
    }
    
    .date-box p {
      margin: 4px 0;
      font-size: 12px;
    }
    
    .date-value {
      font-weight: bold;
      color: #1e40af;
    }
    
    .renewal-info {
      background: #d1fae5;
      border: 2px solid #10b981;
      border-radius: 8px;
      padding: 10px;
      margin: 10px 0;
    }
    
    .renewal-info p {
      margin: 4px 0;
      font-size: 12px;
    }
    
    .total {
      display: flex;
      justify-content: space-between;
      font-size: 17px;
      font-weight: bold;
      margin: 15px 0;
      padding: 12px 0;
      border-top: 3px solid #000;
    }
    
    .footer {
      text-align: center;
      margin-top: 15px;
      font-size: 12px;
      color: #555;
      border-top: 2px dashed #000;
      padding-top: 12px;
    }
    
    .footer p {
      margin: 4px 0;
    }
    
    .remaining {
      color: #dc2626;
      font-weight: bold;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <img src='icon.png' alt="logo" style="width: 24px; height: 24px; display: inline-block;"/>
       <img src='qr.png' alt="logo" style="width: 24px; height: 24px; display: inline-block;"/>

    </div>


    ${isRenewal
      ? '<div class="type-badge renewal">🔄 Renewal</div>'
      : '<div class="type-badge new">✨ New Subscription</div>'
    }

    <div class="payment-method-badge">${paymentMethodLabel}</div>

    ${staffName ? `<div class="staff-badge">👷 ${staffName}</div>` : ''}
  </div>

  <div class="info-row">
    <strong>Receipt Number:</strong>
    <span>#${receiptNumber}</span>
  </div>
  <div class="info-row">
    <strong>Date:</strong>
    <span>${formattedDate}</span>
  </div>

  <div class="details">
    <h3>Transaction Details:</h3>
    
    ${details.memberNumber ? `
      <div class="member-number">
        Member #: ${details.memberNumber}
      </div>
    ` : ''}

    ${details.ptNumber ? `
      <div class="member-number">
        PT #: ${details.ptNumber}
      </div>
    ` : ''}

    ${details.memberName ? `
      <div class="detail-item">
        <strong>Name:</strong> ${details.memberName}
      </div>
    ` : ''}

    ${details.clientName ? `
      <div class="detail-item">
        <strong>Client:</strong> ${details.clientName}
      </div>
    ` : ''}

    ${details.name ? `
      <div class="detail-item">
        <strong>Name:</strong> ${details.name}
      </div>
    ` : ''}

    ${type === 'Points Redemption' && details.pointsUsed ? `
      <div style="margin: 15px 0; padding: 12px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 8px;">
          <strong style="color: white; font-size: 15px;">🎁 Points Redemption Details</strong>
        </div>

        <div style="background: white; padding: 10px; border-radius: 6px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-weight: bold;">Points Used:</span>
            <span style="color: #f59e0b; font-size: 16px; font-weight: bold;">
              ${details.pointsUsed?.toLocaleString()} points
            </span>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-weight: bold;">Reward:</span>
            <span style="color: #059669; font-size: 14px; font-weight: bold;">
              ${details.rewardName}
            </span>
          </div>

          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: bold;">Days Added:</span>
            <span style="color: #3b82f6; font-weight: bold;">
              +${details.daysAdded} days
            </span>
          </div>
        </div>

        ${details.oldExpiryDate && details.newExpiryDate ? `
          <div style="background: white; padding: 10px; border-radius: 6px;">
            <div style="text-align: center; margin-bottom: 6px; font-weight: bold; color: #6b7280;">
              Membership Expiry Date
            </div>
            <div style="display: flex; justify-content: space-around; align-items: center;">
              <div style="text-align: center;">
                <div style="font-size: 10px; color: #9ca3af; margin-bottom: 3px;">Before</div>
                <div style="font-weight: bold; color: #ef4444;">
                  ${formatDateYMD(details.oldExpiryDate)}
                </div>
              </div>
              <div style="font-size: 20px; color: #10b981;">→</div>
              <div style="text-align: center;">
                <div style="font-size: 10px; color: #9ca3af; margin-bottom: 3px;">After</div>
                <div style="font-weight: bold; color: #10b981;">
                  ${formatDateYMD(details.newExpiryDate)}
                </div>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    ` : ''}

    ${details.startDate || details.expiryDate ? `
      <div class="date-box">
        <p><strong>📅 Subscription Period:</strong></p>
        ${details.startDate ? `<p>From: <span class="date-value">${formatDateYMD(details.startDate)}</span></p>` : ''}
        ${details.expiryDate ? `<p>To: <span class="date-value">${formatDateYMD(details.expiryDate)}</span></p>` : ''}
        ${details.subscriptionDays ? `<p>Duration: <span class="date-value">${details.subscriptionDays} days</span></p>` : ''}
      </div>
    ` : ''}

    ${isRenewal && (details.newStartDate || details.newExpiryDate) ? `
      <div class="renewal-info">
        <p><strong>🔄 Renewal Information:</strong></p>
        ${details.newStartDate ? `<p>• From: ${formatDateYMD(details.newStartDate)}</p>` : ''}
        ${details.newExpiryDate ? `<p>• To: ${formatDateYMD(details.newExpiryDate)}</p>` : ''}
        ${details.subscriptionDays ? `<p>• Duration: ${details.subscriptionDays} days</p>` : ''}
      </div>
    ` : ''}

    ${isRenewal && (details.oldSessionsRemaining !== undefined || details.newSessionsRemaining !== undefined) ? `
      <div class="renewal-info">
        <p><strong>🔄 Renewal Details:</strong></p>
        ${details.oldSessionsRemaining !== undefined ? `<p>• Sessions before renewal: ${details.oldSessionsRemaining}</p>` : ''}
        ${details.newSessionsRemaining !== undefined ? `<p>• Sessions after renewal: ${details.newSessionsRemaining}</p>` : ''}
      </div>
    ` : ''}
    
    ${details.subscriptionPrice ? `
      <div class="detail-item">
        <strong>Subscription Price:</strong> ${details.subscriptionPrice} EGP
      </div>
    ` : ''}

    ${details.sessionsPurchased ? `
      <div class="detail-item">
        <strong>Sessions Count:</strong> ${details.sessionsPurchased}
      </div>
      ${details.pricePerSession ? `
        <div class="detail-item">
        </div>
      ` : ''}
    ` : ''}

    ${details.coachName ? `
      <div class="detail-item">
        <strong>Coach:</strong> ${details.coachName}
      </div>
    ` : ''}

    ${details.staffName ? `
      <div>
        <strong>Registered by:</strong> ${details.staffName}
      </div>
    ` : ''}

    ${details.serviceType ? `
      <div class="detail-item">
        <strong>Service Type:</strong> ${details.serviceType === 'DayUse' ? 'Day Use' : 'InBody'}
      </div>
    ` : ''}

    ${details.paidAmount !== undefined ? `
      <div class="detail-item">
        <strong>Amount Paid:</strong> ${details.paidAmount} EGP
      </div>
    ` : ''}

    ${details.remainingAmount && details.remainingAmount > 0 ? `
      <div class="detail-item remaining">
        <strong>Remaining:</strong> ${details.remainingAmount} EGP
      </div>
    ` : ''}
  </div>

  <div class="total">
    <span>Total:</span>
    <span>${amount} EGP</span>
  </div>

  <div class="footer">
    ${isRenewal
      ? '<p style="color: #10b981; font-weight: bold;">Subscription Renewed Successfully 🎉</p>'
      : '<p style="color: #3b82f6; font-weight: bold;">Welcome 🎉</p>'
    }
    <p style="font-size: 10px; margin-top: 8px;">
      Refund period: 24 hours
    </p>
  </div>
</body>
</html>
  `
}

// Main print function
export function printReceipt(data: ReceiptData): void {
  const receiptHTML = generateReceiptHTML(data)

  const printWindow = window.open('', '_blank', 'width=302,height=600,scrollbars=no')

  if (!printWindow) {
    alert('Please allow pop-ups to print the receipt')
    return
  }

  printWindow.document.open()
  printWindow.document.write(receiptHTML)
  printWindow.document.close()

  printWindow.onload = function() {
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()

      printWindow.onafterprint = function() {
        printWindow.close()
      }

      setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.close()
        }
      }, 1000)
    }, 500)
  }
}

// Helper function for direct printing
export function printReceiptFromData(
  receiptNumber: number,
  type: string,
  amount: number,
  details: any,
  date: Date | string,
  paymentMethod?: string
): void {
  const dateObj = date instanceof Date ? date : new Date(date)

  // Add paymentMethod to details if passed
  const enrichedDetails = paymentMethod
    ? { ...details, paymentMethod }
    : details

  printReceipt({
    receiptNumber,
    type,
    amount,
    details: enrichedDetails,
    date: dateObj
  })
}