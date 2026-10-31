const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../weekly-matchups.js"), "utf8"), sandbox);
const { aggregate, compare } = sandbox.window.FFOWeeklyMatchups;
const teams = Array.from({ length: 32 }, (_, index) => `T${index}`);
const options = { season: "2026", weeks: [1, 2, 3], position: "WR", receptionPoints: 1, teams };
const fixtures = () => teams.flatMap((opponent, index) => [1, 2, 3].map(week => ({
  player_id: `wr${index}`, player: { position: "WR", team: "WRONG_CURRENT_TEAM" }, team: teams[(index + 1) % 32],
  opponent, week, season: "2026", season_type: "regular", game_id: `${week}:${index}`,
  stats: { gp: 1, off_snp: 20, pts_ppr: index + 10, pts_half_ppr: index + 5, pts_std: index }
})));

test("weekly positional matchup ratings use historical row opponents, not current player teams", () => {
  const result = aggregate(fixtures(), options);
  assert.equal(result.qualifiedTeams, 32);
  assert.equal(result.ratings.T0.rating, 0);
  assert.equal(result.ratings.T31.rating, 100);
  assert.equal(result.ratings.T31.average, 41);
  assert.equal(result.ratings.T31.games, 3);
  assert.equal(result.ratings.T31.confidence, "Low");
  assert.equal(result.ratings.T31.adjustment, 0.1);
  assert.equal(result.ratings.T0.adjustment, -0.1);
});

test("matchup aggregation preserves zero/negative fantasy scores, sums position groups, and uses exact scoring presets", () => {
  const rows = fixtures();
  rows[0].stats.pts_ppr = -5;
  rows[1].stats.pts_ppr = 0;
  rows[2].stats.pts_ppr = 2;
  rows.push({ ...rows[2], player_id: "secondWR", stats: { gp: 1, off_snp: 5, pts_ppr: 6 } });
  assert.equal(aggregate(rows, options).ratings.T0.average, 1);
  assert.equal(aggregate(fixtures(), { ...options, receptionPoints: 0.5 }).ratings.T31.average, 36);
  assert.equal(aggregate(fixtures(), { ...options, receptionPoints: 0 }).ratings.T31.average, 31);
  assert.throws(() => aggregate(rows, { ...options, receptionPoints: 0.75 }), /Unsupported/);
});

test("matchup evidence excludes future weeks, other seasons, missing historical teams and duplicate rows", () => {
  const rows = fixtures();
  const extra = [
    { ...rows[0], week: 4, stats: { gp: 1, off_snp: 5, pts_ppr: 999 } },
    { ...rows[0], season: "2025" }, { ...rows[0], team: null }, { ...rows[0], season_type: "post" }, rows[0]
  ];
  const result = aggregate([...rows, ...extra], options);
  assert.equal(result.ratings.T0, undefined);
  assert.equal(result.ratings.T1.average, 11);
  assert.equal(result.excluded, 5);
});

test("missing individual scores invalidate the game; missing defenses do not receive invented neutral ratings", () => {
  const rows = fixtures();
  rows[0].stats.pts_ppr = undefined;
  const partial = aggregate(rows, options);
  assert.equal(partial.ratings.T0, undefined);
  assert.equal(partial.qualifiedTeams, 31);
  const tooSmall = aggregate(fixtures().filter(row => Number(row.opponent.slice(1)) < 23), options);
  assert.equal(tooSmall.qualifiedTeams, 23);
  assert.equal(tooSmall.ratings.T1.rating, null);
});

test("provider sparse zero-score participants count only with all unranked sentinels and no scoring counters", () => {
  const rows = fixtures();
  rows.push({ ...rows[0], player_id: "zero", stats: { gp: 1, off_snp: 2, pos_rank_ppr: 999, pos_rank_half_ppr: 999, pos_rank_std: 999 } });
  assert.equal(aggregate(rows, options).ratings.T0.average, 10);
  rows.at(-1).stats.rec_yd = 15;
  assert.equal(aggregate(rows, options).ratings.T0, undefined);
});

test("equal defensive allowances share a neutral percentile rather than arbitrary tiebreak ranks", () => {
  const rows = fixtures().map(row => ({ ...row, stats: { gp: 1, off_snp: 5, pts_ppr: 10 } }));
  const result = aggregate(rows, options);
  assert.ok(Object.values(result.ratings).every(entry => entry.rating === 50 && entry.adjustment === 0));
});

test("conflicting historical game metadata fails explicitly", () => {
  const rows = fixtures();
  rows.push({ ...rows[0], player_id: "conflict", team: "T5" });
  assert.throws(() => aggregate(rows, options), /Conflicting/);
});

test("start/sit considers availability before matchup and never invents missing projections", () => {
  const a = { projection: 20, adjustment: 0.1, unavailable: true };
  const b = { projection: 10, adjustment: -0.1, unavailable: false };
  assert.equal(compare(a, b).preferred, "b");
  assert.equal(compare(a, { ...b, unavailable: true }).reason, "Neither player is an available starter this week.");
  assert.match(compare({ ...a, projection: undefined }, b).reason, /missing or invalid/);
});

test("start/sit uses bounded sensitivity only with both matchup inputs and marks close calls", () => {
  const a = { projection: 12, adjustment: -0.1, unavailable: false };
  const b = { projection: 11, adjustment: 0.1, unavailable: false };
  const advice = compare(a, b);
  assert.equal(advice.preferred, "b");
  assert.ok(Math.abs(advice.adjusted.a - 10.8) < 0.000001);
  assert.ok(Math.abs(advice.adjusted.b - 12.1) < 0.000001);
  const partial = compare(a, { ...b, adjustment: null });
  assert.equal(partial.preferred, "a");
  assert.equal(partial.adjusted, null);
  assert.match(partial.basis, /coverage incomplete/);
  assert.equal(compare(a, { ...a, adjustment: -0.09 }).close, true);
});
