// League schedule (Schedule & Coverage tab): week strip, head-to-head cards, cached report/projection loading.
// Classic script loaded before app.js; it shares app.js globals (state, fetchJson, helpers) at call time.

const leagueScheduleCache = new Map();
const scheduleProjectionCache = new Map();
const leagueScheduleLoads = new Map();
let leagueScheduleContext = "";
let lastScheduleView = null;

function getScheduleShareView() {
  return lastScheduleView && state.activeLeague && lastScheduleView.context === getLeagueRecordsKey(state.activeLeague) ? lastScheduleView : null;
}

function normalizeLeagueSchedule(league, data, week, managers = state.managers) {
  const known = new Set(managers.map(manager => String(manager.rosterId)));
  const games = [];
  const issues = [];
  const seen = new Set();
  const pts = value => typeof value === "number" && Number.isFinite(value) ? value : null;
  const add = (homeId, awayId, note = "", homePts = null, awayPts = null) => {
    const home = String(homeId ?? ""), away = awayId === null || awayId === undefined ? null : String(awayId);
    if (!known.has(home) || (away !== null && (!known.has(away) || away === home)) ||
        seen.has(home) || (away !== null && seen.has(away))) {
      issues.push("Unknown or duplicate teams were excluded.");
      return;
    }
    seen.add(home);
    if (away !== null) seen.add(away);
    games.push({ homeId: home, awayId: away, note, homePts: pts(homePts), awayPts: away === null ? null : pts(awayPts) });
  };
  if (!Array.isArray(data)) throw new Error("Provider schedule response is invalid.");
  if (league.provider === "sleeper") {
    const pairs = new Map();
    data.forEach(team => {
      if (team.matchup_id === null || team.matchup_id === undefined) {
        add(team.roster_id, null, "Provider bye / unpaired", team.points);
        return;
      }
      const key = String(team.matchup_id);
      if (!pairs.has(key)) pairs.set(key, []);
      pairs.get(key).push(team);
    });
    pairs.forEach(teams => {
      if (teams.length === 2) add(teams[0].roster_id, teams[1].roster_id, "", teams[0].points, teams[1].points);
      else issues.push("Unresolved matchup groups were excluded.");
    });
  } else if (league.provider === "espn") {
    const periods = league.espnData?.settings?.scheduleSettings?.matchupPeriods;
    if (!periods || typeof periods !== "object") throw new Error("ESPN scoring-week mapping is unavailable. Reload the page.");
    data.forEach(game => {
      const weeks = periods[game.matchupPeriodId];
      if (!Array.isArray(weeks) || !weeks.length || !weeks.every(value => Number.isInteger(value) && value >= 1 && value <= 18)) {
        issues.push("Some ESPN matchup periods have no valid week mapping.");
        return;
      }
      const scoringWeeks = getEspnMatchupWeeks(league, game);
      if (!scoringWeeks.includes(week)) return;
      const note = scoringWeeks.length > 1 ? `Multiweek matchup: Weeks ${scoringWeeks.join(", ")}` : "";
      const single = scoringWeeks.length === 1;
      if (game.home && game.away) add(game.home.teamId, game.away.teamId, note, single ? game.home.totalPoints : null, single ? game.away.totalPoints : null);
      else if (game.home || game.away) add((game.home || game.away).teamId, null, note || "Provider bye / unpaired");
    });
  } else {
    data.forEach(game => add(game.homeId, game.awayId, game.note || "", game.homeScore ?? game.homePoints, game.awayScore ?? game.awayPoints));
  }
  if (seen.size < known.size) issues.push(`${known.size - seen.size} team${known.size - seen.size === 1 ? "" : "s"} have no published pairing for this week.`);
  return { games, issues: [...new Set(issues)] };
}

