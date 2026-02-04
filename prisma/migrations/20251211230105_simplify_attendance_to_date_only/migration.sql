-- CreateIndex
CREATE UNIQUE INDEX "Attendance_staffId_date_key_temp" ON "Attendance"("staffId", "checkIn");

-- DropIndex
DROP INDEX "Attendance_checkIn_idx";

-- AlterTable: إضافة عمود date
ALTER TABLE "Attendance" ADD COLUMN "date" DATETIME;

-- نقل البيانات: تحويل checkIn إلى date فقط (نستخدم date() function في SQLite)
UPDATE "Attendance" SET "date" = date("checkIn");

-- حذف الأعمدة القديمة
ALTER TABLE "Attendance" DROP COLUMN "checkIn";
ALTER TABLE "Attendance" DROP COLUMN "checkOut";
ALTER TABLE "Attendance" DROP COLUMN "duration";

-- جعل date مطلوب (NOT NULL)
-- في SQLite لا يمكن تعديل عمود مباشرة، لذا نستخدم طريقة إعادة الإنشاء

-- إنشاء جدول مؤقت
CREATE TABLE "Attendance_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- نقل البيانات من الجدول القديم إلى الجديد
INSERT INTO "Attendance_new" ("id", "staffId", "date", "notes", "createdAt")
SELECT "id", "staffId", "date", "notes", "createdAt" FROM "Attendance";

-- حذف الجدول القديم
DROP TABLE "Attendance";

-- إعادة تسمية الجدول الجديد
ALTER TABLE "Attendance_new" RENAME TO "Attendance";

-- إنشاء الـ indexes
CREATE INDEX "Attendance_staffId_idx" ON "Attendance"("staffId");
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");
CREATE UNIQUE INDEX "Attendance_staffId_date_key" ON "Attendance"("staffId", "date");
