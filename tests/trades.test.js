const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));

function runtime() {
  const warnings = [];
  const state = {
    activeLeague: { provider: "yahoo", leagueId: "trades", leagueType: 0, totalTeams: 2 },
    week: 8, players: {}, managers: [], dbTrades: [], gameDayByTeam: {}, weakestPosByTeam: {}
  };
  const context = vm.createContext({
    state, console: { warn: (...args) => warnings.push(args) },
    tradeHistoryRequest: 0, tradeHistoryStatus: {}, tradeIdeasCache: { key: "", offers: [] },
    renderTradeDatabase() {}, renderTradeFinder() {},
    fetchJson: async () => [],
    getScoringDecisionIssue: () => "",
    isPickTradingAllowedInLeague: () => state.activeLeague.leagueType !== 0,
    draftEscapeHtml: value => String(value),
    document: { getElementById: () => null },
    isPosEligible: (pos, slot) => pos === slot || slot === "FLEX" && ["RB", "WR", "TE"].includes(pos),
    assignLineupPlayersToSlots: (slots, candidates) => {
      const remaining = candidates.slice();
      return slots.map(slot => {
        const index = remaining.findIndex(({ m }) => m.position === slot);
        return index < 0 ? null : remaining.splice(index, 1)[0];
      });
    },
    getPlannerRosterIds: team => (team.players || []).filter(id =>
      !(team.reserve || []).includes(id) && !(team.taxi || []).includes(id)),
    calcOptimalLineup: ids => {
      const best = {};
      ids.forEach(id => {
        const player = state.players[id];
        if (player && (!best[player.position] || player.seasonPpg > best[player.position].seasonPpg)) best[player.position] = player;
      });
      const slots = state.activeLeague.rosterPositions?.filter(slot => !["BN", "IR", "TAXI"].includes(slot)) || Object.keys(best);
      return { total: Object.values(best).reduce((sum, player) => sum + player.seasonPpg, 0),
        filled: slots.map(slot => best[slot] || null) };
    },
    buildTradeLineupImpact: () => ({ teamA: { delta: 0 }, teamB: { delta: 0 } })
  });
  vm.runInContext(app.slice(app.indexOf("function getTradePackageValues("), app.indexOf("\nfunction generateTargetTradeOffers(")), context);
  vm.runInContext(app.slice(app.indexOf("async function buildTradeDatabase("), app.indexOf("\nfunction renderTradeDatabase(")), context);
  vm.runInContext(app.slice(app.indexOf("function computeLeaguePositionalGrades("), app.indexOf("\nfunction classifyManagerArchetype(")), context);
  const player = (id, value = 1000, position = "WR", ppg = 10) => {
    state.players[id] = { id, name: id, team: "KC", baseValue: value, position, seasonPpg: ppg, projectedPoints: ppg };
    return id;
  };
  state.managers = [
    { rosterId: 1, teamName: "Mine", players: [player("mine")], reserve: [], taxi: [] },
    { rosterId: 2, teamName: "Partner", players: [player("target")], reserve: [], taxi: [] }
  ];
  return { context, state, player, warnings };
}

test("automatic trade offers include extra receiving players and more than two assets", () => {
  const { context, state, player } = runtime();
  state.managers[0].players = Array.from({ length: 6 }, (_, index) => player(`mine${index}`));
  state.managers[1].players = ["target", ...Array.from({ length: 5 }, (_, index) => player(`partner${index}`))];
  const result = context.buildTargetTradeOffers(0, "target");
  assert.ok(result.offers.some(offer => offer.getIds.length > 1));
  assert.ok(result.offers.some(offer => offer.getIds.length > 2 && offer.giveIds.length > 2));
  assert.ok(result.offers.every(offer => offer.getIds.includes("target")));
  assert.ok(result.offers.every(offer =>
    offer.giveIds.every(id => state.managers[0].players.includes(id)) &&
    offer.getIds.every(id => state.managers[1].players.includes(id))));
  assert.ok(result.offers.every(offer => offer.match >= 85));
  assert.ok(result.offers.every(offer =>
    new Set([...offer.giveIds, ...offer.getIds]).size === offer.giveIds.length + offer.getIds.length));
  assert.ok(result.offers.every((offer, index, offers) => !index || offers[index - 1].rankScore >= offer.rankScore));
});

