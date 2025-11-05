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
- **AI Studio:** AI-powered content creation with multi-image upload, AI caption generation (Google Gemini), "Human Authenticity Engine" to refine tone and remove buzzwords, emoji generation, proofreading, regeneration, and direct posting.
- **Content Calendar:** Month/week views with color-coded posts by platform.
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
- JWT-based sessions (7-day expiration)
- bcrypt password hashing (10 rounds)
- AES-256-GCM encryption for OAuth tokens at rest
- PKCE support for OAuth flows
- CSRF protection via OAuth state parameter
- Centralized environment variable validation using Zod
- Multi-tier rate limiting for general API, authentication, AI generation, post creation, and OAuth connections.
- Helmet security headers and CORS protection.
- Pino HTTP logging with request tracking.
- Centralized Express error handling.

**API Structure:**
- RESTful endpoints under `/api`
- Authentication middleware for protected routes
- Health check endpoints (`/healthz`, `/readyz`)
- OAuth callback handlers
- Presigned upload functionality for direct-to-cloud media uploads (Google Cloud Storage).
- Analytics event tracking endpoint (`/api/analytics/track`) and summary (`/api/analytics/summary`).

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
- Drizzle ORM with PostgreSQL.
- Tables for users, connections (social and e-commerce), posts, jobs, analytics events, products, job logs, media library, templates, and post analytics.
- Enums for platform types, post status, and log levels.
- Cascade deletes for data integrity.

## External Dependencies

**Database:**
- Neon Serverless PostgreSQL with Drizzle ORM.

**Queue System:**
- Redis with BullMQ for job processing.

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
- Client IDs and secrets for all social media and e-commerce platforms.
- `ENCRYPTION_KEY`, `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`.