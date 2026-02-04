// app/api/sales-commissions/recalculate/route.ts
// Recalculate sales commissions for existing receipts

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import {
  isRenewalReceipt,
  getStaffIdFromReceipt,
  isSalesStaff
} from '../../../../lib/commissions/salesHelpers'
import {
  determineRenewalType,
  calculateSalesRenewalBonus,
  createSalesRenewalCommission
} from '../../../../lib/commissions/salesRenewal'
import { getMonthString } from '../../../../lib/commissions/salesHelpers'

export async function POST(request: Request) {
  try {
    console.log('🔄 بدء إعادة حساب عمولات المبيعات للإيصالات القديمة...')

    // Get all renewal receipts
    const receipts = await prisma.receipt.findMany({
      where: {
        type: {
          in: [
            'تجديد عضويه',
            'تجديد برايفت',
            'تجديد علاج طبيعي',
            'تجديد تغذية',
            'تجديد كلاسات'
          ]
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`📋 تم العثور على ${receipts.length} إيصال تجديد`)

    const results = {
      processed: 0,
      created: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[]
    }

    for (const receipt of receipts) {
      try {
        console.log(`\n📄 معالجة إيصال ${receipt.receiptNumber}...`)

        // Check if commission already exists
        const existingCommission = await prisma.coachCommission.findFirst({
          where: {
            receiptId: receipt.id,
            type: {
              startsWith: 'sales_renewal_'
            }
          }
        })

        if (existingCommission) {
          console.log(`⏭️ العمولة موجودة مسبقاً للإيصال ${receipt.receiptNumber}`)
          results.skipped++
          results.details.push({
            receiptNumber: receipt.receiptNumber,
            status: 'skipped',
            reason: 'Commission already exists'
          })
          continue
        }

        // Check if it's a renewal
        if (!isRenewalReceipt(receipt)) {
          console.log(`⚠️ الإيصال ${receipt.receiptNumber} ليس تجديداً`)
          results.skipped++
          continue
        }

        // Get staff ID
        const staffId = await getStaffIdFromReceipt(receipt)
        if (!staffId) {
          console.log(`⚠️ لم يتم العثور على موظف للإيصال ${receipt.receiptNumber} (staffName: ${receipt.staffName})`)
          results.skipped++
          results.details.push({
            receiptNumber: receipt.receiptNumber,
            status: 'skipped',
            reason: 'Staff not found',
            staffName: receipt.staffName
          })
          continue
        }

        // Verify staff is sales personnel
        const isSales = await isSalesStaff(staffId)
        if (!isSales) {
          console.log(`⚠️ الموظف ليس موظف مبيعات للإيصال ${receipt.receiptNumber}`)
          results.skipped++
          results.details.push({
            receiptNumber: receipt.receiptNumber,
            status: 'skipped',
            reason: 'Staff is not sales personnel',
            staffId
          })
          continue
        }

        // Determine renewal type
        const renewalType = determineRenewalType(receipt)
        if (!renewalType) {
          console.log(`⚠️ لا يمكن تحديد نوع التجديد للإيصال ${receipt.receiptNumber}`)
          results.skipped++
          results.details.push({
            receiptNumber: receipt.receiptNumber,
            status: 'skipped',
            reason: 'Could not determine renewal type'
          })
          continue
        }

        // Calculate bonus
        const bonusAmount = calculateSalesRenewalBonus(renewalType)

        // Create commission
        const commission = await createSalesRenewalCommission({
          staffId,
          renewalType,
          amount: bonusAmount,
          receiptId: receipt.id,
          memberId: receipt.memberId || undefined,
          month: getMonthString(receipt.createdAt)
        })

        console.log(`✅ تم إنشاء عمولة للإيصال ${receipt.receiptNumber}: ${bonusAmount} ج.م`)
        results.created++
        results.details.push({
          receiptNumber: receipt.receiptNumber,
          status: 'created',
          commissionId: commission.id,
          amount: bonusAmount,
          renewalType,
          staffId
        })

      } catch (error: any) {
        console.error(`❌ خطأ في معالجة الإيصال ${receipt.receiptNumber}:`, error)
        results.errors++
        results.details.push({
          receiptNumber: receipt.receiptNumber,
          status: 'error',
          error: error.message
        })
      }

      results.processed++
    }

    console.log('\n✅ اكتملت إعادة الحساب!')
    console.log(`📊 النتائج: معالج ${results.processed}, تم إنشاء ${results.created}, تم تخطي ${results.skipped}, أخطاء ${results.errors}`)

    return NextResponse.json({
      success: true,
      message: 'تم إعادة حساب عمولات المبيعات',
      results
    })

  } catch (error: any) {
    console.error('❌ خطأ في إعادة الحساب:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to recalculate commissions' },
      { status: 500 }
    )
  }
}
