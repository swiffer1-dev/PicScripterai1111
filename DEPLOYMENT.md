# Picscripterai Deployment Guide

## Quick Start - PM2 Local Test

This guide shows you how to test the dual-process architecture locally using PM2.

### Prerequisites

```bash
# Install PM2 globally
npm install -g pm2
```

### Step 1: Add Scripts to package.json

Add these scripts to your `package.json` file:

```json
{
  "scripts": {
    "dev:worker": "NODE_ENV=development tsx server/worker.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist && esbuild server/worker.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start:worker": "NODE_ENV=production node dist/worker.js",
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop ecosystem.config.js",
    "pm2:restart": "pm2 restart ecosystem.config.js",
    "pm2:logs": "pm2 logs",
    "pm2:monit": "pm2 monit"
  }
}
```

### Step 2: Build the Application

```bash
npm run build
```

This builds both:
- `dist/index.js` (web server)
- `dist/worker.js` (worker process)

### Step 3: Start with PM2

```bash
npm run pm2:start
```

Or directly:
```bash
pm2 start ecosystem.config.js
```

### Step 4: Verify Processes Running

```bash
pm2 status
```

You should see:
```
┌─────┬────────┬─────────────┬─────────┬─────────┬──────────┐
│ id  │ name   │ mode        │ ↺       │ status  │ cpu      │
├─────┼────────┼─────────────┼─────────┼─────────┼──────────┤
│ 0   │ web    │ cluster     │ 0       │ online  │ 0%       │
│ 1   │ worker │ fork        │ 0       │ online  │ 0%       │
└─────┴────────┴─────────────┴─────────┴─────────┴──────────┘
```

### Step 5: View Logs

```bash
# View all logs
npm run pm2:logs

# Or view specific process
pm2 logs web
pm2 logs worker
```

### Step 6: Monitor

```bash
npm run pm2:monit
```

Shows real-time CPU, memory, and logs.

### Step 7: Test Health Endpoints

```bash
# Liveness check
curl http://localhost:5000/healthz

# Readiness check (tests DB connection)
curl http://localhost:5000/readyz

# Metrics (if METRICS_TOKEN is set)
curl -H "X-Metrics-Token: your-token" http://localhost:5000/metrics
```

### Step 8: Stop Processes

```bash
npm run pm2:stop
```

## Done Check ✓

To verify everything works:

```bash
# 1. Build application
npm run build

# 2. Start PM2
pm2 start ecosystem.config.js

# 3. Check status (should show web + worker online)
pm2 status

# 4. View logs
pm2 logs

# 5. Test health
curl http://localhost:5000/healthz

# 6. Stop
pm2 stop ecosystem.config.js
```

## Production Deployment

### Render

1. Create Web Service and Background Worker services
2. Set build command: `npm install && npm run build && npm run db:push`
3. Render auto-detects `Procfile` with:
   ```
   web: NODE_ENV=production node dist/index.js
   worker: NODE_ENV=production node dist/worker.js
   ```

### Fly.io

1. Use `fly.toml` configuration (see README.md)
2. Deploy with: `fly deploy`
3. Scale worker: `fly scale count worker=1`

### VPS/EC2

1. Install PM2: `npm install -g pm2`
2. Build: `npm run build`
3. Start: `pm2 start ecosystem.config.js`
4. Save: `pm2 save`
5. Auto-start on boot: `pm2 startup`

## File Overview

- **ecosystem.config.js**: PM2 configuration for local/VPS deployment
- **Procfile**: Process definition for Render/Fly/Heroku
- **README.md**: Comprehensive deployment documentation
- **logs/**: PM2 log directory (auto-created)

## Troubleshooting

**"Cannot find module dist/index.js"**
- Run `npm run build` first

**Worker not starting**
- Check Redis connection: `redis-cli ping`
- Verify `REDIS_URL` environment variable

**PM2 command not found**
- Install globally: `npm install -g pm2`

## Environment Variables

See `.env.example` for all required variables. Key ones:

```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
CORS_ORIGIN=http://localhost:5000
```

For metrics endpoint:
```bash
METRICS_TOKEN=your-secret-token
```

## Architecture Notes

- **Web**: Can scale horizontally (multiple instances)
- **Worker**: Single instance recommended (BullMQ handles concurrency)
- **Database**: Shared PostgreSQL (Neon)
- **Queue**: Shared Redis
- **Sessions**: Stored in database (not in-memory)

See README.md for complete documentation.