test("automatic trade search supports a one-for-two receiving package", () => {
  const { context, state, player } = runtime();
  state.players.mine.baseValue = 1800;
  state.managers[1].players.push(player("extra"));
  const result = context.buildTargetTradeOffers(0, "target");
  assert.ok(result.offers.some(offer => offer.giveIds.length === 1 && offer.getIds.length === 2));
});

test("explicit sending preferences retain one-target packages and threshold semantics", () => {
  const { context, state, player } = runtime();
  state.managers[0].players.push(player("depth", 50));
  state.managers[1].players.push(player("extra"));
  assert.ok(context.buildTargetTradeOffers(0, "target", "one").offers.every(offer =>
    offer.giveIds.length === 1 && offer.getIds.length === 1));
  assert.ok(context.buildTargetTradeOffers(0, "target", "two").offers.every(offer =>
    offer.giveIds.length === 2 && offer.getIds.length === 1));
  state.players.mine.baseValue = 850;
  assert.equal(context.buildTargetTradeOffers(0, "target", "one").offers[0].match, 85);
  state.players.mine.baseValue = 849;
  assert.equal(context.buildTargetTradeOffers(0, "target", "one").offers.length, 0);
});

test("shared valuation rounds consolidation and caps the tax at eighteen percent", () => {
  const { context, state, player } = runtime();
  state.managers[0].players.push(player("extra", 101));
  assert.equal(context.getTradePackageValues(["mine", "extra"], ["target"]).giveValue, 1035);
  const giveIds = Array.from({ length: 8 }, (_, index) => player(`part${index}`, 100));
  assert.equal(context.getTradePackageValues(giveIds, ["target"]).giveValue, 656);
  assert.equal(context.getTradePackageValues(["target"], giveIds).getValue, 656);
});

test("personal and balanced goals rank different tradeoffs and prefer simpler equivalent deals", () => {
  const { context } = runtime();
  const personal = { giveIds: ["a"], getIds: ["b"], match: 100, rosImpact: { mine: 10, partner: -4 } };
  const balanced = { ...personal, rosImpact: { mine: 4, partner: 4 } };
  assert.ok(context.rankTradeOffer(personal, "mine") > context.rankTradeOffer(balanced, "mine"));
  assert.ok(context.rankTradeOffer(balanced, "balanced") > context.rankTradeOffer(personal, "balanced"));
  const redundant = { ...balanced, giveIds: ["a", "c", "d"], getIds: ["b", "e", "f"] };
  assert.ok(context.rankTradeOffer(balanced, "balanced") > context.rankTradeOffer(redundant, "balanced"));
});

test("bounded package search retains variable sizes without a player-count ceiling", () => {
  const { context, player } = runtime();
  const ids = Array.from({ length: 30 }, (_, index) => player(`p${index}`, 1000 + index * 100));
  const packages = context.buildTradePlayerPackages(ids, ids[0]);
  assert.ok(packages.length <= 256);
  assert.ok(packages.some(ids => ids.length > 3));
  assert.ok(packages.every(ids => ids.includes("p0") && new Set(ids).size === ids.length));
  assert.deepEqual(plain(packages), plain(context.buildTradePlayerPackages(ids, ids[0])));
});

test("generated database ideas use actual rosters, include same-position swaps and invalidate on data changes", () => {
  const { context, state, player } = runtime();
  state.players.target.seasonPpg = 20;
  state.managers[1].players.push(player("partner_depth", 100, "WR", 25));
  player("free_agent");
  const offers = context.getGeneratedTradeIdeas(0, "balanced");
  assert.ok(offers.length > 0);
  assert.ok(offers.every(offer => ![...offer.aIds, ...offer.bIds].includes("free_agent")));
  assert.equal(offers[0].aIds[0], "mine");
  assert.equal(offers[0].bIds[0], "target");
  assert.equal(context.getGeneratedTradeIdeas(0, "balanced"), offers);
  state.players.target.baseValue = 10000;
  assert.equal(context.getGeneratedTradeIdeas(0, "balanced").length, 0);
});

