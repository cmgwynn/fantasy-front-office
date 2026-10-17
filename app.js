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

const ANALYTICS_CONFIGS = {
  QB: [
    { title: "QB View 1: Passing Yards per Game vs. Passing Touchdowns per Game", xKey: "passYdsPerGame", yKey: "passTdPerGame", xLbl: "Passing Yards per Game", yLbl: "Passing TDs per Game" },
    { title: "QB View 2: Completion Pct Over Expected (CPOE) vs. EPA per Play", xKey: "cpoeVal", yKey: "epaPerPlay", xLbl: "Completion % Over Expected (CPOE)", yLbl: "Expected Points Added (EPA/Play)" },
    { title: "QB View 3: Rushing Attempts per Game vs. Season Fantasy PPG", xKey: "rushAttPerGame", yKey: "seasonPpg", xLbl: "Rushing Attempts per Game", yLbl: "Season Fantasy PPG" }
  ],
  RB: [
    { title: "RB View 1: Projected Gold Touches (RZ + GL) vs. Projected Receiving Targets", xKey: "goldTouchesPerGame", yKey: "targetsPerGame", xLbl: "Gold Touches / Gm (RZ + GL)", yLbl: "Receiving Targets / Gm" },
    { title: "RB View 2: Offensive Snap Share (%) vs. Rush Yards Over Expected (RYOE/Gm)", xKey: "snapSharePct", yKey: "ryoePerGame", xLbl: "Offensive Snap Share (%)", yLbl: "Rush Yds Over Expected / Gm" },
    { title: "RB View 3: Total Touches per Game vs. Season Fantasy PPG", xKey: "touchesPerGame", yKey: "seasonPpg", xLbl: "Total Touches per Game", yLbl: "Season Fantasy PPG" }
  ],
  WR: [
    { title: "WR View 1: Targets per Route Run (TPRR) vs. Yards per Route Run (YPRR)", xKey: "tprrPct", yKey: "yprrVal", xLbl: "Targets per Route Run (%)", yLbl: "Yards per Route Run (YPRR)" },
    { title: "WR View 2: Target Volume (Tgts/Gm) vs. Yards per Target Over Expected (YPTOE)", xKey: "targetsPerGame", yKey: "yptoeVal", xLbl: "Targets per Game", yLbl: "Yards / Target Over Expected" },
    { title: "WR View 3: Receptions per Game vs. Season Fantasy PPG", xKey: "receptionsPerGame", yKey: "seasonPpg", xLbl: "Receptions per Game", yLbl: "Season Fantasy PPG" }
  ],
  TE: [
    { title: "TE View 1: Route Participation (%) vs. Targets per Route Run (TPRR %)", xKey: "snapSharePct", yKey: "tprrPct", xLbl: "Route Participation (%)", yLbl: "Targets per Route Run (%)" },
    { title: "TE View 2: Red Zone Target Share vs. Season Fantasy PPG", xKey: "targetsPerGame", yKey: "seasonPpg", xLbl: "Targets per Game", yLbl: "Season Fantasy PPG" },
    { title: "TE View 3: Yards per Route Run (YPRR) vs. Dynasty Trade Value", xKey: "yprrVal", yKey: "baseValue", xLbl: "Yards per Route Run (YPRR)", yLbl: "Market Trade Value" }
  ],
  DEF: [
    { title: "DEF View 1: Sacks per Game vs. Takeaways per Game (INT + Fumble Rec)", xKey: "sacksPerGame", yKey: "takeawaysPerGame", xLbl: "Sacks per Game", yLbl: "Takeaways per Game" },
    { title: "DEF View 2: Havoc Plays per Game (Sacks + Takeaways) vs. Season Fantasy PPG", xKey: "defPlaysPerGame", yKey: "seasonPpg", xLbl: "Havoc Plays / Gm (Sacks + TO)", yLbl: "Season Fantasy PPG" },
    { title: "DEF View 3: Season Fantasy PPG vs. Weekly Projected Points", xKey: "seasonPpg", yKey: "projectedPoints", xLbl: "Season Fantasy PPG", yLbl: "Weekly Projected Points" }
  ]
};

