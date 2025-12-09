/**
 * Link October 2025 team shows to their teams via team members
 */

import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN
});

const showTeamMap = [
  { showId: 1161, teamId: 56 },  // Health Plan
  { showId: 1162, teamId: 80 },  // Turtle Logic
  { showId: 1165, teamId: 89 },  // GLB
  { showId: 1168, teamId: 42 },  // Full Fat Bear Milk
  { showId: 1172, teamId: 71 },  // Smash Cut
  { showId: 1173, teamId: 94 },  // Cuter Than Hedgehogs (The Hedge)
  { showId: 1184, teamId: 39 },  // Action Jackson
  { showId: 1186, teamId: 86 },  // Tales Held Dear
  // House Shows
  { showId: 1174, teamId: 79 },  // Oct 17 House Show - Thunderclap! (3rd Fri)
  { showId: 1174, teamId: 47 },  // Oct 17 House Show - Capiche (3rd Fri)
  { showId: 1185, teamId: 45 },  // Oct 24 House Show - Brace! Brace! (4th Fri)
  { showId: 1185, teamId: 90 },  // Oct 24 House Show - Handshake (4th Fri)
];

async function main() {
  for (const { showId, teamId } of showTeamMap) {
    // Get team members
    const members = await db.execute({
      sql: 'SELECT performer_id FROM team_members WHERE team_id = ? AND is_former = 0',
      args: [teamId]
    });

    console.log(`Show ${showId}, Team ${teamId}: ${members.rows.length} members`);

    for (const m of members.rows) {
      // Check if already exists
      const existing = await db.execute({
        sql: 'SELECT id FROM show_appearances WHERE show_id = ? AND performer_id = ?',
        args: [showId, m.performer_id]
      });

      if (existing.rows.length === 0) {
        await db.execute({
          sql: 'INSERT INTO show_appearances (show_id, performer_id, team_id, role) VALUES (?, ?, ?, ?)',
          args: [showId, m.performer_id, teamId, 'performer']
        });
        console.log(`  Added performer ${m.performer_id}`);
      }
    }
  }
  console.log('Done!');
}

main().catch(console.error);
