// ============================================================================
// FANTASY FRONT OFFICE — PROVIDER-NEUTRAL FANTASY FOOTBALL ANALYTICS
// ============================================================================

// 1. Top-Level Tab & Sub-Tab Switcher
document.addEventListener("click", e => {
  const navBtn = e.target.closest(".nav-btn");
  if (navBtn && navBtn.dataset.tab) {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
    navBtn.classList.add("active");
    const targetPage = document.getElementById(navBtn.dataset.tab);
    if (targetPage) targetPage.classList.add("active");
    if (navBtn.dataset.tab === "tab-draft") {
      document.querySelector(".content-stack")?.scrollTo({ top: 0, behavior: "instant" });
      targetPage?.scrollTo({ top: 0, behavior: "instant" });
      const draftHistory = document.getElementById("draftHistoryWrap");
      if (draftHistory) {
        draftHistory.dataset.userScrolled = "";
        draftHistory.scrollTop = 0;
      }
    }
    const mobileTabSelect = document.getElementById("mobileTabSelect");
    if (mobileTabSelect) mobileTabSelect.value = navBtn.dataset.tab;
    switch (navBtn.dataset.tab) {
      case "tab-power": drawPowerChart(); break;
      case "tab-waiver": drawWaiverChart(); break;
      case "tab-analytics": drawSingleAnalyticsChart(); break;
      case "tab-sos": renderSosTab(); break;
      case "tab-bracket": renderPlayoffBracketTab(); break;
      case "tab-draft": renderDraftRoom(); break;
      case "tab-intel": renderLeagueIntelTab(); break;
      case "tab-inbox": renderGMInbox(); break;
      case "tab-newsletter": renderLeagueNewsletter(); break;
    }
    return;
  }

  const segBtn = e.target.closest(".seg-btn");
  if (segBtn && segBtn.dataset.tmode !== undefined) {
    switchTradeMode(parseInt(segBtn.dataset.tmode, 10));
    return;
  }

  const sosBtn = e.target.closest(".sos-mode-btn");
  if (sosBtn && sosBtn.dataset.sosmode) {
    document.querySelectorAll(".sos-mode-btn").forEach(b => b.classList.remove("active"));
    sosBtn.classList.add("active");
    state.sosWindowMode = sosBtn.dataset.sosmode;
    renderSosTab();
  }
});

// 2. Constants & State
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
const ESPN_TEAM_CODES = { 1:"ATL", 2:"BUF", 3:"CHI", 4:"CIN", 5:"CLE", 6:"DAL", 7:"DEN", 8:"DET", 9:"GB", 10:"TEN", 11:"IND", 12:"KC", 13:"LV", 14:"LAR", 15:"MIA", 16:"MIN", 17:"NE", 18:"NO", 19:"NYG", 20:"NYJ", 21:"PHI", 22:"ARI", 23:"PIT", 24:"LAC", 25:"SF", 26:"SEA", 27:"TB", 28:"WAS", 29:"CAR", 30:"JAX", 33:"BAL", 34:"HOU" };
const ESPN_POSITION_CODES = { 1:"QB", 2:"RB", 3:"WR", 4:"TE", 5:"K", 16:"DEF" };
const ESPN_PLAYER_TO_INTERNAL_ID = new Map();
const DOME_TEAMS = new Set(["ARI","ATL","DAL","DET","HOU","IND","LAC","LAR","LV","MIN","NO"]);
const DEFAULT_SEASON = String(new Date().getFullYear());
const normalizeTeamCode = (team) => {
  if (!team) return "";
  let code = String(team).toUpperCase().trim();
  if (code === "JAC") code = "JAX"; if (code === "WSH") code = "WAS"; if (code === "LA") code = "LAR";
  return code;
};
const DEFAULT_BYE_WEEKS = {
  CAR:5, KC:5, CIN:6, DET:6, MIA:6, MIN:6, BUF:7, JAX:7, LAC:7, WAS:7,
  HOU:8, NO:8, NYG:8, SF:8, PIT:9, TEN:9, CHI:10, DEN:10, PHI:10, TB:10,
  ATL:11, CLE:11, GB:11, LAR:11, LA:11, NE:11, SEA:11, BAL:13, IND:13, LV:13, NYJ:13, ARI:14, DAL:14
};
const SEASON_BYE_CACHE = {};
const SEASON_SCHEDULE_CACHE = {};
function getSeasonKey(seasonYear) {
  return String(seasonYear || state.season || DEFAULT_SEASON || new Date().getFullYear());
}
function getSeasonScheduleContext(seasonYear) {
  const key = getSeasonKey(seasonYear);
  if (!SEASON_SCHEDULE_CACHE[key]) {
    SEASON_SCHEDULE_CACHE[key] = (() => {
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
          if (DEFAULT_BYE_WEEKS[away] !== wk && DEFAULT_BYE_WEEKS[home] !== wk) {
            sched[away][wk] = { opp: home, isHome: false };
            sched[home][wk] = { opp: away, isHome: true };
          }
        });
      }
      return sched;
    })();
  }
  if (!SEASON_BYE_CACHE[key]) {
    SEASON_BYE_CACHE[key] = { ...DEFAULT_BYE_WEEKS };
    SEASON_BYE_CACHE[key].LA = SEASON_BYE_CACHE[key].LAR || 0;
  }
  return { schedule: SEASON_SCHEDULE_CACHE[key], byes: SEASON_BYE_CACHE[key] };
}
const currentSeasonContext = getSeasonScheduleContext(DEFAULT_SEASON);
const CURRENT_NFL_SCHEDULE = currentSeasonContext.schedule;
const CURRENT_BYE_WEEKS = currentSeasonContext.byes;
const SEASON_DVP_CACHE = {};

function refreshSeasonDerivedState(seasonYear) {
  const key = getSeasonKey(seasonYear);
  const context = getSeasonScheduleContext(key);
  Object.keys(NFL_TEAM_NAMES).forEach(team => {
    CURRENT_NFL_SCHEDULE[team] = context.schedule[team] || {};
    CURRENT_BYE_WEEKS[team] = context.byes[team] || 0;
  });
  CURRENT_BYE_WEEKS.LA = CURRENT_BYE_WEEKS.LAR || 0;
  CURRENT_DVP_RANKS = getDvpRanksForSeason(key);
}

const state = {
  season: String(new Date().getFullYear()),
  week: 6, userId: "", leagues: [], activeLeague: null,
  provider: "", portfolioRosterSelections: {}, managerTendencies: [],
  currentMatchups: [], historicalRows: [], historicalSeasons: [], weeklyReportText: "",
  players: {}, rawProj: {}, rawStats: {}, managers: [],
  tradeSideA: [], tradeSideB: [], dbTrades: [], waiverTargets: [],
  weakestPosByTeam: {}, sosWindowMode: "NEXT4", bracketOverrides: {},
  dataFreshness: { season: 0, schedule: 0, players: 0, stats: 0, projections: 0, account: 0, matchups: 0 }, dataErrors: {}
};
const portfolioState = { rostersByLeague: new Map(), loading: false };
const gmOutcomeCache = new Map();
let sleeperNflStateCache = { data: null, checkedAt: 0 };
const playerAlertState = { loaded: false, watchlist: [], events: [], snapshots: {} };
const draftState = {
  settings: { type: "redraft", teams: 12, slot: 6, rounds: 15, scoring: "ppr", rosterFormat: "standard", opponentStrategy: "adp", dynastyYears: 3, keeperSlots: 2, keeperYears: 2 },
  userPicks: [], adpByName: {}, keepers: [], loadedSessionKey: ""
};
const faabState = { budget: 100, weeksRemaining: 12, strategy: "balanced", claims: [], loadedKey: "" };

let dbSortKey = "matchPct", dbSortDir = -1;
let finderSortKey = "Composite", finderSortDir = -1;
let analyticsSortDir = -1;

// 3. Team Logo Preloader
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

// 4. Schedule, Dynamic Season Sync & DvP Rankings
const DEFAULT_DVP_RANKS = (() => {
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
let CURRENT_DVP_RANKS = DEFAULT_DVP_RANKS;

function getDvpRanksForSeason(seasonYear) {
  const key = getSeasonKey(seasonYear);
  if (!SEASON_DVP_CACHE[key]) {
    SEASON_DVP_CACHE[key] = JSON.parse(JSON.stringify(DEFAULT_DVP_RANKS));
  }
  return SEASON_DVP_CACHE[key];
}

const ANALYTICS_CONFIGS = {
  QB: [
    { title: "Model Value vs. Weekly Projection", xKey: "projectedPoints", yKey: "baseValue", xLbl: "Weekly projected points", yLbl: "Model player value" },
    { title: "Passing Production vs. Fantasy Output", xKey: "passYdsPerGame", yKey: "seasonPpg", xLbl: "Passing yards per game", yLbl: "Season fantasy points per game" },
    { title: "Passing Efficiency: CPOE vs. EPA", xKey: "cpoeVal", yKey: "epaPerPlay", xLbl: "Completion % over expected", yLbl: "Expected points added per play" }
  ],
  RB: [
    { title: "Model Value vs. Weekly Projection", xKey: "projectedPoints", yKey: "baseValue", xLbl: "Weekly projected points", yLbl: "Model player value" },
    { title: "Touch Opportunity vs. Fantasy Output", xKey: "touchesPerGame", yKey: "seasonPpg", xLbl: "Touches per game", yLbl: "Season fantasy points per game" },
    { title: "Scoring-Opportunity Upside", xKey: "goldTouchesPerGame", yKey: "vorpScore", xLbl: "Red-zone touches per game", yLbl: "Value over replacement" }
  ],
  WR: [
    { title: "Model Value vs. Weekly Projection", xKey: "projectedPoints", yKey: "baseValue", xLbl: "Weekly projected points", yLbl: "Model player value" },
    { title: "Target Volume vs. Fantasy Output", xKey: "targetsPerGame", yKey: "seasonPpg", xLbl: "Targets per game", yLbl: "Season fantasy points per game" },
    { title: "Route Efficiency: TPRR vs. YPRR", xKey: "tprrPct", yKey: "yprrVal", xLbl: "Targets per route run (%)", yLbl: "Yards per route run" }
  ],
  TE: [
    { title: "Model Value vs. Weekly Projection", xKey: "projectedPoints", yKey: "baseValue", xLbl: "Weekly projected points", yLbl: "Model player value" },
    { title: "Target Volume vs. Fantasy Output", xKey: "targetsPerGame", yKey: "seasonPpg", xLbl: "Targets per game", yLbl: "Season fantasy points per game" },
    { title: "Route Participation vs. Target Rate", xKey: "snapSharePct", yKey: "tprrPct", xLbl: "Snap share (%)", yLbl: "Targets per route run (%)" }
  ],
  DEF: [
    { title: "Model Value vs. Weekly Projection", xKey: "projectedPoints", yKey: "baseValue", xLbl: "Weekly projected points", yLbl: "Model player value" },
    { title: "Disruption vs. Fantasy Output", xKey: "defPlaysPerGame", yKey: "seasonPpg", xLbl: "Sacks + takeaways per game", yLbl: "Season fantasy points per game" },
    { title: "Sacks vs. Takeaways", xKey: "sacksPerGame", yKey: "takeawaysPerGame", xLbl: "Sacks per game", yLbl: "Takeaways per game" }
  ]
};

function openPlayerCacheDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("FantasyFrontOfficeCacheV1", 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore("kv");
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject();
  });
}
async function getCachedPlayers(forceRefresh = false) {
  try {
    const db = await openPlayerCacheDB();
    return new Promise(res => {
      const tx = db.transaction("kv", "readonly").objectStore("kv").get("nfl_players_v1");
      tx.onsuccess = () => {
        const d = tx.result;
        if (d && (Date.now() - d.ts < 86400000) && !forceRefresh) { markDataSource("players", null, d.ts); res(d.payload); }
        else res(null);
      };
      tx.onerror = () => res(null);
    });
  } catch { return null; }
}
async function setCachedPlayers(payload) {
  try {
    const db = await openPlayerCacheDB();
    const tx = db.transaction("kv", "readwrite");
    const ts = Date.now();
    tx.objectStore("kv").put({ ts, payload }, "nfl_players_v1");
    markDataSource("players", null, ts);
  } catch {}
}

