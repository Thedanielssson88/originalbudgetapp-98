# DATABASE CONFIGURATION - CRITICAL REFERENCE

**⚠️ NEVER MIX UP DEV AND PROD DATABASES ⚠️**

## User Database Routing Rules

### DEV User (Development)
- **User ID**: `dev-user-123`
- **Database**: DEV DEVELOPMENT DATABASE ONLY
- **URL**: `postgresql://neondb_owner:npg_csIURKah4TN5@ep-soft-salad-aeyhh2aj.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require`

### PROD Users (Production)
- **User ID**: ALL OTHER USERS (not dev-user-123)
- **Database**: PROD PRODUCTION DATABASE ONLY
- **URL**: `postgresql://neondb_owner:npg_yXbewGR9jN7K@ep-soft-cell-abj1n4kw-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require`

## Database Connection Details

### DEV DEVELOPMENT DATABASE
```
Database_URL: postgresql://neondb_owner:npg_csIURKah4TN5@ep-soft-salad-aeyhh2aj.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require
PGDATABASE: neondb
PGHOST: ep-soft-salad-aeyhh2aj.c-2.us-east-2.aws.neon.tech
PGPORT: 5432
PGUSER: neondb_owner
PGPASSWORD: npg_csIURKah4TN5
```

### PROD PRODUCTION DATABASE
```
Database_URL: postgresql://neondb_owner:npg_yXbewGR9jN7K@ep-soft-cell-abj1n4kw-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
PGHOST: ep-soft-cell-abj1n4kw-pooler.eu-west-2.aws.neon.tech
PGPORT: 5432
PGUSER: neondb_owner
PGPASSWORD: npg_yXbewGR9jN7K
```

## Environment Variables (PROD)
```
VITE_STACK_PROJECT_ID='9dcd4abe-925d-423b-ac64-d208074f0f61'
VITE_STACK_PUBLISHABLE_CLIENT_KEY='pck_4ypdc1r4zzmk9ffcj8g0ecc5fycca8qctwymdz0tc65xg'
STACK_SECRET_SERVER_KEY='ssk_spenst9m98pz5p5xm5tn2g8g8wte2hh84y3373vd23jrr'
DATABASE_URL='postgresql://neondb_owner:npg_yXbewGR9jN7K@ep-soft-cell-abj1n4kw-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
```

## Implementation Reference

The database routing is implemented in `/server/db.ts`:

```typescript
export function getUserDatabase(userId?: string) {
  if (userId === 'dev-user-123') {
    // ALWAYS use DEV database for dev-user-123
    return devDb;
  } else {
    // ALWAYS use PROD database for all other users
    return db;
  }
}
```

## Critical Rules

1. **dev-user-123** → DEV database ONLY
2. **All other users** → PROD database ONLY
3. **NEVER** mix these up
4. **ALWAYS** check user ID before database operations
5. **TEST** database connections when making changes
6. **ALL DEBUG LOGS** → Add to mobile debug log using `addMobileDebugLog()` for mobile visibility

## Quick Database Testing Commands

### Test DEV Database (for dev-user-123)
```bash
DATABASE_URL="postgresql://neondb_owner:npg_csIURKah4TN5@ep-soft-salad-aeyhh2aj.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require" psql $DATABASE_URL -c "SELECT COUNT(*) FROM accounts WHERE user_id = 'dev-user-123';"
```

### Test PROD Database (for other users)
```bash
DATABASE_URL="postgresql://neondb_owner:npg_yXbewGR9jN7K@ep-soft-cell-abj1n4kw-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" psql $DATABASE_URL -c "SELECT COUNT(*) FROM accounts WHERE user_id != 'dev-user-123';"
```

## Development Guidelines

### Mobile Debug Logging
- **ALWAYS** use `addMobileDebugLog()` for important debug information
- This ensures debugging info is visible on mobile devices
- Critical for API calls, database operations, and error tracking
- Example: `addMobileDebugLog('🌐 Making API call to server...')`

### Code Review Checklist
- [ ] Database routing correct (dev-user-123 → DEV, others → PROD)
- [ ] Debug logs added to mobile debug log
- [ ] Error handling implemented
- [ ] Testing completed on both databases

---
**Last Updated**: August 16, 2025
**Verified**: Database connections working correctly with proper user routing
**Mobile Debug**: All debug logs should use addMobileDebugLog() function