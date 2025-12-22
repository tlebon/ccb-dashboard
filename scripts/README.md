# Database Scripts & Migrations

This directory contains one-time migration scripts and utility scripts for managing the CCB Dashboard database.

## Migration History

### 2025-12-22: Add 'schedule' Source & Indexes

**File**: `migrate-add-schedule-source.ts`

**What it does**:

- Adds 'schedule' to the allowed values for `shows.source` column
- Creates indexes on `date` and `slug` columns for query performance

**Why**: The new schedule scraper (`/api/sync/schedule`) needed to store shows with `source='schedule'`, but the database CHECK constraint only allowed `('ical', 'beeper', 'manual')`.

**How it was run**:

1. Migration script was executed once in production to recreate the table with updated constraint
2. Indexes were added directly via:
   ```bash
   npx tsx scripts/db-query.ts "CREATE INDEX IF NOT EXISTS idx_shows_date ON shows(date)"
   npx tsx scripts/db-query.ts "CREATE INDEX IF NOT EXISTS idx_shows_slug ON shows(slug)"
   ```

**Status**: ✅ Completed on production database

**Related PR**: #6 - Infinite Scroll with Viewport-Synced Posters

**Note**: The migration script recreates the entire `shows` table by:

1. Creating `shows_new` with updated schema
2. Copying all data from `shows` to `shows_new`
3. Dropping old `shows` table
4. Renaming `shows_new` to `shows`
5. Creating indexes

This is a high-risk operation. Future migrations should use `ALTER TABLE` when possible.

---

## Running Migrations

All migration scripts require environment variables:

- `TURSO_DATABASE_URL` - Turso database connection URL
- `TURSO_AUTH_TOKEN` - Turso authentication token

These are loaded from `.env` file automatically.

**To run a migration**:

```bash
npx tsx scripts/migrate-add-schedule-source.ts
```

⚠️ **Warning**: Migration scripts modify the database schema. Always:

1. Back up production data first
2. Test on a staging database
3. Review the script carefully before running
4. Document when/how it was run (update this README)

---

## Utility Scripts

### Query Wrapper

**File**: `db-query.ts`

Executes SQL queries against the database with automatic environment loading.

```bash
# Simple query
npx tsx scripts/db-query.ts "SELECT * FROM shows LIMIT 5"

# Run a script file
npx tsx scripts/db-query.ts -f scripts/some-script.ts
```

### Data Import/Sync Scripts

- `sync-ccb.ts` - Sync shows from CCB iCal feed
- `sync-performers-from-ccb.ts` - Sync performer data
- `backfill-*.ts` - Various backfill scripts for historical data
- `import-historical.ts` - Import historical show data

### One-Time Fix Scripts

These scripts were run once to fix data issues:

- `add-show-slugs.ts` - Added slugs to existing shows
- `fix-beeper-dates.ts` - Fixed incorrect dates from Beeper import
- `link-team-shows.ts` - Linked shows to teams
- `populate-house-show-appearances.ts` - Populated house show team appearances

**Note**: One-time scripts should be kept for historical reference but marked clearly that they shouldn't be run again.

---

## Adding New Migrations

When adding a new migration:

1. **Create the script** in this directory with a descriptive name:

   - Use format: `migrate-description-of-change.ts`
   - Example: `migrate-add-schedule-source.ts`

2. **Add validation**:

   ```typescript
   if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
   	throw new Error('Missing required environment variables');
   }
   ```

3. **Test thoroughly**:

   - Test on local database first
   - Verify data integrity after migration
   - Check that rollback is possible (if applicable)

4. **Document it**:

   - Add entry to "Migration History" section above
   - Include date, what changed, why, and how it was run
   - Mark as completed when done

5. **Commit the script** (but don't commit credentials!)
