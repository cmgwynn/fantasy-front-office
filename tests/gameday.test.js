const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

async function load({ provider = "sleeper", projections, projectionError, rules, injury = "", gameState = "pre", live = {}, espnProjection = 14, espnWeek = 9 } = {}) {
  const errors = [];
  const sandbox = {
    URL, URLSearchParams, location: { search: "?resume=0" },
    window: { FFOUsage: { isAllowed: () => true } },
    document: { addEventListener() {}, dispatchEvent() {}, getElementById: () => null },
    navigator: {}, setInterval() {}, CustomEvent: class {},
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
      if (projectionError) throw new Error("Feed failed");
      return projections || { a: { rush_yd: 80, rec: 2 }, b: { rush_yd: 60, rec: 1, pass_yd: 0 } };
    },
    fetchJson: async url => {
      url = String(url);
      if (url.endsWith("/state/nfl")) return { season: "2026", display_week: 9, season_type: "regular" };
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
        status: { currentMatchupPeriod: 9 },
        schedule: [{ id: 1, matchupPeriodId: 9, home: { teamId: 1 }, away: { teamId: 2 } }],
        settings: {}
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
  assert.equal(gameday.freshness.error, "");
  const league = gameday.data.leagues[0];
  assert.equal(league.error, undefined);
  return { gameday, league, errors, html: gameday.renderGamedayHtml(gameday.data) };
}

test("sparse Sleeper inputs identify the player and exact missing counters without inventing totals", async () => {
  const { league, html } = await load();
  assert.equal(league.me.projected, null);
  assert.equal(league.opp.projected, 7);
  assert.equal(league.me.points, 11);
  assert.equal(league.me.toPlay, 1);
  assert.equal(league.winPct, null);
  assert.match(league.me.players[0].projectionIssue, /Missing scoring inputs: pass_yd/);
  assert.match(html, /Starter &lt;A&gt;<\/strong>: Missing scoring inputs: pass_yd/);
  assert.match(html, /projected final unavailable \(1 starter\)/);
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
  assert.match(html, /Custom scoring differences are not included/);
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
