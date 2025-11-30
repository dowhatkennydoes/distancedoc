// TODO: Intake form types and interfaces
// TODO: Question types and form structure
// TODO: Validation schemas

export type QuestionType = 'text' | 'yesno' | 'scale' | 'multiselect' | 'textarea'

export interface FormQuestion {
  id: string
  type: QuestionType
  label: string
  required: boolean
  order: number
  // Type-specific options
  options?: string[] // For multiselect
  scaleMin?: number // For scale
  scaleMax?: number // For scale
  scaleLabelMin?: string // For scale
  scaleLabelMax?: string // For scale
  placeholder?: string // For text/textarea
  validation?: {
    minLength?: number
    maxLength?: number
    pattern?: string
  }
}

export interface IntakeFormData {
  id: string
  doctorId: string
  type: 'INITIAL' | 'FOLLOW_UP' | 'PRE_VISIT' | 'POST_VISIT' | 'ANNUAL'
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'ARCHIVED'
  questions: FormQuestion[]
  title: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

export interface FormResponse {
  questionId: string
  value: string | string[] | number | boolean
}

export interface ConsultationIntakeData {
  formId: string
  responses: FormResponse[]
  submittedAt: Date
}

