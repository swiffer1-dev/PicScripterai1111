# Picscripterai - Social Media Management Platform

## Overview

Picscripterai is a full-stack social media management application that enables users to connect multiple social media accounts and e-commerce platforms via OAuth 2.0. Users can schedule/publish content across 7 major social platforms (Instagram, TikTok, Twitter/X, LinkedIn, Pinterest, YouTube, and Facebook) and pull product data from 3 e-commerce platforms (Shopify, Etsy, Squarespace) to generate AI-powered promotional content.

The application provides secure authentication, encrypted token storage, automatic token refresh, job-based scheduling with retry logic, platform-specific publishing flows, and e-commerce product synchronization. It's designed as a productivity tool with a focus on efficiency, clarity, reliable multi-platform content distribution, and seamless integration between e-commerce product catalogs and social media marketing.

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
  - AI caption generation using Google Gemini API (plain text mode to preserve emojis)
  - **Human Authenticity Engine** - Fights "AI-blog" feel with:
    - 3 AI-proof tone options: Authentic, Conversational, SEO Boosted
    - Natural rhythm instructions (mix of short/long sentences)
    - Light personality cues ("You'll love how this fits", "Trust me on this")
    - Automatic buzzword detection & removal (37 AI buzzwords)
    - User notification when buzzwords are removed
  - Emoji generation toggle with platform-specific instructions
  - Text cleaning preserves all Unicode characters (emojis, accents, etc.)
  - Proofread functionality to refine generated content
  - Regenerate option to create new variations
  - Download capabilities (TXT, CSV, HTML formats)
  - Save as draft functionality
  - Copy to clipboard
  - Direct posting to connected platforms
  - Accessible via "Create" link in sidebar
- `/calendar` - Content calendar with month/week views and color-coded posts by platform
- `/connections` - Manage OAuth connections to social media and e-commerce platforms with:
  - Social Media section with 7 platform connections
  - E-commerce section with 3 platform connections (Shopify, Etsy, Squarespace)
  - Product sync functionality for e-commerce platforms
  - Platform-specific setup (e.g., Shopify requires shop domain input)
- `/create` - Create/schedule post form (also accessible via query params from Posts page quick actions)
- `/posts` - View all posts with status tracking and quick action buttons:
  - Duplicate - Creates instant draft copy
  - Edit & Repost - Opens Create page with post data pre-filled
  - Send to Create - Loads caption into Create page for AI enhancement

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
- `connections` - OAuth tokens and metadata for social media platforms
- `ecommerce_connections` - OAuth tokens and metadata for e-commerce platforms (separate from social)
- `products` - Cached product data from e-commerce platforms (title, description, price, images, etc.)
- `posts` - Scheduled/published content with status tracking
- `job_logs` - Detailed logging of publish attempts
- Enums for platform, ecommerce_platform, post_status, log_level
- Cascade deletes for data integrity (deleting e-commerce connection removes associated products)
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

**E-commerce Platform APIs:**
1. **Shopify** - Admin API with OAuth 2.0
   - Requires shop domain (e.g., yourstore.myshopify.com)
   - OAuth scopes: read_products, read_product_listings
   - Permanent access tokens (no refresh needed)
   - Product API endpoint for listing sync
   
2. **Etsy** - OpenAPI v3 with PKCE OAuth
   - PKCE-required OAuth flow for enhanced security
   - Short-lived tokens (1 hour) with refresh token support
   - User API for shop information
   - Listings API for active products with image support
   
3. **Squarespace** - Commerce API with OAuth 2.0
   - Very short-lived tokens (30 minutes) with refresh support
   - Requires user approval for API access
   - Website authorization endpoint for site info
   - Products API with variant and pricing data

**E-commerce Integration Architecture:**
- Separate database tables (ecommerce_connections, products) from social media
- E-commerce platforms are data sources, not posting destinations
- Product sync fetches listings from platform APIs and caches in database
- Cached products reduce API rate limit concerns and enable offline use
- Products include: title, description, price, currency, images, SKU, inventory, tags
- OAuth provider factory pattern with base class and platform-specific implementations
- Each provider implements: exchangeCodeForTokens, refreshTokens, getStoreInfo, getProducts
- Products associated with connection via foreign key with cascade delete

**API Routes for E-commerce:**
- `GET /api/ecommerce/connections` - Get user's e-commerce connections
- `GET /api/ecommerce/connect/:platform` - Initiate OAuth flow (accepts ?shopDomain for Shopify)
- `GET /api/ecommerce/callback/:platform` - OAuth callback handler
- `DELETE /api/ecommerce/connections/:id` - Remove e-commerce connection
- `GET /api/ecommerce/products/:connectionId` - Get cached products for connection
- `POST /api/ecommerce/products/sync/:connectionId` - Sync products from platform API

**Environment Configuration:**
- Social media client IDs and secrets for 7 OAuth providers
- E-commerce client IDs and secrets for 3 platforms (SHOPIFY_, ETSY_, SQUARESPACE_ prefixes)
- ENCRYPTION_KEY for token encryption (SHA-256 hashed to 32 bytes)
- JWT_SECRET for session tokens (auto-generated in dev, required in prod)
- DATABASE_URL for PostgreSQL connection
- REDIS_URL for queue backend (optional in dev)
- CORS_ORIGIN for OAuth redirect URIs
- NODE_ENV for environment detection

**Build & Deployment:**
- Vite for frontend bundling
- esbuild for backend compilation
- Development mode with HMR and error overlay
- Production build outputs to dist/ directory
- Replit-specific plugins for development experience