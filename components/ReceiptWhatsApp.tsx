'use client'

import { useState } from 'react';

interface ReceiptWhatsAppProps {
  receipt: {
    id: string;
    receiptNumber: number;
    type: string;
    amount: number;
    itemDetails: string;
    paymentMethod: string;
    staffName?: string;
    createdAt: string;
    memberId?: string;
    ptNumber?: number;
    dayUseId?: string;
  };
  onDetailsClick?: () => void;
}

export default function ReceiptWhatsApp({ receipt, onDetailsClick }: ReceiptWhatsAppProps) {
  const [showSendModal, setShowSendModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [popup, setPopup] = useState<{ show: boolean; type: 'success' | 'error' | 'warning'; message: string }>({
    show: false,
    type: 'success',
    message: ''
  });

  const details = JSON.parse(receipt.itemDetails);

  const prepareReceiptMessage = (data: any) => {
    const details = data.details;
    const date = new Date(data.date);
    const formattedDate = date.toLocaleDateString('en-US');
    const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Header
    let message = `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*Receipt #${data.receiptNumber}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Receipt Type - Convert all types to English
    const getTypeName = (type: string) => {
      const typeMap: { [key: string]: string } = {
        'Member': 'Membership',
        'PT': 'Personal Training',
        'DayUse': 'Day Use',
        'Expense': 'Expense',
        'Points Redemption': '🎁 Points Redemption',
        'Membership Upgrade': '⬆️ Membership Upgrade',
        'Physiotherapy': '🏥 Physiotherapy',
        'Physiotherapy Renewal': '🔄 Physiotherapy Renewal',
        'Nutrition': '🥗 Nutrition',
        'Nutrition Renewal': '🔄 Nutrition Renewal',
        // Old Arabic types
        'استبدال نقاط': '🎁 Points Redemption',
        'ترقية اشتراك': '⬆️ Membership Upgrade',
        'العلاج الطبيعي': '🏥 Physiotherapy',
        'تجديد علاج طبيعي': '🔄 Physiotherapy Renewal',
        'التغذية': '🥗 Nutrition',
        'تجديد تغذية': '🔄 Nutrition Renewal',
        'عضوية': 'Membership',
        'تجديد عضويه': '🔄 Membership Renewal',
        'اشتراك برايفت': 'Personal Training',
        'تجديد برايفت': '🔄 PT Renewal',
        'يوم استخدام': 'Day Use'
      };
      return typeMap[type] || type;
    };
    const typeName = getTypeName(data.type);
    message += `*Type:* ${typeName}\n\n`;

    // Client/Member Details
    if (details.memberNumber) {
      message += `*Member #:* ${details.memberNumber}\n`;
    }
    if (details.memberName || details.clientName || details.name) {
      message += `*Name:* ${details.memberName || details.clientName || details.name}\n`;
    }
    if (details.phone || details.memberPhone || details.clientPhone) {
      message += `*Phone:* ${details.phone || details.memberPhone || details.clientPhone}\n`;
    }
    message += `\n`;

    // Points Redemption Details
    if (data.type === 'Points Redemption' && details.pointsUsed) {
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `*🎁 Points Redemption Details*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `💎 *Points Used:* ${details.pointsUsed.toLocaleString()} points\n`;
      message += `🎁 *Reward:* ${details.rewardName}\n`;
      if (details.daysAdded) {
        message += `📅 *Days Added:* +${details.daysAdded} days\n`;
      }
      if (details.oldExpiryDate && details.newExpiryDate) {
        const oldDate = new Date(details.oldExpiryDate).toLocaleDateString('en-US');
        const newDate = new Date(details.newExpiryDate).toLocaleDateString('en-US');
        message += `\n*Membership Expiry:*\n`;
        message += `• Before: ${oldDate}\n`;
        message += `• After: ${newDate}\n`;
      }
      message += `\n`;
    }

    // Subscription Details (for Members)
    if (data.type === 'Member' && details.subscriptionDays) {
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `*Subscription Details*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      if (details.startDate) {
        message += `• From: ${new Date(details.startDate).toLocaleDateString('en-US')}\n`;
      }
      if (details.expiryDate) {
        message += `• To: ${new Date(details.expiryDate).toLocaleDateString('en-US')}\n`;
      }
      message += `• Duration: ${details.subscriptionDays} days\n`;

      // Additional Services
      const extras = [];
      if (details.freePTSessions > 0) extras.push(`${details.freePTSessions} PT sessions`);
      if (details.inBodyScans > 0) extras.push(`${details.inBodyScans} InBody`);
      if (details.invitations > 0) extras.push(`${details.invitations} invitations`);
      if (extras.length > 0) {
        message += `*Gifts:* ${extras.join(' + ')}\n`;
      }
      message += `\n`;
    }

    // PT Details
    if (data.type === 'PT') {
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `*Training Details*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      if (details.ptNumber) {
        message += `• PT #: ${details.ptNumber}\n`;
      }
      if (details.sessions) {
        message += `• Sessions: ${details.sessions}\n`;
      }
      if (details.pricePerSession) {
        message += `• Price per session: ${details.pricePerSession} EGP\n`;
      }
      message += `\n`;
    }

    // Financial Details (not shown for Points Redemption receipts)
    if (data.type !== 'Points Redemption') {
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `*Financial Details*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;

      if (details.subscriptionPrice > 0) {
        message += `• Subscription Price: ${details.subscriptionPrice} EGP\n`;
      }
      if (details.totalPrice > 0 && data.type === 'PT') {
        message += `• Total: ${details.totalPrice} EGP\n`;
      }

      message += `*Paid:* ${data.amount} EGP\n`;

      if (details.remainingAmount > 0) {
        message += `*Remaining:* ${details.remainingAmount} EGP\n`;
      }

      // Payment Method
      const paymentName = data.paymentMethod === 'cash' ? 'Cash' : data.paymentMethod === 'visa' ? 'Visa' : data.paymentMethod === 'instapay' ? 'InstaPay' : data.paymentMethod === 'wallet' ? 'Wallet' : data.paymentMethod;
      message += `*Payment Method:* ${paymentName}\n`;
      message += `\n`;
    }

    // Date and Staff
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*Date:* ${formattedDate}\n`;
    message += `*Time:* ${formattedTime}\n`;
    if (details.staffName || data.staffName) {
      message += `*Staff:* ${details.staffName || data.staffName}\n`;
    }
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Thank you note
    message += `Thank you for trusting us\n`;
    message += `We wish you a great experience\n\n`;

    // Terms and Conditions
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*GYM RULES & GUIDELINES*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    message += `*Dress Code & Attire:* Athletic wear is mandatory during all workout sessions. Proper footwear is required at all times. Jeans, street shoes, and non-athletic clothing are strictly prohibited in training areas.\n\n`;

    message += `*Equipment Care:* Please return all weights and equipment to their designated storage areas after use. Handle all machines and free weights with care, particularly during the completion of your sets.\n\n`;

    message += `*Photography Etiquette:* While we welcome your progress photos, please ensure that selfies and filming do not obstruct or include other members without their consent.\n\n`;

    message += `*Professional Guidance:* To ensure safety and efficacy, please refer all questions regarding exercise form or technique to our certified coaching staff.\n\n`;

    message += `*Atmosphere & Noise:* Help us maintain a focused environment. We ask that members refrain from excessive shouting or disruptive noise.\n\n`;

    message += `*Inclusive Environment:* This is a non-judgmental space. We maintain a zero-tolerance policy for harassment or discrimination of any kind.\n\n`;

    message += `*Language & Conduct:* Please use respectful, clean language at all times. Treat all staff members and fellow athletes with mutual respect.\n\n`;

    message += `*Hygiene & Health:* For the health of our community, please use your own towel, sanitize equipment after use, and maintain high standards of personal hygiene.\n\n`;

    message += `*Smoke-Free Premises:* Smoking, including the use of e-cigarettes and vapes, is strictly prohibited inside the facility and in the immediate areas outside the gym entrance.\n\n`;

    message += `*Health & Safety Compliance:* Our facility is designed to serve individuals in good physical health. By using the gym, you affirm you are fit to engage in physical exercise.\n\n`;

    message += `*Guest & Child Policy:* Visitors are the sole responsibility of their host member. Children who are not registered members must remain under the direct supervision of their parents at all times.\n\n`;

    message += `*Right of Revocation:* To maintain the safety and integrity of our community, management reserves the right to cancel memberships or guest privileges at any time if these rules are violated.\n\n`;

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*IMPORTANT NOTES*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `• Subscription is non-refundable except within 24 hours after deducting the session value\n`;
    message += `• Management is not responsible for personal belongings\n`;
    message += `• All members must follow these rules to maintain a safe and respectful environment\n\n`;

    return message;
  };

  const showPopup = (type: 'success' | 'error' | 'warning', message: string) => {
    setPopup({ show: true, type, message });
    setTimeout(() => {
      setPopup({ show: false, type: 'success', message: '' });
    }, 3000);
  };

  const handleSendWhatsApp = () => {
    if (!phone || phone.trim().length < 10) {
      showPopup('warning', 'Please enter a valid phone number');
      return;
    }

    setSending(true);

    const receiptMessage = prepareReceiptMessage({
      receiptNumber: receipt.receiptNumber,
      type: receipt.type,
      amount: receipt.amount,
      memberName: details.memberName || details.clientName || details.name,
      memberNumber: details.memberNumber,
      date: receipt.createdAt,
      paymentMethod: receipt.paymentMethod,
      details: details,
    });

    try {
      // Clean phone number from non-numeric characters
      const cleanPhone = phone.replace(/\D/g, '');
      // Open WhatsApp directly
      const url = `https://wa.me/2${cleanPhone}?text=${encodeURIComponent(receiptMessage)}`;
      window.open(url, '_blank');

      showPopup('success', 'WhatsApp will open now');
      setShowSendModal(false);
      setPhone('');
    } catch (err) {
      console.error(err);
      showPopup('error', 'Error sending receipt');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {onDetailsClick && (
          <button
            onClick={onDetailsClick}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1"
          >
            👁️
          </button>
        )}

        {/* WhatsApp button is always shown - if there's a saved number it will be auto-filled, otherwise it will be requested manually */}
        <button
          onClick={() => {
            const phoneNumber = details.phone || details.memberPhone || details.clientPhone;
            if (phoneNumber) {
              setPhone(phoneNumber);
            }
            setShowSendModal(true);
          }}
          className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700 flex items-center gap-1"
          title={details.phone || details.memberPhone || details.clientPhone ? 'Send via WhatsApp' : 'Send via WhatsApp (Enter number manually)'}
        >
          📲
        </button>
      </div>

      {showSendModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSendModal(false);
              setPhone('');
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">📱</span>
                <div>
                  <h3 className="text-2xl font-bold">Send Receipt Details</h3>
                  <p className="text-sm text-gray-500">Receipt #{receipt.receiptNumber}</p>
                </div>
              </div>
              <button onClick={() => { setShowSendModal(false); setPhone(''); }} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">×</button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">📞 Phone Number *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-lg"
                dir="ltr"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSendWhatsApp}
                disabled={sending || !phone || phone.trim().length < 10}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {sending ? <>⏳ Sending...</> : <>📲 Send via WhatsApp</>}
              </button>

              <button
                onClick={() => { setShowSendModal(false); setPhone(''); }}
                disabled={sending}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup للرسائل */}
      {popup.show && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 10000 }}>
          <div
            className={`
              rounded-2xl shadow-2xl p-6 max-w-sm mx-4 transform transition-all duration-300
              ${popup.type === 'success' ? 'bg-gradient-to-br from-green-500 to-green-600' : ''}
              ${popup.type === 'error' ? 'bg-gradient-to-br from-red-500 to-red-600' : ''}
              ${popup.type === 'warning' ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' : ''}
            `}
          >
            <div className="flex items-center gap-4 text-white">
              <div className="text-5xl">
                {popup.type === 'success' && '✅'}
                {popup.type === 'error' && '❌'}
                {popup.type === 'warning' && '⚠️'}
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold">{popup.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
