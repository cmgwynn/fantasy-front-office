(() => {
  const positions = ["QB", "RB", "WR", "TE"];
  const teamCode = value => ({ JAC: "JAX", LA: "LAR", WSH: "WAS" }[value] || value);

  function aggregate(rows, { season, weeks, position, receptionPoints = 1, teams }) {
    if (!positions.includes(position) || ![0, 0.5, 1].includes(receptionPoints)) throw new Error("Unsupported matchup position or reception scoring.");
    const validTeams = new Set(teams);
    const allowedWeeks = new Set(weeks);
    const games = new Map(), seen = new Set(), incomplete = new Set();
    let excluded = 0;
    for (const row of rows) {
      if (row.player?.position !== position) continue;
      const week = Number(row.week), opponent = teamCode(row.opponent), team = teamCode(row.team);
      if (String(row.season) !== String(season) || row.season_type !== "regular" || !allowedWeeks.has(week) ||
          !validTeams.has(team) || !validTeams.has(opponent) || team === opponent || !row.player_id || !row.game_id) {
        if (String(row.season) === String(season) && row.season_type === "regular" && allowedWeeks.has(week) && validTeams.has(opponent)) incomplete.add(`${week}:${opponent}`);
        excluded++;
        continue;
      }
      const key = `${week}:${row.player_id}`;
      if (seen.has(key)) { excluded++; continue; }
      seen.add(key);
      const stats = row.stats || {};
      if (!(stats.gp > 0)) continue;
      const gameKey = `${week}:${opponent}`;
      const field = receptionPoints === 1 ? "pts_ppr" : receptionPoints === 0.5 ? "pts_half_ppr" : "pts_std";
      const noScoringCounters = ["pass_yd", "pass_td", "pass_int", "rush_yd", "rush_td", "rec", "rec_yd", "rec_td",
        "fum_lost", "pass_2pt", "rush_2pt", "rec_2pt", "st_td"].every(key => stats[key] === undefined || stats[key] === 0);
      // Sleeper omits totals for played, unranked, zero-scoring participants.
      const sparseZero = stats.off_snp > 0 && ["pts_ppr", "pts_half_ppr", "pts_std"].every(key => stats[key] === undefined) &&
        ["pos_rank_ppr", "pos_rank_half_ppr", "pos_rank_std"].every(key => stats[key] === 999) && noScoringCounters;
      if (!stats.off_snp && !["pts_ppr", "pts_half_ppr", "pts_std"].some(key => typeof stats[key] === "number")) continue;
      const points = sparseZero ? 0 : stats[field];
      if (typeof points !== "number" || !Number.isFinite(points)) { excluded++; incomplete.add(gameKey); continue; }
      const game = games.get(gameKey);
      if (game && (game.team !== team || game.id !== String(row.game_id))) throw new Error("Conflicting opponent/game metadata in weekly stats.");
      const entry = game || { team, id: String(row.game_id), points: 0, opponent };
      entry.points += points;
      games.set(gameKey, entry);
    }
    const byTeam = new Map();
    for (const [key, game] of games) {
      if (incomplete.has(key)) continue;
      const entry = byTeam.get(game.opponent) || { team: game.opponent, total: 0, games: 0 };
      entry.total += game.points;
      entry.games++;
      byTeam.set(game.opponent, entry);
    }
    const qualified = [...byTeam.values()].filter(entry => entry.games >= 3)
      .map(entry => ({ ...entry, average: entry.total / entry.games })).sort((a, b) => a.average - b.average || a.team.localeCompare(b.team));
    const mean = qualified.length ? qualified.reduce((sum, entry) => sum + entry.average, 0) / qualified.length : null;
    const ratings = {};
    for (const entry of qualified) {
      const below = qualified.filter(other => other.average < entry.average).length;
      const tied = qualified.filter(other => other.average === entry.average).length;
      const rating = qualified.length >= 24 ? Math.round(100 * (below + (tied - 1) / 2) / (qualified.length - 1)) : null;
      ratings[entry.team] = { ...entry, rating, confidence: entry.games >= 6 ? "Moderate" : "Low",
        adjustment: rating === null || !(mean > 0) ? null : Math.max(-0.1, Math.min(0.1, (entry.average / mean - 1) * 0.25)) };
    }
    return { ratings, qualifiedTeams: qualified.length, excluded, mean };
  }

  function compare(a, b) {
    if (!Number.isFinite(a.projection) || !Number.isFinite(b.projection)) return { reason: "Weekly projections are missing or invalid." };
    if (a.unavailable && b.unavailable) return { reason: "Neither player is an available starter this week." };
    if (a.unavailable || b.unavailable) return { preferred: a.unavailable ? "b" : "a", basis: "Availability", adjusted: null, close: false };
    const complete = a.adjustment !== null && b.adjustment !== null && Number.isFinite(a.adjustment) && Number.isFinite(b.adjustment);
    const bounded = value => Math.max(-0.1, Math.min(0.1, value));
    const adjusted = complete ? { a: a.projection * (1 + bounded(a.adjustment)), b: b.projection * (1 + bounded(b.adjustment)) } : null;
    const scoreA = adjusted?.a ?? a.projection, scoreB = adjusted?.b ?? b.projection;
    const close = Math.abs(scoreA - scoreB) <= Math.max(1, Math.max(Math.abs(scoreA), Math.abs(scoreB)) * 0.05);
    return { preferred: scoreA === scoreB ? null : scoreA > scoreB ? "a" : "b", basis: complete ? "Projection + matchup sensitivity" : "Projection only; matchup coverage incomplete", adjusted, close };
  }

  window.FFOWeeklyMatchups = Object.freeze({ aggregate, compare });
})();
