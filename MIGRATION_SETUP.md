# Database Migration Setup

## Overview
This project uses Drizzle ORM with PostgreSQL. Migration files are pre-generated and ready for fresh deployments.

## For Fresh Clone Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Copy `.env.example` to `.env` and configure your `DATABASE_URL`:
```bash
DATABASE_URL=postgresql://user:password@host:port/database
```

### 3. Run Migrations

**Option A: Using npx (works immediately)**
```bash
npx drizzle-kit migrate
```

**Option B: Using npm scripts (requires package.json update)**

Add these scripts to your `package.json`:
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

Then run:
```bash
npm run db:migrate
```

## Schema Overview

The schema includes the following tables:

### Core Tables
- **users** - User accounts with email/password authentication
- **connections** - OAuth connections to social media platforms (Instagram, TikTok, Twitter, LinkedIn, Pinterest, YouTube, Facebook)
  - **Unique Index**: `(user_id, platform)` - Prevents duplicate platform connections per user
- **posts** - Scheduled and published social media posts
- **jobs** - BullMQ job tracking for async operations
- **analytics_events** - User activity and event tracking

### Supporting Tables
- **ecommerce_connections** - OAuth connections to e-commerce platforms (Shopify, Etsy, Squarespace)
- **products** - Cached product listings from connected e-commerce stores
- **job_logs** - Detailed logs for post publishing attempts
- **media_library** - Uploaded media files and metadata
- **templates** - Saved caption and brand voice templates
- **post_analytics** - Social media engagement metrics

## Database Commands

### Generate New Migration (after schema changes)
```bash
npx drizzle-kit generate
# or with npm script: npm run db:generate
```

### Apply Migrations
```bash
npx drizzle-kit migrate
# or with npm script: npm run db:migrate
```

### Push Schema (Development)
For rapid development, you can push schema changes directly:
```bash
npm run db:push
```

## Migration Files

All migrations are stored in the `migrations/` directory:
- `migrations/0000_chief_sabra.sql` - Initial schema with all tables
- `migrations/meta/_journal.json` - Migration metadata and history

## Important Notes

1. **Unique Index on Connections**: The `connections` table has a unique index on `(user_id, platform)` to ensure each user can only have one connection per social platform.

2. **Cascade Deletes**: All foreign key relationships use `ON DELETE CASCADE` to maintain referential integrity.

3. **Fresh vs Existing Database**: 
   - Fresh database: Run migrations with `drizzle-kit migrate`
   - Existing database: Use `drizzle-kit push` to sync schema changes

4. **Environment Variables**: The `drizzle.config.ts` requires `DATABASE_URL` to be set before running any database commands.

## Troubleshooting

### Error: "type already exists"
This means you're running migrations on an existing database. Use `drizzle-kit push` instead, or drop and recreate the database for a fresh start.

### Error: "DATABASE_URL not set"
Ensure your `.env` file contains a valid PostgreSQL connection string.
