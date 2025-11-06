# Production Security Enhancements

This document outlines the production security improvements implemented for Picscripterai.

## 1. Versioned Encryption Key Rotation ✅

### Implementation

**File:** `server/utils/encryption.ts`

Encryption now supports versioned key management using:
- `ENCRYPTION_KEY_CURRENT`: Current active key ID (default: "v1")
- `ENCRYPTION_KEYS_JSON`: JSON object mapping key IDs to key values

**Format:**
```json
{
  "v1": "your-old-key-hex-or-passphrase",
  "v2": "your-new-key-hex-or-passphrase"
}
```

**How it works:**
- New tokens are encrypted with `ENCRYPTION_KEY_CURRENT`
- Old tokens can still be decrypted using their embedded key ID
- Format: `kid:iv:authTag:encryptedData`
- Backward compatible with legacy 3-part format

### Key Rotation Process

1. **Add new key** to `ENCRYPTION_KEYS_JSON`:
   ```json
   {
     "v1": "old-key",
     "v2": "new-key"
   }
   ```

2. **Update** `ENCRYPTION_KEY_CURRENT=v2`

3. **Run re-encryption script:**
   ```bash
   tsx server/scripts/rotate-encryption-keys.ts
   ```

This script:
- ✅ Re-encrypts all OAuth tokens with new key
- ✅ Supports both social media and e-commerce connections  
- ✅ Skips already-rotated tokens
- ✅ Provides detailed progress and error reporting

### Environment Variables

**Legacy (still supported):**
```bash
ENCRYPTION_KEY=your-32-char-min-secret
```

**New (recommended for production):**
```bash
ENCRYPTION_KEYS_JSON='{"v1":"key1","v2":"key2"}'
ENCRYPTION_KEY_CURRENT=v2
```

---

## 2. Audit Logging System ✅

### Implementation

**Files:**
- `shared/schema.ts` - `auditEvents` table
- `server/utils/audit.ts` - Audit logging utilities

### Audit Events Table

Tracks all sensitive security actions:

```typescript
{
  id: string (UUID)
  userId: string
  action: AuditAction  // Enum of allowed actions
  resourceType: string  // e.g., "connection", "post", "draft"
  resourceId: string    // ID of affected resource
  metadata: jsonb       // Additional context
  ipAddress: string
  userAgent: string
  createdAt: timestamp
}
```

### Tracked Actions

- `user.login` - User authentication
- `user.logout` - User session termination
- `user.register` - New user registration
- `connection.create` - OAuth platform connection
- `connection.delete` - OAuth platform disconnection
- `ecommerce_connection.create` - E-commerce platform connection
- `ecommerce_connection.delete` - E-commerce platform disconnection
- `post.create` - New post creation
- `post.update` - Post modification
- `post.delete` - Post deletion
- `post.schedule` - Post scheduling
- `post.publish` - Post publication
- `draft.create` - Draft creation
- `draft.update` - Draft modification
- `draft.delete` - Draft deletion

### Usage Example

```typescript
import { audit } from "@/utils/audit";

// In authentication route
await audit.userLogin(userId, req);

// In connection creation
await audit.connectionCreate(userId, platform, connectionId, req);

// In post deletion
await audit.postDelete(userId, postId, platform, req);
```

### Admin Audit Endpoint

**GET /admin/audit** (requires admin middleware)

Query parameters:
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50, max: 200)
- `userId` - Filter by user ID
- `action` - Filter by action type
- `startDate` - Filter by date range (ISO 8601)
- `endDate` - Filter by date range (ISO 8601)

Response:
```json
{
  "events": [...],
  "total": 1234,
  "page": 1,
  "limit": 50,
  "pages": 25
}
```

### Admin Access Setup

**Option 1: Environment Variable**
```bash
ADMIN_USER_IDS=user-id-1,user-id-2,user-id-3
```

**Option 2: Database Column** (future enhancement)
Add `isAdmin` boolean to `users` table.

---

## 3. Hardened CORS Configuration ✅

### Implementation

**File:** `server/index.ts`

CORS now supports:
- ✅ Comma-separated origin allowlist
- ✅ Wildcard blocking in production
- ✅ Per-request origin validation

### Configuration

**Development:**
```bash
CORS_ORIGIN=http://localhost:5000,http://localhost:3000
```

**Production:**
```bash
CORS_ORIGIN=https://picscripter.com,https://app.picscripter.com
```

**Multiple origins:**
```bash
CORS_ORIGIN=https://picscripter.com,https://app.picscripter.com,https://staging.picscripter.com
```

### Security Rules

1. ❌ **No wildcards in production** - `*` throws error
2. ✅ **Exact origin matching** - Only allowlisted origins accepted
3. ✅ **Credentials support** - Cookies/auth headers allowed
4. ✅ **No-origin requests** - Mobile apps and tools allowed

### Error Handling

Invalid origins receive:
```
Error: Origin https://unauthorized.com not allowed by CORS
```

---

## 4. Secure Session/JWT Settings ✅

### Implementation

