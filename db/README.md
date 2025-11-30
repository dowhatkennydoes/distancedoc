# Database

This directory contains database connection and configuration files.

## Files

- `prisma.ts` - Prisma Client for Cloud SQL Postgres
- `firestore.ts` - Firestore client for real-time chat

## Database Setup

### Cloud SQL Postgres
- Configure connection string in `.env` using GCP connector format
- Run migrations: `npm run db:migrate`
- Generate Prisma Client: `npm run db:generate`

### Firestore
- Configure in GCP Console
- Set up collections: `chats`, `messages`, `notifications`
- Configure security rules for HIPAA compliance

## TODO

- Add database migration scripts
- Implement connection pooling
- Add query optimization
- Set up database backups
- Add monitoring and alerting

