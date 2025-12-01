/**
 * Patient Store using Zustand
 * 
 * Manages patient list state, search, filters, and pagination
 * Reduces prop drilling and improves performance
 * 
 * Install Zustand: npm install zustand
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export type FilterType = "all" | "active" | "new" | "needing-follow-up"

interface Patient {
  id: string
  name: string
  email?: string
  dateOfBirth: string
  lastVisit?: string
  nextVisit?: string
  status: "active" | "new" | "needing-follow-up"
  createdAt: string
}

interface PatientState {
  patients: Patient[]
  searchQuery: string
  filter: FilterType
  page: number
  pageSize: number
  loading: boolean
  error: string | null
  
  // Actions
  setPatients: (patients: Patient[]) => void
  setSearchQuery: (query: string) => void
  setFilter: (filter: FilterType) => void
  setPage: (page: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
  
  // Computed
  getFilteredPatients: () => Patient[]
  getPaginatedPatients: () => Patient[]
  getTotalPages: () => number
}

const initialState = {
  patients: [],
  searchQuery: "",
  filter: "all" as FilterType,
  page: 1,
  pageSize: 50,
  loading: false,
  error: null,
}

export const usePatientStore = create<PatientState>()(
  devtools(
    (set, get) => ({
      ...initialState,
      
      setPatients: (patients) => set({ patients, page: 1 }), // Reset to first page on new data
      
      setSearchQuery: (query) => set({ searchQuery: query, page: 1 }),
      
      setFilter: (filter) => set({ filter, page: 1 }),
      
      setPage: (page) => set({ page }),
      
      setLoading: (loading) => set({ loading }),
      
      setError: (error) => set({ error }),
      
      reset: () => set(initialState),
      
      getFilteredPatients: () => {
        const { patients, searchQuery, filter } = get()
        let filtered = patients

        // Apply search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          filtered = filtered.filter(
            (patient) =>
              patient.name.toLowerCase().includes(query) ||
              patient.email?.toLowerCase().includes(query)
          )
        }

        // Apply status filter
        if (filter !== "all") {
          filtered = filtered.filter((patient) => patient.status === filter)
        }

        return filtered
      },
      
      getPaginatedPatients: () => {
        const filtered = get().getFilteredPatients()
        const { page, pageSize } = get()
        const startIndex = (page - 1) * pageSize
        const endIndex = startIndex + pageSize
        return filtered.slice(startIndex, endIndex)
      },
      
      getTotalPages: () => {
        const filtered = get().getFilteredPatients()
        const { pageSize } = get()
        return Math.ceil(filtered.length / pageSize)
      },
    }),
    { name: 'PatientStore' }
  )
)

