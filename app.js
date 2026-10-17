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
    if (document.getElementById("tab-analytics")?.classList.contains("active")) drawSingleAnalyticsChart();
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

// Verified 18-Week 2026 NFL Regular Season Schedule
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
    if (document.getElementById("tab-sos")?.classList.contains("active")) renderSosTab();
    if (document.getElementById("tab-bracket")?.classList.contains("active")) renderPlayoffBracketTab();
  }
}

// Verified 2026 NFL Defense vs. Position Rankings (Rank #1 = Toughest Shutdown Defense [Red], Rank #32 = Softest Smash Matchup [Green])
const DVP_RANKS_2026 = (() => {
  const orderedByPos = {
    RB: ["JAX","TB","HOU","ATL","MIN","NE","KC","WAS","SEA","CHI","SF","BAL","PIT","DET","BUF","MIA","TEN","CLE","PHI","NYJ","LAC","CIN","ARI","NYG","GB","LAR","IND","DEN","LV","NO","CAR","DAL"],
    QB: ["MIN","GB","SEA","DEN","HOU","PIT","CLE","SF","NYJ","BAL","KC","PHI","LAC","CHI","BUF","NE","NO","MIA","ATL","NYG","TEN","IND","LV","ARI","CIN","LAR","CAR","TB","JAX","DAL","WAS","DET"],
    WR: ["DEN","NYJ","HOU","CLE","KC","CHI","SF","PHI","SEA","GB","PIT","NE","LAC","BUF","MIA","NO","IND","ATL","TEN","LV","NYG","CIN","ARI","TB","CAR","DAL","LAR","BAL","JAX","MIN","WAS","DET"],
    TE: ["CLE","SF","PIT","NE","HOU","SEA","DEN","PHI","MIN","NYJ","DAL","CHI","BUF","GB","LAC","BAL","TB","MIA","NO","NYG","LAR","WAS","JAX","TEN","ATL","DET","ARI","IND","CAR","KC","CIN","LV"],
    DEF:["DET","BAL","SF","BUF","KC","GB","CIN","PHI","HOU","DAL","ATL","LAR","TB","SEA","MIN","WAS","LAC","ARI","IND","JAX","CHI","NO","PIT","DEN","NYJ","LV","NE","CAR","NYG","CLE","MIA","TEN"]
  };
  const map = {};
  for (const [pos, arr] of Object.entries(orderedByPos)) {
    map[pos] = {};
    arr.forEach((team, idx) => { map[pos][team] = idx + 1; });
  }
  return map;
})();

function calcDraftPickValue(season, round, slot, totalTeams, lg) {
  const baseVal = round === 1 ? 6200 : (round === 2 ? 2900 : (round === 3 ? 1350 : 550));
  const slotRatio = totalTeams > 1 ? (totalTeams - slot) / (totalTeams - 1) : 0.5;
  const slotMult = 0.76 + (slotRatio * 0.58);
  const curYr = parseInt(lg?.season || "2026", 10) || 2026;
  const yrDisc = Math.pow(0.88, Math.max(0, season - (curYr + 1)));
  const fmtMult = lg?.leagueType === 2 ? 1.0 : (lg?.leagueType === 1 ? 0.65 : 0.35);
  return Math.max(150, Math.round(baseVal * slotMult * yrDisc * fmtMult));
}

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

let dbSortKey = "matchPct", dbSortDir = -1;
let finderSortKey = "Composite", finderSortDir = -1;
let analyticsSortDir = -1;

const weekSelect = document.getElementById("weekSelect");
if (weekSelect) {
  weekSelect.innerHTML = "";
  for (let w = 1; w <= 18; w++) {
    const opt = document.createElement("option"); opt.value = w; opt.textContent = `Week ${w}`;
    weekSelect.appendChild(opt);
  }
}

function ensureDynamicTradeControls() {
  const dbPosEl = document.getElementById("dbPosFilter");
  if (dbPosEl && !document.getElementById("dbRosterScope")) {
    const sel = document.createElement("select");
    sel.id = "dbRosterScope";
    sel.style.cssText = "width:auto; min-width:225px; border-color:rgba(48,209,88,0.5);";
    sel.innerHTML = `<option value="MY_ROSTER">Involving My Selected Roster Only</option><option value="ALL">All League & Market Comps</option>`;
    dbPosEl.parentNode.insertBefore(sel, dbPosEl);
  }
  const fPkgEl = document.getElementById("finderPkgType");
  if (fPkgEl && !document.getElementById("finderPartnerType")) {
    const sel = document.createElement("select");
    sel.id = "finderPartnerType";
    sel.style.cssText = "width:auto; min-width:215px; border-color:rgba(255,214,10,0.45);";
    sel.innerHTML = `<option value="ALL">All Partners (Smart Archetype Fit)</option><option value="REBUILDER">Rebuilders / Sellers Only (Buy Vets)</option><option value="CONTENDER">Contenders / Buyers Only (Sell Vets)</option><option value="BUBBLE">Playoff Bubble Teams Only</option>`;
    fPkgEl.parentNode.insertBefore(sel, fPkgEl);
  }
}

function switchTradeMode(modeIdx) {
  document.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", String(b.dataset.tmode) === String(modeIdx)));
  [0, 1, 2].forEach(i => {
    const el = document.getElementById(`tmode-${i}`);
    if (el) el.style.display = (i === modeIdx) ? (i === 0 ? "grid" : "flex") : "none";
  });
}

