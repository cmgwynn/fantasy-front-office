const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const context = vm.createContext({ window: {}, TextEncoder });
for (const file of ["league-records.js", "workspace-backup.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context);
}
const workspace = context.window.FFOWorkspace;
const faabKey = "fantasy-faab-v1:yahoo:2026:test";
const faabValue = JSON.stringify({ budget: 100, weeksRemaining: 10, strategy: "balanced", claims: [] });
function fixture() {
  const player = { id: "p1", name: "Fixture QB", position: "QB", team: "KC", projectedPoints: 0, seasonPpg: 15,
    baseValue: 200, vorpScore: 1, posRank: 1, ovrRank: 1, injuryStatus: "Healthy" };
  const manager = { rosterId: 1, teamName: "Fixture roster", players: ["p1"], starters: ["p1"], reserve: [], taxi: [],
    ownedPicks: [], history: [1], wins: 1, losses: 0, pf: 100, pa: 90, maxPf: 100, eff: 100, rosPpg: 15,
    allPlayW: 1, allPlayL: 0, luck: 0, power: 100, week1Rank: 1, currentRank: 1, projW: 10, projL: 4, playoffPct: 60 };
  return {
    format: "fantasy-front-office-workspace", version: 1, savedAt: "2026-10-29T06:00:00.000Z",
    snapshot: { season: "2026", week: 8, provider: "yahoo",
      activeLeague: { provider: "yahoo", leagueId: "test", name: "Fixture league", season: "2026",
        rosterPositions: ["QB", "BN"], scoringSettings: { rec: 1 } },
      managers: [manager], players: { p1: player }, rawProj: {}, rawStats: {}, currentMatchups: [],
      livePlayerPoints: { p1: 0 }, portfolioRosterSelections: {}, dataFreshness: { players: 123 }, dataErrors: {} },
    ui: { teamIndex: 0, tab: "tab-planner", planner: { weeks: 4, holdInjuries: true, search: "", addId: "", dropId: "" } },
    records: { games: [], source: "Fixture", coverage: "Fixture", errors: [] }, storage: { [faabKey]: faabValue }
  };
}
function storage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return { entries, get length() { return entries.size; }, key: index => [...entries.keys()][index],
    getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
}

test("workspace round trip preserves explicit zero points, selected view and local plans", () => {
  const backup = workspace.parseBackup(JSON.stringify(fixture()));
  assert.equal(backup.snapshot.players.p1.projectedPoints, 0);
  assert.equal(backup.ui.tab, "tab-planner");
  assert.equal(backup.storage[faabKey], faabValue);
});

test("workspace preserves optional career history while retaining support for older backups", () => {
  const backup = fixture();
  backup.careerHistory = { seasons: [{ season: "2025", leagueId: "older", coverage: "Fixture", errors: [],
    teams: [{ rosterId: "1", ownerId: "alice", name: "Old team" }], games: [] }],
  errors: [], coverage: "One season", complete: true };
  assert.equal(workspace.parseBackup(JSON.stringify(backup)).careerHistory.seasons[0].season, "2025");
  backup.careerHistory.seasons[0].teams.push({ rosterId: "1", ownerId: "bob", name: "Duplicate" });
  assert.throws(() => workspace.validateBackup(backup), /Duplicate historical roster/);
});

test("workspace validation rejects malformed or unsupported backups before mutation", () => {
  assert.throws(() => workspace.parseBackup("{"), /valid JSON/);
  for (const change of [
    backup => { backup.version = 2; },
    backup => { backup.snapshot.week = 19; },
    backup => { backup.snapshot.managers[0].players.push("missing"); },
    backup => { backup.snapshot.managers.push(backup.snapshot.managers[0]); },
    backup => { backup.snapshot.players.p1.projectedPoints = "12"; },
    backup => { backup.snapshot.players.p1.importedPlanningBye = 19; },
    backup => { backup.snapshot.players.p1.snapSharePct = "full"; },
    backup => { backup.snapshot.managers[0].rosterId = "1);alert(1)"; },
    backup => { backup.snapshot.managers[0].starters = ["missing"]; },
    backup => { backup.snapshot.managers[0].ownedPicks = [{}]; },
    backup => { backup.ui.teamIndex = 5; },
    backup => { backup.ui.planner.weeks = 3; },
    backup => { backup.snapshot.activeLeague.rosterPositions = []; },
    backup => { backup.storage[faabKey] = "{}"; },
    backup => { backup.storage[faabKey] = "not-json"; },
    backup => { backup.storage["unrelated-auth-token"] = "{}"; },
    backup => { backup.records.games = [{ completed: false }]; },
    backup => { backup.snapshot.managers[0].teamName = "<img onerror=alert(1)>"; }
  ]) {
    const backup = fixture();
    change(backup);
    assert.throws(() => workspace.validateBackup(backup));
  }
  assert.throws(() => workspace.parseBackup('{"format":"fantasy-front-office-workspace","version":1,"__proto__":{}}'), /unsafe object key/);
});

test("workspace backup enforces byte limit and nesting limit", () => {
  assert.throws(() => workspace.parseBackup(" ".repeat(workspace.MAX_BYTES + 1)), /25 MB/);
  const backup = fixture();
  let nested = backup.snapshot.rawStats;
  for (let index = 0; index < 45; index++) nested = nested.next = {};
  assert.throws(() => workspace.validateBackup(backup), /nesting/);
});

test("workspace export includes only recognized app saves and rejects corrupt recognized saves", () => {
  const store = storage({ [faabKey]: faabValue, "third-party-token": "private", "nfl_sched_2026": "{}" });
  assert.deepEqual(Object.keys(workspace.captureStorage(store)), [faabKey]);
  store.setItem(faabKey, "{");
  assert.throws(() => workspace.captureStorage(store), /valid JSON/);
});

test("workspace restore replaces only recognized keys and awaits durable commit", async () => {
  const oldKey = "fantasy-front-office:portfolio-rosters";
  const store = storage({ [oldKey]: "{}", other: "untouched" });
  let committed = false;
  await workspace.restoreBackup(fixture(), store, async backup => {
    assert.equal(store.getItem(faabKey), faabValue);
    assert.equal(backup.version, 1);
    await Promise.resolve();
    committed = true;
  });
  assert.equal(committed, true);
  assert.equal(store.getItem(oldKey), null);
  assert.equal(store.getItem("other"), "untouched");
});

test("workspace restore rolls back saved plans on storage quota or durable commit failure", async () => {
  for (const failStorage of [true, false]) {
    const initial = { "fantasy-front-office:portfolio-rosters": "{}", other: "untouched" };
    const store = storage(initial);
    const originalSet = store.setItem;
    store.setItem = (key, value) => {
      if (failStorage && key === faabKey) throw new Error("Quota exceeded");
      originalSet(key, value);
    };
    await assert.rejects(workspace.restoreBackup(fixture(), store, async () => { throw new Error("IndexedDB aborted"); }),
      /previous local plans were restored/);
    assert.deepEqual(Object.fromEntries(store.entries), initial);
  }
});

test("workspace restore can replace corrupt old saves without compromising rollback", async () => {
  const store = storage({ [faabKey]: "corrupt" });
  await workspace.restoreBackup(fixture(), store, async () => {});
  assert.equal(store.getItem(faabKey), faabValue);
});
