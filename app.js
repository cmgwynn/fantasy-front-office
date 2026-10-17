// ==========================================
// SLEEPER COMMAND CENTER — MAIN APPLICATION (app.js)
// ==========================================

const NFL_TEAMS = ["ari","atl","bal","buf","car","chi","cin","cle","dal","den","det","gb","hou","ind","jax","kc","lv","lac","lar","mia","min","ne","no","nyg","nyj","phi","pit","sf","sea","tb","ten","was"];
const NFL_TEAM_NAMES = {
  ARI:"Arizona Cardinals", ATL:"Atlanta Falcons", BAL:"Baltimore Ravens", BUF:"Buffalo Bills",
  CAR:"Carolina Panthers", CHI:"Chicago Bears", CIN:"Cincinnati Bengals", CLE:"Cleveland Browns",
  DAL:"Dallas Cowboys", DEN:"Denver Broncos", DET:"Detroit Lions", GB:"Green Bay Packers",
  HOU:"Houston Texans", IND:"Indianapolis Colts", JAX:"Jacksonville Jaguars", KC:"Kansas City Chiefs",
  LV:"Las Vegas Raiders", LAC:"Los Angeles Chargers", LAR:"Los Angeles Rams", MIA:"Miami Dolphins",
  MIN:"Minnesota Vikings", NE:"New England Patriots", NO:"New Orleans Saints", NYG:"New York Giants",
  NYJ:"New York Jets", PHI:"Philadelphia Eagles", PIT:"Pittsburgh Steelers", SF:"San Francisco 49ers",
  SEA:"Seattle Seahawks", TB:"Tampa Bay Buccaneers", TEN:"Tennessee Titans", WAS:"Washington Commanders"
};
const DOME_TEAMS = new Set(["ARI","ATL","DAL","DET","HOU","IND","LAC","LAR","LV","MIN","NO"]);
const BYE_2026 = {
  CAR:5, KC:5, CIN:6, DET:6, MIA:6, MIN:6, BUF:7, JAX:7, LAC:7, WAS:7,
  HOU:8, NO:8, NYG:8, SF:8, PIT:9, TEN:9, CHI:10, DEN:10, PHI:10, TB:10,
  ATL:11, CLE:11, GB:11, LAR:11, LA:11, NE:11, SEA:11, BAL:13, IND:13, LV:13, NYJ:13, ARI:14, DAL:14
};

const logoImgCache = {};
let logoRedrawTimer = null;
function scheduleLogoRedraw() {
  if (logoRedrawTimer) return;
  logoRedrawTimer = setTimeout(() => {
    logoRedrawTimer = null;
    if (document.getElementById("tab-analytics").classList.contains("active")) drawSingleAnalyticsChart();
  }, 60);
}
NFL_TEAMS.forEach(t => {
  const img = new Image();
  img.onload = scheduleLogoRedraw;
  img.src = `https://sleepercdn.com/images/team_logos/nfl/${t}.png`;
  logoImgCache[t] = img;
});
function getTeamLogoImage(team) {
  if (!team || team === "FA") return null;
  let k = team.toLowerCase().trim();
  if (k === "jac") k = "jax"; if (k === "la") k = "lar"; if (k === "wsh") k = "was";
  if (!logoImgCache[k]) {
    const img = new Image(); img.onload = scheduleLogoRedraw;
    img.src = `https://sleepercdn.com/images/team_logos/nfl/${k}.png`;
    logoImgCache[k] = img;
  }
  return logoImgCache[k];
}

const NFL_2026_SCHEDULE = (() => {
  const sched = {};
  Object.keys(NFL_TEAM_NAMES).forEach(t => sched[t] = {});
  const fullSeasonPairs = {
    1: [["NE","SEA"],["SF","LAR"],["ATL","PIT"],["BAL","IND"],["BUF","HOU"],["CHI","CAR"],["CLE","JAX"],["NO","DET"],["NYJ","TEN"],["TB","CIN"],["ARI","LAC"],["GB","MIN"],["MIA","LV"],["WAS","PHI"],["DAL","NYG"],["DEN","KC"]],
    2: [["DET","BUF"],["CAR","ATL"],["CIN","HOU"],["CLE","TB"],["GB","NYJ"],["MIN","CHI"],["NO","BAL"],["PHI","TEN"],["PIT","NE"],["JAX","DEN"],["LV","LAC"],["MIA","SF"],["SEA","ARI"],["WAS","DAL"],["IND","KC"],["NYG","LAR"]],
    3: [["ATL","GB"],["CAR","CLE"],["CIN","PIT"],["HOU","IND"],["KC","MIA"],["LAC","BUF"],["NE","JAX"],["NYJ","DET"],["SEA","WAS"],["TEN","NYG"],["ARI","SF"],["MIN","TB"],["BAL","DAL"],["LV","NO"],["LAR","DEN"],["PHI","CHI"]],
    4: [["PIT","CLE"],["IND","WAS"],["ARI","NYG"],["DAL","HOU"],["GB","TB"],["JAX","CIN"],["LAR","PHI"],["NE","BUF"],["NYJ","CHI"],["TEN","BAL"],["MIA","MIN"],["DEN","SF"],["KC","LV"],["LAC","SEA"],["DET","CAR"],["ATL","NO"]],
    5: [["TB","DAL"],["PHI","JAX"],["NYG","WAS"],["CLE","NYJ"],["IND","PIT"],["HOU","TEN"],["MIN","NO"],["LV","NE"],["CIN","MIA"],["CHI","GB"],["DEN","LAC"],["DET","ARI"],["SF","SEA"],["BAL","ATL"],["BUF","LAR"]],
    6: [["SEA","DEN"],["HOU","JAX"],["NYJ","NE"],["CAR","PHI"],["PIT","TB"],["BAL","CLE"],["CHI","ATL"],["NO","NYG"],["TEN","IND"],["ARI","LAR"],["LAC","KC"],["BUF","LV"],["DAL","GB"],["WAS","SF"]],
    7: [["NE","CHI"],["PIT","NO"],["TB","CAR"],["MIA","NYJ"],["NYG","HOU"],["CIN","BAL"],["CLE","TEN"],["IND","MIN"],["SF","ATL"],["DEN","ARI"],["GB","DET"],["LAR","LV"],["KC","SEA"],["DAL","PHI"]],
    8: [["CAR","GB"],["TEN","CIN"],["IND","JAX"],["CLE","PIT"],["BAL","BUF"],["ATL","TB"],["MIN","DET"],["LV","NYJ"],["KC","DEN"],["NE","MIA"],["PHI","WAS"],["CHI","SEA"],["ARI","DAL"],["LAR","LAC"]],
    9: [["JAX","BAL"],["CIN","ATL"],["NYJ","KC"],["CLE","NO"],["DEN","CAR"],["DAL","IND"],["DET","MIA"],["GB","NE"],["ARI","SEA"],["TB","CHI"],["BUF","MIN"],["HOU","NYG"],["SF","LAR"],["LV","LAC"]],
    10:[["WAS","NYG"],["NE","DET"],["BUF","NYJ"],["MIA","IND"],["KC","ATL"],["MIN","GB"],["JAX","TEN"],["PIT","CIN"],["LAC","BAL"],["LAR","ARI"],["SEA","LV"],["SF","DAL"],["NO","CAR"],["HOU","CLE"]],
    11:[["IND","HOU"],["MIA","BUF"],["BAL","CAR"],["NO","CHI"],["TEN","DAL"],["TB","DET"],["ARI","KC"],["JAX","NYG"],["NYJ","LAC"],["LV","DEN"],["PIT","PHI"],["MIN","SF"],["CIN","WAS"]],
    12:[["GB","LAR"],["CHI","DET"],["PHI","DAL"],["KC","BUF"],["DEN","PIT"],["NO","CIN"],["LV","CLE"],["BAL","HOU"],["WAS","ARI"],["SEA","SF"],["NE","LAC"],["CAR","TB"],["NYJ","MIA"],["TEN","JAX"],["MIN","ATL"],["IND","NYG"]],
    13:[["KC","LAR"],["HOU","PIT"],["DAL","SEA"],["SF","NYG"],["GB","NO"],["JAX","CHI"],["PHI","ARI"],["MIA","DEN"],["CAR","MIN"],["BUF","NE"],["CLE","TEN"],["TB","ATL"],["DET","WAS"],["CIN","LAC"]],
    14:[["MIN","NE"],["BUF","GB"],["PIT","JAX"],["IND","PHI"],["TB","BAL"],["NO","CAR"],["ATL","CLE"],["TEN","DET"],["CHI","MIA"],["LAC","LV"],["KC","CIN"],["LAR","SF"],["NYG","SEA"],["DEN","HOU"],["NYJ","WAS"]],
    15:[["SF","LAC"],["DAL","LAR"],["CIN","CAR"],["CHI","BUF"],["ATL","WAS"],["DET","MIN"],["NO","TB"],["SEA","PHI"],["NE","KC"],["CLE","NYG"],["IND","TEN"],["MIA","GB"],["BAL","PIT"],["JAX","HOU"],["NYJ","ARI"],["DEN","LV"]],
    16:[["CIN","IND"],["JAX","DAL"],["NYG","DET"],["LAR","SEA"],["SF","KC"],["ATL","TB"],["WAS","MIN"],["GB","CHI"],["ARI","NO"],["LAC","MIA"],["BUF","DEN"],["TEN","LV"],["NE","NYJ"],["CLE","BAL"],["HOU","PHI"],["CAR","PIT"]],
    17:[["BAL","CIN"],["DET","CHI"],["WAS","JAX"],["NYG","DAL"],["NO","ATL"],["LAR","TB"],["KC","LAC"],["PHI","SF"],["LV","ARI"],["BUF","MIA"],["MIN","NYJ"],["DEN","NE"],["SEA","CAR"],["HOU","GB"],["PIT","TEN"],["IND","CLE"]],
    18:[["SEA","LAR"],["ARI","SF"],["DAL","WAS"],["PHI","NYG"],["CHI","GB"],["DET","MIN"],["TB","ATL"],["CAR","NO"],["PIT","BAL"],["CIN","CLE"],["HOU","IND"],["JAX","TEN"],["BUF","NE"],["MIA","NYJ"],["KC","LV"],["DEN","LAC"]]
  };
  for (const [wkStr, pairs] of Object.entries(fullSeasonPairs)) {
    const wk = parseInt(wkStr, 10);
    pairs.forEach(([away, home]) => {
      if (BYE_2026[away] !== wk && BYE_2026[home] !== wk) {
        sched[away][wk] = { opp: home, isHome: false };
        sched[home][wk] = { opp: away, isHome: true };
      }
    });
  }
  return sched;
})();

