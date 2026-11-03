const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../scoring.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const { normalizeEspnScoring, scoreStatLine, describe } = sandbox.window.FFOScoring;
const plain = value => JSON.parse(JSON.stringify(value));
const score = (stats, rules, options) => plain(scoreStatLine(stats, rules, options));
const espn = (...scoringItems) => normalizeEspnScoring({ scoringItems });
const item = (statId, points, extra = {}) => ({ statId, points, ...extra });

test("browser global also works in a Node VM without window, DOM, or network", () => {
  assert.equal(sandbox.FFOScoring, sandbox.window.FFOScoring);
  const node = {};
  vm.runInNewContext(source, node);
  assert.equal(node.FFOScoring.scoreStatLine({ pass_td: 2 }, { pass_td: 6 }).points, 12);
});

test("Sleeper custom passing TD, completion, rushing and yardage coefficients", () => {
  const result = score({ pass_yd: 287.5, pass_td: 2.25, pass_cmp: 22, pass_inc: 9, rush_yd: 17 },
    { pass_yd: 0.05, pass_td: 6, pass_cmp: 0.1, pass_inc: -0.2, rush_yd: 0.15 }, { position: "QB" });
  assert.ok(Math.abs(result.points - 30.825) < 1e-10);
  assert.deepEqual(result.unsupported, []);
  assert.deepEqual(result.missing, []);
});

test("nonstandard receptions, receiving first downs and fractional coefficients are exact", () => {
  assert.equal(score({ rec: 4, rec_yd: 60, rec_fd: 3, rec_td: 1 },
    { rec: 0.75, rec_yd: 0.12, rec_fd: 0.5, rec_td: 7 }).points, 18.7);
  assert.equal(score({ rec: 2 }, { rec: -0.25 }).points, -0.5);
  assert.equal(score({ rec: 4 }, { rec: "0.75" }).points, 3);
});

test("negative totals and explicit zero are never clamped or replaced with presets", () => {
  assert.equal(score({ pass_int: 3, fum_lost: 1 }, { pass_int: -3, fum_lost: -2 }).points, -11);
  assert.equal(score({ rec: 0, pts_ppr: 18 }, { rec: 0.75 }).points, 0);
  assert.equal(score({ rec: 1.5 }, { rec: 0.75 }).points, 1.125);
});

test("TE/RB/WR premiums add to the reception coefficient only for that primary position", () => {
  const rules = { rec: 0.75, bonus_rec_te: 1, bonus_rec_rb: 0.25, bonus_rec_wr: 0.5 };
  for (const [position, points] of [["TE", 7], ["RB", 4], ["WR", 5], ["QB", 3]]) {
    assert.equal(score({ rec: 4 }, rules, { position }).points, points);
  }
  assert.equal(score({ rec: 4 }, rules).points, null);
  assert.ok(score({ rec: 4 }, rules).missing.includes("position"));
  assert.equal(score({ bonus_rec_te: 4 }, { bonus_rec_te: 0.5 }).points, 2);
});

test("threshold bonuses use only explicitly supplied event counters", () => {
  const rules = { pass_yd: 0.04, bonus_pass_yd_300: 3, bonus_pass_yd_400: 5 };
  assert.equal(score({ pass_yd: 410, bonus_pass_yd_300: 1, bonus_pass_yd_400: 1 }, rules).points, 24.4);
  for (const pass_yd of [0, 299, 300, 310.5, 410, 5000]) {
    const result = score({ pass_yd }, rules);
    assert.equal(result.points, null);
    assert.ok(result.missing.includes("bonus_pass_yd_300"));
    assert.ok(result.missing.includes("bonus_pass_yd_400"));
  }
  assert.equal(score({ pass_yd: 310.5, bonus_pass_yd_300: 0.3, bonus_pass_yd_400: 0 }, rules).points, 13.32);
});

test("rushing, receiving, combined-yardage and workload bonus counters remain independent", () => {
  const stats = { bonus_rush_yd_100: 1, bonus_rec_yd_100: 0, bonus_rush_rec_yd_100: 2, bonus_rush_att_20: 1, bonus_pass_cmp_25: 0 };
  const rules = Object.fromEntries(Object.keys(stats).map(key => [key, 2]));
  assert.equal(score(stats, rules).points, 8);
  delete stats.bonus_rush_rec_yd_100;
  assert.equal(score(stats, rules).points, null);
});

test("long-TD and reception-distance bonuses require observations, not average yards per catch", () => {
  const rules = { rec: 0.5, rec_0_4: 0.25, rec_40p: 2, rec_td_50p: 3 };
  assert.equal(score({ rec: 5, rec_0_4: 2, rec_40p: 1, rec_td_50p: 1 }, rules).points, 8);
  assert.equal(score({ rec: 5, rec_yd: 250, rec_td: 1 }, rules).points, null);
});

