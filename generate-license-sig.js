#!/usr/bin/env node
// أداة لتوليد توقيع الترخيص

const crypto = require('crypto');

// دالة لحساب التوقيع
function generateSignature(secretKey, enabled = true) {
  const signature = crypto
    .createHash('sha1')
    .update(secretKey + enabled.toString())
    .digest('hex');

  return signature;
}

// التوقيع الموجود في GitHub
const targetSignature = 'c78d317d35241b1dae62099a4f69b046d64e1aec';

console.log('🔐 أداة توليد توقيع الترخيص\n');
console.log('التوقيع المطلوب (من GitHub):', targetSignature);
console.log('\n');

// تجربة بعض المفاتيح الشائعة
const commonKeys = [
  'Point',
  'point',
  'POINT',
  'PointGym',
  'pointgym',
  'Point-Gym',
  'point-gym',
  'Point_Gym',
  'point_gym',
  'PointSystem',
  'point-system',
  'gym-system',
  'GymSystem',
  'AmrAnter44',
  'amranter44',
  'systems-lock',
  'systemslock',
  'PointGym2024',
  'PointGym2025',
  'PointGym2026',
  'point2024',
  'point2025',
  'point2026',
  'secret',
  'Secret',
  'SECRET',
  'admin',
  'Admin',
  'ADMIN',
  'license-key',
  'licensekey',
  'LicenseKey',
  'key',
  'Key',
  'KEY',
  'password',
  'Password',
  'PASSWORD',
  '123456',
  'test',
  'Test',
  'TEST',
  'Point123',
  'point123',
  'Gym123',
  'gym123',
  '',
  'null',
  'undefined'
];

console.log('🔍 تجربة المفاتيح الشائعة...\n');

let found = false;
for (const key of commonKeys) {
  const sig = generateSignature(key);
  if (sig === targetSignature) {
    console.log('✅ تم العثور على المفتاح الصحيح!');
    console.log('   المفتاح:', key);
    console.log('   التوقيع:', sig);
    console.log('\nقم بتحديث ملف .env:');
    console.log(`LICENSE_SECRET_KEY="${key}"`);
    found = true;
    break;
  }
}

if (!found) {
  console.log('❌ لم يتم العثور على المفتاح في القائمة الشائعة.\n');
  console.log('💡 لتوليد توقيع جديد، استخدم الأمر التالي:\n');
  console.log('   node generate-license-sig.js <your-secret-key>\n');

  // إذا تم تمرير مفتاح كمعامل
  if (process.argv[2]) {
    const customKey = process.argv[2];
    const customSig = generateSignature(customKey);
    console.log('\n📝 توقيع المفتاح الذي أدخلته:');
    console.log('   المفتاح:', customKey);
    console.log('   التوقيع:', customSig);
    console.log('\nقم بتحديث ملف Point.json على GitHub:');
    console.log(JSON.stringify({
      enabled: true,
      sig: customSig
    }, null, 2));
  }
}
