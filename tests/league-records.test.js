const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../league-records.js"), "utf8"), sandbox);
const { validateGames, normalizeSleeperWeek, normalizeEspnSchedule, summarize, buildRivalryMatrix } = sandbox.window.FFORecords;
const game = (week, homeScore, awayScore, homeId = "1", awayId = "2") =>
  ({ week, completed: true, homeId, awayId, homeScore, awayScore });

test("records aggregate reversed home/away games and ties without mixing teams", () => {
  const report = summarize([game(1, 100, 90), game(2, 110, 80, "2", "1"), game(3, 0, 0)]);
  assert.equal(report.pairs.length, 1);
  const pair = report.pairs[0];
  assert.equal(pair.games, 3);
  assert.equal(pair.winsA, 1);
  assert.equal(pair.winsB, 1);
  assert.equal(pair.ties, 1);
  assert.equal(pair.pointsA, 180);
  assert.equal(pair.pointsB, 200);
  assert.equal(report.highest.teamId, "2");
  assert.equal(report.highest.points, 110);
  assert.equal(report.closest.margin, 10);
  assert.equal(report.blowout.margin, 30);
});

test("records accept legitimate zero and negative points; tied games are not decided", () => {
  assert.equal(summarize([game(1, -2, 0)]).highest.points, 0);
  const report = summarize([game(1, 0, 0)]);
  assert.equal(report.closest, null);
  assert.equal(report.ties, 1);
  assert.equal(summarize([]).highest, null);
});

test("records reject uncompleted, missing, nonnumeric, duplicate, and multi-opponent results", () => {
  for (const bad of [
    { ...game(1, 10, 20), completed: false },
    { ...game(1, 10, 20), homeScore: null },
    { ...game(1, 10, 20), awayScore: "20" },
    { ...game(1, 10, 20), homeId: "" },
    game(0, 10, 20), game(19, 10, 20), game(1, NaN, 20), game(1, Infinity, 20), game(1, 10, 20, "1", "1")
  ]) assert.throws(() => validateGames([bad]));
  assert.throws(() => validateGames([game(1, 10, 20), game(1, 20, 10, "2", "1")]), /Duplicate/);
  assert.throws(() => validateGames([game(1, 10, 20), game(1, 10, 30, "1", "3")]), /multiple opponents/);
});

test("Sleeper normalization requires exactly paired teams and real numeric scores", () => {
  const rows = [
    { matchup_id: 1, roster_id: 1, points: 0 },
    { matchup_id: 1, roster_id: 2, points: 2 },
    { matchup_id: null, roster_id: 3, points: 5 }
  ];
  assert.equal(normalizeSleeperWeek(rows, 1).length, 1);
  assert.equal(normalizeSleeperWeek(rows, 1)[0].homeScore, 0);
  assert.throws(() => normalizeSleeperWeek(rows.slice(0, 1), 1), /two teams/);
  assert.throws(() => normalizeSleeperWeek([], 1), /no matchup/);
  assert.throws(() => normalizeSleeperWeek([{ ...rows[0], points: undefined }, rows[1]], 1), /numeric scores/);
});

test("demo records are explicitly fictional input and reconcile through aggregation", () => {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../demo-league.js"), "utf8"), sandbox);
  const report = summarize(sandbox.window.FFODemo.createDemoLeague().completedMatchups);
  assert.equal(report.games.length, 4);
  assert.equal(report.highest.points, 140);
  assert.equal(report.closest.margin, 1);
  assert.equal(report.blowout.margin, 45);
});

const espnData = () => ({
  status: { currentScoringPeriod: 8 },
  settings: { scheduleSettings: { matchupPeriods: { 1: [1], 2: [2], 8: [8], 15: [15] } } },
  schedule: [
    { id: 1, matchupPeriodId: 1, playoffTierType: "NONE", winner: "HOME", home: { teamId: 1, totalPoints: 100 }, away: { teamId: 2, totalPoints: 90 } },
    { id: 2, matchupPeriodId: 2, playoffTierType: "NONE", winner: "TIE", home: { teamId: 2, totalPoints: 0 }, away: { teamId: 1, totalPoints: 0 } },
    { id: 8, matchupPeriodId: 8, playoffTierType: "NONE", winner: "UNDECIDED", home: { teamId: 1, totalPoints: 20 }, away: { teamId: 2, totalPoints: 0 } },
    { id: 15, matchupPeriodId: 15, playoffTierType: "WINNERS_BRACKET", winner: "HOME", home: { teamId: 1, totalPoints: 999 }, away: { teamId: 2, totalPoints: 90 } }
  ]
});