function scoreLeagueProjectionStats(stats, rules = state.activeLeague?.scoringSettings || {}) {
  if (!stats || typeof stats !== "object") return null;
  const provider = state.activeLeague?.provider;
  if (!state.activeLeague) return Number.isFinite(stats.pts_ppr) ? stats.pts_ppr : null;
  let score;
  const counters = Object.keys(stats).filter(key => !key.startsWith("pts_") && Object.hasOwn(rules, key));
  if (provider !== "espn" && counters.length) {
    if (counters.some(key => typeof stats[key] !== "number" || !Number.isFinite(stats[key]) || typeof rules[key] !== "number" || !Number.isFinite(rules[key]))) return null;
    score = counters.reduce((sum, key) => sum + stats[key] * rules[key], 0);
  } else {
    if (provider !== "espn" && Object.entries(rules).some(([key, value]) => key !== "rec" && value !== 0)) return null;
    const field = rules.rec === 0 ? "pts_std" : rules.rec === 0.5 ? "pts_half_ppr" : rules.rec === 1 ? "pts_ppr" : "";
    score = stats[field];
  }
  return Number.isFinite(score) ? score : null;
}

function getScheduleTeamProjection(manager, week, projections, starterSlots = state.activeLeague?.rosterPositions || []) {
  const slots = starterSlots.filter(slot => !["BN", "IR", "TAXI"].includes(slot));
  if (!manager || !slots.length || slots.some(slot => !["QB", "RB", "WR", "TE", "K", "DEF"].some(pos => isPosEligible(pos, slot)))) return null;
  const ids = getPlannerRosterIds(manager);
  const candidates = [];
  const rules = state.activeLeague.scoringSettings || {};
  for (const id of ids) {
    const player = state.players[id];
    if (!player) return null;
    const availability = getPlannerAvailability(player, week, true);
    if (availability.kind === "unknown") return null;
    if (availability.heldOut || availability.kind === "bye") continue;
    const score = scoreLeagueProjectionStats(projections[id]?.stats || projections[id], rules);
    if (score === null) return null;
    candidates.push({ m: player, score });
  }
  const lineup = assignLineupPlayersToSlots(slots, candidates);
  if (lineup.some(candidate => !candidate)) return null;
  return lineup.reduce((sum, candidate) => sum + candidate.score, 0);
}

function getScheduleFeaturedPlayers(manager, week, projections) {
  if (!manager || !projections) return [];
  return getPlannerRosterIds(manager).map(id => state.players[id]).filter(player => player && !player.isPick)
    .map(player => ({ player, points: getScheduleTeamProjection({ ...manager, players: [player.id], reserve: [], taxi: [] }, week, projections, [player.position]) }))
    .filter(entry => entry.points !== null && entry.points > 0)
    .sort((a, b) => b.points - a.points || a.player.name.localeCompare(b.player.name)).slice(0, 3);
}

function renderScheduleTeam(manager, id, week, projections) {
  const [teamName, owner] = manager ? splitTeamLabel(manager) : [`Team ${id}`, ""];
  const players = getScheduleFeaturedPlayers(manager, week, projections);
  const avatar = manager ? renderTeamAvatarHTML(manager) : '<span class="team-initials" aria-hidden="true">?</span>';
  const core = players.length ? `<div class="schedule-core" aria-label="Top projected players">${players.map(({player, points}) => `<span title="${draftEscapeHtml(`${player.name} · ${points.toFixed(1)} projected`)}">${renderComparisonPortrait(player)}<small>${points.toFixed(1)}</small></span>`).join("")}</div>` : "";
  return `<div class="schedule-team">${avatar}<div class="sched-team-text"><strong title="${draftEscapeHtml(manager?.teamName || teamName)}">${draftEscapeHtml(teamName)}</strong>${owner ? `<small>${draftEscapeHtml(owner)}</small>` : ""}${core}</div></div>`;
}

function renderScheduleWeekStrip(selected) {
  const strip = document.getElementById("leagueScheduleWeeks");
  if (!strip) return;
  const current = Number(state.week) || 0;
  const playoffStart = Number(state.activeLeague?.playoffWeekStart) || 0;
  strip.innerHTML = `<button type="button" class="sched-step" data-sched-week="${Math.max(1, selected - 1)}" aria-label="Previous week"${selected <= 1 ? " disabled" : ""}>‹</button><div class="sched-week-chips">${Array.from({ length: 18 }, (_, index) => {
    const week = index + 1;
    const cls = ["sched-week", week === selected ? "active" : "", week === current ? "is-current" : "", week < current ? "is-past" : "", playoffStart && week >= playoffStart ? "is-playoff" : ""].filter(Boolean).join(" ");
    return `<button type="button" class="${cls}" data-sched-week="${week}" aria-pressed="${week === selected}" title="Week ${week}${week === current ? " · current" : ""}${playoffStart && week >= playoffStart ? " · playoffs" : ""}">${week}</button>`;
  }).join("")}</div><button type="button" class="sched-step" data-sched-week="${Math.min(18, selected + 1)}" aria-label="Next week"${selected >= 18 ? " disabled" : ""}>›</button>`;
  strip.querySelector(".sched-week.active")?.scrollIntoView({ block: "nearest", inline: "center" });
}

