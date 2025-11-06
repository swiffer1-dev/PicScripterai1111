# Redis Setup for Scheduled Posts

**Status:** ⚠️ CRITICAL - Required for background job processing and scheduled posts

## Why Redis is Needed

Without Redis:
- ❌ Scheduled posts won't work
- ❌ Background jobs won't process
- ❌ Posts publish immediately only

With Redis:
- ✅ Scheduled publishing
- ✅ Background job queue (BullMQ)
- ✅ Automatic retries on failures
- ✅ Job status tracking

---

## Quick Setup: Upstash Redis (FREE)

Upstash offers a free Redis instance perfect for Replit projects.

### Step 1: Create Upstash Account

1. Go to [upstash.com](https://upstash.com)
2. Sign up (free account)
3. Click **"Create Database"**

### Step 2: Configure Database

- **Name:** `picscripterai-queue`
- **Type:** Regional
- **Region:** Choose closest to your location
- **Eviction:** No eviction
- Click **"Create"**

### Step 3: Get Redis URL

1. In your database dashboard, find **"REST API"** section
2. Copy the **"UPSTASH_REDIS_REST_URL"**
3. It looks like: `https://your-db.upstash.io`

### Step 4: Add to Replit Secrets

1. In Replit, go to **Tools → Secrets** (🔒 lock icon)
2. Click **"+ New Secret"**
3. Add:
   - **Key:** `REDIS_URL`
   - **Value:** Your Upstash URL (e.g., `redis://default:your-password@your-region.upstash.io:6379`)

**Important:** Use the standard Redis URL format (starts with `redis://`), NOT the REST API URL.

You can find the standard URL in Upstash dashboard under **"Redis Connect"** → **"Node.js"**.

### Step 5: Restart Application

After adding `REDIS_URL` secret:
1. Replit will auto-restart the web server
2. Check logs for: `✓ Redis connected - job queue enabled`

---

## Alternative: Render Redis

If deploying to Render:

1. In Render dashboard, add **Redis** add-on
2. Render automatically sets `REDIS_URL` environment variable
3. No manual configuration needed

---

## Alternative: Railway Redis

If deploying to Railway:

1. Add **Redis** service from template gallery
2. Copy the `REDIS_URL` from Redis service variables
3. Add to your app's environment variables

---

## Running the Worker Process

### Development (Replit)

**Option A: Separate Terminal**
```bash
npm run dev:worker
```

**Option B: New Workflow**
1. Create a new workflow named "Worker Process"
2. Command: `npm run dev:worker`
3. Run both "Start application" and "Worker Process" workflows

### Production Deployment

**Render:**
- Automatically runs both processes from `Procfile`
- Web service: `node dist/index.js`
- Background worker: `node dist/worker.js`

**Fly.io:**
```bash
fly scale count worker=1
```

**PM2 (VPS/EC2):**
```bash
pm2 start ecosystem.config.js
pm2 status
```

---

## Verification

Check if Redis is working:

1. **Web Server Logs:**
   ```
   ✓ Redis connected - job queue enabled
   ```

2. **Worker Logs:**
   ```
   Worker started and waiting for jobs...
   ```

3. **Test Scheduled Post:**
   - Create a post with future schedule
   - Check job is queued
   - Wait for scheduled time
   - Verify post publishes

---

## Troubleshooting

**Error: "REDIS_URL not set"**
- Add `REDIS_URL` secret in Replit
- Restart application

**Error: "Redis connection failed"**
- Verify Redis URL is correct
- Check Upstash database is active
- Ensure URL starts with `redis://`

**Worker not processing jobs:**
- Start worker process: `npm run dev:worker`
- Check worker logs for errors
- Verify Redis connection

**"scheduled posts disabled" message:**
- This is normal if Redis isn't configured yet
- Posts will publish immediately instead of queueing

---

## Free Tier Limits (Upstash)

- **Max Commands:** 10,000/day (plenty for most apps)
- **Max Data:** 256 MB
- **Max Connections:** 100 concurrent

For a typical social media scheduler:
- ~100 scheduled posts/day = ~500 Redis commands
- Well within free tier limits

---

## Next Steps

After Redis is configured:

1. ✅ Add `REDIS_URL` to Replit Secrets
2. ✅ Start worker process
3. ✅ Test scheduled publishing
4. 📝 Add missing OAuth credentials (see OAUTH_SETUP.md)
