# Dynamic Intake Form Builder

## Overview

Complete intake form system with doctor form builder and patient form completion.

## Features

✅ **Form Builder (Doctor UI)**
- Add/delete/reorder questions
- Multiple question types: text, yes/no, scale, multiselect, textarea
- Save forms to Postgres (IntakeForm model)
- Form templates for reuse

✅ **Form Renderer (Patient UI)**
- Automatic rendering based on form structure
- Validation and error handling
- Submit responses to Consultation

✅ **API Endpoints**
- `GET /api/forms` - List forms
- `POST /api/forms` - Create form
- `GET /api/forms/[id]` - Get form
- `PUT /api/forms/[id]` - Update form
- `DELETE /api/forms/[id]` - Delete form
- `POST /api/forms/[id]/submit` - Submit patient responses

## Question Types

### 1. Text
Single-line text input with optional placeholder and validation.

### 2. Textarea
Multi-line text input for longer responses.

### 3. Yes/No
Radio buttons for binary questions.

### 4. Scale
Range slider with min/max values and optional labels.

### 5. Multiselect
Checkboxes for multiple selections.

## Database Schema

Forms are stored in `IntakeForm` model:
- `formData` (JSON) - Contains form structure and questions
- `type` - Form type (INITIAL, FOLLOW_UP, PRE_VISIT, etc.)
- `status` - Form status (DRAFT, SUBMITTED, REVIEWED, ARCHIVED)

## Usage

### Doctor - Create Form

1. Navigate to `/doctor/forms`
2. Enter form title and description
3. Add questions using question type buttons
4. Configure each question (label, required, options)
5. Reorder questions using up/down arrows
6. Save form

### Patient - Complete Form

1. Navigate to `/patient/forms/[id]?consultationId=[id]`
2. Form automatically renders based on structure
3. Fill in responses
4. Submit form

## API Examples

### Create Form

```typescript
POST /api/forms
{
  "type": "PRE_VISIT",
  "title": "Pre-Visit Intake Form",
  "description": "Please complete before your appointment",
  "questions": [
    {
      "id": "q1",
      "type": "text",
      "label": "What is your chief complaint?",
      "required": true,
      "order": 0,
      "placeholder": "Describe your symptoms"
    },
    {
      "id": "q2",
      "type": "scale",
      "label": "Rate your pain level",
      "required": true,
      "order": 1,
      "scaleMin": 1,
      "scaleMax": 10,
      "scaleLabelMin": "No pain",
      "scaleLabelMax": "Severe pain"
    }
  ]
}
```

### Submit Form

```typescript
POST /api/forms/[id]/submit
{
  "consultationId": "consultation-123",
  "responses": [
    {
      "questionId": "q1",
      "value": "Chest pain"
    },
    {
      "questionId": "q2",
      "value": 7
    }
  ]
}
```

## Components

### FormBuilder
Doctor-facing form builder component with drag-and-drop question management.

### FormRenderer
Patient-facing form renderer that automatically renders based on question types.

## Future Enhancements

- Form templates library
- Conditional questions (show/hide based on previous answers)
- File upload questions
- Date/time picker questions
- Form analytics and reporting
- Bulk form assignment to patients

