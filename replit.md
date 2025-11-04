# Picscripter - Social Media Management Platform

## Overview

Picscripter is a full-stack social media management application that enables users to connect multiple social media accounts via OAuth 2.0 and schedule/publish content across 7 major platforms: Instagram, TikTok, Twitter/X, LinkedIn, Pinterest, YouTube, and Facebook.

The application provides secure authentication, encrypted token storage, automatic token refresh, job-based scheduling with retry logic, and platform-specific publishing flows. It's designed as a productivity tool with a focus on efficiency, clarity, and reliable multi-platform content distribution.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and data fetching
- shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for utility-first styling with custom design system

**Design Philosophy:**
- Follows a productivity tool aesthetic inspired by Linear and Notion
- Uses Inter font for UI elements, monospace fonts for technical data
- Implements a sidebar navigation pattern with fixed left panel (16rem width)
- Custom color system with CSS variables for theming support
- Component-driven architecture with reusable UI primitives

**State Management:**
- React Query handles all server state (connections, posts, user data)
- Local storage for JWT token persistence
- Form state managed by react-hook-form with Zod validation
- No global state management library needed due to server-first approach

**Key Pages:**
- `/login` - Authentication (signup/login toggle)
- `/` - Dashboard with stats overview and recent posts (no Create Post button)
- `/ai-studio` - "Create" page - AI-powered content creation studio with:
  - Multi-image upload (JPEG, PNG, WebP, HEIC, HEIF)
  - AI caption generation using Google Gemini API
  - **Human Authenticity Engine** - Fights "AI-blog" feel with:
    - 3 AI-proof tone options: Authentic, Conversational, SEO Boosted
    - Natural rhythm instructions (mix of short/long sentences)
    - Light personality cues ("You'll love how this fits", "Trust me on this")
    - Automatic buzzword detection & removal (37 AI buzzwords)
    - User notification when buzzwords are removed
  - Proofread functionality to refine generated content
  - Regenerate option to create new variations
  - Download capabilities (TXT, CSV, HTML formats)
  - Save as draft functionality
  - Copy to clipboard
  - Direct posting to connected platforms
  - Accessible via "Create" link in sidebar
- `/calendar` - Content calendar with month/week views and color-coded posts by platform
- `/connections` - Manage OAuth connections to social platforms
- `/create` - Create/schedule post form (also accessible via query params from Posts page quick actions)
- `/posts` - View all posts with status tracking and quick action buttons:
  - Duplicate - Creates instant draft copy
  - Edit & Repost - Opens Create page with post data pre-filled
  - Send to AI Studio - Loads caption into Create page for AI enhancement

### Backend Architecture

**Technology Stack:**
- Node.js with TypeScript and ES modules
- Express for HTTP API server
- Drizzle ORM for type-safe database operations
- Neon serverless PostgreSQL with WebSocket support
- BullMQ + Redis for job queue and scheduling
- JWT (jsonwebtoken) for user authentication
- bcryptjs for password hashing
- Axios for external API calls

**Authentication & Security:**
- JWT-based session management with 7-day token expiration
- bcrypt password hashing (10 rounds) for user credentials
- AES-256-GCM encryption for OAuth tokens at rest
- PKCE support for OAuth flows where applicable
- CSRF protection via state parameter in OAuth flows
- Environment-based secrets management (JWT_SECRET, ENCRYPTION_KEY)

**API Structure:**
- RESTful endpoints under `/api` prefix
- Authentication middleware for protected routes
- Health check endpoints (`/healthz`, `/readyz`)
- OAuth callback handlers per platform (`/api/callback/:platform`)
- CORS enabled for development flexibility

**OAuth Integration:**
- Factory pattern for platform-specific OAuth providers
- Base provider class with common OAuth operations
- Platform-specific implementations for 7 social networks
- Automatic token refresh logic with 5-minute expiration buffer
- Encrypted storage of access and refresh tokens
- Support for both standard OAuth 2.0 and PKCE flows

**Job Queue Architecture:**
- BullMQ workers for asynchronous post publishing
- Redis-backed queue with exponential backoff retry (3 attempts, 5s base delay)
- Job data includes post metadata, platform, credentials
- Comprehensive job logging (info/warn/error levels)
- Automatic cleanup of completed jobs (100 retained) and failed jobs (500 retained)
- Status tracking: queued → publishing → published/failed

**Publishing Flow:**
- Platform-specific publisher modules with standardized interface
- Each publisher handles platform API requirements (media upload, formatting, etc.)
- Token validation and refresh before publishing
- Error handling with descriptive messages
- Post status updates in database throughout lifecycle

**Database Schema:**
- `users` - User accounts with email/password
- `connections` - OAuth tokens and metadata per platform
- `posts` - Scheduled/published content with status tracking
- `job_logs` - Detailed logging of publish attempts
- Enums for platform, post_status, log_level
- Cascade deletes for data integrity
- Timestamps for audit trails

### External Dependencies

**Database:**
- Neon Serverless PostgreSQL (configurable via DATABASE_URL)
- Connection pooling via @neondatabase/serverless
- WebSocket support for serverless environments
- Drizzle ORM for migrations and queries

**Queue System:**
- Redis (configurable via REDIS_URL, defaults to localhost:6379)
- BullMQ for robust job processing
- ioredis client with lazy connection
- Graceful degradation in development without Redis

**Social Media Platform APIs:**
1. **Instagram** - Graph API via Facebook Business Pages
   - OAuth scopes: instagram_basic, instagram_content_publish
   - Two-step publish: create container → publish container
   
2. **TikTok** - Content Posting API v2
   - PKCE-enabled OAuth flow
   - Video upload with privacy controls
   
3. **Twitter/X** - API v2 with OAuth 2.0
   - Basic authentication for text tweets
   - Media requires elevated access tier
   
4. **LinkedIn** - Posts API
   - Professional network posting
   - Image/text content support
   
5. **Pinterest** - API v5
   - Pin creation with board targeting
   - Basic authentication via client credentials
   
6. **YouTube** - Data API v3
   - Resumable upload protocol for videos
   - Quota limits apply
   
7. **Facebook** - Graph API Pages endpoints
   - Page post publishing
   - Long-lived token exchange support

**Environment Configuration:**
- Platform client IDs and secrets for all 7 OAuth providers
- ENCRYPTION_KEY for token encryption (SHA-256 hashed to 32 bytes)
- JWT_SECRET for session tokens (auto-generated in dev, required in prod)
- DATABASE_URL for PostgreSQL connection
- REDIS_URL for queue backend
- CORS_ORIGIN for OAuth redirect URIs
- NODE_ENV for environment detection

**Build & Deployment:**
- Vite for frontend bundling
- esbuild for backend compilation
- Development mode with HMR and error overlay
- Production build outputs to dist/ directory
- Replit-specific plugins for development experience