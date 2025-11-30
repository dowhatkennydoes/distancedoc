// HIPAA-compliant structured logging
// TODO: Replace console.log/error with structured logging
// TODO: Redact PHI from logs
// TODO: Include request IDs for traceability
// TODO: Support different log levels
// TODO: Integrate with Cloud Logging

import { redactPHI } from './sanitize'

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  level: LogLevel
  message: string
  metadata?: Record<string, any>
  userId?: string
  requestId?: string
  timestamp: string
}

// Redact PHI from metadata
function redactMetadata(metadata: Record<string, any>): Record<string, any> {
  const redacted: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') {
      redacted[key] = redactPHI(value)
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactMetadata(value as Record<string, any>)
    } else {
      redacted[key] = value
    }
  }
  
  return redacted
}

// Create structured log entry
function createLogEntry(
  level: LogLevel,
  message: string,
  metadata?: Record<string, any>,
  userId?: string,
  requestId?: string
): LogEntry {
  const entry: LogEntry = {
    level,
    message: redactPHI(message),
    timestamp: new Date().toISOString(),
  }
  
  if (metadata) {
    entry.metadata = redactMetadata(metadata)
  }
  
  if (userId) {
    entry.userId = userId
  }
  
  if (requestId) {
    entry.requestId = requestId
  }
  
  return entry
}

// Log to console (in production, send to Cloud Logging)
function writeLog(entry: LogEntry): void {
  const logMessage = JSON.stringify(entry)
  
  switch (entry.level) {
    case LogLevel.DEBUG:
      if (process.env.NODE_ENV === 'development') {
        console.debug(logMessage)
      }
      break
    case LogLevel.INFO:
      console.info(logMessage)
      break
    case LogLevel.WARN:
      console.warn(logMessage)
      break
    case LogLevel.ERROR:
      console.error(logMessage)
      break
  }
}

// Public logging functions
export function logDebug(
  message: string,
  metadata?: Record<string, any>,
  userId?: string,
  requestId?: string
): void {
  const entry = createLogEntry(LogLevel.DEBUG, message, metadata, userId, requestId)
  writeLog(entry)
}

export function logInfo(
  message: string,
  metadata?: Record<string, any>,
  userId?: string,
  requestId?: string
): void {
  const entry = createLogEntry(LogLevel.INFO, message, metadata, userId, requestId)
  writeLog(entry)
}

export function logWarn(
  message: string,
  metadata?: Record<string, any>,
  userId?: string,
  requestId?: string
): void {
  const entry = createLogEntry(LogLevel.WARN, message, metadata, userId, requestId)
  writeLog(entry)
}

export function logError(
  message: string,
  error?: Error,
  metadata?: Record<string, any>,
  userId?: string,
  requestId?: string
): void {
  const errorMetadata = {
    ...metadata,
    errorName: error?.name,
    errorMessage: error?.message ? redactPHI(error.message) : undefined,
    // Don't include stack trace in production logs
    stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
  }
  
  const entry = createLogEntry(LogLevel.ERROR, message, errorMetadata, userId, requestId)
  writeLog(entry)
}

// Audit logging for sensitive operations
export function logAudit(
  action: string,
  resource: string,
  resourceId: string,
  userId: string,
  success: boolean,
  metadata?: Record<string, any>
): void {
  const auditEntry = createLogEntry(
    LogLevel.INFO,
    `AUDIT: ${action} on ${resource}`,
    {
      ...metadata,
      action,
      resource,
      resourceId,
      success,
    },
    userId
  )
  
  writeLog(auditEntry)
}