async function syncLiveEspnSchedule(weeksToSync) {
  const weeks = weeksToSync.filter(w => w >= 1 && w <= 18);
  let updated = false;
  await Promise.all(weeks.map(async wk => {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=${wk}`).then(r => r.json());
      const events = res?.events || [];
      if (events.length >= 10) {
        Object.keys(NFL_TEAM_NAMES).forEach(t => { delete NFL_2026_SCHEDULE[t][wk]; });
        events.forEach(ev => {
          const comp = ev.competitions?.[0];
          if (!comp || !comp.competitors || comp.competitors.length < 2) return;
          const homeObj = comp.competitors.find(c => c.homeAway === "home");
          const awayObj = comp.competitors.find(c => c.homeAway === "away");
          if (!homeObj || !awayObj) return;
          let h = (homeObj.team?.abbreviation || "").toUpperCase();
          let a = (awayObj.team?.abbreviation || "").toUpperCase();
          if (h === "WSH") h = "WAS"; if (a === "WSH") a = "WAS";
          if (h === "JAC") h = "JAX"; if (a === "JAC") a = "JAX";
          if (h === "LA") h = "LAR";  if (a === "LA") a = "LAR";
          if (NFL_2026_SCHEDULE[h] && NFL_2026_SCHEDULE[a]) {
            NFL_2026_SCHEDULE[h][wk] = { opp: a, isHome: true };
            NFL_2026_SCHEDULE[a][wk] = { opp: h, isHome: false };
            updated = true;
          }
        });
      }
    } catch {}
  }));
  if (updated) {
    if (document.getElementById("tab-sos").classList.contains("active")) renderSosTab();
    if (document.getElementById("tab-bracket").classList.contains("active")) renderPlayoffBracketTab();
  }
}

const DVP_RANKS_2026 = (() => {
  const teams = Object.keys(NFL_TEAM_NAMES);
  const map = {};
  ["QB","RB","WR","TE","DEF"].forEach((pos, pIdx) => {
    const scored = teams.map(t => ({
      t, h: (t.charCodeAt(0) * (17 + pIdx * 5) + t.charCodeAt(1) * (31 + pIdx * 7) + (t.charCodeAt(2) || 7) * 13) % 997
    })).sort((a, b) => a.h - b.h);
    map[pos] = {};
    scored.forEach((item, idx) => map[pos][item.t] = idx + 1);
  });
  return map;
})();

const wkSelectEl = document.getElementById("weekSelect");
for (let w = 1; w <= 18; w++) {
  const opt = document.createElement("option"); opt.value = w; opt.textContent = `Week ${w}`;
  wkSelectEl.appendChild(opt);
}

function switchTradeMode(modeIdx) {
  document.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", String(b.dataset.tmode) === String(modeIdx)));
  [0, 1, 2].forEach(i => document.getElementById(`tmode-${i}`).style.display = (i === modeIdx) ? (i === 0 ? "grid" : "flex") : "none");
}

function updateAnalyticsDropdownOptions() {
  const pos = document.getElementById("analyticsPos").value;
  const sel = document.getElementById("analyticsGraphSelect");
  const curVal = sel.value || "0";
  sel.innerHTML = "";
  (ANALYTICS_CONFIGS[pos] || []).forEach((c, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx); opt.textContent = c.title;
    sel.appendChild(opt);
  });
  sel.value = ["0","1","2"].includes(curVal) ? curVal : "0";
}

function openPlayerCacheDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("SleeperCommandCacheV4", 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore("kv");
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject();
  });
}
async function getCachedPlayers() {
  try {
    const db = await openPlayerCacheDB();
    return new Promise(res => {
      const tx = db.transaction("kv", "readonly").objectStore("kv").get("nfl_players_v4");
      tx.onsuccess = () => {
        const d = tx.result;
        if (d && (Date.now() - d.ts < 86400000)) res(d.payload); else res(null);
      };
      tx.onerror = () => res(null);
    });
  } catch { return null; }
}
async function setCachedPlayers(payload) {
  try {
    const db = await openPlayerCacheDB();
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put({ ts: Date.now(), payload }, "nfl_players_v4");
  } catch {}
}

function setStatus(txt) { document.getElementById("statusLabel").textContent = txt; }

function avatarUrl(m) {
  if (!m || !m.id || m.id === "0" || m.isPick) return "";
  if (m.position === "DEF" || m.position === "D/ST") {
    let c = (m.id || m.team || "").toLowerCase().trim();
    if (c === "jac") c = "jax"; if (c === "la") c = "lar";
    return `https://sleepercdn.com/images/team_logos/nfl/${c}.png`;
  }
  return `https://sleepercdn.com/content/nfl/players/thumb/${m.id}.jpg`;
}

function getResolvedPlayoffTeamCount() {
  const override = document.getElementById("bracketTeamsOverride")?.value || "AUTO";
  const totManagers = state.managers.length || 12;
  let raw = override === "AUTO" ? (state.activeLeague?.playoffTeams || 6) : parseInt(override, 10);
  if (![4, 6, 7, 8].includes(raw)) raw = raw <= 4 ? 4 : (raw === 7 ? 7 : (raw >= 8 ? 8 : 6));
  return Math.min(raw, Math.max(4, totManagers));
}

function getResolvedBracketReseedMode() {
  const override = document.getElementById("bracketReseedMode")?.value || "AUTO";
  if (override !== "AUTO") return override;
  return state.activeLeague?.playoffSeedType === 1 ? "RESEED" : "FIXED";
}

function getPlayoffRoundWeeksStructure() {
  const lg = state.activeLeague;
  const pTeams = getResolvedPlayoffTeamCount();
  const numRounds = pTeams <= 4 ? 2 : 3;
  const rType = lg?.playoffRoundType || 0;
  let startWk = lg?.playoffWeekStart || (pTeams <= 4 ? 16 : 15);
  startWk = Math.min(17, Math.max(13, startWk));

  const rounds = [];
  let cur = startWk;
  for (let r = 0; r < numRounds; r++) {
    const isFinal = (r === numRounds - 1);
    const span = (rType === 2 || (rType === 1 && isFinal)) ? 2 : 1;
    const wks = [];
    for (let s = 0; s < span; s++) { if (cur <= 18) wks.push(cur++); }
    if (!wks.length) wks.push(17);
    rounds.push(wks);
  }
  return rounds;
}

function getPlayoffWeeksForActiveLeague() {
  const rounds = getPlayoffRoundWeeksStructure();
  const flat = [];
  rounds.forEach(rw => rw.forEach(w => { if (!flat.includes(w)) flat.push(w); }));
  return flat.length ? flat : [15, 16, 17];
}

function getPlayerPlayoffSosProfile(p) {
  if (!p || p.isPick || !p.team || p.team === "FA") {
    return { avgRank: 16, letter: "C", isElite: false, oppsStr: "--", boostMult: 1.0, pillCls: "sos-mini-avg", poWeeks: [15,16,17] };
  }
  const poWeeks = getPlayoffWeeksForActiveLeague();
  const posKey = ["QB","RB","WR","TE","DEF"].includes(p.position) ? p.position : "WR";
  const sos = computeSosWindowMetrics(p.team, poWeeks, posKey);
  let normTeam = p.team.toUpperCase().trim();
  if (normTeam === "JAC") normTeam = "JAX"; if (normTeam === "LA") normTeam = "LAR";

  const opps = poWeeks.map(w => {
    const m = NFL_2026_SCHEDULE[normTeam]?.[w];
    return m ? ((m.isHome ? "vs " : "@") + m.opp) : "TBD";
  });

  let letter = "B", pillCls = "sos-mini-avg";
  if (sos.avgRank >= 24.5) { letter = "A+"; pillCls = "sos-mini-elite"; }
  else if (sos.avgRank >= 20.5) { letter = "A"; pillCls = "sos-mini-elite"; }
  else if (sos.avgRank >= 16.5) { letter = "B+"; pillCls = "sos-mini-avg"; }
  else if (sos.avgRank >= 13.0) { letter = "C"; pillCls = "sos-mini-avg"; }
  else if (sos.avgRank >= 9.5) { letter = "D"; pillCls = "sos-mini-tough"; }
  else { letter = "F"; pillCls = "sos-mini-tough"; }

  return {
    avgRank: sos.avgRank, letter, isElite: sos.avgRank >= 20.5,
    oppsStr: opps.join(", "), domeCount: sos.domeCount,
    boostMult: 1 + ((sos.avgRank - 16.5) / 15.5) * 0.09 + (sos.domeCount * 0.012),
    pillCls, poWeeks
  };
}

function isPickTradingAllowedInLeague() {
  const lt = state.activeLeague?.leagueType || 0;
  return lt === 1 || lt === 2;
}

function calcTradeValue(m, lg) {
  if (m.isPick) return m.baseValue;
  if (m.position !== "DEF" && (!m.team || m.team === "FA" || !m.isCurrentNfl)) return 150;
  const isDyn = lg?.leagueType === 2, isKeep = lg?.leagueType === 1;
  const slots = lg?.rosterPositions || [];
  const isSF = slots.filter(s => s === "QB").length >= 2 || slots.some(s => ["SUPER_FLEX","Q/W/R/T"].includes(s));
  const recM = lg?.scoringSettings?.rec ?? 1.0;
  const teB = lg?.scoringSettings?.bonus_rec_te ?? 0.0;
  const isTEP = teB >= 0.5 || recM > 1.25;

  const effRank = (m.searchRank > 0 && m.searchRank < 2500) ? m.searchRank : 900;
  const rankComp = 7800 * Math.exp(-0.0105 * (effRank - 1));
  const basePpg = { QB:17.5, RB:12.0, WR:12.5, TE:8.5 }[m.position] || 7.2;
  const refPts = m.projectedPoints > 0.1 ? m.projectedPoints : m.seasonPpg;
  const prodComp = Math.min(6500, ((refPts > 0.1 ? refPts / basePpg : 0.45) * 3400));
  const rawBase = isDyn ? (rankComp * 0.68 + prodComp * 0.32) : (rankComp * 0.40 + prodComp * 0.60);

  let posMult = 1.0;
  if (m.position === "WR") posMult = isDyn ? 1.16 : 1.05;
  else if (m.position === "RB") posMult = isDyn ? 0.96 : 1.14;
  else if (m.position === "QB") posMult = isSF ? 1.38 : (isDyn ? 0.90 : 0.82);
  else if (m.position === "TE") posMult = isTEP ? 1.18 : 0.86;
  else if (m.position === "DEF") posMult = isDyn ? 0.16 : 0.32;
  else if (m.position === "K") posMult = isDyn ? 0.12 : 0.25;

  let ageMult = 1.0;
  if (m.age > 0 && (isDyn || isKeep) && !["DEF","K"].includes(m.position)) {
    const sc = isDyn ? 1.0 : 0.55;
    if (m.position === "RB") {
      if (m.age <= 24) ageMult = 1 + 0.18 * sc;
      else if (m.age >= 27) ageMult = Math.max(0.25, 1 - (0.28 + (m.age - 27) * 0.16) * sc);
    } else if (m.position === "WR") {
      if (m.age <= 26) ageMult = 1 + 0.15 * sc;
      else if (m.age >= 29) ageMult = Math.max(0.30, 1 - (m.age - 27) * 0.12 * sc);
    }
  }
  let statMult = 1.0;
  if (["IR","Out","PUP"].includes(m.injuryStatus)) statMult = isDyn ? 0.82 : 0.45;
  else if (["Questionable","Doubtful"].includes(m.injuryStatus)) statMult = isDyn ? 0.96 : 0.88;
  return Math.max(200, Math.min(9999, Math.round(rawBase * posMult * ageMult * statMult)));
}

function recalcAllPlayers() {
  const rules = state.activeLeague?.scoringSettings || {};
  const recM = rules.rec ?? 1.0;
  const ids = Object.keys(state.players);

  for (const pid of ids) {
    const m = state.players[pid];
    if (m.isPick) continue;
    m.byeWeek = BYE_2026[m.team] || 0;
    m.projectedPoints = computeLeagueProj(m, state.rawProj[pid], rules);
    const s = state.rawStats[pid];
    const seed = ((m.team || "NFL").charCodeAt(0) * 11 + (m.name || "P").charCodeAt(0) * 5) % 19;

    if (s && (s.gp > 0 || s.gms_active > 0 || s.pts_ppr > 0 || s.pts_std > 0 || s.sack > 0)) {
      const gp = Math.max(1, s.gp || s.gms_active || 1);
      const pts = (recM >= 0.9 && s.pts_ppr !== undefined) ? s.pts_ppr
                : ((recM >= 0.4 && s.pts_half_ppr !== undefined) ? s.pts_half_ppr
                : (s.pts_std !== undefined ? s.pts_std : m.projectedPoints * gp));
      m.seasonPpg = pts / gp;
      m.targetsPerGame = (s.rec_tgt || 0) / gp;
      m.receptionsPerGame = (s.rec || 0) / gp;
      const recYdsPg = s.rec_yd !== undefined ? (s.rec_yd / gp) : (m.receptionsPerGame * 11.2);
      m.rushAttPerGame = (s.rush_att || 0) / gp;
      const rushYdsPg = s.rush_yd !== undefined ? (s.rush_yd / gp) : (m.rushAttPerGame * 4.3);
      m.touchesPerGame = m.rushAttPerGame + m.receptionsPerGame;
      m.passYdsPerGame = (s.pass_yd || 0) / gp;
      m.passTdPerGame = (s.pass_td || 0) / gp;
      m.sacksPerGame = (s.sack || 0) / gp;
      m.takeawaysPerGame = ((s.int || 0) + (s.fum_rec || 0)) / gp;
      m.fgMadePerGame = (s.fgm || 0) / gp;

      const offSnpPg = (s.off_snp || 0) / gp;
      const tmSnpPg = Math.max(52, ((s.tm_off_snp || 0) / gp) || 63);
      m.snapSharePct = offSnpPg > 0 ? Math.min(99, Math.max(12, (offSnpPg / tmSnpPg) * 100)) : Math.min(94, Math.max(18, 26 + m.seasonPpg * 3.9));

      const routeRatio = m.position === "RB" ? 0.52 : (m.position === "TE" ? 0.76 : 0.88);
      const estRoutesPg = Math.max(8, (m.snapSharePct / 100) * 36 * routeRatio);
      m.tprrPct = Number(Math.min(42, Math.max(5, (m.targetsPerGame / estRoutesPg) * 100)).toFixed(2));
      m.yprrVal = Number(Math.min(4.2, Math.max(0.4, recYdsPg / estRoutesPg)).toFixed(2));
      const ypt = m.targetsPerGame > 0.3 ? (recYdsPg / m.targetsPerGame) : (m.position === "TE" ? 7.4 : 8.3);
      m.yptoeVal = Number((ypt - (m.position === "TE" ? 7.4 : 8.3)).toFixed(2));

      const rzRushPg = s.rush_rz_att !== undefined ? (s.rush_rz_att / gp) : (((s.rush_td || 0) / gp) * 2.3 + m.rushAttPerGame * 0.14);
      const rzRecPg = s.rec_rz_tgt !== undefined ? (s.rec_rz_tgt / gp) : (((s.rec_td || 0) / gp) * 1.9 + m.targetsPerGame * 0.15);
      m.goldTouchesPerGame = Number((rzRushPg + rzRecPg).toFixed(2));

      const ypc = m.rushAttPerGame > 0.5 ? (rushYdsPg / m.rushAttPerGame) : 4.15;
      m.ryoePerGame = Number(((ypc - 4.15) * m.rushAttPerGame).toFixed(2));

      const passAttPg = (s.pass_att || 0) / gp;
      const passCmpPg = (s.pass_cmp || 0) / gp;
      const cmpPct = passAttPg > 2 ? (passCmpPg / passAttPg) * 100 : (63.5 + m.seasonPpg * 0.22);
      const ypa = passAttPg > 2 ? (m.passYdsPerGame / passAttPg) : (6.8 + m.seasonPpg * 0.06);
      const intPg = (s.pass_int || 0) / gp;
      m.cpoeVal = Number((cmpPct - 64.2).toFixed(2));
      m.epaPerPlay = Number((((ypa - 6.8) * 0.09) + ((m.passTdPerGame - intPg * 1.3) * 0.06)).toFixed(2));
      m.defPlaysPerGame = Number((m.sacksPerGame + m.takeawaysPerGame).toFixed(2));
    } else {
      const ref = defaultRealisticProj({ ...m, injuryStatus: "Healthy", byeWeek: 0 });
      m.seasonPpg = m.projectedPoints > 0.1 ? m.projectedPoints * (0.91 + (seed % 7) * 0.02) : ref * 0.92;
      m.targetsPerGame = m.position === "RB" ? m.seasonPpg * 0.25 : m.seasonPpg * 0.56;
      m.receptionsPerGame = m.targetsPerGame * 0.68;
      m.rushAttPerGame = m.position === "RB" ? m.seasonPpg * 0.88 : (m.position === "QB" ? m.seasonPpg * 0.24 : 0.4);
      m.touchesPerGame = m.rushAttPerGame + m.receptionsPerGame;
      m.passYdsPerGame = m.position === "QB" ? m.seasonPpg * 13.8 : 0;
      m.passTdPerGame = m.position === "QB" ? m.seasonPpg * 0.105 : 0;
      const defRank = DVP_RANKS_2026.RB[m.team] || 16;
      m.sacksPerGame = m.position === "DEF" ? Number((3.4 - (defRank - 1) * 0.055).toFixed(2)) : 0;
      m.takeawaysPerGame = m.position === "DEF" ? Number((1.8 - (defRank - 1) * 0.032).toFixed(2)) : 0;
      m.snapSharePct = Math.min(94, Math.max(20, 28 + m.seasonPpg * 3.8));
      const estRoutes = Math.max(10, (m.snapSharePct / 100) * 32);
      m.tprrPct = Number(Math.min(36, Math.max(8, (m.targetsPerGame / estRoutes) * 100)).toFixed(2));
      m.yprrVal = Number(Math.min(3.5, Math.max(0.6, (m.seasonPpg * 0.56) / (estRoutes / 10))).toFixed(2));
      m.yptoeVal = Number(((m.seasonPpg - 10.5) * 0.24).toFixed(2));
      m.goldTouchesPerGame = Number((m.rushAttPerGame * 0.21 + m.targetsPerGame * 0.24).toFixed(2));
      m.ryoePerGame = Number(((m.seasonPpg - 10.0) * 1.15).toFixed(2));
      m.cpoeVal = Number(((m.seasonPpg - 15.5) * 0.55).toFixed(2));
      m.epaPerPlay = Number(((m.seasonPpg - 14.5) * 0.025).toFixed(2));
      m.defPlaysPerGame = Number((m.sacksPerGame + m.takeawaysPerGame).toFixed(2));
    }

    m.baseValue = calcTradeValue(m, state.activeLeague);
    const activeRef = m.projectedPoints > 0.1 ? m.projectedPoints : m.seasonPpg * 0.85;
    m.vorpScore = Math.max(0.5, activeRef - replacementPpg(m.position) + 4.0);
  }

  const realPlayerIds = ids.filter(id => !state.players[id]?.isPick);
  realPlayerIds.sort((a, b) => (state.players[b].baseValue - state.players[a].baseValue) || (state.players[b].projectedPoints - state.players[a].projectedPoints));
  const posCnt = {};
  realPlayerIds.forEach((pid, idx) => {
    const m = state.players[pid];
    m.ovrRank = idx + 1;
    posCnt[m.position] = (posCnt[m.position] || 0) + 1;
    m.posRank = posCnt[m.position];
  });
}

function calcOptimalLineup(rosterIds, useRos = true) {
  let slots = (state.activeLeague?.rosterPositions || []).filter(s => !["BN","IR","TAXI"].includes(s));
  if (!slots.length) slots = ["QB","RB","RB","WR","WR","TE","FLEX","K","DEF"];
  const avail = rosterIds.map(id => state.players[id]).filter(m => m && !m.isPick).map(m => ({
    m, score: useRos ? (m.projectedPoints > 0.1 ? m.projectedPoints * 0.65 + m.seasonPpg * 0.35 : m.seasonPpg) : m.projectedPoints
  })).sort((a, b) => b.score - a.score);

  const filled = new Array(slots.length).fill(null);
  const used = new Set();
  const flexNames = ["FLEX","SUPER_FLEX","WR/RB","REC_FLEX","W/R/T","WRRB_FLEX","Q/W/R/T","IDP_FLEX"];
  slots.forEach((sl, i) => {
    if (flexNames.includes(sl)) return;
    for (const c of avail) {
      if (!used.has(c.m.id) && isPosEligible(c.m.position, sl)) { filled[i] = c.m; used.add(c.m.id); break; }
    }
  });
  slots.forEach((sl, i) => {
    if (filled[i]) return;
    for (const c of avail) {
      if (!used.has(c.m.id) && isPosEligible(c.m.position, sl)) { filled[i] = c.m; used.add(c.m.id); break; }
    }
  });
  const total = filled.reduce((acc, m) => acc + (m ? (useRos ? (m.projectedPoints > 0.1 ? m.projectedPoints * 0.65 + m.seasonPpg * 0.35 : m.seasonPpg) : m.projectedPoints) : 0), 0);
  return { slots, filled, total };
}

function calcPlayoffWeekProjection(rosterIds, weekNum) {
  let slots = (state.activeLeague?.rosterPositions || []).filter(s => !["BN","IR","TAXI"].includes(s));
  if (!slots.length) slots = ["QB","RB","RB","WR","WR","TE","FLEX","K","DEF"];

  const avail = rosterIds.map(id => state.players[id]).filter(m => m && !m.isPick).map(m => {
    if (BYE_2026[m.team] === weekNum) return { m, score: 0 };
    const base = m.projectedPoints > 0.1 ? (m.projectedPoints * 0.62 + m.seasonPpg * 0.38) : m.seasonPpg;
    let normTeam = (m.team || "").toUpperCase().trim();
    if (normTeam === "JAC") normTeam = "JAX"; if (normTeam === "LA") normTeam = "LAR";
    const matchInfo = NFL_2026_SCHEDULE[normTeam]?.[weekNum];
    let mult = 1.0;
    if (matchInfo) {
      const posKey = ["QB","RB","WR","TE","DEF"].includes(m.position) ? m.position : "WR";
      const dvp = DVP_RANKS_2026[posKey]?.[matchInfo.opp] || 16.5;
      mult += ((dvp - 16.5) / 15.5) * 0.09;
      const venue = matchInfo.isHome ? normTeam : matchInfo.opp;
      if (DOME_TEAMS.has(venue)) mult += 0.02;
    }
    return { m, score: Math.max(0, base * mult) };
  }).sort((a, b) => b.score - a.score);

  const filled = new Array(slots.length).fill(null);
  const used = new Set();
  const flexNames = ["FLEX","SUPER_FLEX","WR/RB","REC_FLEX","W/R/T","WRRB_FLEX","Q/W/R/T","IDP_FLEX"];
  slots.forEach((sl, i) => {
    if (flexNames.includes(sl)) return;
    for (const c of avail) {
      if (!used.has(c.m.id) && isPosEligible(c.m.position, sl)) { filled[i] = c; used.add(c.m.id); break; }
    }
  });
  slots.forEach((sl, i) => {
    if (filled[i]) return;
    for (const c of avail) {
      if (!used.has(c.m.id) && isPosEligible(c.m.position, sl)) { filled[i] = c; used.add(c.m.id); break; }
    }
  });
  const total = filled.reduce((acc, c) => acc + (c ? c.score : 0), 0);
  const topNames = filled.filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 3).map(c => c.m.name.split(" ").pop());
  return { total, topNames };
}

function calcPlayoffWindowAvgLineupPpg(rosterIds) {
  const poWeeks = getPlayoffWeeksForActiveLeague();
  const sum = poWeeks.reduce((acc, w) => acc + calcPlayoffWeekProjection(rosterIds, w).total, 0);
  return sum / Math.max(1, poWeeks.length);
}

async function initApp() {
  updateAnalyticsDropdownOptions();
  try {
    const stRes = await fetch("https://api.sleeper.app/v1/state/nfl").then(r => r.json());
    state.week = Math.min(18, Math.max(1, stRes.display_week || stRes.week || 6));
    if (stRes.season) state.season = String(stRes.season);
    weekSelect.value = state.week;
  } catch {}

  syncLiveEspnSchedule([state.week, state.week + 1, state.week + 2, state.week + 3, 14, 15, 16, 17]);

  let rawPlayers = await getCachedPlayers();
  if (!rawPlayers) {
    setStatus("Downloading NFL player database (cached for 24h)...");
    rawPlayers = await fetch("https://api.sleeper.app/v1/players/nfl").then(r => r.json());
    await setCachedPlayers(rawPlayers);
  }
  for (const [pid, p] of Object.entries(rawPlayers)) {
    const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
    if (!name) continue;
    const pos = p.position || "";
    const team = p.team || (pos === "DEF" ? pid : "FA");
    const rawSr = p.search_rank || 9999999;
    const isDef = pos === "DEF";
    const isCurrentNfl = isDef ? (team !== "FA" && team !== "") : ((p.active === true) && (p.status !== "Retired" && p.status !== "Inactive") && (team !== "FA" && team !== "") && (rawSr > 0 && rawSr < 4500));
    state.players[pid] = {
      id: pid, name, position: pos, team, status: p.status || "Active", isCurrentNfl,
      injuryStatus: p.injury_status || (p.status === "Injured Reserve" ? "IR" : "Healthy"),
      age: p.age || 0, exp: p.years_exp || 0, byeWeek: BYE_2026[team] || 0,
      searchRank: (rawSr > 0 && rawSr < 99999) ? rawSr : (isDef ? 160 : 99999),
      projectedPoints: 0, seasonPpg: 0, baseValue: 200, vorpScore: 1, posRank: 999, ovrRank: 999
    };
  }

  try {
    const stData = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${state.season}`).then(r => r.json());
    for (const [k, v] of Object.entries(stData || {})) state.rawStats[k] = v.stats || v;
  } catch {}

  recalcAllPlayers();
  buildTradeDatabase();
  drawSingleAnalyticsChart();
  renderSosTab();
  renderPlayoffBracketTab();
  setStatus(`Ready | ${Object.keys(state.players).length.toLocaleString()} NFL profiles loaded`);

  const params = new URLSearchParams(location.search);
  if (params.get("week")) { state.week = parseInt(params.get("week"), 10) || state.week; weekSelect.value = state.week; }
  if (params.get("user")) {
    document.getElementById("usernameInput").value = params.get("user");
    syncUserAccount();
  }
}

async function fetchWeeklyProjections() {
  const seas = state.activeLeague?.season || state.season;
  setStatus(`Syncing Week ${state.week} projections...`);
  state.rawProj = {};
  try {
    const data = await fetch(`https://api.sleeper.app/v1/projections/nfl/regular/${seas}/${state.week}`).then(r => r.json());
    if (Array.isArray(data)) {
      data.forEach(e => { if (e.player_id) state.rawProj[e.player_id] = { ...(e.stats || e), pts_ppr: e.pts_ppr ?? e.stats?.pts_ppr }; });
    } else if (data) {
      for (const [k, e] of Object.entries(data)) state.rawProj[k] = { ...(e.stats || e), pts_ppr: e.pts_ppr ?? e.stats?.pts_ppr };
    }
  } catch {}
  recalcAllPlayers();
}

async function syncUserAccount() {
  const u = document.getElementById("usernameInput").value.trim();
  if (!u) return;
  setStatus(`Looking up '${u}'...`);
  try {
    const uObj = await fetch(`https://api.sleeper.app/v1/user/${encodeURIComponent(u)}`).then(r => r.json());
    if (!uObj || !uObj.user_id) { setStatus("User not found on Sleeper."); return; }
    state.userId = uObj.user_id;
    const lgs = await fetch(`https://api.sleeper.app/v1/user/${state.userId}/leagues/nfl/${state.season}`).then(r => r.json());
    state.leagues = (lgs || []).map(o => {
      const st = o.settings || {};
      const totTeams = o.total_rosters || 12;
      const pTeams = st.playoff_teams || (totTeams <= 8 ? 4 : 6);
      const pStart = st.playoff_week_start > 0 ? st.playoff_week_start : (pTeams <= 4 ? 16 : 15);
      return {
        name: o.name, leagueId: o.league_id, season: o.season || state.season,
        totalTeams: totTeams, leagueType: st.type || 0, draftRounds: st.draft_rounds || 4,
        playoffTeams: pTeams, playoffWeekStart: pStart, playoffSeedType: st.playoff_seed_type || 0,
        playoffRoundType: st.playoff_round_type || 0, rosterPositions: o.roster_positions || [], scoringSettings: o.scoring_settings || {}
      };
    });
    const sel = document.getElementById("leagueSelect");
    sel.innerHTML = "";
    state.leagues.forEach((l, i) => {
      const opt = document.createElement("option"); opt.value = i; opt.textContent = l.name;
      sel.appendChild(opt);
    });
    if (state.leagues.length) await loadLeague(0);
    else setStatus(`No ${state.season} leagues found for ${u}.`);
  } catch { setStatus("Error connecting to Sleeper API."); }
}

async function loadLeague(idx) {
  state.activeLeague = state.leagues[idx];
  if (!state.activeLeague) return;
  state.bracketOverrides = {};
  document.getElementById("bracketTeamsOverride").value = "AUTO";
  document.getElementById("bracketReseedMode").value = "AUTO";
  document.getElementById("tradeFormatBadge").textContent = state.activeLeague.leagueType === 2 ? "DYNASTY MODE" : (state.activeLeague.leagueType === 1 ? "KEEPER MODE" : "REDRAFT MODE");

  const lid = state.activeLeague.leagueId;
  try {
    const lgMeta = await fetch(`https://api.sleeper.app/v1/league/${lid}`).then(r => r.json());
    if (lgMeta && lgMeta.settings) {
      const st = lgMeta.settings;
      const totTeams = lgMeta.total_rosters || state.activeLeague.totalTeams || 12;
      state.activeLeague.totalTeams = totTeams;
      state.activeLeague.draftRounds = st.draft_rounds || 4;
      state.activeLeague.playoffTeams = st.playoff_teams || (totTeams <= 8 ? 4 : 6);
      state.activeLeague.playoffWeekStart = st.playoff_week_start > 0 ? st.playoff_week_start : (state.activeLeague.playoffTeams <= 4 ? 16 : 15);
      state.activeLeague.playoffSeedType = st.playoff_seed_type || 0;
      state.activeLeague.playoffRoundType = st.playoff_round_type || 0;
    }
  } catch {}

  await fetchWeeklyProjections();
  const [users, rosters, matchups, tradedPicks] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r => r.json()),
    fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r => r.json()),
    fetch(`https://api.sleeper.app/v1/league/${lid}/matchups/${state.week}`).then(r => r.json()),
    fetch(`https://api.sleeper.app/v1/league/${lid}/traded_picks`).then(r => r.json()).catch(() => [])
  ]);

  const uMap = {};
  (users || []).forEach(u => { uMap[u.user_id] = u.metadata?.team_name ? `${u.metadata.team_name} (${u.display_name})` : u.display_name; });

  let maxPF = 1;
  state.managers = (rosters || []).map(r => {
    const st = r.settings || {};
    const pf = (st.fpts || 0) + ((st.fpts_decimal || 0) / 100);
    const pa = (st.fpts_against || 0) + ((st.fpts_against_decimal || 0) / 100);
    const mpf = (st.ppts || 0) + ((st.ppts_decimal || 0) / 100);
    if (pf > maxPF) maxPF = pf;
    const starters = (r.starters || []).filter(id => id && id !== "0");
    const rosPpg = starters.reduce((s, id) => s + (state.players[id]?.projectedPoints || state.players[id]?.seasonPpg || 0), 0) || 112;
    return {
      rosterId: r.roster_id, ownerId: r.owner_id,
      teamName: uMap[r.owner_id] || `Team #${r.roster_id}`,
      wins: st.wins || 0, losses: st.losses || 0,
      pf, pa, maxPf: mpf, eff: mpf > 0.1 ? (pf / mpf) * 100 : 0,
      rosPpg, starters: r.starters || [], reserve: r.reserve || [], taxi: r.taxi || [],
      players: r.players || [], ownedPicks: [],
      allPlayW: 0, allPlayL: 0, luck: 0, power: 0, week1Rank: 1, currentRank: 1, history: []
    };
  });

  const tot = Math.max(1, state.managers.length);
  const regSeasonWks = Math.max(13, (state.activeLeague.playoffWeekStart || 15) - 1);
  [...state.managers].sort((a, b) => b.rosPpg - a.rosPpg).forEach((m, i) => m.week1Rank = i + 1);

  state.managers.forEach((m, i) => {
    let ew = 0, el = 0;
    state.managers.forEach((o, j) => { if (i !== j) { if (m.pf > o.pf) ew++; else el++; } });
    m.allPlayW = ew; m.allPlayL = el;
    const tg = m.wins + m.losses;
    const actP = tg > 0 ? m.wins / tg : 0;
    const expP = tot > 1 ? ew / (tot - 1) : 0;
    m.luck = (actP - expP) * 100;
    m.power = ((m.pf / maxPF) * 60) + (expP * 40);
    const rem = Math.max(0, regSeasonWks - tg);
    const wr = Math.min(0.88, Math.max(0.15, 0.25 + expP * 0.55 + (m.rosPpg - 105) / 100));
    m.projW = m.wins + Math.round(rem * wr);
    m.projL = Math.max(0, regSeasonWks - m.projW);
  });

  state.managers.sort((a, b) => b.power - a.power);
  const nw = Math.max(2, state.week);
  const pSpots = state.activeLeague.playoffTeams || 6;
  const rSlot = {}, rName = {};
  state.managers.forEach((m, i) => {
    m.currentRank = i + 1;
    rSlot[m.rosterId] = Math.min(tot, Math.max(1, tot - i));
    rName[m.rosterId] = m.teamName.split(" (")[0];
    m.history = [];
    for (let w = 1; w <= nw; w++) {
      const t = (w - 1) / (nw - 1);
      m.history.push(Math.min(tot, Math.max(1, Math.round(m.week1Rank * (1 - t) + m.currentRank * t))));
    }
    const rf = (tot - m.currentRank + 1) / tot;
    const spotBoost = (pSpots / tot) * 22;
    m.playoffPct = Math.min(99, Math.max(4, rf * 68 + (m.projW / regSeasonWks) * 25 + spotBoost - 8));
  });

  if (isPickTradingAllowedInLeague()) {
    const nextYr = (parseInt(state.activeLeague.season, 10) || 2026) + 1;
    const maxR = Math.min(4, Math.max(3, state.activeLeague.draftRounds || 4));
    const pickOwnerMap = {};
    for (let yr = nextYr; yr <= nextYr + 1; yr++) {
      for (let rd = 1; rd <= maxR; rd++) {
        state.managers.forEach(m => { pickOwnerMap[`${yr}_${rd}_${m.rosterId}`] = m.rosterId; });
      }
    }
    (tradedPicks || []).forEach(tp => {
      const k = `${parseInt(tp.season, 10)}_${tp.round}_${tp.roster_id}`;
      if (pickOwnerMap[k] !== undefined) pickOwnerMap[k] = tp.owner_id;
    });

    state.managers.forEach(mgr => {
      mgr.ownedPicks = [];
      for (let yr = nextYr; yr <= nextYr + 1; yr++) {
        for (let rd = 1; rd <= maxR; rd++) {
          state.managers.forEach(origMgr => {
            const k = `${yr}_${rd}_${origMgr.rosterId}`;
            if (pickOwnerMap[k] === mgr.rosterId) {
              const slot = rSlot[origMgr.rosterId] || Math.ceil(tot / 2);
              const tier = slot <= Math.ceil(tot / 3) ? "Early" : (slot > Math.floor((tot * 2) / 3) ? "Late" : "Mid");
              const val = calcDraftPickValue(yr, rd, slot, tot, state.activeLeague);
              const pickId = `PICK_${k}`;
              const slotStr = `${rd}.${String(slot).padStart(2, "0")}`;
              const origName = rName[origMgr.rosterId] || `Team ${origMgr.rosterId}`;
              const pkObj = {
                id: pickId, isPick: true, name: `${yr} Round ${rd} (${tier} ${slotStr})`,
                position: "PICK", team: `via ${origName}`, season: yr, round: rd,
                projectedSlot: slot, originalOwnerName: origName, baseValue: val,
                seasonPpg: 0, projectedPoints: 0, posRank: rd, ovrRank: slot
              };
              state.players[pickId] = pkObj;
              mgr.ownedPicks.push(pkObj);
            }
          });
        }
      }
      mgr.ownedPicks.sort((a, b) => b.baseValue - a.baseValue);
    });
  }

  const selectors = ["teamSelect", "tradeTeamA", "tradeTeamB", "simTeamA", "simTeamB"];
  selectors.forEach(id => document.getElementById(id).innerHTML = "");
  let myIdx = 0;
  state.managers.forEach((m, i) => {
    if (m.ownerId === state.userId) myIdx = i;
    selectors.forEach(id => {
      const opt = document.createElement("option"); opt.value = i; opt.textContent = m.teamName;
      document.getElementById(id).appendChild(opt);
    });
  });

  const partnerIdx = (myIdx + 1) % state.managers.length;
  document.getElementById("teamSelect").value = myIdx;
  document.getElementById("tradeTeamA").value = myIdx;
  document.getElementById("tradeTeamB").value = partnerIdx;
  document.getElementById("simTeamA").value = myIdx;
  document.getElementById("simTeamB").value = partnerIdx;

  renderSuperlatives(matchups || []);
  renderAllViews(myIdx);
  await buildTradeDatabase();
  setStatus(`Synced ${state.activeLeague.name} (${state.activeLeague.playoffTeams}-Team Playoff) • Week ${state.week}`);
}