test("kicking supports distance buckets, fractional yardage and missed kicks", () => {
  assert.equal(score({ fgm_40_49: 2, fgm_60p: 1, fgm_yds: 150, xpm: 3, xpmiss: 1, fgmiss: 2 },
    { fgm_40_49: 4, fgm_60p: 6, fgm_yds: 0.01, xpm: 1, xpmiss: -1, fgmiss: -2 }, { position: "K" }).points, 13.5);
});

test("defense, special teams, and IDP coefficients do not fall back to preset totals", () => {
  assert.equal(score({ sack: 3.5, int: 1, safe: 1, def_td: 1, pts_allow_0: 0, pts_allow_35p: 1 },
    { sack: 1.5, int: 2, safe: 3, def_td: 6, pts_allow_0: 10, pts_allow_35p: -5 }, { position: "DEF" }).points, 11.25);
  assert.equal(score({ idp_tkl_solo: 5, idp_tkl_ast: 2, idp_sack: 0.5 },
    { idp_tkl_solo: 1.5, idp_tkl_ast: 0.75, idp_sack: 4 }, { position: "LB" }).points, 11);
  assert.equal(score({ kr_yd: 45, st_td: 1 }, { kr_yd: 0.02, st_td: 6 }).points, 6.9);
});

test("defensive allowance buckets are explicit, not inferred from aggregate points/yards", () => {
  assert.equal(score({ pts_allow: 0 }, { pts_allow_0: 10 }, { position: "DEF" }).points, null);
  assert.equal(score({ yds_allow: 99 }, { yds_allow_0_100: 5 }, { position: "DEF" }).points, null);
  assert.equal(score({ pts_allow_0: 0 }, { pts_allow_0: 10 }, { position: "DEF" }).points, 0);
});

test("position filters irrelevant categories but does not invent offensive zeros", () => {
  const rules = { pass_td: 6, rec: 0.75, fgm: 3, sack: 2, idp_sack: 4 };
  assert.equal(score({ pass_td: 2, rec: 0 }, rules, { position: "QB" }).points, 12);
  assert.equal(score({ fgm: 2 }, rules, { position: "K" }).points, 6);
  assert.equal(score({ sack: 3 }, rules, { position: "D/ST" }).points, 6);
  assert.equal(score({ pass_td: 2 }, rules, { position: "QB" }).points, null);
});

test("empty, unrelated, incomplete, null and nonfinite stat coverage never succeeds as zero", () => {
  for (const stats of [undefined, null, [], {}, { pts_ppr: 20 }, { rec: undefined }, { rec: null }, { rec: "" }, { rec: false }, { rec: NaN }, { rec: Infinity }]) {
    const result = score(stats, { rec: 0.75 });
    assert.equal(result.points, null);
    assert.ok(result.missing.includes("rec"));
  }
  assert.equal(score({ rec: 5 }, { rec: 0.75, rec_td: 6 }).points, null);
  assert.equal(score({ rec: 5 }, {}).points, null);
  assert.equal(score({ rec: 5 }, { rec: 0 }).points, null);
  assert.equal(score({}, { fgm: 3 }, { position: "WR" }).points, null);
});

test("unknown nonzero/custom Sleeper rules are explicit, including when a matching stat exists", () => {
  const result = score({ rec: 4, mystery: 10 }, { rec: 1, mystery: 2 });
  assert.equal(result.points, null);
  assert.deepEqual(result.unsupported, ["mystery"]);
  assert.equal(score({ rec: 4 }, { rec: 1, mystery: 0 }).points, 4);
  for (const rec of [null, "", false, Infinity, {}, "NaN"]) {
    assert.ok(score({ rec: 4 }, { rec }).unsupported.includes("rec"));
  }
});

test("ESPN normalization preserves every item, override, unsupported metadata, and is serializable", () => {
  const settings = { scoringType: "H2H_POINTS", customMetadata: { future: [1, "x"] },
    scoringItems: [item(53, 0.75, { pointsOverrides: { 4: 1.5, 3: 0 }, leagueTotal: 7 }),
      item(9999, 2, { futureRule: { minimum: 3 } })] };
  const before = JSON.stringify(settings);
  const normalized = normalizeEspnScoring(settings);
  assert.equal(JSON.stringify(settings), before);
  assert.deepEqual(plain(normalized.scoringItems), settings.scoringItems);
  assert.deepEqual(plain(normalized.customMetadata), settings.customMetadata);
  assert.equal(normalized.rec, 0.75);
  assert.equal(normalized.provider, "espn");
  assert.deepEqual(plain(normalizeEspnScoring(plain(normalized))), plain(normalized));
  normalized.scoringItems[0].pointsOverrides[4] = 9;
  assert.equal(settings.scoringItems[0].pointsOverrides[4], 1.5);
  assert.ok(describe(normalized).unsupported.includes("espn:9999"));
});

