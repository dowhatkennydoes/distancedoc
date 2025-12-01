/**
 * Background Task Utilities
 * 
 * Executes low-priority tasks asynchronously without blocking the main response.
 * Used for audit logging, notifications, and other non-critical operations.
 */

/**
 * Execute a task in the background without blocking the response
 * Errors are logged but do not affect the main request
 */
export function runInBackground<T>(
  task: () => Promise<T>,
  errorHandler?: (error: Error) => void
): void {
  // Use setImmediate or setTimeout for true background execution
  const scheduleFn = typeof setImmediate !== 'undefined' ? setImmediate : setTimeout
  
  scheduleFn(() => {
    task()
      .catch((error: Error) => {
        if (errorHandler) {
          errorHandler(error)
        } else {
          console.error('Background task failed (non-critical):', error)
        }
      })
  }, 0)
}

/**
 * Batch multiple background tasks
 */
export function runInBackgroundBatch<T>(
  tasks: Array<() => Promise<T>>,
  errorHandler?: (error: Error, index: number) => void
): void {
  tasks.forEach((task, index) => {
    runInBackground(task, (error) => {
      if (errorHandler) {
        errorHandler(error, index)
      }
    })
  })
}

/**
 * Schedule a task for background execution with delay
 */
export function scheduleBackgroundTask<T>(
  task: () => Promise<T>,
  delayMs: number = 0,
  errorHandler?: (error: Error) => void
): void {
  setTimeout(() => {
    runInBackground(task, errorHandler)
  }, delayMs)
}

