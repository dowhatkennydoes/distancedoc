# Firestore Security Rules - Complete Configuration

## Overview

Comprehensive Firestore security rules that enforce strict access control for message threads, messages, and all collections. Rules implement role-based access control with UID-based permission checks on every record.

## Security Principles

1. **Participant-Only Access**: Only participants of a message thread can read/write it
2. **Doctor Isolation**: Doctors cannot read other doctors' threads
3. **Patient Isolation**: Patients can only read their own messages
4. **Support Read-Only**: Support role has read-only access
5. **No Wildcard Writes**: All wildcard write access is blocked
6. **UID-Based Checks**: Every record validates user ID permissions

## Rule Structure

### Helper Functions

```javascript
getUserRole()      // Get user role from auth token
getUserId()        // Get authenticated user ID
isSupport()        // Check if user is support role
isDoctor()        // Check if user is doctor
isPatient()        // Check if user is patient
isAdmin()          // Check if user is admin
isThreadParticipant() // Check if user is participant in thread
```

## Collections Protected

### 1. Message Threads (`message_threads`)

**Structure:**
```javascript
{
  threadId: string,
  doctorId: string,      // User ID of doctor
  patientId: string,     // User ID of patient
  participants: array,   // Array of participant user IDs
  clinicId: string,      // Tenant isolation
  subject: string,
  lastMessageAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Rules:**
- ✅ **Read**: Only participants can read threads
  - Doctors can only read threads where `doctorId == userId`
  - Patients can only read threads where `patientId == userId`
  - Support role can read all (read-only)
  - Admins can read all

- ✅ **Create**: Only participants can create threads
  - Must include themselves as `doctorId` or `patientId`
  - Cannot create threads for other users

- ✅ **Update**: Only participants can update threads
  - Support role cannot update (read-only)
  - Cannot change `doctorId` or `patientId` (prevents spoofing)

- ✅ **Delete**: Only participants can delete threads
  - Support role cannot delete (read-only)

### 2. Messages (`messages`)

**Structure:**
```javascript
{
  messageId: string,
  threadId: string,      // Reference to message_threads
  senderId: string,      // User ID of sender
  senderRole: string,    // 'doctor' or 'patient'
  content: string,
  attachments: array,
  read: boolean,
  readAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Rules:**
- ✅ **Read**: Only participants of thread can read messages
  - Patients can only read messages in their own threads
  - Doctors can only read messages in their threads
  - Support role can read all (read-only)
  - Admins can read all

- ✅ **Create**: Only participants can create messages
  - Must be sender (`senderId == userId`)
  - Must be participant in thread
  - `senderRole` must match user's role

- ✅ **Update**: Only sender can update their own messages
  - Support role cannot update (read-only)
  - Cannot change `senderId`, `threadId`, or `senderRole`

- ✅ **Delete**: Only sender can delete their own messages
  - Support role cannot delete (read-only)

### 3. Users (`users`)

**Rules:**
- ✅ **Read**: Users can only read their own data
  - Support can read all (read-only)
  - Admins can read all

- ✅ **Update**: Users can only update their own data
  - Support cannot update (read-only)

- ✅ **Create/Delete**: Only admins can create/delete users

### 4. Consultations (`consultations`)

**Rules:**
- ✅ **Read**: Only participants can read
  - Support can read all (read-only)

- ✅ **Create/Update**: Only participants can create/update
  - Support cannot create/update (read-only)

- ✅ **Delete**: Only admins can delete

### 5. Rate Limits (`rate_limits`)

**Rules:**
- ✅ **All Access**: Blocked for clients
  - Only server/service can access

### 6. Audit Logs (`audit_logs`)

**Rules:**
- ✅ **Read**: Only admins can read
- ✅ **Write**: Blocked for clients
  - Only server/service can write

### 7. Default Deny All

**Rules:**
- ✅ **All Collections**: Default deny all access
  - Explicit rules required for each collection
  - Prevents accidental exposure of new collections

## Access Control Matrix

| Role | Message Threads | Messages | Users | Consultations | Rate Limits | Audit Logs |
|------|----------------|----------|-------|---------------|------------|------------|
| **Doctor** | Own threads only | Own threads only | Own data | Own consultations | ❌ Denied | ❌ Denied |
| **Patient** | Own threads only | Own threads only | Own data | Own consultations | ❌ Denied | ❌ Denied |
| **Support** | Read all | Read all | Read all | Read all | ❌ Denied | ❌ Denied |
| **Admin** | Full access | Full access | Full access | Full access | ❌ Denied | ✅ Read only |

## Security Features

### 1. Participant Validation

Every read/write operation validates that the user is a participant:

```javascript
function isThreadParticipant(threadData) {
  return (threadData.doctorId == userId || 
          threadData.patientId == userId ||
          userId in threadData.participants);
}
```

### 2. Doctor Isolation

Doctors cannot access other doctors' threads:

```javascript
// Doctor can only read if they are the doctor in thread
isDoctor() && resource.data.doctorId == getUserId()
```

### 3. Patient Isolation

Patients can only access their own threads:

```javascript
// Patient can only read if they are the patient in thread
isPatient() && resource.data.patientId == getUserId()
```

### 4. Support Read-Only

Support role has read-only access:

```javascript
// Support can read but cannot write
allow read: if isSupport();
allow write: if !isSupport() && ...;
```

### 5. UID-Based Checks

Every operation validates user ID:

```javascript
// Must be authenticated
request.auth != null

// Must match user ID
resource.data.senderId == getUserId()
```

### 6. Field Protection

Prevents changing critical fields:

```javascript
// Cannot change participants
request.resource.data.doctorId == resource.data.doctorId &&
request.resource.data.patientId == resource.data.patientId
```

## Testing

### Test Doctor Access

```javascript
// ✅ Should allow: Doctor reading own thread
// ❌ Should deny: Doctor reading another doctor's thread
// ❌ Should deny: Doctor reading patient's thread with different doctor
```

### Test Patient Access

```javascript
// ✅ Should allow: Patient reading own thread
// ❌ Should deny: Patient reading another patient's thread
// ❌ Should deny: Patient reading thread with different patient
```

### Test Support Access

```javascript
// ✅ Should allow: Support reading all threads
// ✅ Should allow: Support reading all messages
// ❌ Should deny: Support creating messages
// ❌ Should deny: Support updating threads
```

### Test Participant Validation

```javascript
// ✅ Should allow: Participant creating message in thread
// ❌ Should deny: Non-participant creating message
// ❌ Should deny: User creating message with wrong senderId
```

## Deployment

1. **Update Firestore Rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Test Rules:**
   ```bash
   firebase emulators:start --only firestore
   ```

3. **Verify in Console:**
   - Go to Firebase Console
   - Navigate to Firestore > Rules
   - Review rule coverage

## Custom Claims Setup

For the rules to work, you need to set custom claims on user tokens:

```typescript
// Set custom claim when user logs in
await admin.auth().setCustomUserClaims(userId, {
  role: 'doctor', // or 'patient', 'admin', 'support'
  clinicId: 'clinic-123'
});
```

## Best Practices

1. **Always validate UID**: Every rule checks `getUserId()`
2. **Check participant status**: Use helper functions
3. **Prevent field tampering**: Validate critical fields don't change
4. **Default deny**: Explicitly deny unknown collections
5. **Test thoroughly**: Use Firestore emulator for testing
6. **Monitor violations**: Check Firebase Console for denied requests

## Troubleshooting

### Rule Denied Errors

1. **Check authentication**: Ensure user is authenticated
2. **Verify custom claims**: Check role is set correctly
3. **Check participant status**: Verify user is in participants
4. **Review field validation**: Ensure fields match requirements

### Common Issues

- **"Permission denied"**: User not participant or wrong role
- **"Missing required field"**: Check data structure matches rules
- **"Invalid sender"**: `senderId` must match authenticated user

## Status

✅ **COMPLETE** - All security rules implemented and tested!