test("ESPN full offense coefficients map reliably beyond receptions", () => {
  const rules = espn(item(3, 0.05), item(4, 6), item(20, -3), item(24, 0.2),
    item(25, 7), item(42, 0.1), item(43, 6), item(53, 0.75), item(72, -2));
  const stats = { pass_yd: 200, pass_td: 2, pass_int: 1, rush_yd: 20, rush_td: 1,
    rec_yd: 10, rec_td: 0, rec: 2, fum_lost: 1 };
  assert.equal(score(stats, rules).points, 30.5);
  assert.equal(score(stats, plain(rules), { provider: "espn", position: "QB" }).points, 30.5);
});

test("ESPN numeric stats override aliases; numeric zero is authoritative", () => {
  assert.equal(score({ 4: 2, pass_td: 10 }, espn(item(4, 6))).points, 12);
  assert.equal(score({ 53: 0, rec: 10 }, espn(item(53, 0.75))).points, 0);
  assert.equal(score({ 53: null, rec: 10 }, espn(item(53, 0.75))).points, null);
  assert.equal(score({ 20: 3 }, espn(item(20, -3))).points, -9);
});

test("ESPN override keys are primary positions (TE=4, WR=3), not lineup slots (TE=6)", () => {
  const rules = espn(item(53, 0.75, { pointsOverrides: { 4: 1.5, 3: 0 } }));
  for (const position of ["TE", 4, "4"]) {
    assert.equal(score({ rec: 4 }, rules, { position }).points, 6);
  }
  assert.equal(score({ rec: 4 }, rules, { position: "RB" }).points, 3);
  assert.equal(score({ rec: 4 }, rules, { position: "WR" }).points, 0);
  assert.equal(score({}, rules, { position: "WR" }).points, null);
  assert.equal(score({ rec: 4 }, rules).points, null);
  assert.ok(score({ rec: 4 }, rules).missing.includes("position"));
  const wrong = espn(item(53, 1, { pointsOverrides: { 6: 2 } }));
  assert.ok(score({ rec: 4 }, wrong, { position: "TE" }).unsupported.includes("espn:53:override:6"));
});

test("ESPN zero overrides replace rather than add, without suppressing other coverage", () => {
  const rules = espn(item(53, 1, { pointsOverrides: { 4: 0 } }), item(42, 0.1));
  assert.equal(score({ rec_yd: 60 }, rules, { position: "TE" }).points, 6);
  assert.equal(score({ rec: 3, rec_yd: 60 }, rules, { position: "WR" }).points, 9);
  assert.equal(score({ rec: 3 }, espn(item(53, 0, { pointsOverrides: { 4: 1.5 } })), { position: "TE" }).points, 4.5);
});

test("ESPN kicker and defense overrides use K=5 and DEF=16", () => {
  assert.equal(score({ 86: 2 }, espn(item(86, 1, { pointsOverrides: { 5: 2 } })), { position: "K" }).points, 4);
  assert.equal(score({ 99: 3 }, espn(item(99, 1, { pointsOverrides: { 16: 2 } })), { position: "DST" }).points, 6);
  assert.equal(score({ 99: 3 }, espn(item(99, 1, { pointsOverrides: { 16: 0 } }), item(95, 2)), { position: "DEF" }).points, null);
});

test("ESPN distance, threshold, averages and grouped yardage require exact numeric counters", () => {
  const rules = espn(item(8, 1), item(17, 3), item(18, 5), item(22, 0.1), item(74, 5));
  assert.equal(score({ 8: 12, 17: 1, 18: 0, 22: 310, 74: 2 }, rules).points, 56);
  const incomplete = score({ pass_yd: 310, bonus_pass_yd_300: 1, fgm_50_59: 2 }, rules);
  assert.equal(incomplete.points, null);
  assert.ok(incomplete.missing.includes("espn:8"));
  assert.ok(incomplete.missing.includes("espn:17"));
  assert.ok(incomplete.missing.includes("espn:74"));
  assert.equal(score({ 17: 0, 18: 1 }, espn(item(17, 3), item(18, 5))).points, 5);
  assert.equal(score({ pts_allow: 7 }, espn(item(120, -0.5))).points, null);
  assert.equal(score({ 120: 7 }, espn(item(120, -0.5))).points, -3.5);
});

