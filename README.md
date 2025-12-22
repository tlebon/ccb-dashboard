# Comedy Cafe Berlin Dashboard

A dashboard and show management system for [Comedy Cafe Berlin](https://www.comedycafeberlin.com), Berlin's first international, alternative comedy venue.

## Features

### Schedule Display

- **Weekly calendar** with shows grouped by day
- **Monitor mode** for in-venue displays with auto-rotation between weeks
- **Past show greying** - shows earlier in the week are dimmed, auto-scrolls to upcoming shows
- **Color themes** - blue for current week, orange for future weeks

### Show & Performer Database

- **Show pages** with images, descriptions, and performer lineups
- **Performer profiles** with photos, bios, and show history
- **Team pages** with member rosters and upcoming performances
- **House team rotation** tracking (which teams perform which Fridays)

### Analytics

- Show frequency statistics
- Performer appearance counts
- Team overlap analysis
- Historical show data

### Mobile Support

- Responsive layout for all screen sizes
- Swipe gestures for week navigation
- Mobile-optimized navigation

## Tech Stack

- **Framework**: SvelteKit with Svelte 5
- **Database**: Turso (libSQL)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Data Sync

Show data is synced from the CCB website calendar. Lineups and performer info are scraped from public event pages.

```bash
# Sync shows from iCal feed
npx tsx scripts/sync-ccb.ts

# Sync lineups from show pages
npx tsx scripts/sync-ccb.ts --lineups
```

## Environment Variables

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

## License

MIT
