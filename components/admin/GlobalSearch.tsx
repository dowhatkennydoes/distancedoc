"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, X, Loader2, User, Users, Calendar, Building2, FileText, Settings, ArrowUp, ArrowDown, Command } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SearchResult {
  id: string
  type: "doctor" | "patient" | "appointment" | "clinic" | "audit_log" | "settings"
  title: string
  subtitle: string
  href: string
  metadata?: Record<string, any>
}

interface SearchResults {
  doctors: SearchResult[]
  patients: SearchResult[]
  appointments: SearchResult[]
  clinics: SearchResult[]
  auditLogs: SearchResult[]
  settings: SearchResult[]
}

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TYPE_ICONS = {
  doctor: User,
  patient: Users,
  appointment: Calendar,
  clinic: Building2,
  audit_log: FileText,
  settings: Settings,
}

const TYPE_LABELS = {
  doctor: "Doctor",
  patient: "Patient",
  appointment: "Appointment",
  clinic: "Clinic",
  audit_log: "Audit Log",
  settings: "Settings",
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<SearchResults>({
    doctors: [],
    patients: [],
    appointments: [],
    clinics: [],
    auditLogs: [],
    settings: [],
  })
  const [loading, setLoading] = React.useState(false)
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [allResults, setAllResults] = React.useState<SearchResult[]>([])

  // Flatten results into a single array for navigation
  React.useEffect(() => {
    const flattened = [
      ...results.doctors,
      ...results.patients,
      ...results.appointments,
      ...results.clinics,
      ...results.auditLogs,
      ...results.settings,
    ]
    setAllResults(flattened)
    setSelectedIndex(0)
  }, [results])

  // Debounced search
  React.useEffect(() => {
    if (!open) return

    const searchTimeout = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults({
          doctors: [],
          patients: [],
          appointments: [],
          clinics: [],
          auditLogs: [],
          settings: [],
        })
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}&limit=5`, {
          credentials: "include",
        })

        if (response.ok) {
          const data = await response.json()
          setResults(data.results || {
            doctors: [],
            patients: [],
            appointments: [],
            clinics: [],
            auditLogs: [],
            settings: [],
          })
        }
      } catch (error) {
        console.error("Search failed:", error)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [query, open])

  // Focus input when dialog opens
  React.useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < allResults.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === "Enter" && allResults[selectedIndex]) {
      e.preventDefault()
      handleSelect(allResults[selectedIndex])
    } else if (e.key === "Escape") {
      e.preventDefault()
      onOpenChange(false)
    }
  }

  const handleSelect = (result: SearchResult) => {
    router.push(result.href)
    onOpenChange(false)
    setQuery("")
    setSelectedIndex(0)
  }

  const totalResults = allResults.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 max-h-[80vh] overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Search Input */}
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search doctors, patients, appointments, clinics..."
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
            />
            {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            {query && !loading && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setQuery("")
                  inputRef.current?.focus()
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {query.trim().length < 2 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Search anything</p>
                <p className="text-sm">
                  Type at least 2 characters to search across doctors, patients, appointments, clinics, audit logs, and settings.
                </p>
                <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-muted rounded border">⌘</kbd>
                    <span>or</span>
                    <kbd className="px-2 py-1 bg-muted rounded border">Ctrl</kbd>
                    <span>+</span>
                    <kbd className="px-2 py-1 bg-muted rounded border">K</kbd>
                  </div>
                </div>
              </div>
            ) : totalResults === 0 && !loading ? (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No results found</p>
                <p className="text-sm">Try a different search term.</p>
              </div>
            ) : (
              <div className="py-2">
                {results.doctors.length > 0 && (
                  <ResultSection
                    title="Doctors"
                    results={results.doctors}
                    selectedIndex={selectedIndex}
                    allResults={allResults}
                    onSelect={handleSelect}
                  />
                )}
                {results.patients.length > 0 && (
                  <ResultSection
                    title="Patients"
                    results={results.patients}
                    selectedIndex={selectedIndex}
                    allResults={allResults}
                    onSelect={handleSelect}
                  />
                )}
                {results.appointments.length > 0 && (
                  <ResultSection
                    title="Appointments"
                    results={results.appointments}
                    selectedIndex={selectedIndex}
                    allResults={allResults}
                    onSelect={handleSelect}
                  />
                )}
                {results.clinics.length > 0 && (
                  <ResultSection
                    title="Clinics"
                    results={results.clinics}
                    selectedIndex={selectedIndex}
                    allResults={allResults}
                    onSelect={handleSelect}
                  />
                )}
                {results.auditLogs.length > 0 && (
                  <ResultSection
                    title="Audit Logs"
                    results={results.auditLogs}
                    selectedIndex={selectedIndex}
                    allResults={allResults}
                    onSelect={handleSelect}
                  />
                )}
                {results.settings.length > 0 && (
                  <ResultSection
                    title="Settings"
                    results={results.settings}
                    selectedIndex={selectedIndex}
                    allResults={allResults}
                    onSelect={handleSelect}
                  />
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {totalResults > 0 && (
            <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{totalResults} result{totalResults !== 1 ? "s" : ""} found</span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" />
                  <ArrowDown className="h-3 w-3" />
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded border">Enter</kbd>
                  <span>Select</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded border">Esc</kbd>
                  <span>Close</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ResultSectionProps {
  title: string
  results: SearchResult[]
  selectedIndex: number
  allResults: SearchResult[]
  onSelect: (result: SearchResult) => void
}

function ResultSection({ title, results, selectedIndex, allResults, onSelect }: ResultSectionProps) {
  return (
    <div className="mb-4">
      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </div>
      <div className="space-y-1">
        {results.map((result) => {
          const globalIndex = allResults.findIndex((r) => r.id === result.id && r.type === result.type)
          const isSelected = globalIndex === selectedIndex
          const Icon = TYPE_ICONS[result.type] || Search

          return (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => onSelect(result)}
              className={cn(
                "w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-muted/50 transition-colors",
                isSelected && "bg-muted"
              )}
            >
              <Icon className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium truncate">{result.title}</p>
                  <Badge variant="outline" className="text-xs">
                    {TYPE_LABELS[result.type]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Export hook for keyboard shortcut
export function useGlobalSearch() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for CMD+K (Mac) or CTRL+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return { open, setOpen }
}

