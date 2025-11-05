# Picscripterai - Social Media Management Backend

A comprehensive Node.js + TypeScript backend for managing OAuth 2.0 integrations and scheduled content posting across 7 major social media platforms.

## Features

- 🔐 **Secure Authentication**: JWT-based user authentication with bcrypt password hashing
- 🔗 **OAuth 2.0 Integration**: Connect to Instagram, TikTok, Twitter/X, LinkedIn, Pinterest, YouTube, and Facebook
- 🔒 **Token Security**: AES-256-GCM encryption for access/refresh tokens at rest
- 🔄 **Automatic Token Refresh**: Smart token refresh logic to maintain active connections
- 📅 **Post Scheduling**: BullMQ + Redis-powered job queue with cron-like scheduling
- 🚀 **Multi-Platform Publishing**: Platform-specific publishing flows for all 7 supported platforms
- 🔁 **Retry Logic**: Exponential backoff with configurable attempts for failed posts
- 📊 **Job Tracking**: Comprehensive logging of all publish attempts and status
- ⚡ **Idempotency**: Client post IDs prevent duplicate submissions

## Supported Platforms

| Platform | Features | OAuth Flow | Notes |
|----------|----------|------------|-------|
| **Instagram** | Image/Video posts with captions | Authorization Code + PKCE | Requires Facebook Business Page |
| **TikTok** | Video posts with metadata | Authorization Code + PKCE | Content Posting API |
| **Twitter/X** | Text tweets (media requires elevated access) | OAuth 2.0 | May require paid tier for media |
| **LinkedIn** | Member posts with text/images | OAuth 2.0 | Professional network posting |
| **Pinterest** | Pin creation on boards | OAuth 2.0 | Requires board ID |
| **YouTube** | Video uploads | OAuth 2.0 + Resumable Upload | Note quota limits |
| **Facebook** | Page posts with photos/text | Authorization Code | Pages API |

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys and secrets

# Push database schema
npm run db:push

# Run database migrations (if needed)
npm run db:push --force
```

## Environment Variables

### Required Secrets

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/picscripterai

# Security (generate random secure strings)
JWT_SECRET=your-random-jwt-secret-min-32-chars
ENCRYPTION_KEY=your-32-byte-hex-encryption-key  # Use: openssl rand -hex 32
SESSION_SECRET=your-session-secret

# Redis (for job queue)
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGIN=http://localhost:5000
```

### Platform OAuth Credentials

