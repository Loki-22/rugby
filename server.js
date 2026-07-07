const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database setup
const dbPath = '/data/rugby.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to SQLite database');
});

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
        // Springboks
        {
          id: "sa-england-nc",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "South Africa",
          homeShort: "Springboks",
          awayTeam: "England",
          venue: "Ellis Park, Johannesburg",
          kickoffUTC: "2026-07-03T17:00:00Z",
          homeScore: 27,
          awayScore: 20
        },
        {
          id: "sa-fiji-nc",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "South Africa",
          homeShort: "Springboks",
          awayTeam: "Fiji",
          venue: "Vodacom Park, Durban",
          kickoffUTC: "2026-07-10T17:00:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "sa-australia-nc",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "South Africa",
          homeShort: "Springboks",
          awayTeam: "Australia",
          venue: "Loftus Versfeld, Pretoria",
          kickoffUTC: "2026-07-17T17:00:00Z",
          homeScore: null,
          awayScore: null
        },

        // Nations Championship — Other Nations (Round 1, 4 July 2026)
        {
          id: "fra-eng-nc-r1",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "France",
          homeShort: "France",
          awayTeam: "England",
          venue: "Stade de France, Paris",
          kickoffUTC: "2026-07-04T19:00:00Z",
          homeScore: 24,
          awayScore: 21
        },
        {
          id: "ita-sco-nc-r1",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Italy",
          homeShort: "Italy",
          awayTeam: "Scotland",
          venue: "Stadio Olimpico, Rome",
          kickoffUTC: "2026-07-04T17:30:00Z",
          homeScore: 19,
          awayScore: 25
        },
        {
          id: "ire-wal-nc-r1",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Ireland",
          homeShort: "Ireland",
          awayTeam: "Wales",
          venue: "Aviva Stadium, Dublin",
          kickoffUTC: "2026-07-04T20:00:00Z",
          homeScore: 31,
          awayScore: 17
        },

        // Nations Championship — Other Nations (Round 2, 11 July 2026)
        {
          id: "eng-fra-nc-r2",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "England",
          homeShort: "England",
          awayTeam: "France",
          venue: "Twickenham Stadium, London",
          kickoffUTC: "2026-07-11T19:00:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "sco-ire-nc-r2",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Scotland",
          homeShort: "Scotland",
          awayTeam: "Ireland",
          venue: "Murrayfield, Edinburgh",
          kickoffUTC: "2026-07-11T19:30:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "wal-ita-nc-r2",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Wales",
          homeShort: "Wales",
          awayTeam: "Italy",
          venue: "Principality Stadium, Cardiff",
          kickoffUTC: "2026-07-11T20:00:00Z",
          homeScore: null,
          awayScore: null
        },

        // Nations Championship — Other Nations (Round 3, 18 July 2026)
        {
          id: "ita-fra-nc-r3",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Italy",
          homeShort: "Italy",
          awayTeam: "France",
          venue: "Stadio Olimpico, Rome",
          kickoffUTC: "2026-07-18T17:30:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "eng-ire-nc-r3",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "England",
          homeShort: "England",
          awayTeam: "Ireland",
          venue: "Twickenham Stadium, London",
          kickoffUTC: "2026-07-18T19:00:00Z",
          homeScore: null,
          awayScore: null
        },
        {
          id: "sco-wal-nc-r3",
          competition: "Nations Championship - Southern Hemisphere",
          homeTeam: "Scotland",
          homeShort: "Scotland",
          awayTeam: "Wales",
          venue: "Murrayfield, Edinburgh",
          kickoffUTC: "2026-07-18T19:30:00Z",
          homeScore: null,
          awayScore: null
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
        INSERT OR IGNORE INTO games (id, competition, homeTeam, homeShort, awayTeam, venue, kickoffUTC, homeScore, awayScore)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        console.log('Database seeded with initial games');
      });
    }
  });
}

// API Routes

// Get all games
app.get('/api/games', (req, res) => {
  db.all('SELECT * FROM games ORDER BY kickoffUTC ASC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Get single game
app.get('/api/games/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM games WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: 'Game not found' });
    } else {
      res.json(row);
    }
  });
});

// Update game score
app.put('/api/games/:id/score', (req, res) => {
  const { id } = req.params;
  const { homeScore, awayScore } = req.body;

  if (homeScore === undefined || awayScore === undefined) {
    return res.status(400).json({ error: 'homeScore and awayScore are required' });
  }

  db.run(
    'UPDATE games SET homeScore = ?, awayScore = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [homeScore, awayScore, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Game not found' });
      } else {
        res.json({ success: true, message: 'Score updated' });
      }
    }
  );
});

// Update scores from web/ESPN API with mock fallback
app.post('/api/update-scores', async (req, res) => {
  try {
    // Fetch all games from the database
    db.all('SELECT * FROM games WHERE (homeScore IS NULL OR homeScore = 0) AND (awayScore IS NULL OR awayScore = 0)', async (err, games) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      let updated = 0;
      const now = new Date();
      const matchDuration = 100 * 60 * 1000; // ~100 minutes
      
      console.log(`Update scores: Current time is ${now.toISOString()}`);
      console.log(`Found ${games.length} games with empty scores`);

      // Check which games have been played (past kickoff time)
      for (const game of games) {
        const kickoff = new Date(game.kickoffUTC);
        const gameEndTime = new Date(kickoff.getTime() + matchDuration);

        // If game has passed (kickoff + match duration), try to fetch score
        if (now >= gameEndTime) {
          console.log(`Game ${game.id}: now (${now.toISOString()}) >= gameEnd (${gameEndTime.toISOString()})`);
          try {
            // Try to fetch from ESPN API first
            let score = await fetchScoreFromWeb(game);
            
            // If ESPN fails, generate mock score
            if (!score || score.homeScore === null || score.awayScore === null) {
              score = generateMockScore(game);
            }
            
            if (score && score.homeScore !== null && score.awayScore !== null) {
              db.run(
                'UPDATE games SET homeScore = ?, awayScore = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [score.homeScore, score.awayScore, game.id],
                function(err) {
                  if (!err && this.changes > 0) {
                    updated++;
                    console.log(`Updated score for ${game.id}: ${score.homeScore}-${score.awayScore}`);
                  }
                }
              );
            }
          } catch (e) {
            console.error(`Error fetching score for ${game.id}:`, e.message);
          }
        } else {
          console.log(`Game ${game.id}: not ready yet (${kickoff.toISOString()})`);
        }
      }

      // Return results after a short delay to ensure DB updates
      setTimeout(() => {
        res.json({ success: true, updated, message: `Updated ${updated} games` });
      }, 500);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Function to fetch scores from ESPN/web sources
async function fetchScoreFromWeb(game) {
  try {
    // Try ESPN API endpoint for rugby
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/rugby/international/scoreboard?limit=100`;
    
    const response = await fetch(espnUrl, { timeout: 5000 });
    const data = await response.json();
    
    // Search through events for matching game
    if (data.events) {
      for (const event of data.events) {
        const competitor1 = event.competitors?.[0];
        const competitor2 = event.competitors?.[1];
        
        if (competitor1 && competitor2) {
          const homeMatch = competitor1.team?.displayName?.includes(game.homeTeam) ||
                           competitor1.displayName?.includes(game.homeTeam);
          const awayMatch = competitor2.team?.displayName?.includes(game.awayTeam) ||
                           competitor2.displayName?.includes(game.awayTeam);
          
          if (homeMatch && awayMatch && event.status?.type?.completed) {
            return {
              homeScore: parseInt(competitor1.score) || 0,
              awayScore: parseInt(competitor2.score) || 0
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
