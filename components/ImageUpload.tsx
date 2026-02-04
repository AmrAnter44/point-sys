// components/ImageUpload.tsx
'use client'

import { useState, useRef } from 'react'

interface ImageUploadProps {
  currentImage?: string | null
  onImageChange: (imageUrl: string | null) => void
  disabled?: boolean
}

export default function ImageUpload({ 
  currentImage, 
  onImageChange, 
  disabled = false 
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentImage || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // معاينة مباشرة
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // رفع الصورة
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        onImageChange(data.imageUrl)
      } else {
        alert(data.error || 'فشل رفع الصورة')
        setPreview(currentImage || null)
      }
    } catch (error) {
      console.error('خطأ في رفع الصورة:', error)
      alert('حدث خطأ في رفع الصورة')
      setPreview(currentImage || null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = async () => {
    if (!currentImage) return

    try {
      await fetch(`/api/upload-image?url=${encodeURIComponent(currentImage)}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('خطأ في حذف الصورة:', error)
    }

    setPreview(null)
    onImageChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium mb-2">
        صورة العضو
      </label>

      <div className="flex flex-col items-center gap-4">
        {/* معاينة الصورة */}
        <div className="relative w-48 h-48 rounded-2xl overflow-hidden border-4 border-gray-200 bg-gray-100">
          {preview ? (
            <>
              <img 
                src={preview} 
                alt="صورة العضو" 
                className="w-full h-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700 shadow-lg"
                  title="حذف الصورة"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-sm">لا توجد صورة</p>
            </div>
          )}
        </div>

        {/* زر الرفع */}
        {!disabled && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className={`
                inline-flex items-center gap-2 px-6 py-3 
                bg-blue-600 text-white rounded-lg 
                hover:bg-blue-700 cursor-pointer
                transition-all shadow-md hover:shadow-lg
                font-medium
                ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>جاري الرفع...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{preview ? 'تغيير الصورة' : 'رفع صورة'}</span>
                </>
              )}
            </label>
          </div>
        )}

        <p className="text-xs text-gray-500 text-center">
          JPG, PNG, أو WebP<br />
          الحد الأقصى: 5MB
        </p>
      </div>
    </div>
  )
}