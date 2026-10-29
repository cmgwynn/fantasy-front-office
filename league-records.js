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

  function summarizeHistory(seasons) {
    if (!Array.isArray(seasons)) throw new Error("Historical seasons must be an array.");
    const seenSeasons = new Set(), careers = new Map(), pairs = new Map();
    let highest = null, closest = null, blowout = null;
    let gamesCount = 0, excludedGames = 0;
    const notices = [];
    for (const season of [...seasons].sort((a, b) => String(a.season).localeCompare(String(b.season)))) {
      if (!season || !/^\d{4}$/.test(String(season.season)) || !Array.isArray(season.teams) || !Array.isArray(season.errors)) {
        throw new Error("Historical seasons need a four-digit year, teams, games and error list.");
      }
      if (seenSeasons.has(String(season.season))) throw new Error("Duplicate historical season.");
      seenSeasons.add(String(season.season));
      const teams = new Map();
      const owners = new Set(), ambiguous = new Set();
      season.teams.forEach(team => {
        if (!team || !["string", "number"].includes(typeof team.rosterId) || typeof team.name !== "string" ||
            !(team.ownerId === null || typeof team.ownerId === "string")) throw new Error("Invalid historical roster identity.");
        const rosterId = String(team.rosterId);
        if (teams.has(rosterId)) throw new Error("Duplicate historical roster ID.");
        teams.set(rosterId, team);
        if (team.ownerId) {
          if (owners.has(team.ownerId)) ambiguous.add(team.ownerId);
          owners.add(team.ownerId);
        }
      });
      for (const team of season.teams) {
        if (!team.ownerId || ambiguous.has(team.ownerId)) {
          notices.push(`${season.season}: ${team.name} has no unique primary owner; its career games are excluded.`);
          continue;
        }
        if (!careers.has(team.ownerId)) careers.set(team.ownerId, {
          id: team.ownerId, name: team.name, seasons: [], wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, games: 0
        });
        const career = careers.get(team.ownerId);
        career.name = team.name;
        career.seasons.push(String(season.season));
      }
      for (const game of validateGames(season.games)) {
        const home = teams.get(game.homeId), away = teams.get(game.awayId);
        if (!home || !away) throw new Error("Historical game references an unknown roster.");
        if (!home.ownerId || !away.ownerId || ambiguous.has(home.ownerId) || ambiguous.has(away.ownerId)) { excludedGames++; continue; }
        const homeCareer = careers.get(home.ownerId), awayCareer = careers.get(away.ownerId);
        gamesCount++;
        const winner = game.homeScore > game.awayScore ? homeCareer.id : game.awayScore > game.homeScore ? awayCareer.id : null;
        for (const [career, points, against] of [[homeCareer, game.homeScore, game.awayScore], [awayCareer, game.awayScore, game.homeScore]]) {
          career.games++; career.pointsFor += points; career.pointsAgainst += against;
          if (winner === null) career.ties++;
          else if (winner === career.id) career.wins++;
          else career.losses++;
          if (!highest || points > highest.points) highest = { points, managerId: career.id, season: String(season.season), game };
        }
        const margin = Math.abs(game.homeScore - game.awayScore);
        const fact = { margin, season: String(season.season), game, homeId: homeCareer.id, awayId: awayCareer.id };
        if (margin > 0 && (!closest || margin < closest.margin)) closest = fact;
        if (!blowout || margin > blowout.margin) blowout = fact;
        const [a, b] = [homeCareer.id, awayCareer.id].sort();
        const key = JSON.stringify([a, b]);
        if (!pairs.has(key)) pairs.set(key, { a, b, winsA: 0, winsB: 0, ties: 0, pointsA: 0, pointsB: 0, games: 0 });
        const pair = pairs.get(key);
        pair.games++;
        pair.pointsA += homeCareer.id === a ? game.homeScore : game.awayScore;
        pair.pointsB += homeCareer.id === b ? game.homeScore : game.awayScore;
        if (winner === null) pair.ties++;
        else if (winner === a) pair.winsA++;
        else pair.winsB++;
      }
      notices.push(...season.errors.map(error => `${season.season}: ${error}`));
    }
    return { careers: [...careers.values()].sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor || a.id.localeCompare(b.id)),
      pairs: [...pairs.values()].sort((a, b) => b.games - a.games || a.a.localeCompare(b.a)),
      highest, closest, blowout, gamesCount, excludedGames, notices, seasons: [...seenSeasons] };
  }

  function scoringInsights(games) {
    const valid = validateGames(games);
    const weeks = new Map(), teams = new Map();
    for (const game of valid) {
      if (!weeks.has(game.week)) weeks.set(game.week, []);
      for (const [id, points, opponentPoints] of [[game.homeId, game.homeScore, game.awayScore], [game.awayId, game.awayScore, game.homeScore]]) {
        weeks.get(game.week).push({ id, points, opponentPoints });
        if (!teams.has(id)) teams.set(id, { id, weeks: 0, wins: 0, losses: 0, ties: 0, expectedWins: 0,
          allPlayWins: 0, allPlayLosses: 0, allPlayTies: 0, pointsFor: 0 });
      }
    }
    const awards = [];
    for (const [week, scores] of weeks) {
      const high = Math.max(...scores.map(score => score.points));
      const sorted = scores.map(score => score.points).sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      const median = (sorted[middle - 1] + sorted[middle]) / 2;
      const unlucky = scores.filter(score => score.points < score.opponentPoints).sort((a, b) => b.points - a.points);
      const lucky = scores.filter(score => score.points > score.opponentPoints).sort((a, b) => a.points - b.points);
      awards.push({ week, highest: scores.filter(score => score.points === high).map(score => score.id), high, median,
        highScoringLosses: unlucky.length ? unlucky.filter(score => score.points === unlucky[0].points) : [],
        lowScoringWins: lucky.length ? lucky.filter(score => score.points === lucky[0].points) : [], teams: scores.length });
      for (const score of scores) {
        const team = teams.get(score.id);
        const others = scores.filter(other => other.id !== score.id);
        const wins = others.filter(other => score.points > other.points).length;
        const ties = others.filter(other => score.points === other.points).length;
        team.weeks++;
        team.wins += score.points > score.opponentPoints ? 1 : 0;
        team.losses += score.points < score.opponentPoints ? 1 : 0;
        team.ties += score.points === score.opponentPoints ? 1 : 0;
        team.expectedWins += (wins + ties * 0.5) / others.length;
        team.allPlayWins += wins;
        team.allPlayTies += ties;
        team.allPlayLosses += others.length - wins - ties;
        team.pointsFor += score.points;
      }
    }
    return { teams: [...teams.values()].map(team => ({
      ...team, luck: team.wins + team.ties * 0.5 - team.expectedWins
    })).sort((a, b) => b.expectedWins - a.expectedWins || b.pointsFor - a.pointsFor || a.id.localeCompare(b.id)), awards };
  }

  window.FFORecords = Object.freeze({ validateGames, normalizeSleeperWeek, normalizeEspnSchedule, summarize, buildRivalryMatrix, summarizeHistory, scoringInsights });
})();
