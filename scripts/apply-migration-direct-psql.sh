#!/bin/bash

# Direct psql migration with SSL
set -e

DB_HOST="db.vhwvejtjrajjsluutrqv.supabase.co"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="postgres"
DB_PASSWORD='$DistanceDoc2423'

export PGPASSWORD="$DB_PASSWORD"

# Try with SSL
psql "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require" \
    -f supabase/migrations/002_add_clinic_id.sql \
    -v ON_ERROR_STOP=1

unset PGPASSWORD