**File:** `server/utils/jwt.ts`, `server/config/env.ts`

### Token TTL Configuration

**Environment Variables:**
```bash
ACCESS_TOKEN_TTL=15m      # Short-lived access tokens
REFRESH_TOKEN_TTL=30d     # Long-lived refresh tokens
```

Default values if not set:
- Access: 15 minutes
- Refresh: 30 days

### Token Generation

```typescript
// Access token (15m)
const accessToken = signToken(payload, "access");

// Refresh token (30d)
const refreshToken = signToken(payload, "refresh");
```

### Cookie Security (when implemented)

For production cookie-based auth:
```javascript
res.cookie('accessToken', token, {
  httpOnly: true,        // ✅ JavaScript cannot access
  secure: true,          // ✅ HTTPS only
  sameSite: 'strict',    // ✅ CSRF protection
  maxAge: 15 * 60 * 1000 // 15 minutes
});
```

---

## Production Deployment Checklist

### Required Environment Variables

```bash
# Core
DATABASE_URL=postgresql://...
JWT_SECRET=<32+ char random string>

# Encryption (new format)
ENCRYPTION_KEYS_JSON='{"v1":"key1"}'
ENCRYPTION_KEY_CURRENT=v1

# Security
CORS_ORIGIN=https://picscripter.com,https://app.picscripter.com
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d

# Admin Access
ADMIN_USER_IDS=<admin-user-id-1>,<admin-user-id-2>
```

### Database Migration

After deploying code changes:
```bash
npm run db:push
```

This creates the `audit_events` table.

### Verification Steps

1. **Encryption:**
   ```bash
   # Test that old tokens still decrypt
   # New tokens should have v1: prefix
   ```

2. **Audit Logs:**
   ```bash
   # Login to app
   # Check GET /admin/audit shows event
   ```

3. **CORS:**
   ```bash
   # Try accessing from unauthorized origin
   # Should receive CORS error
   ```

4. **JWT TTL:**
   ```bash
   # Access token should expire in 15m
   # Refresh token should work for 30d
   ```

---

## Security Best Practices

### Key Rotation Schedule

- **Encryption keys:** Rotate every 90 days
- **JWT secrets:** Rotate annually or after breach
- **Admin credentials:** Review quarterly

### Monitoring

Monitor `audit_events` for:
- Unusual login patterns
- Bulk connection deletions
- Failed authentication attempts
- Administrative actions

### Incident Response

If keys are compromised:

1. **Immediately** add new key to `ENCRYPTION_KEYS_JSON`
2. **Update** `ENCRYPTION_KEY_CURRENT`
3. **Run** rotation script
4. **Verify** all tokens re-encrypted
5. **Remove** old key after 30 days (grace period)

---

## Architecture Decisions

### Why JSON for Key Storage?

- ✅ Multiple keys in single env var
- ✅ Easy key rotation without downtime
- ✅ Version tracking built-in
- ✅ Backward compatibility

### Why Audit Table vs. Logs?

- ✅ Queryable with SQL
- ✅ Structured data
- ✅ Long-term retention
- ✅ Compliance-ready
- ✅ Admin UI support

### Why Comma-Separated CORS?

- ✅ Simple configuration
- ✅ No complex JSON parsing
- ✅ Easy to read in env panel
- ✅ Supports multiple staging environments

---

## Testing

### Unit Tests (to be added)

```bash
# Test encryption with multiple keys
npm test -- encryption.test.ts

# Test audit logging
npm test -- audit.test.ts

# Test CORS validation
npm test -- cors.test.ts
```

### Integration Tests

1. Create user → Check audit log
2. Rotate encryption key → Verify old tokens work
3. Try unauthorized CORS origin → Should fail
4. Generate JWT → Should expire per TTL

---

## Rollback Plan

If issues occur after deployment:

### Encryption Rollback
1. Revert `ENCRYPTION_KEY_CURRENT` to old value
2. No data loss - old keys still in JSON

### Audit Logging Rollback
1. Disable audit calls (graceful failures)
2. No app disruption

### CORS Rollback
1. Add `*` to allowlist (temporary)
2. Fix origin list
3. Remove wildcard

### JWT Rollback
1. Revert TTL to previous values
2. Users may need to re-login

---

## Future Enhancements

- [ ] Rate limiting per user ID (not just IP)
- [ ] 2FA/MFA support
- [ ] Audit log export (CSV/JSON)
- [ ] Real-time audit alerts (email/Slack)
- [ ] Admin dashboard for audit review
- [ ] Automated key rotation (cron)
- [ ] Session management UI
- [ ] IP allowlist/blocklist
- [ ] Anomaly detection in audit logs

---

## Support

For security issues:
- **Never** commit secrets to Git
- **Always** use environment variables
- **Test** in staging before production
- **Monitor** audit logs regularly
- **Rotate** keys on schedule

**Questions?** Review this document and the inline code comments in:
- `server/utils/encryption.ts`
- `server/utils/audit.ts`
- `server/config/env.ts`
- `server/index.ts`