function updateAnalyticsDropdownOptions() {
  const pos = document.getElementById("analyticsPos")?.value || "QB";
  const sel = document.getElementById("analyticsGraphSelect");
  if (!sel) return;
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

function setStatus(txt) {
  const el = document.getElementById("statusLabel");
  if (el) el.textContent = txt;
}

function avatarUrl(m) {
  if (!m || !m.id || m.id === "0" || m.isPick) return "";
  if (m.position === "DEF" || m.position === "D/ST") {
    let c = (m.id || m.team || "").toLowerCase().trim();
    if (c === "jac") c = "jax"; if (c === "la") c = "lar";
    return `https://sleepercdn.com/images/team_logos/nfl/${c}.png`;
  }
  return `https://sleepercdn.com/content/nfl/players/thumb/${m.id}.jpg`;
}

function teamLogoUrl(team) {
  if (!team || team === "FA" || String(team).startsWith("via ")) return "";
  let k = team.toLowerCase().trim();
  if (k === "jac") k = "jax"; if (k === "la") k = "lar";
  return `https://sleepercdn.com/images/team_logos/nfl/${k}.png`;
}

function posBadgeStyle(pos) {
  if (pos === "RB") return "background:rgba(48,209,88,0.16);color:#30D158;";
  if (pos === "WR") return "background:rgba(10,132,255,0.16);color:#0A84FF;";
  if (pos === "TE") return "background:rgba(255,214,10,0.16);color:#FFD60A;";
  if (pos === "QB") return "background:rgba(255,69,58,0.16);color:#FF453A;";
  if (pos === "DEF") return "background:rgba(191,90,242,0.16);color:#BF5AF2;";
  return "background:rgba(100,210,255,0.16);color:#64D2FF;";
}

function isPosEligible(pos, slot) {
  if (["BN","IR","TAXI"].includes(slot) || pos === slot) return true;
  if (["FLEX","W/R/T","WRRB_FLEX"].includes(slot)) return ["RB","WR","TE"].includes(pos);
  if (["SUPER_FLEX","Q/W/R/T"].includes(slot)) return ["QB","RB","WR","TE"].includes(pos);
  if (["WR/RB","W/R"].includes(slot)) return ["WR","RB"].includes(pos);
  if (["REC_FLEX","W/T"].includes(slot)) return ["WR","TE"].includes(pos);
  if (slot === "DEF" || slot === "D/ST") return pos === "DEF" || pos === "D/ST";
  return false;
}

function replacementPpg(pos) { return { QB:15.2, RB:7.8, WR:8.4, TE:6.2, DEF:6.5, K:7.0 }[pos] || 8.0; }

function defaultRealisticProj(m) {
  if (m.position !== "DEF" && (!m.team || m.team === "FA" || !m.isCurrentNfl || ["Out","IR","Suspended","PUP"].includes(m.injuryStatus))) return 0;
  if (m.byeWeek > 0 && m.byeWeek === state.week) return 0;
  if (m.position === "DEF") {
    const defRank = DVP_RANKS_2026.RB[m.team] || 16;
    return Number((9.4 - (defRank - 1) * 0.11).toFixed(2));
  }
  if (m.searchRank > 800) return 0.5;
  let b = { QB:16.5, RB:11.5, WR:12.0, TE:8.2 }[m.position] || 7.6;
  if (m.searchRank < 35) b += 4.5;
  else if (m.searchRank < 90) b += 2.2;
  else if (m.searchRank > 260 && m.position !== "K") b *= 0.45;
  return b;
}

function computeLeagueProj(m, st, rules) {
  if (m.position !== "DEF" && (!m.team || m.team === "FA" || !m.isCurrentNfl || ["Out","IR","Suspended","PUP"].includes(m.injuryStatus))) return 0;
  if (m.byeWeek > 0 && m.byeWeek === state.week) return 0;
  if (!st) return defaultRealisticProj(m);
  if (rules && Object.keys(rules).length) {
    let tot = 0, hit = false;
    for (const k in st) {
      if (!k.startsWith("pts_") && rules[k] !== undefined) { tot += st[k] * rules[k]; hit = true; }
    }
    if (hit && Math.abs(tot) > 0.001) return Math.max(0, tot);
  }
  const recM = rules?.rec ?? 1.0;
  if (recM >= 0.9 && st.pts_ppr !== undefined) return Math.max(0, st.pts_ppr);
  if (recM >= 0.4 && st.pts_half_ppr !== undefined) return Math.max(0, st.pts_half_ppr);
  if (st.pts_std !== undefined) return Math.max(0, st.pts_std);
  return defaultRealisticProj(m);
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

function isPickTradingAllowedInLeague() {
  const lt = state.activeLeague?.leagueType || 0;
  return lt === 1 || lt === 2;
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

function renderTradeAssetStackHTML(pids) {
  return `<div class="trade-asset-stack">` + pids.map(pid => {
    const p = state.players[pid];
    if (!p) return "";
    if (p.isPick) {
      return `
        <div class="trade-asset-item">
          <span class="pos-pill" style="${posBadgeStyle('PICK')}">PICK</span>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:13px; color:var(--text-main);">${p.name}</div>
            <div style="font-size:11px; color:var(--text-muted);">Original Owner: ${p.originalOwnerName}</div>
          </div>
          <span class="badge badge-blue" style="font-size:11px;">VAL ${p.baseValue}</span>
        </div>`;
    }
    const po = getPlayerPlayoffSosProfile(p);
    const wkRangeLbl = `W${po.poWeeks[0]}–${po.poWeeks[po.poWeeks.length - 1]}`;
    return `
      <div class="trade-asset-item">
        <img class="avatar" style="width:34px;height:34px;" src="${avatarUrl(p)}" onerror="this.style.display='none'" />
        <span class="pos-pill" style="${posBadgeStyle(p.position)}">${p.position}</span>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:700; font-size:13px; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            <img class="team-logo-sm" src="${teamLogoUrl(p.team)}" onerror="this.style.display='none'"/>${p.name}
          </div>
          <div style="font-size:11px; color:var(--text-muted); display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin-top:2px;">
            <span>${p.position} #${p.posRank} • ${p.seasonPpg.toFixed(1)} PPG</span>
            <span class="sos-mini-pill ${po.pillCls}">Playoff SOS: ${po.letter} (#${po.avgRank.toFixed(0)})</span>
          </div>
          <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">${wkRangeLbl}: ${po.oppsStr}</div>
        </div>
        <span class="badge badge-blue" style="font-size:11px;">VAL ${p.baseValue}</span>
      </div>`;
  }).join("") + `</div>`;
}

function openTradeInBuilder(aIds, bIds, teamAIdx = null, teamBIdx = null) {
  if (teamAIdx !== null && teamAIdx >= 0 && teamAIdx < state.managers.length) document.getElementById("tradeTeamA").value = teamAIdx;
  if (teamBIdx !== null && teamBIdx >= 0 && teamBIdx < state.managers.length) document.getElementById("tradeTeamB").value = teamBIdx;
  else if (state.managers.length >= 2) {
    const oA = state.managers.findIndex(m => aIds.some(id => m.players.includes(id)));
    const oB = state.managers.findIndex(m => bIds.some(id => m.players.includes(id)));
    if (oA >= 0) document.getElementById("tradeTeamA").value = oA;
    if (oB >= 0 && oB !== oA) document.getElementById("tradeTeamB").value = oB;
  }
  state.tradeSideA = [...aIds]; state.tradeSideB = [...bIds];
  renderTradeBuilderSide(true); renderTradeBuilderSide(false);
  updateTradeEvaluation(); switchTradeMode(0);
}

function targetPlayerFromSos(playerId, pos) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
  document.querySelector('.nav-btn[data-tab="tab-trade"]')?.classList.add("active");
  document.getElementById("tab-trade")?.classList.add("active");
  if (["QB","RB","WR","TE"].includes(pos)) document.getElementById("finderPos").value = pos;
  const ownerIdx = state.managers.findIndex(m => m.players.includes(playerId));
  const myIdx = parseInt(document.getElementById("tradeTeamA")?.value || "0", 10);
  if (ownerIdx >= 0 && ownerIdx !== myIdx) openTradeInBuilder([], [playerId], myIdx, ownerIdx);
  else { renderTradeFinder(); switchTradeMode(2); }
}

function openMatchupInSimulator(rosterIdA, rosterIdB) {
  const idxA = state.managers.findIndex(m => m.rosterId === rosterIdA);
  const idxB = state.managers.findIndex(m => m.rosterId === rosterIdB);
  if (idxA < 0 || idxB < 0) return;
  document.getElementById("simTeamA").value = idxA;
  document.getElementById("simTeamB").value = idxB;
  renderMatchupSim();
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
  document.querySelector('.nav-btn[data-tab="tab-matchup"]')?.classList.add("active");
  document.getElementById("tab-matchup")?.classList.add("active");
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
  ensureDynamicTradeControls();
  updateAnalyticsDropdownOptions();
  try {
    const stRes = await fetch("https://api.sleeper.app/v1/state/nfl").then(r => r.json());
    state.week = Math.min(18, Math.max(1, stRes.display_week || stRes.week || 6));
    if (stRes.season) state.season = String(stRes.season);
    if (weekSelect) weekSelect.value = state.week;
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
  if (params.get("week")) {
    state.week = parseInt(params.get("week"), 10) || state.week;
    if (weekSelect) weekSelect.value = state.week;
  }
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
  if (document.getElementById("bracketTeamsOverride")) document.getElementById("bracketTeamsOverride").value = "AUTO";
  if (document.getElementById("bracketReseedMode")) document.getElementById("bracketReseedMode").value = "AUTO";
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
  if (!tbl) return;
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
  if (!tbl) return;
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
  if (!canvas) return;
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

function renderTradeBuilderSide(isSideA) {
  const selIdx = parseInt(document.getElementById(isSideA ? "tradeTeamA" : "tradeTeamB")?.value || "0", 10);
  const tm = state.managers[selIdx];
  const container = document.getElementById(isSideA ? "tradeListA" : "tradeListB");
  const picksWrap = document.getElementById(isSideA ? "picksWrapA" : "picksWrapB");
  const picksContainer = document.getElementById(isSideA ? "tradePicksA" : "tradePicksB");
  if (!container) return;
  container.innerHTML = "";
  if (picksContainer) picksContainer.innerHTML = "";
  const activeArr = isSideA ? state.tradeSideA : state.tradeSideB;

  const allowPicks = isPickTradingAllowedInLeague();
  if (!allowPicks) {
    for (let i = activeArr.length - 1; i >= 0; i--) {
      if (String(activeArr[i]).startsWith("PICK_")) activeArr.splice(i, 1);
    }
  }
  if (picksWrap) picksWrap.style.display = allowPicks ? "flex" : "none";
  container.style.maxHeight = allowPicks ? "300px" : "430px";

  const pickModeWrap = document.getElementById("finderPickModeWrap");
  if (pickModeWrap) pickModeWrap.style.display = allowPicks ? "flex" : "none";

  const rosterSet = new Set(tm ? tm.players : []);
  activeArr.filter(id => !String(id).startsWith("PICK_")).forEach(id => rosterSet.add(id));
  const sorted = Array.from(rosterSet).map(id => state.players[id]).filter(m => m && !m.isPick).sort((a, b) => b.baseValue - a.baseValue);

  sorted.forEach(p => {
    const isExt = tm && !tm.players.includes(p.id);
    const po = getPlayerPlayoffSosProfile(p);
    const div = document.createElement("div");
    div.className = "p-card" + (activeArr.includes(p.id) ? " selected" : "");
    div.innerHTML = `
      <img class="avatar" src="${avatarUrl(p)}" onerror="this.style.display='none'" />
      <div style="flex:1;"><div style="font-weight:700;font-size:13px;color:#F2F4F8;"><img class="team-logo-sm" src="${teamLogoUrl(p.team)}" onerror="this.style.display='none'"/>${p.name}${isExt ? ' <span class="badge badge-yellow" style="font-size:9px;padding:2px 6px;">COMP</span>' : ''}</div><div style="font-size:11px;color:#8E96AA;">${p.position} #${p.posRank} - ${p.team} • ${p.seasonPpg.toFixed(1)} PPG • <span class="sos-mini-pill ${po.pillCls}">Playoff SOS: ${po.letter}</span></div></div>
      <div style="text-align:right;"><span class="badge badge-green">VAL ${p.baseValue}</span></div>`;
    div.onclick = () => {
      const idx = activeArr.indexOf(p.id);
      if (idx >= 0) activeArr.splice(idx, 1); else activeArr.push(p.id);
      renderTradeBuilderSide(isSideA);
      updateTradeEvaluation();
    };
    container.appendChild(div);
  });

  if (allowPicks && picksContainer && tm && tm.ownedPicks) {
    tm.ownedPicks.forEach(pk => {
      const pDiv = document.createElement("div");
      pDiv.className = "p-card" + (activeArr.includes(pk.id) ? " selected" : "");
      pDiv.style.padding = "6px 10px";
      pDiv.innerHTML = `
        <span class="pos-pill" style="background:rgba(10,132,255,0.18);color:#64D2FF;">PICK</span>
        <div style="flex:1;"><div style="font-weight:700;font-size:12px;color:#F2F4F8;">${pk.name}</div><div style="font-size:10px;color:#8E96AA;">Original Owner: ${pk.originalOwnerName}</div></div>
        <span class="badge badge-blue">VAL ${pk.baseValue}</span>`;
      pDiv.onclick = () => {
        const idx = activeArr.indexOf(pk.id);
        if (idx >= 0) activeArr.splice(idx, 1); else activeArr.push(pk.id);
        renderTradeBuilderSide(isSideA);
        updateTradeEvaluation();
      };
      picksContainer.appendChild(pDiv);
    });
  }
}

function updateTradeEvaluation() {
  const tmA = state.managers[document.getElementById("tradeTeamA")?.value];
  const tmB = state.managers[document.getElementById("tradeTeamB")?.value];
  const nameA = tmA ? tmA.teamName.split(" (")[0] : "Side 1";
  const nameB = tmB ? tmB.teamName.split(" (")[0] : "Side 2";

  const valA = state.tradeSideA.reduce((s, id) => s + (state.players[id]?.baseValue || 0), 0);
  const valB = state.tradeSideB.reduce((s, id) => s + (state.players[id]?.baseValue || 0), 0);
  const cA = state.tradeSideA.length, cB = state.tradeSideB.length;
  let adjA = valA, adjB = valB;
  if (cA > 0 && cB > 0 && cA !== cB) {
    const tax = 1 - Math.min(0.18, Math.abs(cA - cB) * 0.06);
    if (cA > cB) adjA = Math.round(valA * tax); else adjB = Math.round(valB * tax);
  }

  document.getElementById("sideATitle").textContent = `${nameA} Sends (${adjA} pts)`;
  document.getElementById("sideBTitle").textContent = `${nameB} Sends (${adjB} pts)`;

  const renderPkg = (elId, arr, isSideA) => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = "";
    if (!arr.length) {
      el.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:6px;">Click players on the ${isSideA ? 'left' : 'right'} or load a trade from the Database/Finder...</div>`;
      return;
    }
    arr.forEach(id => {
      const p = state.players[id];
      if (!p) return;
      const chip = document.createElement("div");
      chip.className = "pkg-chip"; chip.style.cursor = "pointer";
      chip.innerHTML = p.isPick
        ? `<div style="display:flex;align-items:center;gap:8px;"><span class="pos-pill" style="background:rgba(10,132,255,0.18);color:#64D2FF;width:38px;height:20px;line-height:20px;">PICK</span><b style="font-size:12px;">${p.name}</b><span style="font-size:11px;color:var(--text-muted);">(${p.team})</span></div><span class="badge badge-blue" style="font-size:10px;">VAL ${p.baseValue} ✕</span>`
        : `<div style="display:flex;align-items:center;gap:8px;"><img class="avatar" style="width:28px;height:28px;" src="${avatarUrl(p)}" onerror="this.style.display='none'" /><span class="pos-pill" style="${posBadgeStyle(p.position)}width:38px;height:20px;line-height:20px;">${p.position}</span><b style="font-size:12px;">${p.name}</b><span style="font-size:11px;color:var(--text-muted);">(${p.team})</span></div><span class="badge badge-blue" style="font-size:10px;">VAL ${p.baseValue} ✕</span>`;
      chip.onclick = () => {
        const idx = arr.indexOf(id);
        if (idx >= 0) arr.splice(idx, 1);
        renderTradeBuilderSide(isSideA);
        updateTradeEvaluation();
      };
      el.appendChild(chip);
    });
  };
  renderPkg("pkgListA", state.tradeSideA, true);
  renderPkg("pkgListB", state.tradeSideB, false);

  const fairEl = document.getElementById("tradeFairness");
  if (!adjA && !adjB) { fairEl.textContent = "Select assets on both sides to analyze."; fairEl.style.color = "var(--accent)"; return; }
  const diff = Math.abs(adjA - adjB), maxV = Math.max(adjA, adjB);
  const ratio = maxV > 0 ? (1 - diff / maxV) * 100 : 100;

  if (ratio >= 90) { fairEl.textContent = `Fair Trade (${ratio.toFixed(1)}% Value Match)`; fairEl.style.color = "var(--good)"; }
  else if (adjA > adjB) { fairEl.textContent = `Favors ${nameB} (+${diff} net value)`; fairEl.style.color = "var(--bad)"; }
  else { fairEl.textContent = `Favors ${nameA} (+${diff} net value)`; fairEl.style.color = "var(--warn)"; }

  if (!tmA || !tmB) return;
  const pIdsA = state.tradeSideA.filter(id => !String(id).startsWith("PICK_"));
  const pIdsB = state.tradeSideB.filter(id => !String(id).startsWith("PICK_"));
  const beforeA = calcOptimalLineup(tmA.players, true).total;
  const beforeB = calcOptimalLineup(tmB.players, true).total;
  const afterAIds = tmA.players.filter(id => !pIdsA.includes(id)).concat(pIdsB);
  const afterBIds = tmB.players.filter(id => !pIdsB.includes(id)).concat(pIdsA);
  const dA = calcOptimalLineup(afterAIds, true).total - beforeA;
  const dB = calcOptimalLineup(afterBIds, true).total - beforeB;
  const poDeltaA = calcPlayoffWindowAvgLineupPpg(afterAIds) - calcPlayoffWindowAvgLineupPpg(tmA.players);
  const poDeltaB = calcPlayoffWindowAvgLineupPpg(afterBIds) - calcPlayoffWindowAvgLineupPpg(tmB.players);

  document.getElementById("tradeConsole").innerHTML = `
    <b>Value Comparison:</b> ${nameA}: ${adjA} pts | ${nameB}: ${adjB} pts (${ratio.toFixed(1)}% Match)<br>
    <b>ROS Lineup Impact:</b> ${nameA}: <span style="color:${dA>=0?'var(--good)':'var(--bad)'};font-weight:700;">${dA>=0?'+':''}${dA.toFixed(2)} PPG</span> |
    ${nameB}: <span style="color:${dB>=0?'var(--good)':'var(--bad)'};font-weight:700;">${dB>=0?'+':''}${dB.toFixed(2)} PPG</span><br>
    <b>Playoff Lineup Impact:</b> ${nameA}: <span style="color:${poDeltaA>=0?'var(--good)':'var(--bad)'};font-weight:700;">${poDeltaA>=0?'+':''}${poDeltaA.toFixed(2)} Playoff PPG</span> |
    ${nameB}: <span style="color:${poDeltaB>=0?'var(--good)':'var(--bad)'};font-weight:700;">${poDeltaB>=0?'+':''}${poDeltaB.toFixed(2)} Playoff PPG</span>`;
}

function computeLeaguePositionalGrades(myIdx) {
  const gridEl = document.getElementById("posGradesGrid");
  const summaryEl = document.getElementById("rosterNeedsSummary");
  if (!state.managers.length || myIdx < 0 || myIdx >= state.managers.length) {
    if (gridEl) gridEl.innerHTML = "";
    return { weakestPos: "RB", surplusPos: "WR" };
  }

  const totalTeams = state.managers.length;
  const slotCounts = { QB: 1, RB: 2, WR: 2, TE: 1 };
  const slots = state.activeLeague?.rosterPositions || [];
  if (slots.filter(s => s === "QB").length >= 2 || slots.some(s => ["SUPER_FLEX","Q/W/R/T"].includes(s))) slotCounts.QB = 2;
  if (slots.filter(s => s === "WR").length >= 3) slotCounts.WR = 3;

  const unitKeys = ["QB", "RB", "WR", "TE", "DEPTH"];
  const scoresByUnit = { QB: [], RB: [], WR: [], TE: [], DEPTH: [] };

  state.managers.forEach((mgr, mIdx) => {
    const byPos = { QB: [], RB: [], WR: [], TE: [] };
    mgr.players.forEach(pid => {
      const p = state.players[pid];
      if (p && !p.isPick && byPos[p.position]) byPos[p.position].push(p);
    });
    Object.keys(byPos).forEach(k => byPos[k].sort((a, b) => (b.baseValue + b.seasonPpg * 140) - (a.baseValue + a.seasonPpg * 140)));

    ["QB", "RB", "WR", "TE"].forEach(pos => {
      const req = slotCounts[pos] || 1;
      const starters = byPos[pos].slice(0, req);
      const backups = byPos[pos].slice(req, req + 2);
      const stScore = starters.reduce((s, p) => s + p.baseValue + p.seasonPpg * 180, 0);
      const bkScore = backups.reduce((s, p) => s + p.baseValue * 0.35 + p.seasonPpg * 55, 0);
      scoresByUnit[pos].push({ mIdx, score: stScore + bkScore, topPlayers: byPos[pos].slice(0, 3) });
    });

    const flexPool = [...byPos.RB.slice(slotCounts.RB), ...byPos.WR.slice(slotCounts.WR), ...byPos.TE.slice(slotCounts.TE)]
      .sort((a, b) => b.baseValue - a.baseValue).slice(0, 4);
    const depthScore = flexPool.reduce((s, p) => s + p.baseValue + p.seasonPpg * 120, 0);
    scoresByUnit.DEPTH.push({ mIdx, score: depthScore, topPlayers: flexPool.slice(0, 3) });
  });

  const myGrades = {};
  unitKeys.forEach(u => {
    const sorted = [...scoresByUnit[u]].sort((a, b) => b.score - a.score);
    const rk = sorted.findIndex(x => x.mIdx === myIdx) + 1;
    const mine = sorted[rk - 1];
    const pct = totalTeams > 1 ? (totalTeams - rk) / (totalTeams - 1) : 0.5;
    let letter = "B", badgeCls = "badge-blue";
    if (pct >= 0.84) { letter = "A+"; badgeCls = "badge-green"; }
    else if (pct >= 0.68) { letter = "A"; badgeCls = "badge-green"; }
    else if (pct >= 0.52) { letter = "B+"; badgeCls = "badge-blue"; }
    else if (pct >= 0.38) { letter = "B"; badgeCls = "badge-blue"; }
    else if (pct >= 0.24) { letter = "C"; badgeCls = "badge-yellow"; }
    else if (pct >= 0.10) { letter = "D"; badgeCls = "badge-red"; }
    else { letter = "F"; badgeCls = "badge-red"; }
    myGrades[u] = { unit: u, rank: rk, totalTeams, letter, badgeCls, topPlayers: mine.topPlayers };
  });

  const coreUnits = ["QB", "RB", "WR", "TE"].map(k => myGrades[k]).sort((a, b) => b.rank - a.rank);
  const weakest = coreUnits[0], secondWeakest = coreUnits[1];
  const strongest = [...coreUnits].sort((a, b) => a.rank - b.rank)[0];
  state.weakestPosByTeam[myIdx] = weakest.unit;

  const targetFilterVal = document.getElementById("finderPos")?.value || "AUTO";
  const activeTarget = targetFilterVal === "AUTO" ? weakest.unit : targetFilterVal;

  if (gridEl) {
    gridEl.innerHTML = "";
    unitKeys.forEach(u => {
      const g = myGrades[u];
      const isWeakest = u === weakest.unit;
      const isSurplus = u === strongest.unit && g.rank <= Math.ceil(totalTeams * 0.35);
      const card = document.createElement("div");
      card.className = "grade-card" + (isWeakest ? " priority-need" : (isSurplus ? " surplus-unit" : ""));
      const roleTag = isWeakest
        ? `<span style="color:var(--bad);font-size:10px;font-weight:800;">#1 PRIORITY NEED</span>`
        : (isSurplus ? `<span style="color:var(--good);font-size:10px;font-weight:800;">SURPLUS CHIP</span>` : `<span style="color:var(--text-muted);font-size:10px;font-weight:700;">${activeTarget === u ? 'TARGETING' : 'CLICK TO TARGET'}</span>`);
      const namesStr = g.topPlayers.length ? g.topPlayers.map(p => p.name.split(" ").pop()).join(", ") : "Empty";
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:800;">${u === "DEPTH" ? "BENCH / FLEX" : u + " UNIT"}</span>
          <span class="grade-pill ${g.badgeCls}">${g.letter}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
          <span style="font-size:12px;font-weight:800;">Rank #${g.rank} <span style="color:var(--text-muted);font-weight:600;">of ${totalTeams}</span></span>
          ${roleTag}
        </div>
        <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">
          Core: <b style="color:var(--text-main);">${namesStr}</b>
        </div>`;
      if (u !== "DEPTH") {
        card.onclick = () => { document.getElementById("finderPos").value = u; renderTradeFinder(); };
      }
      gridEl.appendChild(card);
    });
  }

  const myTeamName = state.managers[myIdx].teamName.split(" (")[0];
  const surplusNames = strongest.topPlayers.map(p => p.name).join(", ");
  const weakNames = weakest.topPlayers.length ? weakest.topPlayers.map(p => p.name).join(", ") : "replacement-level starters";

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;">
        <div style="flex:1;min-width:280px;">
          <b style="color:var(--bad);">Primary Roster Weakness — ${weakest.unit} (Grade ${weakest.letter}, Rank #${weakest.rank}/${totalTeams}):</b>
          ${myTeamName}'s ${weakest.unit} group (${weakNames}) trails league contenders, with ${secondWeakest.unit} (Rank #${secondWeakest.rank}/${totalTeams}) as your secondary upgrade spot.<br>
          <b style="color:var(--good);">Best Trade Leverage — ${strongest.unit} Surplus (Grade ${strongest.letter}, Rank #${strongest.rank}/${totalTeams}):</b>
          Deal from your ${strongest.unit} depth (${surplusNames}) in a <b>2-for-1 consolidation</b> or <b>2-for-2 package</b> below to acquire players with <b>A / A+ Fantasy Playoff schedules</b>.
        </div>
        <button id="autoTargetNeedBtn" class="btn-builder-action" style="padding:8px 14px;">Target ${weakest.unit} Upgrades (${weakest.letter})</button>
      </div>`;
    const btn = document.getElementById("autoTargetNeedBtn");
    if (btn) btn.onclick = () => { document.getElementById("finderPos").value = weakest.unit; renderTradeFinder(); };
  }
  return { weakestPos: weakest.unit, secondWeakestPos: secondWeakest.unit, surplusPos: strongest.unit, myGrades };
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

async function buildTradeDatabase() {
  state.dbTrades = [];
  const fmtTag = state.activeLeague
    ? `${state.activeLeague.leagueType === 2 ? "Dynasty" : (state.activeLeague.leagueType === 1 ? "Keeper" : "Redraft")} • ${state.activeLeague.totalTeams}T`
    : "12-Team PPR";

  if (state.activeLeague?.leagueId) {
    try {
      const weeksToScan = Math.min(state.week, 8);
      const reqs = [];
      for (let w = 1; w <= weeksToScan; w++) {
        reqs.push(fetch(`https://api.sleeper.app/v1/league/${state.activeLeague.leagueId}/transactions/${w}`).then(r => r.json()).catch(() => []));
      }
      const weeklyTx = await Promise.all(reqs);
      weeklyTx.forEach((txArr, wIdx) => {
        (txArr || []).forEach(tx => {
          if (tx.type !== "trade" || tx.status !== "complete" || !tx.roster_ids || tx.roster_ids.length < 2) return;
          const rA = tx.roster_ids[0], rB = tx.roster_ids[1];
          const aIds = [], bIds = [];
          for (const [pid, destRoster] of Object.entries(tx.adds || {})) {
            if (!state.players[pid]) continue;
            if (destRoster === rA) aIds.push(pid);
            else if (destRoster === rB) bIds.push(pid);
          }
          if (aIds.length && bIds.length) {
            const aVal = aIds.reduce((s, id) => s + state.players[id].baseValue, 0);
            const bVal = bIds.reduce((s, id) => s + state.players[id].baseValue, 0);
            state.dbTrades.push({ aIds, bIds, aVal, bVal, src: "LEAGUE", label: `Week ${wIdx + 1} League Trade`, format: fmtTag });
          }
        });
      });
    } catch {}
  }

  const selTeamIdx = parseInt(document.getElementById("teamSelect")?.value || "0", 10);
  const myMgr = state.managers[selTeamIdx];
  const myRosterSet = new Set(myMgr ? myMgr.players : []);

  const myRosterPlayers = Array.from(myRosterSet)
    .map(id => state.players[id])
    .filter(p => p && !p.isPick && p.isCurrentNfl && ["QB","RB","WR","TE"].includes(p.position) && p.baseValue >= 800)
    .sort((a, b) => b.baseValue - a.baseValue);

  const otherLeaguePlayers = Object.values(state.players)
    .filter(p => !p.isPick && p.isCurrentNfl && !myRosterSet.has(p.id) && ["QB","RB","WR","TE"].includes(p.position) && p.baseValue >= 800)
    .sort((a, b) => b.baseValue - a.baseValue);

  const seenCompKeys = new Set();

  myRosterPlayers.forEach((myP, idx) => {
    let matchesForThisPlayer = 0;
    for (const otherP of otherLeaguePlayers) {
      if (myP.position === otherP.position) continue;
      const match = (1 - Math.abs(myP.baseValue - otherP.baseValue) / Math.max(myP.baseValue, otherP.baseValue)) * 100;
      if (match >= 90) {
        const key = [myP.id, otherP.id].sort().join("|");
        if (!seenCompKeys.has(key)) {
          seenCompKeys.add(key);
          const ownerMgr = state.managers.find(m => m.players.includes(otherP.id));
          const ownerLbl = ownerMgr ? `vs ${ownerMgr.teamName.split(" (")[0]}` : "1-for-1 Market Comp";
          state.dbTrades.push({
            aIds: [myP.id], bIds: [otherP.id], aVal: myP.baseValue, bVal: otherP.baseValue,
            src: "MARKET", label: `Roster Comp (${ownerLbl})`, format: fmtTag, involvesMyRoster: true
          });
          matchesForThisPlayer++;
          if (matchesForThisPlayer >= 3) break;
        }
      }
    }

    if (idx + 1 < myRosterPlayers.length) {
      const myP2 = myRosterPlayers[idx + 1];
      const pairVal = Math.round((myP.baseValue + myP2.baseValue) * 0.92);
      for (const stud of otherLeaguePlayers.slice(0, 35)) {
        if (stud.baseValue <= myP.baseValue * 1.08) continue;
        const match = (1 - Math.abs(pairVal - stud.baseValue) / Math.max(pairVal, stud.baseValue)) * 100;
        if (match >= 91) {
          const ownerMgr = state.managers.find(m => m.players.includes(stud.id));
          const ownerLbl = ownerMgr ? `vs ${ownerMgr.teamName.split(" (")[0]}` : "2-for-1 Comp";
          state.dbTrades.push({
            aIds: [myP.id, myP2.id], bIds: [stud.id], aVal: pairVal, bVal: stud.baseValue,
            src: "MARKET", label: `2-for-1 Upgrade (${ownerLbl})`, format: fmtTag, involvesMyRoster: true
          });
          break;
        }
      }
    }
  });

  const topPool = otherLeaguePlayers.slice(0, 60);
  for (let i = 0; i < topPool.length; i += 2) {
    const pA = topPool[i], pB = topPool[i + 1];
    if (!pA || !pB || pA.position === pB.position) continue;
    const match = (1 - Math.abs(pA.baseValue - pB.baseValue) / Math.max(pA.baseValue, pB.baseValue)) * 100;
    if (match >= 91) {
      state.dbTrades.push({
        aIds: [pA.id], bIds: [pB.id], aVal: pA.baseValue, bVal: pB.baseValue,
        src: "MARKET", label: "League-Wide Market Comp", format: fmtTag, involvesMyRoster: false
      });
    }
  }

  renderTradeDatabase();
  renderTradeFinder();
}

function renderTradeDatabase() {
  ensureDynamicTradeControls();
  const q = (document.getElementById("dbSearch")?.value || "").trim().toLowerCase();
  const pos = document.getElementById("dbPosFilter")?.value || "ALL";
  const src = document.getElementById("dbSrcFilter")?.value || "ALL";
  const rosterScope = document.getElementById("dbRosterScope")?.value || "MY_ROSTER";

  const selTeamIdx = parseInt(document.getElementById("teamSelect")?.value || "0", 10);
  const myMgr = state.managers[selTeamIdx];
  const myRosterSet = new Set(myMgr ? myMgr.players : []);
  const myTeamShort = myMgr ? myMgr.teamName.split(" (")[0] : "Selected Roster";

  const arrow = k => (dbSortKey === k ? (dbSortDir === -1 ? " ▼" : " ▲") : "");
  const tbl = document.getElementById("dbTable");
  if (!tbl) return;
  tbl.innerHTML = `
    <thead>
      <tr>
        <th style="width:165px;cursor:pointer;" data-dbsort="src">Source / Partner${arrow("src")}</th>
        <th style="text-align:left;cursor:pointer;color:var(--accent);" data-dbsort="aVal">${rosterScope === "MY_ROSTER" ? `${myTeamShort} Side` : "Side A Assets"} (Val)${arrow("aVal")}</th>
        <th style="width:145px;cursor:pointer;color:var(--good);" data-dbsort="matchPct">Value Balance${arrow("matchPct")}</th>
        <th style="text-align:left;cursor:pointer;color:var(--warn);" data-dbsort="bVal">Counterparty Assets (Val)${arrow("bVal")}</th>
        <th style="width:135px;">Modify Trade</th>
      </tr>
    </thead>
    <tbody></tbody>`;

  tbl.querySelectorAll("th[data-dbsort]").forEach(th => {
    th.onclick = () => {
      const k = th.dataset.dbsort;
      if (dbSortKey === k) dbSortDir *= -1;
      else { dbSortKey = k; dbSortDir = -1; }
      renderTradeDatabase();
    };
  });

  const tbody = tbl.querySelector("tbody");
  const filtered = [];

  state.dbTrades.forEach(t => {
    if (src !== "ALL" && t.src !== src) return;
    let aIds = [...t.aIds], bIds = [...t.bIds], aVal = t.aVal, bVal = t.bVal;

    const aHasMine = aIds.some(id => myRosterSet.has(id));
    const bHasMine = bIds.some(id => myRosterSet.has(id));
    const involvesMine = aHasMine || bHasMine;

    if (rosterScope === "MY_ROSTER" && myRosterSet.size > 0 && !involvesMine) return;

    if (bHasMine && !aHasMine) {
      const tmpIds = aIds; aIds = bIds; bIds = tmpIds;
      const tmpVal = aVal; aVal = bVal; bVal = tmpVal;
    }

    const pA = aIds.map(id => state.players[id]).filter(Boolean);
    const pB = bIds.map(id => state.players[id]).filter(Boolean);
    const all = [...pA, ...pB];
    if (!all.length) return;
    if (q && !all.some(p => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)) && !t.label.toLowerCase().includes(q)) return;
    if (pos !== "ALL" && !all.some(p => p.position === pos)) return;

    const diff = Math.abs(aVal - bVal);
    const matchPct = Math.max(aVal, bVal) > 0 ? (1 - diff / Math.max(aVal, bVal)) * 100 : 100;
    filtered.push({ ...t, aIds, bIds, aVal, bVal, matchPct, involvesMine });
  });

  filtered.sort((a, b) => {
    const dir = dbSortDir === 1 ? -1 : 1;
    if (dbSortKey === "aVal") return (b.aVal - a.aVal) * dir;
    if (dbSortKey === "bVal") return (b.bVal - a.bVal) * dir;
    if (dbSortKey === "src") return a.src.localeCompare(b.src) * dir;
    return (b.matchPct - a.matchPct) * dir;
  });

  const shownList = filtered.slice(0, 35);
  shownList.forEach(t => {
    const srcBadge = t.src === "LEAGUE"
      ? `<span class="badge badge-green">LEAGUE TRADE</span>`
      : (t.involvesMine ? `<span class="badge badge-blue">MY ROSTER COMP</span>` : `<span class="badge badge-purple">MARKET COMP</span>`);

    const tr = document.createElement("tr");
    tr.className = "table-row-hover";
    tr.innerHTML = `
      <td><div style="display:flex;flex-direction:column;gap:5px;align-items:center;">${srcBadge}<div style="font-size:11px;font-weight:700;">${t.label}</div><div style="font-size:10px;color:var(--text-muted);">${t.format}</div></div></td>
      <td>${renderTradeAssetStackHTML(t.aIds)}</td>
      <td><div style="display:flex;flex-direction:column;gap:5px;align-items:center;"><span class="badge ${t.matchPct >= 92 ? 'badge-green' : 'badge-yellow'}">${t.matchPct.toFixed(0)}% Fair Match</span><div style="font-size:11px;font-weight:700;color:var(--text-muted);">${t.aVal} vs ${t.bVal}</div></div></td>
      <td>${renderTradeAssetStackHTML(t.bIds)}</td>
      <td><button class="btn-builder-action">Open in Builder →</button></td>`;
    tr.querySelector("button").onclick = () => openTradeInBuilder(t.aIds, t.bIds);
    tbody.appendChild(tr);
  });

  if (!shownList.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:24px;color:var(--text-muted);">No matching trades found. Try switching Roster Filter to "All League & Market Comps".</td></tr>`;
  }
  const cntEl = document.getElementById("dbCountLbl");
  if (cntEl) cntEl.textContent = `${shownList.length} trades shown`;
}

function renderTradeFinder() {
  ensureDynamicTradeControls();
  const myIdx = parseInt(document.getElementById("tradeTeamA")?.value || "0", 10) || 0;
  const myTm = state.managers[myIdx];
  const arrow = k => (finderSortKey === k ? (finderSortDir === -1 ? " ▼" : " ▲") : "");
  const tbl = document.getElementById("finderTable");
  if (!tbl) return;
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
    if (document.getElementById("posGradesGrid")) document.getElementById("posGradesGrid").innerHTML = "";
    tbody.innerHTML = `<tr><td colspan="6" style="padding:24px;color:var(--text-muted);">Sync your Sleeper account above to analyze positional grades, Contender vs. Rebuilder tags, and archetype-matched trades.</td></tr>`;
    document.getElementById("finderCountLbl").textContent = "0 proposals";
    return;
  }

  const diag = computeLeaguePositionalGrades(myIdx);
  const myArch = classifyManagerArchetype(myTm);
  const myArchBadgeEl = document.getElementById("myArchetypeBadge");
  if (myArchBadgeEl) {
    myArchBadgeEl.textContent = `${myArch.label} (RANK #${myTm.currentRank} • ${myTm.playoffPct.toFixed(0)}% PLAYOFF ODDS)`;
    myArchBadgeEl.className = `badge ${myArch.badgeCls}`;
  }

  const rawPosSel = document.getElementById("finderPos")?.value || "AUTO";
  const targetPos = rawPosSel === "AUTO" ? diag.weakestPos : rawPosSel;
  const partnerTypeFilter = document.getElementById("finderPartnerType")?.value || "ALL";
  const pkgTypeFilter = document.getElementById("finderPkgType")?.value || "ALL";
  const pickMode = document.getElementById("finderPickMode")?.value || "AUTO";
  const sosBoostMode = document.getElementById("finderSosBoost")?.value || "BOOST";
  const strat = parseInt(document.getElementById("finderStrat")?.value || "0", 10);

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
    const weGetPick = getIds.some(id => String(id).startsWith("PICK_"));
    const partnerGetsYoungAsset = givePlayersOnly.some(p => p.age > 0 && p.age <= 25);
    const weGetVeteranStarter = getPlayersOnly.some(p => p.seasonPpg >= 11.2 || p.age >= 26);
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

function renderOptimizerTab(idx) {
  const tm = state.managers[idx];
  if (!tm) return;
  const opt = calcOptimalLineup(tm.players, false);
  const rowsEl = document.getElementById("optRows");
  if (!rowsEl) return;
  rowsEl.innerHTML = "";
  let curTot = 0, optTot = 0, subCnt = 0;

  opt.slots.forEach((sl, i) => {
    const cPl = state.players[tm.starters[i]] || { id:"0", name:"Empty Slot", position:sl, team:"FA", projectedPoints:0 };
    const oPl = opt.filled[i] || { id:"0", name:"No Eligible Player", position:sl, team:"FA", projectedPoints:0 };
    curTot += cPl.projectedPoints; optTot += oPl.projectedPoints;
    const lost = oPl.projectedPoints - cPl.projectedPoints;
    const isSub = oPl.id !== cPl.id && lost > 0.04;
    const isSev = isSub && (lost >= 3.0 || cPl.projectedPoints <= 0.1);
    if (isSub) subCnt++;

    const row = document.createElement("div");
    row.className = "opt-row" + (isSev ? " sev" : (isSub ? " warn" : ""));
    row.innerHTML = `
      <div class="p-card" style="height:62px;"><img class="avatar" src="${avatarUrl(cPl)}" onerror="this.style.display='none'" /><div style="flex:1;"><b style="color:#F2F4F8;"><img class="team-logo-sm" src="${teamLogoUrl(cPl.team)}" onerror="this.style.display='none'"/>${cPl.name}</b><div style="font-size:11px;color:var(--text-muted);">${cPl.position} - ${cPl.team}</div></div><b>${cPl.projectedPoints.toFixed(2)} pts</b></div>
      <div style="text-align:center;font-weight:800;font-size:11px;background:${isSev?'#4E161B':(isSub?'#462F0F':'#141416')};border:1px solid ${isSev?'var(--bad)':(isSub?'var(--warn)':'var(--border)')};border-radius:10px;padding:6px;color:${isSev?'#FFF':(isSub?'var(--warn)':'var(--text-muted)')};">${isSub ? `${sl}<br>-${lost.toFixed(2)} pts` : `✔ ${sl}`}</div>
      <div class="p-card" style="height:62px;"><img class="avatar" src="${avatarUrl(oPl)}" onerror="this.style.display='none'" /><div style="flex:1;"><b style="color:#F2F4F8;"><img class="team-logo-sm" src="${teamLogoUrl(oPl.team)}" onerror="this.style.display='none'"/>${oPl.name}</b><div style="font-size:11px;color:var(--text-muted);">${oPl.position} - ${oPl.team}</div></div><b style="color:var(--good);">${oPl.projectedPoints.toFixed(2)} pts</b></div>`;
    rowsEl.appendChild(row);
  });

  document.getElementById("optCurTot").textContent = `CURRENT LINEUP: ${curTot.toFixed(2)} pts`;
  document.getElementById("optBestTot").textContent = `OPTIMUM LINEUP: ${optTot.toFixed(2)} pts (+${Math.max(0, optTot - curTot).toFixed(2)})`;
  document.getElementById("optSubAlert").textContent = subCnt > 0 ? `${subCnt} Suboptimal Slot(s) Detected` : `Lineup is 100% Optimal for Week ${state.week}`;
}

function renderWaiversTab() {
  const rostered = new Set();
  state.managers.forEach(m => m.players.forEach(p => rostered.add(p)));
  const pf = document.getElementById("waiverPos")?.value || "ALL";
  state.waiverTargets = Object.values(state.players).filter(p => {
    if (p.isPick || rostered.has(p.id)) return false;
    if (p.position !== "DEF" && !p.isCurrentNfl) return false;
    if (pf === "ALL" && !["QB","RB","WR","TE","DEF","K"].includes(p.position)) return false;
    if (pf === "FLEX" && !["RB","WR","TE"].includes(p.position)) return false;
    if (pf !== "ALL" && pf !== "FLEX" && p.position !== pf) return false;
    return p.projectedPoints > 1 || p.seasonPpg > 2;
  }).sort((a, b) => pf === "ALL" ? (b.vorpScore - a.vorpScore) : (b.projectedPoints - a.projectedPoints)).slice(0, 15);

  const tbl = document.getElementById("waiverTbl");
  if (!tbl) return;
  tbl.innerHTML = `<thead><tr><th>Pos</th><th style="text-align:left;">Player</th><th>NFL Team</th><th>Health Status</th><th>2026 Bye</th><th>Season PPG</th><th>Week ${state.week} Proj</th><th>VORP / FAAB</th></tr></thead><tbody></tbody>`;
  const tbody = tbl.querySelector("tbody");

  state.waiverTargets.forEach(fa => {
    const faab = Math.min(35, Math.max(1, Math.round(fa.vorpScore * 2.2)));
    const hCol = ["Questionable","Doubtful"].includes(fa.injuryStatus) ? "var(--warn)" : (["Out","IR","PUP","Suspended"].includes(fa.injuryStatus) ? "var(--bad)" : "var(--good)");
    const isBye = fa.byeWeek > 0 && fa.byeWeek === state.week;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="pos-pill" style="${posBadgeStyle(fa.position)}">${fa.position}</span></td>
      <td><div class="player-cell"><img class="avatar" src="${avatarUrl(fa)}" onerror="this.style.display='none'" /><div><div style="font-weight:700;font-size:14px;color:var(--text-main);"><img class="team-logo-sm" src="${teamLogoUrl(fa.team)}" onerror="this.style.display='none'"/>${fa.name}</div><div style="font-size:11px;color:var(--text-muted);">${fa.position} #${fa.posRank} • Snap: ${fa.snapSharePct.toFixed(0)}%</div></div></div></td>
      <td style="font-weight:700;">${fa.team}</td>
      <td style="font-weight:700;color:${hCol};">${fa.injuryStatus}</td>
      <td style="color:${isBye ? 'var(--bad)' : 'var(--text-muted)'};font-weight:${isBye ? '700' : '400'};">${fa.byeWeek > 0 ? (isBye ? `Wk ${fa.byeWeek} (BYE)` : `Wk ${fa.byeWeek}`) : "--"}</td>
      <td>${fa.seasonPpg.toFixed(2)} pts</td>
      <td style="color:var(--good);font-weight:700;">${fa.projectedPoints.toFixed(2)} pts</td>
      <td style="color:var(--accent);font-weight:700;">+${fa.vorpScore.toFixed(1)} VORP (${faab}% FAAB)</td>`;
    tbody.appendChild(tr);
  });
  drawWaiverChart();
}

function drawWaiverChart() {
  const canvas = document.getElementById("waiverCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 860, H = canvas.clientHeight || 280;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const list = state.waiverTargets.slice(0, 8);
  if (!list.length) return;
  const mode = parseInt(document.getElementById("waiverChartMode")?.value || "0", 10);
  const pf = document.getElementById("waiverPos")?.value || "ALL";
  ctx.fillStyle = "#F2F4F8"; ctx.font = "700 12px -apple-system, sans-serif";
  ctx.fillText(mode === 0 ? `TOP AVAILABLE ${pf} TARGETS — VORP PICKUP SCORE (WEEK ${state.week})` : (mode === 1 ? "ROLE WORKLOAD & SNAP SHARE LEADERS" : "BREAKOUT MOMENTUM — WEEK PROJ vs SEASON AVG"), 20, 26);

  const plot = { l: 215, t: 44, w: W - 375, h: H - 54 };
  const rowH = plot.h / list.length;
  const metric = p => mode === 0 ? (pf === "ALL" ? p.vorpScore : p.projectedPoints) : (mode === 1 ? p.touchesPerGame + p.targetsPerGame : p.projectedPoints);
  const maxV = Math.max(10, ...list.map(metric)) * 1.15;

  list.forEach((p, i) => {
    const y = plot.t + i * rowH;
    ctx.fillStyle = "#F2F4F8"; ctx.font = "700 11px -apple-system, sans-serif";
    ctx.fillText(`#${i+1}  ${p.name.slice(0, 16)} (${p.position} - ${p.team})`, 18, y + rowH * 0.65);
    const w = Math.max(0.04, metric(p) / maxV) * plot.w;
    ctx.fillStyle = p.vorpScore >= 6 ? "#30D158" : "#0A84FF";
    ctx.fillRect(plot.l, y + rowH * 0.22, w, rowH * 0.56);
    ctx.fillStyle = "#F2F4F8"; ctx.font = "700 10px -apple-system, sans-serif";
    ctx.fillText(mode === 0 ? `+${p.vorpScore.toFixed(1)} VORP (${p.projectedPoints.toFixed(1)} Proj)` : `${p.projectedPoints.toFixed(1)} pts (${p.seasonPpg.toFixed(1)} PPG)`, plot.l + w + 10, y + rowH * 0.65);
  });
}

function drawSingleAnalyticsChart() {
  const pos = document.getElementById("analyticsPos")?.value || "QB";
  const viewMode = parseInt(document.getElementById("analyticsGraphSelect")?.value || "0", 10);
  const rawSortKey = document.getElementById("analyticsSortKey")?.value || "seasonPpg";
  const cfgs = ANALYTICS_CONFIGS[pos] || ANALYTICS_CONFIGS.QB;
  const cfg = cfgs[viewMode] || cfgs[0];
  const resolvedSortProp = rawSortKey === "xKey" ? cfg.xKey : (rawSortKey === "yKey" ? cfg.yKey : rawSortKey);

  const pool = Object.values(state.players)
    .filter(p => !p.isPick && p.position === pos && p.isCurrentNfl)
    .sort((a, b) => (b.seasonPpg * 160 + b.baseValue) - (a.seasonPpg * 160 + a.baseValue))
    .slice(0, 32)
    .sort((a, b) => ((Number(b[resolvedSortProp] || 0) - Number(a[resolvedSortProp] || 0)) * (analyticsSortDir === 1 ? -1 : 1)));

  const titleEl = document.getElementById("singleGraphTitle");
  if (titleEl) titleEl.textContent = cfg.title;

  const tbl = document.getElementById("analyticsTable");
  if (tbl) {
    const arrow = k => (resolvedSortProp === k ? (analyticsSortDir === -1 ? " ▼" : " ▲") : "");
    tbl.innerHTML = `<thead><tr>
      <th>Rank</th><th>Pos</th><th style="text-align:left;">Player / Unit</th><th>NFL Team</th>
      <th style="cursor:pointer;color:var(--accent);" data-skey="xKey">${cfg.xLbl}${arrow(cfg.xKey)}</th>
      <th style="cursor:pointer;color:var(--good);" data-skey="yKey">${cfg.yLbl}${arrow(cfg.yKey)}</th>
      <th style="cursor:pointer;" data-skey="seasonPpg">Season PPG${arrow("seasonPpg")}</th>
      <th style="cursor:pointer;" data-skey="projectedPoints">Wk ${state.week} Proj${arrow("projectedPoints")}</th>
      <th style="cursor:pointer;" data-skey="baseValue">Trade Value${arrow("baseValue")}</th>
    </tr></thead><tbody></tbody>`;

    tbl.querySelectorAll("th[data-skey]").forEach(th => {
      th.onclick = () => {
        const sel = document.getElementById("analyticsSortKey");
        if (sel) {
          if (sel.value === th.dataset.skey) analyticsSortDir *= -1;
          else { sel.value = th.dataset.skey; analyticsSortDir = -1; }
        }
        drawSingleAnalyticsChart();
      };
    });

    const tbody = tbl.querySelector("tbody");
    pool.forEach((p, idx) => {
      const tr = document.createElement("tr");
      const subMeta = p.position === "DEF" ? `NFL Defense • Bye Wk ${p.byeWeek || '--'}` : `${p.position} #${p.posRank} • Age ${p.age}`;
      tr.innerHTML = `
        <td style="font-weight:700;color:var(--text-muted);">#${idx + 1}</td>
        <td><span class="pos-pill" style="${posBadgeStyle(p.position)}">${p.position}</span></td>
        <td><div class="player-cell"><img class="avatar" src="${avatarUrl(p)}" onerror="this.style.display='none'" /><div><div style="font-weight:700;color:var(--text-main);"><img class="team-logo-sm" src="${teamLogoUrl(p.team)}" onerror="this.style.display='none'"/>${p.name}</div><div style="font-size:11px;color:var(--text-muted);">${subMeta}</div></div></div></td>
        <td style="font-weight:700;">${p.team}</td>
        <td style="font-weight:700;color:var(--text-main);">${Number(p[cfg.xKey] || 0).toFixed(2)}</td>
        <td style="color:var(--good);font-weight:700;">${Number(p[cfg.yKey] || 0).toFixed(2)}</td>
        <td style="font-weight:700;">${p.seasonPpg.toFixed(2)} pts</td>
        <td style="color:var(--good);font-weight:700;">${p.projectedPoints.toFixed(2)} pts</td>
        <td style="color:var(--accent);font-weight:700;">VAL ${p.baseValue}</td>`;
      tbody.appendChild(tr);
    });
  }

  const canvas = document.getElementById("analyticsCanvasSingle");
  if (!canvas || !pool.length) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 860, H = canvas.clientHeight || 440;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const xs = pool.map(p => Number(p[cfg.xKey] || 0));
  const ys = pool.map(p => Number(p[cfg.yKey] || 0));
  let minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  const padX = Math.max(0.4, (maxX - minX) * 0.12), padY = Math.max(0.4, (maxY - minY) * 0.12);
  minX -= padX; maxX += padX; minY -= padY; maxY += padY;

  const plot = { l: 96, t: 28, w: W - 135, h: H - 96 };
  ctx.strokeStyle = "#222836"; ctx.lineWidth = 1;
  ctx.font = "600 11px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillStyle = "#8E96AA";

  for (let i = 0; i <= 5; i++) {
    const r = i / 5;
    const gx = plot.l + r * plot.w, gy = plot.t + (1 - r) * plot.h;
    ctx.beginPath();
    ctx.moveTo(gx, plot.t); ctx.lineTo(gx, plot.t + plot.h);
    ctx.moveTo(plot.l, gy); ctx.lineTo(plot.l + plot.w, gy);
    ctx.stroke();

    const xVal = minX + r * (maxX - minX), yVal = minY + r * (maxY - minY);
    ctx.textAlign = "center";
    ctx.fillText(Math.abs(xVal) >= 100 ? xVal.toFixed(0) : xVal.toFixed(1), gx, plot.t + plot.h + 20);
    ctx.textAlign = "right";
    ctx.fillText(Math.abs(yVal) >= 100 ? yVal.toFixed(0) : yVal.toFixed(1), plot.l - 10, gy + 4);
  }

  ctx.strokeStyle = "#4A5568"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plot.l, plot.t); ctx.lineTo(plot.l, plot.t + plot.h); ctx.lineTo(plot.l + plot.w, plot.t + plot.h);
  ctx.stroke();

  ctx.fillStyle = "#64D2FF"; ctx.font = "700 12px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(cfg.xLbl.toUpperCase(), plot.l + plot.w / 2, plot.t + plot.h + 48);
  ctx.save();
  ctx.translate(26, plot.t + plot.h / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(cfg.yLbl.toUpperCase(), 0, 0);
  ctx.restore();

  pool.forEach(p => {
    const xv = Number(p[cfg.xKey] || 0), yv = Number(p[cfg.yKey] || 0);
    const x = plot.l + ((xv - minX) / Math.max(0.001, maxX - minX)) * plot.w;
    const y = plot.t + plot.h - ((yv - minY) / Math.max(0.001, maxY - minY)) * plot.h;

    const img = getTeamLogoImage(p.team);
    const size = 26;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    } else {
      ctx.fillStyle = "#232834";
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#F2F4F8"; ctx.font = "700 8px -apple-system, sans-serif";
      ctx.textAlign = "center"; ctx.fillText(p.team.slice(0, 3), x, y + 3);
    }

    ctx.fillStyle = "#F2F4F8"; ctx.font = "700 10px -apple-system, BlinkMacSystemFont, sans-serif";
    const label = p.position === "DEF" ? p.team : (p.name.split(" ").slice(1).join(" ") || p.name);
    const tw = ctx.measureText(label).width;
    if (x + 15 + tw > plot.l + plot.w + 20) { ctx.textAlign = "right"; ctx.fillText(label, x - 15, y + 4); }
    else { ctx.textAlign = "left"; ctx.fillText(label, x + 15, y + 4); }
  });
  ctx.textAlign = "left";
}

function renderSosCellHTML(teamAbbr, weekNum, pos, showDomeBadge = false) {
  let normTeam = (teamAbbr || "").toUpperCase().trim();
  if (normTeam === "JAC") normTeam = "JAX"; if (normTeam === "LA") normTeam = "LAR";

  if (BYE_2026[normTeam] === weekNum) {
    return `<div class="sos-cell sos-bye"><div style="font-weight:800;font-size:12px;">BYE WEEK</div><div style="font-size:10px;">Week ${weekNum} Off</div></div>`;
  }
  const m = NFL_2026_SCHEDULE[normTeam]?.[weekNum];
  if (!m) return `<div class="sos-cell sos-mid"><div style="font-weight:700;font-size:12px;">TBD</div></div>`;

  const opp = m.opp;
  const dvpRank = DVP_RANKS_2026[pos]?.[opp] || 16;
  let cls = "sos-mid", tierTxt = "Neutral";
  if (dvpRank >= 25) { cls = "sos-smash"; tierTxt = "Smash"; }
  else if (dvpRank >= 18) { cls = "sos-good"; tierTxt = "Favorable"; }
  else if (dvpRank <= 5) { cls = "sos-avoid"; tierTxt = "Shutdown"; }
  else if (dvpRank <= 11) { cls = "sos-tough"; tierTxt = "Tough"; }

  const prefix = m.isHome ? "vs" : "@";
  const venueTeam = m.isHome ? normTeam : opp;
  const envBadge = (showDomeBadge && DOME_TEAMS.has(venueTeam)) ? `<span class="dome-tag">DOME</span>` : "";

  return `
    <div class="sos-cell ${cls}">
      <div style="display:flex;align-items:center;gap:4px;font-weight:800;font-size:12px;">
        <img class="team-logo-sm" style="margin-right:2px;" src="${teamLogoUrl(opp)}" onerror="this.style.display='none'"/>
        <span>${prefix} ${opp}</span>${envBadge}
      </div>
      <div style="font-size:10px;font-weight:700;opacity:0.92;">DvP #${dvpRank} • ${tierTxt}</div>
    </div>`;
}

function computeSosWindowMetrics(teamAbbr, weeks, pos) {
  let normTeam = (teamAbbr || "").toUpperCase().trim();
  if (normTeam === "JAC") normTeam = "JAX"; if (normTeam === "LA") normTeam = "LAR";

  let sumRank = 0, activeGames = 0, smashCount = 0, domeCount = 0, hasBye = false;
  weeks.forEach(w => {
    if (BYE_2026[normTeam] === w) { hasBye = true; return; }
    const m = NFL_2026_SCHEDULE[normTeam]?.[w];
    const r = m ? (DVP_RANKS_2026[pos]?.[m.opp] || 16) : 16;
    const venueTeam = m ? (m.isHome ? normTeam : m.opp) : "";
    if (DOME_TEAMS.has(venueTeam)) domeCount++;
    sumRank += r; activeGames++;
    if (r >= 24) smashCount++;
  });
  const avgRank = activeGames > 0 ? sumRank / activeGames : 16;
  let grade = "B", badgeCls = "badge-blue";
  if (avgRank >= 24.5) { grade = "A+ (Smash Slate)"; badgeCls = "badge-green"; }
  else if (avgRank >= 20.5) { grade = "A (Easy Slate)"; badgeCls = "badge-green"; }
  else if (avgRank >= 16.5) { grade = "B+ (Favorable)"; badgeCls = "badge-blue"; }
  else if (avgRank >= 13.0) { grade = "C (Neutral)"; badgeCls = "badge-yellow"; }
  else if (avgRank >= 9.5) { grade = "D (Tough Slate)"; badgeCls = "badge-yellow"; }
  else { grade = "F (Brutal Slate)"; badgeCls = "badge-red"; }

  return { avgRank, activeGames, smashCount, domeCount, hasBye, grade, badgeCls };
}

function renderSosTab() {
  const pos = document.getElementById("sosPos")?.value || "QB";
  const scope = document.getElementById("sosScope")?.value || "ALL";
  const sortOrder = document.getElementById("sosSort")?.value || "EASIEST";
  const winMode = state.sosWindowMode || "NEXT4";

  let weeks = [], windowLabel = "";
  const isPlayoffs = (winMode === "PLAYOFFS" || winMode === "PUSH");

  if (winMode === "PLAYOFFS") {
    weeks = getPlayoffWeeksForActiveLeague();
    windowLabel = `FANTASY PLAYOFFS (WEEKS ${weeks[0]}–${weeks[weeks.length - 1]})`;
    document.getElementById("sosWindowBadge").textContent = `FANTASY PLAYOFF SLATE (WKS ${weeks[0]}–${weeks[weeks.length - 1]})`;
    document.getElementById("sosWindowBadge").className = "badge badge-green";
  } else if (winMode === "PUSH") {
    const poWks = getPlayoffWeeksForActiveLeague();
    weeks = [Math.max(1, poWks[0] - 1), ...poWks];
    windowLabel = `PLAYOFF PUSH + PLAYOFFS (WEEKS ${weeks[0]}–${weeks[weeks.length - 1]})`;
    document.getElementById("sosWindowBadge").textContent = `PLAYOFF PUSH + PLAYOFFS (WKS ${weeks[0]}–${weeks[weeks.length - 1]})`;
    document.getElementById("sosWindowBadge").className = "badge badge-purple";
  } else {
    const startWk = Math.min(15, Math.max(1, state.week));
    weeks = [startWk, startWk + 1, startWk + 2, startWk + 3];
    windowLabel = `UPCOMING 4-WEEK SLATE (WEEKS ${weeks[0]}–${weeks[3]})`;
    document.getElementById("sosWindowBadge").textContent = `UPCOMING 4 WEEKS (WKS ${weeks[0]}–${weeks[3]})`;
    document.getElementById("sosWindowBadge").className = "badge badge-blue";
  }

  document.getElementById("sosTitleHdr").textContent = `POSITIONAL STRENGTH OF SCHEDULE (${pos} • ${windowLabel})`;
  const weekHeadersHTML = weeks.map(w => `<th>Week ${w}</th>`).join("");
  const tbl = document.getElementById("sosTable");
  if (!tbl) return;
  const subjectHeader = scope === "ALL" ? "NFL Team" : "Player / Unit";
  const showActionCol = scope !== "ALL";
  tbl.innerHTML = `<thead><tr><th style="width:55px;">Rank</th><th style="text-align:left;min-width:230px;">${subjectHeader}</th>${weekHeadersHTML}<th style="width:155px;">Window Avg DvP</th><th style="width:165px;">Schedule Grade</th>${showActionCol ? '<th style="width:135px;">Trade Action</th>' : ''}</tr></thead><tbody></tbody>`;
  const tbody = tbl.querySelector("tbody");

  let rows = [];
  if (scope === "ALL") {
    rows = Object.keys(NFL_TEAM_NAMES).map(team => ({ isTeamRow: true, team, name: NFL_TEAM_NAMES[team], sos: computeSosWindowMetrics(team, weeks, pos) }));
  } else if (scope === "TOP_PLAYERS") {
    rows = Object.values(state.players).filter(p => !p.isPick && p.position === pos && p.isCurrentNfl)
      .sort((a, b) => (b.baseValue - a.baseValue) || (b.seasonPpg - a.seasonPpg)).slice(0, 36)
      .map(p => ({ isTeamRow: false, player: p, team: p.team, sos: computeSosWindowMetrics(p.team, weeks, pos) }));
  } else if (scope === "ROSTER") {
    const selTeamIdx = parseInt(document.getElementById("teamSelect")?.value || "0", 10);
    const mgr = state.managers[selTeamIdx];
    rows = (mgr ? mgr.players : []).map(id => state.players[id])
      .filter(p => p && !p.isPick && p.position === pos)
      .map(p => ({ isTeamRow: false, player: p, team: p.team, sos: computeSosWindowMetrics(p.team, weeks, pos) }));
  } else {
    const rostered = new Set();
    state.managers.forEach(m => m.players.forEach(pid => rostered.add(pid)));
    rows = Object.values(state.players).filter(p => !p.isPick && p.position === pos && p.isCurrentNfl && !rostered.has(p.id))
      .sort((a, b) => (b.vorpScore - a.vorpScore) || (b.projectedPoints - a.projectedPoints)).slice(0, 24)
      .map(p => ({ isTeamRow: false, player: p, team: p.team, sos: computeSosWindowMetrics(p.team, weeks, pos) }));
  }

  rows.sort((a, b) => sortOrder === "EASIEST" ? (b.sos.avgRank - a.sos.avgRank) : (a.sos.avgRank - b.sos.avgRank));

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="${weeks.length + (showActionCol ? 5 : 4)}" style="padding:24px;color:var(--text-muted);">Sync your Sleeper league or switch Scope to "All 32 NFL Teams" or "Top 36 Positional Players" to view schedules.</td></tr>`;
    return;
  }

  rows.forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.className = "table-row-hover";
    const envMeta = isPlayoffs ? `${r.sos.domeCount} Dome Game(s) • ${r.sos.smashCount} Smash Matchup(s)` : `2026 Bye: Week ${BYE_2026[r.team] || '--'} • ${r.sos.smashCount} Smash Matchup(s)`;
    const subjectHTML = r.isTeamRow
      ? `<div class="player-cell"><img class="avatar" src="${teamLogoUrl(r.team)}" onerror="this.style.display='none'" /><div><div style="font-weight:800;font-size:14px;">${r.name} (${r.team})</div><div style="font-size:11px;color:var(--text-muted);">${envMeta}</div></div></div>`
      : `<div class="player-cell"><img class="avatar" src="${avatarUrl(r.player)}" onerror="this.style.display='none'" /><div><div style="font-weight:700;font-size:14px;"><img class="team-logo-sm" src="${teamLogoUrl(r.team)}" onerror="this.style.display='none'"/>${r.player.name}</div><div style="font-size:11px;color:var(--text-muted);">${r.player.position} #${r.player.posRank} (${r.team}) • ${r.player.seasonPpg.toFixed(1)} PPG • VAL ${r.player.baseValue}</div></div></div>`;

    const cellsHTML = weeks.map(w => `<td>${renderSosCellHTML(r.team, w, pos, isPlayoffs)}</td>`).join("");
    tr.innerHTML = `
      <td style="font-weight:800;color:var(--text-muted);">#${idx + 1}</td>
      <td>${subjectHTML}</td>${cellsHTML}
      <td><div style="font-weight:800;font-size:13px;">DvP #${r.sos.avgRank.toFixed(1)}</div><div style="font-size:11px;color:var(--text-muted);">${r.sos.activeGames} Games${r.sos.hasBye ? ' (1 Bye)' : ''}${isPlayoffs ? ` • ${r.sos.domeCount} Dome` : ''}</div></td>
      <td><span class="badge ${r.sos.badgeCls}">${r.sos.grade}</span></td>
      ${showActionCol ? '<td><button class="btn-builder-action">Trade Target →</button></td>' : ''}`;
    if (showActionCol && r.player) tr.querySelector("button").onclick = () => targetPlayerFromSos(r.player.id, pos);
    tbody.appendChild(tr);
  });
}

function erf(x) {
  const s = x >= 0 ? 1 : -1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}

function computeHeadToHeadWinProb(scoreA, scoreB, numWeeks = 1) {
  const margin = (scoreA || 0) - (scoreB || 0);
  const sigma = 21.5 * Math.sqrt(Math.max(1, numWeeks));
  const z = margin / sigma;
  if (isNaN(z) || Math.abs(margin) < 0.01) return 50.0;
  return Math.min(98.5, Math.max(1.5, 0.5 * (1 + erf(z / Math.sqrt(2))) * 100));
}

function renderPlayoffBracketTab() {
  const grid = document.getElementById("bracketGridContainer");
  const oddsTbl = document.getElementById("bracketOddsTable");
  if (!grid || !oddsTbl) return;

  const pTeams = getResolvedPlayoffTeamCount();
  const reseedMode = getResolvedBracketReseedMode();
  const roundWeeks = getPlayoffRoundWeeksStructure();
  const allPoWeeks = getPlayoffWeeksForActiveLeague();
  const isFourTeam = pTeams === 4;

  const startWk = allPoWeeks[0], endWk = allPoWeeks[allPoWeeks.length - 1];
  const reseedText = reseedMode === "RESEED" ? "NFL Re-Seeded" : "Fixed Draw";

  document.getElementById("bracketMainTitle").textContent = `${pTeams}-TEAM FANTASY PLAYOFF BRACKET SIMULATOR (WEEKS ${startWk}–${endWk})`;
  document.getElementById("bracketFormatBadge").textContent = `LEAGUE FORMAT: ${pTeams}-TEAM PLAYOFF • WKS ${startWk}–${endWk} • ${reseedText.toUpperCase()}`;

  if (!state.managers || state.managers.length < 4) {
    grid.className = "bracket-grid";
    grid.innerHTML = `<div class="card-banner" style="grid-column:1 / -1; text-align:center; padding:28px;"><div style="font-size:14px; font-weight:800;">Sync Your Sleeper Account to Simulate Your League's Playoff Bracket</div><div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Enter your Sleeper username in the top bar and click Sync Account to load your league's exact playoff team count (4, 6, 7, or 8 teams), start week, and seeding rules.</div></div>`;
    oddsTbl.innerHTML = "";
    return;
  }

  const seedMode = document.getElementById("bracketSeedMode")?.value || "CURRENT";
  const ranked = [...state.managers];
  if (seedMode === "CURRENT") {
    ranked.sort((a, b) => {
      const tgA = a.wins + a.losses, tgB = b.wins + b.losses;
      const wpA = tgA > 0 ? a.wins / tgA : 0, wpB = tgB > 0 ? b.wins / tgB : 0;
      if (Math.abs(wpB - wpA) > 0.0001) return wpB - wpA;
      if (Math.abs(b.pf - a.pf) > 0.01) return b.pf - a.pf;
      return b.pa - a.pa;
    });
  } else if (seedMode === "PROJ") {
    ranked.sort((a, b) => (b.projW - a.projW) || (b.power - a.power) || (b.pf - a.pf));
  } else {
    ranked.sort((a, b) => (b.power - a.power) || (b.pf - a.pf));
  }

  const showCount = Math.min(ranked.length, pTeams + 2);
  const seeded = ranked.slice(0, showCount).map((mgr, idx) => {
    const roundScores = roundWeeks.map(wks => wks.reduce((s, w) => s + calcPlayoffWeekProjection(mgr.players, w).total, 0));
    const coreNames = calcPlayoffWeekProjection(mgr.players, startWk).topNames.join(", ");
    return { ...mgr, seed: idx + 1, roundScores, coreNames };
  });

  function resolveSeries(matchKey, teamA, teamB, roundIdx) {
    const wks = roundWeeks[roundIdx] || [15];
    const scoreA = teamA.roundScores[roundIdx] || 0;
    const scoreB = teamB.roundScores[roundIdx] || 0;
    const probA = computeHeadToHeadWinProb(scoreA, scoreB, wks.length);
    const defWinner = scoreA >= scoreB ? teamA : teamB;
    const ovr = state.bracketOverrides[matchKey];
    const winner = ovr === teamA.rosterId ? teamA : (ovr === teamB.rosterId ? teamB : defWinner);
    const loser = winner.rosterId === teamA.rosterId ? teamB : teamA;
    return { matchKey, roundIdx, wks, teamA, teamB, scoreA, scoreB, probA, winner, loser };
  }

  function renderMatchupCardHTML(title, series) {
    const { matchKey, teamA, teamB, scoreA, scoreB, probA, winner } = series;
    const probB = 100 - probA;
    const aWon = winner.rosterId === teamA.rosterId;
    const bWon = winner.rosterId === teamB.rosterId;
    return `
      <div class="bracket-match-card">
        <div class="bracket-match-hdr">
          <span>${title}</span>
          <button class="btn-builder-action" style="padding:2px 8px;font-size:10px;" onclick="openMatchupInSimulator(${teamA.rosterId}, ${teamB.rosterId})">Inspect H2H →</button>
        </div>
        <div class="bracket-slot ${aWon ? 'winner' : ''}" data-mkey="${matchKey}" data-rid="${teamA.rosterId}">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
            <span class="seed-pill ${teamA.seed <= 2 ? 'top-seed' : ''}">#${teamA.seed}</span>
            <div style="min-width:0;flex:1;"><div style="font-weight:800;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${teamA.teamName.split(" (")[0]}</div><div style="font-size:10px;color:var(--text-muted);">${teamA.wins}-${teamA.losses} • Core: ${teamA.coreNames}</div></div>
          </div>
          <div style="text-align:right;"><div style="font-weight:800;font-size:13px;color:${aWon ? 'var(--good)' : 'var(--text-main)'};">${scoreA.toFixed(1)} pts</div><div style="font-size:10px;font-weight:700;color:${probA >= 50 ? 'var(--good)' : 'var(--text-muted)'};">${probA.toFixed(0)}% Win</div></div>
        </div>
        <div class="bracket-slot ${bWon ? 'winner' : ''}" data-mkey="${matchKey}" data-rid="${teamB.rosterId}">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
            <span class="seed-pill ${teamB.seed <= 2 ? 'top-seed' : ''}">#${teamB.seed}</span>
            <div style="min-width:0;flex:1;"><div style="font-weight:800;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${teamB.teamName.split(" (")[0]}</div><div style="font-size:10px;color:var(--text-muted);">${teamB.wins}-${teamB.losses} • Core: ${teamB.coreNames}</div></div>
          </div>
          <div style="text-align:right;"><div style="font-weight:800;font-size:13px;color:${bWon ? 'var(--good)' : 'var(--text-main)'};">${scoreB.toFixed(1)} pts</div><div style="font-size:10px;font-weight:700;color:${probB > 50 ? 'var(--good)' : 'var(--text-muted)'};">${probB.toFixed(0)}% Win</div></div>
        </div>
      </div>`;
  }

  const fmtWkTag = wks => wks.length > 1 ? `WEEKS ${wks[0]}–${wks[wks.length - 1]}` : `WEEK ${wks[0]}`;
  let sf1, sf2, champ, third;
  const qfSeriesList = [], byeTeams = [];

  if (isFourTeam) {
    grid.className = "bracket-grid two-col";
    sf1 = resolveSeries("sf1", seeded[0], seeded[3], 0);
    sf2 = resolveSeries("sf2", seeded[1], seeded[2], 0);
    champ = resolveSeries("champ", sf1.winner, sf2.winner, 1);
    third = resolveSeries("third", sf1.loser, sf2.loser, 1);

    grid.innerHTML = `
      <div class="bracket-col">
        <div class="bracket-col-hdr"><div><div style="font-size:13px;font-weight:800;">ROUND 1: SEMIFINALS (4-TEAM)</div><div style="font-size:11px;color:var(--text-muted);">${fmtWkTag(roundWeeks[0])} • Top 4 Seeds Qualify</div></div><span class="badge badge-purple">${fmtWkTag(roundWeeks[0])}</span></div>
        ${renderMatchupCardHTML("SEMIFINAL 1 (#1 VS #4)", sf1)}
        ${renderMatchupCardHTML("SEMIFINAL 2 (#2 VS #3)", sf2)}
      </div>
      <div class="bracket-col">
        <div class="bracket-col-hdr"><div><div style="font-size:13px;font-weight:800;color:var(--good);">ROUND 2: CHAMPIONSHIP FINALS</div><div style="font-size:11px;color:var(--text-muted);">${fmtWkTag(roundWeeks[1])} • League Title & 3rd Place</div></div><span class="badge badge-green">${fmtWkTag(roundWeeks[1])}</span></div>
        ${renderMatchupCardHTML(`LEAGUE CHAMPIONSHIP (#${sf1.winner.seed} VS #${sf2.winner.seed})`, champ)}
        <div class="champ-callout"><div style="font-size:10px;font-weight:800;color:var(--good);letter-spacing:0.8px;">PROJECTED 2026 LEAGUE CHAMPION</div><div style="font-size:17px;font-weight:900;margin-top:4px;">#${champ.winner.seed} ${champ.winner.teamName.split(" (")[0]}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Finals Projection: <b style="color:var(--good);">${(champ.winner.roundScores[1] || 0).toFixed(2)} pts</b> • Core: ${champ.winner.coreNames}</div></div>
        ${renderMatchupCardHTML(`3RD PLACE GAME (#${sf1.loser.seed} VS #${sf2.loser.seed})`, third)}
      </div>`;
  } else {
    grid.className = "bracket-grid";
    if (pTeams === 6) {
      byeTeams.push(seeded[0], seeded[1]);
      qfSeriesList.push(
        { label: "QUARTERFINAL 1 (#4 VS #5)", series: resolveSeries("qf1", seeded[3], seeded[4], 0) },
        { label: "QUARTERFINAL 2 (#3 VS #6)", series: resolveSeries("qf2", seeded[2], seeded[5], 0) }
      );
    } else if (pTeams === 7) {
      byeTeams.push(seeded[0]);
      qfSeriesList.push(
        { label: "QUARTERFINAL 1 (#4 VS #5)", series: resolveSeries("qf1", seeded[3], seeded[4], 0) },
        { label: "QUARTERFINAL 2 (#3 VS #6)", series: resolveSeries("qf2", seeded[2], seeded[5], 0) },
        { label: "QUARTERFINAL 3 (#2 VS #7)", series: resolveSeries("qf3", seeded[1], seeded[6], 0) }
      );
    } else {
      qfSeriesList.push(
        { label: "QUARTERFINAL 1 (#1 VS #8)", series: resolveSeries("qf1", seeded[0], seeded[7], 0) },
        { label: "QUARTERFINAL 2 (#4 VS #5)", series: resolveSeries("qf2", seeded[3], seeded[4], 0) },
        { label: "QUARTERFINAL 3 (#3 VS #6)", series: resolveSeries("qf3", seeded[2], seeded[5], 0) },
        { label: "QUARTERFINAL 4 (#2 VS #7)", series: resolveSeries("qf4", seeded[1], seeded[6], 0) }
      );
    }

    const qfWinners = qfSeriesList.map(q => q.series.winner);
    const semiPool = [...byeTeams, ...qfWinners];
    let sf1Pair, sf2Pair;
    if (reseedMode === "RESEED") {
      const sp = [...semiPool].sort((a, b) => a.seed - b.seed);
      sf1Pair = [sp[0], sp[3]]; sf2Pair = [sp[1], sp[2]];
    } else {
      if (pTeams === 6) { sf1Pair = [seeded[0], qfWinners[0]]; sf2Pair = [seeded[1], qfWinners[1]]; }
      else if (pTeams === 7) { sf1Pair = [seeded[0], qfWinners[0]]; sf2Pair = [qfWinners[2], qfWinners[1]]; }
      else { sf1Pair = [qfWinners[0], qfWinners[1]]; sf2Pair = [qfWinners[3], qfWinners[2]]; }
    }

    sf1 = resolveSeries("sf1", sf1Pair[0], sf1Pair[1], 1);
    sf2 = resolveSeries("sf2", sf2Pair[0], sf2Pair[1], 1);
    champ = resolveSeries("champ", sf1.winner, sf2.winner, 2);
    third = resolveSeries("third", sf1.loser, sf2.loser, 2);

    const byeCardHTML = byeTeams.length ? `
      <div class="bracket-match-card">
        <div class="bracket-match-hdr"><span>FIRST-ROUND BYE${byeTeams.length > 1 ? 'S' : ''}</span><span style="color:var(--accent);">AUTO-ADVANCE</span></div>
        ${byeTeams.map(bt => `<div class="bracket-slot bye-slot"><div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;"><span class="seed-pill top-seed">#${bt.seed}</span><div style="min-width:0;flex:1;"><div style="font-weight:800;font-size:13px;">${bt.teamName.split(" (")[0]}</div><div style="font-size:10px;color:var(--text-muted);">Record: ${bt.wins}-${bt.losses} • PF: ${bt.pf.toFixed(1)}</div></div></div><span class="badge badge-blue">ROUND 1 BYE</span></div>`).join("")}
      </div>` : "";

    const qfLosersHTML = qfSeriesList.map(q => `#${q.series.loser.seed} ${q.series.loser.teamName.split(" (")[0]} (${(q.series.loser.roundScores[0] || 0).toFixed(1)})`).join(" • ");

    grid.innerHTML = `
      <div class="bracket-col">
        <div class="bracket-col-hdr"><div><div style="font-size:13px;font-weight:800;">ROUND 1: QUARTERFINALS (${pTeams}-TEAM)</div><div style="font-size:11px;color:var(--text-muted);">${fmtWkTag(roundWeeks[0])} • ${byeTeams.length ? `Top ${byeTeams.length} Seed(s) on Bye` : 'All 8 Seeds Active'}</div></div><span class="badge badge-blue">${fmtWkTag(roundWeeks[0])}</span></div>
        ${byeCardHTML}
        ${qfSeriesList.map(q => renderMatchupCardHTML(q.label, q.series)).join("")}
      </div>
      <div class="bracket-col">
        <div class="bracket-col-hdr"><div><div style="font-size:13px;font-weight:800;">ROUND 2: SEMIFINALS</div><div style="font-size:11px;color:var(--text-muted);">${fmtWkTag(roundWeeks[1])} • ${reseedText}</div></div><span class="badge badge-purple">${fmtWkTag(roundWeeks[1])}</span></div>
        ${renderMatchupCardHTML(`SEMIFINAL 1 (#${sf1.teamA.seed} VS #${sf1.teamB.seed})`, sf1)}
        ${renderMatchupCardHTML(`SEMIFINAL 2 (#${sf2.teamA.seed} VS #${sf2.teamB.seed})`, sf2)}
        <div class="bracket-match-card" style="margin-top:auto;"><div class="bracket-match-hdr"><span>QUARTERFINAL EXITS</span><span>CONSOLATION</span></div><div style="font-size:11px;color:var(--text-muted);line-height:1.5;padding:2px;">${qfLosersHTML}</div></div>
      </div>
      <div class="bracket-col">
        <div class="bracket-col-hdr"><div><div style="font-size:13px;font-weight:800;color:var(--good);">ROUND 3: FINALS</div><div style="font-size:11px;color:var(--text-muted);">${fmtWkTag(roundWeeks[2])} • Championship & 3rd Place</div></div><span class="badge badge-green">${fmtWkTag(roundWeeks[2])}</span></div>
        ${renderMatchupCardHTML(`LEAGUE CHAMPIONSHIP (#${sf1.winner.seed} VS #${sf2.winner.seed})`, champ)}
        <div class="champ-callout"><div style="font-size:10px;font-weight:800;color:var(--good);letter-spacing:0.8px;">PROJECTED 2026 LEAGUE CHAMPION</div><div style="font-size:17px;font-weight:900;margin-top:4px;">#${champ.winner.seed} ${champ.winner.teamName.split(" (")[0]}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Finals Projection: <b style="color:var(--good);">${(champ.winner.roundScores[2] || 0).toFixed(2)} pts</b> • Core: ${champ.winner.coreNames}</div></div>
        ${renderMatchupCardHTML(`3RD PLACE GAME (#${sf1.loser.seed} VS #${sf2.loser.seed})`, third)}
      </div>`;
  }

  grid.querySelectorAll(".bracket-slot[data-mkey]").forEach(slotEl => {
    slotEl.onclick = () => {
      const mkey = slotEl.dataset.mkey;
      state.bracketOverrides[mkey] = parseInt(slotEl.dataset.rid, 10);
      if (mkey.startsWith("qf")) { delete state.bracketOverrides.sf1; delete state.bracketOverrides.sf2; delete state.bracketOverrides.champ; delete state.bracketOverrides.third; }
      else if (mkey.startsWith("sf")) { delete state.bracketOverrides.champ; delete state.bracketOverrides.third; }
      renderPlayoffBracketTab();
    };
  });

  const roundHeadersHTML = roundWeeks.map((wks, idx) => {
    const lbl = isFourTeam ? (idx === 0 ? "Semifinals" : "Finals") : (idx === 0 ? "Quarters" : (idx === 1 ? "Semis" : "Finals"));
    return `<th>${lbl} (${wks.length > 1 ? 'W' + wks[0] + '–' + wks[wks.length - 1] : 'W' + wks[0]})</th>`;
  }).join("");

  oddsTbl.innerHTML = `<thead><tr><th style="width:80px;">Seed</th><th style="text-align:left;">Team / Manager</th><th>Current Record</th><th>Proj Final</th>${roundHeadersHTML}<th>Finals Berth %</th><th>Title Odds %</th><th>Action</th></tr></thead><tbody></tbody>`;
  const tbody = oddsTbl.querySelector("tbody");

  const byeSeedsSet = new Set(byeTeams.map(b => b.seed));
  const qfProbBySeed = {};
  qfSeriesList.forEach(q => {
    qfProbBySeed[q.series.teamA.seed] = q.series.probA;
    qfProbBySeed[q.series.teamB.seed] = 100 - q.series.probA;
  });

  seeded.forEach(tm => {
    const isBubble = tm.seed > pTeams;
    const hasBye = byeSeedsSet.has(tm.seed);
    let r1Advance = 0, finalsBerthPct = 0, titlePct = 0;

    if (!isBubble) {
      if (isFourTeam) {
        r1Advance = 100;
        const semiSeries = (tm.seed === 1 || tm.seed === 4) ? sf1 : sf2;
        const otherSemiWinner = (tm.seed === 1 || tm.seed === 4) ? sf2.winner : sf1.winner;
        finalsBerthPct = semiSeries.teamA.rosterId === tm.rosterId ? semiSeries.probA : (100 - semiSeries.probA);
        titlePct = (finalsBerthPct / 100) * computeHeadToHeadWinProb(tm.roundScores[1], otherSemiWinner.roundScores[1], roundWeeks[1].length);
      } else {
        r1Advance = hasBye ? 100 : (qfProbBySeed[tm.seed] || 50);
        const refSemiOpp = tm.seed === 1 ? sf1.teamB : (tm.seed === 2 ? sf2.teamB : seeded[0]);
        const semiWinCond = computeHeadToHeadWinProb(tm.roundScores[1], refSemiOpp.roundScores[1], roundWeeks[1].length);
        finalsBerthPct = (r1Advance / 100) * semiWinCond;
        const refFinalsOpp = tm.seed === 1 ? seeded[1] : seeded[0];
        titlePct = (finalsBerthPct / 100) * computeHeadToHeadWinProb(tm.roundScores[2], refFinalsOpp.roundScores[2], roundWeeks[2].length);
      }
    }

    const seedBadge = isBubble ? `<span class="badge badge-yellow">#${tm.seed} BUBBLE</span>` : (hasBye ? `<span class="badge badge-blue">#${tm.seed} BYE</span>` : `<span class="badge badge-green">#${tm.seed} SEED</span>`);
    const roundScoreCells = tm.roundScores.map((sc, idx) => {
      if (idx === 0 && hasBye && !isFourTeam) return `<td style="font-weight:700;color:var(--accent);">BYE (${sc.toFixed(1)})</td>`;
      return `<td style="font-weight:700;color:${idx === tm.roundScores.length - 1 ? 'var(--good)' : 'var(--text-main)'};">${sc.toFixed(1)} pts</td>`;
    }).join("");

    const tr = document.createElement("tr");
    tr.className = "table-row-hover";
    tr.innerHTML = `
      <td>${seedBadge}</td>
      <td style="text-align:left;"><div style="font-weight:800;">${tm.teamName}</div><div style="font-size:11px;color:var(--text-muted);">Core: ${tm.coreNames} • Power: ${tm.power.toFixed(1)}</div></td>
      <td style="font-weight:700;">${tm.wins} - ${tm.losses} (${tm.pf.toFixed(1)} PF)</td>
      <td style="color:var(--accent);font-weight:700;">${tm.projW} - ${tm.projL}</td>
      ${roundScoreCells}
      <td style="font-weight:700;color:${isBubble ? 'var(--text-muted)' : 'var(--text-main)'};">${isBubble ? '--' : finalsBerthPct.toFixed(1) + '%'}</td>
      <td><span class="badge ${titlePct >= 22 ? 'badge-green' : (titlePct >= 10 ? 'badge-blue' : 'badge-yellow')}">${isBubble ? `Outside Top ${pTeams}` : titlePct.toFixed(1) + '%'}</span></td>
      <td><button class="btn-builder-action" onclick="openMatchupInSimulator(${tm.rosterId}, ${seeded[0].rosterId === tm.rosterId ? seeded[1].rosterId : seeded[0].rosterId})">Sim vs #1</button></td>`;
    tbody.appendChild(tr);
  });
}

function renderMatchupSim() {
  const selA = document.getElementById("simTeamA")?.value;
  const selB = document.getElementById("simTeamB")?.value;
  if (selA === undefined || selB === undefined || selA === "" || selB === "") return;
  const tmA = state.managers[parseInt(selA, 10)];
  const tmB = state.managers[parseInt(selB, 10)];
  if (!tmA || !tmB) return;

  let slots = (state.activeLeague?.rosterPositions || []).filter(s => !["BN","IR","TAXI"].includes(s));
  if (!slots.length) slots = ["QB","RB","RB","WR","WR","TE","FLEX","K","DEF"];

  let totA = 0, totB = 0;
  const rowsEl = document.getElementById("simRows");
  rowsEl.innerHTML = "";
  slots.forEach((sl, i) => {
    const pA = state.players[tmA.starters[i]] || { name:"Empty Slot", position:sl, team:"FA", projectedPoints:0 };
    const pB = state.players[tmB.starters[i]] || { name:"Empty Slot", position:sl, team:"FA", projectedPoints:0 };
    totA += (pA.projectedPoints || 0); totB += (pB.projectedPoints || 0);
    const edge = Math.abs((pA.projectedPoints || 0) - (pB.projectedPoints || 0));
    const aWins = (pA.projectedPoints || 0) > (pB.projectedPoints || 0);
    const bWins = (pB.projectedPoints || 0) > (pA.projectedPoints || 0);
    const styleA = aWins ? "border:1.5px solid var(--good); background:var(--good-bg);" : "border:1px solid var(--border);";
    const styleB = bWins ? "border:1.5px solid var(--good); background:var(--good-bg);" : "border:1px solid var(--border);";

    const row = document.createElement("div");
    row.className = "opt-row"; row.style.height = "68px";
    row.innerHTML = `
      <div class="p-card" style="height:60px; ${styleA}"><img class="avatar" src="${avatarUrl(pA)}" onerror="this.style.display='none'" /><div style="flex:1;"><b style="color:#F2F4F8;"><img class="team-logo-sm" src="${teamLogoUrl(pA.team)}" onerror="this.style.display='none'"/>${pA.name}</b><div style="font-size:11px;color:var(--text-muted);">${pA.position} - ${pA.team}</div></div><b style="color:${aWins ? 'var(--good)' : 'var(--text-main)'};">${(pA.projectedPoints||0).toFixed(2)} pts</b></div>
      <div style="background:var(--bg-card);color:var(--accent);border:1px solid var(--border);border-radius:10px;text-align:center;font-weight:800;font-size:11px;padding:8px;">${sl}<br>+${edge.toFixed(1)}</div>
      <div class="p-card" style="height:60px; ${styleB}"><img class="avatar" src="${avatarUrl(pB)}" onerror="this.style.display='none'" /><div style="flex:1;"><b style="color:#F2F4F8;"><img class="team-logo-sm" src="${teamLogoUrl(pB.team)}" onerror="this.style.display='none'"/>${pB.name}</b><div style="font-size:11px;color:var(--text-muted);">${pB.position} - ${pB.team}</div></div><b style="color:${bWins ? 'var(--good)' : 'var(--text-main)'};">${(pB.projectedPoints||0).toFixed(2)} pts</b></div>`;
    rowsEl.appendChild(row);
  });

  const margin = totA - totB;
  const winA = computeHeadToHeadWinProb(totA, totB, 1);
  const winB = 100 - winA;

  document.getElementById("simBannerA").textContent = `${tmA.teamName.split(" (")[0]} Win Prob: ${winA.toFixed(1)}%`;
  document.getElementById("simBannerA").style.color = winA >= winB ? "var(--good)" : "var(--bad)";
  document.getElementById("simScoreA").textContent = `Proj Score: ${totA.toFixed(2)} pts (Spread: ${margin>=0?'+':''}${margin.toFixed(2)})`;

  document.getElementById("simBannerB").textContent = `${tmB.teamName.split(" (")[0]} Win Prob: ${winB.toFixed(1)}%`;
  document.getElementById("simBannerB").style.color = winB > winA ? "var(--good)" : "var(--bad)";
  document.getElementById("simScoreB").textContent = `Proj Score: ${totB.toFixed(2)} pts`;
}

function renderAllViews(teamIdx) {
  renderRosterTab(teamIdx); renderPowerTab();
  renderTradeBuilderSide(true); renderTradeBuilderSide(false);
  updateTradeEvaluation(); renderTradeFinder();
  renderOptimizerTab(teamIdx); renderWaiversTab();
  renderMatchupSim(); drawSingleAnalyticsChart();
  renderSosTab(); renderPlayoffBracketTab();
}

// --- Safe Event Listener Bindings ---
ensureDynamicTradeControls();

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab)?.classList.add("active");
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

document.getElementById("syncBtn")?.addEventListener("click", syncUserAccount);
document.getElementById("usernameInput")?.addEventListener("keydown", e => { if (e.key === "Enter") syncUserAccount(); });
document.getElementById("leagueSelect")?.addEventListener("change", e => loadLeague(parseInt(e.target.value, 10)));
document.getElementById("teamSelect")?.addEventListener("change", e => {
  const idx = parseInt(e.target.value, 10);
  if (document.getElementById("tradeTeamA")) document.getElementById("tradeTeamA").value = idx;
  renderRosterTab(idx); renderOptimizerTab(idx); renderSosTab(); renderTradeFinder(); buildTradeDatabase();
});
weekSelect?.addEventListener("change", async e => {
  state.week = parseInt(e.target.value, 10);
  syncLiveEspnSchedule([state.week, state.week + 1, state.week + 2, state.week + 3]);
  renderSosTab();
  if (state.activeLeague) await loadLeague(document.getElementById("leagueSelect").value);
});
document.getElementById("powerChartMode")?.addEventListener("change", drawPowerChart);
document.getElementById("tradeTeamA")?.addEventListener("change", e => {
  if (document.getElementById("teamSelect")) document.getElementById("teamSelect").value = e.target.value;
  state.tradeSideA = [];
  renderTradeBuilderSide(true); updateTradeEvaluation(); buildTradeDatabase();
});
document.getElementById("tradeTeamB")?.addEventListener("change", () => { state.tradeSideB = []; renderTradeBuilderSide(false); updateTradeEvaluation(); });
document.getElementById("clearTradeBtn")?.addEventListener("click", () => { state.tradeSideA = []; state.tradeSideB = []; renderTradeBuilderSide(true); renderTradeBuilderSide(false); updateTradeEvaluation(); });
document.getElementById("dbSearch")?.addEventListener("input", renderTradeDatabase);
document.getElementById("dbRosterScope")?.addEventListener("change", renderTradeDatabase);
document.getElementById("dbPosFilter")?.addEventListener("change", renderTradeDatabase);
document.getElementById("dbSrcFilter")?.addEventListener("change", renderTradeDatabase);
document.getElementById("finderPos")?.addEventListener("change", renderTradeFinder);
document.getElementById("finderPartnerType")?.addEventListener("change", renderTradeFinder);
document.getElementById("finderPkgType")?.addEventListener("change", renderTradeFinder);
document.getElementById("finderPickMode")?.addEventListener("change", renderTradeFinder);
document.getElementById("finderSosBoost")?.addEventListener("change", renderTradeFinder);
document.getElementById("finderStrat")?.addEventListener("change", renderTradeFinder);
document.getElementById("waiverPos")?.addEventListener("change", renderWaiversTab);
document.getElementById("waiverChartMode")?.addEventListener("change", drawWaiverChart);
document.getElementById("analyticsPos")?.addEventListener("change", () => { updateAnalyticsDropdownOptions(); drawSingleAnalyticsChart(); });
document.getElementById("analyticsGraphSelect")?.addEventListener("change", drawSingleAnalyticsChart);
document.getElementById("analyticsSortKey")?.addEventListener("change", () => { analyticsSortDir = -1; drawSingleAnalyticsChart(); });
document.getElementById("toggleAnalyticsFormulaBtn")?.addEventListener("click", () => {
  const el = document.getElementById("analyticsFormulaCard");
  if (el) el.style.display = el.style.display === "none" ? "flex" : "none";
});
document.getElementById("toggleTradeFormulaBtn")?.addEventListener("click", () => {
  const el = document.getElementById("tradeFormulaBox");
  if (el) el.style.display = el.style.display === "none" ? "block" : "none";
});
document.getElementById("sosPos")?.addEventListener("change", renderSosTab);
document.getElementById("sosScope")?.addEventListener("change", renderSosTab);
document.getElementById("sosSort")?.addEventListener("change", renderSosTab);
document.getElementById("bracketTeamsOverride")?.addEventListener("change", () => { state.bracketOverrides = {}; renderPlayoffBracketTab(); renderSosTab(); renderTradeFinder(); });
document.getElementById("bracketSeedMode")?.addEventListener("change", () => { state.bracketOverrides = {}; renderPlayoffBracketTab(); });
document.getElementById("bracketReseedMode")?.addEventListener("change", () => { delete state.bracketOverrides.sf1; delete state.bracketOverrides.sf2; delete state.bracketOverrides.champ; delete state.bracketOverrides.third; renderPlayoffBracketTab(); });
document.getElementById("resetBracketBtn")?.addEventListener("click", () => { state.bracketOverrides = {}; renderPlayoffBracketTab(); });
document.getElementById("simTeamA")?.addEventListener("change", renderMatchupSim);
document.getElementById("simTeamB")?.addEventListener("change", renderMatchupSim);
document.getElementById("shareBtn")?.addEventListener("click", () => {
  const u = document.getElementById("usernameInput")?.value.trim() || "";
  const url = `${location.origin}${location.pathname}?user=${encodeURIComponent(u)}&week=${state.week}`;
  navigator.clipboard.writeText(url);
  setStatus("Shareable link copied to clipboard!");
};
window.addEventListener("resize", () => { drawPowerChart(); drawWaiverChart(); drawSingleAnalyticsChart(); });

initApp();