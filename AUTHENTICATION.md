# Authentication System - Collection-Based Architecture

## Overview

The authentication system uses **separate MongoDB collections** for different user types:

- `seekers` - For service seekers
- `providers` - For service providers
- `admins` - For administrators

## Database Collections

### Seekers Collection

```typescript
{
  _id: ObjectId,
  email: string,
  name: string,
  phone: string,
  passwordHash: string,
  emailVerified: boolean,
  phoneVerified: boolean,
  address: { line1, city, state, country, postalCode, landmark },
  createdAt: Date
}
```

### Providers Collection

```typescript
{
  _id: ObjectId,
  email: string,
  name: string,
  phone: string,
  passwordHash: string,
  emailVerified: boolean,
  phoneVerified: boolean,
  services: string[],
  pricing: number,
  location: string,
  documents: string[],
  createdAt: Date
}
```

### Admins Collection

```typescript
{
  _id: ObjectId,
  email: string,
  name: string,
  passwordHash: string,
  emailVerified: boolean,
  createdAt: Date
}
```

## Authentication Flows

### 1. Credentials Sign-in (Email/Password)

**Flow:**

```
1. User enters email and password
2. System checks collections in order:
   - seekers collection → if found, verify password & login as seeker
   - providers collection → if found, verify password & login as provider
   - admins collection → if found, verify password & login as admin
3. If email not found in any collection → Error: "NO_ACCOUNT"
4. If password incorrect → Error: "INVALID_CREDENTIALS"
5. On success → Redirect to role-specific dashboard
```

**Implementation:** `app/api/auth/[...nextauth]/route.ts`

### 2. Google OAuth Sign-in

**Flow:**

```
1. User clicks "Sign in with Google"
2. Google authentication completes
3. System checks if email exists in database:
   - getUserByEmail() checks: seekers → providers → admins
4. If email NOT found → Error: "NO_ACCOUNT_PLEASE_SIGNUP"
5. If email found → Login with detected role
6. Redirect to role-specific dashboard
```

**Important:** Google users MUST create an account through signup first!

### 3. Seeker Signup

**Flow:**

```
1. User fills seeker signup form
2. Verify email and phone via OTP
3. Check if email exists in any collection
4. Create new document in `seekers` collection
5. User can now sign in
```

**Implementation:** `app/api/signup/seeker/route.ts`

### 4. Provider Signup

**Flow:**

```
1. User fills provider signup form
2. Verify email and phone via OTP
3. Check if email exists in any collection
4. Create new document in `providers` collection with business info
5. User can now sign in
```

**Implementation:** `app/api/signup/provider/route.ts`

## Role-Based Routing

After successful authentication, users are redirected based on their role:

```
Seeker   → /seeker    (renders app/(dashboard)/seeker/page.tsx)
Provider → /provider  (renders app/(dashboard)/provider/page.tsx)
Admin    → /admin     (renders app/(dashboard)/admin/page.tsx)
```

**Implementation:** `proxy.ts` middleware

## Creating Admin Users

Admin users must be created manually using the provided script:

```bash
npx tsx scripts/create-admin.ts
```

This will prompt for:

- Email
- Name
- Password (minimum 8 characters)

The admin is then inserted into the `admins` collection.

## API Endpoints

### Authentication

- `POST /api/auth/signin` - Sign in with credentials or OAuth
- `POST /api/auth/signout` - Sign out

### Signup

- `POST /api/signup/seeker` - Register as seeker
- `POST /api/signup/provider` - Register as provider
- `POST /api/complete-signup` - Complete OAuth signup (choose role)

### OTP

- `POST /api/otp/request` - Request OTP for email/phone
- `POST /api/otp/verify` - Verify OTP code

## Database Functions

### User Lookup

```typescript
getUserByEmail(email) → UserWithRole | null
// Searches: seekers → providers → admins
// Returns user with role field set
```

### User Creation

```typescript
createSeeker(data) → Seeker
createProvider(data) → Provider
createAdmin(data) → Admin
```

### Utility

```typescript
emailExists(email) → boolean
// Checks if email exists in any collection
```

## Error Messages

| Error                      | Meaning                                         |
| -------------------------- | ----------------------------------------------- |
| `NO_ACCOUNT`               | Email not found in any collection               |
| `NO_ACCOUNT_PLEASE_SIGNUP` | Google user doesn't have an account             |
| `INVALID_CREDENTIALS`      | Incorrect password                              |
| `NO_PASSWORD_SET`          | Account exists but has no password (OAuth only) |
| `Email already in use`     | Email already registered                        |

## Migration from Old System

If you have existing data in a `users` collection, you'll need to:

1. Backup your data
2. Split users by role into separate collections:

   ```javascript
   // In MongoDB shell or script
   db.users.find({ role: "seeker" }).forEach((user) => {
     delete user.role;
     db.seekers.insertOne(user);
   });

   db.users.find({ role: "provider" }).forEach((user) => {
     delete user.role;
     db.providers.insertOne(user);
   });

   db.users.find({ role: "admin" }).forEach((user) => {
     delete user.role;
     db.admins.insertOne(user);
   });
   ```

3. Verify data integrity
4. Drop old `users` collection

## Security Notes

- Passwords are hashed with bcrypt (10 rounds)
- OTP verification required for signup
- Admin accounts can only be created via script (no public signup)
- Google OAuth users must have existing account
- All routes protected by middleware based on role
