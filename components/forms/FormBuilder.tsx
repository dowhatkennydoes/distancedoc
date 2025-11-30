"use client"

import { useState, useCallback } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  GripVertical,
  Plus,
  Trash2,
  Eye,
  Edit,
  Save,
  X,
  Type,
  FileText,
  CheckSquare,
  Sliders,
  List,
} from "lucide-react"
import type { FormQuestion, QuestionType } from "@/lib/forms/types"
import { useToast } from "@/components/ui/use-toast"

interface FormBuilderProps {
  initialQuestions?: FormQuestion[]
  initialTitle?: string
  initialDescription?: string
  formType: "INITIAL" | "FOLLOW_UP" | "PRE_VISIT" | "POST_VISIT" | "ANNUAL"
  onSave: (questions: FormQuestion[], title: string, description?: string) => Promise<void>
  formId?: string
}

export function FormBuilder({
  initialQuestions = [],
  initialTitle = "",
  initialDescription = "",
  formType,
  onSave,
  formId,
}: FormBuilderProps) {
  const [questions, setQuestions] = useState<FormQuestion[]>(initialQuestions)
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [isSaving, setIsSaving] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const addQuestion = useCallback(
    (type: QuestionType) => {
      const newQuestion: FormQuestion = {
        id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        type,
        label: "",
        required: false,
        order: questions.length,
        ...(type === "multiselect" && { options: ["Option 1", "Option 2"] }),
        ...(type === "scale" && {
          scaleMin: 1,
          scaleMax: 10,
          scaleLabelMin: "Low",
          scaleLabelMax: "High",
        }),
        ...(type === "text" && { placeholder: "Enter text..." }),
        ...(type === "textarea" && { placeholder: "Enter text..." }),
      }
      setQuestions([...questions, newQuestion])
    },
    [questions]
  )

  const deleteQuestion = useCallback(
    (id: string) => {
      const newQuestions = questions
        .filter((q) => q.id !== id)
        .map((q, idx) => ({ ...q, order: idx }))
      setQuestions(newQuestions)
    },
    [questions]
  )

  const updateQuestion = useCallback(
    (id: string, updates: Partial<FormQuestion>) => {
      setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)))
    },
    [questions]
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setQuestions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        const newItems = arrayMove(items, oldIndex, newIndex).map((q, idx) => ({
          ...q,
          order: idx,
        }))

        return newItems
      })
    }
  }

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a form title",
        variant: "destructive",
      })
      return
    }

    const emptyLabels = questions.filter((q) => !q.label.trim())
    if (emptyLabels.length > 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all question labels",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      await onSave(questions, title, description)
      toast({
        title: "Success",
        description: "Form saved successfully",
        variant: "success",
      })
    } catch (error: any) {
      console.error("Error saving form:", error)
      toast({
        title: "Save Error",
        description: error.message || "Failed to save form. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }, [questions, title, description, onSave, toast])

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Form Builder</h1>
          <p className="text-muted-foreground mt-2">Create and customize intake forms</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isPreviewMode ? "default" : "outline"}
            onClick={() => setIsPreviewMode(!isPreviewMode)}
          >
            {isPreviewMode ? (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Edit Mode
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || questions.length === 0}>
            {isSaving ? (
              <>
                <Save className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Form
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Form Metadata */}
      {!isPreviewMode && (
        <Card>
          <CardHeader>
            <CardTitle>Form Information</CardTitle>
            <CardDescription>Basic details about this form</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Form Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Pre-Visit Intake Form"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of the form's purpose"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Form Type</Label>
              <Badge variant="secondary">{formType.replace("_", " ")}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Question Types Toolbar */}
      {!isPreviewMode && (
        <Card>
          <CardHeader>
            <CardTitle>Add Question</CardTitle>
            <CardDescription>Choose a question type to add</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Button
                variant="outline"
                onClick={() => addQuestion("text")}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <Type className="h-5 w-5" />
                <span>Text</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => addQuestion("textarea")}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <FileText className="h-5 w-5" />
                <span>Textarea</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => addQuestion("yesno")}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <CheckSquare className="h-5 w-5" />
                <span>Yes/No</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => addQuestion("scale")}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <Sliders className="h-5 w-5" />
                <span>Scale</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => addQuestion("multiselect")}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <List className="h-5 w-5" />
                <span>Multiselect</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Questions List */}
      {isPreviewMode ? (
        <FormPreview questions={questions} title={title} description={description} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Questions</CardTitle>
            <CardDescription>
              Drag and drop to reorder questions. Click to edit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {questions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-2">No questions yet</p>
                <p className="text-sm">Click a question type above to add your first question</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                    {questions.map((question) => (
                      <SortableQuestionItem
                        key={question.id}
                        question={question}
                        index={questions.findIndex((q) => q.id === question.id)}
                        onUpdate={(updates) => updateQuestion(question.id, updates)}
                        onDelete={() => deleteQuestion(question.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Sortable Question Item Component
function SortableQuestionItem({
  question,
  index,
  onUpdate,
  onDelete,
}: {
  question: FormQuestion
  index: number
  onUpdate: (updates: Partial<FormQuestion>) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing mt-2 text-muted-foreground hover:text-foreground"
            >
              <GripVertical className="h-5 w-5" />
            </div>

            {/* Question Editor */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Question {index + 1}</Badge>
                  <Badge variant="secondary">{question.type}</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={onDelete}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`label-${question.id}`}>Question Label *</Label>
                <Input
                  id={`label-${question.id}`}
                  value={question.label}
                  onChange={(e) => onUpdate({ label: e.target.value })}
                  placeholder="Enter question text"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`required-${question.id}`}
                  checked={question.required}
                  onCheckedChange={(checked) => onUpdate({ required: checked === true })}
                />
                <Label htmlFor={`required-${question.id}`} className="cursor-pointer">
                  Required field
                </Label>
              </div>

              {/* Type-specific options */}
              {question.type === "multiselect" && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  {question.options?.map((option, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...(question.options || [])]
                          newOptions[idx] = e.target.value
                          onUpdate({ options: newOptions })
                        }}
                        placeholder={`Option ${idx + 1}`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newOptions = question.options?.filter((_, i) => i !== idx) || []
                          onUpdate({ options: newOptions })
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onUpdate({ options: [...(question.options || []), `Option ${(question.options?.length || 0) + 1}`] })
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                  </Button>
                </div>
              )}

              {question.type === "scale" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Value</Label>
                    <Input
                      type="number"
                      value={question.scaleMin || 1}
                      onChange={(e) => onUpdate({ scaleMin: parseInt(e.target.value) || 1 })}
                    />
                    <Input
                      value={question.scaleLabelMin || ""}
                      onChange={(e) => onUpdate({ scaleLabelMin: e.target.value })}
                      placeholder="Min label (optional)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Value</Label>
                    <Input
                      type="number"
                      value={question.scaleMax || 10}
                      onChange={(e) => onUpdate({ scaleMax: parseInt(e.target.value) || 10 })}
                    />
                    <Input
                      value={question.scaleLabelMax || ""}
                      onChange={(e) => onUpdate({ scaleLabelMax: e.target.value })}
                      placeholder="Max label (optional)"
                    />
                  </div>
                </div>
              )}

              {(question.type === "text" || question.type === "textarea") && (
                <div className="space-y-2">
                  <Label htmlFor={`placeholder-${question.id}`}>Placeholder Text</Label>
                  <Input
                    id={`placeholder-${question.id}`}
                    value={question.placeholder || ""}
                    onChange={(e) => onUpdate({ placeholder: e.target.value })}
                    placeholder="Optional placeholder text"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Form Preview Component
function FormPreview({
  questions,
  title,
  description,
}: {
  questions: FormQuestion[]
  title: string
  description?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || "Form Preview"}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {questions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No questions to preview</p>
        ) : (
          questions.map((question, index) => (
            <div key={question.id} className="space-y-2">
              <Label>
                {question.label || `Question ${index + 1}`}
                {question.required && <span className="text-destructive ml-1">*</span>}
              </Label>

              {question.type === "text" && (
                <Input placeholder={question.placeholder || "Enter text..."} disabled />
              )}

              {question.type === "textarea" && (
                <Textarea placeholder={question.placeholder || "Enter text..."} disabled rows={4} />
              )}

              {question.type === "yesno" && (
                <RadioGroup disabled defaultValue="yes">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id={`yes-${question.id}`} />
                    <Label htmlFor={`yes-${question.id}`} className="cursor-pointer">
                      Yes
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id={`no-${question.id}`} />
                    <Label htmlFor={`no-${question.id}`} className="cursor-pointer">
                      No
                    </Label>
                  </div>
                </RadioGroup>
              )}

              {question.type === "scale" && (
                <div className="space-y-2">
                  <Slider
                    defaultValue={[question.scaleMin || 1]}
                    min={question.scaleMin || 1}
                    max={question.scaleMax || 10}
                    step={1}
                    disabled
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{question.scaleLabelMin || question.scaleMin || 1}</span>
                    <span>{question.scaleLabelMax || question.scaleMax || 10}</span>
                  </div>
                </div>
              )}

              {question.type === "multiselect" && (
                <div className="space-y-2">
                  {question.options?.map((option, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <Checkbox id={`option-${question.id}-${idx}`} disabled />
                      <Label htmlFor={`option-${question.id}-${idx}`} className="cursor-pointer">
                        {option || `Option ${idx + 1}`}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