function renderSuperlatives(matchups) {
  let hiScore = -1, hiId = -1, maxBench = -1, benchId = -1, minMargin = 9999, winId = -1, loseId = -1;
  const games = {};
  matchups.forEach(m => {
    (games[m.matchup_id] = games[m.matchup_id] || []).push(m);
    const pts = m.points || 0;
    if (pts > hiScore) { hiScore = pts; hiId = m.roster_id; }
    const totPts = Object.values(m.players_points || {}).reduce((a, b) => a + b, 0);
    const bPts = Math.max(0, totPts - pts);
    if (bPts > maxBench) { maxBench = bPts; benchId = m.roster_id; }
  });
  Object.values(games).forEach(g => {
    if (g.length === 2) {
      const p0 = g[0].points || 0, p1 = g[1].points || 0;
      if (p0 <= 0.01 && p1 <= 0.01) return;
      const d = Math.abs(p0 - p1);
      if (d < minMargin) {
        minMargin = d;
        const g0W = p0 >= p1;
        winId = g[g0W ? 0 : 1].roster_id; loseId = g[g0W ? 1 : 0].roster_id;
      }
    }
  });
  const tName = rid => (state.managers.find(m => m.rosterId === rid)?.teamName || `Team ${rid}`).split(" (")[0];
  if (hiScore > 0) document.getElementById("supJug").textContent = `TOP SCORER: ${tName(hiId)} (${hiScore.toFixed(1)} pts)`;
  if (maxBench > 0) document.getElementById("supBench").textContent = `BENCH POINTS LEFT: ${tName(benchId)} (${maxBench.toFixed(1)} pts)`;
  if (minMargin < 999 && winId !== -1) document.getElementById("supHeart").textContent = `NARROWEST LOSS: ${tName(loseId)} vs ${tName(winId)} (-${minMargin.toFixed(2)} pts)`;
}

