const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const FIXTURE_YEAR = process.env.FIXTURE_YEAR || '2026';
const ENABLE_MOCK_SCORES = process.env.ENABLE_MOCK_SCORES === 'true';
const SCORE_POLL_INTERVAL_MS = Number(process.env.SCORE_POLL_INTERVAL_MS || 8 * 60 * 60 * 1000);
const ALL_RUGBY_NATIONS_CHAMPIONSHIP_URL = process.env.ALL_RUGBY_NATIONS_CHAMPIONSHIP_URL || 'https://all.rugby/tournament/nations-championship/fixtures-results';
const MATCH_DURATION_MS = 100 * 60 * 1000;

let scoreUpdateInProgress = false;
let scorePollingStarted = false;
let allRugbyScoreCache = { fetchedAt: 0, scores: [] };

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      // App is served over plain HTTP (localhost/Docker), so don't force
      // the browser to upgrade subresource requests to HTTPS.
      'upgrade-insecure-requests': null
    }
  }
}));

// Restrict cross-origin access. Set ALLOWED_ORIGIN to lock down to a known
// frontend origin; defaults to same-origin only (no wildcard).
const allowedOrigin = process.env.ALLOWED_ORIGIN || false;
app.use(cors({ origin: allowedOrigin }));

// Limit request body size to mitigate large-payload DoS
app.use(bodyParser.json({ limit: '10kb' }));

// Basic rate limiting to mitigate abuse / DoS
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

// Database setup
const dbPath = process.env.DB_PATH || '/data/mydata.db';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const legacyDbPath = process.env.LEGACY_DB_PATH || '/data/rugby.db';
if (!fs.existsSync(dbPath) && fs.existsSync(legacyDbPath)) {
  fs.copyFileSync(legacyDbPath, dbPath);
  console.log(`Migrated existing SQLite database from ${legacyDbPath} to ${dbPath}`);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log(`Connected to SQLite database at ${dbPath}`);
});

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Initialize database with games table
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      competition TEXT NOT NULL,
      homeTeam TEXT NOT NULL,
      homeShort TEXT NOT NULL,
      awayTeam TEXT NOT NULL,
      venue TEXT NOT NULL,
      kickoffUTC TEXT NOT NULL,
      homeScore INTEGER,
      awayScore INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating table:', err);
    else {
      console.log('Games table ready');
      seedDatabase();
    }
  });
}

