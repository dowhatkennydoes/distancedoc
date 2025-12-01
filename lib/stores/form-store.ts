/**
 * Form Builder Store using Zustand
 * 
 * Manages form builder state, questions, and validation
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { FormQuestion } from '@/lib/forms/types'

interface FormState {
  questions: FormQuestion[]
  title: string
  description: string
  isSaving: boolean
  isPreviewMode: boolean
  errors: Record<string, string>
  
  // Actions
  setQuestions: (questions: FormQuestion[]) => void
  setTitle: (title: string) => void
  setDescription: (description: string) => void
  addQuestion: (question: FormQuestion) => void
  updateQuestion: (id: string, updates: Partial<FormQuestion>) => void
  deleteQuestion: (id: string) => void
  reorderQuestions: (newOrder: FormQuestion[]) => void
  setIsSaving: (isSaving: boolean) => void
  setIsPreviewMode: (isPreview: boolean) => void
  setError: (key: string, error: string | null) => void
  reset: () => void
}

const initialState = {
  questions: [],
  title: "",
  description: "",
  isSaving: false,
  isPreviewMode: false,
  errors: {},
}

export const useFormStore = create<FormState>()(
  devtools(
    (set) => ({
      ...initialState,
      
      setQuestions: (questions) => set({ questions }),
      
      setTitle: (title) => set({ title }),
      
      setDescription: (description) => set({ description }),
      
      addQuestion: (question) => set((state) => ({
        questions: [...state.questions, question],
      })),
      
      updateQuestion: (id, updates) => set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id ? { ...q, ...updates } : q
        ),
      })),
      
      deleteQuestion: (id) => set((state) => ({
        questions: state.questions
          .filter((q) => q.id !== id)
          .map((q, idx) => ({ ...q, order: idx })),
      })),
      
      reorderQuestions: (newOrder) => set((state) => ({
        questions: newOrder.map((q, idx) => ({ ...q, order: idx })),
      })),
      
      setIsSaving: (isSaving) => set({ isSaving }),
      
      setIsPreviewMode: (isPreview) => set({ isPreviewMode: isPreview }),
      
      setError: (key, error) => set((state) => ({
        errors: error ? { ...state.errors, [key]: error } : 
                Object.fromEntries(Object.entries(state.errors).filter(([k]) => k !== key)),
      })),
      
      reset: () => set(initialState),
    }),
    { name: 'FormStore' }
  )
)

