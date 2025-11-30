'use client'

// TODO: Files page
// TODO: List uploaded files
// TODO: Upload new files
// TODO: Download files
// TODO: View file categories

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface FileRecord {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  category?: string
  uploadedAt: string
  storageUrl: string
}

export default function FilesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)

  useEffect(() => {
    if (!loading && (!user || user.role !== 'patient')) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch('/api/files', {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch files')
        }

        const data = await response.json()
        setFiles(data)
      } catch (error) {
        console.error('Error fetching files:', error)
      } finally {
        setLoadingFiles(false)
      }
    }

    if (user) {
      fetchFiles()
    }
  }, [user])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      alert('File type not allowed. Only images and PDFs are supported.')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }

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
          category: 'General',
        }),
      })

      if (!urlResponse.ok) {
        const error = await urlResponse.json()
        throw new Error(error.error || 'Failed to get upload URL')
      }

      const { uploadUrl, fileId } = await urlResponse.json()

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

      const newFile = await confirmResponse.json()
      setFiles([newFile, ...files])
      alert('File uploaded successfully!')
    } catch (error: any) {
      console.error('Error uploading file:', error)
      alert(error.message || 'Failed to upload file')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (loading || loadingFiles) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Files</h1>
        <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
          <input
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          />
          Upload File
        </label>
      </div>

      {files.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <span className="text-5xl block mb-4">📁</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No files</h3>
          <p className="text-gray-600 mb-6">Upload medical documents, lab results, or other files.</p>
          <label className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
            Upload File
          </label>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {files.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-xl mr-3">
                        {file.fileType.startsWith('image/') ? '🖼️' : '📄'}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{file.fileName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {file.category && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        {file.category}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatFileSize(file.fileSize)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <a
                      href={file.storageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      View
                    </a>
                    <a
                      href={file.storageUrl}
                      download
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