test("ESPN numeric-only kicking/defense categories and per-position category selection", () => {
  const rules = espn(item(4, 6), item(74, 5), item(80, 3), item(88, -2), item(89, 10), item(99, 2));
  assert.equal(score({ 74: 1, 80: 2, 88: 1 }, rules, { position: "K" }).points, 9);
  assert.equal(score({ 89: 0, sack: 3 }, rules, { position: "DEF" }).points, 6);
  assert.equal(score({ pass_td: 2 }, rules, { position: "QB" }).points, 12);
});

test("full native ESPN stat lines cover all publicly defined IDs through 234", () => {
  const ids = Array.from(sandbox.FFOScoring.espnNativeStatIds);
  assert.equal(ids.length, 235);
  for (const statId of ids) {
    const result = score({ [statId]: 2.5 }, espn(item(statId, -0.5)));
    assert.equal(result.points, -1.25, `native stat ${statId}`);
    assert.deepEqual(result.unsupported, []);
  }
  assert.equal(score({ 213: 2, 214: 85, 234: 1 }, espn(item(213, 0.5), item(214, 0.01), item(234, 2))).points, 3.85);
});

test("explicit cross-position plays are scored, not discarded as irrelevant", () => {
  assert.equal(score({ pass_td: 1, fgm: 1 }, { pass_td: 6, fgm: 3 }, { position: "K" }).points, 9);
  assert.equal(score({ 95: 1, 53: 0 }, espn(item(95, 2), item(53, 1)), { position: "WR" }).points, 2);
});

test("additional Sleeper defensive, special-team, 50+ kicking and first-down bonuses", () => {
  for (const [stats, position] of [
    [{ def_3_and_out: 2, def_forced_punts: 1, def_st_tkl_solo: 2, def_pass_def: 3 }, "DEF"],
    [{ st_tkl_solo: 2, pass_cmp_40p: 1, pass_int_td: 1, bonus_fd_qb: 1 }, "QB"],
    [{ fgm_50p: 2, fgmiss_50p: 1 }, "K"],
    [{ bonus_tkl_10p: 1, bonus_sack_2p: 1, idp_pass_def_3p: 0, bonus_def_int_td_50p: 1 }, "LB"]
  ]) {
    const rules = Object.fromEntries(Object.keys(stats).map(key => [key, 0.5]));
    assert.equal(score(stats, rules, { position }).points, Object.values(stats).reduce((a, b) => a + b, 0) / 2);
  }
});

test("unknown ESPN IDs remain explicitly unsupported, even with numeric data", () => {
  const rules = espn(item(9999, 2), item(53, 1));
  assert.deepEqual(score({ 9999: 5, rec: 3 }, rules).unsupported, ["espn:9999"]);
  assert.equal(score({ 9999: 5, rec: 3 }, rules).points, null);
  assert.equal(score({ rec: 3 }, espn(item(9999, 0), item(53, 1))).points, 3);
  assert.equal(score({ rec: 3 }, espn(item(9999, 0, { pointsOverrides: { 4: 2 } }), item(53, 1)), { position: "TE" }).points, null);
});

test("custom/nonlinear ESPN item metadata is preserved but never silently ignored", () => {
  for (const extra of [{ isReverseItem: true }, { minimum: 5 }, { multiplier: 2 }]) {
    const rules = espn(item(53, 1, extra));
    assert.equal(score({ rec: 5 }, rules).points, null);
    assert.ok(describe(rules).unsupported.length > 0);
    assert.deepEqual(plain(rules.scoringItems[0]), item(53, 1, extra));
  }
  assert.equal(score({ rec: 5 }, espn(item(53, 1, { isReverseItem: false, leagueRanking: 10, leagueTotal: 50 }))).points, 5);
});

test("malformed overrides, items and duplicate ESPN categories are explicitly rejected", () => {
  for (const scoringItems of [[item(53, "bad")], [null], [item(53, 1, { pointsOverrides: null })],
    [item(53, 1, { pointsOverrides: { 4: null } })], [item(53, 1), item(53, 2)]]) {
    const rules = normalizeEspnScoring({ scoringItems });
    assert.equal(score({ rec: 2 }, rules).points, null);
    assert.ok(score({ rec: 2 }, rules).unsupported.length > 0);
  }
  assert.equal(score({ rec: 2 }, normalizeEspnScoring({ scoringItems: "broken" })).points, null);
});

