# Firebase Configuration

## Browser API Key

Your Firebase browser API key has been configured:
- **API Key**: `AIzaSyA9GT-BgtoIK4DumptQ5a5y9hpO00JIHtc`
- **Project ID**: `distancedoc`

## Environment Variables

The Firebase configuration is stored in `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_CONFIG={"projectId":"distancedoc","apiKey":"AIzaSyA9GT-BgtoIK4DumptQ5a5y9hpO00JIHtc"}
```

## Usage

The Firebase client is automatically initialized in `lib/firestore/client.ts`:

```typescript
import { getFirestoreClient } from '@/lib/firestore/client'

const firestore = getFirestoreClient()
// Use firestore for real-time listeners, queries, etc.
```

## Features Enabled

With the Firebase API key configured, you can now:

1. **Real-time Chat**: Firestore real-time listeners for chat messages
2. **WebRTC Signaling**: Firestore-based signaling for WebRTC connections
3. **Real-time Updates**: Live updates for appointments, notifications, etc.

## Security

⚠️ **Important**: The browser API key is safe to expose in client-side code. It's restricted by:
- Firebase Security Rules
- API key restrictions (configure in Firebase Console)
- Domain restrictions (if configured)

## Additional Configuration (Optional)

If you need additional Firebase services, you can add more fields to the config:

```bash
NEXT_PUBLIC_FIREBASE_CONFIG={"projectId":"distancedoc","apiKey":"AIzaSyA9GT-BgtoIK4DumptQ5a5y9hpO00JIHtc","authDomain":"distancedoc.firebaseapp.com","storageBucket":"distancedoc.appspot.com"}
```

## Testing

To verify Firebase is working:

1. Check browser console for Firebase initialization
2. Test Firestore queries in your components
3. Verify real-time listeners are working
4. Check Firestore security rules are configured

## Troubleshooting

### "Firebase API key not configured" warning
- Ensure `.env.local` has `NEXT_PUBLIC_FIREBASE_CONFIG`
- Restart dev server after adding env vars
- Check the config JSON is valid

### Firestore connection errors
- Verify API key is correct
- Check Firestore is enabled in Firebase Console
- Verify security rules allow access
- Check network tab for API errors

### Real-time listeners not working
- Ensure Firestore is enabled
- Check security rules allow read access
- Verify you're using client-side Firebase SDK (not server SDK)
- Check browser console for errors

