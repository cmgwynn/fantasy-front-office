const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../playoff-simulator.js"), "utf8"), sandbox);
const { validate, simulate, loadSleeper } = sandbox.window.FFOPlayoffs;

function fixture(count = 8, playoffTeams = 6) {
  const teams = Array.from({ length: count }, (_, i) => ({ id: String(i + 1), name: `Team ${i + 1}` }));
  const schedule = [1, 2, 3, 4].flatMap(week => teams.slice(0, count / 2).map((team, i) => ({
    week, homeId: team.id, awayId: teams[count - i - 1].id, homeScore: 100, awayScore: 100
  })));
  return { teams, schedule, completedWeeks: 2, regularWeeks: 4, playoffTeams, reseed: false };
}

test("playoff trials conserve seed, qualifier, bye, finalist and champion counts for every format", () => {
  for (const playoffTeams of [4, 6, 8]) {
    for (const reseed of [true, false]) {
      const input = { ...fixture(), playoffTeams, reseed };
      const report = simulate(input, 1000, 12345);
      for (let seed = 0; seed < 8; seed++) assert.equal(report.teams.reduce((sum, team) => sum + team.seeds[seed], 0), 1000);
      for (const [field, expected] of [["qualified", playoffTeams], ["bye", playoffTeams === 6 ? 2 : 0], ["finalists", 2], ["champion", 1]]) {
        assert.equal(report.teams.reduce((sum, team) => sum + team[field], 0), expected * 1000);
      }
      assert.ok(Math.abs(report.teams.reduce((sum, team) => sum + team.expectedWinEquivalents, 0) - 16) < 1e-10);
      report.teams.forEach(team => {
        assert.equal(team.seeds.reduce((sum, count) => sum + count, 0), 1000);
        assert.ok(team.champion <= team.finalists && team.finalists <= team.qualified);
        assert.ok(team.qualifyWithWin <= team.winNext && team.qualifyWithWin <= team.qualified);
        assert.equal(team.mean, 100);
        assert.equal(team.deviation, 10);
      });
      assert.equal(JSON.stringify(input), JSON.stringify({ ...fixture(), playoffTeams, reseed }), "No mutation");
      assert.equal(JSON.stringify(report), JSON.stringify(simulate(input, 1000, 12345)), "Seeded repeatability");
    }
  }
});

test("overwhelming scoring advantages produce the exact expected first seed and championship path", () => {
  const input = fixture();
  input.schedule.filter(game => game.week <= 2 && game.homeId === "1").forEach(game => { game.homeScore = 2000; });
  const report = simulate(input, 1000);
  const favorite = report.teams.find(team => team.id === "1");
  assert.equal(favorite.seeds[0], 1000);
  assert.equal(favorite.qualified, 1000);
  assert.equal(favorite.bye, 1000);
  assert.equal(favorite.finalists, 1000);
  assert.equal(favorite.champion, 1000);
  assert.equal(favorite.expectedWinEquivalents, 4);
});

test("symmetric teams are approximately equally likely champions, including byes and reseeding", () => {
  for (const playoffTeams of [4, 6, 8]) {
    const report = simulate(fixture(8, playoffTeams), 10000, 57);
    report.teams.forEach(team => assert.ok(Math.abs(team.champion / 10000 - 1 / 8) < 0.025));
  }
});

test("weekly actual ties, negative points, and future provider scores do not get replaced or leak", () => {
  const input = fixture(4, 4);
  input.schedule.filter(game => game.week <= 2).forEach(game => { game.homeScore = -5; game.awayScore = -5; });
  const report = simulate(input, 100);
  report.teams.forEach(team => assert.equal(team.mean, -5));
  const modified = structuredClone(input);
  modified.schedule.filter(game => game.week > 2).forEach(game => { game.homeScore = 100000; game.awayScore = -100000; });
  assert.equal(JSON.stringify(report), JSON.stringify(simulate(modified, 100)));
});

test("missing/duplicate games, unknown teams, ambiguous scores and unsupported formats are rejected", () => {
  const cases = [
    input => input.schedule.pop(),
    input => { input.schedule[0] = input.schedule[1]; },
    input => { input.schedule[0].awayId = "unknown"; },
    input => { input.schedule[0].homeScore = null; },
    input => { input.schedule[0].homeScore = "0"; },
    input => { input.teams[0].id = input.teams[1].id; },
    input => { input.playoffTeams = 7; },
    input => { input.completedWeeks = 0; },
    input => { input.completedWeeks = input.regularWeeks; },
    input => { input.regularWeeks = 16; },
    input => { input.reseed = "fixed"; }
  ];
  for (const mutate of cases) {
    const input = fixture();
    mutate(input);
    assert.throws(() => validate(input));
  }
  assert.throws(() => simulate(fixture(), 0), /count/);
  assert.throws(() => simulate(fixture(), 100, 0), /seed/);
});

function sleeperFetch(overrides = {}) {
  return async url => {
    const input = fixture(4, 4);
    if (url.endsWith("/state/nfl")) return { season: "2026", season_type: "regular", week: 3, ...overrides.nfl };
    if (url.endsWith("/users")) return [];
    if (url.endsWith("/rosters")) return input.teams.map(team => ({ roster_id: Number(team.id), owner_id: team.id }));
    if (url.includes("/matchups/")) {
      const week = Number(url.split("/").pop());
      const rows = input.schedule.filter(game => game.week === week).flatMap((game, i) => [
        { roster_id: Number(game.homeId), matchup_id: i + 1, points: game.homeScore },
        { roster_id: Number(game.awayId), matchup_id: i + 1, points: game.awayScore }
      ]);
      return overrides.rows ? overrides.rows(rows, week) : rows;
    }
    return { league_id: "league", season: "2026", total_rosters: 4,
      settings: { playoff_teams: 4, playoff_week_start: 5, playoff_seed_type: 0, playoff_round_type: 0,
        ...overrides.settings }, ...overrides.metadata };
  };
}
const league = { leagueId: "league", season: "2026" };

test("Sleeper loader verifies all weeks and leaves current/future scores unused", async () => {
  const input = await loadSleeper(league, sleeperFetch());
  assert.equal(input.completedWeeks, 2);
  assert.equal(input.schedule.length, 8);
  assert.equal(input.schedule.filter(game => game.homeScore !== undefined).length, 4);
  assert.equal(simulate(input, 10).teams.length, 4);
});

test("Sleeper loader refuses unsupported settings, incomplete schedules and stale identities", async () => {
  for (const overrides of [
    { settings: { divisions: 2 } }, { settings: { league_average_match: 1 } },
    { settings: { playoff_round_type: 1 } }, { settings: { playoff_seed_type: undefined } },
    { settings: { playoff_teams: 7 } }, { settings: { playoff_week_start: 0 } },
    { nfl: { season: "2025" } }, { nfl: { week: 5 } }, { nfl: { season_type: "post" } },
    { metadata: { league_id: "wrong" } }, { metadata: { total_rosters: 6 } },
    { rows: rows => rows.slice(1) }, { rows: rows => rows.map(row => ({ ...row, matchup_id: null })) },
    { rows: (rows, week) => rows.map(row => ({ ...row, points: week === 1 ? null : row.points })) }
  ]) await assert.rejects(() => loadSleeper(league, sleeperFetch(overrides)));
});
