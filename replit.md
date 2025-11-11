# Picscripterai - Social Media Management Platform

## Overview

Picscripterai is a full-stack social media management application designed to connect multiple social media and e-commerce platforms. It enables users to schedule and publish AI-powered promotional content across 7 major social platforms (Instagram, TikTok, Twitter/X, LinkedIn, Pinterest, YouTube, Facebook) and synchronize product data from 3 e-commerce platforms (Shopify, Etsy, Squarespace). The platform aims to be a productivity tool focused on efficient, reliable multi-platform content distribution and seamless integration between e-commerce catalogs and social media marketing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript
- Vite
- Wouter for routing
- TanStack Query for server state management
- shadcn/ui (Radix UI) and Tailwind CSS for UI
- React-hook-form with Zod for form management

**Design Philosophy:**
- Productivity tool aesthetic (inspired by Linear and Notion)
- Inter font for UI, monospace for technical data
- Sidebar navigation with a fixed left panel
- Custom color system with CSS variables for theming

**Key Features:**
- **AI Studio:** AI-powered content creation with multi-image upload, AI caption generation (Google Gemini), "Human Authenticity Engine" to refine tone and remove buzzwords, emoji generation, proofreading, regeneration, and direct posting. Includes real-time character counter showing which platforms are within/over limits, with frontend validation preventing posts that exceed platform limits. **Image-category verification** uses Gemini Vision to detect image content and prevent mismatched captions (e.g., food description for real estate photo) - shows friendly warning if detected category doesn't match user's selection.
- **Content Calendar:** Month/week views with enhanced post cards showing scheduled time (e.g., "3:30 PM"), tone badge (if set), platform icon, and caption preview. Includes character limit validation for scheduled posts. **Unified Schedule Drawer** (enabled by default): Single drawer interface for both creating and editing scheduled posts. Create mode accessible via "Schedule Post" button or day cell clicks. **Post Preview Mode:** Clicking existing posts opens a visual preview showing the complete post (uploaded image, category badge, tone badge, AI description, platform icons, formatted date/time). "Edit Post" button toggles to edit form with update/duplicate/delete actions and intelligent job rescheduling.
- **Connections Management:** OAuth-based connection management for social media and e-commerce platforms, including product sync functionality.
- **Post Management:** View all posts with status tracking, quick actions (duplicate, edit & repost, send to AI Studio).

### Backend Architecture

**Technology Stack:**
- Node.js with TypeScript and ES modules
- Express for HTTP API
- Drizzle ORM for PostgreSQL (Neon Serverless)
- BullMQ + Redis for job queuing
- JWT for authentication, bcryptjs for password hashing
- Axios for external API calls

**Authentication & Security:**
- **Cookie-Based Authentication (Default):**
  - httpOnly cookies for access and refresh tokens (enabled via FEATURE_TOKEN_REFRESH)
  - Access token: httpOnly, Secure (prod), SameSite=Lax, path=/, 15m TTL
  - Refresh token: httpOnly, Secure (prod), SameSite=Strict, path=/api/auth, 30d TTL
  - Automatic token refresh on 401 errors (frontend retry logic)
  - POST `/api/auth/refresh` endpoint for token renewal
  - POST `/api/auth/logout` endpoint clears cookies (maxAge=0)
  - Backward compatible with Bearer token authentication
- JWT-based sessions with configurable TTLs
  - Access tokens: 15 minutes (ACCESS_TOKEN_TTL)
  - Refresh tokens: 30 days (REFRESH_TOKEN_TTL)
- bcrypt password hashing (10 rounds)
- **Versioned Encryption Key Rotation:**
  - AES-256-GCM encryption for OAuth tokens at rest
  - Kid-based encryption format: `kid:iv:authTag:encryptedData`
  - Supports multiple active keys via ENCRYPTION_KEYS_JSON
  - Current key managed via ENCRYPTION_KEY_CURRENT
  - Backward compatible with legacy 3-part format
  - Re-encryption script for seamless key rotation (`server/scripts/rotate-encryption-keys.ts`)
- **Audit Logging System:**
  - `audit_events` table tracking all sensitive actions
  - Tracks user authentication, OAuth connections, posts, drafts
  - Admin endpoint GET `/admin/audit` with filtering and pagination
  - Captures IP address, user agent, metadata for security review
  - ADMIN_USER_IDS env var for admin access control
- **Hardened CORS Configuration:**
  - Comma-separated origin allowlist (CORS_ORIGIN)
  - Wildcard blocking in production environments
  - Per-request origin validation
  - Credentials support for cookie-based auth
- PKCE support for all OAuth flows (S256 challenge method)
- CSRF protection via OAuth state parameter (10-minute expiration)
- OAuth redirect URI allowlist validation (OAUTH_REDIRECT_ALLOWLIST env var)
- Automatic token refresh with graceful failure handling
  - TokenRefreshError class categorizes failures
  - Distinguishes user action required vs. temporary errors
- Centralized environment variable validation using Zod
- Multi-tier rate limiting for general API, authentication, AI generation, post creation, and OAuth connections
- Helmet security headers
- Pino HTTP logging with request tracking
- Centralized Express error handling

**API Structure:**
- RESTful endpoints under `/api`
- Authentication middleware for protected routes
- Health check endpoints (`/healthz`, `/readyz`)
- OAuth callback handlers
- Presigned upload functionality for direct-to-cloud media uploads (Google Cloud Storage).
- Analytics event tracking endpoint (`/api/analytics/track`) and summary (`/api/analytics/summary`).
- **Schedule Management Endpoints:**
  - POST `/api/schedule` - Create new scheduled post
  - GET `/api/schedule/:id` - Fetch post details for editing
  - PATCH `/api/schedule/:id` - Update existing scheduled post (caption, media, platforms, scheduledAt) with automatic job cancellation/re-enqueueing
  - POST `/api/schedule/:id/duplicate` - Clone post to new draft
  - POST `/api/schedule/:id/resolve` - Legacy endpoint for resolving connection issues

