# Google Cloud Platform Services

This directory contains GCP service integrations.

## Services

- `storage.ts` - Google Cloud Storage for file uploads
- `vertex-ai.ts` - Vertex AI Gemini 1.5 Flash for SOAP note generation
- `speech-to-text.ts` - Google Cloud Speech-to-Text for clinical transcription
- `firestore.ts` - Firestore for real-time chat (in `db/` directory)

## Configuration

All services use the GCP project ID from `gcp-config.json`:
- Project ID: `distancedoc`
- Project Number: `1060519861866`

## TODO

- Add service account authentication
- Implement error handling and retry logic
- Add cost monitoring and usage tracking
- Implement caching where appropriate
- Add service health checks