test("database ideas reject neutral exchanges and balanced losses but personal ideas disclose tradeoffs", () => {
  const { context, state, player } = runtime();
  assert.equal(context.getGeneratedTradeIdeas(0, "balanced").length, 0);
  state.players.target.seasonPpg = 20;
  assert.equal(context.getGeneratedTradeIdeas(0, "balanced").length, 0);
  const personal = context.getGeneratedTradeIdeas(0, "mine");
  assert.ok(personal.length > 0);
  assert.ok(personal.every(offer => offer.rosImpact.mine > 0.05));
  assert.ok(personal.some(offer => offer.rosImpact.partner < -0.05));
  state.managers[1].players.push(player("depth", 100, "WR", 25));
  assert.ok(context.getGeneratedTradeIdeas(0, "balanced").length > 0);
});

test("trade review warns about required drops, inactive transfers and lost starter coverage", () => {
  const { context, state, player } = runtime();
  state.activeLeague.rosterPositions = ["WR", "RB", "BN"];
  state.managers[0].players.push(player("rb", 1000, "RB"), player("bench", 1000, "WR"));
  state.managers[1].players.push(player("incoming", 1000, "WR"));
  let review = context.getTradeRosterReview(...state.managers, ["rb"], ["target", "incoming"]);
  assert.ok(review.warnings.some(warning => warning.includes("drop or reassign at least 1")));
  assert.ok(review.warnings.some(warning => warning.includes("loses coverage of 1")));
  state.managers[1].taxi = ["incoming"];
  review = context.getTradeRosterReview(...state.managers, ["rb"], ["target", "incoming"]);
  assert.ok(review.warnings.some(warning => warning.includes("receives IR/taxi")));
});

test("picks do not consume roster spots and ownership and values are checked before scoring", () => {
  const { context, state, player } = runtime();
  state.activeLeague.rosterPositions = ["WR"];
  state.activeLeague.leagueType = 1;
  const pick = player("PICK_2027_1");
  state.players[pick].isPick = true;
  state.managers[1].ownedPicks = [{ id: pick }];
  const review = context.getTradeRosterReview(...state.managers, ["mine"], ["target", pick]);
  assert.equal(review.reason, undefined);
  assert.ok(!review.warnings.some(warning => warning.includes("extra player") || warning.includes("drop or reassign")));
  state.activeLeague.leagueType = 0;
  assert.match(context.getTradeRosterReview(...state.managers, ["mine"], ["target", pick]).reason, /Draft-pick trading/);
  state.players.mine.baseValue = NaN;
  assert.match(context.getTradeRosterReview(...state.managers, ["mine"], ["target"]).reason, /value is missing/);
});

test("missing projections prevent ROS benefit claims even with usable season PPG", () => {
  const { context, state } = runtime();
  state.players.mine.projectedPoints = undefined;
  const result = context.buildTargetTradeOffers(0, "target");
  assert.equal(result.offers[0].rosImpact, null);
  assert.match(result.scoringIssue, /value-only/);
});

test("needs grades ignore inactive assets, respect actual starter positions and give ties the same rank", () => {
  const { context, state, player } = runtime();
  state.activeLeague.rosterPositions = ["WR", "BN"];
  state.managers[0].players.push(player("reserve", 9000, "WR", 40));
  state.managers[0].reserve = ["reserve"];
  const mine = context.computeLeaguePositionalGrades(0);
  const partner = context.computeLeaguePositionalGrades(1);
  assert.deepEqual(Object.keys(mine.myGrades), ["WR", "DEPTH"]);
  assert.equal(mine.myGrades.WR.rank, partner.myGrades.WR.rank);
  assert.equal(mine.weakestPos, "WR");
  assert.deepEqual(plain(mine.myGrades.WR.topPlayers.map(player => player.id)), ["mine"]);
  state.activeLeague.rosterPositions = ["K", "DEF"];
  assert.equal(context.computeLeaguePositionalGrades(0).weakestPos, "ALL");
});

test("multi-team history is excluded and mixed trades label the omitted pick legs", async () => {
  const { context, state } = runtime();
  state.activeLeague.provider = "sleeper";
  context.fetchJson = async url => url.endsWith("/transactions/8") ? [
    { type: "trade", status: "complete", roster_ids: [1, 2, 3], adds: { mine: 2, target: 1 } },
    { type: "trade", status: "complete", roster_ids: [1, 2], adds: { mine: 2, target: 1 }, draft_picks: [{ round: 1 }] }
  ] : [];
  await context.buildTradeDatabase();
  assert.equal(state.dbTrades.length, 1);
  assert.match(state.dbTrades[0].format, /Player legs only; picks omitted/);
  assert.match(context.tradeHistoryStatus.coverage, /multi-team trades are excluded/);
});