// Reuse Gameday's live (clock-aware) odds so the same matchup never shows two different win chances.
function getGamedayLiveOdds(game) {
  const league = state.activeLeague;
  if (!league || game.awayId === null) return null;
  const entry = (window.FFOGameday?.data?.leagues || []).find(item => item.key === `${league.provider}:${league.leagueId}`);
  if (!entry || !Number.isFinite(entry.winPct) || !entry.me || !entry.opp) return null;
  const me = String(entry.me.teamId), opp = String(entry.opp.teamId);
  if (game.homeId === me && game.awayId === opp) return Math.round(entry.winPct);
  if (game.homeId === opp && game.awayId === me) return Math.round(100 - entry.winPct);
  return null;
}

function renderScheduleGame(game, week, projections, myId) {
  const home = state.managers.find(team => String(team.rosterId) === game.homeId);
  const away = game.awayId === null ? null : state.managers.find(team => String(team.rosterId) === game.awayId);
  const a = projections ? getScheduleTeamProjection(home, week, projections) : null;
  const b = projections && away ? getScheduleTeamProjection(away, week, projections) : null;
  const current = Number(state.week) || 0;
  const phase = week < current ? "final" : week === current ? "live" : "upcoming";
  const hasScores = game.homePts !== null && game.homePts !== undefined && (game.awayPts !== null && game.awayPts !== undefined) && (game.homePts > 0 || game.awayPts > 0);
  const actual = hasScores && phase !== "upcoming";
  const scoreA = actual ? game.homePts : a, scoreB = actual ? game.awayPts : b;
  const liveOdds = phase === "live" ? getGamedayLiveOdds(game) : null;
  const pct = liveOdds !== null ? liveOdds : a !== null && b !== null ? Math.round(computeHeadToHeadWinProb(a, b)) : null;
  const sideClass = (mine, other, odds) => {
    if (phase === "final" && actual) return mine > other ? " is-win" : mine < other ? " is-loss" : "";
    return odds !== null && odds > 50 ? " is-fav" : "";
  };
  const fmt = value => value === null || value === undefined ? "—" : value.toFixed(1);
  const sub = proj => actual ? (phase === "final" ? "Final" : `proj ${fmt(proj)}`) : proj === null ? "no projection" : "projected";
  const isMine = myId !== undefined && [game.homeId, game.awayId].includes(String(myId));
  const label = phase === "final" && actual ? "Final" : liveOdds !== null ? "Live odds" : phase === "live" && actual && pct !== null ? "Pregame odds" : phase === "live" && actual ? "Live" : pct !== null ? "Win odds" : "Matchup";
  const mid = !away ? '<div class="sched-mid"><span class="sched-phase">Bye</span></div>'
    : `<div class="sched-mid"><span class="sched-phase${phase === "live" && actual ? " is-live" : ""}">${label}</span>${pct !== null && !(phase === "final" && actual) ? `<div class="sched-odds" role="img" aria-label="${draftEscapeHtml(`${pct}% to ${100 - pct}% projected win odds`)}"><i style="width:${pct}%"></i></div><small>${pct}% · ${100 - pct}%</small>` : actual && phase === "final" ? `<small>${fmt(Math.abs(scoreA - scoreB))} margin</small>` : '<small>vs</small>'}</div>`;
  const side = (manager, id, score, proj, cls, where) => `<div class="sched-side is-${where}${cls}">${renderScheduleTeam(manager, id, week, projections)}<div class="sched-score"><b>${fmt(score)}</b><small>${sub(proj)}</small></div></div>`;
  return `<article class="league-matchup-card sched-game${isMine ? " is-mine" : ""}">${isMine ? '<span class="sched-mine-tag">Your matchup</span>' : ""}${side(home, game.homeId, scoreA, a, sideClass(scoreA, scoreB, pct), "home")}${mid}${away ? side(away, game.awayId, scoreB, b, sideClass(scoreB, scoreA, pct === null ? null : 100 - pct), "away") : '<div class="sched-side is-away is-empty"><strong>No opponent this week</strong></div>'}${game.note && game.note !== "Provider bye / unpaired" ? `<small class="sched-note">${draftEscapeHtml(game.note)}</small>` : ""}</article>`;
}

