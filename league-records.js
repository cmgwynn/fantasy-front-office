(() => {
  function validateGames(games) {
    if (!Array.isArray(games)) throw new Error("Completed matchups must be an array.");
    const keys = new Set();
    const teamWeeks = new Set();
    return games.map(game => {
      if (!game || game.completed !== true || !Number.isInteger(game.week) || game.week < 1 || game.week > 18 ||
          !["homeId", "awayId"].every(key => ["string", "number"].includes(typeof game[key]) && String(game[key]).trim()) ||
          String(game.homeId) === String(game.awayId) ||
          ![game.homeScore, game.awayScore].every(score => typeof score === "number" && Number.isFinite(score))) {
        throw new Error("Each completed matchup needs completed: true, week 1-18, two different team IDs, and finite numeric scores.");
      }
      const homeId = String(game.homeId), awayId = String(game.awayId);
      const key = JSON.stringify([game.week, ...[homeId, awayId].sort()]);
      if (keys.has(key) || [homeId, awayId].some(id => teamWeeks.has(JSON.stringify([game.week, id])))) {
        throw new Error(`Duplicate matchup or multiple opponents for a team in Week ${game.week}. Median and multi-opponent formats are not supported.`);
      }
      keys.add(key);
      [homeId, awayId].forEach(id => teamWeeks.add(JSON.stringify([game.week, id])));
      return { ...game, homeId, awayId };
    }).sort((a, b) => a.week - b.week || a.homeId.localeCompare(b.homeId));
  }

  function normalizeSleeperWeek(rows, week) {
    if (!Array.isArray(rows) || !rows.length) throw new Error(`Week ${week}: no matchup data returned.`);
    const groups = new Map();
    rows.forEach(row => {
      if (row.matchup_id === null || row.matchup_id === undefined) return;
      const id = String(row.matchup_id);
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(row);
    });
    const games = [];
    for (const teams of groups.values()) {
      if (teams.length !== 2) throw new Error(`Week ${week}: expected two teams per matchup.`);
      games.push({ week, completed: true, homeId: teams[0].roster_id, awayId: teams[1].roster_id,
        homeScore: teams[0].points, awayScore: teams[1].points });
    }
    if (!games.length) throw new Error(`Week ${week}: no head-to-head games returned.`);
    return validateGames(games);
  }

  function normalizeEspnSchedule(data) {
    if (!Array.isArray(data?.schedule) || !data.schedule.length) throw new Error("ESPN returned no season matchup schedule.");
    const periods = data.settings?.scheduleSettings?.matchupPeriods;
    const currentPeriod = data.status?.currentScoringPeriod;
    if (!periods || typeof periods !== "object" || !Number.isInteger(currentPeriod) || currentPeriod < 1) {
      throw new Error("ESPN scoring-period settings/status are missing; completed games cannot be verified.");
    }
    const games = [], errors = [];
    let excluded = 0;
    for (const matchup of data.schedule) {
      const label = `Matchup ${matchup.id ?? "unknown"}`;
      if (typeof matchup.playoffTierType !== "string") {
        errors.push(`${label}: regular-season/playoff classification missing.`);
        continue;
      }
      if (matchup.playoffTierType !== "NONE") { excluded++; continue; }
      const weeks = periods[matchup.matchupPeriodId];
      if (!Array.isArray(weeks) || !weeks.length || !weeks.every(week => Number.isInteger(week) && week >= 1 && week <= 18)) {
        errors.push(`${label}: scoring-week mapping unavailable.`);
        continue;
      }
      if (Math.max(...weeks) >= currentPeriod) { excluded++; continue; }
      if (weeks.length !== 1) {
        errors.push(`${label}: multiweek matchup totals cannot establish weekly records.`);
        continue;
      }
      const home = matchup.home, away = matchup.away;
      if (home && !away || away && !home) { excluded++; continue; }
      if (!home || !away || !["HOME", "AWAY", "TIE"].includes(matchup.winner)) {
        errors.push(`${label}: no explicit final result.`);
        continue;
      }
      const homeScore = home.totalPoints, awayScore = away.totalPoints;
      if (![homeScore, awayScore].every(score => typeof score === "number" && Number.isFinite(score))) {
        errors.push(`${label}: final scores missing or nonnumeric.`);
        continue;
      }
      const expectedWinner = homeScore > awayScore ? "HOME" : awayScore > homeScore ? "AWAY" : "TIE";
      if (matchup.winner !== expectedWinner) {
        errors.push(`${label}: winner differs from score comparison; tiebreaker/override rules are unsupported.`);
        continue;
      }
      try {
        const [game] = validateGames([{ week: weeks[0], completed: true, homeId: home.teamId, awayId: away.teamId, homeScore, awayScore }]);
        games.push(game);
      } catch (error) {
        errors.push(`${label}: ${error.message}`);
      }
    }
    return { games: validateGames(games), errors, excluded, supplied: data.schedule.length };
  }

  function summarize(games) {
    const valid = validateGames(games);
    const pairs = new Map();
    let highest = null, closest = null, blowout = null;
    for (const game of valid) {
      for (const [teamId, points] of [[game.homeId, game.homeScore], [game.awayId, game.awayScore]]) {
        if (!highest || points > highest.points) highest = { game, teamId, points };
      }
      const margin = Math.abs(game.homeScore - game.awayScore);
      if (margin > 0 && (!closest || margin < closest.margin)) closest = { game, margin };
      if (!blowout || margin > blowout.margin) blowout = { game, margin };
      const [a, b] = [game.homeId, game.awayId].sort();
      const key = JSON.stringify([a, b]);
      if (!pairs.has(key)) pairs.set(key, { a, b, winsA: 0, winsB: 0, ties: 0, pointsA: 0, pointsB: 0, games: 0 });
      const pair = pairs.get(key);
      const pointsA = game.homeId === a ? game.homeScore : game.awayScore;
      const pointsB = game.homeId === b ? game.homeScore : game.awayScore;
      pair.games++;
      pair.pointsA += pointsA;
      pair.pointsB += pointsB;
      if (pointsA > pointsB) pair.winsA++;
      else if (pointsB > pointsA) pair.winsB++;
      else pair.ties++;
    }
    return { games: valid, highest, closest, blowout, ties: valid.filter(game => game.homeScore === game.awayScore).length,
      pairs: [...pairs.values()].sort((a, b) => b.games - a.games || Math.abs(a.pointsA - a.pointsB) - Math.abs(b.pointsA - b.pointsB)) };
  }

  function buildRivalryMatrix(pairs, rosterIds) {
    const ids = [...new Set([...rosterIds.map(String), ...pairs.flatMap(pair => [pair.a, pair.b])])];
    const lookup = new Map(pairs.map(pair => [JSON.stringify([pair.a, pair.b].sort()), pair]));
    return ids.map(teamId => ({
      teamId,
      cells: ids.map(opponentId => {
        if (teamId === opponentId) return { opponentId, kind: "self" };
        const pair = lookup.get(JSON.stringify([teamId, opponentId].sort()));
        if (!pair) return { opponentId, kind: "unplayed" };
        const wins = teamId === pair.a ? pair.winsA : pair.winsB;
        const losses = teamId === pair.a ? pair.winsB : pair.winsA;
        const rate = (wins + pair.ties * 0.5) / pair.games;
        return { opponentId, wins, losses, ties: pair.ties, games: pair.games, rate,
          kind: rate >= 0.75 ? "strong-win" : rate > 0.5 ? "win" : rate === 0.5 ? "even" : rate > 0.25 ? "loss" : "strong-loss" };
      })
    }));
  }

  window.FFORecords = Object.freeze({ validateGames, normalizeSleeperWeek, normalizeEspnSchedule, summarize, buildRivalryMatrix });
})();
