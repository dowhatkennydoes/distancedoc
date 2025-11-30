# Supabase CLI Setup Complete

## What Was Done

✅ **Project Linked**: Connected to Supabase project `vhwvejtjrajjsluutrqv` (DistanceDoc)  
✅ **Migration Pushed**: `001_user_roles.sql` applied to remote database  
✅ **TypeScript Types Generated**: `lib/supabase/database.types.ts` created  
✅ **Clients Updated**: All Supabase clients now use generated types

## Project Details

- **Project Reference**: `vhwvejtjrajjsluutrqv`
- **Region**: `us-east-2`
- **Organization**: `aengydcvqkmmijkujfog`

## Database Schema

The `user_roles` table has been created with:
- Row Level Security (RLS) enabled
- Policies for user access
- Indexes for performance
- Auto-updating timestamps

## Next Steps

### 1. Get Environment Variables

Run this command to get your Supabase connection details:

```bash
supabase status --linked -o env
```

Or get them from the Supabase Dashboard:
- Go to Project Settings → API
- Copy the URL and anon key

### 2. Update .env File

Add these to your `.env`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vhwvejtjrajjsluutrqv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 3. Test Authentication

1. Start your dev server: `npm run dev`
2. Visit `/signup` to create a test account
3. Visit `/login` to test authentication

### 4. Local Development (Optional)

If you want to run Supabase locally with Docker:

```bash
# Start local Supabase (requires Docker)
supabase start

# This will give you local URLs:
# API URL: http://127.0.0.1:54321
# Studio: http://127.0.0.1:54323
```

For local development, update `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
```

## Useful Commands

```bash
# View project status
supabase status --linked

# Push new migrations
supabase db push

# Generate TypeScript types
supabase gen types typescript --linked > lib/supabase/database.types.ts

# View migration history
supabase migration list

# Open Supabase Studio (web UI)
supabase studio

# Reset local database
supabase db reset
```

## Migration Applied

The `001_user_roles.sql` migration creates:
- `user_roles` table with role and approval tracking
- RLS policies for security
- Indexes for performance
- Auto-update triggers

## Type Safety

All Supabase clients now use the generated TypeScript types from `database.types.ts`. This provides:
- Type-safe database queries
- Autocomplete for table/column names
- Compile-time error checking

## Verification

To verify everything is working:

1. Check the migration was applied:
   ```bash
   supabase migration list --linked
   ```

2. Test database connection:
   ```bash
   supabase db remote commit
   ```

3. View tables in Supabase Studio:
   ```bash
   supabase studio
   ```

## Troubleshooting

### If migration fails:
- Check Supabase Dashboard → Database → Migrations
- Verify RLS policies are correct
- Check for syntax errors in migration SQL

### If types are outdated:
```bash
supabase gen types typescript --linked > lib/supabase/database.types.ts
```

### If linking fails:
```bash
supabase link --project-ref vhwvejtjrajjsluutrqv
```

## Security Notes

- ✅ RLS is enabled on `user_roles` table
- ✅ Users can only view their own role
- ✅ Service role has full access for API operations
- ⚠️ Never commit service role key to git
- ⚠️ Use environment variables for all keys

