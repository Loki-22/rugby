// ============================================================================
//  Rendering + timezone logic
//  All display times use the Pacific/Auckland timezone (New Zealand time).
// ============================================================================

const NZ_TZ = "Pacific/Auckland";
const MATCH_DURATION_MS = 100 * 60 * 1000; // ~100 minutes (game + breaks)

const nzDateFmt = new Intl.DateTimeFormat("en-NZ", {
  timeZone: NZ_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric"
});

const nzTimeFmt = new Intl.DateTimeFormat("en-NZ", {
  timeZone: NZ_TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

const nzClockFmt = new Intl.DateTimeFormat("en-NZ", {
  timeZone: NZ_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true
});

function teamClass(team) {
  if (team === "New Zealand") return "team-nz";
  if (team === "South Africa") return "team-sa";
  return "";
}

// Work out the state of a game relative to right now.
function getGameStatus(game) {
  const kickoff = new Date(game.kickoffUTC).getTime();
  const now = Date.now();
  const played = game.homeScore !== null && game.awayScore !== null;

  if (played) return { key: "final", label: "Full Time" };
  if (now < kickoff) return { key: "upcoming", label: "Upcoming" };
  if (now < kickoff + MATCH_DURATION_MS) return { key: "live", label: "Live" };
  return { key: "awaiting", label: "Awaiting Result" };
}

function resultBadge(game) {
  if (game.homeScore === null || game.awayScore === null) return "";
  if (game.homeScore > game.awayScore) return `${game.homeShort} win`;
  if (game.homeScore < game.awayScore) return `${game.awayTeam} win`;
  return "Draw";
}

function countdownText(kickoffMs) {
  const diff = kickoffMs - Date.now();
  if (diff <= 0) return "";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return `Kicks off in ${parts.join(" ")}`;
}

function createCard(game) {
  const kickoff = new Date(game.kickoffUTC);
  const status = getGameStatus(game);
  const hasScore = game.homeScore !== null && game.awayScore !== null;

  const card = document.createElement("article");
  card.className = `game-card status-${status.key}`;
  card.dataset.home = game.homeTeam;
  card.dataset.away = game.awayTeam;

  const scoreBlock = hasScore
    ? `<div class="score">
         <span class="${game.homeScore >= game.awayScore ? "lead" : ""}">${game.homeScore}</span>
         <span class="score-sep">&ndash;</span>
         <span class="${game.awayScore >= game.homeScore ? "lead" : ""}">${game.awayScore}</span>
       </div>
       <div class="result">${resultBadge(game)}</div>`
    : `<div class="vs">vs</div>`;

  card.innerHTML = `
    <div class="card-top">
      <span class="competition">${game.competition}</span>
      <span class="status-pill status-${status.key}">${status.label}</span>
    </div>
    <div class="matchup">
      <div class="team ${teamClass(game.homeTeam)}">${game.homeTeam}</div>
      <div class="center">${scoreBlock}</div>
      <div class="team ${teamClass(game.awayTeam)}">${game.awayTeam}</div>
    </div>
    <div class="details">
      <div class="datetime">
        <span class="date">${nzDateFmt.format(kickoff)}</span>
        <span class="time">${nzTimeFmt.format(kickoff)} <small>NZ time</small></span>
      </div>
      <div class="venue">${game.venue}</div>
      ${status.key === "upcoming" ? `<div class="countdown" data-kickoff="${kickoff.getTime()}">${countdownText(kickoff.getTime())}</div>` : ""}
    </div>
  `;
  return card;
}

let activeFilter = "all";

function render() {
  const container = document.getElementById("gamesContainer");
  container.innerHTML = "";

  const sorted = [...GAMES].sort(
    (a, b) => new Date(a.kickoffUTC) - new Date(b.kickoffUTC)
  );

  const visible = sorted.filter(
    (g) =>
      activeFilter === "all" ||
      g.homeTeam === activeFilter ||
      g.awayTeam === activeFilter
  );

  if (visible.length === 0) {
    container.innerHTML = `<p class="empty">No games to show.</p>`;
    return;
  }

  visible.forEach((game) => container.appendChild(createCard(game)));
}

function updateClock() {
  const el = document.getElementById("nzClock");
  if (el) el.textContent = "New Zealand time: " + nzClockFmt.format(new Date());
}

function updateCountdowns() {
  document.querySelectorAll(".countdown").forEach((el) => {
    const kickoff = Number(el.dataset.kickoff);
    const text = countdownText(kickoff);
    if (text) {
      el.textContent = text;
    } else {
      // Game just kicked off — re-render so status/score logic refreshes.
      render();
    }
  });
}

function initFilters() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.team;
      render();
    });
  });
}

function initSearch() {
  const btn = document.getElementById("searchBtn");
  const panel = document.getElementById("searchLinks");
  if (!btn || !panel) return;
  btn.addEventListener("click", () => {
    const open = !panel.hidden;
    panel.hidden = open;
    btn.setAttribute("aria-expanded", String(!open));
    btn.classList.toggle("active", !open);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initFilters();
  initSearch();
  render();
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(updateCountdowns, 60000);
  // Re-render periodically so statuses (Upcoming -> Live -> Awaiting) stay current.
  setInterval(render, 60000);
});