test("ESPN records require final scores, exclude current weeks/playoffs and retain ties/zeros", () => {
  const report = normalizeEspnSchedule(espnData());
  assert.equal(report.games.length, 2);
  assert.equal(report.games[1].homeScore, 0);
  assert.equal(report.excluded, 2);
  assert.equal(report.errors.length, 0);
});

test("ESPN records surface missing settings, unfinalized results, scores and unsupported overrides", () => {
  assert.throws(() => normalizeEspnSchedule({}), /no season matchup/);
  assert.throws(() => normalizeEspnSchedule({ schedule: [{}] }), /cannot be verified/);
  for (const patch of [
    { winner: "UNDECIDED" },
    { playoffTierType: undefined },
    { matchupPeriodId: 9 },
    { home: { teamId: 1, totalPoints: null } },
    { winner: "AWAY" },
    { home: { teamId: 1, totalPoints: "100" } }
  ]) {
    const data = espnData();
    data.schedule = [{ ...data.schedule[0], ...patch }];
    const result = normalizeEspnSchedule(data);
    assert.equal(result.games.length, 0);
    assert.equal(result.errors.length, 1);
  }
});

test("ESPN multiweek totals and duplicates cannot become weekly records", () => {
  const data = espnData();
  data.settings.scheduleSettings.matchupPeriods[1] = [1, 2];
  const report = normalizeEspnSchedule(data);
  assert.equal(report.games.length, 1);
  assert.match(report.errors[0], /multiweek/);
  const duplicate = espnData();
  duplicate.schedule.push({ ...duplicate.schedule[0] });
  assert.throws(() => normalizeEspnSchedule(duplicate), /Duplicate/);
});

test("rivalry heat map reverses records by row and gives ties half credit", () => {
  const report = summarize([game(1, 100, 90), game(2, 20, 20)]);
  const matrix = buildRivalryMatrix(report.pairs, ["1", "2", "3"]);
  const rowA = matrix[0], rowB = matrix[1];
  assert.equal(rowA.cells[0].kind, "self");
  assert.equal(rowA.cells[1].wins, 1);
  assert.equal(rowA.cells[1].ties, 1);
  assert.equal(rowA.cells[1].rate, 0.75);
  assert.equal(rowA.cells[1].kind, "strong-win");
  assert.equal(rowB.cells[0].losses, 1);
  assert.equal(rowB.cells[0].rate, 0.25);
  assert.equal(rowB.cells[0].kind, "strong-loss");
  assert.equal(rowA.cells[2].kind, "unplayed");
  assert.equal(matrix[2].cells[0].rate, undefined);
});

test("rivalry heat map includes result-only IDs and differentiates even records from no meetings", () => {
  const even = buildRivalryMatrix(summarize([game(1, 0, 0)]).pairs, ["1", "3"]);
  assert.equal(even.length, 3);
  assert.equal(even[0].cells.find(cell => cell.opponentId === "2").kind, "even");
  assert.equal(even[0].cells.find(cell => cell.opponentId === "3").kind, "unplayed");
  for (const [winsA, winsB, kind] of [[2, 1, "win"], [1, 2, "loss"], [0, 3, "strong-loss"], [3, 0, "strong-win"]]) {
    const matrix = buildRivalryMatrix([{ a: "1", b: "2", winsA, winsB, ties: 0, games: 3 }], ["1", "2"]);
    assert.equal(matrix[0].cells[1].kind, kind);
    assert.equal(matrix[0].cells[1].rate + matrix[1].cells[0].rate, 1);
  }
});
