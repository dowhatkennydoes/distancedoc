# SOAP Note Generation API

## Endpoint

`POST /api/ai/soap`

## Overview

Generates structured SOAP (Subjective, Objective, Assessment, Plan) notes using Gemini 1.5 Flash with safety guardrails to prevent hallucinating diagnoses.

## Authentication

Requires authentication token in Authorization header:
```
Authorization: Bearer <token>
```

## Request Body

```typescript
{
  transcript: string                    // Required: Clinical transcription
  symptoms?: string[]                   // Optional: Reported symptoms
  patientDemographics: {
    age?: number                        // Optional: Patient age
    gender?: string                     // Optional: Patient gender
    medicalHistory?: string            // Optional: Medical history
    allergies?: string[]               // Optional: Known allergies
    currentMedications?: string[]      // Optional: Current medications
  }
  vitals?: {                           // Optional: Vital signs
    temperature?: number               // Fahrenheit
    bloodPressure?: string             // e.g., "120/80"
    heartRate?: number                 // bpm
    respiratoryRate?: number          // per minute
    oxygenSaturation?: number         // percentage (0-100)
    weight?: number                    // pounds
    height?: string                    // e.g., "5'10""
  }
  intakeFormAnswers?: Record<string, any>  // Optional: Intake form responses
}
```

## Response

```typescript
{
  subjective: string      // Patient's reported symptoms and history
  objective: string        // Clinical observations and findings
  assessment: string       // Clinical assessment and diagnoses
  plan: string            // Treatment plan and instructions
  risks: string[]         // Potential risks or complications
  followUp: string        // Follow-up recommendations
  billingCodes: string[]  // ICD-10 and CPT codes
}
```

## Example Request

```json
{
  "transcript": "Patient presents with chest pain that started 2 hours ago. Pain is sharp, 7/10 severity, radiates to left arm. No shortness of breath. Denies nausea. Blood pressure is 140/90, heart rate 88 bpm regular.",
  "symptoms": ["chest pain", "left arm pain"],
  "patientDemographics": {
    "age": 55,
    "gender": "male",
    "medicalHistory": "Hypertension, diabetes",
    "allergies": ["penicillin"],
    "currentMedications": ["lisinopril 10mg daily", "metformin 500mg twice daily"]
  },
  "vitals": {
    "temperature": 98.6,
    "bloodPressure": "140/90",
    "heartRate": 88,
    "respiratoryRate": 16,
    "oxygenSaturation": 98
  }
}
```

## Example Response

```json
{
  "subjective": "55-year-old male presents with chest pain that started 2 hours ago. Pain is sharp, 7/10 severity, radiates to left arm. No shortness of breath. Denies nausea. Medical history includes hypertension and diabetes. Current medications: lisinopril 10mg daily, metformin 500mg twice daily. Allergic to penicillin.",
  "objective": "Vital signs: Blood pressure 140/90, heart rate 88 bpm regular, respiratory rate 16/min, oxygen saturation 98%, temperature 98.6°F. Physical examination findings documented in transcript.",
  "assessment": "Chest pain with radiation to left arm. Differential diagnosis includes: 1) Acute coronary syndrome - rule out, 2) Musculoskeletal pain, 3) Gastroesophageal reflux. Requires further evaluation including EKG and cardiac enzymes.",
  "plan": "1. Order EKG and cardiac enzymes (troponin) to rule out acute coronary syndrome. 2. Consider chest X-ray if indicated. 3. Monitor vital signs. 4. If cardiac workup negative, consider GI evaluation or musculoskeletal assessment. 5. Follow up in 24-48 hours or sooner if symptoms worsen.",
  "risks": [
    "Potential for acute coronary syndrome requiring immediate intervention",
    "Risk of delayed diagnosis if not properly evaluated"
  ],
  "followUp": "Follow up in 24-48 hours with results of cardiac workup. Return immediately if chest pain worsens or new symptoms develop.",
  "billingCodes": [
    "R06.02 - Shortness of breath",
    "I10 - Essential (primary) hypertension",
    "E11.9 - Type 2 diabetes mellitus without complications",
    "99213 - Office or other outpatient visit"
  ]
}
```

## Safety Features

### 1. **No Hallucination Guardrails**
- Only includes information explicitly stated or reasonably inferred
- Does not invent diagnoses, symptoms, or findings
- States uncertainty as "rule out" or differential diagnoses

### 2. **Low Temperature (0.2)**
- Reduces randomness for more accurate, consistent output
- Focuses on factual information from provided data

### 3. **JSON Mode**
- Ensures structured, parseable output
- Prevents formatting issues

### 4. **Safety Settings**
- Blocks potentially harmful medical content
- Filters dangerous content at medium threshold

### 5. **Validation**
- Input validation using Zod schema
- Response structure validation
- Error handling for malformed JSON

## Model Configuration

- **Model**: Gemini 1.5 Flash
- **Temperature**: 0.2 (low for accuracy)
- **Max Output Tokens**: 2048
- **Response Format**: JSON (application/json)
- **Safety**: Medium threshold for medical and dangerous content

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation error: transcript is required"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to generate valid SOAP note format"
}
```

## Usage Example (JavaScript)

```javascript
const response = await fetch('/api/ai/soap', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    transcript: 'Patient reports headache for 3 days...',
    symptoms: ['headache', 'nausea'],
    patientDemographics: {
      age: 35,
      gender: 'female',
    },
    vitals: {
      temperature: 98.6,
      bloodPressure: '120/80',
    },
  }),
})

const soapNote = await response.json()
console.log(soapNote)
```

## Best Practices

1. **Provide Complete Information**: Include all available clinical data for best results
2. **Review Output**: Always review generated SOAP notes before finalizing
3. **Validate Billing Codes**: Verify ICD-10 and CPT codes are appropriate
4. **Check for Hallucinations**: Review assessment section to ensure no invented diagnoses
5. **Update as Needed**: Manually edit SOAP notes if AI output needs correction

## Limitations

- AI-generated content should be reviewed by a healthcare provider
- Billing codes should be verified for accuracy
- May not capture all nuances of complex cases
- Should not replace clinical judgment

## Integration with TelehealthRoom

This endpoint can be called after a consultation to generate SOAP notes from:
- Real-time transcription (from `/api/stt/stream`)
- Patient intake forms
- Documented vitals
- Reported symptoms

Example integration:
```typescript
// After consultation ends
const transcript = await getTranscription(consultationId)
const soapNote = await generateSOAPNote({
  transcript: formatTranscription(transcript),
  symptoms: intakeForm.symptoms,
  patientDemographics: patient.demographics,
  vitals: consultation.vitals,
  intakeFormAnswers: intakeForm.answers,
})
```