const scheduleProjectionLoads = new Map();

function getScheduleSource(league) {
  return Boolean(state.workspaceSnapshot) || league.provider === "yahoo" ? "snapshot" : "provider";
}

function fetchScheduleReport(league, week, force = false) {
  const context = getLeagueRecordsKey(league);
  const snapshot = getScheduleSource(league) === "snapshot";
  const cacheKey = `${context}:${week}:${snapshot ? "snapshot" : "provider"}`;
  const report = leagueScheduleCache.get(cacheKey);
  if (!force && report && Date.now() - report.checkedAt <= 60000) return Promise.resolve(report);
  if (!leagueScheduleLoads.has(cacheKey)) {
    const managers = [...state.managers];
    const pending = (async () => {
      let data, source;
      if (snapshot) {
        const completed = leagueRecordsCache.get(context)?.games.filter(game => game.week === week) || [];
        data = completed.length ? completed : week === Number(state.week) ? getNormalizedCurrentMatchups() : [];
        source = `${league.isDemo ? "Fictional demo" : "Saved/imported snapshot"} · Only supplied pairings; reconnect or re-import to update.`;
      } else if (league.provider === "sleeper") {
        data = await fetchJson(`https://api.sleeper.app/v1/league/${encodeURIComponent(league.leagueId)}/matchups/${week}`);
        source = "Sleeper published matchups";
      } else if (league.provider === "espn") {
        const response = await fetchEspnLeague(league.leagueId, league.season, ["mSettings", "mTeam", "mMatchup"]);
        league.espnData = { ...league.espnData, settings: response.settings, schedule: response.schedule };
        data = response.schedule;
        source = "ESPN published matchups";
      } else throw new Error("League schedule is not supported for this provider.");
      const normalized = normalizeLeagueSchedule(snapshot ? { provider: "snapshot" } : league, data, week, managers);
      const value = { ...normalized, source, checkedAt: Date.now() };
      leagueScheduleCache.set(cacheKey, value);
      return value;
    })().finally(() => leagueScheduleLoads.delete(cacheKey));
    leagueScheduleLoads.set(cacheKey, pending);
  }
  return leagueScheduleLoads.get(cacheKey);
}

function fetchScheduleProjections(league, week, force = false) {
  if (getScheduleSource(league) === "snapshot" || league.isDemo || !league.rosterPositions?.length) return Promise.resolve(null);
  const projectionKey = `${league.season}:${week}`;
  const cached = scheduleProjectionCache.get(projectionKey);
  if (!force && cached && Date.now() - cached.checkedAt <= 60000) return Promise.resolve(cached.values);
  if (!scheduleProjectionLoads.has(projectionKey)) {
    const pending = (async () => {
      const data = await fetchJson(`https://api.sleeper.app/v1/projections/nfl/regular/${encodeURIComponent(league.season)}/${week}`);
      if (!data || typeof data !== "object" || !Object.keys(data).length) throw new Error("No projection coverage for this week.");
      const values = Array.isArray(data) ? Object.fromEntries(data.filter(row => row.player_id).map(row => [row.player_id, row.stats || row])) : data;
      scheduleProjectionCache.set(projectionKey, { values, checkedAt: Date.now() });
      return values;
    })().finally(() => scheduleProjectionLoads.delete(projectionKey));
    scheduleProjectionLoads.set(projectionKey, pending);
  }
  return scheduleProjectionLoads.get(projectionKey);
}

