// lib/activityLog.ts
// نظام سجل النشاط - تتبع كل عملية مع مين عملها ومتى

import { prisma } from './prisma'

export interface LogActionParams {
  userId: string
  action: string        // 'create' | 'update' | 'delete' | 'renew' | 'upgrade' | 'settle' | 'login' إلخ
  resource: string      // 'member' | 'receipt' | 'commission' | 'pt_session' إلخ
  resourceId?: string   // ID للعنصر المتأثر
  details?: string      // JSON string أو نص تفصيلي
}

/**
 * تسجيل عملية في سجل النشاط
 */
export async function logActivity(params: LogActionParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId || null,
        details: params.details || null,
      }
    })
  } catch (error) {
    // لا نوقف العملية الأصلية لو فشل التسجيل
    console.error('⚠️ Activity log error (non-critical):', error)
  }
}

// أسماء العمليات الشائعة
export const ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  RENEW: 'renew',
  UPGRADE: 'upgrade',
  CHECK_IN: 'check_in',
  SETTLE_COMMISSION: 'settle_commission',
  ADD_POINTS: 'add_points',
  REDEEM_POINTS: 'redeem_points',
  FREEZE: 'freeze',
  UNFREEZE: 'unfreeze',
  CHANGE_COACH: 'change_coach',
  LOGIN: 'login',
} as const

// أسماء الموارد
export const RESOURCES = {
  MEMBER: 'member',
  RECEIPT: 'receipt',
  COMMISSION: 'commission',
  PT_SESSION: 'pt_session',
  NUTRITION: 'nutrition',
  PHYSIO: 'physio',
  STAFF: 'staff',
  OFFER: 'offer',
  LOYALTY: 'loyalty',
} as const
