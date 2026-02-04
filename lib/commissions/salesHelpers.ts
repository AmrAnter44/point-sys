// lib/commissions/salesHelpers.ts
// Helper functions for sales commissions

import { prisma } from '../prisma'

/**
 * Check if staff member is sales personnel (position = "ريسبشن")
 */
export async function isSalesStaff(staffId: string): Promise<boolean> {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { name: true, position: true, isActive: true }
  })

  console.log(`🔍 فحص إذا كان موظف مبيعات:`, {
    staffId,
    name: staff?.name,
    position: staff?.position,
    isActive: staff?.isActive,
    isSales: staff?.isActive === true && staff?.position === 'ريسبشن'
  })

  return staff?.isActive === true && staff?.position === 'ريسبشن'
}

/**
 * Get sales staff by name (fallback when staffId not available)
 */
export async function getSalesStaffByName(
  staffName: string
): Promise<{ id: string; name: string; isTopSales?: boolean } | null> {
  console.log('🔍 البحث عن موظف:', {
    staffName: staffName.trim(),
    length: staffName.trim().length,
    chars: Array.from(staffName.trim()).map(c => c.charCodeAt(0))
  })

  // البحث بالاسم أولاً بدون فلترة position
  const allStaff = await prisma.staff.findMany({
    where: {
      isActive: true
    },
    select: { id: true, name: true, position: true, isTopSales: true }
  })

  console.log('📋 جميع الموظفين النشطين:', allStaff.map(s => ({
    id: s.id,
    name: s.name,
    position: s.position,
    isTopSales: s.isTopSales,
    nameLength: s.name.length,
    matches: s.name.trim() === staffName.trim()
  })))

  // البحث بالتطابق التام
  const exactMatch = await prisma.staff.findFirst({
    where: {
      name: staffName.trim(),
      isActive: true
    },
    select: { id: true, name: true, position: true, isTopSales: true }
  })

  if (exactMatch) {
    console.log('✅ تم العثور على موظف بالتطابق التام:', exactMatch)
    return exactMatch
  }

  // البحث بـ contains
  const containsMatch = await prisma.staff.findFirst({
    where: {
      name: {
        contains: staffName.trim()
      },
      isActive: true
    },
    select: { id: true, name: true, position: true, isTopSales: true }
  })

  if (containsMatch) {
    console.log('✅ تم العثور على موظف بـ contains:', containsMatch)
    return containsMatch
  }

  console.log('❌ لم يتم العثور على الموظف بأي طريقة')
  return null
}

/**
 * Get staff ID from receipt (uses staffName to lookup)
 */
export async function getStaffIdFromReceipt(
  receipt: {
    staffName?: string | null
  }
): Promise<string | null> {
  // Use staffName lookup
  if (receipt.staffName) {
    const staff = await getSalesStaffByName(receipt.staffName)
    if (staff) return staff.id
  }

  return null
}

/**
 * Get staff info including isTopSales
 */
export async function getStaffInfo(
  staffId: string
): Promise<{ id: string; name: string; position: string | null; isTopSales: boolean } | null> {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { id: true, name: true, position: true, isTopSales: true, isActive: true }
  })

  if (!staff || !staff.isActive) {
    return null
  }

  return {
    id: staff.id,
    name: staff.name,
    position: staff.position,
    isTopSales: staff.isTopSales
  }
}

/**
 * Check if receipt is a renewal
 */
export function isRenewalReceipt(receipt: {
  type: string
  itemDetails?: string
}): boolean {
  // Check receipt type
  const renewalTypes = [
    'تجديد عضويه',
    'تجديد برايفت',
    'تجديد علاج طبيعي',
    'تجديد تغذية',
    'تجديد كلاسات'
  ]

  if (renewalTypes.includes(receipt.type)) {
    return true
  }

  // Check itemDetails for isRenewal flag
  if (receipt.itemDetails) {
    try {
      const details = JSON.parse(receipt.itemDetails)
      if (details.isRenewal === true) {
        return true
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  return false
}

/**
 * Get month string from date (YYYY-MM format)
 */
export function getMonthString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7)
}
