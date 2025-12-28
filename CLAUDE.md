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

## Automated Testing

### CRITICAL: Run Tests at End of Every Iteration

**IMPORTANT:** You MUST run tests automatically at the end of EVERY task or iteration to catch regressions. This is NON-NEGOTIABLE.

**Workflow:**

1. Complete your code changes (edits, new files, refactoring, etc.)
2. IMMEDIATELY run: `pnpm test`
3. If tests fail:
   - DO NOT commit
   - DO NOT move to next task
   - FIX the failing tests or update them if behavior intentionally changed
   - Re-run tests until all pass
4. Only after ALL tests pass:
   - Proceed with git commit
   - Move to next task

**Example:**

```bash
# After making changes to houseShowTeams.ts
pnpm test src/lib/utils/houseShowTeams.test.ts

# If all pass, run full test suite
pnpm test

# Only then commit
git add .
git commit -m "feat: update house team rotation logic"
```

### Running Tests

This project uses Vitest for automated testing. Tests are co-located with source files (e.g., `houseShowTeams.test.ts` next to `houseShowTeams.ts`).

```bash
# Run all tests
pnpm test

# Run tests in watch mode (during development)
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage report
pnpm test:coverage

# Run specific test suites
pnpm test:unit        # Utility functions only
pnpm test:integration # Database operations
pnpm test:api         # API endpoints
```

### Writing New Tests

When adding new features or modifying existing code:

1. Create a `.test.ts` file next to the source file
2. Follow existing test patterns (see `houseShowTeams.test.ts` as reference)
3. Aim for high coverage of business logic and edge cases
4. Mock external dependencies (database, APIs, environment variables)

**Test File Naming:**

- `src/lib/utils/houseShowTeams.ts` → `src/lib/utils/houseShowTeams.test.ts`
- `src/lib/db/shows.ts` → `src/lib/db/shows.test.ts`
- `src/routes/api/shows/+server.ts` → `src/routes/api/shows/+server.test.ts`

### Test Coverage Standards

- **Utility functions:** 80%+ coverage (pure logic, easy to test)
- **Database operations:** 70%+ coverage (integration tests with mock DB)
- **API endpoints:** 60%+ coverage (focus on critical paths)
- **Components:** 50%+ coverage (focus on user interactions)

Run `pnpm test:coverage` to see current coverage levels.

### Mocking in Tests

**Environment Variables:** Automatically mocked in `vitest.setup.ts`

**Database:** Use in-memory SQLite for integration tests:

```typescript
import { createClient } from '@libsql/client';
const db = createClient({ url: 'file::memory:?cache=shared' });
```

**Vercel Blob:** Mock the module:

```typescript
vi.mock('@vercel/blob', () => ({
	put: vi.fn().mockResolvedValue({ url: 'https://blob.vercel-storage.com/test.jpg' })
}));
```

### Manual Browser Testing with Playwright

For complex UI behaviors that are difficult to test with Vitest (like infinite scroll, scroll position, animations), use Playwright for browser automation testing.

**Installation:**

Playwright is included in devDependencies. No additional setup needed.

**Writing Playwright Test Scripts:**

Create standalone `.mjs` scripts for manual testing scenarios. These are debugging tools, NOT automated tests.

**Example: Testing Infinite Scroll**

```javascript
// test-scroll-behavior.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('http://localhost:5173');

// Wait for initial load
await page.waitForTimeout(2000);

// Test scroll down (load future shows)
console.log('=== Testing scroll down ===');
const scrollContainer = await page.locator('.shows-column-container').first();
await scrollContainer.evaluate(el => el.scrollTop = el.scrollHeight);
await page.waitForTimeout(1000);

// Test scroll up (load past shows)
console.log('=== Testing scroll up ===');
await scrollContainer.evaluate(el => el.scrollTop = 0);
await page.waitForTimeout(1000);

// Capture state
const state = await page.evaluate(() => ({
	scrollTop: document.querySelector('.shows-column-container').scrollTop,
	showCount: document.querySelectorAll('[data-day-shows]').length
}));
console.log('Final state:', state);

await browser.close();
```

**Running Playwright Tests:**

