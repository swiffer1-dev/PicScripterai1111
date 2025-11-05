# Quick Start: Database Migrations

## For Fresh Clone

After cloning this repository:

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set DATABASE_URL**
   ```bash
   export DATABASE_URL="postgresql://user:pass@host:port/database"
   ```

3. **Run migrations**
   ```bash
   npx drizzle-kit migrate
   ```

## Add NPM Scripts (Optional)

To use `npm run db:generate` and `npm run db:migrate`, add these to `package.json`:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

Then you can run:
```bash
npm run db:generate  # Generate new migrations after schema changes
npm run db:migrate   # Apply migrations to database
```

## Schema Highlights

- **11 tables** including users, connections, posts, jobs, analytics_events
- **Unique index** on connections(user_id, platform) - prevents duplicate platform connections
- **Foreign keys** with CASCADE delete for referential integrity
- **Enums** for platform, status, event types

See [MIGRATION_SETUP.md](./MIGRATION_SETUP.md) for complete documentation.