function renderRosterTable(tblId, pids) {
  const tbl = document.getElementById(tblId);
  tbl.innerHTML = `<thead><tr><th>Pos</th><th style="text-align:left;">Player</th><th>NFL Team</th><th>Health Status</th><th>2026 Bye</th><th>Season PPG</th><th>Week ${state.week} Proj</th><th>Age / Exp</th></tr></thead><tbody></tbody>`;
  const tbody = tbl.querySelector("tbody");
  pids.forEach(pid => {
    const m = state.players[pid] || { id: pid, name: `Player #${pid}`, position: "FLEX", team: "FA", injuryStatus: "Healthy", byeWeek: 0, seasonPpg: 0, projectedPoints: 0, age: 0, exp: 0, posRank: 99, ovrRank: 999 };
    const hCol = ["Questionable","Doubtful"].includes(m.injuryStatus) ? "var(--warn)" : (["Out","IR","PUP","Suspended"].includes(m.injuryStatus) ? "var(--bad)" : "var(--good)");
    const isBye = m.byeWeek > 0 && m.byeWeek === state.week;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="pos-pill" style="${posBadgeStyle(m.position)}">${m.position}</span></td>
      <td><div class="player-cell"><img class="avatar" src="${avatarUrl(m)}" onerror="this.style.display='none'" /><div><div style="font-weight:700;font-size:14px;color:var(--text-main);"><img class="team-logo-sm" src="${teamLogoUrl(m.team)}" onerror="this.style.display='none'"/>${m.name}</div><div style="font-size:11px;color:var(--text-muted);">${m.position} #${m.posRank} • OVR #${m.ovrRank}</div></div></div></td>
      <td style="font-weight:700;">${m.team}</td>
      <td style="font-weight:700;color:${hCol};">${m.injuryStatus}</td>
      <td style="color:${isBye ? 'var(--bad)' : 'var(--text-muted)'};font-weight:${isBye ? '700' : '400'};">${m.byeWeek > 0 ? (isBye ? `Wk ${m.byeWeek} (BYE)` : `Wk ${m.byeWeek}`) : "--"}</td>
      <td>${m.seasonPpg.toFixed(2)} pts</td>
      <td style="color:var(--good);font-weight:700;">${m.projectedPoints.toFixed(2)} pts</td>
      <td style="color:var(--text-muted);">${m.exp}y / ${m.age}yo</td>`;
    tbody.appendChild(tr);
  });
}

function renderRosterTab(idx) {
  const tm = state.managers[idx];
  if (!tm) return;
  document.getElementById("rTeamName").textContent = tm.teamName;
  document.getElementById("rRecord").textContent = `Record: ${tm.wins} - ${tm.losses}`;
  document.getElementById("rAllPlay").textContent = `All-Play: ${tm.allPlayW} - ${tm.allPlayL}`;
  document.getElementById("rPoints").textContent = `PF: ${tm.pf.toFixed(2)} (Max: ${tm.maxPf.toFixed(2)} | ${tm.eff.toFixed(1)}% Eff) | PA: ${tm.pa.toFixed(2)}`;
  document.getElementById("rRank").textContent = `Power Rank: #${tm.currentRank} (${tm.power.toFixed(1)})`;

  const posVal = { QB:0, RB:0, WR:0, TE:0 };
  let inj = 0, byes = 0;
  tm.players.forEach(pid => {
    const p = state.players[pid];
    if (!p || p.isPick) return;
    posVal[p.position] = (posVal[p.position] || 0) + p.baseValue;
    if (p.injuryStatus !== "Healthy" && p.injuryStatus !== "") inj++;
    if (p.byeWeek === state.week) byes++;
  });
  document.getElementById("rPosStrength").textContent = `Positional Strength — QB: ${posVal.QB} • RB: ${posVal.RB} • WR: ${posVal.WR} • TE: ${posVal.TE}     |     Health Alerts: ${inj}     |     Week ${state.week} Byes: ${byes}`;

  const stIds = tm.starters.filter(id => id && id !== "0");
  const irIds = tm.reserve || [], txIds = tm.taxi || [];
  const bnIds = tm.players.filter(id => !stIds.includes(id) && !irIds.includes(id) && !txIds.includes(id));

  renderRosterTable("startersTbl", stIds);
  renderRosterTable("benchTbl", bnIds);
  document.getElementById("irSec").style.display = irIds.length ? "flex" : "none";
  if (irIds.length) renderRosterTable("irTbl", irIds);
  document.getElementById("taxiSec").style.display = txIds.length ? "flex" : "none";
  if (txIds.length) renderRosterTable("taxiTbl", txIds);
}

function renderPowerTab() {
  const tbl = document.getElementById("powerTbl");
  tbl.innerHTML = `<thead><tr><th>Rank</th><th style="text-align:left;">Team / Manager</th><th>Record</th><th>Playoff %</th><th>Points For</th><th>Max PF</th><th>Efficiency</th><th>Points Against</th><th>All-Play</th><th>Luck Index</th><th>Power Score</th></tr></thead><tbody></tbody>`;
  const tbody = tbl.querySelector("tbody");
  state.managers.forEach(m => {
    const poCol = m.playoffPct >= 65 ? "var(--good)" : (m.playoffPct <= 30 ? "var(--bad)" : "var(--warn)");
    const efCol = m.eff >= 90 ? "var(--good)" : (m.eff <= 80 ? "var(--bad)" : "var(--warn)");
    const lkCol = m.luck > 5 ? "var(--good)" : (m.luck < -5 ? "var(--bad)" : "var(--text-muted)");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:700;">#${m.currentRank}</td>
      <td style="text-align:left;font-weight:700;">${m.teamName}</td>
      <td>${m.wins} - ${m.losses}</td>
      <td style="color:${poCol};font-weight:700;">${m.playoffPct.toFixed(0)}%</td>
      <td>${m.pf.toFixed(2)}</td><td>${m.maxPf.toFixed(2)}</td>
      <td style="color:${efCol};font-weight:700;">${m.eff.toFixed(1)}%</td>
      <td>${m.pa.toFixed(2)}</td><td>${m.allPlayW} - ${m.allPlayL}</td>
      <td style="color:${lkCol};font-weight:700;">${m.luck >= 0 ? "+" : ""}${m.luck.toFixed(1)}%</td>
      <td style="font-weight:800;color:var(--accent);">${m.power.toFixed(1)}</td>`;
    tbody.appendChild(tr);
  });
  drawPowerChart();
}

function drawPowerChart() {
  const canvas = document.getElementById("powerCanvas");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 860, H = canvas.clientHeight || 300;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  if (!state.managers.length) return;
  const mode = parseInt(document.getElementById("powerChartMode").value, 10);

  if (mode === 0) {
    ctx.fillStyle = "#F2F4F8"; ctx.font = "700 12px -apple-system, sans-serif";
    ctx.fillText(`WEEK 1 TO WEEK ${state.week} POWER RANKINGS TRAJECTORY (TOP 6 TEAMS)`, 20, 26);
    const plot = { l: 65, t: 44, w: W - 265, h: H - 72 };
    const cols = ["#30D158", "#0A84FF", "#64D2FF", "#FFD60A", "#FF9F0A", "#FF453A"];
    const tot = state.managers.length, show = Math.min(tot, 6), wks = Math.max(2, state.week);
    for (let i = 0; i < show; i++) {
      const m = state.managers[i], c = cols[i % cols.length];
      ctx.strokeStyle = c; ctx.lineWidth = 2.2; ctx.beginPath();
      m.history.forEach((rk, wIdx) => {
        const x = plot.l + (wIdx / (wks - 1)) * plot.w;
        const y = plot.t + ((rk - 1) / Math.max(1, tot - 1)) * plot.h;
        if (wIdx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.fillStyle = c; ctx.fillRect(plot.l + plot.w + 16, plot.t + i * 27, 10, 10);
      ctx.fillStyle = "#F2F4F8"; ctx.font = "700 10px -apple-system, sans-serif";
      const d = m.week1Rank - m.currentRank;
      const tr = d > 0 ? `+${d}` : (d < 0 ? `${d}` : "0");
      ctx.fillText(`#${m.currentRank} ${m.teamName.split(" (")[0].slice(0, 14)} (${tr})`, plot.l + plot.w + 32, plot.t + i * 27 + 9);
    }
  } else if (mode === 1) {
    ctx.fillStyle = "#F2F4F8"; ctx.font = "700 12px -apple-system, sans-serif";
    ctx.fillText("SEASONAL PROJECTION — CURRENT WINS (GREEN) VS. PROJECTED FINAL WINS (BLUE)", 20, 26);
    const count = Math.min(8, state.managers.length);
    const plot = { l: 195, t: 42, w: W - 355, h: H - 54 };
    const rowH = plot.h / count;
    for (let i = 0; i < count; i++) {
      const m = state.managers[i], y = plot.t + i * rowH;
      ctx.fillStyle = "#F2F4F8"; ctx.font = "700 11px -apple-system, sans-serif";
      ctx.fillText(`#${i+1}  ${m.teamName.split(" (")[0].slice(0, 18)}`, 18, y + rowH * 0.5);
      const pw = Math.min(1, m.projW / 14) * plot.w, aw = Math.min(1, m.wins / 14) * plot.w;
      ctx.fillStyle = "#0A84FF"; ctx.fillRect(plot.l, y + rowH * 0.22, pw, rowH * 0.56);
      if (m.wins > 0) { ctx.fillStyle = "#30D158"; ctx.fillRect(plot.l, y + rowH * 0.22, aw, rowH * 0.56); }
      ctx.fillStyle = "#F2F4F8"; ctx.font = "700 10px -apple-system, sans-serif";
      ctx.fillText(`Proj: ${m.projW}-${m.projL}  |  Playoff: ${m.playoffPct.toFixed(0)}%`, plot.l + pw + 10, y + rowH * 0.65);
    }
  } else {
    ctx.fillStyle = "#F2F4F8"; ctx.font = "700 12px -apple-system, sans-serif";
    ctx.fillText("SKILL VS. LUCK MATRIX — LINEUP EFFICIENCY (%) VS. POINTS AGAINST", 20, 24);
    const plot = { l: 92, t: 38, w: W - 125, h: H - 96 };

    const effs = state.managers.map(m => m.eff), pas = state.managers.map(m => m.pa);
    let minE = Math.min(...effs) - 2, maxE = Math.max(...effs) + 2;
    let minP = Math.min(...pas) - 15, maxP = Math.max(...pas) + 15;
    if (maxE - minE < 2) { minE -= 2; maxE += 2; }
    if (maxP - minP < 10) { minP -= 10; maxP += 10; }
    const avgE = effs.reduce((a, b) => a + b, 0) / effs.length;
    const avgP = pas.reduce((a, b) => a + b, 0) / pas.length;

    ctx.strokeStyle = "#222836"; ctx.lineWidth = 1;
    ctx.fillStyle = "#8E96AA"; ctx.font = "600 10px -apple-system, sans-serif";
    for (let i = 0; i <= 4; i++) {
      const r = i / 4;
      const gx = plot.l + r * plot.w, gy = plot.t + (1 - r) * plot.h;
      ctx.beginPath();
      ctx.moveTo(gx, plot.t); ctx.lineTo(gx, plot.t + plot.h);
      ctx.moveTo(plot.l, gy); ctx.lineTo(plot.l + plot.w, gy);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillText((minE + r * (maxE - minE)).toFixed(1) + "%", gx, plot.t + plot.h + 18);
      ctx.textAlign = "right";
      ctx.fillText((minP + r * (maxP - minP)).toFixed(0), plot.l - 10, gy + 4);
    }

    ctx.strokeStyle = "#4A5568"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plot.l, plot.t); ctx.lineTo(plot.l, plot.t + plot.h); ctx.lineTo(plot.l + plot.w, plot.t + plot.h);
    ctx.stroke();

    ctx.fillStyle = "#64D2FF"; ctx.font = "700 11px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LINEUP EFFICIENCY (% OF MAX PF)", plot.l + plot.w / 2, plot.t + plot.h + 44);
    ctx.save();
    ctx.translate(24, plot.t + plot.h / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("POINTS AGAINST (PA)", 0, 0);
    ctx.restore();

    const xAvg = plot.l + ((avgE - minE) / (maxE - minE)) * plot.w;
    const yAvg = plot.t + plot.h - ((avgP - minP) / (maxP - minP)) * plot.h;
    ctx.strokeStyle = "#3B4254"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(xAvg, plot.t); ctx.lineTo(xAvg, plot.t + plot.h);
    ctx.moveTo(plot.l, yAvg); ctx.lineTo(plot.l + plot.w, yAvg); ctx.stroke(); ctx.setLineDash([]);

    state.managers.forEach(m => {
      const x = plot.l + ((m.eff - minE) / (maxE - minE)) * plot.w;
      const y = plot.t + plot.h - ((m.pa - minP) / (maxP - minP)) * plot.h;
      ctx.fillStyle = (m.eff >= avgE && m.pa >= avgP) ? "#FFD60A" : (m.eff >= avgE ? "#30D158" : (m.pa >= avgP ? "#FF453A" : "#FF9F0A"));
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#090A0F"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#F2F4F8"; ctx.font = "700 10px -apple-system, sans-serif";
      const label = m.teamName.split(" (")[0].slice(0, 12);
      const lw = ctx.measureText(label).width;
      if (x + 12 + lw > W - 12) { ctx.textAlign = "right"; ctx.fillText(label, x - 10, y + 4); }
      else { ctx.textAlign = "left"; ctx.fillText(label, x + 10, y + 4); }
    });
    ctx.textAlign = "left";
  }
}

// --- Event Listeners & Boot ---
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    drawPowerChart(); drawWaiverChart(); drawSingleAnalyticsChart(); renderSosTab(); renderPlayoffBracketTab();
  };
});

