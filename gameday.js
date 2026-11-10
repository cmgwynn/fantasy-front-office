(() => {
  const STORE_KEY = "fantasy-front-office:saved-leagues:v1";
  const VIEW_CACHE_KEY = "fantasy-front-office:gameday-view:v1";
  const REFRESH_MS = 60000;
  const STALE_MS = 10 * 60000;
  const INACTIVE_STATUSES = ["Out", "IR", "Suspended", "PUP", "NFI", "COV"];
  const persist = new URLSearchParams(location.search).get("resume") !== "0";
  let memoryStore = null;
  const cache = new Map();
  const gd = { data: null, loading: null, pending: null, loadedAt: 0, timer: null, error: "" };

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const fmt = value => value === null || value === undefined ? "--" : (Math.round((Number(value) || 0) * 10) / 10).toFixed(1);
  const teamCode = team => {
    let code = String(team || "").toUpperCase().trim();
    if (code === "JAC") code = "JAX"; if (code === "WSH") code = "WAS"; if (code === "LA") code = "LAR";
    return code;
  };
  const nameKey = (name, team) => `${String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "")}|${teamCode(team)}`;
  const normalizeInjury = value => {
    const raw = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    return { OUT: "Out", INJURY_RESERVE: "IR", IR: "IR", DOUBTFUL: "Doubtful", QUESTIONABLE: "Questionable", SUSPENSION: "Suspended", SUSPENDED: "Suspended", PUP: "PUP", O: "Out", D: "Doubtful", Q: "Questionable" }[raw] || "";
  };

  function emptyStore() { return { version: 1, sources: [], hidden: [] }; }

  function readStore() {
    if (!persist) return memoryStore || (memoryStore = emptyStore());
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (saved && saved.version === 1 && Array.isArray(saved.sources)) return { version: 1, sources: saved.sources, hidden: Array.isArray(saved.hidden) ? saved.hidden : [] };
    } catch {}
    return emptyStore();
  }

  function writeStore(store) {
    if (!persist) { memoryStore = store; return true; }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); return true; }
    catch (error) {
      // Yahoo payloads are the only large entries; keep the rest if storage is full.
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ ...store, sources: store.sources.map(source => source.type === "yahoo" ? { ...source, payload: null } : source) }));
        reportReloadWorkspaceError("Storage is nearly full. Connection names were saved, but Yahoo files must be re-imported to reopen them.");
        return true;
      } catch (fallbackError) {
        console.error("Saved connections could not be updated:", error, fallbackError);
        reportReloadWorkspaceError("Saved connections could not be updated. Check browser storage; your previous saved connections were retained.");
        return false;
      }
    }
  }

  function sourceKey(source) {
    if (source.type === "sleeper") return `sleeper-user:${String(source.userId || source.username || "").toLowerCase()}`;
    return `${source.type}:${source.leagueId}`;
  }

  function rememberSource(source) {
    if (!source || !["sleeper", "espn", "yahoo"].includes(source.type)) return;
    if (source.type === "sleeper" && !source.userId) return;
    if (source.type !== "sleeper" && !source.leagueId) return;
    const store = readStore();
    const key = sourceKey(source);
    const clean = { ...source, savedAt: Date.now() };
    const index = store.sources.findIndex(item => sourceKey(item) === key);
    if (index >= 0) store.sources[index] = { ...store.sources[index], ...clean };
    else store.sources.push(clean);
    if (!writeStore(store)) throw new Error("The connection loaded but could not be saved on this browser.");
    gd.loadedAt = 0;
    renderSavedManager();
  }

  function removeSource(key) {
    const store = readStore();
    store.sources = store.sources.filter(source => sourceKey(source) !== key);
    if (!writeStore(store)) return false;
    gd.data = null; gd.loadedAt = 0;
    document.dispatchEvent(new CustomEvent("ffo:gameday-data"));
    return true;
  }

  function setLeagueHidden(leagueKey, hidden) {
    const store = readStore();
    store.hidden = store.hidden.filter(key => key !== leagueKey);
    if (hidden) store.hidden.push(leagueKey);
    if (!writeStore(store)) return false;
    return true;
  }

  async function cached(key, ttl, loader) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.value;
    const value = await loader();
    cache.set(key, { value, at: Date.now() });
    return value;
  }

  function remainingFraction(state, period, clock) {
    if (state === "pre") return 1;
    if (state === "post") return 0;
    if (period > 4) return 0.03;
    const seconds = (4 - Math.max(1, period)) * 900 + Math.max(0, Number(clock) || 0);
    return Math.min(1, Math.max(0.02, seconds / 3600));
  }

  function normalizeScoreboard(data) {
    const byTeam = {};
    const games = [];
    (data?.events || []).forEach(event => {
      const comp = event.competitions?.[0];
      if (!comp) return;
      const status = comp.status || event.status || {};
      const gameState = status.type?.state || "pre";
      const side = homeAway => {
        const team = (comp.competitors || []).find(item => item.homeAway === homeAway) || {};
        return { team: teamCode(team.team?.abbreviation), score: Number(team.score) || 0, teamId: String(team.team?.id || "") };
      };
      const home = side("home");
      const away = side("away");
      const possessionId = String(comp.situation?.possession || "");
      const game = {
        id: String(event.id), kickoff: Date.parse(event.date) || 0, state: gameState,
        detail: status.type?.shortDetail || "", period: Number(status.period) || 0, clock: Number(status.clock) || 0,
        home, away, remaining: remainingFraction(gameState, Number(status.period) || 0, status.clock),
        possession: possessionId && possessionId === home.teamId ? home.team : possessionId && possessionId === away.teamId ? away.team : "",
        redZone: Boolean(comp.situation?.isRedZone)
      };
      games.push(game);
      byTeam[home.team] = game;
      byTeam[away.team] = game;
    });
    (data?.week?.teamsOnBye || []).forEach(team => { byTeam[teamCode(team.abbreviation)] = { state: "bye", remaining: 0, detail: "Bye" }; });
    games.sort((a, b) => (a.state === "in" ? 0 : a.state === "pre" ? 1 : 2) - (b.state === "in" ? 0 : b.state === "pre" ? 1 : 2) || a.kickoff - b.kickoff);
    return { byTeam, games };
  }

  function playerGame(team, scoreboard) {
    return scoreboard.byTeam[teamCode(team)] || { state: team && team !== "FA" ? "bye" : "none", remaining: 0, detail: team && team !== "FA" ? "Bye" : "No game" };
  }

  function finishPlayer(player, scoreboard) {
    const game = playerGame(player.team, scoreboard);
    const inactive = INACTIVE_STATUSES.includes(player.injury);
    const projectionMissing = player.proj === null || player.proj === undefined;
    const proj = Number(player.proj) || 0;
    const points = Number(player.points) || 0;
    const remaining = inactive && game.state === "pre" ? 0 : game.remaining;
    const projFinal = game.state === "post" || game.state === "bye" || game.state === "none" ? points
      : game.state === "pre" ? (inactive ? 0 : proj) : points + proj * remaining;
    let gameLabel = game.detail || "";
    if (game.home && game.away) {
      const isHome = game.home.team === teamCode(player.team);
      const opp = isHome ? game.away.team : game.home.team;
      gameLabel = game.state === "pre"
        ? `${isHome ? "vs" : "@"} ${opp} · ${new Date(game.kickoff).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`
        : `${isHome ? "vs" : "@"} ${opp} · ${game.detail}`;
    }
    return { ...player, projectionBaseline: remaining > 0 ? player.projectionBaseline || "" : "", proj: projectionMissing ? null : proj, points, projFinal: projectionMissing && remaining > 0 && !inactive ? null : projFinal, remaining, gameState: game.state, gameLabel, onField: game.possession === teamCode(player.team), redZone: Boolean(game.redZone && game.possession === teamCode(player.team)) };
  }

  function sideTotals(players, points) {
    const live = players.reduce((sum, player) => sum + player.points, 0);
    const actual = Number.isFinite(Number(points)) && points !== null ? Number(points) : live;
    const projected = players.some(player => player.projFinal === null) ? null : actual + players.reduce((sum, player) => sum + (player.projFinal - player.points), 0);
    const variance = players.reduce((sum, player) => sum + Math.pow(0.45 * player.proj, 2) * player.remaining, 0);
    return { points: actual, projected, variance, projectionEstimated: players.some(player => player.projectionBaseline), playing: players.filter(p => p.gameState === "in").length, toPlay: players.filter(p => p.gameState === "pre" && !INACTIVE_STATUSES.includes(p.injury)).length };
  }

  function winProbability(me, opp) {
    if (!opp || me.projected === null || opp.projected === null) return null;
    const diff = me.projected - opp.projected;
    const sd = Math.sqrt(me.variance + opp.variance);
    if (sd < 0.5) return diff > 0 ? 100 : diff < 0 ? 0 : 50;
    const z = diff / sd / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * Math.abs(z));
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return Math.min(99.5, Math.max(0.5, 50 * (1 + Math.sign(z) * y)));
  }

  function scoreSleeperProjection(stats, rules, position) {
    return scoreConfiguredStats(stats, rules, position, "sleeper").points;
  }

  function sleeperPlayer(id, slot, points, projections, rules, projectionError = "") {
    if (!id || id === "0") return { key: `empty:${slot}`, empty: true, slot, name: "Empty slot", position: slot, team: "", proj: 0, points: 0, injury: "" };
    const player = (typeof state !== "undefined" && state.players?.[id]) || {};
    const isDef = /^[A-Z]{2,3}$/.test(id);
    const name = player.name || (isDef ? `${id} D/ST` : `Player ${id}`);
    const team = player.team || (isDef ? id : "");
    const coverage = scoreConfiguredStats(projections?.[id], rules, player.position || (isDef ? "DEF" : ""), "sleeper");
    const baseline = coverage.points === null && !projectionError ? getSleeperBaselineProjection(projections?.[id], rules) : null;
    const projectionIssue = projectionError || [
      !projections?.[id] ? "No weekly player projection supplied" : "",
      coverage.missing.length ? `Missing scoring inputs: ${coverage.missing.join(", ")}` : "",
      coverage.unsupported.length ? `Unsupported scoring rules: ${coverage.unsupported.join(", ")}` : ""
    ].filter(Boolean).join(". ");
    return {
      key: nameKey(name, team), id: String(id), slot, name, position: player.position || (isDef ? "DEF" : ""), team,
      photo: typeof avatarUrl === "function" ? avatarUrl({ ...player, id: String(id), position: player.position || (isDef ? "DEF" : ""), team }) : "",
      injury: normalizeInjury(player.injuryStatus) || (player.injuryStatus && player.injuryStatus !== "Healthy" ? player.injuryStatus : ""),
      points: Number(points?.[id]) || 0, proj: baseline ? baseline.points : coverage.points, projectionIssue,
      projectionBaseline: baseline?.basis || ""
    };
  }

  function sleeperAvatar(user) {
    const custom = user?.metadata?.avatar;
    if (custom && /^https:\/\//.test(custom)) return custom;
    return user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${encodeURIComponent(user.avatar)}` : "";
  }

  // Rank by win% then points for; gap is games back of the last playoff spot (negative = cushion over first team out).
  function computeStanding(rows, myId, playoffTeams) {
    if (!rows.length) return null;
    const pct = row => { const games = row.wins + row.losses + row.ties; return games ? (row.wins + row.ties / 2) / games : 0; };
    const sorted = [...rows].sort((a, b) => pct(b) - pct(a) || b.pf - a.pf);
    const index = sorted.findIndex(row => String(row.id) === String(myId));
    if (index < 0) return null;
    const me = sorted[index];
    const spots = Math.min(sorted.length, Math.max(1, Number(playoffTeams) || Math.ceil(sorted.length / 2)));
    const gamesBack = (a, b) => ((a.wins - b.wins) + (b.losses - a.losses)) / 2;
    const gap = index < spots ? (sorted[spots] ? -gamesBack(me, sorted[spots]) : null) : gamesBack(sorted[spots - 1], me);
    return {
      rank: index + 1, teams: sorted.length, playoffTeams: spots, wins: me.wins, losses: me.losses, ties: me.ties, pf: me.pf,
      pfRank: [...rows].sort((a, b) => b.pf - a.pf).findIndex(row => String(row.id) === String(myId)) + 1, gap
    };
  }

  async function loadSleeperSource(source, ctx) {
    const leagues = await cached(`sl-leagues:${source.userId}:${ctx.season}`, STALE_MS, () => fetchJson(`https://api.sleeper.app/v1/user/${encodeURIComponent(source.userId)}/leagues/nfl/${ctx.season}`));
    const active = (leagues || []).filter(league => ["in_season", "post_season"].includes(league.status));
    return Promise.all(active.map(async league => {
      const key = `sleeper:${league.league_id}`;
      const base = { key, provider: "sleeper", name: league.name || "Sleeper league", url: `https://sleeper.com/leagues/${league.league_id}/matchup`, sourceKey: sourceKey(source) };
      if (ctx.hidden.has(key)) return { ...base, hidden: true };
      try {
        const [rosters, users, matchups] = await Promise.all([
          cached(`sl-rosters:${league.league_id}`, STALE_MS, () => fetchJson(`https://api.sleeper.app/v1/league/${league.league_id}/rosters`)),
          cached(`sl-users:${league.league_id}`, STALE_MS, () => fetchJson(`https://api.sleeper.app/v1/league/${league.league_id}/users`)),
          fetchJson(`https://api.sleeper.app/v1/league/${league.league_id}/matchups/${ctx.week}`)
        ]);
        const usersById = new Map((users || []).map(user => [String(user.user_id), user]));
        const mine = (rosters || []).find(roster => String(roster.owner_id) === String(source.userId) || (roster.co_owners || []).map(String).includes(String(source.userId)));
        if (!mine) return { ...base, error: "No roster for this account." };
        const slots = (league.roster_positions || []).filter(slot => !["BN", "IR", "TAXI"].includes(slot));
        const rules = league.scoring_settings || {};
        const side = roster => {
          const row = (matchups || []).find(item => item.roster_id === roster.roster_id);
          const user = usersById.get(String(roster.owner_id)) || {};
          const starters = row?.starters || roster.starters || [];
          return {
            teamId: String(roster.roster_id), name: user.metadata?.team_name || user.display_name || `Team ${roster.roster_id}`,
            avatar: sleeperAvatar(user), matchupId: row?.matchup_id ?? null, points: row ? Number(row.points) || 0 : null,
            players: starters.map((id, index) => sleeperPlayer(id, slots[index] || "FLEX", row?.players_points, ctx.projections, rules, ctx.projectionError))
          };
        };
        const me = side(mine);
        const oppRow = me.matchupId === null ? null : (matchups || []).find(item => item.matchup_id === me.matchupId && item.roster_id !== mine.roster_id);
        const oppRoster = oppRow ? (rosters || []).find(roster => roster.roster_id === oppRow.roster_id) : null;
        const standing = computeStanding((rosters || []).map(roster => {
          const st = roster.settings || {};
          return { id: roster.roster_id, wins: Number(st.wins) || 0, losses: Number(st.losses) || 0, ties: Number(st.ties) || 0, pf: (Number(st.fpts) || 0) + (Number(st.fpts_decimal) || 0) / 100 };
        }), mine.roster_id, league.settings?.playoff_teams);
        return { ...base, leagueId: String(league.league_id), me, opp: oppRoster ? side(oppRoster) : null, standing, playoffStart: Number(league.settings?.playoff_week_start) || null,
          rostered: [...new Set((rosters || []).flatMap(roster => [...(roster.players || []), ...(roster.reserve || []), ...(roster.taxi || [])]).map(String))],
          waiver: Number(league.settings?.waiver_type) === 2
            ? { faab: true, budget: Number(league.settings?.waiver_budget) || 0, spent: Number(mine.settings?.waiver_budget_used) || 0, priority: Number(mine.settings?.waiver_position) || null }
            : { faab: false, priority: Number(mine.settings?.waiver_position) || null } };
      } catch (error) {
        return { ...base, error: error.message || "Could not load this league." };
      }
    }));
  }

  function espnStat(player, week, sourceId) {
    const row = (player.stats || []).find(stat => Number(stat.scoringPeriodId) === Number(week) && Number(stat.statSourceId) === sourceId && Number(stat.statSplitTypeId ?? 1) === 1);
    return row?.appliedTotal === null || row?.appliedTotal === undefined || !Number.isFinite(Number(row.appliedTotal)) ? null : Number(row.appliedTotal);
  }

  function espnPlayer(entry, week) {
    const player = entry.playerPoolEntry?.player || entry.player || {};
    const position = (typeof ESPN_POSITION_CODES !== "undefined" && ESPN_POSITION_CODES[player.defaultPositionId]) || "FLEX";
    const team = (typeof ESPN_TEAM_CODES !== "undefined" && ESPN_TEAM_CODES[player.proTeamId]) || "FA";
    const name = position === "DEF" ? `${team} D/ST` : player.fullName || "Player";
    const internalId = typeof ESPN_PLAYER_TO_INTERNAL_ID !== "undefined" ? ESPN_PLAYER_TO_INTERNAL_ID.get(String(player.id)) : "";
    const known = internalId && typeof state !== "undefined" ? state.players?.[internalId] : null;
    const photo = position === "DEF" ? (typeof teamLogoUrl === "function" ? teamLogoUrl(team) : "") : `https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(player.id)}.png`;
    return {
      key: nameKey(known?.name || name, team), id: internalId || `espn_${player.id}`, slot: position, name: known?.name || name, position, team, photo,
      injury: normalizeInjury(player.injuryStatus), points: espnStat(player, week, 0), proj: espnStat(player, week, 1),
      projectionIssue: espnStat(player, week, 1) === null ? `ESPN did not supply a league-scored projection for Week ${week}` : ""
    };
  }

  async function loadEspnSource(source, ctx) {
    const key = `espn:${source.leagueId}`;
    const base = { key, provider: "espn", name: source.name || `ESPN League ${source.leagueId}`, url: `https://fantasy.espn.com/football/league?leagueId=${encodeURIComponent(source.leagueId)}`, sourceKey: sourceKey(source) };
    if (ctx.hidden.has(key)) return [{ ...base, hidden: true }];
    try {
      const url = new URL(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${ctx.season}/segments/0/leagues/${encodeURIComponent(source.leagueId)}`);
      ["mTeam", "mRoster", "mMatchup", "mSettings"].forEach(view => url.searchParams.append("view", view));
      url.searchParams.set("scoringPeriodId", ctx.week);
      const data = await fetchJson(url, { credentials: "include" });
      const teams = data?.teams || [];
      if (!teams.length) throw new Error("ESPN returned no teams.");
      const teamName = team => team.name || `${team.location || ""} ${team.nickname || ""}`.trim() || `Team ${team.id}`;
      const selections = (typeof state !== "undefined" && state.portfolioRosterSelections) || {};
      const myId = String(selections[key] || source.teamId || teams[0].id);
      const periods = data.settings?.scheduleSettings?.matchupPeriods;
      const mappedPeriod = Object.entries(periods || {}).find(([, weeks]) => Array.isArray(weeks) && weeks.some(week => Number(week) === Number(ctx.week)))?.[0];
      const period = Number(mappedPeriod) || (periods ? Number(ctx.week) : Number(data.status?.currentMatchupPeriod) || Number(ctx.week));
      const game = (data.schedule || []).find(item => Number(item.matchupPeriodId) === period && [item.home?.teamId, item.away?.teamId].map(String).includes(myId));
      const side = teamId => {
        const team = teams.find(item => String(item.id) === String(teamId));
        if (!team) return null;
        const slot = game && String(game.home?.teamId) === String(teamId) ? game.home : game?.away;
        const entries = (team.roster?.entries || []).filter(entry => ![20, 21].includes(Number(entry.lineupSlotId)));
        return {
          teamId: String(team.id), name: teamName(team), avatar: team.logo || "", matchupId: game ? String(game.id) : null,
          points: slot ? Number(slot.totalPointsLive ?? slot.totalPoints) : null,
          players: entries.map(entry => espnPlayer(entry, ctx.week))
        };
      };
      const me = side(myId);
      if (me && game) me.points = null;
      const oppId = game ? String(game.home?.teamId) === myId ? game.away?.teamId : game.home?.teamId : null;
      const opp = oppId !== null && oppId !== undefined ? side(oppId) : null;
      if (opp) opp.points = null;
      const standing = computeStanding(teams.map(team => {
        const record = team.record?.overall || {};
        return { id: team.id, wins: Number(record.wins) || 0, losses: Number(record.losses) || 0, ties: Number(record.ties) || 0, pf: Number(record.pointsFor) || 0 };
      }), myId, data.settings?.scheduleSettings?.playoffTeamCount);
      const myTeam = teams.find(team => String(team.id) === myId) || {};
      const acquisition = data.settings?.acquisitionSettings || {};
      const rostered = [...new Set(teams.flatMap(team => (team.roster?.entries || []).map(entry => {
        const espnId = String(entry.playerPoolEntry?.player?.id ?? entry.playerId ?? "");
        return (typeof ESPN_PLAYER_TO_INTERNAL_ID !== "undefined" && ESPN_PLAYER_TO_INTERNAL_ID.get(espnId)) || `espn_${espnId}`;
      })))];
      const waiver = acquisition.isUsingAcquisitionBudget
        ? { faab: true, budget: Number(acquisition.acquisitionBudget) || 0, spent: Number(myTeam.transactionCounter?.acquisitionBudgetSpent) || 0, priority: Number(myTeam.waiverRank) || null }
        : { faab: false, priority: Number(myTeam.waiverRank) || null };
      return [{ ...base, leagueId: String(source.leagueId), name: data.settings?.name || base.name, me, opp, standing, rostered, waiver, playoffStart: Number(data.settings?.scheduleSettings?.matchupPeriodCount) ? Number(data.settings.scheduleSettings.matchupPeriodCount) + 1 : null, teams: teams.map(team => ({ id: String(team.id), name: teamName(team) })) }];
    } catch (error) {
      return [{ ...base, error: `${error.message || "Could not load."} Private ESPN leagues only load while you are signed in to ESPN in this browser.` }];
    }
  }

  function loadYahooSource(source, ctx) {
    const key = `yahoo:${source.leagueId}`;
    const base = { key, provider: "yahoo", name: source.name || "Yahoo league", url: "https://football.fantasysports.yahoo.com/", sourceKey: sourceKey(source), imported: true };
    if (ctx.hidden.has(key)) return [{ ...base, hidden: true }];
    const teams = source.payload?.teams || [];
    if (!teams.length) return [{ ...base, error: "Import the Yahoo file again to refresh this league." }];
    const selections = (typeof state !== "undefined" && state.portfolioRosterSelections) || {};
    const ids = teams.map((team, index) => String(team.teamId || team.id || index + 1));
    const myIndex = Math.max(0, ids.indexOf(String(selections[key] || ids[0])));
    const side = index => {
      const team = teams[index];
      if (!team) return null;
      const players = (team.players || []).filter(player => [true, "true", "1", "yes", 1].includes(player.starter)).map(player => ({
        key: nameKey(player.name, player.nflTeam || player.team), id: String(player.playerId || player.name), slot: String(player.position || "").toUpperCase(),
        name: player.name, position: String(player.position || "").toUpperCase(), team: teamCode(player.nflTeam || player.team), photo: "",
        injury: normalizeInjury(player.injuryStatus), points: Number(player.actualPoints) || 0, proj: Number(player.projectedPoints) || 0
      }));
      return { teamId: ids[index], name: team.teamName || `Team ${index + 1}`, avatar: "", points: null, players };
    };
    const me = side(myIndex);
    const matchup = (source.payload?.matchups || []).find(item => [item.homeId, item.awayId, item.homeName, item.awayName].map(String).some(value => value === me.teamId || value === me.name));
    let opp = null;
    if (matchup) {
      const oppRef = [matchup.homeId, matchup.homeName].map(String).some(value => value === me.teamId || value === me.name) ? [matchup.awayId, matchup.awayName] : [matchup.homeId, matchup.homeName];
      const oppIndex = teams.findIndex((team, index) => oppRef.map(String).includes(ids[index]) || oppRef.map(String).includes(team.teamName));
      opp = oppIndex >= 0 ? side(oppIndex) : null;
    }
    const standing = computeStanding(teams.map((team, index) => ({ id: ids[index], wins: Number(team.wins) || 0, losses: Number(team.losses) || 0, ties: Number(team.ties) || 0, pf: Number(team.pointsFor) || 0 })), me.teamId, source.payload?.playoffTeams);
    return [{ ...base, me, opp, standing, teams: teams.map((team, index) => ({ id: ids[index], name: team.teamName || `Team ${index + 1}` })) }];
  }

  function finalizeLeague(league, scoreboard) {
    if (league.hidden || league.error || !league.me) return league;
    const finishSide = side => {
      if (!side) return null;
      const players = side.players.map(player => player.empty ? { ...player, projFinal: 0, remaining: 0, gameState: "none", gameLabel: "" } : finishPlayer(player, scoreboard));
      return { ...side, players, ...sideTotals(players, side.points) };
    };
    const me = finishSide(league.me);
    const opp = finishSide(league.opp);
    return { ...league, me, opp, winPct: winProbability(me, opp) };
  }

  function buildAlerts(leagues) {
    const alerts = [];
    leagues.filter(league => league.me && !league.hidden && !league.error).forEach(league => league.me.players.forEach(player => {
      if (player.empty) { alerts.push({ level: "danger", league: league.name, leagueKey: league.key, player, text: `Empty ${player.slot} slot` }); return; }
      if (!["pre", "bye", "none"].includes(player.gameState)) return;
      const base = { league: league.name, leagueKey: league.key, player };
      if (player.gameState === "bye") alerts.push({ ...base, level: "danger", text: "On bye" });
      else if (INACTIVE_STATUSES.includes(player.injury) || player.injury === "Doubtful") alerts.push({ ...base, level: "danger", text: player.injury });
      else if (player.injury === "Questionable") alerts.push({ ...base, level: "warn", text: "Questionable" });
    }));
    return alerts.sort((a, b) => (a.level === "danger" ? 0 : 1) - (b.level === "danger" ? 0 : 1));
  }

  function buildRooting(leagues) {
    const map = new Map();
    const add = (player, league, direction) => {
      if (player.empty || player.gameState === "post" || player.gameState === "bye" || player.gameState === "none") return;
      const entry = map.get(player.key) || { player, cheer: [], against: [], weight: 0 };
      entry[direction].push(league.name);
      entry.weight += player.proj * Math.max(0.05, player.remaining) * (direction === "cheer" ? 1 : -1);
      map.set(player.key, entry);
    };
    leagues.filter(league => league.me && league.opp && !league.hidden && !league.error).forEach(league => {
      league.me.players.forEach(player => add(player, league, "cheer"));
      league.opp.players.forEach(player => add(player, league, "against"));
    });
    const entries = [...map.values()];
    return {
      cheer: entries.filter(entry => entry.cheer.length && !entry.against.length).sort((a, b) => b.cheer.length - a.cheer.length || b.weight - a.weight),
      against: entries.filter(entry => entry.against.length && !entry.cheer.length).sort((a, b) => b.against.length - a.against.length || a.weight - b.weight),
      conflicted: entries.filter(entry => entry.cheer.length && entry.against.length).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    };
  }

  async function loadGameday() {
    const store = readStore();
    const nfl = await cached("nfl-state", REFRESH_MS, () => fetchJson("https://api.sleeper.app/v1/state/nfl"));
    const season = String(nfl?.season || new Date().getFullYear());
    const week = Math.min(18, Math.max(1, Number(nfl?.display_week || nfl?.week) || 1));
    const offseason = nfl?.season_type && nfl.season_type !== "regular";
    let projectionError = typeof fetchSleeperWeekProjections === "function" ? "" : "Weekly projection feed is unavailable.";
    const [board, projections] = await Promise.all([
      fetchJson(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`),
      typeof fetchSleeperWeekProjections === "function" ? fetchSleeperWeekProjections(season, week).catch(error => {
        console.error("Gameday weekly projections could not be loaded:", error);
        projectionError = "Weekly projections could not be loaded. Refresh Gameday to retry.";
        return {};
      }) : {}
    ]);
    if (!Array.isArray(board?.events)) throw new Error("NFL scoreboard returned an invalid response. Refresh Gameday to retry.");
    const scoreboard = normalizeScoreboard(board);
    const ctx = { season, week, projections, projectionError, hidden: new Set(store.hidden) };
    const groups = await Promise.all(store.sources.map(source => {
      const run = source.type === "sleeper" ? loadSleeperSource(source, ctx) : source.type === "espn" ? loadEspnSource(source, ctx) : Promise.resolve(loadYahooSource(source, ctx));
      return run.catch(error => [{ key: sourceKey(source), provider: source.type, name: source.username || source.name || "League", sourceKey: sourceKey(source), error: error.message }]);
    }));
    const leagues = groups.flat().map(league => finalizeLeague(league, scoreboard));
    return { season, week, offseason, scoreboard, leagues, checkedAt: Date.now() };
  }

  function photo(player, size = 32) {
    const src = player.photo || "";
    const initials = esc(String(player.name || "?").split(/\s+/).map(part => part[0]).join("").slice(0, 2));
    return `<span class="gd-photo" style="width:${size}px;height:${size}px">${src ? `<img src="${esc(src)}" alt="" width="${size}" height="${size}" loading="lazy" onerror="this.remove()">` : ""}<b>${initials}</b></span>`;
  }

  function renderStrip(scoreboard) {
    if (!scoreboard.games.length) return "";
    return `<div class="gd-strip" role="list" aria-label="NFL games">${scoreboard.games.map(game => {
      const lead = game.state !== "pre" ? (game.home.score > game.away.score ? "home" : game.away.score > game.home.score ? "away" : "") : "";
      const row = (side, key) => `<span class="gd-strip-team${lead === key ? " lead" : ""}${game.possession === side.team ? " has-ball" : ""}"><span>${esc(side.team)}</span><b data-gd-score>${game.state === "pre" ? "" : side.score}</b></span>`;
      const label = game.state === "pre" ? new Date(game.kickoff).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : game.detail;
      return `<div class="gd-strip-game is-${game.state}${game.redZone ? " red-zone" : ""}" role="listitem" data-gd-key="g${esc(game.id)}">${row(game.away, "away")}${row(game.home, "home")}<small>${esc(label)}</small></div>`;
    }).join("")}</div>`;
  }

  function renderAlerts(alerts) {
    if (!alerts.length) return "";
    return `<section class="gd-alerts" aria-label="Lineup alerts"><h3>Fix before kickoff <span class="gameday-count">${alerts.length}</span></h3><div class="gd-alert-list">${alerts.slice(0, 12).map(alert => `<button type="button" class="gd-alert is-${alert.level}" data-gd-key="a${esc(alert.league)}${esc(alert.player.key)}"${canManage(alert.leagueKey) ? ` data-gameday-manage="${esc(alert.leagueKey)}" title="Open the lineup in ${esc(alert.league)}"` : " disabled"}>${alert.player.empty ? '<span class="gd-photo" style="width:28px;height:28px"><b>!</b></span>' : photo(alert.player, 28)}<div><strong>${esc(alert.player.empty ? alert.text : alert.player.name)}</strong><small>${esc(alert.player.empty ? alert.league : `${alert.text} · ${alert.league}`)}</small></div></button>`).join("")}</div></section>`;
  }

  function renderPlayerRow(player) {
    const status = player.gameState === "in" ? "is-live" : player.gameState === "post" ? "is-done" : player.gameState === "pre" ? "is-pre" : "is-out";
    const injury = player.injury ? ` <em class="gd-injury" title="${esc(player.injury)}">${esc({ Questionable: "Q", Doubtful: "D", Out: "OUT", Suspended: "SUS" }[player.injury] || player.injury)}</em>` : "";
    return `<li class="gd-player ${status}${player.onField ? " on-field" : ""}${player.redZone ? " red-zone" : ""}" data-gd-key="p${esc(player.slot)}${esc(player.key)}">
      <span class="gd-slot">${esc(player.slot === "SUPER_FLEX" ? "SF" : player.slot === "REC_FLEX" ? "RF" : player.slot)}</span>
      ${player.empty ? '<span class="gd-photo" style="width:30px;height:30px"><b>—</b></span>' : photo(player, 30)}
      <span class="gd-player-name"><strong>${esc(player.name)}${injury}</strong><small>${esc([player.position, player.team].filter(Boolean).join(" · "))}${player.gameLabel ? ` · ${esc(player.gameLabel)}` : ""}</small></span>
      <span class="gd-player-pts"><b data-gd-score>${fmt(player.points)}</b><small${player.projFinal === null || player.projectionBaseline ? ` title="${esc(player.projectionIssue || "Projection inputs unavailable")}"` : ""}>${player.gameState === "post" ? "final" : `${player.projectionBaseline ? `${esc(player.projectionBaseline)} est` : "proj"} ${fmt(player.projFinal)}`}</small></span>
    </li>`;
  }

  function ordinal(n) {
    const v = n % 100;
    return `${n}${["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th"}`;
  }

  function standingGapLabel(standing) {
    if (!standing || standing.gap === null) return "";
    const abs = Math.abs(standing.gap);
    const games = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
    if (standing.rank <= standing.playoffTeams) return standing.gap < 0 ? `+${games} over the cut` : standing.gap === 0 ? "Tied at the cut" : "In";
    return standing.gap > 0 ? `${games} GB of playoffs` : "Tied at the cut";
  }

  function renderStanding(standing) {
    if (!standing) return "";
    const record = `${standing.wins}-${standing.losses}${standing.ties ? `-${standing.ties}` : ""}`;
    const inField = standing.rank <= standing.playoffTeams;
    return `<p class="gd-standing${inField ? " is-in" : " is-out"}"><b>${ordinal(standing.rank)}</b> of ${standing.teams} · ${record}<span>${esc(standingGapLabel(standing))}</span></p>`;
  }

  function canManage(key) {
    return typeof window.openTrackedLeague === "function" && /^(sleeper|espn):/.test(String(key || ""));
  }

  function renderTeamPicker(league) {
    if (!league.teams || league.provider === "sleeper") return "";
    return `<label class="gd-team-picker">My team<select data-gameday-team="${esc(league.key)}">${league.teams.map(team => `<option value="${esc(team.id)}"${team.id === league.me?.teamId ? " selected" : ""}>${esc(team.name)}</option>`).join("")}</select></label>`;
  }

  function lineupProgress(players, scoreboard) {
    const counts = { live: 0, upcoming: 0, finished: 0, inactive: 0, bye: 0, unknown: 0, empty: 0 };
    players.forEach(player => {
      if (player.empty) { counts.empty++; return; }
      const game = scoreboard.byTeam[teamCode(player.team)];
      if (!game) { counts.unknown++; return; }
      if (game.state === "post") counts.finished++;
      else if (game.state === "bye") counts.bye++;
      else if (game.state === "pre" && INACTIVE_STATUSES.includes(player.injury)) counts.inactive++;
      else if (game.state === "pre") counts.upcoming++;
      else if (game.state === "in") counts.live++;
      else counts.unknown++;
    });
    return counts;
  }

  let lineupDialog;
  let lineupSelection;
  function renderProjectionNotice(side) {
    if (!side || (side.projected !== null && !side.projectionEstimated)) return "";
    const affected = side.players.filter(player => player.projFinal === null || player.projectionBaseline);
    return `<details class="gd-projection-issues" data-gd-key="projection-${esc(side.teamId)}"><summary>${esc(side.name)}: ${side.projected === null ? "projected final unavailable" : "projected final uses baseline estimates"} (${affected.length} starter${affected.length === 1 ? "" : "s"})</summary><p class="gd-none">Available Sleeper baselines estimate remaining points when exact league scoring is incomplete. Custom scoring differences are not included. Missing baselines remain unavailable.</p><ul>${affected.map(player => `<li><strong>${esc(player.name)}</strong>: ${player.projectionBaseline ? `${esc(player.projectionBaseline)} baseline estimate. ` : ""}${esc(player.projectionIssue || "Projection inputs unavailable")}</li>`).join("")}</ul></details>`;
  }

  function renderLineupComparison() {
    if (!lineupDialog?.open || !lineupSelection) return;
    const league = gd.data?.leagues.find(item => item.key === lineupSelection.key && !item.hidden && !item.error);
    const body = lineupDialog.querySelector(".gd-lineup-body");
    if (!league) {
      morph(body, '<p role="status">This matchup is no longer available. Close this view and refresh Gameday.</p>');
      return;
    }
    const panel = (side, key) => {
      if (!side) return '<section class="gd-lineup-team"><h4>No opponent this week</h4></section>';
      const counts = lineupProgress(side.players, gd.data.scoreboard);
      const progress = [`${counts.live} live`, `${counts.upcoming} yet to play`, `${counts.finished} finished`,
        ...[["inactive", "inactive"], ["bye", "on bye"], ["unknown", "status unknown"], ["empty", "empty slots"]]
          .filter(([kind]) => counts[kind]).map(([kind, label]) => `${counts[kind]} ${label}`)].join(" · ");
      const players = side.players.map(player => {
        if (player.empty) return player;
        const game = gd.data.scoreboard.byTeam[teamCode(player.team)];
        return { ...player, gameLabel: !game ? "Game status unknown" : game.state === "post" ? `${player.gameLabel} · Finished` : game.state === "in" ? `${player.gameLabel} · Live` : player.gameLabel };
      });
      return `<section class="gd-lineup-team${key === lineupSelection.side ? " is-selected" : ""}" data-gd-key="${key}">
        <h4 tabindex="-1" data-lineup-heading="${key}">${esc(side.name)} <small>${key === "me" ? "Your team" : "Opponent"}</small></h4>
        <p class="gd-lineup-total"><b data-gd-score>${fmt(side.points)}</b> actual · ${fmt(side.projected)} projected final${side.projectionEstimated ? " (baseline estimate)" : ""}</p>
        ${renderProjectionNotice(side)}
        <p class="gd-lineup-progress">${esc(progress)}</p>
        ${players.length ? `<ul class="gd-players">${players.map(renderPlayerRow).join("")}</ul>` : '<p>No starting lineup supplied by the provider.</p>'}
      </section>`;
    };
    morph(body, `<p class="gd-lineup-context">Week ${esc(gd.data.week)} · ${esc(league.name)}${league.imported ? " · Imported snapshot, not live" : ""} · Updated ${esc(new Date(gd.data.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))}${gd.error ? ` · ${esc(gd.error)}` : ""}</p><p class="gd-lineup-note">Starters only. Yet to play excludes known inactive players; game status does not guarantee participation. Scores and statuses can be delayed.</p><div class="gd-lineup-grid">${panel(league.me, "me")}${panel(league.opp, "opp")}</div>`);
  }

  function openLineupComparison(key, side) {
    if (!window.FFOUsage?.isAllowed()) { showConnectedBetaGate(); return; }
    if (!gd.data?.leagues.some(league => league.key === key && !league.hidden && !league.error && league[side])) return;
    if (!lineupDialog) {
      lineupDialog = document.createElement("dialog");
      lineupDialog.className = "share-dialog gd-lineup-dialog";
      lineupDialog.setAttribute("aria-labelledby", "gamedayLineupTitle");
      lineupDialog.innerHTML = '<div class="share-dialog-head"><h3 id="gamedayLineupTitle">Matchup lineups</h3><button type="button" class="share-dialog-close" aria-label="Close lineup comparison">×</button></div><div class="gd-lineup-body"></div>';
      document.body.append(lineupDialog);
      lineupDialog.querySelector(".share-dialog-close").addEventListener("click", () => lineupDialog.close());
      lineupDialog.addEventListener("keydown", event => {
        if (event.key === "Escape") { event.preventDefault(); lineupDialog.close(); }
      });
    }
    lineupSelection = { key, side };
    lineupDialog.showModal();
    renderLineupComparison();
    lineupDialog.querySelector(`[data-lineup-heading="${side}"]`)?.focus();
  }

  document.addEventListener("ffo:usage-access", event => {
    if (!event.detail.allowed && lineupDialog?.open) lineupDialog.close();
  });

  function renderLeagueCard(league) {
    const providerLabel = { sleeper: "Sleeper", espn: "ESPN", yahoo: "Yahoo" }[league.provider] || league.provider;
    const head = `<header class="gd-card-head"><span class="gd-provider is-${esc(league.provider)}">${esc(providerLabel)}</span><strong title="${esc(league.name)}">${esc(league.name)}</strong>${canManage(league.key) ? `<button type="button" class="gd-manage" data-gameday-manage="${esc(league.key)}">Set lineup</button>` : ""}${league.imported ? '<small class="gd-imported">From file</small>' : `<a class="gd-open" href="${esc(league.url)}" target="_blank" rel="noopener noreferrer" data-gameday-open="${esc(league.url)}">Open</a>`}</header>`;
    if (league.error) return `<article class="gd-card is-error" data-gd-key="${esc(league.key)}">${head}<p class="gd-error">${esc(league.error)}</p></article>`;
    const { me, opp } = league;
    const pct = league.winPct;
    const sideBlock = (side, mine) => side ? `<div class="gd-side${mine ? " is-me" : ""}">${side.avatar ? `<span class="gd-photo gd-team-photo" style="width:34px;height:34px"><img src="${esc(side.avatar)}" alt="" width="34" height="34" loading="lazy" onerror="this.remove()"><b>${esc(side.name.slice(0, 1))}</b></span>` : `<span class="gd-photo gd-team-photo" style="width:34px;height:34px"><b>${esc(side.name.slice(0, 1))}</b></span>`}<div class="gd-side-name"><button type="button" class="gd-team-lineup" data-gameday-lineup="${esc(league.key)}" data-lineup-side="${mine ? "me" : "opp"}" aria-haspopup="dialog" aria-label="${esc(`View ${side.name} lineup and compare matchup`)}" title="View lineup and compare"><strong>${esc(side.name)}</strong></button><small>${side.playing} live · ${side.toPlay} to play</small></div><div class="gd-side-score"><b data-gd-score>${fmt(side.points)}</b><small>${side.projectionEstimated ? "est" : "proj"} ${fmt(side.projected)}</small></div></div>` : `<div class="gd-side is-empty"><small>No opponent this week</small></div>`;
    const winBar = pct === null ? "" : `<div class="gd-win" aria-label="Win chance ${Math.round(pct)}%"><div class="gd-win-bar"><span style="width:${pct.toFixed(1)}%"></span></div><small title="Fantasy Front Office's own live model (projections plus remaining game time). It can differ a few points from Sleeper's or ESPN's in-app odds."><b>${Math.round(pct)}%</b> to win <i class="gd-model">FFO model${me.projectionEstimated || opp?.projectionEstimated ? " · baseline estimate" : ""}</i></small></div>`;
    const state = pct === null ? "" : pct >= 60 ? " is-winning" : pct <= 40 ? " is-losing" : " is-close";
    return `<article class="gd-card${state}" data-gd-key="${esc(league.key)}">${head}${renderStanding(league.standing)}${renderTeamPicker(league)}
      <div class="gd-score">${sideBlock(me, true)}${sideBlock(opp, false)}</div>${winBar}
      ${me.projected === null || opp?.projected === null ? `<p class="gd-none">Scoring inputs incomplete${opp ? ": win probability requires projected totals for both teams" : ""}. Actual scores and players remaining are still shown.</p>` : ""}
      <ul class="gd-players">${me.players.map(renderPlayerRow).join("")}</ul>
      ${opp ? `<details class="gd-opp" data-gd-key="o${esc(league.key)}"><summary>${esc(opp.name)} lineup</summary><ul class="gd-players">${opp.players.map(renderPlayerRow).join("")}</ul></details>` : ""}
    </article>`;
  }

  function renderRooting(rooting) {
    const list = (title, entries, kind) => `<div class="gd-root-col is-${kind}"><h4>${title}</h4>${entries.length ? `<ul>${entries.slice(0, 8).map(entry => `<li data-gd-key="r${kind}${esc(entry.player.key)}">${photo(entry.player, 26)}<span><strong>${esc(entry.player.name)}</strong><small>${esc(kind === "conflicted" ? `For ${entry.cheer.length} · against ${entry.against.length}` : `${(kind === "cheer" ? entry.cheer : entry.against).length} league${(kind === "cheer" ? entry.cheer : entry.against).length === 1 ? "" : "s"} · ${entry.player.gameLabel || ""}`)}</small></span></li>`).join("")}</ul>` : '<p class="gd-none">Nobody yet</p>'}</div>`;
    if (!rooting.cheer.length && !rooting.against.length && !rooting.conflicted.length) return "";
    return `<section class="gd-rooting" aria-label="Rooting guide"><h3>Rooting guide</h3><div class="gd-root-grid">${list("Cheer for", rooting.cheer, "cheer")}${list("Root against", rooting.against, "against")}${list("Conflicted", rooting.conflicted, "conflicted")}</div></section>`;
  }

  function renderGamedayHtml(data) {
    const visible = data.leagues.filter(league => !league.hidden);
    if (!readStore().sources.length) {
      return `<div class="gd-empty"><strong>No saved leagues yet</strong><p>Connect a Sleeper account, ESPN league or Yahoo file in Connect leagues. Every league you connect shows up here together, saved on this device.</p><button type="button" class="btn-builder-action" data-open-connections>Connect leagues</button></div>`;
    }
    const alerts = buildAlerts(visible);
    const rooting = buildRooting(visible);
    const cards = visible.length ? visible.map(renderLeagueCard).join("") : `<div class="gd-empty"><strong>No in-season leagues to show</strong><p>Open Saved leagues below to show hidden leagues or add another.</p></div>`;
    return `${gd.error ? `<p class="gd-error" role="alert">${esc(gd.error)}</p>` : ""}${renderStrip(data.scoreboard)}${renderAlerts(alerts)}<div class="gd-cards">${cards}</div>${renderRooting(rooting)}`;
  }

  function syncAttributes(from, to) {
    for (const attr of [...from.attributes]) {
      if (from.tagName === "DETAILS" && attr.name === "open") continue;
      if (to.getAttribute(attr.name) !== attr.value) to.setAttribute(attr.name, attr.value);
    }
    for (const attr of [...to.attributes]) {
      if (to.tagName === "DETAILS" && attr.name === "open") continue;
      if (!from.hasAttribute(attr.name)) to.removeAttribute(attr.name);
    }
  }

  function morphChildren(target, source) {
    const next = [...source.childNodes];
    next.forEach((node, index) => {
      const current = target.childNodes[index];
      if (!current) { target.appendChild(node.cloneNode(true)); return; }
      const sameKind = current.nodeType === node.nodeType && current.nodeName === node.nodeName &&
        (node.nodeType !== 1 || (current.getAttribute("data-gd-key") || "") === (node.getAttribute("data-gd-key") || ""));
      if (!sameKind) { target.replaceChild(node.cloneNode(true), current); return; }
      if (node.nodeType === 3 || node.nodeType === 8) {
        if (current.nodeValue !== node.nodeValue) {
          current.nodeValue = node.nodeValue;
          const scoreHost = current.parentElement?.closest("[data-gd-score]");
          if (scoreHost) { scoreHost.classList.remove("gd-flash"); void scoreHost.offsetWidth; scoreHost.classList.add("gd-flash"); }
        }
        return;
      }
      if (node.nodeType !== 1) return;
      const flashing = current.classList.contains("gd-flash");
      syncAttributes(node, current);
      if (flashing && !current.classList.contains("gd-flash")) current.classList.add("gd-flash");
      if (current.tagName === "SELECT" && document.activeElement === current) return;
      morphChildren(current, node);
      if (current.tagName === "SELECT") { const selected = node.querySelector("option[selected]"); if (selected) current.value = selected.value; }
    });
    while (target.childNodes.length > next.length) target.removeChild(target.lastChild);
  }

  function morph(target, html) {
    const template = document.createElement("template");
    template.innerHTML = html;
    if (!target.childNodes.length) { target.appendChild(template.content); return; }
    morphChildren(target, template.content);
  }

  function readViewCache() {
    if (!persist) return null;
    try { return JSON.parse(localStorage.getItem(VIEW_CACHE_KEY) || "null"); } catch { return null; }
  }

  function writeViewCache() {
    if (!persist || !gd.data) return;
    const height = document.getElementById("gamedayRoot")?.offsetHeight || 0;
    try { localStorage.setItem(VIEW_CACHE_KEY, JSON.stringify({ data: gd.data, height })); } catch {}
  }

  function restoreViewCache() {
    const saved = readViewCache();
    const root = document.getElementById("gamedayRoot");
    if (!saved || !root) return;
    const fresh = saved.data && Date.now() - Number(saved.data.checkedAt) < 6 * 3600000 && readStore().sources.length;
    if (fresh) gd.data = saved.data;
    else if (saved.height && readStore().sources.length) root.style.minHeight = `${Math.min(4000, saved.height)}px`;
  }

  function renderSkeleton() {
    return `<div class="gd-strip gd-skeleton-strip">${'<div class="gd-strip-game is-skeleton"></div>'.repeat(6)}</div><div class="gd-cards">${'<article class="gd-card is-skeleton"></article>'.repeat(2)}</div>`;
  }

  function renderGameday() {
    const root = document.getElementById("gamedayRoot");
    const meta = document.getElementById("gamedayMeta");
    if (!root) return;
    if (!gd.data) {
      if (gd.error) {
        morph(root, `<p class="gd-error" role="alert">${esc(gd.error)} Use Refresh to retry.</p>`);
        if (meta) meta.textContent = "Gameday data unavailable";
      } else if (!root.childNodes.length || !gd.loading) {
        morph(root, readStore().sources.length ? renderSkeleton() : renderGamedayHtml({ leagues: [], scoreboard: { games: [] } }));
      }
      return;
    }
    morph(root, renderGamedayHtml(gd.data));
    renderLineupComparison();
    if (meta) {
      const live = gd.data.scoreboard.games.filter(game => game.state === "in").length;
      const text = `Week ${gd.data.week} · ${gd.data.leagues.filter(l => !l.hidden).length} league${gd.data.leagues.filter(l => !l.hidden).length === 1 ? "" : "s"} · ${live ? `${live} game${live === 1 ? "" : "s"} live · ` : ""}updated ${new Date(gd.data.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${gd.error ? ` · ${gd.error}` : ""}`;
      if (meta.textContent !== text) meta.textContent = text;
    }
  }

  function renderSavedManager() {
    const host = document.getElementById("connectedSourcesList");
    const gamedayHost = document.getElementById("gamedaySaved");
    const count = document.getElementById("gamedaySavedCount");
    if (!host) return;
    const store = readStore();
    if (count) count.textContent = String(store.sources.length);
    const leaguesBySource = new Map();
    (gd.data?.leagues || []).forEach(league => {
      if (!leaguesBySource.has(league.sourceKey)) leaguesBySource.set(league.sourceKey, []);
      leaguesBySource.get(league.sourceKey).push(league);
    });
    const label = source => source.type === "sleeper" ? `Sleeper · ${source.username || source.userId}` : `${source.type === "espn" ? "ESPN" : "Yahoo"} · ${source.name || source.leagueId}`;
    host.innerHTML = `${store.sources.length ? store.sources.map(source => {
      const key = sourceKey(source);
      const leagues = leaguesBySource.get(key) || [];
      return `<li><div class="gd-saved-row"><strong>${esc(label(source))}</strong><button type="button" class="gd-link-btn" data-connection-sync="${esc(key)}">${source.type === "yahoo" ? "Open saved import" : "Sync connection"}</button><button type="button" class="gd-link-btn" data-gameday-remove="${esc(key)}">Remove connection</button></div>
        <small>Last connected: ${source.savedAt ? esc(new Date(source.savedAt).toLocaleString()) : "unknown"} · ${source.type === "yahoo" ? "File snapshot; re-import to update" : "Read-only connection"}</small>
        ${leagues.length ? `<div class="gd-saved-leagues">${leagues.map(league => `<div class="connection-source-league"><label><input type="checkbox" data-gameday-show="${esc(league.key)}"${league.hidden ? "" : " checked"}> ${esc(league.name)}</label>
          <span>${esc(league.error || (league.provider === "yahoo" ? "Imported snapshot" : "Loaded league"))}</span>
          ${canManage(league.key) && !league.error ? `<button type="button" data-gameday-manage="${esc(league.key)}" data-gameday-tab="tab-inbox">Open league</button>` : ""}</div>`).join("")}</div>` : '<small>Refresh league details to load leagues and visibility controls.</small>'}</li>`;
    }).join("") : ""}`;
    if (gamedayHost) gamedayHost.innerHTML = '<button type="button" class="btn-builder-action" data-open-connections>Manage connections and league visibility</button><p class="gd-saved-note">Saved only in this browser. Add, remove and manage accounts in Connect leagues.</p>';
    window.FFOUsage?.mountConnectionChoices();
  }

  async function refresh({ force = false } = {}) {
    if (!await requestConnectedBetaAccess()) return;
    if (gd.loading) {
      gd.pending = gd.pending || gd.loading.then(() => { gd.pending = null; return refresh({ force }); });
      return gd.pending;
    }
    const button = document.getElementById("gamedayRefreshBtn");
    if (button) { button.disabled = true; button.textContent = "Updating"; }
    if (force) cache.clear();
    gd.loading = (async () => {
      try {
        gd.data = await loadGameday();
        gd.loadedAt = Date.now();
        gd.error = "";
        gd.restored = false;
      } catch (error) {
        gd.error = `${gd.data ? "Scores may be stale; refresh failed" : "Could not load Gameday"}: ${error.message || "Provider unavailable"}`;
      } finally {
        gd.loading = null;
        if (button) { button.disabled = false; button.textContent = "Refresh"; }
        renderGameday();
        renderSavedManager();
        const root = document.getElementById("gamedayRoot");
        if (root && gd.data) { root.style.minHeight = ""; writeViewCache(); }
        document.dispatchEvent(new CustomEvent("ffo:gameday-data"));
        if (gd.data && !gd.error) notifyLineupAlerts();
      }
    })();
    return gd.loading;
  }

  function isActive() {
    return document.getElementById("tab-intel")?.classList.contains("active") && !document.hidden;
  }

  function tick() {
    if (isActive() && !gd.loading && Date.now() - gd.loadedAt >= REFRESH_MS) return refresh();
  }

  function activate() {
    if (!window.FFOUsage?.isAllowed()) { showConnectedBetaGate(); return; }
    if (!gd.data && !gd.loadedAt && !gd.restored) { gd.restored = true; restoreViewCache(); }
    renderSavedManager();
    renderAlertsButton();
    renderGameday();
    if (!gd.data || Date.now() - gd.loadedAt > REFRESH_MS) refresh();
    if (!gd.timer) gd.timer = setInterval(tick, REFRESH_MS / 4);
  }

  async function manageLeague(key, tab, trigger) {
    const league = gd.data?.leagues.find(item => item.key === key);
    if (!league || typeof window.openTrackedLeague !== "function") return;
    const source = readStore().sources.find(item => sourceKey(item) === league.sourceKey) || {};
    if (trigger) trigger.disabled = true;
    try {
      await window.openTrackedLeague({ provider: league.provider, leagueId: league.leagueId || key.split(":")[1], season: gd.data.season, username: source.username || "", teamId: league.provider === "espn" ? league.me?.teamId : "", tab });
    } finally {
      if (trigger) trigger.disabled = false;
    }
  }

  function ensureData() {
    if (!window.FFOUsage?.isAllowed()) { showConnectedBetaGate(); return Promise.resolve(null); }
    if (gd.data || gd.loading) return gd.loading || Promise.resolve(gd.data);
    return refresh();
  }

  function openLeague(url) {
    if (typeof openProviderInCurrentTab === "function") openProviderInCurrentTab(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  }

  document.addEventListener("click", event => {
    const lineup = event.target.closest("[data-gameday-lineup]");
    if (lineup) { openLineupComparison(lineup.dataset.gamedayLineup, lineup.dataset.lineupSide); return; }
    const open = event.target.closest("[data-gameday-open]");
    if (open && typeof isExtensionPanel !== "undefined" && isExtensionPanel) { event.preventDefault(); openLeague(open.dataset.gamedayOpen); return; }
    const manage = event.target.closest("[data-gameday-manage]");
    if (manage) { manageLeague(manage.dataset.gamedayManage, manage.dataset.gamedayTab || "tab-opt", manage); return; }
    const remove = event.target.closest("[data-gameday-remove]");
    if (remove) {
      if (!confirm("Remove this saved connection from this browser? Your provider roster, active workspace and local plans are not deleted. You can reconnect later.")) return;
      if (!removeSource(remove.dataset.gamedayRemove)) { setStatus("The connection could not be removed from browser storage. Nothing was deleted."); return; }
      renderSavedManager();
      setStatus("Connection removed from this browser. Your provider roster and local plans were not deleted.");
      if (window.FFOUsage?.isAllowed()) refresh();
      return;
    }
    if (event.target.closest("#gamedayRefreshBtn")) refresh({ force: true });
    if (event.target.closest("#gamedayAlertsBtn")) toggleAlerts();
  });

  document.addEventListener("change", event => {
    const show = event.target.closest("[data-gameday-show]");
    if (show) {
      if (!window.FFOUsage?.isAllowed()) { show.checked = !show.checked; showConnectedBetaGate(); return; }
      if (!setLeagueHidden(show.dataset.gamedayShow, !show.checked)) { show.checked = !show.checked; setStatus("League visibility could not be saved. Check browser storage and retry."); return; }
      refresh(); return;
    }
    const team = event.target.closest("[data-gameday-team]");
    if (team && typeof state !== "undefined") {
      state.portfolioRosterSelections[team.dataset.gamedayTeam] = team.value;
      try { if (persist) localStorage.setItem("fantasy-front-office:portfolio-rosters", JSON.stringify(state.portfolioRosterSelections)); } catch {}
      refresh();
    }
  });

  const ALERTS_KEY = "fantasy-front-office:gameday-alerts:v1";
  const ALERT_POLL_MS = 5 * 60 * 1000;
  const alertsSupported = () => typeof window.Notification === "function";

  function readAlertState() {
    try { return { on: false, seen: [], ...JSON.parse(localStorage.getItem(ALERTS_KEY) || "{}") }; } catch { return { on: false, seen: [] }; }
  }

  function writeAlertState(next) {
    if (!persist) return;
    try { localStorage.setItem(ALERTS_KEY, JSON.stringify(next)); } catch {}
  }

  function alertsEnabled() {
    return alertsSupported() && Notification.permission === "granted" && readAlertState().on;
  }

  function lineupAlertId(data, alert) {
    return `${data.season}:${data.week}:${alert.leagueKey}:${alert.player.key || alert.player.slot}:${alert.text}`;
  }

  async function showLineupNotification(title, body, tag) {
    const options = { body, tag, icon: "/icons/app-192.png", badge: "/icons/app-192.png", data: { url: "/" } };
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) { await registration.showNotification(title, options); return; }
    } catch {}
    try {
      const note = new Notification(title, options);
      note.onclick = () => { window.focus(); document.querySelector('.nav-btn[data-tab="tab-intel"]')?.click(); note.close(); };
    } catch {}
  }

  // Notify once per new pre-kickoff lineup problem (Out/Doubtful/IR, bye, empty slot).
  function notifyLineupAlerts({ baseline = false } = {}) {
    if (!gd.data || !alertsEnabled()) return [];
    const alertState = readAlertState();
    const prefix = `${gd.data.season}:${gd.data.week}:`;
    const seen = new Set(alertState.seen.filter(id => id.startsWith(prefix)));
    const fresh = buildAlerts(gd.data.leagues.filter(league => !league.hidden))
      .filter(alert => alert.level === "danger")
      .map(alert => ({ alert, id: lineupAlertId(gd.data, alert) }))
      .filter(entry => !seen.has(entry.id));
    if (!fresh.length) return [];
    fresh.forEach(entry => seen.add(entry.id));
    writeAlertState({ ...alertState, seen: [...seen].slice(-200) });
    if (baseline || fresh.length > 3) {
      const leagues = new Set(fresh.map(entry => entry.alert.league)).size;
      showLineupNotification(`${fresh.length} lineup problem${fresh.length === 1 ? "" : "s"} to fix`, `${fresh.slice(0, 3).map(entry => entry.alert.player.empty ? entry.alert.text : `${entry.alert.player.name} (${entry.alert.text})`).join(", ")}${fresh.length > 3 ? "…" : ""} · ${leagues} league${leagues === 1 ? "" : "s"}`, `ffo-lineup-${gd.data.week}`);
    } else {
      fresh.forEach(({ alert, id }) => showLineupNotification(alert.player.empty ? `${alert.text} in ${alert.league}` : `${alert.player.name}: ${alert.text}`, `${alert.player.empty ? "Fill it" : "Starting"} in ${alert.league} — swap before kickoff.`, id));
    }
    return fresh;
  }

  function renderAlertsButton() {
    const button = document.getElementById("gamedayAlertsBtn");
    if (!button) return;
    button.hidden = !alertsSupported();
    const on = alertsEnabled();
    button.setAttribute("aria-pressed", String(on));
    button.classList.toggle("is-on", on);
    button.textContent = on ? "Alerts on" : "Alerts off";
    button.title = on
      ? "You'll get a notification when a starter is ruled Out/Doubtful, on bye, or a slot is empty — while Fantasy Front Office is open (tab or installed app)."
      : "Get notified about lineup problems across all your leagues while Fantasy Front Office is open.";
  }

  async function toggleAlerts() {
    if (!alertsSupported()) return;
    if (alertsEnabled()) {
      writeAlertState({ ...readAlertState(), on: false });
      renderAlertsButton();
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      const meta = document.getElementById("gamedayMeta");
      if (meta) meta.textContent = "Notifications are blocked for this site. Allow them in your browser settings to turn alerts on.";
      renderAlertsButton();
      return;
    }
    writeAlertState({ ...readAlertState(), on: true });
    renderAlertsButton();
    await ensureData();
    if (!notifyLineupAlerts({ baseline: true }).length) showLineupNotification("Gameday alerts are on", "No lineup problems right now. We'll tell you if a starter is ruled out while the app is open.", "ffo-alerts-on");
  }

  setInterval(() => {
    if (!alertsEnabled() || gd.loading || !readStore().sources.length) return;
    if (Date.now() - gd.loadedAt >= ALERT_POLL_MS) refresh();
  }, 60000);

  navigator.serviceWorker?.addEventListener("message", event => {
    if (event.data?.type === "ffo:open-tab") document.querySelector(`.nav-btn[data-tab="${event.data.tab}"]`)?.click();
  });

  document.addEventListener("visibilitychange", () => { if (isActive() && Date.now() - gd.loadedAt > REFRESH_MS) refresh(); });

  window.FFOGameday = Object.freeze({
    STORE_KEY, readStore, rememberSource, removeSource, setLeagueHidden, sourceKey, renderSavedManager,
    normalizeScoreboard, remainingFraction, finishPlayer, sideTotals, winProbability, finalizeLeague,
    buildAlerts, buildRooting, renderAlerts, renderGamedayHtml, morph, activate, refresh, renderGameday, scoreSleeperProjection, lineupProgress,
    loadYahooSource, notifyLineupAlerts, computeStanding, standingGapLabel, ordinal, ensureData, manageLeague, get data() { return gd.data; }, set data(value) { gd.data = value; gd.loadedAt = Date.now(); },
    get freshness() { return { checkedAt: gd.loadedAt, error: gd.error, restored: gd.restored, loading: Boolean(gd.loading) }; }
  });
})();
