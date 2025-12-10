# CCB Dashboard - Claude Code Instructions

## Database Queries

Always use the database query wrapper script for database operations:

```bash
# Simple SQL query
npx tsx scripts/db-query.ts "SELECT * FROM shows LIMIT 5"

# Multiple clauses - quote the entire query
npx tsx scripts/db-query.ts "SELECT * FROM shows WHERE date > '2025-01-01' ORDER BY date DESC LIMIT 10"

# Run a script file (must export default async function that receives db client)
npx tsx scripts/db-query.ts -f scripts/some-script.ts
```

The wrapper automatically loads environment variables from `.env` file (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN).

## Project Structure

- **Framework**: SvelteKit with Svelte 5 (runes: `$state`, `$derived`, `$effect`)
- **Database**: Turso (libSQL)
- **Styling**: Tailwind CSS with custom color variables
- **Deployment**: Vercel

## Key Data Files

- `src/lib/utils/houseShowTeams.ts` - House team rotation logic (which teams perform which Fridays)
- `src/lib/db/` - Database client and query functions
- `scripts/` - Database migration and import scripts

## House Teams

Only 4 current house teams:
- Brace! Brace! (2nd & 4th Fridays) - original
- Thunderclap! (1st & 3rd Fridays) - original
- Handshake (1st & 4th Fridays) - started January 2025
- Capiche (2nd & 3rd Fridays) - started August 2025, replaced Pizza Studio

Former house teams (retired but still perform): Pizza Studio, People System, Funfdollar

## Environment Variables

Vercel environment variables (set in Vercel dashboard):
- `TURSO_DATABASE_URL` - Turso database connection URL
- `TURSO_AUTH_TOKEN` - Turso auth token
- `VITE_PROXY_ICAL_URL` - Proxy URL for fetching CCB iCal feed (bypasses Cloudflare blocking)
- `VITE_PROXY_EVENT_URL` - Proxy URL for fetching CCB event pages

The proxy URLs point to a personal proxy server that adds browser headers to avoid Cloudflare 403 errors when fetching from CCB's website.

## Cron Jobs

- `/api/sync/ical` - Syncs shows from CCB's iCal feed, runs daily at 6am UTC (configured in `vercel.json`)

## Cloudflare Blocking

CCB's website (comedycafeberlin.com) is behind Cloudflare which blocks requests from cloud provider IPs (like Vercel). Solutions:
- **iCal sync**: Uses `VITE_PROXY_ICAL_URL` proxy
- **Images**: Load directly from CCB (browser fetches work, server-side fetches get blocked)
