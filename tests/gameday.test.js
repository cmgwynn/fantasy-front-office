const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

async function load({ provider = "sleeper", projections, projectionError, rules, injury = "", gameState = "pre", live = {}, espnProjection = 14, espnWeek = 9, allowFailure = false } = {}) {
  const errors = [];
  const requests = [];
  const timers = [];
  const clock = { now: Date.now() };
  class TestDate extends Date {
    static now() { return clock.now; }
  }
  const sandbox = {
    URL, URLSearchParams, Date: TestDate, location: { search: "?resume=0" },
    window: { FFOUsage: { isAllowed: () => true } },
    document: {
      addEventListener() {}, dispatchEvent() {}, getElementById: () => null
    },
    navigator: {}, setInterval(callback, ms) { timers.push({ callback, ms }); }, CustomEvent: class {},
    console: { error: (...args) => errors.push(args) },
    requestConnectedBetaAccess: async () => true,
    state: {
      players: {
        a: { name: "Starter <A>", team: "KC", position: "RB", injuryStatus: injury },
        b: { name: "Starter B", team: "BUF", position: "RB" }
      },
      portfolioRosterSelections: {}
    },
    ESPN_POSITION_CODES: { 2: "RB" }, ESPN_TEAM_CODES: { 12: "KC", 2: "BUF" },
    fetchSleeperWeekProjections: async () => {
      requests.push(`projections:${live.season || "2026"}:${live.week || 9}`);
      if (projectionError || live.fail === "projections") throw new Error("Feed failed");
      return projections || { a: { rush_yd: 80, rec: 2 }, b: { rush_yd: 60, rec: 1, pass_yd: 0 } };
    },
    fetchJson: async url => {
      url = String(url);
      requests.push(url);
      if (live.fail && url.includes(live.fail)) throw new Error(`Provider unavailable: ${live.fail}`);
      if (url.endsWith("/state/nfl")) return { season: live.season || "2026", display_week: live.week || 9, season_type: "regular" };
      if (url.includes("/scoreboard") && live.invalidBoard) return { error: "No scoreboard" };
      if (url.includes("/scoreboard")) return {
        events: [{
          id: "game", date: "2026-11-09T20:00:00Z",
          competitions: [{
            status: { type: { state: live.state || gameState, shortDetail: gameState === "post" ? "Final" : "" }, period: live.period || 0, clock: live.clock || 0 },
            competitors: [
              { homeAway: "home", team: { id: "12", abbreviation: "KC" } },
              { homeAway: "away", team: { id: "2", abbreviation: "BUF" } }
            ]
          }]
        }]
      };
      if (url.includes("lm-api-reads")) return {
        teams: [1, 2].map((id, index) => ({
          id, name: `ESPN Team ${id}`,
          roster: { entries: [{ lineupSlotId: 2, playerPoolEntry: { player: {
            id, defaultPositionId: 2, proTeamId: index ? 2 : 12, fullName: `ESPN Starter ${id}`,
            stats: [
              { scoringPeriodId: 9, statSourceId: 0, appliedTotal: index ? 3 : 2 },
              { scoringPeriodId: index ? 9 : espnWeek, statSourceId: 1, appliedTotal: index ? 12 : espnProjection }
            ]
          } } }] }
        })),
        status: { currentMatchupPeriod: live.espnCurrentPeriod || 9 },
        schedule: [
          { id: 1, matchupPeriodId: 9, home: { teamId: 1 }, away: { teamId: 2 } },
          { id: 2, matchupPeriodId: 10, home: { teamId: 2 }, away: { teamId: 1 } },
          { id: 3, matchupPeriodId: 15, home: { teamId: 1 }, away: { teamId: 2 } }
        ],
        settings: { scheduleSettings: { matchupPeriods: { 9: [9], 10: [10], 15: [15, 16] } } }
      };
      if (url.includes("/user/")) return [{
        league_id: "league", name: "Sleeper test", status: "in_season", roster_positions: ["RB"],
        scoring_settings: rules || { rush_yd: 0.1, rec: 1, pass_yd: 0.04 }
      }];
      if (url.endsWith("/rosters")) return [
        { roster_id: 1, owner_id: "user", starters: ["a"] },
        { roster_id: 2, owner_id: "opponent", starters: ["b"] }
      ];
      if (url.endsWith("/users")) return [];
      if (url.includes("/matchups/")) return [
        { roster_id: 1, matchup_id: 1, starters: ["a"], points: live.points ?? 11, players_points: { a: live.points ?? 11 } },
        { roster_id: 2, matchup_id: 1, starters: ["b"], points: 4, players_points: { b: 4 } }
      ];
      throw new Error(`Unexpected request: ${url}`);
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(read("scoring.js"), sandbox);
  sandbox.FFOScoring = sandbox.window.FFOScoring;
  const app = read("app.js");
  vm.runInContext(app.slice(app.indexOf("function scoreConfiguredStats("), app.indexOf("\nfunction scoreLeagueStatLine(")), sandbox);
  vm.runInContext(app.slice(app.indexOf("function getSleeperBaselineProjection("), app.indexOf("\nfunction renderOptimizerDifference(")), sandbox);
  vm.runInContext(read("gameday.js"), sandbox);
  const gameday = sandbox.window.FFOGameday;
  gameday.rememberSource(provider === "sleeper"
    ? { type: "sleeper", userId: "user" }
    : { type: "espn", leagueId: "league", teamId: "1" });
  await gameday.ensureData();
  if (!allowFailure) assert.equal(gameday.freshness.error, "");
  const league = gameday.data?.leagues[0];
  if (!allowFailure) assert.equal(league.error, undefined);
  return { gameday, league, errors, requests, clock, timers, sandbox, html: gameday.data ? gameday.renderGamedayHtml(gameday.data) : "" };
}

test("sparse Sleeper inputs identify the player and exact missing counters without inventing totals", async () => {
  const { league, html } = await load();
  assert.equal(league.me.projected, null);
  assert.equal(league.opp.projected, 7);
  assert.equal(league.me.points, 11);
  assert.equal(league.me.toPlay, 1);
  assert.equal(league.winPct, null);
  assert.match(league.me.players[0].projectionIssue, /Missing scoring inputs: pass_yd/);
  assert.match(html, /Starter &lt;A&gt;/);
  assert.match(html, /title="Missing scoring inputs: pass_yd"/);
  assert.doesNotMatch(html, /gd-projection-issues/);
  assert.match(html, /win probability requires projected totals for both teams/);
  assert.match(html, /proj 7\.0/);
  assert.doesNotMatch(html, /class="gd-win"/);
  assert.doesNotMatch(html, /Starter <A>/);
});

test("Sleeper baseline estimates restore totals and label team, player and win percentage", async () => {
  const { league, html, gameday } = await load({ projections: {
    a: { rush_yd: 80, pts_ppr: 18 },
    b: { rush_yd: 60, rec: 1, pass_yd: 0, pts_ppr: 99 }
  } });
  assert.equal(league.me.projected, 18);
  assert.equal(league.opp.projected, 7);
  assert.equal(league.me.projectionEstimated, true);
  assert.equal(league.opp.projectionEstimated, false);
  assert.ok(Number.isFinite(league.winPct));
  assert.match(html, /est 18\.0/);
  assert.match(html, /PPR est 18\.0/);
  assert.match(html, /FFO model · baseline estimate/);
  assert.doesNotMatch(html, /gd-projection-issues|projected final uses baseline estimates|Custom scoring differences are not included/);
  assert.match(html, /Missing scoring inputs: rec, pass_yd/);
  assert.equal(gameday.scoreSleeperProjection({ pts_ppr: 18 }, { rush_yd: 0.1 }, "RB"), null);
});

test("baseline selection matches reception settings and never invents or replaces zero/negative totals", async () => {
  for (const [rec, expected, basis] of [[0, -2, "STD"], [0.5, 0, "½ PPR"], [1, 18, "PPR"], [0.75, 18, "PPR"]]) {
    const { league } = await load({
      rules: { rec, rush_yd: 0.1 },
      projections: { a: { pts_std: -2, pts_half_ppr: 0, pts_ppr: 18 } }
    });
    assert.equal(league.me.projected, expected);
    assert.equal(league.me.players[0].projectionBaseline, basis);
  }
  for (const value of [undefined, null, "", "18", NaN, Infinity]) {
    const { league } = await load({ projections: { a: { pts_ppr: value } } });
    assert.equal(league.me.projected, null);
    assert.equal(league.winPct, null);
  }
});

test("refresh dynamically recalculates live baseline finals and odds from points and game time", async () => {
  const live = { state: "in", period: 1, clock: 900, points: 2 };
  const { gameday, league } = await load({
    live, projections: { a: { pts_ppr: 20 }, b: { rush_yd: 60, rec: 1, pass_yd: 0 } }
  });
  assert.equal(league.me.projected, 22);
  assert.ok(Number.isFinite(league.winPct));
  const firstOdds = league.winPct;
  live.period = 3;
  live.clock = 900;
  live.points = 8;
  await gameday.refresh({ force: true });
  const updated = gameday.data.leagues[0];
  assert.equal(updated.me.projected, 18);
  assert.notEqual(updated.winPct, firstOdds);
  assert.match(gameday.renderGamedayHtml(gameday.data), /est 18\.0/);
  live.state = "post";
  live.points = 15;
  await gameday.refresh({ force: true });
  const final = gameday.data.leagues[0];
  assert.equal(final.me.projected, 15);
  assert.equal(final.me.projectionEstimated, false);
  assert.equal(final.winPct, 100);
  assert.doesNotMatch(gameday.renderGamedayHtml(gameday.data), /baseline estimate/);
});

test("complete Sleeper inputs preserve explicit zero and negative totals and produce win percentages", async () => {
  const { league, html } = await load({ projections: {
    a: { rush_yd: -10, rec: 0, pass_yd: 0 },
    b: { rush_yd: 0, rec: 0, pass_yd: 0 }
  } });
  assert.equal(league.me.projected, -1);
  assert.equal(league.opp.projected, 0);
  assert.ok(Number.isFinite(league.winPct));
  assert.match(html, /class="gd-win"/);
  assert.doesNotMatch(html, /projected final unavailable/);
});

test("finished and known inactive starters do not block totals for missing projections", async () => {
  const finished = await load({ gameState: "post", projections: {} });
  assert.equal(finished.league.me.projected, 11);
  assert.equal(finished.league.opp.projected, 4);
  assert.equal(finished.league.winPct, 100);
  assert.doesNotMatch(finished.html, /projected final unavailable/);
  const inactive = await load({ injury: "Out" });
  assert.notEqual(inactive.league.me.projected, null);
  assert.ok(Number.isFinite(inactive.league.winPct));
  assert.doesNotMatch(inactive.html, /projected final unavailable/);
});

test("missing player rows, unsupported rules and feed failures have distinct diagnostics", async () => {
  const missing = await load({ projections: {} });
  assert.match(missing.html, /No weekly player projection supplied/);
  const unsupported = await load({ rules: { mystery: 2 } });
  assert.equal(unsupported.league.me.projected, null);
  assert.match(unsupported.html, /Unsupported scoring rules: mystery/);
  const failed = await load({ projectionError: true });
  assert.equal(failed.league.winPct, null);
  assert.equal(failed.errors.length, 1);
  assert.match(failed.html, /Weekly projections could not be loaded\. Refresh Gameday to retry/);
  assert.doesNotMatch(failed.html, /No weekly player projection supplied/);
});

test("ESPN uses league-applied projections without requiring Sleeper coverage", async () => {
  const { league, html } = await load({ provider: "espn", projections: {} });
  assert.equal(league.me.projected, 14);
  assert.equal(league.opp.projected, 12);
  assert.ok(Number.isFinite(league.winPct));
  assert.match(html, /class="gd-win"/);
  assert.doesNotMatch(html, /projected final unavailable/);
  const zero = await load({ provider: "espn", espnProjection: 0 });
  assert.equal(zero.league.me.projected, 0);
});

test("ESPN missing and wrong-week applied totals remain unavailable with a provider-specific reason", async () => {
  for (const options of [{ espnProjection: null }, { espnWeek: 8 }]) {
    const { league, html } = await load({ provider: "espn", ...options });
    assert.equal(league.me.projected, null);
    assert.equal(league.opp.projected, 12);
    assert.equal(league.winPct, null);
    assert.match(html, /ESPN did not supply a league-scored projection for Week 9/);
  }
});

test("scoreboard outages keep the last snapshot explicitly stale and recover without false final scores", async () => {
  const live = { state: "in", period: 2, clock: 0 };
  const { gameday, clock } = await load({ live, projections: { a: { pts_ppr: 20 }, b: { pts_ppr: 10 } } });
  const previous = gameday.data;
  const checkedAt = gameday.freshness.checkedAt;
  live.fail = "/scoreboard";
  clock.now += 60000;
  await gameday.refresh({ force: true });
  assert.equal(gameday.data, previous);
  assert.equal(gameday.freshness.checkedAt, checkedAt);
  assert.match(gameday.freshness.error, /Scores may be stale.*Provider unavailable/);
  assert.match(gameday.renderGamedayHtml(gameday.data), /role="alert">Scores may be stale/);
  assert.equal(gameday.data.leagues[0].me.players[0].gameState, "in");
  delete live.fail;
  await gameday.refresh({ force: true });
  assert.equal(gameday.freshness.error, "");
  assert.doesNotMatch(gameday.renderGamedayHtml(gameday.data), /Scores may be stale/);
  assert.ok(gameday.freshness.checkedAt > checkedAt);
});

test("invalid scoreboard responses and first-load outages are explicit failures", async () => {
  const invalid = await load({ live: { invalidBoard: true }, allowFailure: true });
  assert.equal(invalid.gameday.data, null);
  assert.match(invalid.gameday.freshness.error, /scoreboard/i);
  for (const fail of ["/scoreboard", "/state/nfl"]) {
    const failed = await load({ live: { fail }, allowFailure: true });
    assert.equal(failed.gameday.data, null);
    assert.match(failed.gameday.freshness.error, /Could not load Gameday/);
  }
});

test("projection outages preserve actuals but withhold live predictions, then recover", async () => {
  const live = { state: "in", period: 2, clock: 0 };
  const { gameday } = await load({ live, projections: { a: { pts_ppr: 20 }, b: { pts_ppr: 10 } } });
  live.fail = "projections";
  await gameday.refresh({ force: true });
  assert.equal(gameday.data.leagues[0].me.points, 11);
  assert.equal(gameday.data.leagues[0].me.projected, null);
  assert.equal(gameday.data.leagues[0].winPct, null);
  assert.match(gameday.renderGamedayHtml(gameday.data), /Weekly projections could not be loaded/);
  delete live.fail;
  await gameday.refresh({ force: true });
  assert.equal(gameday.data.leagues[0].me.projected, 21);
  assert.ok(Number.isFinite(gameday.data.leagues[0].winPct));
});

test("ESPN and Sleeper league outages show errors and recover without reconnecting", async () => {
  for (const [provider, endpoint] of [["espn", "lm-api-reads"], ["sleeper", "/matchups/"]]) {
    const live = {};
    const { gameday } = await load({ provider, live });
    live.fail = endpoint;
    await gameday.refresh({ force: true });
    const failed = gameday.data.leagues[0];
    assert.match(failed.error, /Provider unavailable/);
    assert.equal(failed.me, undefined);
    assert.match(gameday.renderGamedayHtml(gameday.data), /gd-error/);
    delete live.fail;
    await gameday.refresh({ force: true });
    assert.equal(gameday.data.leagues[0].error, undefined);
    assert.ok(gameday.data.leagues[0].me);
  }
});

test("halftime, overtime, final and stat corrections recalculate from the same baseline", async () => {
  const live = { state: "in", period: 2, clock: 0, points: 10 };
  const { gameday } = await load({ live, projections: { a: { pts_ppr: 20 }, b: { pts_ppr: 10 } } });
  assert.equal(gameday.data.leagues[0].me.projected, 20);
  live.period = 3;
  live.clock = 900;
  await gameday.refresh({ force: true });
  assert.equal(gameday.data.leagues[0].me.projected, 20);
  live.period = 5;
  live.clock = 300;
  live.points = 18;
  await gameday.refresh({ force: true });
  assert.equal(gameday.data.leagues[0].me.projected, 18.6);
  assert.ok(Number.isFinite(gameday.data.leagues[0].winPct));
  live.state = "post";
  live.points = 19;
  await gameday.refresh({ force: true });
  assert.equal(gameday.data.leagues[0].me.projected, 19);
  assert.equal(gameday.data.leagues[0].me.variance, 0);
  assert.equal(gameday.data.leagues[0].winPct, 100);
  live.points = 4;
  await gameday.refresh({ force: true });
  assert.equal(gameday.data.leagues[0].me.projected, 4);
  assert.equal(gameday.data.leagues[0].winPct, 50);
  live.points = 3;
  await gameday.refresh({ force: true });
  assert.equal(gameday.data.leagues[0].winPct, 0);
});

test("automatic refresh advances the week within a minute and manual refresh advances the season immediately", async () => {
  const live = {};
  const { gameday, clock, requests } = await load({ live });
  live.week = 10;
  clock.now += 60001;
  await gameday.refresh();
  assert.equal(gameday.data.week, 10);
  assert.ok(requests.some(url => url.includes("/matchups/10")));
  assert.ok(requests.includes("projections:2026:10"));
  live.season = "2027";
  live.week = 1;
  await gameday.refresh({ force: true });
  assert.equal(gameday.data.season, "2027");
  assert.equal(gameday.data.week, 1);
  assert.ok(requests.some(url => url.includes("/leagues/nfl/2027")));
  assert.ok(requests.includes("projections:2027:1"));
});

test("ESPN chooses the requested week's matchup even when the provider current period lags", async () => {
  const live = { week: 10, espnCurrentPeriod: 9 };
  const { league } = await load({ provider: "espn", live });
  assert.equal(league.me.matchupId, "2");
  const playoffs = await load({ provider: "espn", live: { week: 16, espnCurrentPeriod: 9 } });
  assert.equal(playoffs.league.me.matchupId, "3");
});

test("one provider can fail and recover while the other provider stays available", async () => {
  const live = {};
  const { gameday } = await load({ live });
  gameday.rememberSource({ type: "espn", leagueId: "league", teamId: "1" });
  live.fail = "lm-api-reads";
  await gameday.refresh({ force: true });
  assert.equal(gameday.data.leagues.length, 2);
  assert.ok(gameday.data.leagues.find(league => league.provider === "sleeper").me);
  assert.match(gameday.data.leagues.find(league => league.provider === "espn").error, /Provider unavailable/);
  delete live.fail;
  await gameday.refresh({ force: true });
  assert.ok(gameday.data.leagues.every(league => league.me && !league.error));
});

test("the active Gameday timer retries first-load failures and rolls over even without live games", async () => {
  const live = { fail: "/scoreboard" };
  const { gameday, sandbox, timers, clock, requests } = await load({ live, allowFailure: true });
  sandbox.document.getElementById = id => id === "tab-intel" ? { classList: { contains: () => true } } : null;
  gameday.activate();
  await gameday.ensureData();
  delete live.fail;
  const timer = timers.find(timer => timer.ms === 15000);
  assert.ok(timer);
  clock.now += 60001;
  await timer.callback();
  assert.equal(gameday.freshness.error, "");
  assert.equal(gameday.data.week, 9);
  live.week = 10;
  clock.now += 60001;
  await timer.callback();
  assert.equal(gameday.data.week, 10);
  assert.ok(requests.some(url => url.includes("/matchups/10")));
});
