// app/api/sales-commissions/calculate/route.ts
// Calculate and create sales renewal bonus for a specific receipt

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import {
  determineRenewalType,
  calculateSalesRenewalBonus,
  createSalesRenewalCommission
} from '../../../../lib/commissions/salesRenewal'
import {
  getStaffIdFromReceipt,
  isSalesStaff,
  isRenewalReceipt,
  getMonthString
} from '../../../../lib/commissions/salesHelpers'

/**
 * POST - Calculate sales bonus for a specific receipt
 * Called automatically after renewal receipt creation
 */
export async function POST(request: Request) {
  try {
    const { receiptId } = await request.json()

    if (!receiptId) {
      return NextResponse.json(
        { error: 'Receipt ID required' },
        { status: 400 }
      )
    }

    // Get receipt with related data
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        member: true
      }
    })

    console.log('💰 معالجة إيصال للعمولة:', {
      receiptId,
      receiptNumber: receipt?.receiptNumber,
      type: receipt?.type,
      staffName: receipt?.staffName,
      amount: receipt?.amount
    })

    if (!receipt) {
      console.error('❌ الإيصال غير موجود:', receiptId)
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      )
    }

    // Check if it's a renewal
    const isRenewal = isRenewalReceipt(receipt)
    console.log('🔍 هل الإيصال تجديد؟', isRenewal, '- النوع:', receipt.type)

    if (!isRenewal) {
      console.warn('⚠️ الإيصال ليس تجديداً')
      return NextResponse.json({
        eligible: false,
        reason: 'Not a renewal receipt'
      })
    }

    // Get staff ID
    console.log('👤 البحث عن معرف الموظف من الإيصال...', { staffName: receipt.staffName })
    const staffId = await getStaffIdFromReceipt(receipt)
    console.log('👤 معرف الموظف المُسترجع:', staffId)

    if (!staffId) {
      console.warn(`⚠️ لم يتم العثور على موظف مبيعات صالح للإيصال ${receiptId}`, {
        staffName: receipt.staffName
      })
      return NextResponse.json({
        eligible: false,
        reason: 'No valid sales staff identified'
      })
    }

    // Verify staff is sales personnel
    console.log('🔍 التحقق من أن الموظف موظف مبيعات:', staffId)
    const isSales = await isSalesStaff(staffId)
    console.log('🔍 هل الموظف موظف مبيعات؟', isSales)

    if (!isSales) {
      console.warn('⚠️ الموظف ليس موظف مبيعات:', staffId)
      return NextResponse.json({
        eligible: false,
        reason: 'Staff is not sales personnel'
      })
    }

    // Determine renewal type
    console.log('📊 تحديد نوع التجديد...')
    const renewalType = determineRenewalType(receipt)
    console.log('📊 نوع التجديد:', renewalType)

    if (!renewalType) {
      console.warn(`⚠️ لا يمكن تحديد نوع التجديد للإيصال ${receiptId}`)
      return NextResponse.json({
        eligible: false,
        reason: 'Could not determine renewal type'
      })
    }

    // Calculate bonus
    const bonusAmount = calculateSalesRenewalBonus(renewalType)
    console.log('💵 مبلغ العمولة المحسوب:', bonusAmount, 'ج.م')

    // Check if bonus already exists
    console.log('🔍 فحص إذا كانت العمولة موجودة مسبقاً...')
    const existingBonus = await prisma.coachCommission.findFirst({
      where: {
        receiptId: receipt.id,
        type: {
          startsWith: 'sales_renewal_'
        }
      }
    })

    if (existingBonus) {
      console.log('⚠️ العمولة موجودة مسبقاً:', {
        id: existingBonus.id,
        type: existingBonus.type,
        amount: existingBonus.amount
      })
      return NextResponse.json({
        eligible: true,
        alreadyProcessed: true,
        commission: existingBonus
      })
    }

    console.log('✅ لا توجد عمولة سابقة، سيتم إنشاء عمولة جديدة')

    // Create commission record
    console.log('💰 إنشاء سجل العمولة...', {
      staffId,
      renewalType,
      amount: bonusAmount,
      receiptId: receipt.id,
      memberId: receipt.memberId,
      month: getMonthString(receipt.createdAt)
    })

    const commission = await createSalesRenewalCommission({
      staffId,
      renewalType,
      amount: bonusAmount,
      receiptId: receipt.id,
      memberId: receipt.memberId || undefined,
      month: getMonthString(receipt.createdAt)
    })

    console.log(`✅ تم إنشاء عمولة مبيعات التجديد: ${bonusAmount} ج.م لنوع ${renewalType}`, {
      commissionId: commission.id,
      staffId,
      receiptNumber: receipt.receiptNumber
    })

    return NextResponse.json({
      eligible: true,
      alreadyProcessed: false,
      commission: {
        id: commission.id,
        type: commission.type,
        amount: commission.amount,
        renewalType,
        staffId,
        receiptId
      }
    })

  } catch (error: any) {
    console.error('❌ Error calculating sales bonus:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to calculate bonus' },
      { status: 500 }
    )
  }
}

/**
 * GET - Check eligibility for a receipt without creating commission
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const receiptId = searchParams.get('receiptId')

    if (!receiptId) {
      return NextResponse.json(
        { error: 'Receipt ID required' },
        { status: 400 }
      )
    }

    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId }
    })

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      )
    }

    const isRenewal = isRenewalReceipt(receipt)
    const staffId = await getStaffIdFromReceipt(receipt)
    const isSales = staffId ? await isSalesStaff(staffId) : false
    const renewalType = isRenewal ? determineRenewalType(receipt) : null
    const bonusAmount = renewalType ? calculateSalesRenewalBonus(renewalType) : 0

    return NextResponse.json({
      eligible: isRenewal && isSales && renewalType !== null,
      isRenewal,
      isSalesStaff: isSales,
      renewalType,
      bonusAmount,
      staffId
    })

  } catch (error: any) {
    console.error('❌ Error checking eligibility:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check eligibility' },
      { status: 500 }
    )
  }
}