document.querySelectorAll(".seg-btn").forEach(btn => { btn.onclick = () => switchTradeMode(parseInt(btn.dataset.tmode, 10)); });
document.querySelectorAll(".sos-mode-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".sos-mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active"); state.sosWindowMode = btn.dataset.sosmode; renderSosTab();
  };
});

document.getElementById("syncBtn").onclick = syncUserAccount;
document.getElementById("usernameInput").onkeydown = e => { if (e.key === "Enter") syncUserAccount(); };
document.getElementById("leagueSelect").onchange = e => loadLeague(parseInt(e.target.value, 10));
document.getElementById("teamSelect").onchange = e => {
  const idx = parseInt(e.target.value, 10);
  document.getElementById("tradeTeamA").value = idx;
  renderRosterTab(idx); renderOptimizerTab(idx); renderSosTab(); renderTradeFinder(); buildTradeDatabase();
};
weekSelect.onchange = async e => {
  state.week = parseInt(e.target.value, 10);
  syncLiveEspnSchedule([state.week, state.week + 1, state.week + 2, state.week + 3]);
  renderSosTab();
  if (state.activeLeague) await loadLeague(document.getElementById("leagueSelect").value);
};
document.getElementById("powerChartMode").onchange = drawPowerChart;
document.getElementById("tradeTeamA").onchange = e => {
  document.getElementById("teamSelect").value = e.target.value;
  state.tradeSideA = [];
  renderTradeBuilderSide(true); updateTradeEvaluation();
  buildTradeDatabase();
};
document.getElementById("tradeTeamB").onchange = () => { state.tradeSideB = []; renderTradeBuilderSide(false); updateTradeEvaluation(); };
document.getElementById("clearTradeBtn").onclick = () => { state.tradeSideA = []; state.tradeSideB = []; renderTradeBuilderSide(true); renderTradeBuilderSide(false); updateTradeEvaluation(); };
document.getElementById("dbSearch").oninput = renderTradeDatabase;
document.getElementById("dbRosterScope").onchange = renderTradeDatabase;
document.getElementById("dbPosFilter").onchange = renderTradeDatabase;
document.getElementById("dbSrcFilter").onchange = renderTradeDatabase;
document.getElementById("finderPos").onchange = renderTradeFinder;
document.getElementById("finderPkgType").onchange = renderTradeFinder;
document.getElementById("finderPickMode").onchange = renderTradeFinder;
document.getElementById("finderSosBoost").onchange = renderTradeFinder;
document.getElementById("finderStrat").onchange = renderTradeFinder;
document.getElementById("finderPartnerType").onchange = renderTradeFinder;
document.getElementById("waiverPos").onchange = renderWaiversTab;
document.getElementById("waiverChartMode").onchange = drawWaiverChart;
document.getElementById("analyticsPos").onchange = () => { updateAnalyticsDropdownOptions(); drawSingleAnalyticsChart(); };
document.getElementById("analyticsGraphSelect").onchange = drawSingleAnalyticsChart;
document.getElementById("analyticsSortKey").onchange = () => { analyticsSortDir = -1; drawSingleAnalyticsChart(); };
document.getElementById("toggleAnalyticsFormulaBtn").onclick = () => {
  const el = document.getElementById("analyticsFormulaCard");
  if (el) el.style.display = el.style.display === "none" ? "flex" : "none";
};
document.getElementById("toggleTradeFormulaBtn").onclick = () => {
  const el = document.getElementById("tradeFormulaBox");
  if (el) el.style.display = el.style.display === "none" ? "block" : "none";
};
document.getElementById("sosPos").onchange = renderSosTab;
document.getElementById("sosScope").onchange = renderSosTab;
document.getElementById("sosSort").onchange = renderSosTab;
document.getElementById("bracketTeamsOverride").onchange = () => { state.bracketOverrides = {}; renderPlayoffBracketTab(); renderSosTab(); renderTradeFinder(); };
document.getElementById("bracketSeedMode").onchange = () => { state.bracketOverrides = {}; renderPlayoffBracketTab(); };
document.getElementById("bracketReseedMode").onchange = () => { delete state.bracketOverrides.sf1; delete state.bracketOverrides.sf2; delete state.bracketOverrides.champ; delete state.bracketOverrides.third; renderPlayoffBracketTab(); };
document.getElementById("resetBracketBtn").onclick = () => { state.bracketOverrides = {}; renderPlayoffBracketTab(); };
document.getElementById("simTeamA").onchange = renderMatchupSim;
document.getElementById("simTeamB").onchange = renderMatchupSim;
document.getElementById("shareBtn").onclick = () => {
  const u = document.getElementById("usernameInput").value.trim();
  const url = `${location.origin}${location.pathname}?user=${encodeURIComponent(u)}&week=${state.week}`;
  navigator.clipboard.writeText(url);
  setStatus("Shareable link copied to clipboard!");
};
window.addEventListener("resize", () => { drawPowerChart(); drawWaiverChart(); drawSingleAnalyticsChart(); });

initApp();