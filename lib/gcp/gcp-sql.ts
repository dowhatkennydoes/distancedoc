// TODO: Cloud SQL connector for Postgres using GCP connector
// TODO: Support Unix socket connection for Cloud Functions/Cloud Run
// TODO: Support TCP connection for local development
// TODO: Implement connection pooling
// TODO: Add connection retry logic
// TODO: Handle connection errors gracefully
// TODO: Support read replicas for scaling
// TODO: Add query timeout configuration

import { Pool, PoolConfig } from 'pg'

// TODO: Get Cloud SQL instance connection name from environment
const getConnectionConfig = (): PoolConfig => {
  const projectId = process.env.GCP_PROJECT_ID || 'distancedoc'
  const region = process.env.GCP_REGION || 'us-central1'
  const instanceName = process.env.GCP_SQL_INSTANCE || 'distancedoc-db'
  const dbName = process.env.GCP_SQL_DATABASE || 'distancedoc'
  const dbUser = process.env.GCP_SQL_USER || 'postgres'
  const dbPassword = process.env.GCP_SQL_PASSWORD || ''
  
  // Cloud SQL connection string format for Unix socket (Cloud Functions/Cloud Run)
  const socketPath = `/cloudsql/${projectId}:${region}:${instanceName}`
  
  // Use Unix socket in production (GCP), TCP in local development
  const isProduction = process.env.NODE_ENV === 'production' || process.env.GCP_SQL_USE_SOCKET === 'true'
  
  if (isProduction) {
    return {
      host: socketPath,
      database: dbName,
      user: dbUser,
      password: dbPassword,
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  } else {
    // Local development with TCP connection
    return {
      host: process.env.GCP_SQL_HOST || '127.0.0.1',
      port: parseInt(process.env.GCP_SQL_PORT || '5432'),
      database: dbName,
      user: dbUser,
      password: dbPassword,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  }
}

// TODO: Create singleton connection pool
let pool: Pool | null = null

export function getCloudSQLPool(): Pool {
  if (!pool) {
    const config = getConnectionConfig()
    pool = new Pool(config)
    
    // TODO: Add error handling for pool
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })
  }
  
  return pool
}

// TODO: Export helper function to execute queries
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const pool = getCloudSQLPool()
  const result = await pool.query(text, params)
  return result.rows as T[]
}

// TODO: Export helper function for transactions
export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const pool = getCloudSQLPool()
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// TODO: Close pool connection (for cleanup)
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

