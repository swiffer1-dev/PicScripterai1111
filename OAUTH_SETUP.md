# OAuth Platform Setup Guide

**Status:** ⚠️ LIMITED - Only 3/10 platforms configured

## Current Status

✅ **Configured:**
- Pinterest
- Etsy  
- Shopify

❌ **Missing Credentials:**
- Instagram
- TikTok
- Twitter/X
- LinkedIn
- YouTube
- Facebook
- Squarespace

---

## Why OAuth Credentials Are Needed

Without credentials, users can't connect to platforms. Each platform requires:
- Client ID
- Client Secret
- Redirect URI configuration

---

## Platform Setup Instructions

### 1. Instagram Graph API

**Requirements:**
- Facebook Developer Account
- Facebook Business Page
- Instagram Business/Creator Account linked to Page

**Setup:**
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create app → **"Business"** type
3. Add **"Instagram Graph API"** product
4. Configure OAuth redirect URI:
   ```
   https://your-app.replit.dev/api/oauth/instagram/callback
   ```
5. Get credentials from **App Settings → Basic**

**Add to Replit Secrets:**
```
INSTAGRAM_CLIENT_ID=your_app_id
INSTAGRAM_CLIENT_SECRET=your_app_secret
```

**Note:** Instagram deprecated the Basic Display API (December 2024). You MUST use Instagram Graph API with a Business/Creator account.

---

### 2. TikTok Content Posting API

**Requirements:**
- TikTok Developer Account
- App approval (can take 2-3 weeks)

**Setup:**
1. Go to [developers.tiktok.com](https://developers.tiktok.com)
2. Create app → Select **"Content Posting API"**
3. Request **"Video Upload"** permission
4. Configure redirect URI:
   ```
   https://your-app.replit.dev/api/oauth/tiktok/callback
   ```
5. Wait for approval
6. Get Client Key and Client Secret

**Add to Replit Secrets:**
```
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
```

---

### 3. Twitter/X API v2

**Requirements:**
- Twitter Developer Account (Elevated Access required for posting)
- ~$100/month for Basic tier or Elevated Access approval

**Setup:**
1. Go to [developer.twitter.com](https://developer.twitter.com)
2. Apply for Elevated Access (required for posting)
3. Create app → Enable OAuth 2.0
4. Configure redirect URI:
   ```
   https://your-app.replit.dev/api/oauth/twitter/callback
   ```
5. Get Client ID and Client Secret

**Add to Replit Secrets:**
```
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
```

**Important:** Free tier doesn't allow posting. You need Elevated Access or paid plan.

---

### 4. LinkedIn Posts API

**Requirements:**
- LinkedIn Developer Account
- App verification (can take 1-2 weeks)

**Setup:**
1. Go to [developer.linkedin.com](https://developer.linkedin.com)
2. Create app
3. Add **"Share on LinkedIn"** product
4. Configure redirect URI:
   ```
   https://your-app.replit.dev/api/oauth/linkedin/callback
   ```
5. Request **"w_member_social"** permission
6. Wait for approval
7. Get Client ID and Client Secret

**Add to Replit Secrets:**
```
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
```

---

### 5. YouTube Data API v3

**Requirements:**
- Google Cloud Project
- YouTube Data API enabled
- OAuth consent screen configured

**Setup:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create project
3. Enable **YouTube Data API v3**
4. Configure OAuth consent screen
5. Create OAuth 2.0 credentials
6. Add redirect URI:
   ```
   https://your-app.replit.dev/api/oauth/youtube/callback
   ```
7. Get Client ID and Client Secret

**Add to Replit Secrets:**
```
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
```

---

### 6. Facebook Pages API

**Requirements:**
- Facebook Developer Account
- Facebook Page (to post to)

**Setup:**
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create app → **"Business"** type
3. Add **"Facebook Login"** product
4. Configure OAuth redirect URI:
   ```
   https://your-app.replit.dev/api/oauth/facebook/callback
   ```
5. Request **"pages_manage_posts"** permission
6. Get App ID and App Secret

**Add to Replit Secrets:**
```
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
```

---

### 7. Squarespace Commerce API

**Requirements:**
- Squarespace developer account
- OAuth app registration

**Setup:**
1. Contact Squarespace developer support
2. Request OAuth app credentials
3. Provide redirect URI:
   ```
   https://your-app.replit.dev/api/oauth/squarespace/callback
   ```
4. Wait for approval
5. Get Client ID and Client Secret

**Add to Replit Secrets:**
```
SQUARESPACE_CLIENT_ID=your_client_id
SQUARESPACE_CLIENT_SECRET=your_client_secret
```

---

## Quick Launch Strategy

### Phase 1: Launch with Existing (Fastest)
✅ Pinterest, Etsy, Shopify are ready  
👉 Deploy now, add other platforms later

### Phase 2: Add Priority Platforms
1. **Instagram** (most requested)
2. **Facebook** (easiest to set up)
3. **YouTube** (high value)

### Phase 3: Complete Coverage
4. TikTok (approval wait)
5. LinkedIn (approval wait)
6. Twitter/X (requires paid plan)
7. Squarespace (manual approval)

---

## Testing OAuth Flows

After adding credentials:

1. Restart app to load new secrets
2. Go to **Connections** page
3. Click **"Connect [Platform]"**
4. Authorize and verify redirect works
5. Check connection appears in dashboard

---

## Common Issues

**"Redirect URI mismatch"**
- Update redirect URI in platform developer dashboard
- Must exactly match: `https://your-app.replit.dev/api/oauth/[platform]/callback`

**"Invalid client credentials"**
- Double-check Client ID and Secret
- Ensure no extra spaces in Replit Secrets

**"Permission denied"**
- Request required scopes/permissions in developer dashboard
- Some platforms require app review/approval

---

## Production Deployment

When deploying to custom domain:

1. Update all OAuth redirect URIs to your domain:
   ```
   https://yourdomain.com/api/oauth/[platform]/callback
   ```

2. Update `CORS_ORIGIN` environment variable:
   ```
   CORS_ORIGIN=https://yourdomain.com
   ```

3. Restart all processes

---

## Cost Summary

| Platform | Setup Cost | Approval Time |
|----------|-----------|--------------|
| Pinterest | Free | Instant |
| Etsy | Free | 1-3 weeks |
| Shopify | Free | Instant |
| Instagram | Free | Instant |
| Facebook | Free | Instant |
| YouTube | Free | Instant |
| TikTok | Free | 2-3 weeks |
| LinkedIn | Free | 1-2 weeks |
| Twitter/X | $100/mo | Instant |
| Squarespace | Free | Manual |

**Total:** $100/month (only if you want Twitter/X)

---

## Next Steps

1. Choose which platforms to prioritize
2. Register developer accounts
3. Set up OAuth apps
4. Add credentials to Replit Secrets
5. Test connections
6. Launch! 🚀
