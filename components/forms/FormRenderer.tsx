'use client'

// TODO: Patient-facing form renderer
// TODO: Render form based on questions
// TODO: Handle all question types
// TODO: Validate responses
// TODO: Submit responses

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import type { FormQuestion, FormResponse } from '@/lib/forms/types'

interface FormRendererProps {
  questions: FormQuestion[]
  title: string
  description?: string
  onSubmit: (responses: FormResponse[]) => Promise<void>
  initialResponses?: FormResponse[]
}

export function FormRenderer({
  questions,
  title,
  description,
  onSubmit,
  initialResponses = [],
}: FormRendererProps) {
  const [responses, setResponses] = useState<Record<string, any>>(
    initialResponses.reduce((acc, r) => ({ ...acc, [r.questionId]: r.value }), {})
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // TODO: Update response
  const updateResponse = useCallback((questionId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }))
    // Clear error when user starts typing
    if (errors[questionId]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[questionId]
        return newErrors
      })
    }
  }, [errors])

  // TODO: Validate responses
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}

    questions.forEach((question) => {
      const value = responses[question.id]

      if (question.required && (value === undefined || value === null || value === '')) {
        newErrors[question.id] = 'This field is required'
        return
      }

      if (value !== undefined && value !== null && value !== '') {
        if (question.type === 'text' || question.type === 'textarea') {
          const strValue = String(value)
          if (question.validation?.minLength && strValue.length < question.validation.minLength) {
            newErrors[question.id] = `Minimum length is ${question.validation.minLength} characters`
          }
          if (question.validation?.maxLength && strValue.length > question.validation.maxLength) {
            newErrors[question.id] = `Maximum length is ${question.validation.maxLength} characters`
          }
        }
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [questions, responses])

  // TODO: Submit form
  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      return
    }

    setIsSubmitting(true)
    try {
      const formResponses: FormResponse[] = questions.map((q) => ({
        questionId: q.id,
        value: responses[q.id] ?? (q.type === 'multiselect' ? [] : ''),
      }))

      await onSubmit(formResponses)
    } catch (error) {
      console.error('Error submitting form:', error)
      alert('Failed to submit form')
    } finally {
      setIsSubmitting(false)
    }
  }, [questions, responses, validate, onSubmit])

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        {description && <p className="text-gray-600">{description}</p>}
      </div>

      <div className="space-y-6">
        {questions.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            value={responses[question.id]}
            onChange={(value) => updateResponse(question.id, value)}
            error={errors[question.id]}
          />
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Form'}
        </Button>
      </div>
    </div>
  )
}

// TODO: Question field component
function QuestionField({
  question,
  value,
  onChange,
  error,
}: {
  question: FormQuestion
  value: any
  onChange: (value: any) => void
  error?: string
}) {
  const renderField = () => {
    switch (question.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder}
            className={`w-full px-4 py-2 border rounded-lg ${error ? 'border-red-500' : 'border-gray-300'}`}
          />
        )

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder}
            rows={4}
            className={`w-full px-4 py-2 border rounded-lg ${error ? 'border-red-500' : 'border-gray-300'}`}
          />
        )

      case 'yesno':
        return (
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={question.id}
                checked={value === true}
                onChange={() => onChange(true)}
              />
              <span>Yes</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={question.id}
                checked={value === false}
                onChange={() => onChange(false)}
              />
              <span>No</span>
            </label>
          </div>
        )

      case 'scale':
        return (
          <div className="space-y-2">
            <input
              type="range"
              min={question.scaleMin || 1}
              max={question.scaleMax || 10}
              value={value || question.scaleMin || 1}
              onChange={(e) => onChange(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-500">
              <span>{question.scaleLabelMin || question.scaleMin || 1}</span>
              <span className="font-medium">{value || question.scaleMin || 1}</span>
              <span>{question.scaleLabelMax || question.scaleMax || 10}</span>
            </div>
          </div>
        )

      case 'multiselect':
        return (
          <div className="space-y-2">
            {question.options?.map((option, idx) => (
              <label key={idx} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={(value as string[])?.includes(option) || false}
                  onChange={(e) => {
                    const current = (value as string[]) || []
                    if (e.target.checked) {
                      onChange([...current, option])
                    } else {
                      onChange(current.filter((v) => v !== option))
                    }
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div>
      <label className="block mb-2 font-medium">
        {question.label}
        {question.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderField()}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
}

