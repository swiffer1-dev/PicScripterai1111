# Railway Deployment Guide

## Overview

This app requires **two separate Railway services**:
1. **Web Service** - API server and frontend
2. **Worker Service** - Background job processor for scheduled posts

## Prerequisites

- Railway account ([railway.app](https://railway.app))
- GitHub repository connected to Railway
- PostgreSQL database (Railway plugin)
- Redis database (Railway plugin)

## Step-by-Step Deployment

### 1. Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

### 2. Add Database Services

#### PostgreSQL
1. Click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway automatically sets `DATABASE_URL` environment variable

#### Redis
1. Click "+ New"
2. Select "Database" → "Redis"
3. Railway automatically sets `REDIS_URL` environment variable

### 3. Configure Web Service

1. Click on your web service
2. Go to "Settings" → "Environment"
3. Add these variables:

```bash
# Required
NODE_ENV=production
JWT_SECRET=<generate-with: openssl rand -base64 32>
ENCRYPTION_KEY=<generate-with: openssl rand -hex 32>

# CORS - use your Railway domain
CORS_ORIGIN=https://your-app-name.up.railway.app

# Optional: OAuth credentials (only if using these platforms)
INSTAGRAM_CLIENT_ID=your-id
INSTAGRAM_CLIENT_SECRET=your-secret
TIKTOK_CLIENT_KEY=your-key
TIKTOK_CLIENT_SECRET=your-secret
# ... add others as needed
```

4. Go to "Settings" → "Build"
   - Build Command: `npm run build:railway`
   - Start Command: `npm run start`

5. Go to "Settings" → "Deploy"
   - Enable "Healthcheck"
   - Path: `/healthz`

### 4. Create Worker Service

1. Click "+ New" → "Empty Service"
2. Connect to the **same GitHub repository**
3. Go to "Settings" → "Environment"
4. **Copy ALL environment variables from Web Service**
   - Including `DATABASE_URL` and `REDIS_URL`
   - Must be identical to web service

5. Go to "Settings" → "Build"
   - Build Command: `npm run build`
   - Start Command: `npm run start:worker`

6. Go to "Settings" → "Deploy"
   - Disable "Public Networking" (worker doesn't need external access)

### 5. Link Services to Databases

Both services need access to PostgreSQL and Redis:

1. Click on Web Service → "Settings" → "Service Variables"
2. Click "Reference" → Select PostgreSQL → Add `DATABASE_URL`
3. Click "Reference" → Select Redis → Add `REDIS_URL`
4. Repeat for Worker Service

### 6. Deploy

1. Push to your GitHub repository
2. Railway automatically deploys both services
3. Monitor logs in Railway dashboard

### 7. Verify Deployment

```bash
# Check web service health
curl https://your-app.up.railway.app/healthz
# Expected: {"status":"ok"}

# Check database connection
curl https://your-app.up.railway.app/readyz
# Expected: {"status":"ready","database":"ok","redis":"ok"}

# Check web service logs
# Railway Dashboard → Web Service → Logs

# Check worker logs
# Railway Dashboard → Worker Service → Logs
```

## Environment Variables Reference

### Required (Both Services)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-set by Railway |
| `REDIS_URL` | Redis connection string | Auto-set by Railway |
| `JWT_SECRET` | JWT signing secret (32+ chars) | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | Token encryption key (32 bytes hex) | `openssl rand -hex 32` |
| `NODE_ENV` | Environment | `production` |
| `CORS_ORIGIN` | Allowed frontend origin | `https://your-app.up.railway.app` |

### Optional (Platform Features)

Only add if you're using these platforms:

```bash
# Instagram (via Facebook)
INSTAGRAM_CLIENT_ID=...
INSTAGRAM_CLIENT_SECRET=...

# TikTok
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...

# Twitter/X
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...

# LinkedIn
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...

# Pinterest
PINTEREST_APP_ID=...
PINTEREST_APP_SECRET=...

# YouTube
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...

# Facebook
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...

# Shopify
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...

# Etsy
ETSY_CLIENT_ID=...
ETSY_CLIENT_SECRET=...

# Squarespace
SQUARESPACE_CLIENT_ID=...
SQUARESPACE_CLIENT_SECRET=...
```

## Troubleshooting

### Worker Not Processing Jobs

**Symptoms**: Scheduled posts stay in "scheduled" status

**Check**:
1. Worker service is running (Railway dashboard)
2. Worker has `REDIS_URL` environment variable
3. Worker logs show connection to Redis
4. Both services use the **same** `REDIS_URL`

**Fix**:
```bash
# In Worker Service logs, look for:
[WORKER] Worker disabled via DISABLE_WORKER=1

# If present, remove DISABLE_WORKER variable
```

### Database Connection Errors

**Symptoms**: `/readyz` returns 503, "Database connection failed"

**Check**:
1. PostgreSQL service is running
2. `DATABASE_URL` is set in both services
3. Database has been migrated (build command runs `db:push`)

**Fix**:
```bash
# Manually run migration
railway run npm run db:push
```

### CORS Errors

**Symptoms**: Frontend can't connect to API

**Check**:
1. `CORS_ORIGIN` matches your Railway domain exactly
2. Include protocol: `https://` not `http://`
3. No trailing slash

**Fix**:
```bash
# Update CORS_ORIGIN
CORS_ORIGIN=https://your-exact-domain.up.railway.app
```

### OAuth Redirect Errors

**Symptoms**: OAuth callbacks fail with "redirect_uri mismatch"

**Fix**:
1. Update OAuth app settings in each platform
2. Add Railway domain to allowed redirect URIs:
   ```
   https://your-app.up.railway.app/api/callback/instagram
   https://your-app.up.railway.app/api/callback/tiktok
   # ... etc for each platform
   ```

## Scaling

### Web Service
- Can scale horizontally (multiple instances)
- Railway auto-scales based on traffic
- Stateless design supports load balancing

### Worker Service
- **Keep at 1 instance** (single worker recommended)
- BullMQ handles concurrency internally
- Multiple workers may cause duplicate job processing

## Monitoring

### Health Checks
```bash
# Liveness (is app running?)
curl https://your-app.up.railway.app/healthz

# Readiness (can app serve traffic?)
curl https://your-app.up.railway.app/readyz
```

### Logs
- Railway Dashboard → Service → Logs
- Real-time log streaming
- Filter by service (web/worker)

### Metrics (Optional)
If you set `METRICS_TOKEN`:
```bash
curl -H "X-Metrics-Token: your-secret" \
  https://your-app.up.railway.app/metrics
```

## Cost Optimization

### Free Tier Limits
- Railway free tier: $5/month credit
- PostgreSQL: ~$5/month
- Redis: ~$5/month
- Web service: ~$5/month
- Worker service: ~$5/month

**Total**: ~$20/month (exceeds free tier)

### Recommendations
1. **Disable worker if not using scheduled posts**:
   ```bash
   DISABLE_WORKER=1
   ```
   Saves ~$5/month

2. **Use external Redis** (Upstash free tier):
   - 10,000 commands/day free
   - Remove Railway Redis plugin
   - Set `REDIS_URL` to Upstash URL

3. **Combine services** (not recommended):
   - Run worker in same process as web
   - Requires code changes
   - Loses separation of concerns

## Support

- Railway Docs: [docs.railway.app](https://docs.railway.app)
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- App Issues: [GitHub Issues](https://github.com/your-repo/issues)
