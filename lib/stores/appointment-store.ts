/**
 * Appointment Store using Zustand
 * 
 * Manages appointment state, view mode, and calendar state
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type ViewMode = "day" | "week" | "month" | "list"

interface Appointment {
  id: string
  scheduledAt: string
  duration: number
  status: string
  visitType: string
  reason?: string
  meetingUrl?: string
  patient: {
    id: string
    name: string
    email?: string
    phoneNumber?: string
  }
}

interface AppointmentState {
  appointments: Appointment[]
  viewMode: ViewMode
  selectedDate: Date
  selectedAppointment: Appointment | null
  loading: boolean
  error: string | null
  
  // Actions
  setAppointments: (appointments: Appointment[]) => void
  setViewMode: (mode: ViewMode) => void
  setSelectedDate: (date: Date) => void
  setSelectedAppointment: (appointment: Appointment | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  removeAppointment: (id: string) => void
  reset: () => void
}

const initialState = {
  appointments: [],
  viewMode: "month" as ViewMode,
  selectedDate: new Date(),
  selectedAppointment: null,
  loading: false,
  error: null,
}

export const useAppointmentStore = create<AppointmentState>()(
  devtools(
    (set, get) => ({
      ...initialState,
      
      setAppointments: (appointments) => set({ appointments }),
      
      setViewMode: (mode) => set({ viewMode: mode }),
      
      setSelectedDate: (date) => set({ selectedDate: date }),
      
      setSelectedAppointment: (appointment) => set({ selectedAppointment: appointment }),
      
      setLoading: (loading) => set({ loading }),
      
      setError: (error) => set({ error }),
      
      removeAppointment: (id) => set((state) => ({
        appointments: state.appointments.filter(apt => apt.id !== id),
        selectedAppointment: state.selectedAppointment?.id === id ? null : state.selectedAppointment,
      })),
      
      reset: () => set(initialState),
    }),
    { name: 'AppointmentStore' }
  )
)

