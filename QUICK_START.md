# Quick Start - Production Deployment Checklist

## Current Status: ⚠️ Action Required

Your app is **production-ready** but needs these critical fixes for full functionality:

---

## ✅ What's Already Working

- 🔐 Security (Helmet, CORS, JWT, encryption)
- 💾 Database (PostgreSQL via Neon)
- 🎨 PWA + UI/UX
- 🤖 AI content generation (Google Gemini)
- 📊 Analytics tracking
- 📝 Drafts system
- 🔗 **3 platforms ready:** Pinterest, Etsy, Shopify

---

## 🔴 Critical Fixes Needed

### 1. Add Redis (Required for Scheduled Posts)

**Without Redis:** Posts publish immediately only  
**With Redis:** Scheduled publishing + background jobs

**Fix:** Follow **REDIS_SETUP.md** (5 minutes)
- Free Upstash account
- Copy Redis URL to Replit Secrets
- Restart app

---

### 2. Start Worker Process

**Without Worker:** Scheduled posts won't publish  
**With Worker:** Background job processing

**Fix (Development):**
```bash
# In a new terminal/workflow:
npm run dev:worker
```

**Fix (Production):**
- Render: Auto-runs from `Procfile`
- PM2: `pm2 start ecosystem.config.js`
- Fly.io: `fly scale count worker=1`

---

### 3. Add OAuth Credentials (Optional)

**Current:** Pinterest, Etsy, Shopify ✅  
**Missing:** Instagram, TikTok, Twitter, LinkedIn, YouTube, Facebook

**Fix:** Follow **OAUTH_SETUP.md**
- Register developer accounts
- Get Client ID/Secret
- Add to Replit Secrets

---

## 🚀 Deployment Options

### Option A: Deploy NOW with Limited Features ✅

**Ready for production with:**
- AI content generation
- Pinterest, Etsy, Shopify posting
- Drafts and analytics
- Immediate publishing (no scheduling)

**To deploy:**
1. Click **Publish** in Replit
2. Or follow **DEPLOYMENT.md** for Render/Fly.io

---

### Option B: Full Production Setup (Recommended)

**Complete all features:**

1. **Set up Redis** (5 min) → REDIS_SETUP.md
2. **Start worker** (1 min) → Run `npm run dev:worker`
3. **Add OAuth** (varies) → OAUTH_SETUP.md
4. **Deploy** → DEPLOYMENT.md

---

## 📋 Pre-Deployment Checklist

### Required for Any Deployment
- [x] PostgreSQL database configured
- [x] ENCRYPTION_KEY set
- [x] JWT_SECRET set
- [x] CORS_ORIGIN set
- [x] SESSION_SECRET set
- [x] At least 1 OAuth platform configured

### Required for Full Functionality
- [ ] REDIS_URL configured
- [ ] Worker process running
- [ ] All desired OAuth platforms configured

### Optional Enhancements
- [ ] Google Cloud Storage for media uploads
- [ ] Custom domain configured
- [ ] SSL certificate (auto on Replit/Render)

---

## 🎯 Quick Fix (15 Minutes)

**To get scheduled posts working:**

1. **Create Upstash Redis:**
   - Go to [upstash.com](https://upstash.com)
   - Create free database
   - Copy Redis URL

2. **Add to Replit:**
   - Tools → Secrets
   - Add `REDIS_URL`
   - App auto-restarts

3. **Start Worker:**
   - New terminal: `npm run dev:worker`
   - Or create "Worker Process" workflow

4. **Test:**
   - Create scheduled post
   - Verify it queues successfully
   - Check worker logs

---

## 🐛 Troubleshooting

**App won't start:**
- Check logs for error messages
- Verify all required secrets are set
- Run `npm run check` for TypeScript errors

**Redis not connecting:**
- Verify `REDIS_URL` format: `redis://...`
- Check Upstash database is active
- Look for "Redis connected" in logs

**OAuth not working:**
- Verify redirect URI matches exactly
- Check credentials in Replit Secrets
- Ensure no extra spaces in secrets

**Worker not processing jobs:**
- Check worker process is running
- Verify Redis is connected
- Look for "Worker started" message

---

## 📚 Documentation

- **REDIS_SETUP.md** - Set up Redis for job queue
- **OAUTH_SETUP.md** - Add social media platforms
- **DEPLOYMENT.md** - Deploy to production (Render/Fly.io/VPS)
- **README.md** - Complete project documentation
- **replit.md** - Architecture and preferences

---

## 🆘 Need Help?

**Check logs:**
```bash
# Web server
pm2 logs web

# Worker process
pm2 logs worker
```

**Verify secrets:**
```bash
# Required secrets should be set:
echo $DATABASE_URL
echo $REDIS_URL
echo $JWT_SECRET
```

**Test endpoints:**
- Health check: `GET /healthz`
- Ready check: `GET /readyz`
- Metrics: `GET /metrics` (requires METRICS_TOKEN)

---

## ✨ Next Steps

1. Choose your deployment path (A or B above)
2. Follow the relevant setup guides
3. Test thoroughly in development
4. Deploy to production
5. Add remaining OAuth platforms as needed

**Ready to launch?** Start with **REDIS_SETUP.md** → 5 minutes to scheduled posts! 🚀
