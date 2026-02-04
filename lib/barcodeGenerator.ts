// lib/barcodeGenerator.ts - نظام توليد Barcode مشترك

import { prisma } from './prisma'
// @ts-ignore
import bwipjs from 'bwip-js'

export type BarcodeModel = 'PT' | 'ClassPackage'

/**
 * توليد barcode عشوائي فريد (16 رقم)
 */
export async function generateUniqueBarcode(model: BarcodeModel): Promise<string> {
  let code: string = ''
  let isUnique = false

  while (!isUnique) {
    // توليد 16 رقم عشوائي
    code = Math.floor(Math.random() * 10000000000000000).toString().padStart(16, '0')

    // التحقق من عدم وجود الكود في قاعدة البيانات
    if (model === 'PT') {
      const existing = await prisma.pT.findUnique({
        where: { qrCode: code }
      })
      if (!existing) {
        isUnique = true
      }
    } else if (model === 'ClassPackage') {
      const existing = await prisma.classPackage.findUnique({
        where: { qrCode: code }
      })
      if (!existing) {
        isUnique = true
      }
    }
  }

  console.log(`🔢 تم توليد Barcode عشوائي (16 رقم) لـ ${model}: ${code}`)
  return code
}

/**
 * تحويل barcode text إلى صورة base64
 */
export async function generateBarcodeImage(barcodeText: string): Promise<string> {
  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: barcodeText,
      scale: 5,
      height: 15,
      includetext: true,
    })

    const base64 = png.toString('base64')
    const imageData = `data:image/png;base64,${base64}`

    console.log('✅ تم توليد Barcode كصورة')
    return imageData
  } catch (error) {
    console.error('❌ فشل توليد صورة Barcode:', error)
    throw new Error('Failed to generate barcode image')
  }
}

/**
 * توليد barcode كامل (text + image) لعضو مشترك
 */
export async function generateMemberBarcode(
  model: BarcodeModel,
  memberExpiryDate: Date | null
): Promise<{ qrCode: string | null; qrCodeImage: string | null }> {
  // التحقق من أن العضوية صالحة
  if (!memberExpiryDate || new Date(memberExpiryDate) <= new Date()) {
    console.log('⚠️ العضوية منتهية أو غير موجودة - لن يتم توليد barcode')
    return { qrCode: null, qrCodeImage: null }
  }

  try {
    const qrCode = await generateUniqueBarcode(model)
    const qrCodeImage = await generateBarcodeImage(qrCode)

    return { qrCode, qrCodeImage }
  } catch (error) {
    console.error('❌ فشل توليد barcode:', error)
    return { qrCode: null, qrCodeImage: null }
  }
}