// Seed database with initial data
function seedDatabase() {
  db.get('SELECT COUNT(*) as count FROM games', (err, row) => {
    if (err) {
      console.error('Error checking games count:', err);
      return;
    }
    
    {
      const games = [
        // JULY 2026 - Nations Championship (Southern Hemisphere)
        // All Blacks
        {
          id: "nz-france-nc",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "New Zealand",
          homeShort: "All Blacks",
          awayTeam: "France",
          venue: "One New Zealand Stadium, Christchurch",
          kickoffUTC: "2026-07-03T07:10:00Z",
          homeScore: 34,
          awayScore: 32
        },
        {
          id: "nz-italy-nc",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "New Zealand",
          homeShort: "All Blacks",
          awayTeam: "Italy",
          venue: "Sky Stadium, Wellington",
          kickoffUTC: "2026-07-11T05:10:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "nz-ireland-nc",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "New Zealand",
          homeShort: "All Blacks",
          awayTeam: "Ireland",
          venue: "Eden Park, Auckland",
          kickoffUTC: "2026-07-17T07:10:00Z",
          homeScore: null,
          awayScore: null
        },
        // Other Round 1 matches
        {
          id: "jp-italy-nc-r1",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Japan",
          homeShort: "Japan",
          awayTeam: "Italy",
          venue: "Japan",
          kickoffUTC: "2026-07-04T09:10:00Z",
          homeScore: 27,
          awayScore: 10
        },
        {
          id: "aus-ireland-nc-r1",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Australia",
          homeShort: "Australia",
          awayTeam: "Ireland",
          venue: "Australia",
          kickoffUTC: "2026-07-04T10:40:00Z",
          homeScore: 31,
          awayScore: 33
        },
        {
          id: "fiji-wales-nc-r1",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Fiji",
          homeShort: "Fiji",
          awayTeam: "Wales",
          venue: "Fiji",
          kickoffUTC: "2026-07-04T12:10:00Z",
          homeScore: 24,
          awayScore: 39
        },
        // Springboks
        {
          id: "sa-england-nc",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "South Africa",
          homeShort: "Springboks",
          awayTeam: "England",
          venue: "Ellis Park, Johannesburg",
          kickoffUTC: "2026-07-03T17:00:00Z",
          homeScore: 45,
          awayScore: 21
        },
        {
          id: "arg-scotland-nc-r1",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Argentina",
          homeShort: "Argentina",
          awayTeam: "Scotland",
          venue: "Argentina",
          kickoffUTC: "2026-07-04T19:10:00Z",
          homeScore: 38,
          awayScore: 47
        },

        // Nations Championship - Other Nations (Round 2, 11 July 2026)
        {
          id: "aus-france-nc-r2",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Australia",
          homeShort: "Australia",
          awayTeam: "France",
          venue: "Australia",
          kickoffUTC: "2026-07-11T09:10:00Z",
          homeScore: 26,
          awayScore: 42
        },
        {
          id: "jp-ireland-nc-r2",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Japan",
          homeShort: "Japan",
          awayTeam: "Ireland",
          venue: "Japan",
          kickoffUTC: "2026-07-11T10:40:00Z",
          homeScore: 20,
          awayScore: 36
        },
        {
          id: "fiji-england-nc-r2",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Fiji",
          homeShort: "Fiji",
          awayTeam: "England",
          venue: "Fiji",
          kickoffUTC: "2026-07-11T12:10:00Z",
          homeScore: 8,
          awayScore: 73
        },
        {
          id: "sa-scotland-nc-r2",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "South Africa",
          homeShort: "Springboks",
          awayTeam: "Scotland",
          venue: "South Africa",
          kickoffUTC: "2026-07-11T15:40:00Z",
          homeScore: 42,
          awayScore: 28
        },
        {
          id: "arg-wales-nc-r2",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Argentina",
          homeShort: "Argentina",
          awayTeam: "Wales",
          venue: "Argentina",
          kickoffUTC: "2026-07-11T19:10:00Z",
          homeScore: 35,
          awayScore: 21
        },

        // Nations Championship - Other Nations (Round 3, 18 July 2026)
        {
          id: "jp-france-nc-r3",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Japan",
          homeShort: "Japan",
          awayTeam: "France",
          venue: "Japan",
          kickoffUTC: "2026-07-18T09:10:00Z",
          homeScore: 15,
          awayScore: 42
        },
        {
          id: "aus-italy-nc-r3",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Australia",
          homeShort: "Australia",
          awayTeam: "Italy",
          venue: "Australia",
          kickoffUTC: "2026-07-18T10:40:00Z",
          homeScore: 57,
          awayScore: 10
        },
        {
          id: "fiji-scotland-nc-r3",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Fiji",
          homeShort: "Fiji",
          awayTeam: "Scotland",
          venue: "Fiji",
          kickoffUTC: "2026-07-18T12:10:00Z",
          homeScore: 17,
          awayScore: 33
        },
        {
          id: "sa-wales-nc-r3",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "South Africa",
          homeShort: "Springboks",
          awayTeam: "Wales",
          venue: "South Africa",
          kickoffUTC: "2026-07-18T15:40:00Z",
          homeScore: 43,
          awayScore: 0
        },
        {
          id: "arg-england-nc-r3",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Argentina",
          homeShort: "Argentina",
          awayTeam: "England",
          venue: "Argentina",
          kickoffUTC: "2026-07-18T19:10:00Z",
          homeScore: 24,
          awayScore: 31
        },
        
        // AUGUST 2026 - Rugby's Greatest Rivalry Tour (All Blacks in South Africa)
        // Tour Matches
        {
          id: "stormers-nz",
          competition: "Tour Match",
          homeTeam: "Stormers",
          homeShort: "Stormers",
          awayTeam: "New Zealand",
          venue: "DHL Stadium, Cape Town",
          kickoffUTC: "2026-08-07T15:00:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "sharks-nz",
          competition: "Tour Match",
          homeTeam: "Sharks",
          homeShort: "Sharks",
          awayTeam: "New Zealand",
          venue: "Hollywoodbets Kings Park, Durban",
          kickoffUTC: "2026-08-11T15:00:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "bulls-nz",
          competition: "Tour Match",
          homeTeam: "Bulls",
          homeShort: "Bulls",
          awayTeam: "New Zealand",
          venue: "Loftus Versfeld, Pretoria",
          kickoffUTC: "2026-08-15T15:00:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "lions-nz",
          competition: "Tour Match",
          homeTeam: "Lions",
          homeShort: "Lions",
          awayTeam: "New Zealand",
          venue: "Ellis Park, Johannesburg",
          kickoffUTC: "2026-08-25T15:00:00Z",
          homeScore: null,
          awayScore: null
        },
        
        // Test Matches - Rugby's Greatest Rivalry
        {
          id: "sa-nz-test1",
          competition: "Rugby's Greatest Rivalry - Test 1",
          homeTeam: "South Africa",
          homeShort: "Springboks",
          awayTeam: "New Zealand",
          venue: "Ellis Park, Johannesburg",
          kickoffUTC: "2026-08-22T13:00:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "sa-nz-test2",
          competition: "Rugby's Greatest Rivalry - Test 2",
          homeTeam: "South Africa",
          homeShort: "Springboks",
          awayTeam: "New Zealand",
          venue: "DHL Stadium, Cape Town",
          kickoffUTC: "2026-08-29T13:00:00Z",
          homeScore: null,
          awayScore: null
        },
        
        // SEPTEMBER 2026 - Rugby's Greatest Rivalry (Continuation)
        {
          id: "sa-nz-test3",
          competition: "Rugby's Greatest Rivalry - Test 3",
          homeTeam: "South Africa",
          homeShort: "Springboks",
          awayTeam: "New Zealand",
          venue: "FNB Stadium, Johannesburg",
          kickoffUTC: "2026-09-05T13:00:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "sa-nz-test4-neutral",
          competition: "Rugby's Greatest Rivalry - Test 4 (Neutral)",
          homeTeam: "South Africa",
          homeShort: "Springboks",
          awayTeam: "New Zealand",
          venue: "M&T Bank Stadium, Baltimore, USA",
          kickoffUTC: "2026-09-12T19:05:00Z",
          homeScore: null,
          awayScore: null
        },
        
        // NOVEMBER 2026 - Nations Championship (Northern Hemisphere Series)
        // All Blacks
        {
          id: "nz-scotland-nh",
          competition: "Nations Championship - Northern Hemisphere",
          homeTeam: "Scotland",
          homeShort: "Scotland",
          awayTeam: "New Zealand",
          venue: "Murrayfield, Edinburgh",
          kickoffUTC: "2026-11-07T15:00:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "nz-france-nh",
          competition: "Nations Championship - Northern Hemisphere",
          homeTeam: "France",
          homeShort: "France",
          awayTeam: "New Zealand",
          venue: "Stade de France, Paris",
          kickoffUTC: "2026-11-14T20:00:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "nz-italy-nh",
          competition: "Nations Championship - Northern Hemisphere",
          homeTeam: "Italy",
          homeShort: "Italy",
          awayTeam: "New Zealand",
          venue: "Stadio Olimpico, Rome",
          kickoffUTC: "2026-11-21T15:00:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "nz-wales-nh",
          competition: "Nations Championship - Northern Hemisphere",
          homeTeam: "Wales",
          homeShort: "Wales",
          awayTeam: "New Zealand",
          venue: "Principality Stadium, Cardiff",
          kickoffUTC: "2026-11-28T15:00:00Z",
          homeScore: null,
          awayScore: null
        },
        
        // Springboks
        {
          id: "sa-england-nh",
          competition: "Nations Championship - Northern Hemisphere",
          homeTeam: "England",
          homeShort: "England",
          awayTeam: "South Africa",
          venue: "Twickenham Stadium, London",
          kickoffUTC: "2026-11-14T15:00:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "sa-scotland-nh",
          competition: "Nations Championship - Northern Hemisphere",
          homeTeam: "Scotland",
          homeShort: "Scotland",
          awayTeam: "South Africa",
          venue: "Murrayfield, Edinburgh",
          kickoffUTC: "2026-11-21T15:00:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "sa-ireland-nh",
          competition: "Nations Championship - Northern Hemisphere",
          homeTeam: "Ireland",
          homeShort: "Ireland",
          awayTeam: "South Africa",
          venue: "Aviva Stadium, Dublin",
          kickoffUTC: "2026-11-28T15:00:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "sa-wales-nh",
          competition: "Nations Championship - Northern Hemisphere",
          homeTeam: "Wales",
          homeShort: "Wales",
          awayTeam: "South Africa",
          venue: "Principality Stadium, Cardiff",
          kickoffUTC: "2026-12-05T15:00:00Z",
          homeScore: null,
          awayScore: null
        }
      ];

      const stmt = db.prepare(`
        INSERT INTO games (id, competition, homeTeam, homeShort, awayTeam, venue, kickoffUTC, homeScore, awayScore)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          competition = excluded.competition,
          homeTeam = excluded.homeTeam,
          homeShort = excluded.homeShort,
          awayTeam = excluded.awayTeam,
          venue = excluded.venue,
          kickoffUTC = excluded.kickoffUTC,
          homeScore = COALESCE(games.homeScore, excluded.homeScore),
          awayScore = COALESCE(games.awayScore, excluded.awayScore),
          updated_at = CURRENT_TIMESTAMP
      `);

      games.forEach(game => {
        stmt.run([
          game.id,
          game.competition,
          game.homeTeam,
          game.homeShort,
          game.awayTeam,
          game.venue,
          game.kickoffUTC,
          game.homeScore,
          game.awayScore
        ]);
      });

      stmt.finalize(() => {
        const canonicalIds = games.map((game) => game.id);
        const placeholders = canonicalIds.map(() => '?').join(',');
        db.run(
          `DELETE FROM games WHERE substr(kickoffUTC, 1, 4) = ? AND id NOT IN (${placeholders})`,
          [FIXTURE_YEAR, ...canonicalIds],
          (deleteErr) => {
            if (deleteErr) console.error('Error removing stale games:', deleteErr.message);
            else console.log('Database seeded/synced with canonical 2026 games');
            startScorePolling();
          }
        );
      });
    }
  });
}