// Warm the cache when a user hovers/touches a week so switching feels instant.
function prefetchScheduleWeek(week) {
  const league = state.activeLeague;
  if (!league || !state.managers.length || !(week >= 1 && week <= 18)) return;
  fetchScheduleReport(league, week).catch(() => {});
  fetchScheduleProjections(league, week).catch(() => {});
}

async function loadLeagueSchedule(force = false) {
  const league = state.activeLeague;
  const select = document.getElementById("leagueScheduleWeek");
  const status = document.getElementById("leagueScheduleStatus");
  const results = document.getElementById("leagueScheduleResults");
  if (!select || !status || !results) return;
  if (!league || !state.managers.length) {
    status.textContent = "Connect a league to see its schedule.";
    results.innerHTML = "";
    delete results.dataset.context;
    return;
  }
  const context = getLeagueRecordsKey(league);
  if (leagueScheduleContext !== context || !select.options.length) {
    leagueScheduleContext = context;
    select.innerHTML = Array.from({ length: 18 }, (_, index) => `<option value="${index + 1}">Week ${index + 1}</option>`).join("");
    select.value = String(state.week);
  }
  const week = Number(select.value);
  renderScheduleWeekStrip(week);
  const current = () => state.activeLeague === league && Number(select.value) === week;
  // Keep the previous week's cards on screen (dimmed) instead of blanking the section.
  if (results.dataset.context !== context) results.innerHTML = "";
  const keepContent = Boolean(results.firstElementChild);
  results.classList.toggle("is-refreshing", keepContent);
  results.setAttribute("aria-busy", "true");
  if (!keepContent) status.textContent = `Loading Week ${week} matchups…`;
  const done = () => { results.classList.remove("is-refreshing"); results.removeAttribute("aria-busy"); };
  try {
    const reportPromise = fetchScheduleReport(league, week, force);
    const projectionPromise = fetchScheduleProjections(league, week, force).then(values => ({ values }), error => ({ error }));
    const report = await reportPromise;
    if (!current()) return;
    const projectionResult = await projectionPromise;
    if (!current()) return;
    const projections = projectionResult.values || null;
    const projectionError = projectionResult.error ? `Projection feed unavailable: ${projectionResult.error.message}` : "";
    const manager = state.managers[Number(document.getElementById("teamSelect").value || "0")];
    const mine = document.getElementById("leagueScheduleScope").value === "mine";
    const games = report.games.filter(game => !mine || [game.homeId, game.awayId].includes(String(manager?.rosterId)));
    const myId = manager?.rosterId;
    const ordered = [...games].sort((x, y) => Number([y.homeId, y.awayId].includes(String(myId))) - Number([x.homeId, x.awayId].includes(String(myId))) || Number(x.awayId === null) - Number(y.awayId === null));
    status.textContent = `${report.source}${report.issues.length ? ` · ${report.issues.join(" ")}` : ""}${projectionError ? ` · ${projectionError}` : ""}`;
    const methodOpen = results.querySelector("details.gm-secondary")?.open ? " open" : "";
    results.innerHTML = games.length ? `<div class="league-matchup-cards sched-list">${ordered.map(game => renderScheduleGame(game, week, projections, myId)).join("")}</div><details class="gm-secondary"${methodOpen}><summary>Projection method</summary><p class="comparison-note">Week ${week} optimized active-roster projections, not your submitted lineup. Win odds are Fantasy Front Office's own model, so they can differ from Sleeper's in-app odds. Uses that week's Sleeper projections and supported scoring counters; ESPN totals use the reception preset, not all custom bonuses. Unknown schedules, missing player projections or unfilled starter slots withhold the total. Current Out/Doubtful players are excluded only in the selected current week; IR/PUP/Suspended remain excluded without a verified return date. No future recovery forecast is made.</p></details>` : `<p class="draft-empty">No published matchup available${mine ? " for your selected team" : ""}. Future playoff opponents may not be assigned yet.</p>`;
    lastScheduleView = { context, week, games: ordered, projections };
    results.dataset.context = context;
    done();
  } catch (error) {
    if (!current()) return;
    status.textContent = `Week ${week} schedule unavailable: ${error.message} Reload the page to retry.`;
    results.innerHTML = "";
    done();
  }
}
