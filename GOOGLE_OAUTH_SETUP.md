# Stack Auth Setup for Neon Authentication

This guide explains how to set up Stack Auth authentication for secure Neon database access in the budget application.

## Overview

The Stack Auth integration allows users to:
- Authenticate using Stack Auth (supports Google, GitHub, email/password, etc.)
- Securely connect to personal Neon PostgreSQL databases
- Manage user-specific data isolation
- Use custom database connection strings

## Google Cloud Console Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID for later use

### 2. Enable Required APIs

1. Navigate to **APIs & Services** > **Library**
2. Enable the following APIs:
   - **Google Identity Services API** (for OAuth)
   - **Google+ API** (for user profile info)

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth 2.0 Client IDs**
3. Choose **Web application** as the application type
4. Configure the OAuth consent screen if prompted:
   - Add your application name
   - Add your email address
   - Add authorized domains (e.g., `localhost`, your production domain)

5. Set **Authorized JavaScript origins**:
   ```
   http://localhost:5173  (for Vite dev server)
   http://localhost:5000  (for Express server)
   https://yourdomain.com (for production)
   ```

6. Set **Authorized redirect URIs**:
   ```
   http://localhost:5173
   http://localhost:5000
   https://yourdomain.com
   ```

7. Click **Create** and copy the generated:
   - **Client ID** (looks like: `xxx.apps.googleusercontent.com`)
   - **Client Secret** (keep this secure)

### 4. Create API Key (Optional)

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **API Key**
3. Copy the generated API key
4. Click **Restrict Key** and limit to required APIs

## Environment Configuration

Update your `.env` file with the Google OAuth credentials:

```bash
# Google OAuth Configuration for Neon Authentication
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key

# Optional: For additional Google services
VITE_GOOGLE_DRIVE_API_KEY=your-drive-api-key
```

**Important:** 
- Use `VITE_` prefix for client-side environment variables
- Never commit real credentials to version control
- Keep your client secret secure on the server side

## Testing the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to **Settings** > **Advanced**

3. Look for the **Neon Database Authentication** section

4. Click **"Logga in med Google"** (Sign in with Google)

5. You should see the Google OAuth popup

6. After successful authentication, you can configure database connections

## Security Considerations

### Client-Side Security
- Google Client ID is safe to expose in client-side code
- API keys should be restricted to specific domains/IPs
- Never expose client secrets in frontend code

### Server-Side Security
- Verify Google JWT tokens on the server
- Store connection strings encrypted
- Implement proper user session management
- Use HTTPS in production

### Database Security
- Use separate database schemas per user
- Implement row-level security (RLS) in PostgreSQL
- Store sensitive data encrypted
- Regular security audits

## Troubleshooting

### Common Issues

1. **"Google Auth not initialized"**
   - Check if `VITE_GOOGLE_CLIENT_ID` is set
   - Verify the Client ID format
   - Check browser console for errors

2. **"Redirect URI mismatch"**
   - Ensure redirect URIs match exactly in Google Console
   - Include the correct port numbers
   - Check for trailing slashes

3. **"Access blocked"**
   - Configure OAuth consent screen
   - Add test users if in development mode
   - Verify authorized domains

4. **CORS errors**
   - Ensure JavaScript origins are configured
   - Check if domains match exactly
   - Verify HTTPS/HTTP protocols

### Debug Mode

Enable debug logging by adding to your environment:
```bash
DEBUG=google-auth
```

## Production Deployment

### Environment Variables
```bash
VITE_GOOGLE_CLIENT_ID=your-production-client-id
VITE_GOOGLE_API_KEY=your-production-api-key
NODE_ENV=production
```

### Domain Configuration
1. Update authorized domains in Google Console
2. Set production redirect URIs
3. Configure OAuth consent screen for production
4. Enable SSL/TLS certificates

## Integration with Neon

### User Database Creation
When a user authenticates with Google:

1. **User Registration**
   - Create user record with Google ID
   - Generate unique database schema/user
   - Set up initial permissions

2. **Database Connection**
   - Use user-specific connection strings
   - Implement connection pooling
   - Handle connection failures gracefully

3. **Data Isolation**
   - Separate schemas per user
   - Row-level security policies
   - Backup and restore per user

### Example Neon Setup
```sql
-- Create user-specific schema
CREATE SCHEMA user_${google_user_id};

-- Set up row-level security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create policy for user data isolation
CREATE POLICY user_data_policy ON transactions 
  FOR ALL TO authenticated_user
  USING (user_id = current_setting('app.current_user_id'));
```

## Support

For issues with this integration:
1. Check the browser console for errors
2. Verify all environment variables are set
3. Test OAuth flow in incognito mode
4. Review Google Cloud Console audit logs

For Google OAuth specific issues:
- [Google Identity Services Documentation](https://developers.google.com/identity/gsi/web)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)