```bash
# Start dev server first
pnpm dev

# In another terminal, run your test script
node test-scroll-behavior.mjs
```

**Common Testing Patterns:**

- **Scroll position verification**: Check `scrollTop` before/after operations
- **DOM state inspection**: Count elements, verify visibility
- **Animation verification**: Wait for transitions, check computed styles
- **Event simulation**: Scroll, click, touch events
- **Console logging**: Capture browser console output with `page.on('console')`

**When to Use Playwright:**

- Testing scroll behavior and infinite scroll
- Verifying visual regressions
- Testing touch interactions on mobile
- Debugging IntersectionObserver issues
- Checking animation timing and transitions

**Important Notes:**

- Playwright scripts are for manual testing/debugging only
- Do NOT commit Playwright scripts to the repository
- Use for one-off debugging, then delete when done
- For automated tests, use Vitest with `@testing-library/svelte`

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
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token for image caching

The proxy URLs point to a personal proxy server that adds browser headers to avoid Cloudflare 403 errors when fetching from CCB's website.

**Analytics Access:**

- `ANALYTICS_UNLOCK_SECRET` - (Optional) Secret value for unlocking analytics page access. Defaults to `unlock` in development.

## Analytics Access Control

The `/analytics` page is protected by a simple cookie-based access control mechanism:

**How to unlock access:**
Visit any page with the unlock query parameter: `?analytics=<secret>`

- Example: `https://your-site.com/?analytics=unlock` (development)
- Example: `https://your-site.com/?analytics=<your-secret>` (production with ANALYTICS_UNLOCK_SECRET set)

The system will:

1. Verify the secret using constant-time comparison (prevents timing attacks)
2. Set a persistent cookie that lasts 1 year (users will need to re-unlock annually)
3. Redirect to the same page without the query parameter (removes secret from URL bar/history)
4. Analytics link will appear in navigation

**Note:** If deploying to production without setting `ANALYTICS_UNLOCK_SECRET`, a warning will be logged that the default "unlock" value is being used.

**How to revoke everyone's access:**
To invalidate all existing cookies and revoke access for everyone:

1. Edit `src/lib/server/analytics-constants.ts`
2. Change `ANALYTICS_VERSION` from `v1` to `v2` (or any new value)
3. Deploy the change

All existing cookies will become invalid since they're checking for the old version. Users will need to unlock again with the secret.

**Implementation:**

- Access control is "soft security" - designed to hide analytics from casual visitors, not protect sensitive data
- Unauthorized users are automatically redirected to homepage (no "Access Denied" message to avoid revealing page existence)
- Secret verification uses constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks
- Cookie constants and verification function in `src/lib/server/analytics-constants.ts`
- Hook handler in `src/hooks.server.ts` (sets cookie and redirects)
- Page server load in `src/routes/analytics/+page.server.ts` (handles redirect for direct access)
- Navigation components conditionally show/hide analytics link based on cookie presence

## Cron Jobs

- `/api/sync/ical` - Syncs shows from CCB's iCal feed, runs daily at 6am UTC (configured in `vercel.json`)

## Cloudflare Blocking

CCB's website (comedycafeberlin.com) is behind Cloudflare which blocks requests from cloud provider IPs (like Vercel). Solutions:

- **iCal sync**: Uses `VITE_PROXY_ICAL_URL` proxy
- **Images**: Cached to Vercel Blob during iCal sync (images are fetched via proxy and stored permanently)

## Image Caching

Images are automatically cached to Vercel Blob storage during the iCal sync process:

1. Images are fetched from CCB event pages via proxy
2. Uploaded to Vercel Blob with consistent filenames
3. Blob URLs are stored in the database

**Endpoints:**

- `GET /api/sync/images` - Check caching status (how many images are cached vs uncached)
- `POST /api/sync/images` - Migrate existing CCB images to Vercel Blob (requires `SYNC_SECRET` auth)

**Setup:**

1. Create a Vercel Blob store in the Vercel dashboard
2. Add `BLOB_READ_WRITE_TOKEN` environment variable
3. Run a one-time migration for existing images: `POST /api/sync/images`
