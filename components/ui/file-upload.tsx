"use client"

import * as React from "react"
import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  File,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type FileUploadMode = "image" | "document" | "id-verification"

interface UploadedFile {
  id: string
  file: File
  preview?: string
  progress: number
  status: "uploading" | "success" | "error"
  error?: string
  fileRecord?: any
}

interface FileUploadProps {
  mode?: FileUploadMode
  multiple?: boolean
  maxFiles?: number
  maxSize?: number // in bytes
  acceptedTypes?: string[]
  category?: string
  consultationId?: string
  appointmentId?: string
  onUploadComplete?: (files: any[]) => void
  onError?: (error: string) => void
  className?: string
}

const MODE_CONFIG: Record<FileUploadMode, { accept: string; maxSize: number; label: string }> = {
  image: {
    accept: "image/*",
    maxSize: 10 * 1024 * 1024, // 10MB
    label: "Upload Images",
  },
  document: {
    accept: ".pdf,.doc,.docx,.txt",
    maxSize: 10 * 1024 * 1024, // 10MB
    label: "Upload Documents",
  },
  "id-verification": {
    accept: "image/*,.pdf",
    maxSize: 5 * 1024 * 1024, // 5MB
    label: "Upload ID for Verification",
  },
}

export function FileUpload({
  mode = "document",
  multiple = false,
  maxFiles = 5,
  maxSize,
  acceptedTypes,
  category,
  consultationId,
  appointmentId,
  onUploadComplete,
  onError,
  className,
}: FileUploadProps) {
  const { toast } = useToast()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const config = MODE_CONFIG[mode]
  const finalMaxSize = maxSize || config.maxSize
  const finalAcceptedTypes = acceptedTypes || config.accept.split(",")

  const validateFile = (file: File): string | null => {
    // Check file type
    const isValidType = finalAcceptedTypes.some((type) => {
      if (type.startsWith(".")) {
        return file.name.toLowerCase().endsWith(type.toLowerCase())
      }
      if (type.includes("/*")) {
        const baseType = type.split("/")[0]
        return file.type.startsWith(baseType)
      }
      return file.type === type
    })

    if (!isValidType) {
      return `File type not allowed. Accepted types: ${finalAcceptedTypes.join(", ")}`
    }

    // Check file size
    if (file.size > finalMaxSize) {
      const maxSizeMB = (finalMaxSize / (1024 * 1024)).toFixed(0)
      return `File size must be less than ${maxSizeMB}MB`
    }

    return null
  }

  const createPreview = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = () => resolve(undefined)
        reader.readAsDataURL(file)
      } else {
        resolve(undefined)
      }
    })
  }

  const uploadFile = async (file: File): Promise<any> => {
    // Step 1: Get signed upload URL
    const urlResponse = await fetch("/api/files/upload-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        category: category || mode === "id-verification" ? "ID Verification" : "General",
        consultationId,
        appointmentId,
      }),
    })

    if (!urlResponse.ok) {
      const error = await urlResponse.json()
      throw new Error(error.error || "Failed to get upload URL")
    }

    const { uploadUrl, fileId } = await urlResponse.json()

    // Step 2: Upload file directly to Cloud Storage
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    })

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload file to storage")
    }

    // Step 3: Confirm upload completion
    const confirmResponse = await fetch("/api/files/upload-url", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ fileId }),
    })

    if (!confirmResponse.ok) {
      throw new Error("Failed to confirm upload")
    }

    return await confirmResponse.json()
  }

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const filesArray = Array.from(fileList)

      // Check max files limit
      if (!multiple && filesArray.length > 1) {
        toast({
          title: "Multiple Files Not Allowed",
          description: "Please select only one file.",
          variant: "destructive",
        })
        return
      }

      if (files.length + filesArray.length > maxFiles) {
        toast({
          title: "Too Many Files",
          description: `Maximum ${maxFiles} files allowed.`,
          variant: "destructive",
        })
        return
      }

      // Validate and add files
      const newFiles: UploadedFile[] = []

      for (const file of filesArray) {
        const error = validateFile(file)
        if (error) {
          toast({
            title: "Invalid File",
            description: error,
            variant: "destructive",
          })
          continue
        }

        const preview = await createPreview(file)
        const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

        newFiles.push({
          id: fileId,
          file,
          preview,
          progress: 0,
          status: "uploading",
        })
      }

      setFiles((prev) => [...prev, ...newFiles])

      // Upload files
      for (const uploadFileItem of newFiles) {
        try {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFileItem.id ? { ...f, progress: 25 } : f
            )
          )

          const fileRecord = await uploadFile(uploadFileItem.file)

          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFileItem.id
                ? { ...f, progress: 100, status: "success", fileRecord }
                : f
            )
          )
        } catch (error: any) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFileItem.id
                ? { ...f, status: "error", error: error.message }
                : f
            )
          )
          onError?.(error.message || "Failed to upload file")
        }
      }

      // Call completion callback
      const successfulFiles = newFiles.filter((f) => f.status === "success")
      if (successfulFiles.length > 0 && onUploadComplete) {
        const fileRecords = successfulFiles
          .map((f) => f.fileRecord)
          .filter(Boolean)
        onUploadComplete(fileRecords)
      }
    },
    [files.length, maxFiles, multiple, onUploadComplete, onError, toast, category, consultationId, appointmentId, mode]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const droppedFiles = e.dataTransfer.files
      if (droppedFiles.length > 0) {
        handleFiles(droppedFiles)
      }
    },
    [handleFiles]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files
      if (selectedFiles && selectedFiles.length > 0) {
        handleFiles(selectedFiles)
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [handleFiles]
  )

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return <ImageIcon className="h-5 w-5" />
    }
    if (file.type === "application/pdf") {
      return <FileText className="h-5 w-5" />
    }
    return <File className="h-5 w-5" />
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drag and Drop Zone */}
      <Card
        className={cn(
          "border-2 border-dashed transition-all duration-200 cursor-pointer",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/5",
          files.length > 0 && "border-solid"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={config.label}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
      >
        <div className="p-4 sm:p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept={config.accept}
            multiple={multiple}
            onChange={handleFileSelect}
            className="sr-only"
            aria-label={config.label}
            aria-describedby={`file-upload-helper-${mode}`}
          />
          <Upload className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" aria-hidden="true" />
          <div className="space-y-1.5 sm:space-y-2">
            <p className="text-sm sm:text-base font-medium">
              {isDragging ? "Drop files here" : config.label}
            </p>
            <p id={`file-upload-helper-${mode}`} className="text-xs sm:text-sm text-muted-foreground">
              {multiple ? `Drag and drop or click to select (max ${maxFiles} files)` : "Drag and drop or click to select"}
            </p>
            <p className="text-xs text-muted-foreground">
              Accepted: {finalAcceptedTypes.join(", ")} • Max size: {(finalMaxSize / (1024 * 1024)).toFixed(0)}MB
            </p>
          </div>
        </div>
      </Card>

      {/* File Previews */}
      {files.length > 0 && (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Uploaded files">
          {files.map((uploadedFile) => (
            <Card key={uploadedFile.id} className="relative" role="listitem">
              <CardContent className="p-3 sm:p-4">
                {/* Preview */}
                {uploadedFile.preview ? (
                  <div className="relative aspect-video mb-3 rounded-md overflow-hidden bg-muted">
                    <img
                      src={uploadedFile.preview}
                      alt={uploadedFile.file.name}
                      className="w-full h-full object-cover"
                    />
                    {uploadedFile.status === "success" && (
                      <div className="absolute top-2 right-2">
                        <div className="rounded-full bg-green-500 p-1">
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-video mb-3 rounded-md bg-muted flex items-center justify-center">
                    {getFileIcon(uploadedFile.file)}
                  </div>
                )}

                {/* File Info */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{uploadedFile.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(uploadedFile.file.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-6 sm:w-6 flex-shrink-0 min-h-[44px] min-w-[44px] sm:min-h-[24px] sm:min-w-[24px]"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(uploadedFile.id)
                      }}
                      aria-label={`Remove ${uploadedFile.file.name}`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>

                  {/* Progress */}
                  {uploadedFile.status === "uploading" && (
                    <div className="space-y-1">
                      <Progress value={uploadedFile.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground text-center">
                        Uploading... {uploadedFile.progress}%
                      </p>
                    </div>
                  )}

                  {/* Error */}
                  {uploadedFile.status === "error" && (
                    <div className="flex items-center gap-2 text-xs text-destructive" role="alert">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                      <span className="flex-1">{uploadedFile.error || "Upload failed"}</span>
                    </div>
                  )}

                  {/* Success */}
                  {uploadedFile.status === "success" && (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Uploaded successfully</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ID Verification Mode Info */}
      {mode === "id-verification" && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  ID Verification Requirements
                </p>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                  <li>Upload a clear photo of your government-issued ID</li>
                  <li>Ensure all text is readable and the image is not blurry</li>
                  <li>Accepted formats: JPG, PNG, or PDF</li>
                  <li>Maximum file size: 5MB</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