**OAuth Integration:**
- Factory pattern for platform-specific OAuth providers.
- Automatic token refresh logic.
- Encrypted storage of access and refresh tokens.

**Job Queue Architecture:**
- BullMQ workers for asynchronous post publishing.
- Redis-backed queue with exponential backoff retry.
- Comprehensive job logging.
- Status tracking for publishing jobs.

**Publishing Flow:**
- Platform-specific publisher modules handling API requirements.
- Token validation and refresh before publishing.
- Error handling with descriptive messages.

**Database Schema:**
- Drizzle ORM with PostgreSQL
- Tables: users, connections (social and e-commerce), posts, jobs, analytics events, products, job logs, media library, templates, post analytics, and **audit_events**
- Enums for platform types, post status, log levels, and audit actions
- Cascade deletes for data integrity

## Process Architecture

Picscripterai uses a dual-process architecture:

**Web Process:**
- Express API server + Vite frontend
- Serves on port 5000
- Handles HTTP requests, authentication, OAuth flows
- Stateless design for horizontal scaling

**Worker Process:**
- BullMQ job processor
- Handles async post publishing tasks
- Automatic token refresh
- Single instance recommended (BullMQ handles internal concurrency)

**Process Management:**
- **Development (Replit)**: Both processes run automatically via `npm run dev` using concurrently
  - `npm run dev:web` - Runs web server with auto-reload
  - `npm run dev:worker` - Runs worker process with auto-reload
  - `npm run dev` - Runs both processes together (default)
  - Workflow "Start application" automatically runs both processes
- **Production**: PM2 (VPS/EC2), Procfile (Render/Fly)
- **Health Checks**: `/healthz` (liveness), `/readyz` (readiness)
- **Metrics**: `/metrics` endpoint (protected by METRICS_TOKEN)

**Timezone Handling:**
- Database uses `timestamptz` for all timestamp columns (UTC storage with timezone awareness)
- Frontend datetime-local inputs automatically convert to UTC ISO strings
- Backend calculates job delays using UTC timestamps
- Display times formatted in user's local timezone via date-fns

## External Dependencies

**Database:**
- Neon Serverless PostgreSQL with Drizzle ORM.

**Queue System:**
- Redis with BullMQ for job processing.

**Deployment Configurations:**
- `ecosystem.config.js`: PM2 configuration for web + worker processes
- `Procfile`: Process definition for Render/Fly/Heroku
- Health endpoints for load balancer checks

**Social Media Platform APIs:**
1.  **Instagram:** Graph API (Facebook Business Pages).
2.  **TikTok:** Content Posting API v2 (PKCE-enabled OAuth).
3.  **Twitter/X:** API v2 (OAuth 2.0).
4.  **LinkedIn:** Posts API.
5.  **Pinterest:** API v5.
6.  **YouTube:** Data API v3 (Resumable Uploads).
7.  **Facebook:** Graph API (Pages endpoints).

**E-commerce Platform APIs:**
1.  **Shopify:** Admin API (OAuth 2.0, permanent tokens, requires shop domain).
2.  **Etsy:** OpenAPI v3 (PKCE OAuth, short-lived tokens with refresh).
3.  **Squarespace:** Commerce API (OAuth 2.0, very short-lived tokens with refresh).

**E-commerce Integration Architecture:**
- Separate database tables for e-commerce connections and cached products.
- Product sync fetches and caches listings from platform APIs.
- OAuth provider factory for e-commerce platforms, handling token exchange, refresh, store info, and product retrieval.

**Environment Configuration:**
- Client IDs and secrets for all social media and e-commerce platforms
- Core secrets: `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `GEMINI_API_KEY`
- **Security settings:**
  - `ENCRYPTION_KEYS_JSON`: JSON mapping of key IDs to key values (e.g., `{"v1":"key1","v2":"key2"}`)
  - `ENCRYPTION_KEY_CURRENT`: Active encryption key ID (default: "v1")
  - `CORS_ORIGIN`: Comma-separated origin allowlist (no wildcards in production)
  - `OAUTH_CALLBACK_BASE_URL`: Dedicated base URL for OAuth callbacks (recommended for production, falls back to first CORS_ORIGIN)
  - `ACCESS_TOKEN_TTL`: Access token expiration (default: 15m)
  - `REFRESH_TOKEN_TTL`: Refresh token expiration (default: 30d)
  - `ADMIN_USER_IDS`: Comma-separated admin user IDs for audit access
- **Feature Flags:**
  - Unified Schedule Drawer: Enabled by default (hardcoded in calendar.tsx)
  - `FEATURE_TOKEN_REFRESH`: Enable cookie-based refresh tokens (default: true)

## Production Security Features

**Implemented November 2025:**

1. **Versioned Encryption Key Rotation** - Multi-key support with kid-based format, backward compatibility, and re-encryption tooling
2. **Audit Logging System** - Comprehensive tracking of sensitive actions with admin reporting interface
3. **Hardened CORS** - Strict origin allowlist with wildcard blocking in production
4. **Configurable JWT Settings** - Secure token lifetimes (15m access, 30d refresh)

See `PRODUCTION_SECURITY.md` for detailed documentation on security features, deployment checklist, and best practices.