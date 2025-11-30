// Authentication types and interfaces
// TODO: Define user roles and authentication types

export type UserRole = 'doctor' | 'patient' | 'admin'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  emailVerified?: boolean
  clinicId: string // Tenant isolation - clinic identifier
  metadata?: {
    doctorId?: string
    patientId?: string
    approved?: boolean // For doctor approval
  }
}

export interface SignupData {
  email: string
  password: string
  role: 'doctor' | 'patient'
  // Doctor-specific fields
  licenseNumber?: string
  npiNumber?: string
  specialization?: string
  // Patient-specific fields
  dateOfBirth?: string
  phoneNumber?: string
}

export interface LoginData {
  email: string
  password: string
}