test("incomplete scoring withholds ROS rankings, not model-value comparisons", () => {
  const { context } = runtime();
  context.getScoringDecisionIssue = () => "Missing scoring counter";
  context.buildTradeLineupImpact = () => ({ reason: "Missing scoring counter" });
  const result = context.buildTargetTradeOffers(0, "target");
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].rosImpact, null);
  assert.equal(result.scoringIssue, "Missing scoring counter");
  assert.equal(context.getGeneratedTradeIdeas(0, "balanced").length, 1);
});

test("review ownership guards reject duplicated assets and assets transferred under incomplete scoring", () => {
  const { context, state } = runtime();
  const offer = context.buildTargetTradeOffers(0, "target").offers[0];
  assert.equal(context.isTradeOfferOwned(offer), true);
  assert.equal(context.isTradeOfferOwned({ ...offer, giveIds: ["mine", "mine"] }), false);
  context.getScoringDecisionIssue = () => "Missing scoring counter";
  state.managers[1].players = [];
  state.managers.push({ rosterId: 3, players: ["target"] });
  assert.equal(context.isTradeOfferOwned(offer), false);
});

test("ambiguous ownership excludes collateral assets and reserve transfers stay out of modeled lineups", () => {
  const { context, state, player } = runtime();
  state.managers[0].players.push(player("reserve"));
  state.managers[0].reserve = ["reserve"];
  state.managers.push({ rosterId: 3, players: ["reserve"] });
  assert.ok(context.buildTargetTradeOffers(0, "target").offers.every(offer => !offer.giveIds.includes("reserve")));
  state.managers.pop();
  state.managers[0].players = ["reserve"];
  const offer = context.buildTargetTradeOffers(0, "target", "one").offers[0];
  assert.equal(offer.giveIds[0], "reserve");
  assert.equal(offer.rosImpact.partner, -10);
});

test("history failures are visible while successful weeks preserve actual sending managers", async () => {
  const { context, state, warnings } = runtime();
  state.activeLeague.provider = "sleeper";
  context.fetchJson = async url => {
    if (url.endsWith("/transactions/7")) throw new Error("Provider unavailable");
    if (url.endsWith("/transactions/8")) return [{
      type: "trade", status: "complete", roster_ids: [1, 2], adds: { mine: 2, target: 1 }
    }];
    return [];
  };
  await context.buildTradeDatabase();
  assert.equal(state.dbTrades.length, 1);
  assert.deepEqual(plain(state.dbTrades[0].aIds), ["mine"]);
  assert.deepEqual(plain(state.dbTrades[0].bIds), ["target"]);
  assert.equal(state.dbTrades[0].rosterA, 1);
  assert.equal(state.dbTrades[0].rosterB, 2);
  assert.equal(context.tradeHistoryStatus.loading, false);
  assert.match(context.tradeHistoryStatus.errors[0], /Week 7: Provider unavailable/);
  assert.equal(warnings.length, 1);
  context.getScoringDecisionIssue = () => "Missing scoring counter";
  assert.ok(context.getGeneratedTradeIdeas(0, "balanced").length > 0);
});

test("malformed history responses and unsupported providers have explicit coverage", async () => {
  const { context, state } = runtime();
  await context.buildTradeDatabase();
  assert.match(context.tradeHistoryStatus.coverage, /not available/);
  state.activeLeague.provider = "sleeper";
  context.fetchJson = async url => url.includes("/transactions/") ? {} : [];
  await context.buildTradeDatabase();
  assert.equal(context.tradeHistoryStatus.errors.length, 8);
  assert.equal(state.dbTrades.length, 0);
});

test("an old league history request cannot overwrite a newer league", async () => {
  const { context, state } = runtime();
  state.activeLeague.provider = "sleeper";
  const pending = [];
  context.fetchJson = () => new Promise(resolve => pending.push(resolve));
  const first = context.buildTradeDatabase();
  state.activeLeague = { ...state.activeLeague, provider: "yahoo", leagueId: "new" };
  await context.buildTradeDatabase();
  pending.forEach(resolve => resolve([{ type: "trade", status: "complete", roster_ids: [1, 2], adds: { mine: 2, target: 1 } }]));
  await first;
  assert.equal(state.dbTrades.length, 0);
  assert.ok(context.tradeHistoryStatus.key.includes("new"));
});
