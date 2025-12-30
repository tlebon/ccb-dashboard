# Lineup Data Backups

This directory contains JSON exports of lineup and team-show association data.

## Why?

This data is critical and time-consuming to rebuild:
- Performer lineups extracted from event pages via web scraping
- Team-show associations based on title matching
- Manual curation and cleanup of bad data

If the Turso database is deleted or corrupted, we can restore this data from these backups.

## Files

- `lineup-data-latest.json` - Most recent export (always up-to-date)
- `lineup-data-YYYY-MM-DDTHH-MM-SS.json` - Timestamped backups

## Data Structure

Each backup contains:
```json
{
  "exported_at": "ISO timestamp",
  "total_appearances": 2742,
  "data": [
    {
      "show_id": 123,
      "show_title": "Action Jackson",
      "show_date": "2025-01-16",
      "show_url": "https://...",
      "performer_id": 45,
      "performer_name": "Noah Telson",
      "performer_slug": "noah-telson",
      "role": "performer",
      "team_id": 39,
      "team_name": "Action Jackson",
      "team_slug": "action-jackson"
    }
  ]
}
```

## Creating Backups

```bash
# Export current lineup data
npx tsx scripts/export-lineup-data.ts
```

Run this script:
- Before major database migrations
- After running team-linking scripts
- Periodically (monthly or after significant changes)

## Restoring from Backup

If the database is lost, you can restore lineup data by:

1. Ensuring shows, performers, and teams tables are populated
2. Reading the latest backup JSON
3. Recreating show_appearances entries by matching slugs

A restore script can be created if needed, but for now manual restoration via SQL is acceptable since this is a rare occurrence.

## Git Ignore

This directory is in `.gitignore` to avoid bloating the repository with large JSON files. Keep backups:
- Locally on your development machine
- In cloud storage (Dropbox, Google Drive, etc.)
- On the production server (Vercel environment)
