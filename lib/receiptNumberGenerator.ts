import { PrismaClient } from '@prisma/client'

/**
 * Generate the next receipt number atomically
 * This function uses upsert with increment to ensure thread-safety
 * and prevent race conditions that could lead to duplicate receipt numbers.
 *
 * @param prisma - Prisma client instance
 * @returns Promise<number> - The next receipt number
 */
export async function getNextReceiptNumber(prisma: PrismaClient): Promise<number> {
  const counter = await prisma.receiptCounter.upsert({
    where: { id: 1 },
    update: { current: { increment: 1 } },
    create: { id: 1, current: 1001 },
  })

  return counter.current
}
