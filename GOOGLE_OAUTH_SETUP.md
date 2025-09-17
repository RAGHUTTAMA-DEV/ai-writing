# Google OAuth Setup Guide

## Overview
Your AI Writing Platform now supports Google OAuth authentication alongside traditional email/password login. Users can sign in with their Google accounts for a seamless experience.

## Required Environment Variables

Add the following environment variables to your `.env` file:

### Backend (.env in root directory)
```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Session Configuration (required for Passport)
SESSION_SECRET=your_secure_session_secret_here

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:5173

# Existing variables (make sure these are set)
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
DATABASE_URL=your_postgresql_connection_string
```

### Frontend (if needed - client/.env)
```env
# Backend URL
VITE_API_URL=http://localhost:5000
```

## Google Cloud Console Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google+ API**
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API" or "Google People API"
   - Enable the API

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Select "Web application"
   - Add authorized JavaScript origins:
     - `http://localhost:5173` (frontend)
     - `http://localhost:5000` (backend)
   - Add authorized redirect URIs:
     - `http://localhost:5000/api/auth/google/callback`

4. **Get Your Credentials**
   - Copy the Client ID and Client Secret
   - Add them to your `.env` file

## Database Changes

The following changes have been made to your database:

1. **User model updates:**
   - Added `googleId` field (optional, unique)
   - Made `password` field optional (for Google-only users)

2. **Migration applied:**
   - Run `npx prisma migrate deploy` in production
   - The migration `add_google_oauth` has been created and applied

## Authentication Flow

### Traditional Login
- Users can still log in with email/password as before
- No changes to existing functionality

### Google OAuth Login
1. User clicks "Continue with Google" button
2. Redirected to Google OAuth consent screen
3. After approval, redirected to backend callback URL
4. Backend processes OAuth token and creates/updates user
5. User redirected to frontend with JWT token
6. Frontend stores token and user information

### Account Linking
- If a user already exists with the same email, their Google account will be linked
- Existing users can use both login methods

## Frontend Routes

Add the auth callback route to your React Router setup:

```tsx
import { AuthCallback } from './pages/AuthCallback';

// In your router configuration
<Route path="/auth/callback" element={<AuthCallback />} />
```

## Security Notes

1. **Session Secret**: Use a strong, random session secret
2. **HTTPS in Production**: Always use HTTPS in production
3. **Environment Variables**: Never commit `.env` files to version control
4. **Client Secret**: Keep your Google Client Secret secure and never expose it in frontend code

## Testing

1. Start your backend: `npm run dev`
2. Start your frontend: `cd client && npm run dev`
3. Navigate to the login page
4. Click "Continue with Google"
5. Complete the OAuth flow
6. Verify successful authentication

## Troubleshooting

### Common Issues:

1. **"redirect_uri_mismatch" error**
   - Ensure your callback URL in Google Console matches exactly
   - Check for trailing slashes and protocol (http/https)

2. **"Client ID not found" error**
   - Verify your GOOGLE_CLIENT_ID is correctly set
   - Check if the Google project is active

3. **Session errors**
   - Make sure SESSION_SECRET is set
   - Clear browser cookies and try again

4. **Token verification failed**
   - Ensure JWT_SECRET is set and consistent
   - Check if user profile fetch is working

### Debug Tips:

1. Check browser developer tools for network errors
2. Review backend logs for authentication errors
3. Verify Google Cloud Console settings
4. Test with a simple OAuth flow first

## Production Deployment

When deploying to production:

1. Update Google Cloud Console with production URLs
2. Use HTTPS for all OAuth URLs
3. Set secure session cookies
4. Use strong, unique secrets for production
5. Consider using environment variable management tools

## API Endpoints

New endpoints added for Google OAuth:

- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Handle OAuth callback
- `GET /api/auth/google/success` - OAuth success endpoint (JSON response)

Existing endpoints remain unchanged.