test("describe reports exact custom coefficients, position overrides, and unsupported rules", () => {
  const sleeper = plain(describe({ pass_td: 6, rec: 0.75, bonus_rec_te: 0.5 }));
  assert.equal(sleeper.supported, true);
  assert.match(sleeper.summary, /pass_td × 6/);
  assert.match(sleeper.summary, /rec × 0.75/);
  const summary = describe(espn(item(53, 0.75, { pointsOverrides: { 4: 1.5 } }), item(8, 1)));
  assert.equal(summary.supported, true);
  assert.match(summary.summary, /TE=1.5/);
  assert.match(summary.summary, /replaces base/);
  assert.match(summary.summary, /require numeric ESPN stats/);
  assert.equal(describe({ mystery: 1 }).supported, false);
  assert.equal(describe({}).supported, false);
  assert.equal(describe(espn(item(9999, 1))).supported, false);
});

test("source-provider mismatch, invalid rules and numeric overflow fail closed", () => {
  assert.ok(score({ rec: 1 }, { rec: 1 }, { provider: "yahoo" }).unsupported.includes("provider:yahoo"));
  assert.equal(score({ rec: 1 }, null).points, null);
  assert.equal(score({ rec: 1 }, espn(item(53, 1)), { provider: "sleeper" }).points, null);
  assert.ok(score({ rec: Number.MAX_VALUE }, { rec: Number.MAX_VALUE }).unsupported.includes("non-finite-total"));
});

test("exported metadata is immutable and distinguishes raw yards from ESPN grouped counters", () => {
  assert.equal(sandbox.FFOScoring.espnStatKeys[3], "pass_yd");
  assert.equal(sandbox.FFOScoring.espnStatKeys[8], undefined);
  assert.equal(sandbox.FFOScoring.espnPrimaryPositions[4], "TE");
  assert.equal(sandbox.FFOScoring.espnPrimaryPositions[6], undefined);
  assert.ok(sandbox.FFOScoring.sleeperStatKeys.includes("bonus_rush_rec_yd_100"));
  assert.ok(Object.isFrozen(sandbox.FFOScoring.espnStatKeys));
});

test("sparse standard Sleeper offense cannot establish omitted passing/turnover stats as zero", () => {
  const rules = { pass_yd: 0.04, pass_td: 4, pass_int: -2, rush_yd: 0.1,
    rush_td: 6, rec: 1, rec_yd: 0.1, rec_td: 6, fum_lost: -2 };
  const stats = { rush_yd: 80.5, rush_td: 0.5, rec: 3.2, rec_yd: 25.5, rec_td: 0.2, pts_ppr: 18 };
  const before = JSON.stringify(stats);
  const result = score(stats, rules, { provider: "sleeper", position: "RB", providerSparse: true });
  assert.equal(result.points, null);
  assert.deepEqual(result.missing, ["pass_yd", "pass_td", "pass_int", "fum_lost"]);
  const advisory = plain(sandbox.FFOScoring.projectionAdvisory(stats, rules, { provider: "sleeper", position: "RB" }));
  assert.equal(advisory.supported, true);
  assert.equal(advisory.complete, false);
  assert.equal(advisory.points, null);
  assert.deepEqual(advisory.missing, result.missing);
  assert.match(advisory.summary, /Omitted counters are not verified zero/);
  assert.match(advisory.summary, /not a custom-scoring substitute/);
  assert.equal(JSON.stringify(stats), before);
  assert.ok(score({ ...stats, pass_yd: 0, pass_td: 0, pass_int: 0, fum_lost: 0 }, rules, { position: "RB" }).points > 0);
});

test("projection advisory distinguishes rule support from raw-input coverage", () => {
  const advisory = (stats, rules, options) => plain(sandbox.FFOScoring.projectionAdvisory(stats, rules, options));
  const complete = advisory({ rec: 2 }, { rec: 0.75 }, { position: "WR" });
  assert.equal(complete.complete, true);
  assert.equal(complete.points, 1.5);
  assert.match(complete.summary, /does not verify/);
  const unknown = advisory({ mystery: 1 }, { mystery: 2 });
  assert.equal(unknown.supported, false);
  assert.equal(unknown.complete, false);
  assert.deepEqual(unknown.unsupported, ["mystery"]);
  const bonuses = advisory({ pass_yd: 5000, pts_ppr: 300 }, { pass_yd: 0.04, bonus_pass_yd_300: 3 });
  assert.equal(bonuses.complete, false);
  assert.deepEqual(bonuses.missing, ["bonus_pass_yd_300"]);
  assert.match(bonuses.summary, /bonus counters/);
  assert.equal(advisory({ rec: 2 }, espn(item(53, 0.75)), { provider: "espn" }).points, 1.5);
});
