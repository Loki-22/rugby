// ============================================================================
//  All Blacks & Springboks — July 2026 fixtures
// ----------------------------------------------------------------------------
//  HOW TO UPDATE A SCORE AFTER A GAME:
//    Find the game below and fill in "homeScore" and "awayScore" with numbers.
//    Leave them as null for games that have not been played yet.
//
//  Kick-off times are stored in UTC (the "kickoffUTC" field, ISO-8601 format).
//  The site automatically converts them to New Zealand time for display,
//  so you never have to calculate the NZ time yourself.
// ============================================================================

const GAMES = [
  // ---------------- Round 1 — Saturday 4 July 2026 ----------------
  {
    id: "nz-fra",
    competition: "Nations Championship — Round 1",
    homeTeam: "New Zealand",
    homeShort: "All Blacks",
    awayTeam: "France",
    venue: "One New Zealand Stadium, Christchurch",
    kickoffUTC: "2026-07-04T07:10:00Z", // 7:10 PM NZST
    homeScore: 34,
    awayScore: 32
  },
  {
    id: "sa-eng",
    competition: "Nations Championship — Round 1",
    homeTeam: "South Africa",
    homeShort: "Springboks",
    awayTeam: "England",
    venue: "Emirates Airline Park (Ellis Park), Johannesburg",
    kickoffUTC: "2026-07-04T15:40:00Z", // 5:40 PM SAST
    homeScore: null,
    awayScore: null
  },

  // ---------------- Round 2 — Saturday 11 July 2026 ----------------
  {
    id: "nz-ita",
    competition: "Nations Championship — Round 2",
    homeTeam: "New Zealand",
    homeShort: "All Blacks",
    awayTeam: "Italy",
    venue: "Sky Stadium, Wellington",
    kickoffUTC: "2026-07-11T05:10:00Z", // 5:10 PM NZST
    homeScore: null,
    awayScore: null
  },
  {
    id: "sa-sco",
    competition: "Nations Championship — Round 2",
    homeTeam: "South Africa",
    homeShort: "Springboks",
    awayTeam: "Scotland",
    venue: "South Africa (venue TBC)",
    kickoffUTC: "2026-07-11T15:40:00Z", // 5:40 PM SAST
    homeScore: null,
    awayScore: null
  },

  // ---------------- Round 3 — Saturday 18 July 2026 ----------------
  {
    id: "nz-ire",
    competition: "Nations Championship — Round 3",
    homeTeam: "New Zealand",
    homeShort: "All Blacks",
    awayTeam: "Ireland",
    venue: "Eden Park, Auckland",
    kickoffUTC: "2026-07-18T07:10:00Z", // 7:10 PM NZST
    homeScore: null,
    awayScore: null
  },
  {
    id: "sa-wal",
    competition: "Nations Championship — Round 3",
    homeTeam: "South Africa",
    homeShort: "Springboks",
    awayTeam: "Wales",
    venue: "South Africa (venue TBC)",
    kickoffUTC: "2026-07-18T15:40:00Z", // 5:40 PM SAST
    homeScore: null,
    awayScore: null
  }
];