async function syncFullSeasonNflSchedule(seasonYear, forceRefresh = false) {
  const yr = String(seasonYear || state.season || new Date().getFullYear());
  const cacheKey = `nfl_sched_${yr}`;

  try {
    const db = await openPlayerCacheDB();
    const cached = await new Promise(res => {
      const tx = db.transaction("kv", "readonly").objectStore("kv").get(cacheKey);
      tx.onsuccess = () => {
        const d = tx.result;
        if (d && (Date.now() - d.ts < 43200000)) res(d.payload); else res(null);
      };
      tx.onerror = () => res(null);
    });
    if (cached && cached.sched && cached.byes && !forceRefresh) {
      Object.keys(NFL_TEAM_NAMES).forEach(t => {
        CURRENT_NFL_SCHEDULE[t] = cached.sched[t] || {};
        CURRENT_BYE_WEEKS[t] = cached.byes[t] || 0;
      });
      CURRENT_BYE_WEEKS.LA = CURRENT_BYE_WEEKS.LAR || 0;
      markDataSource("schedule", null, cached.ts);
      return;
    }
  } catch {}

  const allWeeks = Array.from({ length: 18 }, (_, i) => i + 1);
  const tempSched = {};
  Object.keys(NFL_TEAM_NAMES).forEach(t => tempSched[t] = {});
  let validWeeksFetched = 0;

  await Promise.all(allWeeks.map(async wk => {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${yr}&seasontype=2&week=${wk}`).then(r => r.json());
      const events = res?.events || [];
      if (events.length >= 10) {
        validWeeksFetched++;
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
          if (tempSched[h] && tempSched[a]) {
            tempSched[h][wk] = { opp: a, isHome: true };
            tempSched[a][wk] = { opp: h, isHome: false };
          }
        });
      }
    } catch {}
  }));

  if (validWeeksFetched >= 12) {
    const detectedByes = {};
    Object.keys(NFL_TEAM_NAMES).forEach(t => {
      CURRENT_NFL_SCHEDULE[t] = tempSched[t];
      detectedByes[t] = 0;
      for (let w = 4; w <= 14; w++) {
        if (!tempSched[t][w]) { detectedByes[t] = w; break; }
      }
      CURRENT_BYE_WEEKS[t] = detectedByes[t];
    });
    CURRENT_BYE_WEEKS.LA = CURRENT_BYE_WEEKS.LAR || 0;

    try {
      const db = await openPlayerCacheDB();
      const tx = db.transaction("kv", "readwrite");
      const ts = Date.now();
      tx.objectStore("kv").put({ ts, payload: { sched: tempSched, byes: detectedByes } }, cacheKey);
      markDataSource("schedule", null, ts);
    } catch {}
  } else markDataSource("schedule", new Error("Schedule feed did not return enough valid weeks."));
}

async function syncLiveEspnSchedule() {
  const activeSeason = state.activeLeague?.season || state.season;
  refreshSeasonDerivedState(activeSeason);
  await syncFullSeasonNflSchedule(activeSeason);
  if (document.getElementById("tab-sos")?.classList.contains("active")) renderSosTab();
  if (document.getElementById("tab-bracket")?.classList.contains("active")) renderPlayoffBracketTab();
}

function recomputeDynamicDvpRanks() {
  const teams = Object.keys(NFL_TEAM_NAMES);
  if (!Object.keys(state.players).length) return;
  const activeSeason = String(state.activeLeague?.season || state.season || DEFAULT_SEASON);
  const seasonDvp = getDvpRanksForSeason(activeSeason);
  const defMetrics = {};

  teams.forEach(t => {
    const teamPlayers = PLAYER_INDEX_BY_TEAM.get(t) || [];
    const defPlayer = state.players[t] || teamPlayers.find(p => p.position === "DEF");
    const st = state.rawStats[t] || (defPlayer ? state.rawStats[defPlayer.id] : null) || {};
    const gp = Math.max(1, st.gp || st.gms_active || 1);

    const ptsAllowPg = st.pts_allow !== undefined ? (st.pts_allow / gp) : 21.5;
    const ydsAllowPg = st.yds_allow !== undefined ? (st.yds_allow / gp) : 335;
    const sacksPg = st.sack !== undefined ? (st.sack / gp) : 2.4;
    const takeawaysPg = ((st.int || 0) + (st.fum_rec || 0)) / gp;
    const defSr = defPlayer?.searchRank && defPlayer.searchRank < 500 ? defPlayer.searchRank : 165;

    const runToughness = (36 - ptsAllowPg) * 2.1 + (390 - ydsAllowPg) * 0.08 + sacksPg * 2.6 + (220 - defSr) * 0.12;
    const passToughness = (36 - ptsAllowPg) * 1.8 + sacksPg * 3.4 + takeawaysPg * 4.2 + (220 - defSr) * 0.14;

    const teamOffPlayers = teamPlayers.filter(p => !p.isPick && p.isCurrentNfl && ["QB","RB","WR","TE"].includes(p.position));
    teamOffPlayers.sort((a, b) => (b.seasonPpg || b.projectedPoints) - (a.seasonPpg || a.projectedPoints));
    const topOffPpg = teamOffPlayers.slice(0, 5).reduce((sum, p) => sum + (p.seasonPpg || p.projectedPoints || 8), 0);

    defMetrics[t] = {
      RB: runToughness,
      QB: passToughness,
      WR: passToughness * 0.95 + takeawaysPg * 1.8,
      TE: (runToughness * 0.45 + passToughness * 0.55),
      DEF: topOffPpg
    };
  });

  ["RB", "QB", "WR", "TE", "DEF"].forEach(pos => {
    const ranked = [...teams].sort((a, b) => {
      const baseA = (33 - (seasonDvp[pos]?.[a] || 16)) * 3.0;
      const baseB = (33 - (seasonDvp[pos]?.[b] || 16)) * 3.0;
      return (baseB + defMetrics[b][pos] * 0.25) - (baseA + defMetrics[a][pos] * 0.25);
    });
    ranked.forEach((team, idx) => { seasonDvp[pos][team] = idx + 1; });
  });
  CURRENT_DVP_RANKS = seasonDvp;
}

const PLAYER_INDEX_BY_TEAM = new Map();
function rebuildPlayerTeamIndex() {
  PLAYER_INDEX_BY_TEAM.clear();
  Object.values(state.players).forEach(player => {
    if (!player.team) return;
    if (!PLAYER_INDEX_BY_TEAM.has(player.team)) PLAYER_INDEX_BY_TEAM.set(player.team, []);
    PLAYER_INDEX_BY_TEAM.get(player.team).push(player);
  });
}

function calcDraftPickValue(season, round, slot, totalTeams, lg) {
  const baseVal = round === 1 ? 6200 : (round === 2 ? 2900 : (round === 3 ? 1350 : 550));
  const slotRatio = totalTeams > 1 ? (totalTeams - slot) / (totalTeams - 1) : 0.5;
  const slotMult = 0.76 + (slotRatio * 0.58);
  const curYr = parseInt(lg?.season || state.season || new Date().getFullYear(), 10);
  const yrDisc = Math.pow(0.88, Math.max(0, season - (curYr + 1)));
  const fmtMult = lg?.leagueType === 2 ? 1.0 : (lg?.leagueType === 1 ? 0.65 : 0.35);
  return Math.max(150, Math.round(baseVal * slotMult * yrDisc * fmtMult));
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

function updateDynamicSeasonLabels() {
  const activeYr = String(state.activeLeague?.season || state.season || new Date().getFullYear());
  const nextYr1 = parseInt(activeYr, 10) + 1;
  const nextYr2Short = String(nextYr1 + 1).slice(-2);
  const pickLbl = document.querySelector('#finderPickModeWrap label');
  if (pickLbl) pickLbl.textContent = `${nextYr1}–${nextYr2Short} Picks:`;
}

function setStatus(txt) {
  const el = document.getElementById("statusLabel");
  if (el) el.textContent = txt;
  renderDataFreshness();
}

function getSafeMonetizationUrl(value) {
  try {
    const url = new URL(value, location.href);
    return url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
}

function initMonetization() {
  const config = window.FFO_MONETIZATION || {};
  const area = document.getElementById("monetizationArea");
  const sponsorSlot = document.getElementById("sponsorPlacement");
  const affiliateSlot = document.getElementById("affiliatePlacement");
  const adSlot = document.getElementById("adsensePlacement");
  const disclosure = document.getElementById("monetizationDisclosure");
  if (!area || !sponsorSlot || !affiliateSlot || !adSlot || !disclosure) return;

  let hasPlacement = false;
  const sponsor = config.sponsor || {};
  const sponsorUrl = getSafeMonetizationUrl(sponsor.url);
  if (sponsor.name && sponsor.message && sponsorUrl) {
    const imageUrl = getSafeMonetizationUrl(sponsor.imageUrl);
    sponsorSlot.innerHTML = `<span class="monetization-label">Sponsored</span>${imageUrl ? `<img src="${imageUrl}" alt="${draftEscapeHtml(sponsor.name)}" loading="lazy" />` : ""}<div><strong>${draftEscapeHtml(sponsor.name)}</strong><p>${draftEscapeHtml(sponsor.message)}</p><a class="monetization-link" href="${sponsorUrl}" target="_blank" rel="sponsored nofollow noopener">Visit sponsor</a></div>`;
    sponsorSlot.hidden = false;
    hasPlacement = true;
  }

  const offers = (Array.isArray(config.affiliateOffers) ? config.affiliateOffers : []).map(offer => ({
    ...offer, safeUrl: getSafeMonetizationUrl(offer.url)
  })).filter(offer => offer.name && offer.safeUrl);
  if (offers.length) {
    affiliateSlot.innerHTML = `<span class="monetization-label">Partner offers</span><div class="affiliate-offers">${offers.map(offer => `<div class="affiliate-offer"><strong>${draftEscapeHtml(offer.name)}</strong><a class="monetization-link" href="${offer.safeUrl}" target="_blank" rel="sponsored nofollow noopener">View offer</a></div>`).join("")}</div>`;
    affiliateSlot.hidden = false;
    hasPlacement = true;
  }

  const ads = config.adsense || {};
  const productionHttps = location.protocol === "https:" && !["localhost", "127.0.0.1"].includes(location.hostname);
  const validClient = /^ca-pub-\d+$/.test(ads.clientId || "");
  const validSlot = /^\d+$/.test(ads.footerSlot || "");
  if (productionHttps && ads.enabled === true && ads.consentManagementConfigured === true && validClient && validSlot) {
    adSlot.innerHTML = `<span class="monetization-label">Advertisement</span><ins class="adsbygoogle" style="display:block" data-ad-client="${draftEscapeHtml(ads.clientId)}" data-ad-slot="${draftEscapeHtml(ads.footerSlot)}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    adSlot.hidden = false;
    const scriptId = "google-adsense-script";
    const initializeAd = () => {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
    };
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ads.clientId)}`;
      script.onload = initializeAd;
      document.head.appendChild(script);
    } else if (window.adsbygoogle) initializeAd();
    hasPlacement = true;
  }

  const privacyUrl = getSafeMonetizationUrl(config.privacyUrl);
  if (hasPlacement) {
    area.hidden = false;
    disclosure.hidden = false;
    disclosure.innerHTML = `Sponsored and affiliate links are labeled. Affiliate links may earn a commission.${privacyUrl ? ` <a class="monetization-link" href="${privacyUrl}" target="_blank" rel="noopener">Privacy</a>` : ""}`;
  }
}

function markDataSource(source, error = null, timestamp = Date.now()) {
  if (error) state.dataErrors[source] = error.message || String(error);
  else {
    state.dataFreshness[source] = timestamp;
    delete state.dataErrors[source];
  }
  renderDataFreshness();
}

function renderDataFreshness() {
  const label = document.getElementById("dataFreshnessLabel");
  const retryButton = document.getElementById("retryDataBtn");
  if (!label) return;
  const names = { season: "Season", schedule: "Schedule", players: "Players", stats: "Stats", projections: "Projections", account: "Account", matchups: "Matchups" };
  const sources = Object.entries(state.dataFreshness)
    .filter(([, timestamp]) => timestamp)
    .map(([source, timestamp]) => `${names[source]} ${new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
  const failed = Object.keys(state.dataErrors).map(source => names[source] || source);
  label.textContent = failed.length
    ? `Unavailable: ${failed.join(", ")}${sources.length ? ` · Updated ${sources.join(" · ")}` : ""}`
    : (sources.length ? `Updated ${sources.join(" · ")}` : "Data sources waiting");
  label.classList.toggle("has-errors", failed.length > 0);
  if (retryButton) retryButton.hidden = failed.length === 0;
}

async function retryDataSync() {
  const button = document.getElementById("retryDataBtn");
  const usernameInput = document.getElementById("usernameInput");
  const username = usernameInput?.value.trim() || "";
  if (button) button.disabled = true;
  setStatus("Retrying data sources...");
  try {
    await initApp(true, true);
    if (username) {
      if (usernameInput) usernameInput.value = username;
      await syncUserAccount();
    }
    if (!Object.keys(state.dataErrors).length) {
      setStatus(state.activeLeague
        ? `Synced ${state.activeLeague.name} (${state.activeLeague.playoffTeams}-Team Playoff) • Week ${state.week}`
        : `Ready | ${state.season} NFL Season • ${Object.keys(state.players).length.toLocaleString()} profiles loaded`);
    }
  } finally {
    if (button) button.disabled = false;
    renderDataFreshness();
  }
}

function avatarUrl(m) {
  if (!m || !m.id || m.id === "0" || m.isPick) return "";
  if (m.photo) return m.photo;
  if (m.espnId) return `https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(m.espnId)}.png`;
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
    const defRank = getDvpRanksForSeason(state.activeLeague?.season || state.season || DEFAULT_SEASON).RB[m.team] || 16;
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
  if (rules && Object.keys(rules).length && state.activeLeague?.provider !== "espn") {
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

function computeSosWindowMetrics(teamAbbr, weeks, pos) {
  let normTeam = (teamAbbr || "").toUpperCase().trim();
  if (normTeam === "JAC") normTeam = "JAX"; if (normTeam === "LA") normTeam = "LAR";

  let sumRank = 0, activeGames = 0, smashCount = 0, domeCount = 0, hasBye = false;
  weeks.forEach(w => {
    if (CURRENT_BYE_WEEKS[normTeam] === w) { hasBye = true; return; }
    const m = CURRENT_NFL_SCHEDULE[normTeam]?.[w];
    const seasonDvp = getDvpRanksForSeason(state.activeLeague?.season || state.season || DEFAULT_SEASON);
    const r = m ? (seasonDvp[pos]?.[m.opp] || 16) : 16;
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
    const m = CURRENT_NFL_SCHEDULE[normTeam]?.[w];
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
    m.byeWeek = CURRENT_BYE_WEEKS[m.team] || 0;
    m.projectedPoints = computeLeagueProj(m, state.rawProj[pid], rules);
    const s = state.rawStats[pid];
    const adpValue = Number(state.rawProj[pid]?.adp_dd_ppr);
    m.adp = Number.isFinite(adpValue) && adpValue > 0 && adpValue < 500 ? adpValue : null;
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
      const defRank = CURRENT_DVP_RANKS.RB[m.team] || 16;
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
    if (CURRENT_BYE_WEEKS[m.team] === weekNum) return { m, score: 0 };
    const base = m.projectedPoints > 0.1 ? (m.projectedPoints * 0.62 + m.seasonPpg * 0.38) : m.seasonPpg;
    let normTeam = (m.team || "").toUpperCase().trim();
    if (normTeam === "JAC") normTeam = "JAX"; if (normTeam === "LA") normTeam = "LAR";
    const matchInfo = CURRENT_NFL_SCHEDULE[normTeam]?.[weekNum];
    let mult = 1.0;
    if (matchInfo) {
      const posKey = ["QB","RB","WR","TE","DEF"].includes(m.position) ? m.position : "WR";
      const dvp = CURRENT_DVP_RANKS[posKey]?.[matchInfo.opp] || 16.5;
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

// 5. App Initialization & Account / League Sync
async function initApp(skipUrlAccountSync = false, forceRefreshSources = false) {
  const weekSelect = document.getElementById("weekSelect");
  if (weekSelect && !weekSelect.options.length) {
    for (let w = 1; w <= 18; w++) {
      const opt = document.createElement("option");
      opt.value = w; opt.textContent = `Week ${w}`;
      weekSelect.appendChild(opt);
    }
  }

  ensureDynamicTradeControls();
  updateAnalyticsDropdownOptions();
  const startupParams = new URLSearchParams(location.search);
  if (["sleeper", "espn", "yahoo"].includes(startupParams.get("provider"))) {
    const providerSelect = document.getElementById("providerSelect");
    if (providerSelect) providerSelect.value = startupParams.get("provider");
    updateProviderControls();
  }
  state.season = String(new Date().getFullYear());

  if (state.provider === "sleeper") {
    try {
      const stRes = await fetch("https://api.sleeper.app/v1/state/nfl").then(r => r.json());
      state.week = Math.min(18, Math.max(1, stRes.display_week || stRes.week || 1));
      if (stRes.season) state.season = String(stRes.season);
      if (weekSelect) weekSelect.value = state.week;
      markDataSource("season");
    } catch (error) { markDataSource("season", error); }
  } else markDataSource("season");

  refreshSeasonDerivedState(state.season);

  updateDynamicSeasonLabels();
  await syncFullSeasonNflSchedule(state.season, forceRefreshSources || Boolean(state.dataErrors.schedule));

  let rawPlayers = await getCachedPlayers(forceRefreshSources || Boolean(state.dataErrors.players));
  if (!rawPlayers) {
    setStatus(`Downloading ${state.season} NFL player database (cached for 24h)...`);
    try {
      const response = await fetch("https://api.sleeper.app/v1/players/nfl");
      if (!response.ok) throw new Error(`Player feed returned ${response.status}.`);
      rawPlayers = await response.json();
    } catch (error) {
      markDataSource("players", error);
      setStatus("Player database unavailable. Use Retry sync to try again.");
      if (!Object.keys(state.players).length) return;
      rawPlayers = null;
    }
    await setCachedPlayers(rawPlayers);
  }
  ESPN_PLAYER_TO_INTERNAL_ID.clear();
  for (const [pid, p] of Object.entries(rawPlayers || {})) {
    const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
    if (!name) continue;
    const pos = p.position || "";
    const team = p.team || (pos === "DEF" ? pid : "FA");
    const rawSr = p.search_rank || 9999999;
    const isDef = pos === "DEF";
    const isCurrentNfl = isDef ? (team !== "FA" && team !== "") : ((p.active === true) && (p.status !== "Retired" && p.status !== "Inactive") && (team !== "FA" && team !== "") && (rawSr > 0 && rawSr < 4500));
    if (p.espn_id) ESPN_PLAYER_TO_INTERNAL_ID.set(String(p.espn_id), pid);
    state.players[pid] = {
      id: pid, espnId: p.espn_id ? String(p.espn_id) : "", name, position: pos, team, status: p.status || "Active", isCurrentNfl,
      injuryStatus: p.injury_status || (p.status === "Injured Reserve" ? "IR" : "Healthy"),
      age: p.age || 0, exp: p.years_exp || 0, byeWeek: CURRENT_BYE_WEEKS[team] || 0,
      searchRank: (rawSr > 0 && rawSr < 99999) ? rawSr : (isDef ? 160 : 99999),
      projectedPoints: 0, seasonPpg: 0, baseValue: 200, vorpScore: 1, posRank: 999, ovrRank: 999
    };
  }

  rebuildPlayerTeamIndex();

  try {
    const response = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${state.season}`);
    if (!response.ok) throw new Error(`Stats feed returned ${response.status}.`);
    const stData = await response.json();
    for (const [k, v] of Object.entries(stData || {})) state.rawStats[k] = v.stats || v;
    markDataSource("stats");
  } catch (error) { markDataSource("stats", error); }

  recalcAllPlayers();
  recomputeDynamicDvpRanks();
  buildTradeDatabase();
  drawSingleAnalyticsChart();
  renderSosTab();
  renderPlayoffBracketTab();
  setStatus(`Ready | ${state.season} NFL Season • ${Object.keys(state.players).length.toLocaleString()} profiles loaded`);

  const params = new URLSearchParams(location.search);
  const providerFromLink = params.get("provider") || (params.has("user") ? "sleeper" : "");
  if (["sleeper", "espn", "yahoo"].includes(providerFromLink)) {
    const providerSelect = document.getElementById("providerSelect");
    if (providerSelect) providerSelect.value = providerFromLink;
    updateProviderControls();
  }
  if (params.get("week")) {
    state.week = parseInt(params.get("week"), 10) || state.week;
    if (weekSelect) weekSelect.value = state.week;
  }
  if (!skipUrlAccountSync && (params.get("user") || params.get("league"))) {
    const uIn = document.getElementById("usernameInput");
    if (uIn) uIn.value = params.get("user") || params.get("league");
    syncUserAccount();
  }
}

async function fetchWeeklyProjections() {
  const seas = state.activeLeague?.season || state.season;
  setStatus(`Syncing Week ${state.week} projections...`);
  const previousProjections = state.rawProj;
  try {
    const response = await fetch(`https://api.sleeper.app/v1/projections/nfl/regular/${seas}/${state.week}`);
    if (!response.ok) throw new Error(`Projection feed returned ${response.status}.`);
    const data = await response.json();
    state.rawProj = {};
    if (Array.isArray(data)) {
      data.forEach(e => { if (e.player_id) state.rawProj[e.player_id] = { ...(e.stats || e), pts_ppr: e.pts_ppr ?? e.stats?.pts_ppr }; });
    } else if (data) {
      for (const [k, e] of Object.entries(data)) state.rawProj[k] = { ...(e.stats || e), pts_ppr: e.pts_ppr ?? e.stats?.pts_ppr };
    }
    markDataSource("projections");
  } catch (error) {
    state.rawProj = previousProjections;
    markDataSource("projections", error);
  }
  recalcAllPlayers();
  recomputeDynamicDvpRanks();
}

async function syncUserAccount() {
  const provider = document.getElementById("providerSelect")?.value || "";
  state.provider = provider;
  if (!provider) { setStatus("Choose a provider first."); return; }
  if (provider === "espn") return syncEspnAccount();
  if (provider === "yahoo") { setStatus("Choose a Yahoo roster CSV or JSON file to import. Direct sign-in needs a secure OAuth backend."); return; }
  const u = document.getElementById("usernameInput")?.value.trim();
  if (!u) return;
  setStatus("Connecting account...");
  try {
    const uObj = await fetch(`https://api.sleeper.app/v1/user/${encodeURIComponent(u)}`).then(r => r.json());
    if (!uObj || !uObj.user_id) { markDataSource("account", new Error("Account not found.")); setStatus("Account not found."); return; }
    state.userId = uObj.user_id;
    const lgs = await fetch(`https://api.sleeper.app/v1/user/${state.userId}/leagues/nfl/${state.season}`).then(r => r.json());
    markDataSource("account");
    state.leagues = (lgs || []).map(o => {
      const st = o.settings || {};
      const totTeams = o.total_rosters || 12;
      const pTeams = st.playoff_teams || (totTeams <= 8 ? 4 : 6);
      const pStart = st.playoff_week_start > 0 ? st.playoff_week_start : (pTeams <= 4 ? 16 : 15);
      return {
        provider: "sleeper", name: o.name, leagueId: o.league_id, season: o.season || state.season,
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
  } catch (error) { markDataSource("account", error); setStatus("Could not connect to this provider."); }
}

function normalizeYahooPosition(position) {
  const value = String(position || "").trim().toUpperCase();
  if (["D/ST", "DST", "DEF", "DEFENSE"].includes(value)) return "DEF";
  return ["QB", "RB", "WR", "TE", "K"].includes(value) ? value : "FLEX";
}

function createYahooPlayer(source, league) {
  const id = `yahoo_${source.playerId || normalizeDraftPlayerName(source.name).replace(/ /g, "_")}`;
  const position = normalizeYahooPosition(source.position);
  const team = normalizeTeamCode(source.nflTeam || source.team || "FA");
  const seasonPpg = Math.max(0, Number(source.seasonPpg || source.pointsPerGame || 0));
  const projectedPoints = Math.max(0, Number(source.projectedPoints || source.projection || seasonPpg));
  state.players[id] = {
    id, name: source.name || "Unknown player", position, team, status: source.status || "Active",
    injuryStatus: source.injuryStatus || "Healthy", age: Math.max(0, Number(source.age) || 0), exp: Math.max(0, Number(source.experience) || 0),
    isCurrentNfl: team !== "FA", byeWeek: CURRENT_BYE_WEEKS[team] || 0, searchRank: Number(source.playerRank) || 99999,
    projectedPoints, seasonPpg, baseValue: 200, vorpScore: Math.max(0.5, seasonPpg - replacementPpg(position) + 4),
    posRank: 999, ovrRank: 999, yahooId: String(source.playerId || "")
  };
  state.rawProj[id] = { pts_ppr: projectedPoints };
  state.rawStats[id] = { gp: 1, pts_ppr: seasonPpg };
  return { id, starter: source.starter === true || source.starter === "true" || source.starter === "1" || source.starter === "yes" };
}

async function importYahooRosterFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    let payload;
    if (file.name.toLowerCase().endsWith(".json")) payload = JSON.parse(text);
    else {
      const rows = text.split(/\r?\n/).filter(line => line.trim()).map(parseDraftCsvRow);
      if (rows.length < 2) throw new Error("The CSV needs a header and at least one player.");
      const headers = rows[0].map(header => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const index = names => headers.findIndex(header => names.includes(header));
      const teamIndex = index(["fantasyteam", "manager", "teamname"]);
      const nameIndex = index(["player", "playername", "name"]);
      const positionIndex = index(["position", "pos"]);
      const nflTeamIndex = index(["nflteam", "nflteamabbr", "proteam"]);
      if ([teamIndex, nameIndex, positionIndex].some(value => value < 0)) throw new Error("CSV headers must include Manager (or Fantasy Team), Player, and Position.");
      const get = (row, names) => { const column = index(names); return column < 0 ? "" : row[column] || ""; };
      const teams = new Map();
      rows.slice(1).forEach(row => {
        const teamName = row[teamIndex]?.trim();
        const name = row[nameIndex]?.trim();
        if (!teamName || !name) return;
        if (!teams.has(teamName)) teams.set(teamName, {
          teamName, manager: get(row, ["manager", "owner"]), wins: Number(get(row, ["wins"])) || 0,
          losses: Number(get(row, ["losses"])) || 0, pointsFor: Number(get(row, ["pointsfor", "pf"])) || 0,
          pointsAgainst: Number(get(row, ["pointsagainst", "pa"])) || 0, players: []
        });
        teams.get(teamName).players.push({
          playerId: get(row, ["playerid", "yahooid"]), name, position: row[positionIndex],
          nflTeam: nflTeamIndex < 0 ? "FA" : row[nflTeamIndex], starter: get(row, ["starter", "isstarter"]).toLowerCase(),
          projectedPoints: get(row, ["projectedpoints", "projection"]), seasonPpg: get(row, ["seasonppg", "pointspergame"]),
          injuryStatus: get(row, ["injurystatus", "injury"]), age: get(row, ["age"]), experience: get(row, ["experience", "yearsexp"])
        });
      });
      payload = { leagueName: get(rows[1], ["leaguename"]) || file.name.replace(/\.csv$/i, ""), season: get(rows[1], ["season", "year"]) || state.season, teams: [...teams.values()] };
    }
    if (!Array.isArray(payload.teams) || !payload.teams.length) throw new Error("No teams found. JSON imports need a teams array; CSV imports need team and player rows.");
    const leagueName = payload.leagueName || payload.name || "Yahoo roster import";
    const leagueSeason = String(payload.season || state.season);
    const league = {
      provider: "yahoo", leagueId: `import-${normalizeDraftPlayerName(leagueName).replace(/ /g, "-")}-${leagueSeason}`, name: leagueName,
      season: leagueSeason, totalTeams: payload.teams.length,
      leagueType: payload.leagueType === "dynasty" ? 2 : (payload.leagueType === "keeper" ? 1 : 0),
      draftRounds: Number(payload.draftRounds) || 15, playoffTeams: Number(payload.playoffTeams) || 6,
      playoffWeekStart: Number(payload.playoffWeekStart) || 15, playoffSeedType: 0, playoffRoundType: 0,
      rosterPositions: Array.isArray(payload.rosterPositions) ? payload.rosterPositions : ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"],
      scoringSettings: payload.scoringSettings || { rec: 1 }
    };
    state.provider = "yahoo";
    state.userId = "";
    state.activeLeague = league;
    state.leagues = [league];
    state.currentMatchups = Array.isArray(payload.matchups) ? payload.matchups : [];
    state.managers = payload.teams.map((team, index) => {
      const playerEntries = (team.players || []).map(player => createYahooPlayer(player, league));
      const ids = playerEntries.map(player => player.id);
      const starters = playerEntries.filter(player => player.starter).map(player => player.id);
      return {
        rosterId: index + 1, ownerId: String(team.manager || team.owner || ""),
        teamName: team.teamName || team.name || `Team ${index + 1}`,
        wins: Number(team.wins) || 0, losses: Number(team.losses) || 0,
        pf: Number(team.pointsFor) || 0, pa: Number(team.pointsAgainst) || 0, maxPf: Number(team.pointsFor) || 0,
        eff: 0, rosPpg: 112, starters: starters.length ? starters : ids, reserve: [], taxi: [],
        players: ids, ownedPicks: [], allPlayW: 0, allPlayL: 0, luck: 0, power: 0,
        week1Rank: index + 1, currentRank: index + 1, history: [], projW: Number(team.wins) || 0,
        projL: Number(team.losses) || 0, playoffPct: 50
      };
    });
    const selectorIds = ["teamSelect", "tradeTeamA", "tradeTeamB", "simTeamA", "simTeamB"];
    selectorIds.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = "";
      state.managers.forEach((manager, index) => {
        const option = document.createElement("option"); option.value = String(index); option.textContent = manager.teamName; select.appendChild(option);
      });
    });
    ["teamSelect", "tradeTeamA", "simTeamA"].forEach(id => { const select = document.getElementById(id); if (select) select.value = "0"; });
    ["tradeTeamB", "simTeamB"].forEach(id => { const select = document.getElementById(id); if (select) select.value = state.managers.length > 1 ? "1" : "0"; });
    const leagueSelect = document.getElementById("leagueSelect");
    leagueSelect.innerHTML = `<option value="0">${draftEscapeHtml(league.name)}</option>`;
    refreshSeasonDerivedState(league.season);
    recalcAllPlayers();
    state.managers.forEach(manager => {
      manager.rosPpg = manager.starters.reduce((sum, playerId) => sum + (state.players[playerId]?.projectedPoints || 0), 0);
    });
    recomputeDynamicDvpRanks();
    renderAllViews(0);
    await buildTradeDatabase();
    scanPlayerAlertChanges();
    markDataSource("account");
    populateHistorySeasonOptions();
    await loadHistoricalSeason();
    setStatus(`Imported ${league.name} from Yahoo file • ${state.managers.length} teams`);
  } catch (error) {
    markDataSource("account", error);
    setStatus(error.message || "Could not import the Yahoo roster file.");
  }
}

function updateProviderControls() {
  const provider = document.getElementById("providerSelect")?.value || "";
  state.provider = provider;
  const espn = provider === "espn";
  const sleeper = provider === "sleeper";
  const yahoo = provider === "yahoo";
  const label = document.getElementById("providerInputLabel");
  const input = document.getElementById("usernameInput");
  const button = document.getElementById("syncBtn");
  const yahooImportLabel = document.getElementById("yahooImportLabel");
  const help = document.getElementById("providerHelp");
  if (label) label.textContent = espn ? "LEAGUE ID(S)" : (sleeper ? "ACCOUNT" : (yahoo ? "YAHOO" : "ACCOUNT / LEAGUE"));
  if (input) { input.placeholder = espn ? "ESPN league ID(s), comma-separated" : (sleeper ? "Sleeper username..." : (yahoo ? "Use roster import" : "Choose a provider first")); input.hidden = yahoo; }
  if (yahooImportLabel) yahooImportLabel.hidden = !yahoo;
  if (button) { button.textContent = espn ? "Import League(s)" : (sleeper ? "Sync Account" : "Connect"); button.disabled = !provider || yahoo; button.hidden = yahoo; }
  if (help) help.textContent = espn ? "Public ESPN leagues need a league ID. Private leagues use an ESPN session already signed in to this browser." : (sleeper ? "Connect with your account username to load league settings and rosters." : (yahoo ? "Import CSV headers: manager, player, position, nfl_team. JSON imports use leagueName, season, and teams[]. Yahoo OAuth is not configured on this static site." : "Choose ESPN Fantasy or Sleeper to connect league data."));
}

function normalizeEspnRosterPositions(slotCounts = {}) {
  const positionBySlot = { 0:"QB", 2:"RB", 3:"FLEX", 4:"WR", 5:"WR/TE", 6:"TE", 7:"FLEX", 16:"DEF", 17:"K", 20:"BN", 21:"IR", 23:"SUPER_FLEX" };
  return Object.entries(slotCounts).flatMap(([slot, count]) => Array.from({ length: Math.max(0, Number(count) || 0) }, () => positionBySlot[slot] || "BN"));
}

function normalizeEspnScoring(scoringSettings = {}) {
  const reception = (scoringSettings.scoringItems || []).find(item => Number(item.statId) === 53);
  return { rec: Number(reception?.points) || 0 };
}

async function fetchEspnLeague(leagueId, season) {
  const endpoint = new URL(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${encodeURIComponent(season)}/segments/0/leagues/${encodeURIComponent(leagueId)}`);
  ["mSettings", "mTeam", "mRoster", "mScoreboard", "mTransactions2", "mDraftDetail"].forEach(view => endpoint.searchParams.append("view", view));
  const response = await fetch(endpoint, { credentials: "include" });
  if (!response.ok) throw new Error(`ESPN returned ${response.status} for league ${leagueId}. Check the ID, season, and account access.`);
  return response.json();
}

async function syncEspnAccount() {
  const input = document.getElementById("usernameInput");
  const leagueIds = (input?.value || "").split(/[\s,;]+/).map(value => value.trim()).filter(Boolean);
  if (!leagueIds.length) { setStatus("Enter one or more ESPN league IDs."); return; }
  if (leagueIds.length > 20) { setStatus("Import up to 20 leagues at a time."); return; }
  setStatus(`Connecting to ${leagueIds.length} ESPN league${leagueIds.length === 1 ? "" : "s"}...`);
  try {
    const leagues = await Promise.all(leagueIds.map(async leagueId => {
      const data = await fetchEspnLeague(leagueId, state.season);
      if (data.status?.currentScoringPeriod) state.week = Number(data.status.currentScoringPeriod);
      const settings = data.settings || {};
      const teams = data.teams || [];
      const teamCount = teams.length || settings.size || 12;
      const keeper = Boolean(settings.isKeeper);
      return {
        provider: "espn", leagueId: String(leagueId), season: String(data.seasonId || state.season),
        name: settings.name || `ESPN League ${leagueId}`, totalTeams: teamCount,
        leagueType: settings.isDynasty ? 2 : (keeper ? 1 : 0),
        draftRounds: settings.draftSettings?.numRounds || 15,
        playoffTeams: settings.scheduleSettings?.playoffTeamCount || 6,
        playoffWeekStart: settings.scheduleSettings?.playoffMatchupPeriodLength ? 15 : 15,
        playoffSeedType: 0, playoffRoundType: 0,
        rosterPositions: normalizeEspnRosterPositions(settings.rosterSettings?.lineupSlotCounts),
        scoringSettings: normalizeEspnScoring(settings.scoringSettings), espnData: data
      };
    }));
    state.leagues = leagues;
    state.userId = "";
    const select = document.getElementById("leagueSelect");
    select.innerHTML = "";
    leagues.forEach((league, index) => {
      const option = document.createElement("option");
      option.value = index; option.textContent = `${league.name} (${league.totalTeams} teams)`;
      select.appendChild(option);
    });
    markDataSource("account");
    if (leagues.length) await loadLeague(0);
  } catch (error) {
    markDataSource("account", error);
    setStatus(error.message || "Could not connect to ESPN Fantasy.");
  }
}

function getInternalPlayerIdFromEspn(playerData) {
  const espnId = String(playerData.id);
  let internalId = ESPN_PLAYER_TO_INTERNAL_ID.get(espnId);
  if (internalId && state.players[internalId]) return internalId;
  internalId = `espn_${espnId}`;
  const position = ESPN_POSITION_CODES[playerData.defaultPositionId] || playerData.position || "FLEX";
  const team = ESPN_TEAM_CODES[playerData.proTeamId] || "FA";
  if (!state.players[internalId]) {
    state.players[internalId] = {
      id: internalId, espnId, name: playerData.fullName || playerData.name || `Player ${espnId}`,
      position, team, status: playerData.injured ? "Injured" : "Active",
      injuryStatus: playerData.injured ? "Questionable" : "Healthy", age: Number(playerData.age) || 0,
      exp: 0, isCurrentNfl: team !== "FA", byeWeek: CURRENT_BYE_WEEKS[team] || 0,
      searchRank: 99999, projectedPoints: 0, seasonPpg: 0, baseValue: 200,
      vorpScore: 1, posRank: 999, ovrRank: 999
    };
    if (team !== "FA") {
      const teamPlayers = PLAYER_INDEX_BY_TEAM.get(team) || [];
      teamPlayers.push(state.players[internalId]);
      PLAYER_INDEX_BY_TEAM.set(team, teamPlayers);
    }
  }
  ESPN_PLAYER_TO_INTERNAL_ID.set(espnId, internalId);
  return internalId;
}

function buildEspnManagerTendencies(data) {
  const profiles = new Map();
  const getProfile = rosterId => {
    if (!profiles.has(String(rosterId))) profiles.set(String(rosterId), { rosterId: String(rosterId), acquisitions: 0, trades: 0, positions: {}, draftPicks: 0, draftPositions: {} });
    return profiles.get(String(rosterId));
  };
  (data.transactions || []).forEach(transaction => {
    const recipients = new Set();
    (transaction.items || []).forEach(item => {
      if (!["ADD", "TRADE_RECEIVED", "WAIVER", "FREEAGENT"].includes(String(item.type || "").toUpperCase())) return;
      const rosterId = item.toTeamId ?? transaction.teamId;
      const playerId = ESPN_PLAYER_TO_INTERNAL_ID.get(String(item.playerId));
      const player = state.players[playerId];
      if (!player || rosterId === undefined) return;
      const profile = getProfile(rosterId);
      profile.acquisitions++;
      profile.positions[player.position] = (profile.positions[player.position] || 0) + 1;
      if (String(transaction.type || "").toUpperCase().includes("TRADE")) recipients.add(String(rosterId));
    });
    recipients.forEach(rosterId => { getProfile(rosterId).trades++; });
  });
  const picks = data.draftDetail?.picks || data.draftDetail?.draftPicks || [];
  picks.forEach(pick => {
    const rosterId = pick.teamId ?? pick.rosterId;
    const playerId = ESPN_PLAYER_TO_INTERNAL_ID.get(String(pick.playerId));
    const position = state.players[playerId]?.position;
    if (rosterId === undefined || !position) return;
    const profile = getProfile(rosterId);
    profile.draftPicks++;
    profile.draftPositions[position] = (profile.draftPositions[position] || 0) + 1;
  });
  return [...profiles.values()];
}

async function loadEspnLeague(idx) {
  const league = state.leagues[idx];
  if (!league?.espnData) return;
  state.activeLeague = league;
  refreshSeasonDerivedState(league.season);
  updateDynamicSeasonLabels();
  document.getElementById("tradeFormatBadge").textContent = league.leagueType === 2 ? "DYNASTY MODE" : (league.leagueType === 1 ? "KEEPER MODE" : "REDRAFT MODE");
  await fetchWeeklyProjections();

  const data = league.espnData;
  state.currentMatchups = (data.schedule || []).filter(matchup => Number(matchup.matchupPeriodId) === Number(state.week));
  const members = Object.fromEntries((data.members || []).map(member => [String(member.id), member.displayName || member.firstName || "Manager"]));
  state.managers = (data.teams || []).map(team => {
    const entries = team.roster?.entries || [];
    const mapped = entries.map(entry => {
      const player = entry.playerPoolEntry?.player || entry.player || {};
      return { id: getInternalPlayerIdFromEspn(player), slot: Number(entry.lineupSlotId) };
    });
    const owners = team.owners || [];
    const record = team.record?.overall || {};
    const wins = Number(record.wins) || 0, losses = Number(record.losses) || 0;
    const pf = Number(record.pointsFor ?? team.points) || 0;
    const pa = Number(record.pointsAgainst ?? team.pointsAgainst) || 0;
    const players = mapped.map(item => item.id);
    const starters = mapped.filter(item => ![20, 21, 22].includes(item.slot)).map(item => item.id);
    const rosPpg = starters.reduce((sum, id) => sum + (state.players[id]?.projectedPoints || state.players[id]?.seasonPpg || 0), 0) || 112;
    return {
      rosterId: team.id, ownerId: String(owners[0] || ""),
      teamName: team.name || `${team.location || ""} ${team.nickname || ""}`.trim() || `Team ${team.id}`,
      wins, losses, pf, pa, maxPf: 0, eff: 0, rosPpg, starters, reserve: [], taxi: [], players,
      ownedPicks: [], allPlayW: 0, allPlayL: 0, luck: 0, power: 0, week1Rank: 1, currentRank: 1, history: []
    };
  });
  const totalTeams = Math.max(1, state.managers.length);
  const maxPF = Math.max(1, ...state.managers.map(manager => manager.pf));
  state.managers.forEach(manager => { manager.maxPf = maxPF; manager.eff = maxPF > 0 ? (manager.pf / maxPF) * 100 : 0; });
  [...state.managers].sort((a, b) => b.rosPpg - a.rosPpg).forEach((manager, index) => { manager.week1Rank = index + 1; });
  state.managers.forEach(manager => {
    manager.allPlayW = state.managers.filter(other => other !== manager && manager.pf > other.pf).length;
    manager.allPlayL = Math.max(0, totalTeams - 1 - manager.allPlayW);
    const totalGames = manager.wins + manager.losses;
    const expectedWinRate = totalTeams > 1 ? manager.allPlayW / (totalTeams - 1) : 0;
    manager.luck = ((totalGames ? manager.wins / totalGames : 0) - expectedWinRate) * 100;
    manager.power = (manager.pf / maxPF) * 60 + expectedWinRate * 40;
    manager.projW = manager.wins + Math.round(Math.max(0, 13 - totalGames) * Math.min(0.88, Math.max(0.15, 0.25 + expectedWinRate * 0.55 + (manager.rosPpg - 105) / 100)));
    manager.projL = Math.max(0, 13 - manager.projW);
  });
  state.managers.sort((a, b) => b.power - a.power);
  state.managerTendencies = buildEspnManagerTendencies(data);
  const weekCount = Math.max(2, state.week);
  state.managers.forEach((manager, index) => {
    manager.currentRank = index + 1;
    manager.history = Array.from({ length: weekCount }, (_, week) => Math.round(manager.week1Rank + (manager.currentRank - manager.week1Rank) * (week / (weekCount - 1))));
    manager.playoffPct = Math.min(99, Math.max(4, ((totalTeams - index) / totalTeams) * 68 + (manager.projW / 13) * 25 + (league.playoffTeams / totalTeams) * 22 - 8));
  });

  const selectors = ["teamSelect", "tradeTeamA", "tradeTeamB", "simTeamA", "simTeamB"];
  selectors.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = "";
    state.managers.forEach((manager, index) => {
      const option = document.createElement("option");
      option.value = index; option.textContent = manager.teamName;
      select.appendChild(option);
    });
  });
  const partnerIndex = state.managers.length > 1 ? 1 : 0;
  document.getElementById("teamSelect").value = "0";
  document.getElementById("tradeTeamA").value = "0";
  document.getElementById("tradeTeamB").value = String(partnerIndex);
  document.getElementById("simTeamA").value = "0";
  document.getElementById("simTeamB").value = String(partnerIndex);
  renderSuperlatives([]);
  renderAllViews(0);
  await buildTradeDatabase();
  scanPlayerAlertChanges();
  setStatus(`Imported ${league.name} from ESPN • ${state.managers.length} teams • Week ${state.week}`);
}

async function loadLeague(idx) {
  state.activeLeague = state.leagues[idx];
  if (!state.activeLeague) return;
  if (state.activeLeague.provider === "espn") return loadEspnLeague(idx);
  refreshSeasonDerivedState(state.activeLeague.season || state.season);
  state.bracketOverrides = {};
  updateDynamicSeasonLabels();
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
  state.currentMatchups = matchups || [];

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
    const nextYr = (parseInt(state.activeLeague.season, 10) || parseInt(state.season, 10)) + 1;
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
  selectors.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
  let myIdx = 0;
  state.managers.forEach((m, i) => {
    if (m.ownerId === state.userId) myIdx = i;
    selectors.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const opt = document.createElement("option"); opt.value = i; opt.textContent = m.teamName;
        el.appendChild(opt);
      }
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
  scanPlayerAlertChanges();
  setStatus(`Synced ${state.activeLeague.name} (${state.activeLeague.playoffTeams}-Team Playoff) • Week ${state.week}`);
}

// 6. Tab 1 & Tab 2: Roster Overview & Power Rankings
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
  tbl.innerHTML = `<thead><tr><th>Pos</th><th style="text-align:left;">Player</th><th>NFL Team</th><th>Health Status</th><th>${state.season} Bye</th><th>Season PPG</th><th>Week ${state.week} Proj</th><th>Age / Exp</th></tr></thead><tbody></tbody>`;
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
  const mode = parseInt(document.getElementById("powerChartMode")?.value || "0", 10);

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

// 7. Tab 3: Trade Center (Builder, Database & Finder)
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
  if (state.activeLeague?.provider !== "espn") state.managerTendencies = [];
  const fmtTag = state.activeLeague
    ? `${state.activeLeague.leagueType === 2 ? "Dynasty" : (state.activeLeague.leagueType === 1 ? "Keeper" : "Redraft")} • ${state.activeLeague.totalTeams}T`
    : "12-Team PPR";

  if (state.activeLeague?.leagueId && state.activeLeague.provider === "sleeper") {
    try {
      const lastWeek = Math.min(state.week, 18);
      const firstWeek = Math.max(1, lastWeek - 7);
      const reqs = [];
      for (let w = firstWeek; w <= lastWeek; w++) {
        reqs.push(fetch(`https://api.sleeper.app/v1/league/${state.activeLeague.leagueId}/transactions/${w}`).then(r => r.json()).catch(() => []));
      }
      const weeklyTx = await Promise.all(reqs);
      const tendencies = new Map();
      const getTendency = rosterId => {
        if (!tendencies.has(rosterId)) tendencies.set(rosterId, { rosterId, acquisitions: 0, trades: 0, positions: {}, draftPicks: 0, draftPositions: {} });
        return tendencies.get(rosterId);
      };
      weeklyTx.forEach((txArr, wIdx) => {
        (txArr || []).forEach(tx => {
          if (tx.status !== "complete") return;
          const tradeRecipients = new Set();
          Object.entries(tx.adds || {}).forEach(([playerId, rosterId]) => {
            const player = state.players[playerId];
            if (!player) return;
            const profile = getTendency(rosterId);
            profile.acquisitions++;
            profile.positions[player.position] = (profile.positions[player.position] || 0) + 1;
            if (tx.type === "trade") tradeRecipients.add(rosterId);
          });
          tradeRecipients.forEach(rosterId => { getTendency(rosterId).trades++; });
          if (tx.type !== "trade" || !tx.roster_ids || tx.roster_ids.length < 2) return;
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
            state.dbTrades.push({ aIds, bIds, aVal, bVal, src: "LEAGUE", label: `Week ${firstWeek + wIdx} League Trade`, format: fmtTag });
          }
        });
      });
      try {
        const drafts = await fetch(`https://api.sleeper.app/v1/league/${state.activeLeague.leagueId}/drafts`).then(response => response.json());
        const selectedDraft = (drafts || []).find(draft => String(draft.season) === String(state.activeLeague.season)) || drafts?.[0];
        if (selectedDraft?.draft_id) {
          const picks = await fetch(`https://api.sleeper.app/v1/draft/${selectedDraft.draft_id}/picks`).then(response => response.json());
          (picks || []).forEach(pick => {
            const player = state.players[pick.player_id];
            if (!player) return;
            const profile = getTendency(pick.roster_id);
            profile.draftPicks++;
            profile.draftPositions[player.position] = (profile.draftPositions[player.position] || 0) + 1;
          });
        }
      } catch {}
      state.managerTendencies = [...tendencies.values()];
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
    tbody.innerHTML = `<tr><td colspan="6" style="padding:24px;color:var(--text-muted);">Connect a league above to analyze positional grades, Contender vs. Rebuilder tags, and archetype-matched trades.</td></tr>`;
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

// 8. Tab 4, Tab 5 & Tab 6: Lineup Optimizer, Waivers & Player Analytics
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

function getFaabStorageKey() {
  return `fantasy-faab-v1:${state.activeLeague?.provider || state.provider}:${state.activeLeague?.season || state.season || DEFAULT_SEASON}:${state.activeLeague?.leagueId || "custom"}`;
}

function loadFaabState() {
  const key = getFaabStorageKey();
  if (faabState.loadedKey === key) return;
  faabState.loadedKey = key;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (saved && typeof saved === "object") {
      faabState.budget = Math.max(0, Number(saved.budget) || 100);
      faabState.weeksRemaining = Math.min(18, Math.max(1, Number(saved.weeksRemaining) || 12));
      faabState.strategy = ["conservative", "balanced", "aggressive"].includes(saved.strategy) ? saved.strategy : "balanced";
      faabState.claims = Array.isArray(saved.claims) ? saved.claims : [];
    }
  } catch {}
}

function saveFaabState() {
  try {
    localStorage.setItem(getFaabStorageKey(), JSON.stringify({
      budget: faabState.budget, weeksRemaining: faabState.weeksRemaining,
      strategy: faabState.strategy, claims: faabState.claims
    }));
  } catch {}
}

function getQueuedFaabTotal() {
  return faabState.claims.reduce((sum, claim) => sum + Math.max(0, Number(claim.bid) || 0), 0);
}

function getSuggestedFaabBid(player) {
  const availableBudget = Math.max(0, faabState.budget - getQueuedFaabTotal());
  if (!availableBudget) return 0;
  const styleMultiplier = { conservative: 0.72, balanced: 1, aggressive: 1.32 }[faabState.strategy] || 1;
  const timingMultiplier = faabState.weeksRemaining <= 3 ? 1.3 : (faabState.weeksRemaining <= 6 ? 1.12 : 1);
  const scarcityMultiplier = ["RB", "WR"].includes(player.position) && player.posRank <= 12 ? 1.1 : 1;
  const share = Math.min(0.4, Math.max(0.02, (player.vorpScore / 26) * styleMultiplier * timingMultiplier * scarcityMultiplier));
  return Math.min(availableBudget, Math.max(1, Math.round(availableBudget * share)));
}

function renderFaabPlanner() {
  loadFaabState();
  const budgetInput = document.getElementById("faabBudget");
  const weeksInput = document.getElementById("faabWeeks");
  const strategyInput = document.getElementById("faabStrategy");
  if (budgetInput && document.activeElement !== budgetInput) budgetInput.value = String(faabState.budget);
  if (weeksInput && document.activeElement !== weeksInput) weeksInput.value = String(faabState.weeksRemaining);
  if (strategyInput) strategyInput.value = faabState.strategy;
  const totalQueued = getQueuedFaabTotal();
  const summary = document.getElementById("faabBudgetSummary");
  if (summary) summary.textContent = `$${Math.max(0, faabState.budget - totalQueued)} available · $${totalQueued} queued`;
  const claimCount = document.getElementById("faabClaimCount");
  if (claimCount) claimCount.textContent = `${faabState.claims.length} claim${faabState.claims.length === 1 ? "" : "s"}`;
  const list = document.getElementById("faabClaims");
  if (list) list.innerHTML = faabState.claims.length ? faabState.claims.map((claim, index) => {
    const player = state.players[claim.playerId];
    return `<div class="faab-claim-row"><div><strong>${draftEscapeHtml(player?.name || claim.playerName || "Unknown player")}</strong><span>${draftEscapeHtml(player?.position || claim.position || "")}</span></div><label>Bid $<input type="number" min="0" max="${faabState.budget}" value="${Math.max(0, Number(claim.bid) || 0)}" data-faab-bid="${index}" /></label><button type="button" class="btn-builder-action" data-remove-faab="${index}" aria-label="Remove claim for ${draftEscapeHtml(player?.name || claim.playerName || "player")}">Remove</button></div>`;
  }).join("") : `<div class="draft-empty">Queue a free agent below to plan bids.</div>`;
}

function updateFaabSettings() {
  faabState.budget = Math.min(1000, Math.max(0, Number(document.getElementById("faabBudget")?.value) || 0));
  faabState.weeksRemaining = Math.min(18, Math.max(1, Number(document.getElementById("faabWeeks")?.value) || 1));
  faabState.strategy = document.getElementById("faabStrategy")?.value || "balanced";
  saveFaabState();
  renderWaiversTab();
}

function toggleFaabClaim(playerId) {
  const player = state.players[playerId];
  if (!player) return;
  const existingIndex = faabState.claims.findIndex(claim => claim.playerId === playerId);
  if (existingIndex >= 0) faabState.claims.splice(existingIndex, 1);
  else faabState.claims.push({ playerId, playerName: player.name, position: player.position, bid: getSuggestedFaabBid(player) });
  saveFaabState();
  renderWaiversTab();
}

function getWaiverRosterNeeds(manager) {
  if (!manager) return { needs: [], fitByPosition: {} };
  const positions = ["QB", "RB", "WR", "TE", "K", "DEF"];
  const required = Object.fromEntries(positions.map(position => [position, 0]));
  let flexSlots = 0, superFlexSlots = 0;
  const slots = (state.activeLeague?.rosterPositions || []).filter(slot => !["BN", "IR", "TAXI"].includes(slot));
  const lineupSlots = slots.length ? slots : ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"];
  lineupSlots.forEach(slot => {
    if (positions.includes(slot)) required[slot]++;
    else if (["SUPER_FLEX", "Q/W/R/T"].includes(slot)) superFlexSlots++;
    else if (["FLEX", "WR/RB", "REC_FLEX", "W/R/T", "WRRB_FLEX", "IDP_FLEX"].includes(slot)) flexSlots++;
  });

  const rostered = manager.players.map(id => state.players[id]).filter(player => player && !player.isPick);
  const rosteredCounts = Object.fromEntries(positions.map(position => [position, rostered.filter(player => player.position === position).length]));
  const healthyCounts = Object.fromEntries(positions.map(position => [position, rostered.filter(player => player.position === position && !["Out", "IR", "PUP", "Suspended"].includes(player.injuryStatus) && player.byeWeek !== state.week).length]));
  const needs = [];

  positions.forEach(position => {
    const starterRequirement = required[position] + (position === "QB" ? superFlexSlots : 0);
    const flexShare = position === "RB" || position === "WR" ? flexSlots * 0.4 : (position === "TE" ? flexSlots * 0.2 : 0);
    const totalRequirement = starterRequirement + flexShare;
    if (totalRequirement <= 0 && rosteredCounts[position] === 0) return;
    const unavailable = rostered.filter(player => player.position === position && (["Out", "IR", "PUP", "Suspended"].includes(player.injuryStatus) || player.byeWeek === state.week));
    const doubtful = rostered.filter(player => player.position === position && ["Questionable", "Doubtful"].includes(player.injuryStatus));
    const depthBuffer = ["RB", "WR"].includes(position) ? 0.75 : (position === "TE" ? 0.35 : (position === "QB" && superFlexSlots ? 0.75 : 0));
    const depthTarget = totalRequirement + depthBuffer;
    const starterGap = Math.max(0, starterRequirement - healthyCounts[position]);
    const depthGap = Math.max(0, depthTarget - healthyCounts[position] - starterGap);
    const uncoveredRisk = unavailable.length && healthyCounts[position] < depthTarget;
    const questionableRisk = doubtful.length && healthyCounts[position] < depthTarget;
    const score = starterGap * 100 + (uncoveredRisk ? unavailable.length * 34 : 0) + (questionableRisk ? doubtful.length * 20 : 0) + depthGap * 24;
    if (score <= 0) return;
    const causes = [];
    if (starterGap >= 1) causes.push(`${Math.ceil(starterGap)} starting slot${starterGap >= 1.5 ? "s" : ""} uncovered`);
    else if (starterGap > 0) causes.push("starting coverage at risk");
    const byes = unavailable.filter(player => player.byeWeek === state.week).length;
    const out = unavailable.length - byes;
    if (out) causes.push(`${out} injured/out`);
    if (byes) causes.push(`${byes} on bye`);
    if (doubtful.length) causes.push(`${doubtful.length} questionable`);
    if (depthGap > 0) causes.push("thin depth");
    needs.push({ position, score, starterGap, urgent: starterGap >= 1 || Boolean(uncoveredRisk), causes, rostered: rosteredCounts[position], healthy: healthyCounts[position] });
  });

  if (flexSlots > 0) {
    const skillPlayers = rostered.filter(player => ["RB", "WR", "TE"].includes(player.position));
    const healthySkill = skillPlayers.filter(player => !["Out", "IR", "PUP", "Suspended"].includes(player.injuryStatus) && player.byeWeek !== state.week).length;
    const flexibleGap = Math.max(0, flexSlots - Math.max(0, healthySkill - required.RB - required.WR - required.TE));
    if (flexibleGap > 0) needs.push({ position: "FLEX", score: flexibleGap * 55, starterGap: flexibleGap, urgent: flexibleGap >= 1, causes: [`${Math.ceil(flexibleGap)} flex slot${flexibleGap >= 1.5 ? "s" : ""} at risk`], rostered: skillPlayers.length, healthy: healthySkill });
  }

  const fitByPosition = Object.fromEntries(needs.map(need => [need.position, need.score]));
  return { needs: needs.sort((a, b) => b.score - a.score), fitByPosition };
}

function renderWaiverNeeds(manager, needs) {
  const panel = document.getElementById("waiverNeedList");
  const targetsPanel = document.getElementById("waiverNeedTargets");
  const teamName = document.getElementById("waiverNeedsTeam");
  const meta = document.getElementById("waiverNeedsMeta");
  if (teamName) teamName.textContent = manager?.teamName?.split(" (")[0] || "No roster selected";
  if (!manager) {
    if (meta) meta.textContent = "Sync a league and select a roster to calculate positional weakness and lineup availability.";
    if (panel) panel.innerHTML = `<div class="draft-empty">No roster selected.</div>`;
    if (targetsPanel) targetsPanel.innerHTML = "";
    return;
  }
  const starterSlots = (state.activeLeague?.rosterPositions || []).filter(slot => !["BN", "IR", "TAXI"].includes(slot)).length || 9;
  if (meta) meta.textContent = `Week ${state.week} roster health · ${starterSlots} starting slots · calculated from roster, injuries, and byes`;
  if (panel) panel.innerHTML = needs.length ? needs.slice(0, 5).map(need => {
    const urgent = need.urgent;
    return `<div class="waiver-need-item ${urgent ? "urgent" : ""}"><div><strong>${draftEscapeHtml(need.position)}${urgent ? " · Priority" : " · Depth"}</strong><span>${draftEscapeHtml(need.causes.join(" · "))}</span></div><b>${need.rostered} rostered</b></div>`;
  }).join("") : `<div class="waiver-needs-clear"><strong>No urgent positional gaps</strong><span>Your selected roster has healthy coverage for the current week. Use VORP and projections below to find depth or upside.</span></div>`;

  if (!targetsPanel) return;
  const targets = [];
  const seen = new Set();
  needs.slice(0, 4).forEach(need => {
    const candidates = state.waiverTargets.filter(player => {
      const eligible = need.position === "FLEX" ? ["RB", "WR", "TE"].includes(player.position) : player.position === need.position;
      return eligible && !seen.has(player.id);
    }).sort((a, b) => ((b.vorpScore || 0) - (a.vorpScore || 0)) || ((b.projectedPoints || 0) - (a.projectedPoints || 0))).slice(0, 2);
    candidates.forEach(player => { seen.add(player.id); targets.push({ player, need }); });
  });
  targetsPanel.innerHTML = targets.length ? targets.map(({ player, need }) => {
    const fit = need.urgent ? "Priority fit" : "Depth fit";
    return `<div class="waiver-fit-item"><div><span class="waiver-fit-label">${draftEscapeHtml(fit)} · ${draftEscapeHtml(need.position)} need</span><strong>${draftEscapeHtml(player.name)}</strong><span>${draftEscapeHtml(player.position)} · ${draftEscapeHtml(player.team || "FA")} · ${Number(player.projectedPoints || 0).toFixed(1)} projected · ${Number(player.vorpScore || 0).toFixed(1)} VORP</span></div><button class="btn-builder-action" type="button" data-waiver-fit-player="${draftEscapeHtml(player.id)}">${faabState.claims.some(claim => claim.playerId === player.id) ? "Queued" : `Queue $${getSuggestedFaabBid(player)}`}</button></div>`;
  }).join("") : `<div class="draft-empty">No matching available players found for these needs.</div>`;
}

function renderWaiversTab() {
  loadFaabState();
  const rostered = new Set();
  state.managers.forEach(m => m.players.forEach(p => rostered.add(p)));
  const selectedTeamIndex = parseInt(document.getElementById("teamSelect")?.value || "0", 10);
  const selectedManager = state.managers[selectedTeamIndex];
  const rosterNeeds = getWaiverRosterNeeds(selectedManager);
  const pf = document.getElementById("waiverPos")?.value || "ALL";
  state.waiverTargets = Object.values(state.players).filter(p => {
    if (p.isPick || rostered.has(p.id)) return false;
    if (p.position !== "DEF" && !p.isCurrentNfl) return false;
    if (pf === "ALL" && !["QB","RB","WR","TE","DEF","K"].includes(p.position)) return false;
    if (pf === "FLEX" && !["RB","WR","TE"].includes(p.position)) return false;
    if (pf !== "ALL" && pf !== "FLEX" && p.position !== pf) return false;
    return p.projectedPoints > 1 || p.seasonPpg > 2;
  }).map(player => ({ ...player, waiverFitScore: rosterNeeds.fitByPosition[player.position] || (pf === "FLEX" ? rosterNeeds.fitByPosition.FLEX || 0 : 0) }))
    .sort((a, b) => (b.waiverFitScore - a.waiverFitScore) || (pf === "ALL" ? (b.vorpScore - a.vorpScore) : (b.projectedPoints - a.projectedPoints))).slice(0, 15);
  renderWaiverNeeds(selectedManager, rosterNeeds.needs);

  const tbl = document.getElementById("waiverTbl");
  if (!tbl) return;
  tbl.innerHTML = `<thead><tr><th>Pos</th><th style="text-align:left;">Player</th><th>NFL Team</th><th>Health Status</th><th>${state.season} Bye</th><th>Season PPG</th><th>Week ${state.week} Proj</th><th>VORP</th><th>Roster fit</th><th>Suggested Bid</th><th></th></tr></thead><tbody></tbody>`;
  const tbody = tbl.querySelector("tbody");

  state.waiverTargets.forEach(fa => {
    const queuedIndex = faabState.claims.findIndex(claim => claim.playerId === fa.id);
    const bid = queuedIndex >= 0 ? faabState.claims[queuedIndex].bid : getSuggestedFaabBid(fa);
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
      <td style="color:var(--accent);font-weight:700;">+${fa.vorpScore.toFixed(1)}</td>
      <td class="waiver-fit-cell">${fa.waiverFitScore >= 80 ? "Priority" : (fa.waiverFitScore > 0 ? "Depth" : "General")}</td>
      <td style="font-weight:700;">$${bid}</td>
      <td><button class="btn-builder-action faab-queue-btn" type="button" data-faab-player="${draftEscapeHtml(fa.id)}">${queuedIndex >= 0 ? "Queued" : "Queue bid"}</button></td>`;
    tbody.appendChild(tr);
  });
  renderFaabPlanner();
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

function getAnalyticsMedian(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function renderAnalyticsReadout(pool, config) {
  const summary = document.getElementById("analyticsValueSummary");
  const insight = document.getElementById("analyticsInsight");
  const poolSummary = document.getElementById("analyticsPoolSummary");
  if (!pool.length) {
    if (summary) summary.innerHTML = "";
    if (insight) insight.textContent = "No active players match this position.";
    if (poolSummary) poolSummary.textContent = "No active players";
    return;
  }
  const topProjection = [...pool].sort((a, b) => b.projectedPoints - a.projectedPoints)[0];
  const topValue = [...pool].sort((a, b) => b.baseValue - a.baseValue)[0];
  const topVorp = [...pool].sort((a, b) => b.vorpScore - a.vorpScore)[0];
  if (summary) summary.innerHTML = [
    ["Players analyzed", pool.length],
    ["Top weekly projection", `${topProjection.name} · ${topProjection.projectedPoints.toFixed(1)} pts`],
    ["Highest model value", `${topValue.name} · ${topValue.baseValue}`],
    ["Best VORP", `${topVorp.name} · ${topVorp.vorpScore.toFixed(1)}`]
  ].map(([label, value]) => `<div class="analytics-summary-item"><span>${draftEscapeHtml(label)}</span><strong>${draftEscapeHtml(value)}</strong></div>`).join("");
  if (poolSummary) poolSummary.textContent = `Showing ${pool.length} of ${Object.values(state.players).filter(player => !player.isPick && player.position === pool[0].position && player.isCurrentNfl).length} active ${pool[0].position}s`;

  const xValues = pool.map(player => Number(player[config.xKey]) || 0);
  const yValues = pool.map(player => Number(player[config.yKey]) || 0);
  const medianX = getAnalyticsMedian(xValues), medianY = getAnalyticsMedian(yValues);
  const aboveBoth = pool.filter(player => Number(player[config.xKey]) >= medianX && Number(player[config.yKey]) >= medianY).length;
  const relation = config.yKey === "baseValue"
    ? pool.filter(player => Number(player[config.xKey]) >= medianX && player.baseValue < medianY).sort((a, b) => b.projectedPoints - a.projectedPoints).slice(0, 3)
    : [];
  if (insight) {
    insight.textContent = config.yKey === "baseValue"
      ? `${aboveBoth} players are above the positional median for both projection and model value. Projection leaders below median model value: ${relation.length ? relation.map(player => player.name).join(", ") : "none in this group"}. Model value is a relative estimate, not a market quote.`
      : `${aboveBoth} of ${pool.length} players are above the positional median on both ${config.xLbl.toLowerCase()} and ${config.yLbl.toLowerCase()}. Dashed guides mark the median; compare players within this position.`;
  }
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

  renderAnalyticsReadout(pool, cfg);

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

  const medianX = getAnalyticsMedian(xs), medianY = getAnalyticsMedian(ys);
  const medianPixelX = plot.l + ((medianX - minX) / Math.max(0.001, maxX - minX)) * plot.w;
  const medianPixelY = plot.t + plot.h - ((medianY - minY) / Math.max(0.001, maxY - minY)) * plot.h;
  ctx.save();
  ctx.strokeStyle = "rgba(233,185,95,0.55)"; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(medianPixelX, plot.t); ctx.lineTo(medianPixelX, plot.t + plot.h);
  ctx.moveTo(plot.l, medianPixelY); ctx.lineTo(plot.l + plot.w, medianPixelY);
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#E9B95F"; ctx.font = "600 9px sans-serif"; ctx.textAlign = "right";
  ctx.fillText("POSITION MEDIAN", plot.l + plot.w, plot.t + 12);
  ctx.restore();

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

    ctx.fillStyle = "#F2F4F8";
    ctx.font = "700 10px -apple-system, BlinkMacSystemFont, sans-serif";
    const label = p.position === "DEF" ? p.team : (p.name.split(" ").slice(1).join(" ") || p.name);
    const tw = ctx.measureText(label).width;
    if (x + 15 + tw > plot.l + plot.w + 20) { ctx.textAlign = "right"; ctx.fillText(label, x - 15, y + 4); }
    else { ctx.textAlign = "left"; ctx.fillText(label, x + 15, y + 4); }
  });
  ctx.textAlign = "left";
}

// 9. Tab 7, Tab 8 & Tab 9: SOS Heat-Map, Playoff Bracket & Matchup Simulator
function renderSosCellHTML(teamAbbr, weekNum, pos, showDomeBadge = false) {
  let normTeam = (teamAbbr || "").toUpperCase().trim();
  if (normTeam === "JAC") normTeam = "JAX"; if (normTeam === "LA") normTeam = "LAR";

  if (CURRENT_BYE_WEEKS[normTeam] === weekNum) {
    return `<div class="sos-cell sos-bye"><div style="font-weight:800;font-size:12px;">BYE WEEK</div><div style="font-size:10px;">Week ${weekNum} Off</div></div>`;
  }
  const m = CURRENT_NFL_SCHEDULE[normTeam]?.[weekNum];
  if (!m) return `<div class="sos-cell sos-mid"><div style="font-weight:700;font-size:12px;">TBD</div></div>`;

  const opp = m.opp;
  const dvpRank = CURRENT_DVP_RANKS[pos]?.[opp] || 16;
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
    tbody.innerHTML = `<tr><td colspan="${weeks.length + (showActionCol ? 5 : 4)}" style="padding:24px;color:var(--text-muted);">Connect a league or switch Scope to "All 32 NFL Teams" or "Top 36 Positional Players" to view schedules.</td></tr>`;
    return;
  }

  rows.forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.className = "table-row-hover";
    const envMeta = isPlayoffs ? `${r.sos.domeCount} Dome Game(s) • ${r.sos.smashCount} Smash Matchup(s)` : `${state.season} Bye: Week ${CURRENT_BYE_WEEKS[r.team] || '--'} • ${r.sos.smashCount} Smash Matchup(s)`;
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

async function getPortfolioLeagueRosters(league) {
  const cacheKey = `${league.provider}:${league.leagueId}`;
  if (portfolioState.rostersByLeague.has(cacheKey)) return portfolioState.rostersByLeague.get(cacheKey);
  let rosters = [];
  if (league.provider === "espn") {
    rosters = (league.espnData?.teams || []).map(team => ({
      teamId: String(team.id), ownerId: String(team.owners?.[0] || ""),
      name: team.name || `${team.location || ""} ${team.nickname || ""}`.trim() || `Team ${team.id}`,
      rosterPositions: league.rosterPositions || [], scoringSettings: league.scoringSettings || {},
      players: (team.roster?.entries || []).map(entry => {
        const player = entry.playerPoolEntry?.player || entry.player || {};
        return getInternalPlayerIdFromEspn(player);
      }).filter(Boolean)
    }));
  } else if (league.provider === "yahoo") {
    rosters = state.managers.map(manager => ({ teamId: String(manager.rosterId), ownerId: String(manager.ownerId || ""), name: manager.teamName, rosterPositions: league.rosterPositions || [], scoringSettings: league.scoringSettings || {}, players: manager.players || [] }));
  } else {
    const [rosterResponse, userResponse] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${league.leagueId}/rosters`).then(response => response.json()),
      fetch(`https://api.sleeper.app/v1/league/${league.leagueId}/users`).then(response => response.json())
    ]);
    const userNames = Object.fromEntries((userResponse || []).map(user => [user.user_id, user.metadata?.team_name || user.display_name || "Team"]));
    rosters = (rosterResponse || []).map(roster => ({
      teamId: String(roster.roster_id), ownerId: String(roster.owner_id || ""),
      name: userNames[roster.owner_id] || `Team ${roster.roster_id}`,
      rosterPositions: league.rosterPositions || [], scoringSettings: league.scoringSettings || {},
      players: roster.players || []
    }));
  }
  portfolioState.rostersByLeague.set(cacheKey, rosters);
  return rosters;
}

function populateHistorySeasonOptions() {
  const select = document.getElementById("historySeason");
  if (!select) return;
  const current = Number(state.activeLeague?.season || state.season || new Date().getFullYear());
  const selected = select.value || String(current - 1);
  const firstYear = Math.max(2017, current - 8);
  const seasons = state.activeLeague?.provider === "yahoo"
    ? [current]
    : Array.from({ length: current - firstYear + 1 }, (_, index) => current - index);
  select.innerHTML = seasons
    .map(year => `<option value="${year}">${year}</option>`).join("");
  if (seasons.some(year => String(year) === selected)) select.value = selected;
  else select.value = String(seasons[0]);
}

function renderHistoricalRows(rows) {
  state.historicalRows = rows;
  const table = document.getElementById("historyTable");
  if (!table) return;
  table.innerHTML = `<thead><tr><th>Season</th><th style="text-align:left;">League</th><th style="text-align:left;">Manager</th><th>Record</th><th>Points For</th><th>Points Against</th></tr></thead><tbody></tbody>`;
  const body = table.querySelector("tbody");
  body.innerHTML = rows.length ? rows.sort((a, b) => (b.wins - a.wins) || (b.pointsFor - a.pointsFor)).map(row =>
    `<tr><td>${draftEscapeHtml(row.season)}</td><td>${draftEscapeHtml(row.leagueName)}</td><td>${draftEscapeHtml(row.manager)}</td><td>${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ""}</td><td>${Number(row.pointsFor || 0).toFixed(1)}</td><td>${Number(row.pointsAgainst || 0).toFixed(1)}</td></tr>`
  ).join("") : `<tr><td colspan="6" class="draft-empty">No standings found for this season.</td></tr>`;
}

async function loadHistoricalSeason() {
  const year = String(document.getElementById("historySeason")?.value || "");
  const meta = document.getElementById("historyMeta");
  if (!year || !state.leagues.length) { if (meta) meta.textContent = "Connect an account before browsing historical seasons."; return; }
  if (meta) meta.textContent = `Loading ${year} standings...`;
  try {
    const rows = [];
    if (state.provider === "sleeper" && state.userId) {
      const leagues = await fetch(`https://api.sleeper.app/v1/user/${state.userId}/leagues/nfl/${year}`).then(response => response.json());
      const histories = await Promise.all((leagues || []).map(async league => {
        const [rosters, users] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${league.league_id}/rosters`).then(response => response.json()),
          fetch(`https://api.sleeper.app/v1/league/${league.league_id}/users`).then(response => response.json())
        ]);
        const names = Object.fromEntries((users || []).map(user => [user.user_id, user.metadata?.team_name || user.display_name || "Manager"]));
        return (rosters || []).map(roster => {
          const settings = roster.settings || {};
          return {
            season: year, leagueName: league.name || `League ${league.league_id}`,
            manager: names[roster.owner_id] || `Team ${roster.roster_id}`,
            wins: Number(settings.wins) || 0, losses: Number(settings.losses) || 0, ties: Number(settings.ties) || 0,
            pointsFor: Number(settings.fpts || 0) + Number(settings.fpts_decimal || 0) / 100,
            pointsAgainst: Number(settings.fpts_against || 0) + Number(settings.fpts_against_decimal || 0) / 100
          };
        });
      }));
      histories.forEach(items => rows.push(...items));
    } else if (state.provider === "espn") {
      const histories = await Promise.all(state.leagues.map(async league => {
        try {
          const data = await fetchEspnLeague(league.leagueId, year);
          const memberNames = Object.fromEntries((data.members || []).map(member => [String(member.id), member.displayName || member.firstName || "Manager"]));
          return (data.teams || []).map(team => {
            const record = team.record?.overall || {};
            return {
              season: year, leagueName: data.settings?.name || league.name,
              manager: (team.owners || []).map(owner => memberNames[String(owner)] || "Manager").join(", "),
              wins: Number(record.wins) || 0, losses: Number(record.losses) || 0, ties: Number(record.ties) || 0,
              pointsFor: Number(record.pointsFor ?? team.points) || 0, pointsAgainst: Number(record.pointsAgainst ?? team.pointsAgainst) || 0
            };
          });
        } catch { return []; }
      }));
      histories.forEach(items => rows.push(...items));
    } else if (state.provider === "yahoo" && year === String(state.activeLeague?.season)) {
      rows.push(...state.managers.map(manager => ({
        season: year, leagueName: state.activeLeague.name, manager: manager.teamName,
        wins: manager.wins, losses: manager.losses, ties: manager.ties || 0, pointsFor: manager.pf, pointsAgainst: manager.pa
      })));
    }
    renderHistoricalRows(rows);
    if (meta) meta.textContent = `${rows.length} manager season record${rows.length === 1 ? "" : "s"} · ${year}`;
  } catch (error) {
    if (meta) meta.textContent = `Could not load ${year} history: ${error.message}`;
    renderHistoricalRows([]);
  }
}

function getNormalizedCurrentMatchups() {
  if (!state.activeLeague) return [];
  if (state.activeLeague.provider === "espn") {
    return (state.currentMatchups || []).map((matchup, index) => {
      const home = matchup.home || {}, away = matchup.away || {};
      const homeId = String(home.teamId ?? home.id ?? ""), awayId = String(away.teamId ?? away.id ?? "");
      const homeManager = state.managers.find(manager => String(manager.rosterId) === homeId);
      const awayManager = state.managers.find(manager => String(manager.rosterId) === awayId);
      return {
        id: String(matchup.id || matchup.matchupPeriodId || index), homeId, awayId,
        homeName: homeManager?.teamName || `Team ${homeId}`, awayName: awayManager?.teamName || `Team ${awayId}`,
        homeScore: Number(home.totalPoints ?? home.points) || 0, awayScore: Number(away.totalPoints ?? away.points) || 0
      };
    }).filter(matchup => matchup.homeId && matchup.awayId);
  }
  if (state.activeLeague.provider === "yahoo") {
    return (state.currentMatchups || []).map((matchup, index) => ({
      id: String(matchup.id || index), homeId: String(matchup.homeId || matchup.home?.teamId || ""),
      awayId: String(matchup.awayId || matchup.away?.teamId || ""),
      homeName: matchup.homeName || matchup.home?.name || "Home team", awayName: matchup.awayName || matchup.away?.name || "Away team",
      homeScore: Number(matchup.homeScore ?? matchup.home?.points) || 0, awayScore: Number(matchup.awayScore ?? matchup.away?.points) || 0
    })).filter(matchup => matchup.homeId && matchup.awayId);
  }
  const groups = new Map();
  (state.currentMatchups || []).forEach(matchup => {
    if (matchup.matchup_id === undefined || matchup.matchup_id === null) return;
    if (!groups.has(String(matchup.matchup_id))) groups.set(String(matchup.matchup_id), []);
    groups.get(String(matchup.matchup_id)).push(matchup);
  });
  return [...groups.entries()].filter(([, teams]) => teams.length >= 2).map(([id, teams]) => {
    const home = teams[0], away = teams[1];
    const managerFor = rosterId => state.managers.find(manager => String(manager.rosterId) === String(rosterId));
    return {
      id, homeId: String(home.roster_id), awayId: String(away.roster_id),
      homeName: managerFor(home.roster_id)?.teamName || `Team ${home.roster_id}`,
      awayName: managerFor(away.roster_id)?.teamName || `Team ${away.roster_id}`,
      homeScore: Number(home.points) || 0, awayScore: Number(away.points) || 0
    };
  });
}

function renderWeeklyLeagueReport() {
  const content = document.getElementById("weeklyReportContent");
  const meta = document.getElementById("weeklyReportMeta");
  if (!state.activeLeague || !state.managers.length) {
    if (content) content.innerHTML = `<p>Connect a league to generate this week's report.</p>`;
    return null;
  }
  const games = getNormalizedCurrentMatchups();
  const leader = [...state.managers].sort((a, b) => (b.wins - a.wins) || (b.pf - a.pf))[0];
  const scores = games.flatMap(game => [{ name: game.homeName, score: game.homeScore }, { name: game.awayName, score: game.awayScore }]);
  const topScore = scores.filter(item => item.score > 0).sort((a, b) => b.score - a.score)[0];
  const closest = [...games].filter(game => game.homeScore > 0 || game.awayScore > 0).sort((a, b) => Math.abs(a.homeScore - a.awayScore) - Math.abs(b.homeScore - b.awayScore))[0];
  const actions = buildWeeklyRecommendations().length;
  const lines = [
    `${state.activeLeague.name} · Week ${state.week} Report`,
    `${state.activeLeague.season} season · ${state.managers.length} managers`,
    leader ? `Standings leader: ${leader.teamName} (${leader.wins}-${leader.losses}, ${leader.pf.toFixed(1)} points for).` : "Standings are not available.",
    topScore ? `Top score so far: ${topScore.name} with ${topScore.score.toFixed(1)} points.` : "Matchup scores are not available yet.",
    closest ? `Closest matchup so far: ${closest.homeName} ${closest.homeScore.toFixed(1)} – ${closest.awayScore.toFixed(1)} ${closest.awayName}.` : "No scored matchups are available yet.",
    `${actions} roster actions are available for the selected team.`
  ];
  const report = { title: `${state.activeLeague.name} Week ${state.week}`, lines, managers: [...state.managers].sort((a, b) => (b.wins - a.wins) || (b.pf - a.pf)).slice(0, 12), games };
  state.weeklyReportText = lines.join("\n");
  if (content) content.innerHTML = `<h4>${draftEscapeHtml(report.title)}</h4><ul>${lines.slice(2).map(line => `<li>${draftEscapeHtml(line)}</li>`).join("")}</ul>`;
  if (meta) meta.textContent = `Generated ${new Date().toLocaleString()} · scores reflect the last provider sync`;
  return report;
}

async function copyWeeklyLeagueReport() {
  const report = renderWeeklyLeagueReport();
  if (!report) return;
  try {
    await navigator.clipboard.writeText(state.weeklyReportText);
    setStatus("Weekly recap copied.");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = state.weeklyReportText; document.body.appendChild(textarea); textarea.select();
    try { document.execCommand("copy"); } catch {}
    textarea.remove(); setStatus("Weekly recap ready to paste.");
  }
}

function downloadLeagueHome() {
  const report = renderWeeklyLeagueReport();
  if (!report) return;
  const standings = report.managers.map(manager => `<tr><td>${draftEscapeHtml(manager.teamName)}</td><td>${manager.wins}-${manager.losses}</td><td>${Number(manager.pf || 0).toFixed(1)}</td><td>${Number(manager.pa || 0).toFixed(1)}</td></tr>`).join("");
  const games = report.games.map(game => `<li>${draftEscapeHtml(game.homeName)} ${game.homeScore.toFixed(1)} – ${game.awayScore.toFixed(1)} ${draftEscapeHtml(game.awayName)}</li>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${draftEscapeHtml(report.title)}</title><style>body{font:16px system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#17211c}h1{font-size:30px}p,li{line-height:1.6;color:#53615a}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{text-align:left;padding:10px;border-bottom:1px solid #d8e0dc}th{background:#eff4f1}</style></head><body><h1>${draftEscapeHtml(report.title)}</h1><ul>${report.lines.slice(2).map(line => `<li>${draftEscapeHtml(line)}</li>`).join("")}</ul><h2>Current matchups</h2><ul>${games || "<li>No scores available</li>"}</ul><h2>Standings</h2><table><thead><tr><th>Manager</th><th>Record</th><th>PF</th><th>PA</th></tr></thead><tbody>${standings}</tbody></table><p>Generated by Fantasy Front Office.</p></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const link = document.createElement("a");
  link.href = url; link.download = `${state.activeLeague.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-week-${state.week}-home.html`;
  link.click(); URL.revokeObjectURL(url);
}

function getNewsletterLeagueKey(league = state.activeLeague) {
  if (!league) return "";
  return `${league.provider}:${league.leagueId}:${league.season}`;
}

function getNewsletterArchive() {
  try {
    const archive = JSON.parse(localStorage.getItem("fantasy-front-office:newsletter:v1") || "{}");
    return archive && typeof archive === "object" ? archive : {};
  } catch { return {}; }
}

function buildLeagueNewsletterIssue() {
  const league = state.activeLeague;
  if (!league || !state.managers.length) return null;
  const leader = [...state.managers].sort((a, b) => (b.wins - a.wins) || (b.pf - a.pf))[0];
  const games = getNormalizedCurrentMatchups();
  const scores = games.flatMap(game => [{ name: game.homeName, score: game.homeScore }, { name: game.awayName, score: game.awayScore }]).sort((a, b) => b.score - a.score);
  const closest = [...games].filter(game => game.homeScore > 0 || game.awayScore > 0).sort((a, b) => Math.abs(a.homeScore - a.awayScore) - Math.abs(b.homeScore - b.awayScore))[0];
  const actions = buildWeeklyRecommendations().slice(0, 5).map(item => ({ title: item.title, detail: item.detail, value: item.value, type: item.type }));
  const standings = [...state.managers].sort((a, b) => (b.wins - a.wins) || (b.pf - a.pf)).slice(0, 12).map(manager => ({
    teamName: manager.teamName, record: `${manager.wins}-${manager.losses}${manager.ties ? `-${manager.ties}` : ""}`,
    pointsFor: Number(manager.pf) || 0, pointsAgainst: Number(manager.pa) || 0
  }));
  const topScore = scores.find(item => item.score > 0);
  const summary = [
    leader ? `${leader.teamName} leads the standings at ${leader.wins}-${leader.losses} with ${Number(leader.pf || 0).toFixed(1)} points for.` : "Standings are not available yet.",
    topScore ? `${topScore.name} owns the top score so far at ${topScore.score.toFixed(1)} points.` : "Matchup scoring is not available yet.",
    closest ? `The closest game is ${closest.homeName} vs ${closest.awayName}, separated by ${Math.abs(closest.homeScore - closest.awayScore).toFixed(1)} points.` : "No close matchup is available to highlight yet.",
    `${actions.length} front-office move${actions.length === 1 ? "" : "s"} to review this week.`
  ];
  return {
    id: `${league.season}-week-${state.week}`, leagueKey: getNewsletterLeagueKey(league),
    leagueName: league.name, season: String(league.season), week: state.week,
    title: `${league.name} · Week ${state.week}`, generatedAt: new Date().toISOString(),
    summary, games, standings, actions
  };
}

function newsletterIssueText(issue) {
  return [
    issue.title, `${issue.season} season · Generated ${new Date(issue.generatedAt).toLocaleString()}`,
    "", "THE WEEK IN BRIEF", ...issue.summary,
    "", "MATCHUP BOARD", ...(issue.games.length ? issue.games.map(game => `${game.homeName} ${game.homeScore.toFixed(1)} — ${game.awayScore.toFixed(1)} ${game.awayName}`) : ["No matchup scores available."]),
    "", "STANDINGS", ...issue.standings.map((team, index) => `${index + 1}. ${team.teamName} · ${team.record} · ${team.pointsFor.toFixed(1)} PF`),
    "", "FRONT OFFICE WATCH", ...(issue.actions.length ? issue.actions.map(action => `${action.title} — ${action.detail} (${action.value})`) : ["No recommended actions right now."]),
    "", "Fantasy Front Office"
  ].join("\n");
}

function renderNewsletterIssue(issue, isSaved = false) {
  const content = document.getElementById("leagueNewsletterContent");
  const status = document.getElementById("newsletterStatus");
  if (!content || !issue) return;
  const games = issue.games.length ? issue.games.map(game => {
    const winner = game.homeScore === game.awayScore ? "Tied" : (game.homeScore > game.awayScore ? game.homeName : game.awayName);
    return `<li><div><strong>${draftEscapeHtml(game.homeName)}</strong><span>${game.homeScore.toFixed(1)}</span></div><div><strong>${draftEscapeHtml(game.awayName)}</strong><span>${game.awayScore.toFixed(1)}</span></div><small>${draftEscapeHtml(winner)} leads</small></li>`;
  }).join("") : `<li class="newsletter-empty">Matchups are not available for this week.</li>`;
  const standings = issue.standings.map((team, index) => `<tr><td>${index + 1}</td><td>${draftEscapeHtml(team.teamName)}</td><td>${draftEscapeHtml(team.record)}</td><td>${team.pointsFor.toFixed(1)}</td><td>${team.pointsAgainst.toFixed(1)}</td></tr>`).join("");
  const actions = issue.actions.length ? issue.actions.map(action => `<li><span class="newsletter-action-type">${draftEscapeHtml(action.type)}</span><div><strong>${draftEscapeHtml(action.title)}</strong><small>${draftEscapeHtml(action.detail)} · ${draftEscapeHtml(action.value)}</small></div></li>`).join("") : `<li class="newsletter-empty">No front-office actions to highlight.</li>`;
  content.innerHTML = `<header class="newsletter-masthead"><div><span>FANTASY FRONT OFFICE · ${draftEscapeHtml(issue.season)} SEASON</span><h1>${draftEscapeHtml(issue.title)}</h1></div><time>${draftEscapeHtml(new Date(issue.generatedAt).toLocaleString())}${isSaved ? " · archived" : ""}</time></header><section class="newsletter-brief"><h3>THE WEEK IN BRIEF</h3><ul>${issue.summary.map(line => `<li>${draftEscapeHtml(line)}</li>`).join("")}</ul></section><section class="newsletter-section"><h3>Matchup Board</h3><ol class="newsletter-games">${games}</ol></section><section class="newsletter-section"><h3>Standings</h3><div class="table-wrap"><table class="newsletter-standings"><thead><tr><th>#</th><th>Team</th><th>Record</th><th>PF</th><th>PA</th></tr></thead><tbody>${standings}</tbody></table></div></section><section class="newsletter-section"><h3>Front Office Watch</h3><ol class="newsletter-actions">${actions}</ol></section><footer class="newsletter-footer">Generated for ${draftEscapeHtml(issue.leagueName)} by Fantasy Front Office.</footer>`;
  if (status) status.textContent = isSaved ? `Viewing archived Week ${issue.week} · ${issue.season}.` : `Previewing the current Week ${issue.week} issue. Save it to keep this edition in the league archive.`;
}

function renderLeagueNewsletter() {
  const leagueSelect = document.getElementById("newsletterLeagueSelect");
  const archiveSelect = document.getElementById("newsletterArchiveSelect");
  const badge = document.getElementById("newsletterLeagueBadge");
  if (!leagueSelect || !archiveSelect) return;
  const previousLeague = leagueSelect.value;
  leagueSelect.innerHTML = state.leagues.map((league, index) => `<option value="${index}">${draftEscapeHtml(league.name)} · ${draftEscapeHtml(league.season)}</option>`).join("");
  if (!state.activeLeague || !state.leagues.length) {
    leagueSelect.innerHTML = `<option value="">Connect a league first</option>`;
    archiveSelect.innerHTML = `<option value="">No saved issues</option>`;
    if (badge) badge.textContent = "No league selected";
    document.getElementById("leagueNewsletterContent").innerHTML = `<p>Connect a league to generate its weekly edition.</p>`;
    document.getElementById("newsletterStatus").textContent = "Connect a league to generate its weekly edition.";
    return;
  }
  const activeIndex = state.leagues.indexOf(state.activeLeague);
  leagueSelect.value = previousLeague === String(activeIndex) ? previousLeague : String(activeIndex);
  if (badge) badge.textContent = state.activeLeague.name;
  const archive = getNewsletterArchive();
  const leagueKey = getNewsletterLeagueKey();
  const savedIssues = Object.values(archive[leagueKey] || {}).sort((a, b) => (Number(b.week) - Number(a.week)) || String(b.generatedAt).localeCompare(String(a.generatedAt)));
  const previousIssue = archiveSelect.value;
  archiveSelect.innerHTML = `<option value="current">Current week · ${state.week}</option>${savedIssues.map(issue => `<option value="${draftEscapeHtml(issue.id)}">Saved · ${draftEscapeHtml(issue.season)} W${draftEscapeHtml(issue.week)}</option>`).join("")}`;
  const selectedIssue = savedIssues.find(issue => issue.id === previousIssue);
  archiveSelect.value = selectedIssue ? previousIssue : "current";
  if (archiveSelect.value === "current") renderNewsletterIssue(buildLeagueNewsletterIssue());
  else renderNewsletterIssue(selectedIssue, true);
  const meta = document.getElementById("newsletterArchiveMeta");
  if (meta) meta.textContent = `${savedIssues.length} saved issue${savedIssues.length === 1 ? "" : "s"} for ${state.activeLeague.name}.`;
}

function getSelectedNewsletterIssue() {
  const select = document.getElementById("newsletterArchiveSelect");
  if (!state.activeLeague || !select || select.value === "current") return buildLeagueNewsletterIssue();
  const archive = getNewsletterArchive();
  return archive[getNewsletterLeagueKey()]?.[select.value] || buildLeagueNewsletterIssue();
}

function saveNewsletterIssue() {
  const issue = buildLeagueNewsletterIssue();
  if (!issue) return;
  const archive = getNewsletterArchive();
  if (!archive[issue.leagueKey]) archive[issue.leagueKey] = {};
  archive[issue.leagueKey][issue.id] = issue;
  try { localStorage.setItem("fantasy-front-office:newsletter:v1", JSON.stringify(archive)); } catch {}
  renderLeagueNewsletter();
  const select = document.getElementById("newsletterArchiveSelect");
  if (select) select.value = issue.id;
  renderNewsletterIssue(issue, true);
  document.getElementById("newsletterStatus").textContent = `Week ${issue.week} saved to ${issue.leagueName}'s newsletter archive.`;
}

async function copyNewsletterIssue() {
  const issue = getSelectedNewsletterIssue();
  if (!issue) return;
  const text = newsletterIssueText(issue);
  try { await navigator.clipboard.writeText(text); }
  catch {
    const textarea = document.createElement("textarea");
    textarea.value = text; document.body.appendChild(textarea); textarea.select();
    try { document.execCommand("copy"); } catch {}
    textarea.remove();
  }
  document.getElementById("newsletterStatus").textContent = "Newsletter copied as text.";
}

function downloadNewsletterIssue() {
  const issue = getSelectedNewsletterIssue();
  if (!issue) return;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${draftEscapeHtml(issue.title)}</title><style>body{font:16px Georgia,serif;max-width:820px;margin:40px auto;padding:0 20px;color:#18221e}h1{font:700 34px Georgia,serif}h2,h3{font:700 15px Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;margin-top:30px}li{line-height:1.6;margin:8px 0}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px;border-bottom:1px solid #d8e0dc}footer{margin-top:35px;color:#63716a;font:12px Arial,sans-serif}</style></head><body><p>FANTASY FRONT OFFICE · ${draftEscapeHtml(issue.season)} SEASON</p><h1>${draftEscapeHtml(issue.title)}</h1><h2>The week in brief</h2><ul>${issue.summary.map(line => `<li>${draftEscapeHtml(line)}</li>`).join("")}</ul><h2>Matchups</h2><ul>${issue.games.map(game => `<li>${draftEscapeHtml(game.homeName)} ${game.homeScore.toFixed(1)} — ${game.awayScore.toFixed(1)} ${draftEscapeHtml(game.awayName)}</li>`).join("")}</ul><h2>Standings</h2><table><thead><tr><th>#</th><th>Team</th><th>Record</th><th>PF</th><th>PA</th></tr></thead><tbody>${issue.standings.map((team, index) => `<tr><td>${index + 1}</td><td>${draftEscapeHtml(team.teamName)}</td><td>${draftEscapeHtml(team.record)}</td><td>${team.pointsFor.toFixed(1)}</td><td>${team.pointsAgainst.toFixed(1)}</td></tr>`).join("")}</tbody></table><h2>Front office watch</h2><ul>${issue.actions.map(action => `<li><strong>${draftEscapeHtml(action.title)}</strong> — ${draftEscapeHtml(action.detail)} · ${draftEscapeHtml(action.value)}</li>`).join("")}</ul><footer>Generated for ${draftEscapeHtml(issue.leagueName)} by Fantasy Front Office.</footer></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const link = document.createElement("a");
  link.href = url; link.download = `${issue.leagueName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-week-${issue.week}-newsletter.html`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.getElementById("newsletterStatus").textContent = "Standalone newsletter HTML downloaded.";
}

function getPickemStorageKey() {
  return `fantasy-pickem-v1:${state.activeLeague?.provider || state.provider}:${state.activeLeague?.leagueId || "none"}:${state.activeLeague?.season || state.season}:${state.week}`;
}

function renderPickemChallenge() {
  const matchupSelect = document.getElementById("pickemMatchup"), winnerSelect = document.getElementById("pickemWinner");
  const status = document.getElementById("pickemStatus"), historyEl = document.getElementById("pickemHistory");
  if (!matchupSelect || !winnerSelect || !status || !historyEl) return;
  const games = getNormalizedCurrentMatchups();
  const key = getPickemStorageKey(), historyKey = `${key.split(":").slice(0, 3).join(":")}:history`;
  let saved = null, history = [];
  try { saved = JSON.parse(localStorage.getItem(key) || "null"); history = JSON.parse(localStorage.getItem(historyKey) || "[]"); } catch {}
  const priorMatchup = matchupSelect.value || saved?.matchupId || "";
  matchupSelect.innerHTML = games.length ? games.map(game => `<option value="${draftEscapeHtml(game.id)}">${draftEscapeHtml(game.homeName)} vs ${draftEscapeHtml(game.awayName)}</option>`).join("") : `<option value="">No matchup data loaded</option>`;
  if (games.some(game => game.id === priorMatchup)) matchupSelect.value = priorMatchup;
  const selectedGame = games.find(game => game.id === matchupSelect.value);
  if (selectedGame) {
    const priorWinner = winnerSelect.value || (saved?.matchupId === selectedGame.id ? saved.winnerId : "");
    winnerSelect.innerHTML = `<option value="${draftEscapeHtml(selectedGame.homeId)}">${draftEscapeHtml(selectedGame.homeName)}</option><option value="${draftEscapeHtml(selectedGame.awayId)}">${draftEscapeHtml(selectedGame.awayName)}</option>`;
    winnerSelect.value = [selectedGame.homeId, selectedGame.awayId].includes(String(priorWinner)) ? String(priorWinner) : selectedGame.homeId;
  } else winnerSelect.innerHTML = `<option value="">No teams</option>`;
  const currentPick = saved && selectedGame?.id === saved.matchupId;
  status.textContent = currentPick ? `Saved pick: ${saved.winnerName} · current score ${selectedGame.homeScore.toFixed(1)}–${selectedGame.awayScore.toFixed(1)} (refresh after scoring updates)` : (games.length ? `Week ${state.week} · ${games.length} matchups loaded` : "No matchup data available for this week.");
  historyEl.innerHTML = history.slice(-8).reverse().map(pick => `<span class="pickem-result">W${pick.week}: ${draftEscapeHtml(pick.winnerName)} · ${draftEscapeHtml(pick.leagueName)}</span>`).join("");
}

function savePickemPrediction() {
  const game = getNormalizedCurrentMatchups().find(item => item.id === document.getElementById("pickemMatchup")?.value);
  const winnerId = document.getElementById("pickemWinner")?.value;
  if (!game || !winnerId) { const status = document.getElementById("pickemStatus"); if (status) status.textContent = "No matchup is available for a pick."; return; }
  const winnerName = String(winnerId) === game.homeId ? game.homeName : game.awayName;
  const key = getPickemStorageKey(), historyKey = `${key.split(":").slice(0, 3).join(":")}:history`;
  const pick = { week: state.week, matchupId: game.id, winnerId: String(winnerId), winnerName, leagueName: state.activeLeague?.name || "League", savedAt: Date.now() };
  try {
    localStorage.setItem(key, JSON.stringify(pick));
    const history = JSON.parse(localStorage.getItem(historyKey) || "[]").filter(item => !(item.week === state.week && item.matchupId === game.id));
    history.push(pick); localStorage.setItem(historyKey, JSON.stringify(history.slice(-50)));
  } catch {}
  renderPickemChallenge();
}

function getNormalizedCurrentMatchups() {
  if (!state.activeLeague) return [];
  if (state.activeLeague.provider === "espn") {
    return (state.currentMatchups || []).map((matchup, index) => {
      const home = matchup.home || {};
      const away = matchup.away || {};
      const homeId = String(home.teamId ?? home.id ?? "");
      const awayId = String(away.teamId ?? away.id ?? "");
      const homeManager = state.managers.find(manager => String(manager.rosterId) === homeId);
      const awayManager = state.managers.find(manager => String(manager.rosterId) === awayId);
      return {
        id: String(matchup.id || matchup.matchupPeriodId || index),
        homeId, awayId, homeName: homeManager?.teamName || `Team ${homeId}`,
        awayName: awayManager?.teamName || `Team ${awayId}`,
        homeScore: Number(home.totalPoints ?? home.points) || 0,
        awayScore: Number(away.totalPoints ?? away.points) || 0
      };
    }).filter(matchup => matchup.homeId && matchup.awayId);
  }

  if (state.activeLeague.provider === "yahoo") {
    return (state.currentMatchups || []).map((matchup, index) => ({
      id: String(matchup.id || index), homeId: String(matchup.homeId || matchup.home?.teamId || ""),
      awayId: String(matchup.awayId || matchup.away?.teamId || ""),
      homeName: matchup.homeName || matchup.home?.name || "Home team", awayName: matchup.awayName || matchup.away?.name || "Away team",
      homeScore: Number(matchup.homeScore ?? matchup.home?.points) || 0, awayScore: Number(matchup.awayScore ?? matchup.away?.points) || 0
    })).filter(matchup => matchup.homeId && matchup.awayId);
  }

  const groups = new Map();
  (state.currentMatchups || []).forEach(matchup => {
    if (matchup.matchup_id === undefined || matchup.matchup_id === null) return;
    if (!groups.has(String(matchup.matchup_id))) groups.set(String(matchup.matchup_id), []);
    groups.get(String(matchup.matchup_id)).push(matchup);
  });
  return [...groups.entries()].filter(([, teams]) => teams.length >= 2).map(([id, teams]) => {
    const home = teams[0], away = teams[1];
    const managerFor = rosterId => state.managers.find(manager => String(manager.rosterId) === String(rosterId));
    return {
      id, homeId: String(home.roster_id), awayId: String(away.roster_id),
      homeName: managerFor(home.roster_id)?.teamName || `Team ${home.roster_id}`,
      awayName: managerFor(away.roster_id)?.teamName || `Team ${away.roster_id}`,
      homeScore: Number(home.points) || 0, awayScore: Number(away.points) || 0
    };
  });
}

function updateHistorySeasonOptions() {
  const select = document.getElementById("historySeason");
  if (!select) return;
  const current = Number(state.activeLeague?.season || state.season || new Date().getFullYear());
  const selected = select.value || String(current - 1);
  select.innerHTML = Array.from({ length: Math.min(10, Math.max(1, current - 2016)) }, (_, index) => current - index - 1)
    .map(year => `<option value="${year}">${year}</option>`).join("");
  select.value = [...select.options].some(option => option.value === selected) ? selected : select.options[0]?.value;
}

function renderHistoricalRows(rows) {
  state.historicalRows = rows;
  const table = document.getElementById("historyTable");
  if (!table) return;
  table.innerHTML = `<thead><tr><th>Season</th><th style="text-align:left;">League</th><th style="text-align:left;">Manager</th><th>Record</th><th>Points For</th><th>Points Against</th></tr></thead><tbody></tbody>`;
  const body = table.querySelector("tbody");
  body.innerHTML = rows.length ? rows.sort((a, b) => (b.wins - a.wins) || (b.pointsFor - a.pointsFor)).map(row =>
    `<tr><td>${draftEscapeHtml(row.season)}</td><td>${draftEscapeHtml(row.leagueName)}</td><td>${draftEscapeHtml(row.manager)}</td><td>${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ""}</td><td>${Number(row.pointsFor || 0).toFixed(1)}</td><td>${Number(row.pointsAgainst || 0).toFixed(1)}</td></tr>`
  ).join("") : `<tr><td colspan="6" class="draft-empty">No standings found for this season.</td></tr>`;
}

async function loadHistoricalSeason() {
  const year = String(document.getElementById("historySeason")?.value || "");
  const meta = document.getElementById("historyMeta");
  if (!year || !state.leagues.length) { if (meta) meta.textContent = "Connect an account before browsing historical seasons."; return; }
  if (meta) meta.textContent = `Loading ${year} standings...`;
  try {
    const rows = [];
    if (state.provider === "sleeper" && state.userId) {
      const leagues = await fetch(`https://api.sleeper.app/v1/user/${state.userId}/leagues/nfl/${year}`).then(response => response.json());
      const histories = await Promise.all((leagues || []).map(async league => {
        const [rosters, users] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${league.league_id}/rosters`).then(response => response.json()),
          fetch(`https://api.sleeper.app/v1/league/${league.league_id}/users`).then(response => response.json())
        ]);
        const names = Object.fromEntries((users || []).map(user => [user.user_id, user.metadata?.team_name || user.display_name || "Manager"]));
        return (rosters || []).map(roster => {
          const settings = roster.settings || {};
          return {
            season: year, leagueName: league.name || `League ${league.league_id}`,
            manager: names[roster.owner_id] || `Team ${roster.roster_id}`,
            wins: Number(settings.wins) || 0, losses: Number(settings.losses) || 0, ties: Number(settings.ties) || 0,
            pointsFor: Number(settings.fpts || 0) + Number(settings.fpts_decimal || 0) / 100,
            pointsAgainst: Number(settings.fpts_against || 0) + Number(settings.fpts_against_decimal || 0) / 100
          };
        });
      }));
      histories.forEach(items => rows.push(...items));
    } else if (state.provider === "espn") {
      const histories = await Promise.all(state.leagues.map(async league => {
        try {
          const data = await fetchEspnLeague(league.leagueId, year);
          const memberNames = Object.fromEntries((data.members || []).map(member => [String(member.id), member.displayName || member.firstName || "Manager"]));
          return (data.teams || []).map(team => {
            const record = team.record?.overall || {};
            return {
              season: year, leagueName: data.settings?.name || league.name,
              manager: (team.owners || []).map(owner => memberNames[String(owner)] || "Manager").join(", "),
              wins: Number(record.wins) || 0, losses: Number(record.losses) || 0, ties: Number(record.ties) || 0,
              pointsFor: Number(record.pointsFor ?? team.points) || 0, pointsAgainst: Number(record.pointsAgainst ?? team.pointsAgainst) || 0
            };
          });
        } catch { return []; }
      }));
      histories.forEach(items => rows.push(...items));
    } else if (state.provider === "yahoo" && year === String(state.activeLeague?.season)) {
      rows.push(...state.managers.map(manager => ({
        season: year, leagueName: state.activeLeague.name, manager: manager.teamName,
        wins: manager.wins, losses: manager.losses, ties: manager.ties || 0, pointsFor: manager.pf, pointsAgainst: manager.pa
      })));
    }
    renderHistoricalRows(rows);
    if (meta) meta.textContent = `${rows.length} manager season record${rows.length === 1 ? "" : "s"} · ${year}`;
  } catch (error) {
    if (meta) meta.textContent = `Could not load ${year} history: ${error.message}`;
    renderHistoricalRows([]);
  }
}

function getPickemStorageKey() {
  return `fantasy-pickem-v1:${state.activeLeague?.provider || state.provider}:${state.activeLeague?.leagueId || "none"}:${state.activeLeague?.season || state.season}:${state.week}`;
}

function renderPickemChallenge() {
  const matchupSelect = document.getElementById("pickemMatchup");
  const winnerSelect = document.getElementById("pickemWinner");
  const status = document.getElementById("pickemStatus");
  const historyEl = document.getElementById("pickemHistory");
  if (!matchupSelect || !winnerSelect || !status || !historyEl) return;
  const games = getNormalizedCurrentMatchups();
  const savedKey = getPickemStorageKey();
  let saved = null;
  let allPicks = [];
  try {
    saved = JSON.parse(localStorage.getItem(savedKey) || "null");
    allPicks = JSON.parse(localStorage.getItem(`${savedKey.split(":").slice(0, 3).join(":")}:history`) || "[]");
  } catch {}
  const previousMatchup = matchupSelect.value || saved?.matchupId || "";
  matchupSelect.innerHTML = games.length
    ? games.map(game => `<option value="${draftEscapeHtml(game.id)}">${draftEscapeHtml(game.homeName)} vs ${draftEscapeHtml(game.awayName)}</option>`).join("")
    : `<option value="">No matchup data loaded</option>`;
  if (games.some(game => game.id === previousMatchup)) matchupSelect.value = previousMatchup;
  const selectedGame = games.find(game => game.id === matchupSelect.value);
  if (selectedGame) {
    const previousWinner = winnerSelect.value || (saved?.matchupId === selectedGame.id ? saved.winnerId : "");
    winnerSelect.innerHTML = `<option value="${draftEscapeHtml(selectedGame.homeId)}">${draftEscapeHtml(selectedGame.homeName)}</option><option value="${draftEscapeHtml(selectedGame.awayId)}">${draftEscapeHtml(selectedGame.awayName)}</option>`;
    if ([selectedGame.homeId, selectedGame.awayId].includes(String(previousWinner))) winnerSelect.value = previousWinner;
    else winnerSelect.value = selectedGame.homeId;
  } else winnerSelect.innerHTML = `<option value="">No teams</option>`;

  const currentSaved = saved && games.find(game => game.id === saved.matchupId);
  status.textContent = currentSaved
    ? `Saved pick: ${currentSaved.winnerId === currentSaved.homeId ? currentSaved.homeName : currentSaved.awayName} · current score ${currentSaved.homeScore.toFixed(1)}–${currentSaved.awayScore.toFixed(1)} (refresh as scores update)`
    : (games.length ? `Week ${state.week} · ${games.length} matchups loaded` : "No matchup data available for this provider/week.");
  historyEl.innerHTML = allPicks.slice(-8).reverse().map(pick => `<span class="pickem-result">W${pick.week}: ${draftEscapeHtml(pick.winnerName)} · ${draftEscapeHtml(pick.leagueName)}</span>`).join("");
}

function savePickemPrediction() {
  const game = getNormalizedCurrentMatchups().find(item => item.id === document.getElementById("pickemMatchup")?.value);
  const winnerId = document.getElementById("pickemWinner")?.value;
  if (!game || !winnerId) { const status = document.getElementById("pickemStatus"); if (status) status.textContent = "No matchup is available for a pick."; return; }
  const winnerName = String(winnerId) === game.homeId ? game.homeName : game.awayName;
  const key = getPickemStorageKey();
  const historyKey = `${key.split(":").slice(0, 3).join(":")}:history`;
  const pick = { week: state.week, matchupId: game.id, winnerId: String(winnerId), winnerName, leagueName: state.activeLeague?.name || "League", savedAt: Date.now() };
  try {
    localStorage.setItem(key, JSON.stringify(pick));
    const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
    const filtered = history.filter(item => !(item.week === state.week && item.matchupId === game.id));
    filtered.push(pick);
    localStorage.setItem(historyKey, JSON.stringify(filtered.slice(-50)));
  } catch {}
  renderPickemChallenge();
}

function generateWeeklyLeagueReport() {
  if (!state.activeLeague || !state.managers.length) return null;
  const games = getNormalizedCurrentMatchups();
  const leader = [...state.managers].sort((a, b) => (b.wins - a.wins) || (b.pf - a.pf))[0];
  const topScore = games.length ? Math.max(...games.flatMap(game => [game.homeScore, game.awayScore])) : 0;
  const closest = [...games].filter(game => game.homeScore > 0 || game.awayScore > 0).sort((a, b) => Math.abs(a.homeScore - a.awayScore) - Math.abs(b.homeScore - b.awayScore))[0];
  const actionCount = buildWeeklyRecommendations().length;
  const lines = [
    `${state.activeLeague.name} · Week ${state.week} Report`,
    `${state.activeLeague.season} season · ${state.activeLeague.totalTeams || state.managers.length} teams`,
    leader ? `Standings leader: ${leader.teamName} (${leader.wins}-${leader.losses}, ${leader.pf.toFixed(1)} points for).` : "Standings are not available.",
    topScore > 0 ? `Top matchup score so far: ${topScore.toFixed(1)} points.` : "Matchup scores are not available yet.",
    closest ? `Closest matchup so far: ${closest.homeName} ${closest.homeScore.toFixed(1)} – ${closest.awayScore.toFixed(1)} ${closest.awayName}.` : "No completed matchup scores are available yet.",
    `${actionCount} roster recommendations are available for the selected team.`
  ];
  const report = { title: `${state.activeLeague.name} Week ${state.week}`, lines, games, managers: [...state.managers].sort((a, b) => (b.wins - a.wins) || (b.pf - a.pf)).slice(0, 12) };
  state.weeklyReportText = lines.join("\n");
  const content = document.getElementById("weeklyReportContent");
  if (content) content.innerHTML = `<h4>${draftEscapeHtml(report.title)}</h4><ul>${lines.slice(2).map(line => `<li>${draftEscapeHtml(line)}</li>`).join("")}</ul>`;
  const meta = document.getElementById("weeklyReportMeta");
  if (meta) meta.textContent = `Generated ${new Date().toLocaleString()} · share or download this snapshot`;
  return report;
}

async function copyWeeklyReport() {
  const report = generateWeeklyLeagueReport();
  if (!report) return;
  try {
    await navigator.clipboard.writeText(state.weeklyReportText);
    setStatus("Weekly recap copied.");
  } catch {
    const helper = document.createElement("textarea");
    helper.value = state.weeklyReportText;
    document.body.appendChild(helper); helper.select();
    try { document.execCommand("copy"); } catch {}
    helper.remove();
    setStatus("Weekly recap ready to paste.");
  }
}

function downloadLeagueHome() {
  const report = generateWeeklyLeagueReport();
  if (!report) return;
  const rows = report.managers.map(manager => `<tr><td>${draftEscapeHtml(manager.teamName)}</td><td>${manager.wins}-${manager.losses}</td><td>${manager.pf.toFixed(1)}</td><td>${manager.pa.toFixed(1)}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${draftEscapeHtml(report.title)}</title><style>body{font:16px system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#17211c}h1{font-size:30px}p,li{line-height:1.6;color:#53615a}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{text-align:left;padding:10px;border-bottom:1px solid #d8e0dc}th{background:#eff4f1}</style></head><body><h1>${draftEscapeHtml(report.title)}</h1><ul>${report.lines.slice(2).map(line => `<li>${draftEscapeHtml(line)}</li>`).join("")}</ul><h2>Standings</h2><table><thead><tr><th>Manager</th><th>Record</th><th>Points for</th><th>Points against</th></tr></thead><tbody>${rows}</tbody></table><p>Generated by Fantasy Front Office.</p></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const link = document.createElement("a");
  link.href = url; link.download = `${state.activeLeague.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-week-${state.week}-report.html`;
  link.click(); URL.revokeObjectURL(url);
}

function getBasePositionSlotCounts(rosterPositions = []) {
  const positions = ["QB", "RB", "WR", "TE"];
  const counts = Object.fromEntries(positions.map(position => [position, 0]));
  rosterPositions.filter(slot => positions.includes(slot)).forEach(position => counts[position]++);
  return positions.some(position => counts[position]) ? counts : { QB: 1, RB: 2, WR: 2, TE: 1 };
}

function getManagerPositionCounts(manager) {
  const counts = { QB: 0, RB: 0, WR: 0, TE: 0 };
  (manager?.players || []).forEach(playerId => {
    const position = state.players[playerId]?.position;
    if (Object.hasOwn(counts, position)) counts[position]++;
  });
  return counts;
}

function buildOpponentAwareRecommendations(manager) {
  if (!manager || !state.activeLeague || state.managers.length < 2) return [];
  const requirements = getBasePositionSlotCounts(state.activeLeague.rosterPositions || []);
  const ownedCounts = getManagerPositionCounts(manager);
  const starters = new Set((manager.starters || []).map(String));
  const surplusPlayers = (manager.players || []).map(id => state.players[id]).filter(player => player && !player.isPick && !starters.has(String(player.id)) && ownedCounts[player.position] > requirements[player.position]);
  const profiles = new Map((state.managerTendencies || []).map(profile => [String(profile.rosterId), profile]));
  const results = [];
  state.managers.filter(opponent => String(opponent.rosterId) !== String(manager.rosterId)).forEach(opponent => {
    const counts = getManagerPositionCounts(opponent);
    const needs = Object.keys(requirements).map(position => ({ position, gap: requirements[position] - counts[position] })).filter(item => item.gap > 0).sort((a, b) => b.gap - a.gap);
    const need = needs.find(item => surplusPlayers.some(player => player.position === item.position));
    if (!need) return;
    const player = surplusPlayers.filter(item => item.position === need.position).sort((a, b) => (b.baseValue || 0) - (a.baseValue || 0))[0];
    if (!player) return;
    const profile = profiles.get(String(opponent.rosterId));
    const acquisitionMix = Object.entries(profile?.positions || {}).sort((a, b) => b[1] - a[1]);
    const positionAdds = Number(profile?.positions?.[need.position]) || 0;
    const acquisitionCount = Number(profile?.acquisitions) || 0;
    const behaviorFit = acquisitionCount ? positionAdds / acquisitionCount : 0;
    const behaviorBonus = Math.round(behaviorFit * 12) + Math.min(4, Number(profile?.trades) || 0);
    const recentLean = positionAdds
      ? ` Added ${positionAdds} ${need.position} player${positionAdds === 1 ? "" : "s"} in recent transactions.`
      : acquisitionMix[0] ? ` Recent acquisitions lean ${acquisitionMix[0][0]}.` : " Recent transaction history is unavailable.";
    results.push({
      priority: 46 + need.gap * 3 + behaviorBonus, level: "normal", type: "Trade fit", playerId: player.id,
      title: `Explore ${player.name} with ${opponent.teamName}`,
      detail: `${opponent.teamName} is short at ${need.position}; your roster has bench depth there.${recentLean}`,
      value: "Potential fit · verify return value", confidence: profile?.acquisitions >= 3 && behaviorFit >= 0.25 ? "Medium" : "Low",
      actionKind: "trade", opponentRosterId: String(opponent.rosterId)
    });
  });
  return results.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

function buildWeeklyRecommendations() {
  const managerIndex = parseInt(document.getElementById("teamSelect")?.value || "0", 10);
  const manager = state.managers[managerIndex];
  if (!manager) return [];
  const recommendations = [];
  const optimal = calcOptimalLineup(manager.players, false);
  optimal.slots.forEach((slot, index) => {
    const current = state.players[manager.starters[index]];
    const best = optimal.filled[index];
    if (!current || !best || current.id === best.id) return;
    const gain = (best.projectedPoints || 0) - (current.projectedPoints || 0);
    if (gain < 0.5) return;
    recommendations.push({
      priority: gain >= 5 ? 100 + gain : 65 + gain, level: gain >= 5 ? "urgent" : "high", confidence: gain >= 5 ? "Medium" : "Low", actionKind: "lineup",
      type: "Start / sit", playerId: best.id, title: `Start ${best.name} over ${current.name}`,
      comparisonPlayerId: current.id, projectedGain: gain, recommendedProjection: best.projectedPoints || 0,
      comparisonProjection: current.projectedPoints || 0, lineupSlot: slot,
      detail: `${slot} slot · estimated +${gain.toFixed(1)} points`, value: `+${gain.toFixed(1)} pts`
    });
  });

  manager.players.forEach(playerId => {
    const player = state.players[playerId];
    if (!player || player.isPick) return;
    if (["Out", "IR", "PUP", "Suspended"].includes(player.injuryStatus)) {
      recommendations.push({ priority: 94, level: "urgent", type: "Roster risk", playerId, title: `${player.name} is ${player.injuryStatus}`, detail: `${player.position} · ${player.team}`, value: "Review lineup", confidence: "High", actionKind: "lineup" });
    }
    if (player.byeWeek === state.week) {
      recommendations.push({ priority: 78, level: "high", type: "Bye week", playerId, title: `${player.name} is on bye`, detail: `${player.position} · Week ${state.week}`, value: "Find coverage", confidence: "High", actionKind: "lineup" });
    }
  });

  state.waiverTargets.slice(0, 5).forEach((player, index) => {
    recommendations.push({ priority: 55 - index, level: "normal", type: "Waiver", playerId: player.id, title: `Available: ${player.name}`, detail: `${player.position} · +${player.vorpScore.toFixed(1)} VORP`, value: `$${getSuggestedFaabBid(player)} bid`, confidence: "Low", actionKind: "waivers" });
  });

  const managerPlayerIds = new Set(manager.players);
  state.dbTrades.filter(trade => trade.src === "LEAGUE" && (trade.aIds.some(id => managerPlayerIds.has(id)) || trade.bIds.some(id => managerPlayerIds.has(id)))).slice(0, 3).forEach(trade => {
    const playerId = trade.aIds.find(id => managerPlayerIds.has(id)) || trade.bIds.find(id => managerPlayerIds.has(id));
    recommendations.push({ priority: 48, level: "normal", type: "Trade history", playerId, title: "Review a recent league trade", detail: trade.label, value: `${Math.round(Math.min(trade.aVal, trade.bVal))} value`, confidence: "Low", actionKind: "trade" });
  });
  recommendations.push(...buildOpponentAwareRecommendations(manager));
  return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 18);
}

function renderWeeklyRecommendations() {
  loadPlayerAlertState();
  const table = document.getElementById("recommendationTable");
  if (!table) return;
  const recommendations = buildWeeklyRecommendations();
  const meta = document.getElementById("recommendationMeta");
  if (meta) meta.textContent = `${recommendations.length} suggested action${recommendations.length === 1 ? "" : "s"} for the selected roster · Week ${state.week}`;
  table.innerHTML = `<thead><tr><th>Priority</th><th>Action</th><th>Impact</th><th></th></tr></thead><tbody></tbody>`;
  const body = table.querySelector("tbody");
  body.innerHTML = recommendations.length ? recommendations.map(item =>
    `<tr><td><span class="recommendation-priority ${item.level}">${draftEscapeHtml(item.type)}</span></td><td><div class="recommendation-action"><strong>${draftEscapeHtml(item.title)}</strong><span>${draftEscapeHtml(item.detail)}</span></div></td><td>${draftEscapeHtml(item.value)}</td><td>${item.playerId ? `<button class="btn-builder-action" type="button" data-watch-player="${draftEscapeHtml(item.playerId)}">${playerAlertState.watchlist.includes(item.playerId) ? "Watching" : "Watch"}</button>` : ""}</td></tr>`
  ).join("") : `<tr><td colspan="4" class="draft-empty">Connect a roster to build your weekly action queue.</td></tr>`;
}

function getTrackedPortfolioEntries() {
  return state.leagues.flatMap(league => {
    const cacheKey = `${league.provider}:${league.leagueId}`;
    const rosters = portfolioState.rostersByLeague.get(cacheKey) || [];
    const rosterId = state.portfolioRosterSelections[cacheKey];
    const roster = rosters.find(item => item.teamId === rosterId) || rosters[0];
    return roster ? [{ league, roster }] : [];
  });
}

function buildPortfolioPressureRecommendations() {
  const tracked = getTrackedPortfolioEntries();
  const exposures = new Map();
  tracked.forEach(({ league, roster }) => [...new Set(roster.players || [])].forEach(playerId => {
    const player = state.players[playerId];
    if (!player || player.isPick) return;
    if (!exposures.has(playerId)) exposures.set(playerId, { player, leagues: [] });
    exposures.get(playerId).leagues.push(league.name);
  }));
  const recommendations = [];
  exposures.forEach(({ player, leagues }) => {
    if (leagues.length < 2) return;
    const urgent = ["Out", "IR", "PUP", "Suspended"].includes(player.injuryStatus);
    const onBye = player.byeWeek === state.week;
    if (!urgent && !onBye && leagues.length / Math.max(1, tracked.length) < 0.6) return;
    recommendations.push({
      priority: urgent ? 106 : onBye ? 90 : 66 + leagues.length,
      level: urgent ? "urgent" : "high", type: "Portfolio exposure", playerId: player.id,
      title: urgent ? `${player.name} risk is concentrated` : (onBye ? `${player.name} is on bye across leagues` : `${player.name} is a shared portfolio anchor`),
      detail: `${leagues.length}/${tracked.length} tracked rosters · ${leagues.join(", ")}${urgent ? ` · ${player.injuryStatus}` : ""}`,
      value: urgent ? "Review every lineup" : (onBye ? "Check replacement coverage" : "Monitor shared exposure"),
      confidence: urgent || onBye ? "High" : "Medium", actionKind: "watch"
    });
  });

  tracked.forEach(({ league, roster }) => {
    const required = getBasePositionSlotCounts(roster.rosterPositions || league.rosterPositions || []);
    const counts = { QB: 0, RB: 0, WR: 0, TE: 0 };
    (roster.players || []).forEach(playerId => {
      const position = state.players[playerId]?.position;
      if (Object.hasOwn(counts, position)) counts[position]++;
    });
    Object.keys(required).forEach(position => {
      const gap = required[position] - counts[position];
      if (gap <= 0) return;
      recommendations.push({
        priority: 72 + gap * 4, level: gap > 1 ? "urgent" : "high", type: "Portfolio roster gap",
        title: `${league.name} needs ${position} depth`,
        detail: `${roster.name} has ${counts[position]} ${position} player${counts[position] === 1 ? "" : "s"} for ${required[position]} base starter slots.`,
        value: `Short ${gap}`, confidence: "Medium", actionKind: "waivers"
      });
    });
  });
  return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 8);
}

function readGmFeedback() {
  try {
    const records = JSON.parse(localStorage.getItem("fantasy-front-office:gm-feedback:v1") || "{}");
    return records && typeof records === "object" ? records : {};
  } catch { return {}; }
}

function readGmAdviceSnapshots() {
  try {
    const snapshots = JSON.parse(localStorage.getItem("fantasy-front-office:gm-advice-snapshots:v1") || "{}");
    return snapshots && typeof snapshots === "object" ? snapshots : {};
  } catch { return {}; }
}

function saveGmAdviceSnapshots(snapshots) {
  const entries = Object.entries(snapshots).sort((a, b) => Number(b[1].createdAt) - Number(a[1].createdAt)).slice(0, 500);
  try { localStorage.setItem("fantasy-front-office:gm-advice-snapshots:v1", JSON.stringify(Object.fromEntries(entries))); } catch {}
}

async function fetchSleeperNflState(forceRefresh = false) {
  if (!forceRefresh && sleeperNflStateCache.data && Date.now() - sleeperNflStateCache.checkedAt < 60000) return sleeperNflStateCache.data;
  const response = await fetch("https://api.sleeper.app/v1/state/nfl");
  if (!response.ok) throw new Error(`NFL state returned ${response.status}.`);
  const data = await response.json();
  sleeperNflStateCache = { data, checkedAt: Date.now() };
  return data;
}

function captureStartSitSnapshots(recommendations, nflState) {
  const league = state.activeLeague;
  if (!league || league.provider !== "sleeper" || !nflState || String(league.season) !== String(nflState.season) || Number(state.week) !== Number(nflState.week)) return;
  const snapshots = readGmAdviceSnapshots();
  const manager = state.managers[parseInt(document.getElementById("teamSelect")?.value || "0", 10)];
  let changed = false;
  recommendations.filter(item => item.type === "Start / sit" && item.playerId && item.comparisonPlayerId).forEach(item => {
    const key = getGmRecommendationKey(item);
    if (snapshots[key]) return;
    snapshots[key] = {
      key, leagueKey: getNewsletterLeagueKey(league), provider: league.provider,
      leagueId: league.leagueId, leagueName: league.name, season: String(league.season), week: Number(state.week),
      rosterId: String(manager?.rosterId || ""), managerName: manager?.teamName || "Roster",
      title: item.title, slot: item.lineupSlot || "Lineup", playerId: String(item.playerId),
      comparisonPlayerId: String(item.comparisonPlayerId), projectedGain: Number(item.projectedGain) || 0,
      recommendedProjection: Number(item.recommendedProjection) || 0, comparisonProjection: Number(item.comparisonProjection) || 0,
      createdAt: Date.now()
    };
    changed = true;
  });
  if (changed) saveGmAdviceSnapshots(snapshots);
}

async function fetchSleeperActualPoints(league, week, forceRefresh = false) {
  const cacheKey = `${league.provider}:${league.leagueId}:${league.season}:${week}`;
  if (!forceRefresh && gmOutcomeCache.has(cacheKey)) return gmOutcomeCache.get(cacheKey);
  const response = await fetch(`https://api.sleeper.app/v1/league/${league.leagueId}/matchups/${week}`);
  if (!response.ok) throw new Error(`Sleeper matchup scores returned ${response.status}.`);
  const rows = await response.json();
  const points = new Map();
  (rows || []).forEach(row => {
    (row.players || []).forEach(playerId => points.set(String(playerId), Number(row.players_points?.[playerId]) || 0));
    Object.entries(row.players_points || {}).forEach(([playerId, score]) => {
      if (Number.isFinite(Number(score))) points.set(String(playerId), Number(score));
    });
  });
  gmOutcomeCache.set(cacheKey, points);
  return points;
}

async function reconcileGmAdviceOutcomes(nflState, forceRefresh = false) {
  const snapshots = readGmAdviceSnapshots();
  if (!nflState) return snapshots;
  if (forceRefresh) gmOutcomeCache.clear();
  const pending = Object.values(snapshots).filter(snapshot => snapshot.provider === "sleeper" && !snapshot.evaluatedAt && (
    Number(snapshot.season) < Number(nflState.season) || (String(snapshot.season) === String(nflState.season) && Number(snapshot.week) < Number(nflState.week))
  ));
  const groups = new Map();
  pending.forEach(snapshot => {
    const league = state.leagues.find(item => item.provider === snapshot.provider && String(item.leagueId) === String(snapshot.leagueId) && String(item.season) === String(snapshot.season))
      || { provider: snapshot.provider, leagueId: snapshot.leagueId, season: snapshot.season };
    const key = `${league.provider}:${league.leagueId}:${league.season}:${snapshot.week}`;
    if (!groups.has(key)) groups.set(key, { league, week: snapshot.week, snapshots: [] });
    groups.get(key).snapshots.push(snapshot);
  });
  let changed = false;
  for (const { league, week, snapshots: weekSnapshots } of groups.values()) {
    try {
      const points = await fetchSleeperActualPoints(league, week, forceRefresh);
      weekSnapshots.forEach(snapshot => {
        if (!points.has(snapshot.playerId) || !points.has(snapshot.comparisonPlayerId)) return;
        snapshot.actualRecommended = points.get(snapshot.playerId);
        snapshot.actualComparison = points.get(snapshot.comparisonPlayerId);
        snapshot.actualGain = snapshot.actualRecommended - snapshot.actualComparison;
        snapshot.evaluatedAt = Date.now();
        changed = true;
      });
    } catch {}
  }
  if (changed) saveGmAdviceSnapshots(snapshots);
  return snapshots;
}

function renderGmOutcomeScorecard(snapshots, feedback, leagueKey) {
  const summary = document.getElementById("gmOutcomeSummary");
  const table = document.getElementById("gmOutcomeTable");
  const meta = document.getElementById("gmOutcomeMeta");
  if (!summary || !table) return;
  const records = Object.values(snapshots).filter(snapshot => snapshot.leagueKey === leagueKey).sort((a, b) => Number(b.week) - Number(a.week));
  const evaluated = records.filter(snapshot => snapshot.evaluatedAt);
  const accepted = evaluated.filter(snapshot => feedback[snapshot.key]?.status === "done");
  const avg = items => items.length ? items.reduce((sum, item) => sum + item.actualGain, 0) / items.length : null;
  const positiveRate = evaluated.length ? `${Math.round(evaluated.filter(item => item.actualGain > 0).length / evaluated.length * 100)}% positive` : "--";
  summary.innerHTML = [
    ["Evaluated", evaluated.length], ["Completed advice", accepted.length],
    ["Avg. actual edge", avg(accepted) === null ? "--" : `${avg(accepted) > 0 ? "+" : ""}${avg(accepted).toFixed(1)} pts`],
    ["Recommended move won", positiveRate]
  ].map(([label, value]) => `<div><span>${draftEscapeHtml(label)}</span><strong>${draftEscapeHtml(value)}</strong></div>`).join("");
  const pending = records.filter(snapshot => !snapshot.evaluatedAt).length;
  if (meta) meta.textContent = state.activeLeague?.provider === "sleeper"
    ? `${evaluated.length} completed-week result${evaluated.length === 1 ? "" : "s"} · ${pending} pending · actual scores use Sleeper league scoring`
    : "Actual player-score reconciliation is currently available for Sleeper leagues; other providers remain pending.";
  table.className = "gm-outcome-table";
  table.innerHTML = `<thead><tr><th>Week</th><th style="text-align:left;">Recommendation</th><th>Projected edge</th><th>Actual points</th><th>Actual edge</th><th>Status</th></tr></thead><tbody></tbody>`;
  const rows = records.slice(0, 12);
  table.querySelector("tbody").innerHTML = rows.length ? rows.map(snapshot => {
    const status = feedback[snapshot.key]?.status === "done" ? "Done" : feedback[snapshot.key]?.status === "dismissed" ? "Dismissed" : "Not completed";
    return `<tr><td>W${snapshot.week}</td><td class="gm-outcome-advice">${draftEscapeHtml(snapshot.title)}<small>${draftEscapeHtml(snapshot.managerName)} · ${draftEscapeHtml(snapshot.slot)}</small></td><td>+${Number(snapshot.projectedGain).toFixed(1)}</td><td>${snapshot.evaluatedAt ? `${Number(snapshot.actualRecommended).toFixed(1)} / ${Number(snapshot.actualComparison).toFixed(1)}` : "Pending"}</td><td>${snapshot.evaluatedAt ? `${snapshot.actualGain > 0 ? "+" : ""}${Number(snapshot.actualGain).toFixed(1)} pts` : "Pending"}</td><td>${snapshot.evaluatedAt ? `${status} · scored` : `${status} · awaiting final week`}</td></tr>`;
  }).join("") : `<tr><td colspan="6" class="draft-empty">Start/sit advice will be snapshotted while the Sleeper week is live, then scored after it closes.</td></tr>`;
}

function getGmRecommendationKey(item) {
  const manager = state.managers[parseInt(document.getElementById("teamSelect")?.value || "0", 10)];
  return [state.activeLeague?.provider, state.activeLeague?.leagueId, state.activeLeague?.season, state.week, manager?.rosterId, item.type, item.playerId, item.title].map(value => encodeURIComponent(String(value || ""))).join("|");
}

function getConfidenceLabel(item, feedback, leagueKey, snapshots) {
  if (item.type === "Start / sit") {
    const outcomes = Object.values(snapshots).filter(snapshot => snapshot.leagueKey === leagueKey && snapshot.evaluatedAt);
    if (outcomes.length >= 5) {
      const rate = outcomes.filter(snapshot => snapshot.actualGain > 0).length / outcomes.length;
      return `${rate >= 0.7 ? "High" : rate <= 0.35 ? "Low" : "Medium"} · ${outcomes.length} scored weeks`;
    }
    if (outcomes.length) return `${outcomes.length} actual result${outcomes.length === 1 ? "" : "s"}`;
  }
  const rated = Object.values(feedback).filter(record => record.leagueKey === leagueKey && record.type === item.type && typeof record.helpful === "boolean");
  if (rated.length >= 5) {
    const rate = rated.filter(record => record.helpful).length / rated.length;
    return `${rate >= 0.7 ? "High" : rate <= 0.35 ? "Low" : "Medium"} · ${rated.length} ratings`;
  }
  return `${item.confidence || "Low"} signal`;
}

async function renderGMInbox(forceRefresh = false) {
  const summary = document.getElementById("gmInboxSummary");
  const list = document.getElementById("gmInboxList");
  const completedList = document.getElementById("gmInboxCompleted");
  const pressureList = document.getElementById("portfolioPressureList");
  const meta = document.getElementById("gmInboxMeta");
  if (!summary || !list || !pressureList) return;
  if (!state.activeLeague || !state.managers.length) {
    summary.innerHTML = `<div><span>Active league</span><strong>Not connected</strong></div><div><span>Priority actions</span><strong>--</strong></div><div><span>Feedback record</span><strong>--</strong></div>`;
    list.innerHTML = `<p class="draft-empty">Connect a league to build your GM Inbox.</p>`;
    if (completedList) completedList.innerHTML = "";
    pressureList.innerHTML = `<p class="draft-empty">Connect or import leagues to compare portfolio pressure.</p>`;
    document.getElementById("gmOutcomeSummary").innerHTML = "";
    document.getElementById("gmOutcomeTable").innerHTML = `<tbody><tr><td class="draft-empty">Connect a league to track recommendation outcomes.</td></tr></tbody>`;
    document.getElementById("gmOutcomeMeta").textContent = "Actual player points are reconciled after the NFL week closes.";
    return;
  }
  if (forceRefresh) {
    portfolioState.rostersByLeague.clear();
    gmOutcomeCache.clear();
    sleeperNflStateCache = { data: null, checkedAt: 0 };
  }
  await Promise.all(state.leagues.map(league => getPortfolioLeagueRosters(league).catch(() => [])));
  const pressure = buildPortfolioPressureRecommendations();
  const weeklyRecommendations = buildWeeklyRecommendations();
  let nflState = null;
  if (state.activeLeague.provider === "sleeper") {
    try { nflState = await fetchSleeperNflState(forceRefresh); } catch {}
  }
  captureStartSitSnapshots(weeklyRecommendations, nflState);
  await reconcileGmAdviceOutcomes(nflState, forceRefresh);
  const adviceSnapshots = readGmAdviceSnapshots();
  const allRecommendations = [...weeklyRecommendations, ...pressure].sort((a, b) => b.priority - a.priority);
  const feedback = readGmFeedback();
  const leagueKey = getNewsletterLeagueKey();
  const activeRecommendations = allRecommendations.filter(item => !["done", "dismissed"].includes(feedback[getGmRecommendationKey(item)]?.status)).slice(0, 12);
  const closedRecommendations = allRecommendations.filter(item => ["done", "dismissed"].includes(feedback[getGmRecommendationKey(item)]?.status)).slice(0, 8);
  const leagueRecords = Object.values(feedback).filter(record => record.leagueKey === leagueKey);
  const completed = leagueRecords.filter(record => record.status === "done").length;
  const rated = leagueRecords.filter(record => typeof record.helpful === "boolean");
  const helpfulRate = rated.length ? `${Math.round(rated.filter(record => record.helpful).length / rated.length * 100)}% helpful · ${rated.length} ratings` : "No ratings yet";
  summary.innerHTML = [
    ["Active league", state.activeLeague.name], ["Priority actions", activeRecommendations.length],
    ["Completed", completed], ["Your feedback", helpfulRate]
  ].map(([label, value]) => `<div><span>${draftEscapeHtml(label)}</span><strong>${draftEscapeHtml(value)}</strong></div>`).join("");
  if (meta) meta.textContent = `${activeRecommendations.length} open recommendations · Week ${state.week} · confidence updates after 5 ratings per category`;
  renderGmOutcomeScorecard(adviceSnapshots, feedback, leagueKey);
  if (pressure.length) {
    const injuryCount = pressure.filter(item => item.title.includes("risk is concentrated")).length;
    const byeCount = pressure.filter(item => item.title.includes("on bye across leagues")).length;
    const gapCount = pressure.filter(item => item.type === "Portfolio roster gap").length;
    const counts = [`${injuryCount} concentrated injury risk${injuryCount === 1 ? "" : "s"}`, `${byeCount} shared bye conflict${byeCount === 1 ? "" : "s"}`, `${gapCount} roster depth gap${gapCount === 1 ? "" : "s"}`].filter((label, index) => [injuryCount, byeCount, gapCount][index] > 0);
    pressureList.innerHTML = `<div class="portfolio-pressure-summary"><strong>${pressure.length} portfolio signal${pressure.length === 1 ? "" : "s"}</strong><span>${draftEscapeHtml(counts.join(" · "))}</span><small>${draftEscapeHtml(pressure.slice(0, 3).map(item => item.title).join(" · "))}</small></div>`;
  } else pressureList.innerHTML = `<p class="draft-empty">No cross-league concentration or base-position gaps detected in the tracked rosters.</p>`;
  const renderAction = (item, isClosed) => {
    const key = getGmRecommendationKey(item);
    const record = feedback[key] || {};
    const action = item.actionKind || (item.type === "Waiver" ? "waivers" : item.type.toLowerCase().includes("trade") ? "trade" : "lineup");
    const confidence = getConfidenceLabel(item, feedback, leagueKey, adviceSnapshots);
    const controls = record.status === "done"
      ? `<span class="gm-action-state">Done</span><button type="button" class="btn-builder-action" data-gm-feedback="true" data-gm-type="${draftEscapeHtml(item.type)}" data-gm-value="1" data-gm-id="${draftEscapeHtml(key)}">Helpful</button><button type="button" class="btn-builder-action" data-gm-feedback="true" data-gm-type="${draftEscapeHtml(item.type)}" data-gm-value="0" data-gm-id="${draftEscapeHtml(key)}">Missed</button>`
      : record.status === "dismissed"
        ? `<span class="gm-action-state">Dismissed</span><button type="button" class="btn-builder-action" data-gm-state="open" data-gm-id="${draftEscapeHtml(key)}">Reopen</button>`
        : `<button type="button" class="btn-builder-action" data-gm-state="done" data-gm-type="${draftEscapeHtml(item.type)}" data-gm-id="${draftEscapeHtml(key)}">Mark done</button><button type="button" class="btn-builder-action" data-gm-state="dismissed" data-gm-type="${draftEscapeHtml(item.type)}" data-gm-id="${draftEscapeHtml(key)}">Dismiss</button>`;
    const tradeData = action === "trade" ? `data-gm-opponent="${draftEscapeHtml(item.opponentRosterId || "")}"` : "";
    const review = `<button type="button" data-gm-open="${draftEscapeHtml(action)}" data-gm-player="${draftEscapeHtml(item.playerId || "")}" ${tradeData}>${action === "trade" ? "Build trade" : action === "waivers" ? "Review waivers" : action === "watch" ? "Watch player" : action === "portfolio" ? "Review portfolio" : "Review lineup"}</button>`;
    return `<article class="gm-action-card ${item.level || "normal"}"><div class="gm-action-topline"><span class="recommendation-priority ${item.level || "normal"}">${draftEscapeHtml(item.type)}</span><span class="gm-confidence">${draftEscapeHtml(confidence)}</span><span class="gm-action-value">${draftEscapeHtml(item.value || "Review")}</span></div><h3>${draftEscapeHtml(item.title)}</h3><p>${draftEscapeHtml(item.detail)}</p><div class="gm-action-controls">${isClosed ? "" : review}${controls}</div></article>`;
  };
  list.innerHTML = activeRecommendations.length ? activeRecommendations.map(item => renderAction(item, false)).join("") : `<p class="draft-empty">No open recommendations for this roster right now.</p>`;
  if (completedList) completedList.innerHTML = closedRecommendations.length ? closedRecommendations.map(item => renderAction(item, true)).join("") : `<p class="draft-empty">No completed or dismissed actions this week.</p>`;
}

function handleGMInboxClick(event) {
  const feedbackButton = event.target.closest("[data-gm-feedback]");
  const stateButton = event.target.closest("[data-gm-state]");
  const actionButton = event.target.closest("[data-gm-open]");
  if (feedbackButton || stateButton) {
    const key = (feedbackButton || stateButton).dataset.gmId;
    const records = readGmFeedback();
    const existing = records[key] || {};
    if (feedbackButton) records[key] = { ...existing, type: feedbackButton.dataset.gmType || existing.type, helpful: feedbackButton.dataset.gmValue === "1", ratedAt: Date.now() };
    else records[key] = { ...existing, status: stateButton.dataset.gmState, leagueKey: getNewsletterLeagueKey(), type: stateButton.dataset.gmType || existing.type || "Other", week: state.week, updatedAt: Date.now() };
    try { localStorage.setItem("fantasy-front-office:gm-feedback:v1", JSON.stringify(records)); } catch {}
    renderGMInbox();
    return;
  }
  if (!actionButton) return;
  const action = actionButton.dataset.gmOpen;
  const playerId = actionButton.dataset.gmPlayer;
  if (action === "watch" && playerId) { togglePlayerWatch(playerId); renderGMInbox(); return; }
  if (action === "trade") {
    const ownIndex = state.managers.findIndex(manager => String(manager.rosterId) === String(state.managers[parseInt(document.getElementById("teamSelect")?.value || "0", 10)]?.rosterId));
    const opponentIndex = state.managers.findIndex(manager => String(manager.rosterId) === actionButton.dataset.gmOpponent);
    if (ownIndex >= 0) document.getElementById("tradeTeamA").value = String(ownIndex);
    if (opponentIndex >= 0) document.getElementById("tradeTeamB").value = String(opponentIndex);
    state.tradeSideA = playerId ? [playerId] : [];
    state.tradeSideB = [];
    renderTradeBuilderSide(true); renderTradeBuilderSide(false); updateTradeEvaluation();
    document.querySelector('.nav-btn[data-tab="tab-trade"]')?.click();
    return;
  }
  const targetTab = action === "waivers" ? "tab-waiver" : action === "portfolio" ? "tab-intel" : "tab-opt";
  document.querySelector(`.nav-btn[data-tab="${targetTab}"]`)?.click();
}

function getPortfolioPlayerPoints(player, league) {
  const stats = state.rawStats[player.id];
  const receptionPoints = Number(league.scoringSettings?.rec ?? 1);
  const statsKey = receptionPoints >= 0.9 ? "pts_ppr" : (receptionPoints >= 0.4 ? "pts_half_ppr" : "pts_std");
  const games = Math.max(1, Number(stats?.gp || stats?.gms_active || 1));
  if (Number.isFinite(Number(stats?.[statsKey]))) {
    let points = Number(stats[statsKey]) / games;
    const teBonus = Number(league.scoringSettings?.bonus_rec_te || 0);
    if (player.position === "TE" && teBonus) points += (Number(stats.rec || 0) / games) * teBonus;
    return points;
  }
  const activeReceptionPoints = Number(state.activeLeague?.scoringSettings?.rec ?? 1);
  const receptionDelta = receptionPoints - activeReceptionPoints;
  return Number(player.projectedPoints || player.seasonPpg || 0) + receptionDelta * Number(player.receptionsPerGame || 0);
}

function getPortfolioStarterSlots(roster, position) {
  const positions = roster.rosterPositions || [];
  const slots = positions.length ? positions.filter(slot => !["BN", "IR", "TAXI"].includes(slot)) : ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"];
  return slots.filter(slot => isPosEligible(position, slot)).length;
}

function renderPortfolioMoveComparison() {
  const select = document.getElementById("portfolioMovePlayer");
  const table = document.getElementById("portfolioMoveTable");
  if (!select || !table) return;
  const candidates = Object.values(state.players)
    .filter(player => !player.isPick && player.isCurrentNfl && ["QB", "RB", "WR", "TE", "K", "DEF"].includes(player.position))
    .sort((a, b) => ((b.vorpScore || 0) - (a.vorpScore || 0)) || ((b.projectedPoints || 0) - (a.projectedPoints || 0)))
    .slice(0, 300);
  const selectedId = select.value;
  select.innerHTML = `<option value="">Choose a player</option>${candidates.map(player => `<option value="${draftEscapeHtml(player.id)}">${draftEscapeHtml(player.name)} · ${draftEscapeHtml(player.position)} · ${draftEscapeHtml(player.team || "FA")}</option>`).join("")}`;
  if (candidates.some(player => player.id === selectedId)) select.value = selectedId;
  table.innerHTML = `<thead><tr><th style="text-align:left;">League / roster</th><th>Availability</th><th>Position need</th><th>Estimated PPG</th><th>Pickup outlook</th></tr></thead><tbody></tbody>`;
  const body = table.querySelector("tbody");
  const player = state.players[select.value];
  if (!player) { body.innerHTML = `<tr><td colspan="5" class="draft-empty">Select a player to compare the move across your leagues.</td></tr>`; return; }

  const results = state.leagues.map(league => {
    const cacheKey = `${league.provider}:${league.leagueId}`;
    const rosters = portfolioState.rostersByLeague.get(cacheKey) || [];
    const rosterId = state.portfolioRosterSelections[cacheKey];
    const roster = rosters.find(item => item.teamId === rosterId) || rosters[0];
    if (!roster) return { league, roster: null, status: "Roster unavailable" };
    const owner = rosters.find(item => item.players.includes(player.id));
    if (owner) return { league, roster, status: owner.teamId === roster.teamId ? "Already on your roster" : `Rostered by ${owner.name}`, outlook: "Unavailable", points: getPortfolioPlayerPoints(player, league) };
    const ownedAtPosition = roster.players.map(id => state.players[id]).filter(item => item && !item.isPick && item.position === player.position);
    const starterSlots = getPortfolioStarterSlots(roster, player.position);
    const need = Math.max(0, starterSlots - ownedAtPosition.length);
    const replacement = ownedAtPosition.map(item => getPortfolioPlayerPoints(item, league)).sort((a, b) => a - b)[Math.max(0, ownedAtPosition.length - starterSlots)] || 0;
    const points = getPortfolioPlayerPoints(player, league);
    const impact = Math.max(0, points - replacement);
    return { league, roster, status: "Available", need: need ? `Starter need (${need})` : "Depth", points, impact, outlook: need ? "Priority add" : impact >= 8 ? "Useful depth" : "Low priority" };
  });
  body.innerHTML = results.map(result => result.roster
    ? `<tr><td>${draftEscapeHtml(result.league.name)} · ${draftEscapeHtml(result.roster.name)}</td><td>${draftEscapeHtml(result.status)}</td><td>${draftEscapeHtml(result.need || "--")}</td><td>${result.points === undefined ? "--" : result.points.toFixed(1)}</td><td>${draftEscapeHtml(result.outlook || "--")}${result.impact ? ` · +${result.impact.toFixed(1)}` : ""}</td></tr>`
    : `<tr><td>${draftEscapeHtml(result.league.name)}</td><td colspan="4">${draftEscapeHtml(result.status)}</td></tr>`
  ).join("");
}

function loadPlayerAlertState() {
  if (playerAlertState.loaded) return;
  playerAlertState.loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem("fantasy-front-office:player-alerts") || "null");
    if (saved && typeof saved === "object") {
      playerAlertState.watchlist = Array.isArray(saved.watchlist) ? saved.watchlist : [];
      playerAlertState.events = Array.isArray(saved.events) ? saved.events : [];
      playerAlertState.snapshots = saved.snapshots && typeof saved.snapshots === "object" ? saved.snapshots : {};
    }
  } catch {}
}

function savePlayerAlertState() {
  try {
    localStorage.setItem("fantasy-front-office:player-alerts", JSON.stringify({
      watchlist: playerAlertState.watchlist, events: playerAlertState.events, snapshots: playerAlertState.snapshots
    }));
  } catch {}
}

function getWatchedPlayerKey(playerId) {
  return `${state.activeLeague?.provider || state.provider}:${state.activeLeague?.leagueId || "none"}:${playerId}`;
}

function scanPlayerAlertChanges() {
  loadPlayerAlertState();
  if (!state.activeLeague) { renderPlayerAlerts(); return; }
  const severity = { Healthy: 0, Questionable: 1, Doubtful: 2, Out: 3, IR: 3, PUP: 3, Suspended: 3 };
  const rosteredIds = new Set(state.managers.flatMap(manager => manager.players));
  playerAlertState.watchlist.forEach(playerId => {
    const player = state.players[playerId];
    if (!player) return;
    const key = getWatchedPlayerKey(playerId);
    const next = { injuryStatus: player.injuryStatus || "Healthy", rostered: rosteredIds.has(playerId), checkedAt: Date.now() };
    const previous = playerAlertState.snapshots[key];
    if (previous && (severity[next.injuryStatus] || 0) > (severity[previous.injuryStatus] || 0)) {
      const event = { id: `${key}:injury:${next.injuryStatus}:${Date.now()}`, playerId, title: `${player.name}: ${next.injuryStatus}`, detail: `Injury status changed from ${previous.injuryStatus} · ${state.activeLeague.name}`, level: next.injuryStatus === "Questionable" ? "high" : "urgent", createdAt: Date.now() };
      playerAlertState.events.unshift(event);
      if (window.Notification?.permission === "granted") new Notification("Fantasy Front Office alert", { body: event.title });
    }
    if (previous?.rostered && !next.rostered) {
      const event = { id: `${key}:available:${Date.now()}`, playerId, title: `${player.name} became available`, detail: `No longer on a roster in ${state.activeLeague.name}`, level: "normal", createdAt: Date.now() };
      playerAlertState.events.unshift(event);
      if (window.Notification?.permission === "granted") new Notification("Fantasy Front Office alert", { body: event.title });
    }
    playerAlertState.snapshots[key] = next;
  });
  playerAlertState.events = playerAlertState.events.slice(0, 30);
  savePlayerAlertState();
  renderPlayerAlerts();
}

function togglePlayerWatch(playerId) {
  loadPlayerAlertState();
  const index = playerAlertState.watchlist.indexOf(playerId);
  if (index >= 0) playerAlertState.watchlist.splice(index, 1);
  else {
    const player = state.players[playerId];
    if (!player) return;
    playerAlertState.watchlist.push(playerId);
    if (state.activeLeague) playerAlertState.snapshots[getWatchedPlayerKey(playerId)] = {
      injuryStatus: player.injuryStatus || "Healthy",
      rostered: state.managers.some(manager => manager.players.includes(playerId)),
      checkedAt: Date.now()
    };
  }
  savePlayerAlertState();
  renderPlayerAlerts();
  renderWeeklyRecommendations();
}

function renderPlayerAlerts() {
  const selector = document.getElementById("alertPlayerSelect");
  const feed = document.getElementById("playerAlertFeed");
  const watchlist = document.getElementById("playerWatchlist");
  const permissionStatus = document.getElementById("alertPermissionStatus");
  if (!selector || !feed || !watchlist) return;
  loadPlayerAlertState();
  const watched = new Set(playerAlertState.watchlist);
  const candidates = Object.values(state.players).filter(player => !player.isPick && player.isCurrentNfl && !watched.has(player.id)).sort((a, b) => (b.baseValue || 0) - (a.baseValue || 0)).slice(0, 300);
  const selected = selector.value;
  selector.innerHTML = `<option value="">Choose a player to watch</option>${candidates.map(player => `<option value="${draftEscapeHtml(player.id)}">${draftEscapeHtml(player.name)} · ${draftEscapeHtml(player.position)} · ${draftEscapeHtml(player.team || "FA")}</option>`).join("")}`;
  if (candidates.some(player => player.id === selected)) selector.value = selected;
  feed.innerHTML = playerAlertState.events.length ? playerAlertState.events.slice(0, 12).map(event =>
    `<div class="player-alert-item ${event.level}"><div><strong>${draftEscapeHtml(event.title)}</strong><span>${draftEscapeHtml(event.detail)} · ${new Date(event.createdAt).toLocaleString()}</span></div><button class="player-alert-remove" data-dismiss-alert="${draftEscapeHtml(event.id)}" type="button">Dismiss</button></div>`
  ).join("") : `<div class="draft-empty">No new watchlist alerts.</div>`;
  watchlist.innerHTML = playerAlertState.watchlist.length ? playerAlertState.watchlist.map(playerId => {
    const player = state.players[playerId];
    const snapshot = playerAlertState.snapshots[getWatchedPlayerKey(playerId)];
    return `<div class="player-watch-item"><div><strong>${draftEscapeHtml(player?.name || playerId)}</strong><span>${draftEscapeHtml(player?.position || "")} · ${draftEscapeHtml(player?.injuryStatus || "Unknown status")}${snapshot?.rostered ? " · Rostered" : " · Available"}</span></div><button class="player-alert-remove" data-remove-watch="${draftEscapeHtml(playerId)}" type="button">Unwatch</button></div>`;
  }).join("") : `<div class="draft-empty">No players watched yet.</div>`;
  if (permissionStatus) permissionStatus.textContent = window.Notification
    ? `In-app alerts are on · Browser notifications ${Notification.permission === "granted" ? "enabled" : "optional"}`
    : "In-app injury and availability alerts · Browser notifications unavailable in this browser";
}

async function enablePlayerBrowserAlerts() {
  const status = document.getElementById("alertPermissionStatus");
  if (!window.Notification) { if (status) status.textContent = "Browser notifications are unavailable in this browser."; return; }
  const permission = await Notification.requestPermission();
  if (status) status.textContent = permission === "granted" ? "Browser notifications enabled." : "Browser notifications not enabled; in-app alerts remain on.";
}

async function renderLeagueIntelTab(forceRefresh = false) {
  populateHistorySeasonOptions();
  const selectors = document.getElementById("portfolioRosterSelectors");
  const exposureTable = document.getElementById("portfolioExposureTable");
  const byeTable = document.getElementById("portfolioByeTable");
  const tendencyTable = document.getElementById("managerTendencyTable");
  if (!selectors || !exposureTable || !byeTable || !tendencyTable) return;
  if (!Object.keys(state.portfolioRosterSelections).length) {
    try { state.portfolioRosterSelections = JSON.parse(localStorage.getItem("fantasy-front-office:portfolio-rosters") || "{}"); } catch {}
  }
  if (forceRefresh) portfolioState.rostersByLeague.clear();
  if (!state.leagues.length) {
    selectors.innerHTML = `<div class="draft-empty">Connect an account or import a league to compare rosters.</div>`;
    exposureTable.innerHTML = `<tbody><tr><td class="draft-empty">No league data loaded.</td></tr></tbody>`;
    byeTable.innerHTML = `<tbody><tr><td class="draft-empty">No league data loaded.</td></tr></tbody>`;
    tendencyTable.innerHTML = `<tbody><tr><td class="draft-empty">No active league selected.</td></tr></tbody>`;
    renderWeeklyRecommendations();
    renderPortfolioMoveComparison();
    renderPlayerAlerts();
    renderHistoricalRows([]);
    renderWeeklyLeagueReport();
    renderPickemChallenge();
    return;
  }

  const meta = document.getElementById("portfolioMeta");
  if (meta) meta.textContent = "Loading rosters across connected leagues...";
  const results = await Promise.all(state.leagues.map(async league => {
    try { return { league, rosters: await getPortfolioLeagueRosters(league) }; }
    catch (error) { return { league, rosters: [], error }; }
  }));
  const available = results.filter(result => result.rosters.length);
  if (meta) meta.textContent = `${available.length} of ${state.leagues.length} connected leagues have roster data. Select your roster in each league.`;

  selectors.innerHTML = available.map(({ league, rosters }) => {
    const key = `${league.provider}:${league.leagueId}`;
    const preferred = rosters.find(roster => league.provider === "sleeper" && roster.ownerId === String(state.userId)) || rosters[0];
    const selected = state.portfolioRosterSelections[key] || preferred.teamId;
    state.portfolioRosterSelections[key] = selected;
    return `<label>${draftEscapeHtml(league.name)}<select data-portfolio-league="${draftEscapeHtml(key)}">${rosters.map(roster => `<option value="${draftEscapeHtml(roster.teamId)}" ${roster.teamId === selected ? "selected" : ""}>${draftEscapeHtml(roster.name)}</option>`).join("")}</select></label>`;
  }).join("");

  const exposure = new Map();
  const trackedRosters = [];
  available.forEach(({ league, rosters }) => {
    const key = `${league.provider}:${league.leagueId}`;
    const roster = rosters.find(item => item.teamId === state.portfolioRosterSelections[key]);
    if (!roster) return;
    trackedRosters.push({ league, roster });
    [...new Set(roster.players)].forEach(playerId => {
      const player = state.players[playerId];
      if (!player || player.isPick) return;
      if (!exposure.has(playerId)) exposure.set(playerId, { player, leagues: [] });
      exposure.get(playerId).leagues.push(league.name);
    });
  });
  const exposureRows = [...exposure.values()].sort((a, b) => (b.leagues.length - a.leagues.length) || ((b.player.baseValue || 0) - (a.player.baseValue || 0)));
  const summary = document.getElementById("portfolioSummary");
  if (summary) summary.innerHTML = [
    ["Tracked leagues", trackedRosters.length],
    ["Unique players", exposure.size],
    ["Highest exposure", exposureRows[0] ? `${exposureRows[0].player.name} · ${exposureRows[0].leagues.length}/${trackedRosters.length}` : "--"]
  ].map(([label, value]) => `<div><span>${label}</span><strong>${draftEscapeHtml(value)}</strong></div>`).join("");

  exposureTable.className = "portfolio-table";
  exposureTable.innerHTML = `<thead><tr><th style="text-align:left;">Player</th><th>Pos</th><th>NFL team</th><th>Exposure</th><th>Leagues</th></tr></thead><tbody></tbody>`;
  const exposureBody = exposureTable.querySelector("tbody");
  if (exposureRows.length) exposureBody.innerHTML = exposureRows.slice(0, 60).map(({ player, leagues }) =>
    `<tr><td>${draftEscapeHtml(player.name)}</td><td>${draftEscapeHtml(player.position)}</td><td>${draftEscapeHtml(player.team || "FA")}</td><td>${leagues.length}/${trackedRosters.length}</td><td>${draftEscapeHtml(leagues.join(", "))}</td></tr>`
  ).join("");
  else exposureBody.innerHTML = `<tr><td colspan="5" class="draft-empty">Choose a roster with player data to see exposure.</td></tr>`;

  const byWeek = new Map();
  exposureRows.forEach(({ player, leagues }) => {
    if (!player.byeWeek) return;
    if (!byWeek.has(player.byeWeek)) byWeek.set(player.byeWeek, { players: [], leagues: new Set() });
    const item = byWeek.get(player.byeWeek);
    item.players.push(player.name);
    leagues.forEach(name => item.leagues.add(name));
  });
  byeTable.innerHTML = `<thead><tr><th>Bye week</th><th>Rostered players</th><th>Affected leagues</th><th>Players</th></tr></thead><tbody></tbody>`;
  const byeBody = byeTable.querySelector("tbody");
  const byeRows = [...byWeek.entries()].sort((a, b) => b[1].players.length - a[1].players.length);
  byeBody.innerHTML = byeRows.length ? byeRows.map(([week, item]) =>
    `<tr><td>Week ${week}</td><td>${item.players.length}</td><td>${item.leagues.size}</td><td>${draftEscapeHtml(item.players.join(", "))}</td></tr>`
  ).join("") : `<tr><td colspan="4" class="draft-empty">No bye-week data for these rosters.</td></tr>`;

  const tendencies = state.managerTendencies || [];
  const tendencyMeta = document.getElementById("tendencyMeta");
  if (tendencyMeta) tendencyMeta.textContent = state.activeLeague?.provider === "espn"
    ? "Transaction and draft tendencies use history included by ESPN for the connected league."
    : "Recent completed acquisitions, trades, and draft picks in the active league.";
  tendencyTable.innerHTML = `<thead><tr><th style="text-align:left;">Manager</th><th>Acquisitions</th><th>Trades</th><th>Most acquired</th><th>Position mix</th><th>Draft picks</th><th>Draft position mix</th></tr></thead><tbody></tbody>`;
  const tendencyBody = tendencyTable.querySelector("tbody");
  const tendencyRows = tendencies.map(profile => {
    const manager = state.managers.find(item => String(item.rosterId) === String(profile.rosterId));
    const sortedPositions = Object.entries(profile.positions).sort((a, b) => b[1] - a[1]);
    const draftMix = Object.entries(profile.draftPositions || {}).sort((a, b) => b[1] - a[1]);
    return { profile, name: manager?.teamName || `Team ${profile.rosterId}`, top: sortedPositions[0]?.[0] || "--", mix: sortedPositions.map(([position, count]) => `${position} ${count}`).join(" · ") || "--", draftMix: draftMix.map(([position, count]) => `${position} ${count}`).join(" · ") || "--" };
  }).sort((a, b) => (b.profile.acquisitions - a.profile.acquisitions));
  tendencyBody.innerHTML = tendencyRows.length ? tendencyRows.map(({ profile, name, top, mix, draftMix }) =>
    `<tr><td>${draftEscapeHtml(name)}</td><td>${profile.acquisitions}</td><td>${profile.trades}</td><td class="tendency-position">${draftEscapeHtml(top)}</td><td>${draftEscapeHtml(mix)}</td><td>${profile.draftPicks || 0}</td><td>${draftEscapeHtml(draftMix)}</td></tr>`
  ).join("") : `<tr><td colspan="7" class="draft-empty">No transaction or draft history available for the active league yet.</td></tr>`;
  renderWeeklyRecommendations();
  renderPortfolioMoveComparison();
  renderPlayerAlerts();
  renderWeeklyLeagueReport();
  renderPickemChallenge();
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
    grid.innerHTML = `<div class="card-banner" style="grid-column:1 / -1; text-align:center; padding:28px;"><div style="font-size:14px; font-weight:800;">Connect a league to simulate its playoff bracket</div><div style="font-size:12px; color:var(--text-muted); margin-top:4px;">League settings determine playoff team count, start week, and seeding rules.</div></div>`;
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
        <div class="champ-callout"><div style="font-size:10px;font-weight:800;color:var(--good);letter-spacing:0.8px;">PROJECTED ${state.season} LEAGUE CHAMPION</div><div style="font-size:17px;font-weight:900;margin-top:4px;">#${champ.winner.seed} ${champ.winner.teamName.split(" (")[0]}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Finals Projection: <b style="color:var(--good);">${(champ.winner.roundScores[1] || 0).toFixed(2)} pts</b> • Core: ${champ.winner.coreNames}</div></div>
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
        <div class="champ-callout"><div style="font-size:10px;font-weight:800;color:var(--good);letter-spacing:0.8px;">PROJECTED ${state.season} LEAGUE CHAMPION</div><div style="font-size:17px;font-weight:900;margin-top:4px;">#${champ.winner.seed} ${champ.winner.teamName.split(" (")[0]}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Finals Projection: <b style="color:var(--good);">${(champ.winner.roundScores[2] || 0).toFixed(2)} pts</b> • Core: ${champ.winner.coreNames}</div></div>
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

function draftEscapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
}

function updateDraftSlotOptions() {
  const teamsInput = document.getElementById("draftTeams");
  const slotSelect = document.getElementById("draftSlot");
  if (!teamsInput || !slotSelect) return;
  const teams = Math.min(32, Math.max(4, parseInt(teamsInput.value, 10) || draftState.settings.teams));
  const selectedSlot = parseInt(slotSelect.value, 10) || draftState.settings.slot;
  slotSelect.innerHTML = Array.from({ length: teams }, (_, index) => {
    const slot = index + 1;
    return `<option value="${slot}">Pick ${slot}</option>`;
  }).join("");
  slotSelect.value = String(Math.min(teams, Math.max(1, selectedSlot)));
}

function updateDraftTypeSettings() {
  const type = document.getElementById("draftType")?.value || "redraft";
  const keeperPanel = document.getElementById("draftKeeperPanel");
  const dynastySettings = document.getElementById("draftDynastySettings");
  const keeperSettings = document.getElementById("draftKeeperSettings");
  const keeperYearsSettings = document.getElementById("draftKeeperYearsSettings");
  if (dynastySettings) dynastySettings.hidden = type !== "dynasty";
  if (keeperSettings) keeperSettings.hidden = type !== "keeper";
  if (keeperYearsSettings) keeperYearsSettings.hidden = type !== "keeper";
  if (keeperPanel) keeperPanel.hidden = type !== "keeper";
}

function getDraftSessionKey() {
  const season = state.activeLeague?.season || state.season || DEFAULT_SEASON;
  const leagueId = state.activeLeague?.leagueId || "custom";
  return `fantasy-draft-v1:${state.activeLeague?.provider || state.provider}:${season}:${leagueId}`;
}

function saveDraftSession() {
  const key = getDraftSessionKey();
  try {
    localStorage.setItem(key, JSON.stringify({
      settings: draftState.settings,
      userPicks: draftState.userPicks,
      adpByName: draftState.adpByName,
      keepers: draftState.keepers,
      savedAt: Date.now()
    }));
    draftState.loadedSessionKey = key;
    const notice = document.getElementById("draftNotice");
    if (notice) notice.textContent = "Draft saved on this device.";
  } catch {
    const notice = document.getElementById("draftNotice");
    if (notice) notice.textContent = "Draft could not be saved in this browser.";
  }
}

function restoreDraftSession() {
  const key = getDraftSessionKey();
  if (draftState.loadedSessionKey === key) return;
  draftState.loadedSessionKey = key;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (!saved || typeof saved !== "object") {
      const notice = document.getElementById("draftNotice");
      if (notice) notice.textContent = "Opponent picks before your slot are simulated; your draft is still waiting for your first pick.";
      return;
    }
    draftState.settings = { ...draftState.settings, ...(saved.settings || {}) };
    draftState.userPicks = Array.isArray(saved.userPicks) ? saved.userPicks : [];
    draftState.adpByName = saved.adpByName && typeof saved.adpByName === "object" ? saved.adpByName : {};
    draftState.keepers = Array.isArray(saved.keepers) ? saved.keepers : [];
    const controls = {
      draftType: draftState.settings.type, draftTeams: draftState.settings.teams,
      draftSlot: draftState.settings.slot, draftRounds: draftState.settings.rounds,
      draftScoring: draftState.settings.scoring, draftRosterFormat: draftState.settings.rosterFormat,
      draftOpponentStrategy: draftState.settings.opponentStrategy || "adp",
      draftDynastyYears: draftState.settings.dynastyYears, draftKeeperSlots: draftState.settings.keeperSlots,
      draftKeeperYears: draftState.settings.keeperYears
    };
    Object.entries(controls).forEach(([id, value]) => {
      const control = document.getElementById(id);
      if (control && value !== undefined) control.value = String(value);
    });
    const notice = document.getElementById("draftNotice");
    if (notice) notice.textContent = draftState.userPicks.length
      ? `Resumed your saved draft with ${draftState.userPicks.length} pick${draftState.userPicks.length === 1 ? "" : "s"}. Opponent picks are simulated.`
      : "Draft settings restored. Opponent picks before your slot are simulated; you have not made a pick yet.";
  } catch {}
}

function normalizeDraftPlayerName(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function getDraftAdp(player) {
  const imported = Number(draftState.adpByName[normalizeDraftPlayerName(player.name)]);
  if (Number.isFinite(imported) && imported > 0 && imported < 500) return { rank: imported, source: "CSV" };
  const sleeperAdp = Number(player.adp);
  if (Number.isFinite(sleeperAdp) && sleeperAdp > 0 && sleeperAdp < 500) return { rank: sleeperAdp, source: "Sleeper" };
  return { rank: null, source: "" };
}

function parseDraftCsvRow(line) {
  const cells = [];
  let cell = "", quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) { cell += '"'; index++; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { cells.push(cell.trim()); cell = ""; }
    else cell += character;
  }
  cells.push(cell.trim());
  return cells;
}

async function importDraftAdpFile(file) {
  if (!file) return;
  try {
    const rows = (await file.text()).split(/\r?\n/).filter(line => line.trim()).map(parseDraftCsvRow);
    if (rows.length < 2) throw new Error("The CSV needs a header and at least one player row.");
    const headers = rows[0].map(header => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const nameIndex = headers.findIndex(header => ["player", "playername", "name"].includes(header));
    const adpIndex = headers.findIndex(header => ["adp", "overalladp", "averagedraftposition", "rank"].includes(header));
    if (nameIndex < 0 || adpIndex < 0) throw new Error("CSV headers must include Player (or Name) and ADP.");

    const imported = {};
    rows.slice(1).forEach(row => {
      const name = normalizeDraftPlayerName(row[nameIndex]);
      const rank = Number(String(row[adpIndex] || "").replace(/[^0-9.]/g, ""));
      if (name && Number.isFinite(rank) && rank > 0 && rank < 500) imported[name] = rank;
    });
    if (!Object.keys(imported).length) throw new Error("No valid ADP values were found in that CSV.");
    draftState.adpByName = imported;
    saveDraftSession();
    const notice = document.getElementById("draftNotice");
    if (notice) notice.textContent = `Imported ADP for ${Object.keys(imported).length.toLocaleString()} players from CSV.`;
    renderDraftRoom();
  } catch (error) {
    const notice = document.getElementById("draftNotice");
    if (notice) notice.textContent = error.message || "Could not read the ADP CSV.";
  }
}

function getNextUserDraftPick(settings, picksMade = draftState.userPicks.length) {
  let userPickCount = 0;
  for (let overallPick = 1; overallPick <= settings.teams * settings.rounds; overallPick++) {
    if (getDraftTeamAtPick(overallPick, settings.teams) !== settings.slot) continue;
    if (userPickCount === picksMade) return overallPick;
    userPickCount++;
  }
  return settings.teams * settings.rounds + 1;
}

function scoreDraftPlayer(player, settings, rosterCounts, currentPick) {
  const position = player.position;
  const scoringPoints = Number(player.seasonPpg || player.projectedPoints || 0);
  const receptions = Number(player.receptionsPerGame || 0);
  const activeReceptionPoints = Number(state.activeLeague?.scoringSettings?.rec ?? 1);
  const targetReceptionPoints = settings.scoring === "standard" ? 0 : (settings.scoring === "half" ? 0.5 : 1);
  let points = scoringPoints + (targetReceptionPoints - activeReceptionPoints) * receptions;
  if (settings.scoring === "tep" && position === "TE") points += receptions * 0.5;

  const replacement = {
    QB: settings.rosterFormat === "superflex" ? 16 : 13.5,
    RB: 8, WR: 8.2, TE: 5.3, K: 6.3, DEF: 6
  }[position] || 0;
  let score = (points - replacement) * 100;
  const searchRank = Number(player.searchRank || 99999);
  score += Math.max(0, 2500 - searchRank) * 0.03;

  const starterCounts = settings.rosterFormat === "superflex"
    ? { QB: 2, RB: 2, WR: 3, TE: 1, K: 1, DEF: 1 }
    : { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1 };
  if ((rosterCounts[position] || 0) < starterCounts[position]) score += 150;
  const skillCount = (rosterCounts.RB || 0) + (rosterCounts.WR || 0) + (rosterCounts.TE || 0);
  const flexTarget = settings.rosterFormat === "superflex" ? 8 : 6;
  if (["RB", "WR", "TE"].includes(position) && skillCount < flexTarget) score += 45;

  if (player.age > 0 && ["QB", "RB", "WR", "TE"].includes(position)) {
    const ageSlope = { QB: 16, RB: 40, WR: 30, TE: 22 }[position];
    const agePivot = { QB: 30, RB: 25, WR: 27, TE: 27 }[position];
    const ageBonus = Math.max(-240, Math.min(180, (agePivot - player.age) * ageSlope));
    if (settings.type === "dynasty") score += ageBonus * (settings.dynastyYears / 3);
    if (settings.type === "keeper" && settings.keeperSlots > 0) {
      score += ageBonus * (settings.keeperYears / 3) * Math.min(1, settings.keeperSlots / 2);
    }
  } else if (settings.type === "dynasty" && player.exp <= 1) {
    score += 90 * (settings.dynastyYears / 3);
  }

  const adp = getDraftAdp(player).rank;
  if (adp !== null) score += Math.max(-160, Math.min(160, (currentPick - adp) * 0.6));

  return score;
}

function getDraftPlayerPool(settings, rosterCounts = {}, currentPick = getNextUserDraftPick(settings)) {
  const eligiblePositions = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
  return Object.values(state.players)
    .filter(player => {
      if (player.isPick || !eligiblePositions.has(player.position)) return false;
      if (["Retired", "Inactive"].includes(player.status)) return false;
      if (player.isCurrentNfl) return true;
      return settings.type === "dynasty" && player.team === "FA" && player.exp <= 1 && player.searchRank < 3000;
    })
    .map(player => ({ player, score: scoreDraftPlayer(player, settings, rosterCounts, currentPick) }))
    .sort((a, b) => (b.score - a.score) || (a.player.searchRank - b.player.searchRank));
}

function getDraftTeamAtPick(overallPick, teams) {
  const round = Math.floor((overallPick - 1) / teams) + 1;
  const positionInRound = ((overallPick - 1) % teams) + 1;
  return round % 2 === 1 ? positionInRound : teams - positionInRound + 1;
}

function getDraftPickNumberForSlot(round, teamSlot, teams) {
  const positionInRound = round % 2 === 1 ? teamSlot : teams - teamSlot + 1;
  return (round - 1) * teams + positionInRound;
}

function renderDraftBoard(simulation) {
  const grid = document.getElementById("draftBoardGrid");
  const wrap = document.getElementById("draftHistoryWrap");
  if (!grid || !wrap) return;
  if (!wrap.dataset.scrollBound) {
    wrap.dataset.scrollBound = "true";
    wrap.addEventListener("wheel", () => { wrap.dataset.userScrolled = "true"; }, { passive: true });
    wrap.addEventListener("touchstart", () => { wrap.dataset.userScrolled = "true"; }, { passive: true });
  }
  const { teams, rounds, slot } = draftState.settings;
  const picksByOverall = new Map(simulation.picks.map(pick => [pick.overallPick, pick]));
  grid.style.gridTemplateColumns = `58px repeat(${teams}, minmax(138px, 1fr))`;
  grid.innerHTML = `<div class="draft-grid-cell draft-grid-header draft-grid-round">Round</div>${Array.from({ length: teams }, (_, index) => {
    const teamSlot = index + 1;
    return `<div class="draft-grid-cell draft-grid-header">${teamSlot === slot ? `You · ${teamSlot}` : `Team ${teamSlot}`}</div>`;
  }).join("")}`;

  for (let round = 1; round <= rounds; round++) {
    grid.insertAdjacentHTML("beforeend", `<div class="draft-grid-cell draft-grid-round">R${round}</div>`);
    for (let teamSlot = 1; teamSlot <= teams; teamSlot++) {
      const overallPick = getDraftPickNumberForSlot(round, teamSlot, teams);
      const pick = picksByOverall.get(overallPick);
      const isCurrentPick = !simulation.complete && overallPick === simulation.nextPick;
      const cellClasses = ["draft-grid-cell", "draft-grid-pick"];
      if (pick?.isUserPick) cellClasses.push("is-user");
      else if (pick) cellClasses.push("is-taken");
      if (isCurrentPick) cellClasses.push("is-current");

      let contents = `<span class="draft-grid-open">Awaiting</span>`;
      if (pick) {
        const adp = getDraftAdp(pick.player).rank;
        contents = `<span class="draft-grid-player"><img src="${draftEscapeHtml(avatarUrl(pick.player))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" /><strong>${draftEscapeHtml(pick.player.name)}</strong></span><span class="draft-grid-meta">${draftEscapeHtml(pick.player.position)} · ${draftEscapeHtml(pick.player.team || "FA")}${adp === null ? "" : ` · ADP ${adp.toFixed(1)}`}</span>`;
      } else if (isCurrentPick) contents = `<strong class="draft-grid-open">On the clock</strong>`;

      grid.insertAdjacentHTML("beforeend", `<div class="${cellClasses.join(" ")}" data-overall-pick="${overallPick}">${contents}</div>`);
    }
  }

  const currentCell = grid.querySelector(".is-current");
  if (currentCell && !wrap.dataset.userScrolled) {
    requestAnimationFrame(() => {
      wrap.scrollLeft = Math.max(0, currentCell.offsetLeft - wrap.clientWidth / 2 + currentCell.clientWidth / 2);
      wrap.scrollTop = Math.max(0, currentCell.offsetTop - 80);
    });
  }
}

function chooseSimulatedOpponentPick(rankedPlayers, draftedIds, settings, currentPick) {
  const available = rankedPlayers.filter(entry => !draftedIds.has(entry.player.id));
  if (!available.length || settings.opponentStrategy === "value") return available[0] || null;
  const adpAvailable = available.map(entry => ({ ...entry, adp: getDraftAdp(entry.player).rank })).filter(entry => entry.adp !== null);
  if (!adpAvailable.length) return available[0];

  const adpWindow = currentPick + Math.max(3, Math.ceil(settings.teams * 0.5));
  const likelyAvailable = adpAvailable.filter(entry => entry.adp <= adpWindow);
  const candidates = likelyAvailable.length ? likelyAvailable : adpAvailable;
  if (settings.opponentStrategy === "adp") {
    return candidates.sort((a, b) => (a.adp - b.adp) || (b.score - a.score))[0];
  }

  const adpShortlist = [...candidates].sort((a, b) => a.adp - b.adp).slice(0, 4);
  return adpShortlist.sort((a, b) => {
    const scoreA = a.score - Math.max(0, a.adp - currentPick) * 24;
    const scoreB = b.score - Math.max(0, b.adp - currentPick) * 24;
    return scoreB - scoreA;
  })[0];
}

function simulateDraft(rankedPlayers) {
  const settings = draftState.settings;
  const maxPicks = settings.teams * settings.rounds;
  const playerById = new Map(rankedPlayers.map(entry => [entry.player.id, entry]));
  const draftedIds = new Set();
  const picks = [];
  let manualPickIndex = 0;
  let overallPick = 1;

  while (overallPick <= maxPicks) {
    const round = Math.floor((overallPick - 1) / settings.teams) + 1;
    const teamSlot = getDraftTeamAtPick(overallPick, settings.teams);
    const isUserPick = teamSlot === settings.slot;
    let entry;

    if (isUserPick) {
      if (manualPickIndex >= draftState.userPicks.length) break;
      entry = playerById.get(draftState.userPicks[manualPickIndex++]);
      if (!entry || draftedIds.has(entry.player.id)) { overallPick++; continue; }
    } else {
      entry = chooseSimulatedOpponentPick(rankedPlayers, draftedIds, settings, overallPick);
      if (!entry) break;
    }

    draftedIds.add(entry.player.id);
    picks.push({ player: entry.player, score: entry.score, overallPick, round, teamSlot, isUserPick });
    overallPick++;
  }

  return { picks, draftedIds, nextPick: overallPick, complete: overallPick > maxPicks };
}

function applyDraftSettings() {
  restoreDraftSession();
  updateDraftSlotOptions();
  const settings = {
    type: document.getElementById("draftType")?.value || "redraft",
    teams: Math.min(32, Math.max(4, parseInt(document.getElementById("draftTeams")?.value, 10) || 12)),
    slot: Math.min(32, Math.max(1, parseInt(document.getElementById("draftSlot")?.value, 10) || 1)),
    rounds: Math.min(30, Math.max(1, parseInt(document.getElementById("draftRounds")?.value, 10) || 15)),
    scoring: document.getElementById("draftScoring")?.value || "ppr",
    rosterFormat: document.getElementById("draftRosterFormat")?.value || "standard",
    opponentStrategy: document.getElementById("draftOpponentStrategy")?.value || "adp",
    dynastyYears: parseInt(document.getElementById("draftDynastyYears")?.value, 10) || 3,
    keeperSlots: parseInt(document.getElementById("draftKeeperSlots")?.value, 10) || 0,
    keeperYears: parseInt(document.getElementById("draftKeeperYears")?.value, 10) || 2
  };
  settings.slot = Math.min(settings.teams, settings.slot);
  draftState.settings = settings;
  draftState.userPicks = [];
  saveDraftSession();
  renderDraftRoom();
}

function importDraftLeagueSettings() {
  const league = state.activeLeague;
  if (!league) {
    const notice = document.getElementById("draftNotice");
    if (notice) notice.textContent = "Sync an account and select a league to import its settings.";
    return;
  }

  document.getElementById("draftType").value = league.leagueType === 2 ? "dynasty" : (league.leagueType === 1 ? "keeper" : "redraft");
  document.getElementById("draftTeams").value = league.totalTeams || 12;
  document.getElementById("draftRounds").value = league.draftRounds || 15;
  const scoring = league.scoringSettings || {};
  const receptionPoints = Number(scoring.rec ?? 1);
  document.getElementById("draftScoring").value = Number(scoring.bonus_rec_te || 0) >= 0.5 || receptionPoints > 1.25
    ? "tep"
    : (receptionPoints >= 0.9 ? "ppr" : (receptionPoints >= 0.4 ? "half" : "standard"));
  const rosterPositions = league.rosterPositions || [];
  document.getElementById("draftRosterFormat").value = rosterPositions.filter(slot => slot === "QB").length >= 2 || rosterPositions.some(slot => ["SUPER_FLEX", "Q/W/R/T"].includes(slot))
    ? "superflex"
    : "standard";
  updateDraftSlotOptions();
  updateDraftTypeSettings();
  const notice = document.getElementById("draftNotice");
  if (notice) notice.textContent = `Imported settings from ${league.name}. Confirm your draft slot, then start the draft.`;
}

function renderDraftKeeperLedger() {
  const select = document.getElementById("draftKeeperPlayer");
  const list = document.getElementById("draftKeeperLedger");
  const managerIndex = parseInt(document.getElementById("teamSelect")?.value || "0", 10);
  const manager = state.managers[managerIndex];
  if (select) {
    const selectedId = select.value;
    const rosterPlayers = (manager?.players || []).map(id => state.players[id]).filter(player => player && !player.isPick);
    select.innerHTML = rosterPlayers.length
      ? `<option value="">Select roster player</option>${rosterPlayers.map(player => `<option value="${draftEscapeHtml(player.id)}">${draftEscapeHtml(player.name)} · ${draftEscapeHtml(player.position)}</option>`).join("")}`
      : `<option value="">Sync a league to select a roster player</option>`;
    if (rosterPlayers.some(player => player.id === selectedId)) select.value = selectedId;
  }
  if (!list) return;
  list.innerHTML = draftState.keepers.length ? draftState.keepers.map((keeper, index) => {
    const player = state.players[keeper.playerId];
    const name = player?.name || keeper.playerName || "Unknown player";
    const owner = state.managers.find(item => item.rosterId === keeper.managerId)?.teamName?.split(" (")[0] || "Roster";
    const cost = keeper.costType === "salary" ? `$${keeper.cost}` : `Round ${keeper.cost}`;
    return `<div class="draft-picked-player"><span class="draft-picked-round">${draftEscapeHtml(owner)} · ${draftEscapeHtml(cost)} · ${keeper.years} yr${keeper.years === 1 ? "" : "s"}</span><strong>${draftEscapeHtml(name)}</strong><button class="draft-remove-keeper" type="button" data-remove-keeper="${index}" aria-label="Remove ${draftEscapeHtml(name)}">Remove</button></div>`;
  }).join("") : `<div class="draft-empty">No keeper commitments saved.</div>`;
}

function addDraftKeeper() {
  const manager = state.managers[parseInt(document.getElementById("teamSelect")?.value || "0", 10)];
  const playerId = document.getElementById("draftKeeperPlayer")?.value;
  const player = state.players[playerId];
  const costType = document.getElementById("draftKeeperCostType")?.value || "round";
  const cost = Number(document.getElementById("draftKeeperCost")?.value);
  const years = Math.min(5, Math.max(1, Number(document.getElementById("draftKeeperContractYears")?.value) || 1));
  const notice = document.getElementById("draftNotice");
  if (!manager || !player) { if (notice) notice.textContent = "Select a player from the chosen roster."; return; }
  if (!Number.isFinite(cost) || cost < 0) { if (notice) notice.textContent = "Enter a valid keeper cost."; return; }
  if (draftState.keepers.some(keeper => keeper.playerId === playerId && keeper.managerId === manager.rosterId)) {
    if (notice) notice.textContent = `${player.name} is already in this keeper ledger.`;
    return;
  }
  const teamKeepers = draftState.keepers.filter(keeper => keeper.managerId === manager.rosterId);
  if (draftState.settings.type === "keeper" && teamKeepers.length >= draftState.settings.keeperSlots) {
    if (notice) notice.textContent = `This keeper format allows ${draftState.settings.keeperSlots} keeper${draftState.settings.keeperSlots === 1 ? "" : "s"} for this roster.`;
    return;
  }
  draftState.keepers.push({ playerId, playerName: player.name, managerId: manager.rosterId, costType, cost, years });
  saveDraftSession();
  renderDraftKeeperLedger();
}

function draftPlayer(playerId) {
  restoreDraftSession();
  const ranking = getDraftPlayerPool(draftState.settings, draftState.userPicks.reduce((counts, id) => {
    const player = state.players[id];
    if (player) counts[player.position] = (counts[player.position] || 0) + 1;
    return counts;
  }, {}));
  const simulation = simulateDraft(ranking);
  if (simulation.complete || simulation.draftedIds.has(playerId)) return;
  if (!ranking.some(entry => entry.player.id === playerId)) return;
  draftState.userPicks.push(playerId);
  saveDraftSession();
  renderDraftRoom();
}

function renderDraftRoom() {
  restoreDraftSession();
  const settings = draftState.settings;
  updateDraftSlotOptions();
  updateDraftTypeSettings();
  const seasonBadge = document.getElementById("draftSeasonBadge");
  if (seasonBadge) seasonBadge.textContent = `${state.activeLeague?.season || state.season} Season`;

  const rosterCounts = draftState.userPicks.reduce((counts, id) => {
    const player = state.players[id];
    if (player) counts[player.position] = (counts[player.position] || 0) + 1;
    return counts;
  }, {});
  const rankedPlayers = getDraftPlayerPool(settings, rosterCounts, getNextUserDraftPick(settings));
  const simulation = simulateDraft(rankedPlayers);
  const availablePlayers = rankedPlayers.filter(entry => !simulation.draftedIds.has(entry.player.id));
  const maxPicks = settings.teams * settings.rounds;
  const pickNumber = simulation.nextPick;
  const roundNumber = Math.floor((pickNumber - 1) / settings.teams) + 1;
  const slotPosition = getDraftTeamAtPick(pickNumber, settings.teams);

  const clock = document.getElementById("draftClock");
  if (clock) clock.textContent = simulation.complete ? "Draft complete" : `Round ${roundNumber} • Overall ${pickNumber}`;
  const slotSummary = document.getElementById("draftSlotSummary");
  if (slotSummary) slotSummary.textContent = `${settings.slot} of ${settings.teams}`;
  const pickCount = document.getElementById("draftPickCount");
  if (pickCount) pickCount.textContent = String(draftState.userPicks.length);
  const availableCount = document.getElementById("draftAvailableCount");
  if (availableCount) availableCount.textContent = String(availablePlayers.length);

  const positionFilter = document.getElementById("draftPosition")?.value || "ALL";
  const sortMode = document.getElementById("draftSort")?.value || "recommendation";
  const query = (document.getElementById("draftSearch")?.value || "").trim().toLowerCase();
  const filteredPlayers = availablePlayers.filter(({ player }) => {
    if (positionFilter !== "ALL" && player.position !== positionFilter) return false;
    return !query || player.name.toLowerCase().includes(query) || String(player.team || "").toLowerCase().includes(query);
  });
  const displayPlayers = [...filteredPlayers];
  if (sortMode === "adp") displayPlayers.sort((a, b) => (getDraftAdp(a.player).rank ?? Infinity) - (getDraftAdp(b.player).rank ?? Infinity) || b.score - a.score);
  else if (sortMode === "projected") displayPlayers.sort((a, b) => (Number(b.player.projectedPoints || b.player.seasonPpg || 0) - Number(a.player.projectedPoints || a.player.seasonPpg || 0)) || b.score - a.score);
  else if (sortMode === "value") displayPlayers.sort((a, b) => b.score - a.score);
  else if (sortMode === "name") displayPlayers.sort((a, b) => a.player.name.localeCompare(b.player.name));
  const boardMeta = document.getElementById("draftBoardMeta");
  const hasAdp = rankedPlayers.some(entry => getDraftAdp(entry.player).rank !== null);
  if (boardMeta) boardMeta.textContent = `${filteredPlayers.length.toLocaleString()} available • ${hasAdp ? "ADP-informed" : "ADP unavailable"} • ${settings.type}`;

  const table = document.getElementById("draftBoardTable");
  if (table) {
    const entries = displayPlayers.slice(0, 80);
    table.innerHTML = `<thead><tr><th>Rank</th><th style="text-align:left;">Player</th><th>Pos</th><th>Team</th><th>ADP</th><th>Age</th><th>PPG</th><th></th></tr></thead><tbody></tbody>`;
    const body = table.querySelector("tbody");
    if (!entries.length) {
      body.innerHTML = `<tr><td colspan="8" class="draft-empty">${Object.keys(state.players).length ? "No players match these filters." : "Player database is loading."}</td></tr>`;
    } else {
      entries.forEach(({ player, score }, index) => {
        const row = document.createElement("tr");
        const adp = getDraftAdp(player);
        row.innerHTML = `<td class="draft-rank">${index + 1}</td><td class="draft-name"><span class="draft-player-cell"><img src="${draftEscapeHtml(avatarUrl(player))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" /><span>${draftEscapeHtml(player.name)}</span></span></td><td><span class="pos-pill">${draftEscapeHtml(player.position)}</span></td><td>${draftEscapeHtml(player.team || "FA")}</td><td>${adp.rank === null ? "--" : `${adp.rank.toFixed(1)} <span class="draft-adp-source">${adp.source}</span>`}</td><td>${player.age || "--"}</td><td>${Number(player.seasonPpg || player.projectedPoints || 0).toFixed(1)}</td><td><button class="draft-pick-btn" type="button" data-draft-pick="${draftEscapeHtml(player.id)}" title="Draft ${draftEscapeHtml(player.name)}">Draft</button></td>`;
        row.dataset.draftScore = String(Math.round(score));
        body.appendChild(row);
      });
    }
  }

  const countsEl = document.getElementById("draftRosterCounts");
  if (countsEl) {
    countsEl.innerHTML = ["QB", "RB", "WR", "TE", "K", "DEF"].map(position =>
      `<div><span>${position}</span><strong>${rosterCounts[position] || 0}</strong></div>`
    ).join("");
  }

  const userPicksEl = document.getElementById("draftUserPicks");
  if (userPicksEl) {
    const picks = simulation.picks.filter(pick => pick.isUserPick);
    userPicksEl.innerHTML = picks.length ? picks.map(pick =>
      `<div class="draft-picked-player"><span class="draft-picked-round">R${pick.round} · #${pick.overallPick}</span><span class="draft-player-cell"><img src="${draftEscapeHtml(avatarUrl(pick.player))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" /><strong>${draftEscapeHtml(pick.player.name)}</strong></span><span>${draftEscapeHtml(pick.player.position)} · ${draftEscapeHtml(pick.player.team || "FA")}</span></div>`
    ).join("") : `<div class="draft-empty">No players drafted yet.</div>`;
  }

  const takenCount = document.getElementById("draftTakenCount");
  if (takenCount) {
    const simulatedCount = simulation.picks.filter(pick => !pick.isUserPick).length;
    const savedUserPickCount = simulation.picks.filter(pick => pick.isUserPick).length;
    takenCount.textContent = simulation.complete
      ? `Draft complete · ${savedUserPickCount} of your picks recorded`
      : `${simulatedCount} opponent picks simulated · ${savedUserPickCount} of your picks saved · Your turn at #${simulation.nextPick}`;
  }
  renderDraftBoard(simulation);

  const undoButton = document.getElementById("draftUndoBtn");
  if (undoButton) undoButton.disabled = draftState.userPicks.length === 0;
  renderDraftKeeperLedger();
}

async function refreshLiveMatchups() {
  const button = document.getElementById("refreshMatchupsBtn");
  const status = document.getElementById("matchupLiveStatus");
  const league = state.activeLeague;
  if (!league) { if (status) status.textContent = "Connect a league before refreshing scores."; return; }
  if (league.provider === "yahoo") { if (status) status.textContent = "Yahoo import is a snapshot. Re-import an updated roster/matchup file to refresh."; return; }
  if (button) button.disabled = true;
  if (status) status.textContent = "Refreshing matchup scores...";
  try {
    if (league.provider === "sleeper") {
      const response = await fetch(`https://api.sleeper.app/v1/league/${league.leagueId}/matchups/${state.week}`);
      if (!response.ok) throw new Error(`Provider returned ${response.status}.`);
      state.currentMatchups = await response.json();
      renderSuperlatives(state.currentMatchups || []);
    } else if (league.provider === "espn") {
      const data = await fetchEspnLeague(league.leagueId, league.season);
      league.espnData = data;
      state.currentMatchups = (data.schedule || []).filter(matchup => Number(matchup.matchupPeriodId) === Number(state.week));
    }
    markDataSource("matchups");
    renderMatchupSim();
    renderWeeklyLeagueReport();
    renderPickemChallenge();
    if (document.getElementById("tab-intel")?.classList.contains("active")) renderLeagueIntelTab();
    if (status) status.textContent = `Scores refreshed at ${new Date().toLocaleTimeString()}.`;
  } catch (error) {
    markDataSource("matchups", error);
    if (status) status.textContent = `Could not refresh live scores: ${error.message}`;
  } finally {
    if (button) button.disabled = false;
  }
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
  renderSosTab(); renderPlayoffBracketTab(); renderDraftRoom();
  if (document.getElementById("tab-inbox")?.classList.contains("active")) renderGMInbox();
  if (document.getElementById("tab-newsletter")?.classList.contains("active")) renderLeagueNewsletter();
}

// 10. Form Control Bindings & Boot
function bindControlEvents() {
  ensureDynamicTradeControls();
  const weekSelect = document.getElementById("weekSelect");

  updateProviderControls();
  document.getElementById("providerSelect")?.addEventListener("change", () => {
    state.leagues = [];
    state.activeLeague = null;
    state.managers = [];
    state.currentMatchups = [];
    document.getElementById("leagueSelect").innerHTML = `<option value="">Connect a provider first</option>`;
    document.getElementById("teamSelect").innerHTML = `<option value="">Select a league</option>`;
    renderHistoricalRows([]);
    document.getElementById("historyMeta").textContent = "History will update after you connect or import a league.";
    renderWeeklyLeagueReport();
    renderPickemChallenge();
    updateProviderControls();
    setStatus("Provider changed. Connect a league to load its data.");
  });
  document.getElementById("yahooImportFile")?.addEventListener("change", event => importYahooRosterFile(event.target.files?.[0]));
  updateDraftSlotOptions();
  updateDraftTypeSettings();
  document.getElementById("draftType")?.addEventListener("change", updateDraftTypeSettings);
  document.getElementById("draftTeams")?.addEventListener("change", updateDraftSlotOptions);
  document.getElementById("draftStartBtn")?.addEventListener("click", applyDraftSettings);
  document.getElementById("draftImportLeagueBtn")?.addEventListener("click", importDraftLeagueSettings);
  document.getElementById("draftPosition")?.addEventListener("change", renderDraftRoom);
  document.getElementById("draftSort")?.addEventListener("change", renderDraftRoom);
  document.getElementById("draftSearch")?.addEventListener("input", renderDraftRoom);
  document.getElementById("draftBoardTable")?.addEventListener("click", e => {
    const button = e.target.closest("[data-draft-pick]");
    if (button) draftPlayer(button.dataset.draftPick);
  });
  document.getElementById("draftUndoBtn")?.addEventListener("click", () => {
    draftState.userPicks.pop();
    saveDraftSession();
    renderDraftRoom();
  });
  document.getElementById("draftBoardExpandBtn")?.addEventListener("click", e => {
    const wrap = document.getElementById("draftHistoryWrap");
    if (!wrap) return;
    const expanded = wrap.classList.toggle("is-expanded");
    e.currentTarget.textContent = expanded ? "Compact board" : "Expand board";
    e.currentTarget.setAttribute("aria-expanded", String(expanded));
  });
  document.getElementById("draftSaveBtn")?.addEventListener("click", saveDraftSession);
  document.getElementById("draftAdpCsv")?.addEventListener("change", e => importDraftAdpFile(e.target.files?.[0]));
  document.getElementById("draftAddKeeperBtn")?.addEventListener("click", addDraftKeeper);
  document.getElementById("draftKeeperLedger")?.addEventListener("click", e => {
    const button = e.target.closest("[data-remove-keeper]");
    if (!button) return;
    draftState.keepers.splice(parseInt(button.dataset.removeKeeper, 10), 1);
    saveDraftSession();
    renderDraftKeeperLedger();
  });
  document.getElementById("faabBudget")?.addEventListener("change", updateFaabSettings);
  document.getElementById("faabWeeks")?.addEventListener("change", updateFaabSettings);
  document.getElementById("faabStrategy")?.addEventListener("change", updateFaabSettings);
  document.getElementById("waiverTbl")?.addEventListener("click", e => {
    const button = e.target.closest("[data-faab-player]");
    if (button) toggleFaabClaim(button.dataset.faabPlayer);
  });
  document.getElementById("waiverNeedTargets")?.addEventListener("click", e => {
    const button = e.target.closest("[data-waiver-fit-player]");
    if (button) toggleFaabClaim(button.dataset.waiverFitPlayer);
  });
  document.getElementById("faabClaims")?.addEventListener("change", e => {
    const input = e.target.closest("[data-faab-bid]");
    if (!input) return;
    const claim = faabState.claims[parseInt(input.dataset.faabBid, 10)];
    if (!claim) return;
    claim.bid = Math.min(faabState.budget, Math.max(0, Number(input.value) || 0));
    saveFaabState();
    renderWaiversTab();
  });
  document.getElementById("faabClaims")?.addEventListener("click", e => {
    const button = e.target.closest("[data-remove-faab]");
    if (!button) return;
    faabState.claims.splice(parseInt(button.dataset.removeFaab, 10), 1);
    saveFaabState();
    renderWaiversTab();
  });

  document.getElementById("syncBtn")?.addEventListener("click", syncUserAccount);
  document.getElementById("retryDataBtn")?.addEventListener("click", retryDataSync);
  document.getElementById("mobileTabSelect")?.addEventListener("change", e => {
    document.querySelector(`.nav-btn[data-tab="${e.target.value}"]`)?.click();
  });
  document.getElementById("refreshIntelBtn")?.addEventListener("click", () => { portfolioState.rostersByLeague.clear(); renderLeagueIntelTab(true); });
  document.getElementById("refreshGmInboxBtn")?.addEventListener("click", () => renderGMInbox(true));
  document.getElementById("gmInboxList")?.addEventListener("click", handleGMInboxClick);
  document.getElementById("gmInboxCompleted")?.addEventListener("click", handleGMInboxClick);
  document.getElementById("portfolioPressureList")?.addEventListener("click", handleGMInboxClick);
  document.getElementById("newsletterLeagueSelect")?.addEventListener("change", event => {
    const leagueSelect = document.getElementById("leagueSelect");
    if (!leagueSelect || !event.target.value) return;
    leagueSelect.value = event.target.value;
    leagueSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });
  document.getElementById("newsletterArchiveSelect")?.addEventListener("change", renderLeagueNewsletter);
  document.getElementById("generateNewsletterBtn")?.addEventListener("click", () => {
    const archiveSelect = document.getElementById("newsletterArchiveSelect");
    if (archiveSelect) archiveSelect.value = "current";
    renderLeagueNewsletter();
  });
  document.getElementById("saveNewsletterBtn")?.addEventListener("click", saveNewsletterIssue);
  document.getElementById("copyNewsletterBtn")?.addEventListener("click", copyNewsletterIssue);
  document.getElementById("downloadNewsletterBtn")?.addEventListener("click", downloadNewsletterIssue);
  document.getElementById("loadHistoryBtn")?.addEventListener("click", loadHistoricalSeason);
  document.getElementById("generateWeeklyReportBtn")?.addEventListener("click", renderWeeklyLeagueReport);
  document.getElementById("copyWeeklyReportBtn")?.addEventListener("click", copyWeeklyLeagueReport);
  document.getElementById("downloadLeagueHomeBtn")?.addEventListener("click", downloadLeagueHome);
  document.getElementById("pickemMatchup")?.addEventListener("change", renderPickemChallenge);
  document.getElementById("savePickemBtn")?.addEventListener("click", savePickemPrediction);
  document.getElementById("refreshMatchupsBtn")?.addEventListener("click", refreshLiveMatchups);
  document.getElementById("portfolioRosterSelectors")?.addEventListener("change", e => {
    const select = e.target.closest("[data-portfolio-league]");
    if (!select) return;
    state.portfolioRosterSelections[select.dataset.portfolioLeague] = select.value;
    try { localStorage.setItem("fantasy-front-office:portfolio-rosters", JSON.stringify(state.portfolioRosterSelections)); } catch {}
    renderLeagueIntelTab();
  });
  document.getElementById("portfolioMovePlayer")?.addEventListener("change", renderPortfolioMoveComparison);
  document.getElementById("recommendationTable")?.addEventListener("click", e => {
    const button = e.target.closest("[data-watch-player]");
    if (button) togglePlayerWatch(button.dataset.watchPlayer);
  });
  document.getElementById("addAlertPlayerBtn")?.addEventListener("click", () => {
    const playerId = document.getElementById("alertPlayerSelect")?.value;
    if (playerId) togglePlayerWatch(playerId);
  });
  document.getElementById("enableBrowserAlertsBtn")?.addEventListener("click", enablePlayerBrowserAlerts);
  document.getElementById("playerWatchlist")?.addEventListener("click", e => {
    const button = e.target.closest("[data-remove-watch]");
    if (button) togglePlayerWatch(button.dataset.removeWatch);
  });
  document.getElementById("playerAlertFeed")?.addEventListener("click", e => {
    const button = e.target.closest("[data-dismiss-alert]");
    if (!button) return;
    loadPlayerAlertState();
    playerAlertState.events = playerAlertState.events.filter(event => event.id !== button.dataset.dismissAlert);
    savePlayerAlertState();
    renderPlayerAlerts();
  });
  document.getElementById("usernameInput")?.addEventListener("keydown", e => { if (e.key === "Enter") syncUserAccount(); });
  document.getElementById("leagueSelect")?.addEventListener("change", async e => {
    await loadLeague(parseInt(e.target.value, 10));
    if (document.getElementById("tab-inbox")?.classList.contains("active")) await renderGMInbox();
    if (document.getElementById("tab-newsletter")?.classList.contains("active")) renderLeagueNewsletter();
  });
  document.getElementById("teamSelect")?.addEventListener("change", e => {
    const idx = parseInt(e.target.value, 10);
    if (document.getElementById("tradeTeamA")) document.getElementById("tradeTeamA").value = idx;
    renderRosterTab(idx); renderOptimizerTab(idx); renderWaiversTab(); renderSosTab(); renderTradeFinder(); renderDraftKeeperLedger(); buildTradeDatabase();
    if (document.getElementById("tab-intel")?.classList.contains("active")) renderLeagueIntelTab();
  });
  weekSelect?.addEventListener("change", async e => {
    state.week = parseInt(e.target.value, 10);
    syncLiveEspnSchedule();
    renderSosTab();
    if (state.activeLeague) await loadLeague(document.getElementById("leagueSelect").value);
    if (document.getElementById("tab-inbox")?.classList.contains("active")) await renderGMInbox();
    if (document.getElementById("tab-newsletter")?.classList.contains("active")) renderLeagueNewsletter();
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
  document.getElementById("shareBtn")?.addEventListener("click", async () => {
    const u = document.getElementById("usernameInput")?.value.trim() || "";
    const provider = document.getElementById("providerSelect")?.value || "";
    const base = (location.origin && location.origin !== "null")
      ? `${location.origin}${location.pathname}`
      : location.href.split("?")[0].replace(/\/$/, "");
    const identifier = provider === "espn" ? "league" : "user";
    const sourceQuery = provider ? `provider=${provider}&${u ? `${identifier}=${encodeURIComponent(u)}&` : ""}` : "";
    const url = `${base}?${sourceQuery}week=${state.week}`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const helper = document.createElement("textarea");
        helper.value = url;
        helper.setAttribute("readonly", "");
        helper.style.position = "fixed";
        helper.style.top = "-9999px";
        document.body.appendChild(helper);
        helper.select();
        try { document.execCommand("copy"); } catch {}
        helper.remove();
      }
      setStatus("Shareable link copied to clipboard!");
    } catch {
      const src = window.open("", "_blank", "noopener,noreferrer");
      if (src) {
        src.document.write(`<pre>${url}</pre>`);
        src.document.close();
      }
      setStatus("Share link ready — copy it from the popup window.");
    }
  });
  window.addEventListener("resize", () => { drawPowerChart(); drawWaiverChart(); drawSingleAnalyticsChart(); });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { initMonetization(); bindControlEvents(); initApp(); });
} else {
  initMonetization();
  bindControlEvents();
  initApp();
}