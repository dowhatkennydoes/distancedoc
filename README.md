# DistanceDoc

A full-stack telehealth SaaS platform built with Next.js 15, Google Cloud Platform, and modern web technologies.

## Tech Stack

### Frontend
- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS** + **Shadcn UI**

### Backend
- **Google Cloud Functions** (Node.js 20)
- **Cloud SQL Postgres** (via Prisma + GCP connector)
- **Firestore** (real-time chat)
- **Google Cloud Storage** (file uploads)
- **Vertex AI Gemini 1.5 Flash** (AI SOAP notes)
- **Vertex AI Speech-to-Text** (clinical transcription)
- **Stripe** (payments)
- **WebRTC + Xirsys TURN** (video visits)
- **Cloud Scheduler + Cloud Functions** (automations)

## GCP Configuration

- **Project ID**: distancedoc
- **Project Number**: 1060519861866

## Project Structure

```
DistanceDoc/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── (auth)/            # Authentication pages
│   └── (dashboard)/       # Dashboard pages
├── components/            # React components
│   └── ui/               # Shadcn UI components
├── db/                   # Database connections
│   ├── prisma.ts         # Prisma Client
│   └── firestore.ts      # Firestore client
├── lib/                  # Utility functions
│   ├── stripe.ts         # Stripe integration
│   └── webrtc.ts         # WebRTC configuration
├── gcp/                  # GCP service integrations
│   ├── storage.ts        # Cloud Storage
│   ├── vertex-ai.ts      # Vertex AI
│   └── speech-to-text.ts # Speech-to-Text
├── functions/            # Cloud Functions
│   └── src/
│       ├── scheduled/    # Scheduled functions
│       └── http/         # HTTP functions
└── prisma/               # Prisma schema
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Google Cloud SDK
- GCP project with billing enabled

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Initialize Prisma:
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. Set up Shadcn UI:
   ```bash
   npx shadcn@latest init
   ```

5. Run development server:
   ```bash
   npm run dev
   ```

### GCP Setup

1. Install Google Cloud SDK:
   ```bash
   # macOS
   brew install google-cloud-sdk
   ```

2. Authenticate with GCP:
   ```bash
   gcloud auth login
   ```

3. Set the project:
   ```bash
   gcloud config set project distancedoc
   ```

4. Enable required APIs:
   ```bash
   gcloud services enable cloudfunctions.googleapis.com
   gcloud services enable cloudsql.googleapis.com
   gcloud services enable firestore.googleapis.com
   gcloud services enable storage.googleapis.com
   gcloud services enable aiplatform.googleapis.com
   gcloud services enable speech.googleapis.com
   gcloud services enable cloudscheduler.googleapis.com
   ```

## Features

- 🔐 Authentication & Authorization
- 📅 Appointment Scheduling
- 🎥 Video Visits (WebRTC)
- 💬 Real-time Chat (Firestore)
- 📝 AI-Powered SOAP Notes (Vertex AI Gemini)
- 🎤 Clinical Transcription (Speech-to-Text)
- 📁 File Uploads (Cloud Storage)
- 💳 Payment Processing (Stripe)
- ⏰ Automated Reminders (Cloud Scheduler)

## Development

### Database

- Generate Prisma Client: `npm run db:generate`
- Push schema changes: `npm run db:push`
- Create migration: `npm run db:migrate`
- Open Prisma Studio: `npm run db:studio`

### Cloud Functions

Deploy functions from the `functions/` directory:
```bash
cd functions
npm install
gcloud functions deploy FUNCTION_NAME --runtime nodejs20 --trigger-http
```

## Configuration Files

- `gcp-config.json` - GCP project information
- `.env.example` - Environment variables template
- `prisma/schema.prisma` - Database schema
- `tailwind.config.ts` - Tailwind CSS configuration
- `next.config.js` - Next.js configuration

## TODO

See individual files for TODO comments describing intended functionality. Major areas:

- [ ] Complete authentication implementation
- [ ] Implement all API endpoints
- [ ] Set up GCP services and connections
- [ ] Configure Stripe webhooks
- [ ] Implement WebRTC video calls
- [ ] Add comprehensive error handling
- [ ] Implement HIPAA compliance measures
- [ ] Add testing suite
- [ ] Set up CI/CD pipeline

## License

Proprietary - DistanceDoc

