'use client'

// TODO: File upload component using signed URLs
// TODO: Generate signed URL from API
// TODO: Upload directly to Cloud Storage
// TODO: Confirm upload completion
// TODO: Show upload progress
// TODO: Support image and PDF previews

import { useState, useRef } from 'react'

interface FileUploadSignedProps {
  consultationId?: string
  appointmentId?: string
  category?: string
  onUploadComplete?: (file: any) => void
  onError?: (error: string) => void
}

export function FileUploadSigned({
  consultationId,
  appointmentId,
  category,
  onUploadComplete,
  onError,
}: FileUploadSignedProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]

    if (!allowedTypes.includes(file.type)) {
      onError?.('File type not allowed. Only images and PDFs are supported.')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      onError?.('File size must be less than 10MB')
      return
    }

    setUploading(true)
    setProgress(0)

    try {
      // Step 1: Get signed upload URL
      const urlResponse = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          category: category || 'General',
          consultationId,
          appointmentId,
        }),
      })

      if (!urlResponse.ok) {
        const error = await urlResponse.json()
        throw new Error(error.error || 'Failed to get upload URL')
      }

      const { uploadUrl, fileId, filePath } = await urlResponse.json()

      // Step 2: Upload file directly to Cloud Storage
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage')
      }

      setProgress(100)

      // Step 3: Confirm upload completion
      const confirmResponse = await fetch('/api/files/upload-url', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ fileId }),
      })

      if (!confirmResponse.ok) {
        throw new Error('Failed to confirm upload')
      }

      const fileRecord = await confirmResponse.json()
      onUploadComplete?.(fileRecord)
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      onError?.(error.message || 'Failed to upload file')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx"
          onChange={handleFileSelect}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
      </label>

      {uploading && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">Uploading... {progress}%</p>
        </div>
      )}
    </div>
  )
}