See [OAuth Setup Guide](#oauth-setup-guide) below for detailed instructions on obtaining these credentials.

```bash
# Instagram (via Facebook)
INSTAGRAM_CLIENT_ID=your-instagram-client-id
INSTAGRAM_CLIENT_SECRET=your-instagram-client-secret

# TikTok
TIKTOK_CLIENT_KEY=your-tiktok-client-key
TIKTOK_CLIENT_SECRET=your-tiktok-client-secret

# Twitter/X
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret

# LinkedIn
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret

# Pinterest
PINTEREST_APP_ID=your-pinterest-app-id
PINTEREST_APP_SECRET=your-pinterest-app-secret

# YouTube (via Google)
YOUTUBE_CLIENT_ID=your-youtube-client-id
YOUTUBE_CLIENT_SECRET=your-youtube-client-secret

# Facebook
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
```

## Running the Application

```bash
# Start the API server (development)
npm run dev

# Start the background worker (separate terminal)
NODE_ENV=development tsx server/worker.ts

# Production
npm start  # Starts API
NODE_ENV=production node dist/worker.js  # Starts worker (after building with npm run build)
```

## OAuth Setup Guide

### 1. Instagram (via Facebook)

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or use existing
3. Add **Instagram Basic Display** or **Instagram Graph API** product
4. Configure OAuth redirect URI: `http://localhost:5000/api/callback/instagram`
5. Required scopes: `instagram_basic`, `instagram_content_publish`
6. Note: Requires a Facebook Business Page linked to Instagram Business/Creator account

### 2. TikTok

1. Visit [TikTok Developers](https://developers.tiktok.com/)
2. Register as a developer and create app
3. Apply for Content Posting API access
4. OAuth redirect URI: `http://localhost:5000/api/callback/tiktok`
5. Required scopes: `video.upload`, `video.publish`

### 3. Twitter/X

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new project and app
3. Enable OAuth 2.0
4. OAuth redirect URI: `http://localhost:5000/api/callback/twitter`
5. Required scopes: `tweet.read`, `tweet.write`, `users.read`
6. ⚠️ Note: Media uploads require **Elevated** access (paid tier)

### 4. LinkedIn

1. Visit [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Create a new app
3. Request access to **Share on LinkedIn** product
4. OAuth redirect URI: `http://localhost:5000/api/callback/linkedin`
5. Required scopes: `w_member_social`

### 5. Pinterest

1. Go to [Pinterest Developers](https://developers.pinterest.com/)
2. Create a new app
3. OAuth redirect URI: `http://localhost:5000/api/callback/pinterest`
4. Required scopes: `boards:read`, `pins:write`
5. Note: Requires board ID in post options

### 6. YouTube (via Google)

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **YouTube Data API v3**
4. Create OAuth 2.0 credentials
5. OAuth redirect URI: `http://localhost:5000/api/callback/youtube`
6. Required scopes: `https://www.googleapis.com/auth/youtube.upload`
7. ⚠️ Note: YouTube has daily quota limits (10,000 units/day by default)

### 7. Facebook

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create app or use existing
3. Add **Facebook Login** product
4. OAuth redirect URI: `http://localhost:5000/api/callback/facebook`
5. Required scopes: `pages_manage_posts`, `pages_read_engagement`

## API Endpoints

### Authentication

```bash
# Sign up
POST /api/auth/signup
Body: { "email": "user@example.com", "password": "password123" }

# Login
POST /api/auth/login
Body: { "email": "user@example.com", "password": "password123" }
Returns: { "token": "jwt-token", "user": {...} }

# Logout
POST /api/auth/logout
Headers: Authorization: Bearer {token}
```

### Platform Connections

```bash
# List connections
GET /api/connections
Headers: Authorization: Bearer {token}

# Start OAuth flow
GET /api/connect/:platform
Headers: Authorization: Bearer {token}
Returns: { "redirectUrl": "https://platform.com/oauth..." }

# OAuth callback (handled automatically)
GET /api/callback/:platform?code=xxx&state=xxx

# Disconnect platform
POST /api/disconnect/:platform
Headers: Authorization: Bearer {token}
```

### Posts

```bash
# Publish immediately
POST /api/posts
Headers: Authorization: Bearer {token}
Body: {
  "platform": "facebook",
  "caption": "Hello world!",
  "media": {
    "type": "image",
    "url": "https://example.com/image.jpg"
  },
  "options": {}  # Platform-specific options
}

# Schedule for later
POST /api/schedule
Headers: Authorization: Bearer {token}
Body: {
  "platform": "instagram",
  "caption": "Scheduled post",
  "media": { "type": "image", "url": "https://..." },
  "scheduledAtISO": "2025-01-15T10:00:00Z",
  "options": {}
}

# Get all posts
GET /api/posts
Headers: Authorization: Bearer {token}

# Get post status
GET /api/posts/:id/status
Headers: Authorization: Bearer {token}
Returns: {
  "status": "published",
  "externalId": "platform-post-id",
  "externalUrl": "https://platform.com/post/...",
  "logs": [...]
}
```

### Testing Endpoint

```bash
# Quick Facebook post (for testing)
POST /post_to_fb
Headers: Authorization: Bearer {token}
Body: { "message": "Test post from Picscripterai 🚀" }
```

### Health Checks

```bash
# Basic health
GET /healthz

# Ready check (includes DB)
GET /readyz
```

## Platform-Specific Options

### Instagram
```javascript
{
  "options": {
    "igUserId": "instagram-user-id"  // Optional, defaults to "me"
  }
}
```

### TikTok
```javascript
{
  "options": {
    "privacyLevel": "PUBLIC_TO_EVERYONE",  // or "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"
    "disableComment": false,
    "disableDuet": false,
    "disableStitch": false
  }
}
```

### Twitter/X
```javascript
{
  "options": {
    "replySettings": "everyone"  // or "mentionedUsers", "following"
  }
}
```

### LinkedIn
```javascript
{
  "options": {
    "visibility": "PUBLIC"  // or "CONNECTIONS"
  }
}
```

### Pinterest
```javascript
{
  "options": {
    "boardId": "required-board-id",
    "link": "https://example.com",  // Optional destination URL
    "title": "Pin title"  // Optional, uses caption if not provided
  }
}
```

### YouTube
```javascript
{
  "options": {
    "title": "Video title",  // Optional, uses first 100 chars of caption
    "privacyStatus": "public",  // or "private", "unlisted"
    "categoryId": "22",  // People & Blogs
    "tags": ["tag1", "tag2"]
  }
}
```

### Facebook
```javascript
{
  "options": {
    "pageId": "facebook-page-id"  // Optional, defaults to "me"
  }
}
```

## Database Schema

```sql
-- Users
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Platform connections (OAuth tokens)
CREATE TABLE connections (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform PLATFORM_ENUM NOT NULL,
  scopes TEXT[] NOT NULL,
  access_token_enc TEXT NOT NULL,  -- AES-256-GCM encrypted
  refresh_token_enc TEXT,  -- AES-256-GCM encrypted
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expires_at TIMESTAMP,
  account_id TEXT,
  account_handle TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Posts
CREATE TABLE posts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform PLATFORM_ENUM NOT NULL,
  caption TEXT NOT NULL,
  media_type TEXT,
  media_url TEXT,
  scheduled_at TIMESTAMP,
  status POST_STATUS_ENUM NOT NULL DEFAULT 'queued',
  external_id TEXT,  -- Platform's post ID
  external_url TEXT,  -- URL to published post
  options JSONB,
  client_post_id TEXT,  -- For idempotency
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Job logs
CREATE TABLE job_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id VARCHAR NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  level LOG_LEVEL_ENUM NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  raw JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Testing

```bash
# Create a test user
npm run seed

# Run integration tests (if implemented)
npm test
```

## Worker Architecture

The background worker uses BullMQ with Redis for:

- **Scheduled Publishing**: Posts queued with delay until scheduled time
- **Retry Logic**: 3 attempts with exponential backoff (5s base delay)
- **Token Refresh**: Automatic refresh of expired OAuth tokens
- **Concurrency**: Processes up to 5 jobs simultaneously
- **Idempotency**: Job IDs prevent duplicate processing

## Security Best Practices

✅ **Implemented:**
- AES-256-GCM encryption for stored tokens
- JWT-based authentication with secure secret
- PKCE for OAuth flows where supported
- State parameter validation to prevent CSRF
- Environment variable-based configuration
- No secrets in logs or responses

⚠️ **Production Checklist:**
- [ ] Use HTTPS only (TLS/SSL certificates)
- [ ] Rotate encryption keys regularly
- [ ] Implement rate limiting
- [ ] Set up proper CORS allowlist
- [ ] Use secure session management
- [ ] Enable audit logging
- [ ] Set up monitoring and alerts

## Troubleshooting

### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping  # Should return "PONG"

# Start Redis (if not running)
redis-server
```

### Database Connection
```bash
# Verify DATABASE_URL is set
echo $DATABASE_URL

# Test connection
npm run db:push
```

### OAuth Errors
- Verify redirect URIs match exactly (including protocol and port)
- Check required scopes are granted
- Ensure app is not in sandbox/development mode (for production)
- Verify platform credentials are correct

### Worker Not Processing Jobs
```bash
# Check worker is running
NODE_ENV=development tsx server/worker.ts

# Verify Redis connection
redis-cli ping  # Should return "PONG"

# Check logs for error messages
```

## Platform Limitations & Notes

- **Twitter/X**: Media upload requires Elevated API access (paid tier)
- **YouTube**: 10,000 quota units/day limit (upload costs 1,600 units)
- **Instagram**: Must have Business/Creator account linked to Facebook Page
- **TikTok**: Requires approval for Content Posting API
- **Pinterest**: Requires board ID for pin creation
- **LinkedIn**: Rate limits apply to posting frequency

## Contributing

This is a backend-only implementation. For production use, consider:

- Adding comprehensive error handling
- Implementing webhook handlers for platform callbacks
- Adding admin endpoints for post management
- Setting up monitoring and observability
- Implementing rate limiting per user
- Adding integration tests with mocked platform responses

## License

MIT

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review platform-specific OAuth documentation
3. Verify environment variables are set correctly
4. Check worker and application logs
