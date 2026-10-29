const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../league-records.js"), "utf8"), sandbox);
const { validateGames, normalizeSleeperWeek, summarize } = sandbox.window.FFORecords;
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
