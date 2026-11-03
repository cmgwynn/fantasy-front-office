(function (root) {
  "use strict";

  /*
   * Integration: load before app.js. Store normalizeEspnScoring(settings.scoringSettings)
   * as league.scoringSettings; retain Sleeper's scoring_settings unchanged. Call
   * scoreStatLine(rawStats, rules, { provider, position: player.position }).
   * Only use points when non-null; surface unsupported/missing rather than falling
   * back to a PPR preset. position is a primary position, NEVER an ESPN lineup slot.
   * A legacy number|null wrapper can simply return scoreStatLine(...).points.
   * Pass position through gameday.js's scoreSleeperProjection as well; do not
   * clamp the result, and do not coerce null to an allegedly verified zero.
   *
   * Verified public references (2026-11-02):
   * https://github.com/cwendt94/espn-api/blob/master/espn_api/football/constant.py
   * https://github.com/ffverse/ffscrapr/blob/main/R/espn__helpers.R
   * https://github.com/ffverse/ffscrapr/blob/main/R/espn_scoring.R
   * https://docs.sleeper.com/#leagues
   * https://github.com/ecortesg/fantasy-score-gap/blob/master/src/data/fields_data.js
   * https://github.com/dtsong/sleeper-api-wrapper/blob/master/docs/stats.md
   *
   * Sleeper's public API documentation does not define a missing-as-zero
   * projection contract; the wrapper explicitly calls stats/projections
   * undocumented/unsupported. A sparse response alone cannot establish that an
   * omitted counter means zero rather than unavailable. projectionAdvisory()
   * explains coverage without enabling unsafe zero filling or preset fallback.
   *
   * Event/threshold counters must be explicit observations, including explicit zero.
   * Never infer game counts, distance buckets, or yardage-allowed tiers from
   * aggregate/average projections. Missing inputs are not assumed to be zero.
   */
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const number = value => (typeof value === "number" || (typeof value === "string" && value.trim() !== ""))
    && Number.isFinite(Number(value)) ? Number(value) : null;
  const unique = values => [...new Set(values)];
  const offense = ["QB", "RB", "WR", "TE", "FB"];
  const idp = ["DT", "DE", "DL", "LB", "CB", "S", "DB", "IDP"];
  const defense = ["DEF", ...idp];
  const positions = Object.freeze({
    1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 7: "P",
    9: "DT", 10: "DE", 11: "LB", 12: "CB", 13: "S", 14: "HC", 16: "DEF"
  });
  const sleeper = Object.create(null);
  function register(keys, allowed) {
    keys.split(" ").forEach(key => { sleeper[key] = { key, positions: allowed || null }; });
  }
  register("pass_att pass_cmp pass_inc pass_yd pass_td pass_int pass_int_td pass_2pt pass_sack pass_fd pass_cmp_40p pass_yd_40p pass_td_40p pass_td_50p", offense);
  register("rush_att rush_yd rush_td rush_2pt rush_fd rush_40p rush_td_40p rush_td_50p", offense);
  register("rec rec_tgt rec_yd rec_td rec_2pt rec_fd rec_ypt rec_0_4 rec_5_9 rec_10_19 rec_20_29 rec_30_39 rec_40p rec_td_40p rec_td_50p", offense);
  register("fum fum_lost fum_rec fum_rec_td");
  register("bonus_pass_yd_300 bonus_pass_yd_400 bonus_pass_cmp_25 bonus_rush_att_20 bonus_rush_yd_100 bonus_rush_yd_200 bonus_rec_yd_100 bonus_rec_yd_200 bonus_rush_rec_yd_100 bonus_rush_rec_yd_200", offense);
  register("fgm fga fgmiss fgm_0_19 fgm_20_29 fgm_30_39 fgm_40_49 fgm_50p fgm_50_59 fgm_60p fgmiss_0_19 fgmiss_20_29 fgmiss_30_39 fgmiss_40_49 fgmiss_50p fgmiss_50_59 fgmiss_60p fgm_yds fgm_yds_over_30 xpm xpa xpmiss", ["K"]);
  register("sack sack_yd int int_ret_yd ff fum_ret_yd safe tkl tkl_solo tkl_ast tkl_loss qb_hit pass_def blk_kick def_td def_st_td def_st_ff def_st_fum_rec def_st_tkl def_st_tkl_solo def_2pt def_3_and_out def_4_and_stop def_forced_punts def_pass_def fg_ret_yd blk_kick_ret_yd def_pr_yd def_kr_yd", defense);
  register("pts_allow pts_allow_0 pts_allow_1_6 pts_allow_7_13 pts_allow_14_20 pts_allow_21_27 pts_allow_28_34 pts_allow_35p yds_allow yds_allow_0_100 yds_allow_100_199 yds_allow_200_299 yds_allow_300_349 yds_allow_350_399 yds_allow_400_449 yds_allow_450_499 yds_allow_500_549 yds_allow_550p", ["DEF"]);
  register("st_td st_ff st_fum_rec st_tkl st_tkl_solo kr_yd pr_yd kr_td pr_td");
  register("idp_tkl idp_tkl_solo idp_tkl_ast idp_tkl_loss idp_sack idp_sack_yd idp_qb_hit idp_int idp_int_ret_yd idp_ff idp_fum_rec idp_fum_ret_yd idp_def_td idp_pass_def idp_blk_kick idp_safe bonus_tkl_10p bonus_sack_2p idp_pass_def_3p bonus_def_int_td_50p bonus_def_fum_td_50p", idp);
  ["rb", "wr", "te", "qb"].forEach(pos => register(`bonus_fd_${pos}`, [pos.toUpperCase()]));
  ["rb", "wr", "te"].forEach(pos => {
    sleeper[`bonus_rec_${pos}`] = { key: "rec", positions: [pos.toUpperCase()], premium: true };
  });
  Object.values(sleeper).forEach(Object.freeze);
  Object.freeze(sleeper);

  // Only equivalent cross-provider counters are aliased. In particular, ESPN's
  // "every N yards" counters and per-game averages are NOT raw yardage aliases.
  const espnKeys = Object.freeze({
    0: "pass_att", 1: "pass_cmp", 2: "pass_inc", 3: "pass_yd", 4: "pass_td",
    15: "pass_td_40p", 16: "pass_td_50p", 19: "pass_2pt", 20: "pass_int",
    23: "rush_att", 24: "rush_yd", 25: "rush_td", 26: "rush_2pt",
    35: "rush_td_40p", 36: "rush_td_50p", 41: "rec", 42: "rec_yd",
    43: "rec_td", 44: "rec_2pt", 45: "rec_td_40p", 46: "rec_td_50p",
    53: "rec", 58: "rec_tgt", 63: "fum_rec_td", 64: "pass_sack",
    68: "fum", 72: "fum_lost", 77: "fgm_40_49", 79: "fgmiss_40_49",
    83: "fgm", 84: "fga", 85: "fgmiss", 86: "xpm", 87: "xpa", 88: "xpmiss",
    95: "int", 96: "fum_rec", 97: "blk_kick", 98: "safe", 99: "sack",
    106: "ff", 107: "tkl_ast", 108: "tkl_solo", 109: "tkl", 113: "def_pass_def",
    114: "kr_yd", 115: "pr_yd", 127: "yds_allow",
    201: "fgm_60p", 203: "fgmiss_60p", 211: "pass_fd", 212: "rush_fd",
    213: "rec_fd", 214: "fgm_yds"
  });
  // These categories have verified public definitions but require the original
  // numeric ESPN stat. E.g. 17 is 300–399, not Sleeper's 300+ game count;
  // 74 includes 60+ kicks, whereas Sleeper's fgm_50_59 does not.
  // The cited SETTINGS_SCORING_FORMAT_MAP defines every ID from 0 through 234.
  const nativeEspnIds = Object.freeze(Array.from({ length: 235 }, (_, id) => id));
  const knownEspn = new Set(nativeEspnIds);
  function primaryPosition(position) {
    if (position === undefined || position === null || position === "") return null;
    const upper = String(position).toUpperCase();
    return positions[upper] || ({ DST: "DEF", "D/ST": "DEF", PK: "K" })[upper] || upper;
  }
  function normalizeEspnScoring(settings = {}) {
    const result = JSON.parse(JSON.stringify(object(settings) ? settings : {}));
    result.provider = "espn";
    if (!own(result, "scoringItems")) result.scoringItems = [];
    const reception = Array.isArray(result.scoringItems)
      ? result.scoringItems.find(item => object(item) && Number(item.statId) === 53)
        || result.scoringItems.find(item => object(item) && Number(item.statId) === 41)
      : null;
    result.rec = number(reception?.points) ?? 0;
    return result;
  }
  function providerOf(rules, provider) {
    return String(provider || rules?.provider || (own(rules || {}, "scoringItems") ? "espn" : "sleeper")).toLowerCase();
  }
  function espnDomain(id) {
    if (id <= 62 || (id >= 64 && id <= 71)) return offense;
    if ((id >= 74 && id <= 88) || (id >= 198 && id <= 203) || id >= 214) return ["K"];
    if ((id >= 89 && id <= 113) || (id >= 120 && id <= 137) || id === 205 || id === 208) return defense;
    if (id >= 187 && id <= 197) return ["DEF"];
    if (id >= 138 && id <= 154) return ["P"];
    if (id >= 155 && id <= 174) return ["HC"];
    if ((id >= 175 && id <= 186) || id === 204 || id === 207 || (id >= 211 && id <= 213)) return offense;
    return null;
  }
  function compile(rules, provider) {
    const entries = [], unsupported = [];
    if (!object(rules)) return { entries, unsupported: ["scoring-rules"] };
    if (provider === "sleeper") {
      for (const [key, value] of Object.entries(rules)) {
        const points = number(value);
        if (points === 0) continue;
        if (points === null || !own(sleeper, key)) {
          unsupported.push(key);
          continue;
        }
        entries.push({ id: key, points, ...sleeper[key] });
      }
    } else if (provider === "espn") {
      if (!Array.isArray(rules.scoringItems)) return { entries, unsupported: ["espn:scoringItems"] };
      const seen = new Set();
      for (const item of rules.scoringItems) {
        if (!object(item)) { unsupported.push("espn:scoringItem"); continue; }
        const statId = number(item.statId);
        const id = `espn:${item.statId}`;
        const points = own(item, "points") ? number(item.points) : 0;
        const overrides = own(item, "pointsOverrides") ? item.pointsOverrides : {};
        if (points === 0 && object(overrides) && Object.values(overrides).every(value => number(value) === 0)) continue;
        if (statId === null || !Number.isInteger(statId) || !knownEspn.has(statId)) unsupported.push(id);
        if (points === null) unsupported.push(`${id}:points`);
        if (seen.has(statId)) unsupported.push(`${id}:duplicate`);
        seen.add(statId);
        const byPosition = {};
        if (!object(overrides)) unsupported.push(`${id}:pointsOverrides`);
        else for (const [pos, value] of Object.entries(overrides)) {
          if (!own(positions, pos) || number(value) === null) unsupported.push(`${id}:override:${pos}`);
          else byPosition[positions[pos]] = number(value);
        }
        if (item.isReverseItem) unsupported.push(`${id}:isReverseItem`);
        for (const key of Object.keys(item)) {
          if (!["statId", "points", "pointsOverrides", "isReverseItem", "leagueRanking", "leagueTotal"].includes(key)) {
            unsupported.push(`${id}:${key}`);
          }
        }
        entries.push({ id, statId, key: espnKeys[statId], points, byPosition, positions: espnDomain(statId) });
      }
    } else unsupported.push(`provider:${provider}`);
    return { entries, unsupported: unique(unsupported) };
  }
  function scoreStatLine(stats, rules, options = {}) {
    const provider = providerOf(rules, options.provider);
    const { entries, unsupported } = compile(rules, provider);
    const missing = [];
    const position = primaryPosition(options.position);
    let total = 0, covered = 0;
    if (!object(stats)) stats = {};
    for (const entry of entries) {
      // Exact native ESPN counters take precedence over a cross-provider alias.
      const statKey = entry.statId !== undefined && own(stats, String(entry.statId))
        ? String(entry.statId) : entry.premium && own(stats, entry.id) ? entry.id : entry.key;
      const observed = statKey !== undefined && own(stats, statKey);
      if (position && entry.positions && !entry.positions.includes(position)
        && (entry.premium || !observed)) continue;
      let points = entry.points;
      if (entry.byPosition) {
        if (!position && Object.values(entry.byPosition).some(value => value !== points)) {
          missing.push("position");
          continue;
        }
        if (own(entry.byPosition, position)) points = entry.byPosition[position];
      }
      if (points === 0) {
        if (observed && number(stats[statKey]) !== null) covered++;
        continue;
      }
      if (entry.premium && !position && !own(stats, entry.id)) {
        missing.push("position");
        continue;
      }
      const value = observed ? number(stats[statKey]) : null;
      if (value === null) { missing.push(entry.key || entry.id); continue; }
      covered++;
      total += value * points;
    }
    if (!covered) missing.push("scoring-coverage");
    if (!Number.isFinite(total)) unsupported.push("non-finite-total");
    return {
      points: unsupported.length || missing.length ? null : total === 0 ? 0 : total,
      unsupported: unique(unsupported), missing: unique(missing)
    };
  }
  function describe(rules, provider) {
    provider = providerOf(rules, provider);
    const { entries, unsupported } = compile(rules, provider);
    const numeric = entries.filter(entry => entry.statId !== undefined && !entry.key).length;
    const summary = !entries.length ? unsupported.length ? "Unsupported scoring configuration." : "No active scoring rules."
      : `Custom ${provider === "espn" ? "ESPN" : "Sleeper"} scoring: ${entries.map(entry => {
        const overrides = entry.byPosition ? Object.entries(entry.byPosition)
          .map(([pos, points]) => `${pos}=${points}`).join(", ") : "";
        return `${entry.id} × ${entry.points}${overrides ? ` (${overrides}; replaces base)` : ""}`;
      }).join("; ")}.${numeric ? ` ${numeric} rule(s) require numeric ESPN stats.` : ""}`
        + " Explicit event/bonus counters and complete applicable stat coverage required."
        + " Rule support does not guarantee projection accuracy; missing counters cannot be recovered from PPR totals or per-game averages.";
    return { supported: entries.length > 0 && unsupported.length === 0, summary, unsupported };
  }
  function projectionAdvisory(stats, rules, options = {}) {
    const result = scoreStatLine(stats, rules, options);
    const description = describe(rules, options.provider);
    const complete = result.points !== null;
    const detail = [
      result.unsupported.length ? `Unsupported rules: ${result.unsupported.join(", ")}.` : "",
      result.missing.length ? `Missing inputs: ${result.missing.join(", ")}.` : ""
    ].filter(Boolean).join(" ");
    return {
      supported: description.supported,
      complete,
      points: result.points,
      unsupported: result.unsupported,
      missing: result.missing,
      summary: complete
        ? "Supplied stats cover the applicable scoring rules; this does not verify the provider's projection accuracy."
        : `${detail} Projection unavailable under these rules. Omitted counters are not verified zero; do not zero-fill missing continuous stats or bonus counters.`
          + " Provider preset totals (pts_ppr/pts_half_ppr/pts_std) are not a custom-scoring substitute."
    };
  }
  const api = Object.freeze({
    normalizeEspnScoring, scoreStatLine, describe, projectionAdvisory,
    espnStatKeys: espnKeys, espnPrimaryPositions: positions,
    espnNativeStatIds: nativeEspnIds,
    sleeperStatKeys: Object.freeze(Object.keys(sleeper))
  });
  root.FFOScoring = api;
  if (typeof window !== "undefined" && window !== root) window.FFOScoring = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
