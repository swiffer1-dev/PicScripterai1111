# Picscripterai - Social Media Management Platform

## Overview
Picscripterai is a full-stack social media management application designed to connect multiple social media and e-commerce platforms. It enables users to schedule and publish AI-powered promotional content across 7 major social platforms (Instagram, TikTok, Twitter/X, LinkedIn, Pinterest, YouTube, Facebook) and synchronize product data from 3 e-commerce platforms (Shopify, Etsy, Squarespace). The platform aims to be a productivity tool focused on efficient, reliable multi-platform content distribution and seamless integration between e-commerce catalogs and social media marketing.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack:** React 18 with TypeScript, Vite, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS, React-hook-form with Zod.
- **Design Philosophy:** Productivity tool aesthetic (inspired by Linear and Notion), Inter font, monospace for technical data, sidebar navigation, custom CSS variable color system.
- **Key Features:**
    - **AI Studio:** AI-powered content creation (Google Gemini for captions, "Human Authenticity Engine"), multi-image upload, emoji generation, proofreading, regeneration, direct posting. Includes real-time character counter, frontend validation, and AI image-category verification.
    - **Content Calendar:** Month/week views with enhanced post cards, unified schedule drawer for creating and editing, and a post preview mode with visual post details and editing capabilities.
    - **Engagement Analytics:** Feature-flagged Twitter/X engagement tracking (likes, reposts, replies, quotes, impressions) with automated metrics collection and a dedicated dashboard. Also includes feature-flagged per-platform analytics dashboards for Instagram, Pinterest, and Shopify, utilizing shared UI components and read-only SQL adapters.
    - **Connections Management:** OAuth-based management for social media and e-commerce platforms, including product sync.
    - **Post Management:** Overview of all posts with status tracking and quick actions.

### Backend Architecture
- **Technology Stack:** Node.js with TypeScript and ES modules, Express, Drizzle ORM (PostgreSQL), BullMQ + Redis, JWT, bcryptjs, Axios.
- **Authentication & Security:** Cookie-based authentication with httpOnly tokens, JWT-based sessions, bcrypt password hashing, versioned AES-256-GCM encryption for OAuth tokens, comprehensive audit logging, hardened CORS configuration, PKCE support for OAuth, CSRF protection, OAuth redirect URI allowlist, automatic token refresh, Zod-based environment variable validation, multi-tier rate limiting, Helmet security headers, Pino HTTP logging, and centralized Express error handling.
- **API Structure:** RESTful endpoints for scheduling, post management, and feature-flagged engagement metrics.
- **OAuth Integration:** Factory pattern for platform-specific OAuth providers, automatic token refresh, encrypted token storage.
- **Job Queue Architecture:** BullMQ workers for asynchronous post publishing and engagement metrics collection, Redis-backed queue with retry mechanisms.
- **Publishing Flow:** Platform-specific publisher modules, token validation, and error handling.
- **Database Schema:** PostgreSQL with Drizzle ORM, including tables for users, connections, posts, jobs, analytics, products, media library, templates, post_metrics (for engagement snapshots), and audit_events.

### Process Architecture
- **Dual-Process Architecture:**
    - **Web Process:** Express API server + Vite frontend, handles HTTP requests and authentication.
    - **Worker Process:** BullMQ job processor for async tasks like post publishing and metrics collection.
- **Process Management:** Uses `concurrently` for development, and PM2 or Procfile for production.
- **Health Checks:** `/healthz` and `/readyz` endpoints.
- **Timezone Handling:** `timestamptz` for UTC storage in the database, frontend conversion, and backend UTC calculations.

## External Dependencies

**Database:**
- Neon Serverless PostgreSQL with Drizzle ORM.

**Queue System:**
- Redis with BullMQ.

**Social Media Platform APIs:**
- Instagram: Graph API
- TikTok: Content Posting API v2
- Twitter/X: API v2
- LinkedIn: Posts API
- Pinterest: API v5
- YouTube: Data API v3
- Facebook: Graph API

**E-commerce Platform APIs:**
- Shopify: Admin API
- Etsy: OpenAPI v3
- Squarespace: Commerce API

**Environment Configuration:**
- Client IDs and secrets for all integrated platforms.
- Core secrets: `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `GEMINI_API_KEY`.
- Security settings: `ENCRYPTION_KEYS_JSON`, `ENCRYPTION_KEY_CURRENT`, `CORS_ORIGIN`, `OAUTH_CALLBACK_BASE_URL`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `ADMIN_USER_IDS`.
- Feature Flags: `FEATURE_TOKEN_REFRESH`, `METRICS_ENGAGEMENT`, `VITE_METRICS_ENGAGEMENT`, `VITE_UI_MODERN_CHART`, `FEATURE_PER_PLATFORM_ANALYTICS`, `VITE_FEATURE_PER_PLATFORM_ANALYTICS`.