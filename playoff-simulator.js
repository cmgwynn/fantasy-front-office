(() => {
  function validate(input, formatOnly = false) {
    const { teams, schedule, completedWeeks, regularWeeks, playoffTeams, reseed } = input;
    if (!Array.isArray(teams) || teams.length < 4 || teams.length > 32 || teams.length % 2 ||
        ![4, 6, 8].includes(playoffTeams) || playoffTeams > teams.length ||
        !Number.isInteger(regularWeeks) || regularWeeks < 3 || regularWeeks > 16 ||
        regularWeeks + (playoffTeams === 4 ? 2 : 3) > 18 ||
        !Number.isInteger(completedWeeks) || completedWeeks < 2 || completedWeeks >= regularWeeks ||
        typeof reseed !== "boolean") {
      throw new Error("Requires 4-32 even teams, 4/6/8 playoff spots, two completed weeks, remaining regular games, and single-week playoffs ending by Week 18.");
    }
    const ids = teams.map(team => team.id);
    if (ids.some(id => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length ||
        teams.some(team => typeof team.name !== "string" || !team.name.trim())) {
      throw new Error("Team IDs and names must be nonempty; IDs must be unique.");
    }
    if (formatOnly) return input;
    if (!Array.isArray(schedule) || schedule.length !== regularWeeks * teams.length / 2) {
      throw new Error("A complete regular-season schedule is required; byes, missing weeks and extra games are unsupported.");
    }
    const seen = new Set();
    for (const game of schedule) {
      if (!Number.isInteger(game.week) || game.week < 1 || game.week > regularWeeks ||
          !ids.includes(game.homeId) || !ids.includes(game.awayId) || game.homeId === game.awayId) {
        throw new Error("Schedule contains an invalid week or unknown/duplicate opponent.");
      }
      for (const id of [game.homeId, game.awayId]) {
        const key = JSON.stringify([game.week, id]);
        if (seen.has(key)) throw new Error(`Week ${game.week}: a team has multiple games.`);
        seen.add(key);
      }
      if (game.week <= completedWeeks &&
          ![game.homeScore, game.awayScore].every(score => typeof score === "number" && Number.isFinite(score))) {
        throw new Error(`Week ${game.week}: completed scores must be finite numbers.`);
      }
    }
    return input;
  }

  function simulate(input, iterations = 5000, seed = 20261029) {
    validate(input);
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > 20000 ||
        !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error("Invalid simulation count or random seed.");
    let randomState = seed >>> 0;
    const random = () => {
      randomState ^= randomState << 13;
      randomState ^= randomState >>> 17;
      randomState ^= randomState << 5;
      return ((randomState >>> 0) + 0.5) / 4294967296;
    };
    const history = new Map(input.teams.map(team => [team.id, { ...team, wins: 0, losses: 0, ties: 0, pf: 0, scores: [] }]));
    function addGame(teams, game, a, b) {
      const home = teams.get(game.homeId), away = teams.get(game.awayId);
      home.pf += a; away.pf += b;
      if (a > b) { home.wins++; away.losses++; }
      else if (a < b) { away.wins++; home.losses++; }
      else { home.ties++; away.ties++; }
    }
    const schedule = [...input.schedule].sort((a, b) => a.week - b.week || a.homeId.localeCompare(b.homeId));
    for (const game of schedule.filter(game => game.week <= input.completedWeeks)) {
      addGame(history, game, game.homeScore, game.awayScore);
      history.get(game.homeId).scores.push(game.homeScore);
      history.get(game.awayId).scores.push(game.awayScore);
    }
    const models = new Map([...history].map(([id, team]) => {
      const mean = team.pf / team.scores.length;
      const variance = team.scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / (team.scores.length - 1);
      if (!Number.isFinite(mean) || !Number.isFinite(variance)) throw new Error("Completed scores exceed the supported numeric range.");
      return [id, { mean, deviation: Math.max(10, Math.sqrt(variance)) }];
    }));
    const draw = id => {
      const model = models.get(id);
      return Math.round((model.mean + model.deviation * Math.sqrt(-2 * Math.log(random())) *
        Math.cos(2 * Math.PI * random())) * 100) / 100;
    };
    const totals = new Map(input.teams.map(team => [team.id, { ...team, seeds: Array(input.teams.length).fill(0),
      qualified: 0, bye: 0, finalists: 0, champion: 0, wins: 0, winNext: 0, qualifyWithWin: 0 }]));
    const nextGames = schedule.filter(game => game.week === input.completedWeeks + 1);
    const remaining = schedule.filter(game => game.week > input.completedWeeks);
    const rank = (a, b) => (b.wins + b.ties * 0.5) - (a.wins + a.ties * 0.5) || b.pf - a.pf || a.id.localeCompare(b.id);
    for (let trial = 0; trial < iterations; trial++) {
      const teams = new Map([...history].map(([id, team]) => [id, { ...team }]));
      const nextWinners = new Set();
      for (const game of remaining) {
        const a = draw(game.homeId), b = draw(game.awayId);
        addGame(teams, game, a, b);
        if (game.week === input.completedWeeks + 1 && a !== b) nextWinners.add(a > b ? game.homeId : game.awayId);
      }
      const ranked = [...teams.values()].sort(rank);
      const field = ranked.slice(0, input.playoffTeams).map((team, index) => ({ id: team.id, seed: index + 1 }));
      const byeCount = input.playoffTeams === 6 ? 2 : 0;
      ranked.forEach((team, index) => {
        const total = totals.get(team.id);
        total.seeds[index]++;
        total.wins += team.wins + team.ties * 0.5;
        if (index < input.playoffTeams) total.qualified++;
        if (index < byeCount) total.bye++;
        if (nextWinners.has(team.id)) {
          total.winNext++;
          if (index < input.playoffTeams) total.qualifyWithWin++;
        }
      });
      const play = (a, b) => {
        const scoreA = draw(a.id), scoreB = draw(b.id);
        return scoreA === scoreB ? (a.seed < b.seed ? a : b) : scoreA > scoreB ? a : b;
      };
      let semifinalists;
      if (input.playoffTeams === 4) semifinalists = [field[0], field[3], field[1], field[2]];
      else if (input.playoffTeams === 6) {
        semifinalists = [field[0], play(field[3], field[4]), field[1], play(field[2], field[5])];
      } else {
        semifinalists = [play(field[0], field[7]), play(field[3], field[4]),
          play(field[1], field[6]), play(field[2], field[5])];
      }
      if (input.reseed) {
        semifinalists.sort((a, b) => a.seed - b.seed);
        semifinalists = [semifinalists[0], semifinalists[3], semifinalists[1], semifinalists[2]];
      }
      const finalists = [play(semifinalists[0], semifinalists[1]), play(semifinalists[2], semifinalists[3])];
      finalists.forEach(team => totals.get(team.id).finalists++);
      totals.get(play(finalists[0], finalists[1]).id).champion++;
    }
    return { iterations, seed, completedWeeks: input.completedWeeks, regularWeeks: input.regularWeeks,
      playoffTeams: input.playoffTeams, reseed: input.reseed,
      teams: [...totals.values()].map(team => ({
        ...team, mean: models.get(team.id).mean, deviation: models.get(team.id).deviation,
        nextOpponentId: (() => {
          const game = nextGames.find(game => game.homeId === team.id || game.awayId === team.id);
          return game.homeId === team.id ? game.awayId : game.homeId;
        })(),
        expectedWinEquivalents: team.wins / iterations
      })).sort((a, b) => b.qualified - a.qualified || b.champion - a.champion || a.id.localeCompare(b.id)) };
  }

  async function loadSleeper(league, fetchJson) {
    const base = `https://api.sleeper.app/v1/league/${encodeURIComponent(league.leagueId)}`;
    const [metadata, nfl, rosters, users] = await Promise.all([
      fetchJson(base), fetchJson("https://api.sleeper.app/v1/state/nfl"),
      fetchJson(`${base}/rosters`), fetchJson(`${base}/users`)
    ]);
    const settings = metadata?.settings;
    if (String(metadata?.league_id) !== String(league.leagueId) || String(metadata?.season) !== String(league.season) ||
        String(nfl?.season) !== String(league.season) || nfl?.season_type !== "regular" ||
        !Number.isInteger(nfl.week) || !settings ||
        ![0, 1].includes(settings.playoff_seed_type) || settings.playoff_round_type !== 0 ||
        !Number.isInteger(settings.playoff_week_start) ||
        (settings.divisions !== undefined && settings.divisions !== 0) ||
        (settings.league_average_match !== undefined && settings.league_average_match !== 0) ||
        (settings.type !== undefined && ![0, 1, 2].includes(settings.type))) {
      throw new Error("Only current-season Sleeper regular leagues with explicit single-week playoff rules, no divisions and no median games are supported.");
    }
    const completedWeeks = nfl.week - 1, regularWeeks = settings.playoff_week_start - 1;
    if (!Array.isArray(rosters) || rosters.length !== metadata.total_rosters || !Array.isArray(users)) {
      throw new Error("Complete Sleeper roster and user data is required.");
    }
    const names = new Map(users.map(user => [user.user_id, user.metadata?.team_name || user.display_name]));
    const teams = rosters.map(roster => ({ id: String(roster.roster_id), name: names.get(roster.owner_id) || `Team ${roster.roster_id}` }));
    if (rosters.some(roster => !Number.isInteger(roster.roster_id))) throw new Error("Invalid roster identifiers.");
    const input = { teams, schedule: [], completedWeeks, regularWeeks, playoffTeams: settings.playoff_teams, reseed: settings.playoff_seed_type === 1 };
    // Validate format before requesting a season of matchup data.
    validate(input, true);
    for (let first = 1; first <= regularWeeks; first += 4) {
      const weeks = Array.from({ length: Math.min(4, regularWeeks - first + 1) }, (_, index) => first + index);
      const batches = await Promise.all(weeks.map(async week => {
        const rows = await fetchJson(`${base}/matchups/${week}`);
        if (!Array.isArray(rows) || rows.length !== teams.length ||
            rows.some(row => row.matchup_id === null || row.matchup_id === undefined)) {
          throw new Error(`Week ${week}: complete paired schedule required; byes are unsupported.`);
        }
        const groups = new Map();
        for (const row of rows) {
          const key = String(row.matchup_id);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(row);
        }
        return [...groups.values()].map(pair => {
          if (pair.length !== 2) throw new Error(`Week ${week}: expected exactly two teams per matchup.`);
          return { week, homeId: String(pair[0].roster_id), awayId: String(pair[1].roster_id),
            ...(week <= completedWeeks ? { homeScore: pair[0].points, awayScore: pair[1].points } : {}) };
        });
      }));
      input.schedule.push(...batches.flat());
    }
    validate(input);
    return input;
  }

  window.FFOPlayoffs = Object.freeze({ validate: input => validate(input), simulate, loadSleeper });
})();