const state = {
  season: "2026", week: 6, userId: "", leagues: [], activeLeague: null,
  players: {}, rawProj: {}, rawStats: {}, managers: [],
  tradeSideA: [], tradeSideB: [], dbTrades: [], waiverTargets: [],
  weakestPosByTeam: {}, sosWindowMode: "NEXT4", bracketOverrides: {}
};

const weekSelect = document.getElementById("weekSelect");
for (let w = 1; w <= 18; w++) {
  const opt = document.createElement("option"); opt.value = w; opt.textContent = `Week ${w}`;
  weekSelect.appendChild(opt);
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

  // Build Draft Pick Ownership Map if league format supports picks
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

function classifyManagerArchetype(mgr) {
  if (!mgr || !state.managers.length) {
    return { code: "BUBBLE", label: "PLAYOFF BUBBLE", roleTag: "WIN-NOW SWAPS", badgeCls: "badge-yellow" };
  }
  const pSpots = getResolvedPlayoffTeamCount();
  const topContenderCut = Math.max(2, Math.ceil(pSpots * 0.67));

  if (mgr.currentRank <= topContenderCut || mgr.playoffPct >= 68) {
    return { code: "CONTENDER", label: "TITLE CONTENDER", roleTag: "BUYING VETERANS", badgeCls: "badge-green" };
  }
  if (mgr.currentRank > pSpots + 1 || mgr.playoffPct <= 38) {
    return { code: "REBUILDER", label: "REBUILDER • SELLER", roleTag: "WANTS PICKS / YOUTH", badgeCls: "badge-red" };
  }
  return { code: "BUBBLE", label: "PLAYOFF BUBBLE", roleTag: "URGENT WIN-NOW", badgeCls: "badge-yellow" };
}

function renderTradeFinder() {
  const myIdx = parseInt(document.getElementById("tradeTeamA").value, 10) || 0;
  const myTm = state.managers[myIdx];
  const arrow = k => (finderSortKey === k ? (finderSortDir === -1 ? " ▼" : " ▲") : "");
  const tbl = document.getElementById("finderTable");
  tbl.innerHTML = `<thead><tr><th style="text-align:left;width:245px;cursor:pointer;" data-fsort="partnerRank">Trade Partner & Archetype Fit${arrow("partnerRank")}</th><th style="text-align:left;cursor:pointer;color:var(--bad);" data-fsort="giveVal">You Send (Val)${arrow("giveVal")}</th><th style="text-align:left;cursor:pointer;color:var(--good);" data-fsort="getVal">You Receive (Val)${arrow("getVal")}</th><th style="width:140px;cursor:pointer;" data-fsort="match">Package Match${arrow("match")}</th><th style="width:190px;cursor:pointer;color:var(--accent);" data-fsort="dMy">ROS & Playoff PPG Impact${arrow("dMy")}</th><th style="width:135px;">Modify Trade</th></tr></thead><tbody></tbody>`;

  tbl.querySelectorAll("th[data-fsort]").forEach(th => {
    th.onclick = () => {
      const k = th.dataset.fsort;
      if (finderSortKey === k) finderSortDir *= -1;
      else { finderSortKey = k; finderSortDir = -1; }
      renderTradeFinder();
    };
  });

  const tbody = tbl.querySelector("tbody");
  if (!myTm || state.managers.length < 2) {
    document.getElementById("posGradesGrid").innerHTML = "";
    tbody.innerHTML = `<tr><td colspan="6" style="padding:24px;color:var(--text-muted);">Sync your Sleeper account above to analyze positional grades, Contender vs. Rebuilder tags, and archetype-matched trades.</td></tr>`;
    document.getElementById("finderCountLbl").textContent = "0 proposals";
    return;
  }

  const diag = computeLeaguePositionalGrades(myIdx);
  const rawPosSel = document.getElementById("finderPos").value;
  const targetPos = rawPosSel === "AUTO" ? diag.weakestPos : rawPosSel;
  const partnerTypeFilter = document.getElementById("finderPartnerType")?.value || "ALL";
  const pkgTypeFilter = document.getElementById("finderPkgType").value || "ALL";
  const pickMode = document.getElementById("finderPickMode")?.value || "AUTO";
  const sosBoostMode = document.getElementById("finderSosBoost").value || "BOOST";
  const strat = parseInt(document.getElementById("finderStrat").value || "0", 10);

  const leagueSupportsPicks = isPickTradingAllowedInLeague();
  const allowPicks = leagueSupportsPicks && (pickMode !== "OFF");

  const myBase = calcOptimalLineup(myTm.players, true).total;
  const myPlayoffBase = calcPlayoffWindowAvgLineupPpg(myTm.players);
  const myPl = myTm.players.map(id => state.players[id])
    .filter(p => p && !p.isPick && p.isCurrentNfl && ["QB","RB","WR","TE"].includes(p.position) && p.baseValue >= 900)
    .sort((a, b) => b.baseValue - a.baseValue);
  const myPicks = allowPicks ? (myTm.ownedPicks || []).slice().sort((a, b) => b.baseValue - a.baseValue) : [];

  const props = [];
  const seenKeys = new Set();

  function findBestBalancingPick(picksPool, neededValue) {
    if (!picksPool || !picksPool.length || neededValue < 250) return null;
    let bestPick = null, minDiff = Infinity;
    for (const pk of picksPool) {
      const diff = Math.abs(pk.baseValue - neededValue);
      if (diff < minDiff) { minDiff = diff; bestPick = pk; }
    }
    return bestPick;
  }

  function evaluateAndPushCandidate(part, tIdx, partArch, partBase, giveIds, getIds, dealType, badgeCls, customNote) {
    if (partnerTypeFilter !== "ALL" && partArch.code !== partnerTypeFilter) return;
    const hasPickInDeal = giveIds.some(id => String(id).startsWith("PICK_")) || getIds.some(id => String(id).startsWith("PICK_"));
    if (!allowPicks && hasPickInDeal) return;
    if (pkgTypeFilter === "PICK_PKG" && !hasPickInDeal) return;

    const key = [...giveIds].sort().join(",") + "|" + [...getIds].sort().join(",");
    if (seenKeys.has(key)) return;

    const getObjs = getIds.map(id => state.players[id]).filter(Boolean);
    const giveObjs = giveIds.map(id => state.players[id]).filter(Boolean);
    const getPlayersOnly = getObjs.filter(p => !p.isPick);
    const givePlayersOnly = giveObjs.filter(p => !p.isPick);
    if (!getPlayersOnly.length || !givePlayersOnly.length) return;

    if (targetPos !== "ALL") {
      const bestInAtTarget = Math.max(0, ...getPlayersOnly.filter(p => p.position === targetPos).map(p => p.baseValue));
      const bestOutAtTarget = Math.max(0, ...givePlayersOnly.filter(p => p.position === targetPos).map(p => p.baseValue));
      if (bestInAtTarget <= bestOutAtTarget) return;
    }

    const inSosList = getPlayersOnly.map(getPlayerPlayoffSosProfile);
    const outSosList = givePlayersOnly.map(getPlayerPlayoffSosProfile);
    const hasElitePlayoffTarget = inSosList.some(s => s.isElite);
    const avgInDvP = inSosList.reduce((s, x) => s + x.avgRank, 0) / Math.max(1, inSosList.length);
    const avgOutDvP = outSosList.reduce((s, x) => s + x.avgRank, 0) / Math.max(1, outSosList.length);
    const netDvPGain = avgInDvP - avgOutDvP;

    if (sosBoostMode === "STRICT" && !hasElitePlayoffTarget) return;

    const rawGive = giveObjs.reduce((s, p) => s + p.baseValue, 0);
    const rawGet = getObjs.reduce((s, p) => s + p.baseValue, 0);
    const cA = giveIds.length, cB = getIds.length;
    let adjGive = rawGive, adjGet = rawGet;
    if (cA !== cB) {
      const tax = 1 - Math.min(0.16, Math.abs(cA - cB) * 0.06);
      if (cA > cB) adjGive = Math.round(rawGive * tax);
      else adjGet = Math.round(rawGet * tax);
    }

    const maxV = Math.max(adjGive, adjGet);
    const match = maxV > 0 ? (1 - Math.abs(adjGive - adjGet) / maxV) * 100 : 0;
    if (match < 85) return;
    if (strat === 2 && match < 92) return;

    const givePlayerIds = giveIds.filter(id => !String(id).startsWith("PICK_"));
    const getPlayerIds = getIds.filter(id => !String(id).startsWith("PICK_"));
    const myAfter = myTm.players.filter(id => !givePlayerIds.includes(id)).concat(getPlayerIds);
    const ptAfter = part.players.filter(id => !getPlayerIds.includes(id)).concat(givePlayerIds);
    const dMy = calcOptimalLineup(myAfter, true).total - myBase;
    const dPt = calcOptimalLineup(ptAfter, true).total - partBase;
    const dPlayoffMy = calcPlayoffWindowAvgLineupPpg(myAfter) - myPlayoffBase;

    const partnerGetsPick = giveIds.some(id => String(id).startsWith("PICK_"));
    const partnerGetsYoungAsset = givePlayersOnly.some(p => p.age > 0 && p.age <= 25);
    const partnerGetsVeteranStarter = givePlayersOnly.some(p => p.seasonPpg >= 11.2 || p.age >= 26);

    let archetypeFitBonus = 0;
    let archetypeReason = "";

    if (partArch.code === "REBUILDER") {
      if (partnerGetsPick && weGetVeteranStarter) { archetypeFitBonus += 1.85; archetypeReason = "Rebuilder receives future pick for starting vet"; }
      else if (partnerGetsYoungAsset && weGetVeteranStarter) { archetypeFitBonus += 1.25; archetypeReason = "Rebuilder gets younger asset (≤25yo) for vet starter"; }
      else if (givePlayersOnly.length > getPlayersOnly.length) { archetypeFitBonus += 0.90; archetypeReason = "Rebuilder acquires multiple roster assets for stud"; }
      if (weGetPick && !partnerGetsPick) archetypeFitBonus -= 1.50;
    } else if (partArch.code === "CONTENDER") {
      if (dPt >= 0.25 && partnerGetsVeteranStarter) { archetypeFitBonus += 1.65; archetypeReason = `Contender gains +${dPt.toFixed(1)} starting PPG for title push`; }
      else if (weGetPick && partnerGetsVeteranStarter) { archetypeFitBonus += 1.45; archetypeReason = "Contender trades future pick for win-now starter"; }
    } else {
      if (dPt >= 0.15 && dMy >= 0.15) { archetypeFitBonus += 1.15; archetypeReason = "Win-now starter swap for Playoff Bubble team"; }
    }

    const effectiveMyGain = sosBoostMode !== "OFF" ? Math.max(dMy, dPlayoffMy) : dMy;
    let minPartnerDelta = -0.25;
    if (partArch.code === "REBUILDER" && (partnerGetsPick || partnerGetsYoungAsset || givePlayersOnly.length > getPlayersOnly.length)) minPartnerDelta = -3.50;
    else if (partnerGetsPick) minPartnerDelta = -1.50;

    if (strat === 0 && (effectiveMyGain < 0.05 || dPt < minPartnerDelta)) return;
    if (strat === 1 && effectiveMyGain < 0.25) return;
    if (strat === 2 && (effectiveMyGain <= 0 && dPt <= 0 && archetypeFitBonus <= 0)) return;

    let sosRankBonus = 0;
    if (sosBoostMode !== "OFF") {
      if (hasElitePlayoffTarget) sosRankBonus += 1.35;
      sosRankBonus += (netDvPGain / 10) * 0.75;
      sosRankBonus += (dPlayoffMy - dMy) * 0.85;
    }
    if (hasPickInDeal && allowPicks) sosRankBonus += 0.45;

    const compositeScore = dMy * 1.35 + Math.max(-0.5, dPt * 0.65) + sosRankBonus + archetypeFitBonus;
    seenKeys.add(key);
    props.push({
      part, partnerIdx: tIdx, partnerRank: part.currentRank, partArch,
      giveIds, getIds, giveVal: adjGive, getVal: adjGet,
      match, dMy, dPt, dPlayoffMy, compositeScore,
      hasElitePlayoffTarget, hasPickInDeal, sosRankBonus, archetypeFitBonus,
      archetypeReason: archetypeReason || customNote, dealType, badgeCls, note: customNote
    });
  }

  state.managers.forEach((part, tIdx) => {
    if (tIdx === myIdx) return;
    const partArch = classifyManagerArchetype(part);
    if (partnerTypeFilter !== "ALL" && partArch.code !== partnerTypeFilter) return;

    const partBase = calcOptimalLineup(part.players, true).total;
    const thPl = part.players.map(id => state.players[id])
      .filter(p => p && !p.isPick && p.isCurrentNfl && ["QB","RB","WR","TE"].includes(p.position) && p.baseValue >= 900)
      .sort((a, b) => b.baseValue - a.baseValue);
    const thPicks = allowPicks ? (part.ownedPicks || []).slice().sort((a, b) => b.baseValue - a.baseValue) : [];

    if (pkgTypeFilter === "ALL" || pkgTypeFilter === "MULTI" || pkgTypeFilter === "2FOR1" || pkgTypeFilter === "PICK_PKG") {
      thPl.slice(0, 7).forEach(stud => {
        if (targetPos !== "ALL" && stud.position !== targetPos) return;
        if (stud.baseValue < 2400) return;
        for (let m1 = 0; m1 < Math.min(10, myPl.length); m1++) {
          if (myPl[m1].baseValue >= stud.baseValue * 0.92) continue;
          for (let m2 = m1 + 1; m2 < Math.min(11, myPl.length); m2++) {
            const pairVal = Math.round((myPl[m1].baseValue + myPl[m2].baseValue) * 0.94);
            if (pkgTypeFilter !== "PICK_PKG") evaluateAndPushCandidate(part, tIdx, partArch, partBase, [myPl[m1].id, myPl[m2].id], [stud.id], "2-FOR-1 CONSOLIDATION", "badge-purple", `Package ${myPl[m1].position}+${myPl[m2].position} depth for elite ${stud.position}1`);
            if (allowPicks) {
              const gap = stud.baseValue - pairVal;
              if (gap > 300 && gap < 3600) {
                const balPick = findBestBalancingPick(myPicks, gap);
                if (balPick) evaluateAndPushCandidate(part, tIdx, partArch, partBase, [myPl[m1].id, myPl[m2].id, balPick.id], [stud.id], "2-FOR-1 + PICK", "badge-purple", `Offer ${balPick.season} Rd ${balPick.round} + depth to ${partArch.code === 'REBUILDER' ? 'Rebuilder' : 'partner'} for ${stud.name.split(" ").pop()}`);
              } else if (gap < -350 && gap > -3200 && partArch.code !== "REBUILDER") {
                const retPick = findBestBalancingPick(thPicks, Math.abs(gap));
                if (retPick) evaluateAndPushCandidate(part, tIdx, partArch, partBase, [myPl[m1].id, myPl[m2].id], [stud.id, retPick.id], "2-FOR-1 + PICK RETURN", "badge-purple", `Consolidate for ${stud.name.split(" ").pop()} + ${retPick.season} Rd ${retPick.round} pick back`);
              }
            }
          }
        }
      });
    }

    if (pkgTypeFilter === "ALL" || pkgTypeFilter === "1FOR1" || pkgTypeFilter === "PICK_PKG") {
      myPl.slice(0, 11).forEach(gP => {
        thPl.slice(0, 11).forEach(rP => {
          if (pkgTypeFilter !== "PICK_PKG" && gP.position !== rP.position) {
            if (targetPos === "ALL" || rP.position === targetPos) {
              const swapNote = partArch.code === "REBUILDER" && gP.age <= 25 && rP.age >= 26 ? `Send young ${gP.age}yo ${gP.position} to Rebuilder for veteran ${rP.position} starter` : `Direct ${gP.position} surplus for ${rP.position} starter swap`;
              evaluateAndPushCandidate(part, tIdx, partArch, partBase, [gP.id], [rP.id], "1-FOR-1 SWAP", "badge-blue", swapNote);
            }
          }
          if (allowPicks && gP.id !== rP.id) {
            if (targetPos !== "ALL" && rP.position !== targetPos) return;
            const rawDiff = rP.baseValue - gP.baseValue;
            if (rawDiff >= 350 && rawDiff <= 4500) {
              const myBalPick = findBestBalancingPick(myPicks, Math.round(rawDiff * 1.06));
              if (myBalPick) {
                const dealLbl = partArch.code === "REBUILDER" ? "BUY VET FROM REBUILDER" : "PLAYER + PICK → STUD";
                evaluateAndPushCandidate(part, tIdx, partArch, partBase, [gP.id, myBalPick.id], [rP.id], dealLbl, "badge-green", `Send ${myBalPick.season} Rd ${myBalPick.round} + ${gP.name.split(" ").pop()} to ${partArch.label.split(" ")[0]} for ${rP.name.split(" ").pop()}`);
              }
            } else if (rawDiff <= -350 && rawDiff >= -4200 && gP.position !== rP.position && partArch.code !== "REBUILDER") {
              const thBalPick = findBestBalancingPick(thPicks, Math.round(Math.abs(rawDiff) * 1.06));
              if (thBalPick) {
                const dealLbl = partArch.code === "CONTENDER" ? "SELL VET TO CONTENDER" : "1-FOR-1 + PICK GAIN";
                evaluateAndPushCandidate(part, tIdx, partArch, partBase, [gP.id], [rP.id, thBalPick.id], dealLbl, "badge-blue", `Sell ${gP.name.split(" ").pop()} to ${partArch.label.split(" ")[0]} for ${rP.name.split(" ").pop()} + ${thBalPick.season} Rd ${thBalPick.round}`);
              }
            }
          }
        });
      });
    }

    if (pkgTypeFilter === "ALL" || pkgTypeFilter === "MULTI" || pkgTypeFilter === "2FOR2") {
      thPl.slice(0, 7).forEach(t1 => {
        if (targetPos !== "ALL" && t1.position !== targetPos) return;
        for (let m1 = 0; m1 < Math.min(8, myPl.length); m1++) {
          const g1 = myPl[m1];
          if (g1.baseValue >= t1.baseValue * 0.92 || g1.baseValue < t1.baseValue * 0.45) continue;
          for (let m2 = 0; m2 < Math.min(9, myPl.length); m2++) {
            if (m2 === m1) continue;
            const g2 = myPl[m2];
            for (let ti2 = 1; ti2 < Math.min(10, thPl.length); ti2++) {
              const t2 = thPl[ti2];
              if (t2.id === t1.id || g2.baseValue <= t2.baseValue) continue;
              evaluateAndPushCandidate(part, tIdx, partArch, partBase, [g1.id, g2.id], [t1.id, t2.id], "2-FOR-2 PACKAGE", "badge-green", `Upgrade to ${t1.name.split(" ").pop()} (${t1.position}) while balancing ${g2.position}/${t2.position}`);
            }
          }
        }
      });
    }

    if (pkgTypeFilter === "ALL" || pkgTypeFilter === "MULTI") {
      myPl.slice(0, 4).forEach(myStud => {
        if (myStud.baseValue < 3200 || (targetPos !== "ALL" && myStud.position === targetPos)) return;
        for (let t1 = 0; t1 < Math.min(8, thPl.length); t1++) {
          if (thPl[t1].baseValue >= myStud.baseValue * 0.90) continue;
          for (let t2 = t1 + 1; t2 < Math.min(10, thPl.length); t2++) {
            evaluateAndPushCandidate(part, tIdx, partArch, partBase, [myStud.id], [thPl[t1].id, thPl[t2].id], "1-FOR-2 DEPTH", "badge-yellow", `Sell ${myStud.position} stud to ${partArch.label.split(" ")[0]} for 2 startable upgrades`);
          }
        }
      });
    }
  });

  const dir = finderSortDir === 1 ? -1 : 1;
  props.sort((a, b) => {
    if (finderSortKey === "giveVal") return (b.giveVal - a.giveVal) * dir;
    if (finderSortKey === "getVal") return (b.getVal - a.getVal) * dir;
    if (finderSortKey === "match") return (b.match - a.match) * dir;
    if (finderSortKey === "partnerRank") return (a.partnerRank - b.partnerRank) * dir;
    if (finderSortKey === "dMy") return (b.dMy - a.dMy) * dir;
    if (strat === 1) return ((b.dMy + b.sosRankBonus + b.archetypeFitBonus * 0.5) - (a.dMy + a.sosRankBonus + a.archetypeFitBonus * 0.5)) * dir;
    if (strat === 2) return ((b.match + b.sosRankBonus * 2.5) - (a.match + a.sosRankBonus * 2.5)) * dir;
    return (b.compositeScore - a.compositeScore) * dir;
  });

  const topProps = props.slice(0, 16);
  document.getElementById("finderCountLbl").textContent = `${topProps.length} proposals`;

  if (!topProps.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:24px;color:var(--warn);">No strict matches for this filter combination. Try switching Partner Status to "All Partners" or Package Size to "All Packages".</td></tr>`;
    return;
  }

  topProps.forEach(pr => {
    const tr = document.createElement("tr");
    tr.className = "table-row-hover";
    const sosCalloutBadge = pr.hasElitePlayoffTarget ? `<span class="badge badge-green" style="margin-left:4px;">PLAYOFF SOS (A/A+)</span>` : "";
    const pickCalloutBadge = pr.hasPickInDeal ? `<span class="badge badge-blue" style="margin-left:4px;">PICK BALANCED</span>` : "";

    tr.innerHTML = `
      <td style="text-align:left;">
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:5px;">
          <span class="badge ${pr.partArch.badgeCls}">${pr.partArch.label}</span>
          <span class="badge ${pr.badgeCls}">${pr.dealType}</span>${pickCalloutBadge}${sosCalloutBadge}
        </div>
        <div style="font-weight:800;font-size:13px;">${pr.part.teamName.split(" (")[0]}</div>
        <div style="font-size:11px;color:var(--accent);font-weight:700;margin-top:2px;">Rank #${pr.part.currentRank} (${pr.part.wins}-${pr.part.losses} • ${pr.part.playoffPct.toFixed(0)}% Playoff Odds)</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${pr.archetypeReason}</div>
      </td>
      <td>${renderTradeAssetStackHTML(pr.giveIds)}</td>
      <td>${renderTradeAssetStackHTML(pr.getIds)}</td>
      <td>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:center;">
          <span class="badge ${pr.match >= 92 ? 'badge-green' : 'badge-blue'}">${pr.match.toFixed(0)}% Value Match</span>
          <div style="font-size:11px;color:var(--text-muted);font-weight:700;">${pr.giveVal} vs ${pr.getVal}</div>
        </div>
      </td>
      <td>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:center;">
          <span class="badge ${pr.dMy >= 0 ? 'badge-green' : 'badge-yellow'}">ROS: ${pr.dMy >= 0 ? '+' : ''}${pr.dMy.toFixed(2)} PPG</span>
          <span class="badge ${pr.dPlayoffMy >= pr.dMy && pr.dPlayoffMy > 0 ? 'badge-green' : 'badge-purple'}">Playoffs: ${pr.dPlayoffMy >= 0 ? '+' : ''}${pr.dPlayoffMy.toFixed(2)} PPG</span>
          <span style="font-size:10px;color:var(--text-muted);font-weight:700;">Partner: ${pr.dPt >= 0 ? '+' : ''}${pr.dPt.toFixed(2)} PPG</span>
        </div>
      </td>
      <td><button class="btn-builder-action">Open in Builder →</button></td>`;
    tr.querySelector("button").onclick = () => openTradeInBuilder(pr.giveIds, pr.getIds, myIdx, pr.partnerIdx);
    tbody.appendChild(tr);
  });
}
// === END BLOCK 2: STOP REPLACING RIGHT BEFORE function renderOptimizerTab(idx) { ===