// API Routes

// Get all games
app.get('/api/games', (req, res) => {
  db.all(
    'SELECT * FROM games WHERE substr(kickoffUTC, 1, 4) = ? ORDER BY kickoffUTC ASC',
    [FIXTURE_YEAR],
    (err, rows) => {
    if (err) {
      console.error('Error fetching games:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(rows);
    }
    }
  );
});

// Get single game
app.get('/api/games/:id', (req, res) => {
  const { id } = req.params;
  db.get(
    'SELECT * FROM games WHERE id = ? AND substr(kickoffUTC, 1, 4) = ?',
    [id, FIXTURE_YEAR],
    (err, row) => {
    if (err) {
      console.error('Error fetching game:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    } else if (!row) {
      res.status(404).json({ error: 'Game not found' });
    } else {
      res.json(row);
    }
    }
  );
});

// Update game score
app.put('/api/games/:id/score', (req, res) => {
  const { id } = req.params;
  const { homeScore, awayScore } = req.body;

  if (homeScore === undefined || awayScore === undefined) {
    return res.status(400).json({ error: 'homeScore and awayScore are required' });
  }

  // Validate scores are non-negative integers within a sane range
  const isValidScore = (v) => Number.isInteger(v) && v >= 0 && v <= 300;
  if (!isValidScore(homeScore) || !isValidScore(awayScore)) {
    return res.status(400).json({ error: 'homeScore and awayScore must be integers between 0 and 300' });
  }

  db.run(
    'UPDATE games SET homeScore = ?, awayScore = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [homeScore, awayScore, id],
    function(err) {
      if (err) {
        console.error('Error updating score:', err.message);
        res.status(500).json({ error: 'Internal server error' });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Game not found' });
      } else {
        res.json({ success: true, message: 'Score updated' });
      }
    }
  );
});

// Update scores from live feeds with mock fallback
app.post('/api/update-scores', async (req, res) => {
  try {
    const result = await updateScoresFromFeeds('manual');
    res.json({ success: true, ...result, message: `Updated ${result.updated} games` });
  } catch (error) {
    console.error('Error updating scores:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function updateScoresFromFeeds(reason = 'scheduled') {
  if (scoreUpdateInProgress) {
    console.log(`Score update skipped (${reason}); another update is already running`);
    return { updated: 0, checked: 0, skipped: true };
  }

  scoreUpdateInProgress = true;

  try {
    const games = await dbAll(
      'SELECT * FROM games WHERE substr(kickoffUTC, 1, 4) = ? ORDER BY kickoffUTC ASC',
      [FIXTURE_YEAR]
    );

    let updated = 0;
    let checked = 0;
    const now = new Date();
    
    console.log(`Update scores (${reason}): Current time is ${now.toISOString()}`);
    console.log(`Checking ${games.length} games for ${FIXTURE_YEAR}`);

    for (const game of games) {
      const kickoff = new Date(game.kickoffUTC);
      const gameEndTime = new Date(kickoff.getTime() + MATCH_DURATION_MS);

      if (now < gameEndTime) {
        console.log(`Game ${game.id}: not ready yet (${kickoff.toISOString()})`);
        continue;
      }

      checked++;
      console.log(`Game ${game.id}: checking live feeds`);

      try {
        let score = await fetchScoreFromWeb(game);
        
        if (ENABLE_MOCK_SCORES && (!score || score.homeScore === null || score.awayScore === null)) {
          score = generateMockScore(game);
        }
        
        if (score && score.homeScore !== null && score.awayScore !== null &&
            (game.homeScore !== score.homeScore || game.awayScore !== score.awayScore)) {
          const result = await dbRun(
            'UPDATE games SET homeScore = ?, awayScore = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [score.homeScore, score.awayScore, game.id]
          );

          if (result.changes > 0) {
            updated++;
            console.log(`Updated score for ${game.id}: ${score.homeScore}-${score.awayScore}`);
          }
        }
      } catch (e) {
        console.error(`Error fetching score for ${game.id}:`, e.message);
      }
    }

    return { updated, checked, skipped: false };
  } finally {
    scoreUpdateInProgress = false;
  }
}

function startScorePolling() {
  if (scorePollingStarted || SCORE_POLL_INTERVAL_MS <= 0) return;
  scorePollingStarted = true;

  console.log(`Score polling enabled every ${Math.round(SCORE_POLL_INTERVAL_MS / 60000)} minutes`);
  setTimeout(() => {
    updateScoresFromFeeds('startup').catch((error) => {
      console.error('Startup score update failed:', error.message);
    });
  }, 15000);

  setInterval(() => {
    updateScoresFromFeeds('scheduled').catch((error) => {
      console.error('Scheduled score update failed:', error.message);
    });
  }, SCORE_POLL_INTERVAL_MS);
}

// Function to fetch scores from live web sources
async function fetchScoreFromWeb(game) {
  if (game.competition.includes('Nations Championship')) {
    const allRugbyScore = await fetchScoreFromAllRugby(game);
    if (allRugbyScore) return allRugbyScore;
  }

  const sportsDbScore = await fetchScoreFromTheSportsDb(game);
  if (sportsDbScore) return sportsDbScore;

  try {
    const gameDate = game.kickoffUTC.slice(0, 10).replace(/-/g, '');
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/rugby/international/scoreboard?dates=${gameDate}&limit=100`;
    
    const response = await fetch(espnUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;

    const data = await response.json();
    
    // Search through events for matching game
    if (data.events) {
      for (const event of data.events) {
        const competitions = event.competitions?.length ? event.competitions : [{ competitors: event.competitors || [] }];

        for (const competition of competitions) {
          const competitors = competition.competitors || [];
          const homeCompetitor = competitors.find((competitor) => competitor.homeAway === 'home') || competitors[0];
          const awayCompetitor = competitors.find((competitor) => competitor.homeAway === 'away') || competitors[1];
          const completed = competition.status?.type?.completed || event.status?.type?.completed;
        
          if (homeCompetitor && awayCompetitor && completed &&
              competitorMatchesTeam(homeCompetitor, game.homeTeam) &&
              competitorMatchesTeam(awayCompetitor, game.awayTeam)) {
            const homeScore = parseInt(homeCompetitor.score, 10);
            const awayScore = parseInt(awayCompetitor.score, 10);
            if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return null;

            return {
              homeScore,
              awayScore
            };
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('ESPN API fetch error:', error.message);
    return null;
  }
}

async function fetchScoreFromAllRugby(game) {
  const scores = await fetchAllRugbyNationsChampionshipScores();
  return scores.find((score) =>
    teamsMatch(score.homeTeam, game.homeTeam) && teamsMatch(score.awayTeam, game.awayTeam)
  ) || null;
}

async function fetchAllRugbyNationsChampionshipScores() {
  const cacheAgeMs = Date.now() - allRugbyScoreCache.fetchedAt;
  if (cacheAgeMs < 5 * 60 * 1000 && allRugbyScoreCache.scores.length > 0) {
    return allRugbyScoreCache.scores;
  }

  try {
    const response = await fetch(ALL_RUGBY_NATIONS_CHAMPIONSHIP_URL, {
      headers: { 'user-agent': 'rugby-score-tracker/1.0' },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.error(`All.Rugby fetch failed: HTTP ${response.status}`);
      return allRugbyScoreCache.scores;
    }

    const html = await response.text();
    const scores = parseAllRugbyScores(html);
    allRugbyScoreCache = { fetchedAt: Date.now(), scores };
    console.log(`Loaded ${scores.length} scores from All.Rugby`);
    return scores;
  } catch (error) {
    console.error('All.Rugby fetch error:', error.message);
    return allRugbyScoreCache.scores;
  }
}

function parseAllRugbyScores(html) {
  const scores = [];
  const matchRegex = /<a\s+class="mat"[^>]*title="Match Report\s+([^"<>]+?)\s+vs\s+([^"<>]+?)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = matchRegex.exec(html)) !== null) {
    const [, homeTeam, awayTeam, block] = match;
    const scoreMatch = block.match(/<div\s+class="[^"]*\bres\b[^"]*"[^>]*>\s*(\d+)\s*-\s*(\d+)\s*<\/div>/i);
    if (!scoreMatch) continue;

    scores.push({
      homeTeam: decodeHtml(homeTeam),
      awayTeam: decodeHtml(awayTeam),
      homeScore: Number(scoreMatch[1]),
      awayScore: Number(scoreMatch[2]),
      source: 'all.rugby'
    });
  }

  return scores;
}

async function fetchScoreFromTheSportsDb(game) {
  try {
    const gameDate = game.kickoffUTC.slice(0, 10);
    const url = `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${gameDate}&s=Rugby`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;

    const data = await response.json();
    const events = Array.isArray(data.events) ? data.events : [];
    const event = events.find((candidate) =>
      teamsMatch(candidate.strHomeTeam, game.homeTeam) && teamsMatch(candidate.strAwayTeam, game.awayTeam)
    );

    if (!event || event.intHomeScore === null || event.intAwayScore === null) return null;

    return {
      homeScore: Number(event.intHomeScore),
      awayScore: Number(event.intAwayScore),
      source: 'thesportsdb'
    };
  } catch (error) {
    console.error('TheSportsDB fetch error:', error.message);
    return null;
  }
}

function normalizeTeamName(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function teamsMatch(left, right) {
  const normalizedLeft = normalizeTeamName(left);
  const normalizedRight = normalizeTeamName(right);
  return normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
}

function decodeHtml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function competitorMatchesTeam(competitor, teamName) {
  const expected = normalizeTeamName(teamName);
  const names = [
    competitor.displayName,
    competitor.team?.displayName,
    competitor.team?.name,
    competitor.team?.shortDisplayName,
    competitor.team?.abbreviation
  ].filter(Boolean).map(normalizeTeamName);

  return names.some((name) => name.includes(expected) || expected.includes(name));
}

// Generate mock scores for past games
function generateMockScore(game) {
  const now = new Date();
  const kickoff = new Date(game.kickoffUTC);
  const matchDuration = 100 * 60 * 1000; // ~100 minutes
  
  // Only generate scores if game is past kickoff + duration
  if (now <= kickoff + matchDuration) {
    return null;
  }
  
  // Generate consistent mock scores based on game ID and date
  const seed = game.id.charCodeAt(0) + game.id.charCodeAt(game.id.length - 1);
  const homeScore = 18 + (seed % 15); // 18-32 range
  const awayScore = 12 + ((seed * 7) % 18); // 12-29 range
  
  return { homeScore, awayScore };
}

// Serve static files
app.use(express.static('/app'));

// Fallback to index.html for single-page app
app.get('/', (req, res) => {
  res.sendFile('/app/index.html');
});

// Initialize and start
initializeDatabase();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('Error closing database:', err);
    else console.log('Database closed');
    process.exit(0);
  });
});
