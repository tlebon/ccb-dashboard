-- CCB Dashboard Database Schema

-- Performers (comedians)
CREATE TABLE IF NOT EXISTS performers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_performers_slug ON performers(slug);
CREATE INDEX IF NOT EXISTS idx_performers_name ON performers(name);

-- Teams (improv groups)
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    type TEXT CHECK(type IN ('house', 'indie', 'other')) DEFAULT 'other',
    coach_id INTEGER REFERENCES performers(id),
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);
CREATE INDEX IF NOT EXISTS idx_teams_type ON teams(type);

-- Team membership (many-to-many)
CREATE TABLE IF NOT EXISTS team_members (
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    performer_id INTEGER NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
    is_former INTEGER DEFAULT 0,
    PRIMARY KEY (team_id, performer_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_performer ON team_members(performer_id);

-- Shows
CREATE TABLE IF NOT EXISTS shows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    source TEXT CHECK(source IN ('ical', 'beeper', 'manual')) DEFAULT 'manual',
    ical_uid TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shows_date ON shows(date);
CREATE INDEX IF NOT EXISTS idx_shows_ical_uid ON shows(ical_uid);

-- Show appearances (who performed in which show)
CREATE TABLE IF NOT EXISTS show_appearances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    performer_id INTEGER NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
    role TEXT CHECK(role IN ('performer', 'host', 'guest', 'coach')) DEFAULT 'performer',
    team_id INTEGER REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_show_appearances_show ON show_appearances(show_id);
CREATE INDEX IF NOT EXISTS idx_show_appearances_performer ON show_appearances(performer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_show_appearances_unique ON show_appearances(show_id, performer_id, team_id);
