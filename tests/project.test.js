const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("browser JavaScript entry points parse", () => {
  for (const file of ["app.js", "data-fetch.js", "demo-league.js", "league-records.js", "workspace-backup.js", "playoff-simulator.js", "monetization-config.js"]) {
    const result = spawnSync(process.execPath, ["--check", file], {
      cwd: root,
      encoding: "utf8"
    });

    assert.equal(result.status, 0, `${file} failed syntax validation:\n${result.stderr}`);
  }
});

test("demo league has fictional, unique players and valid starter counts", () => {
  const sandbox = { window: {} };
  vm.runInNewContext(read("demo-league.js"), sandbox);
  const payload = sandbox.window.FFODemo.createDemoLeague();
  assert.equal(payload.teams.length, 4);
  const players = payload.teams.flatMap(team => team.players).concat(payload.freeAgents);
  assert.equal(new Set(players.map(player => player.playerId)).size, players.length);
  assert.ok(players.every(player => player.name.startsWith("Sample ")));
  assert.ok(payload.teams.every(team => team.players.filter(player => player.starter).length === 7));
  assert.equal(payload.freeAgents.length, 4);
  const history = sandbox.window.FFODemo.createDemoHistory();
  assert.equal(history.seasons.length, 2);
  assert.ok(history.source.includes("Fictional"));
});

test("HTML references existing local assets in the expected script order", () => {
  const html = read("index.html");
  const assets = [
    ...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)
  ].map(match => match[1]).filter(asset => !/^(?:[a-z]+:)?\/\//i.test(asset));

  assert.ok(assets.length > 0, "Expected local CSS or JavaScript assets.");
  assert.ok(assets.every(asset => asset.endsWith("?v=20261031-visual-hierarchy-1")), "All local assets must use the current release version.");
  for (const asset of assets) {
    assert.ok(fs.existsSync(path.join(root, asset.split("?")[0])), `Missing local asset: ${asset}`);
  }

  const configIndex = html.indexOf('<script src="monetization-config.js?');
  const dataFetchIndex = html.indexOf('<script src="data-fetch.js?');
  const demoIndex = html.indexOf('<script src="demo-league.js?');
  const recordsIndex = html.indexOf('<script src="league-records.js?');
  const workspaceIndex = html.indexOf('<script src="workspace-backup.js?');
  const appIndex = html.indexOf('<script src="app.js?');
  const playoffIndex = html.indexOf('<script src="playoff-simulator.js?');
  assert.ok(configIndex >= 0, "Monetization configuration script is missing.");
  assert.ok(dataFetchIndex > configIndex, "Data-fetch module must load after configuration.");
  assert.ok(demoIndex > dataFetchIndex, "Demo module must load before the app.");
  assert.ok(recordsIndex > demoIndex, "Records module must load after the demo module.");
  assert.ok(workspaceIndex > recordsIndex && appIndex > workspaceIndex, "Workspace must load after records and before the app.");
  assert.ok(playoffIndex > workspaceIndex && appIndex > playoffIndex, "Playoff engine must load before the app.");
});

test("static interface IDs, labels, and tab navigation targets are consistent", () => {
  const html = read("index.html");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const idSet = new Set(ids);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const missingLabelTargets = [...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)]
    .map(match => match[1])
    .filter(id => !idSet.has(id));
  const tabIds = new Set([...html.matchAll(/\bid="(tab-[^"]+)"/g)].map(match => match[1]));
  const missingNavTargets = [...html.matchAll(/\bdata-tab="([^"]+)"/g)]
    .map(match => match[1])
    .filter(tab => !tabIds.has(tab));
  const missingMobileTabTargets = [...html.matchAll(/<option\b[^>]*\bvalue="(tab-[^"]+)"/g)]
    .map(match => match[1])
    .filter(tab => !tabIds.has(tab));

  assert.deepEqual(duplicateIds, [], "HTML IDs must be unique.");
  assert.deepEqual(missingLabelTargets, [], "Every explicit label target must exist.");
  assert.deepEqual(missingNavTargets, [], "Every navigation button must target a tab.");
  assert.deepEqual(missingMobileTabTargets, [], "Every mobile navigation option must target a tab.");
  const desktopTargets = [...html.matchAll(/\bdata-tab="([^"]+)"/g)].map(match => match[1]);
  const mobileTargets = [...html.matchAll(/<option\b[^>]*\bvalue="(tab-[^"]+)"/g)].map(match => match[1]);
  assert.deepEqual([...desktopTargets].sort(), [...tabIds].sort(), "Every page must have exactly one desktop navigation entry.");
  assert.deepEqual([...mobileTargets].sort(), [...tabIds].sort(), "Mobile and desktop navigation must expose identical pages.");
  assert.equal((html.match(/name="sidebar-section"/g) || []).length, 4, "Only multi-item groups should have disclosure navigation.");
  assert.equal((html.match(/<optgroup label=/g) || []).length, 4, "Mobile navigation must preserve the same four groups.");
  assert.deepEqual([...html.matchAll(/<optgroup label="([^"]+)"/g)].map(match => match[1]), ["My Team", "League", "Players", "Extras"], "Single tools should not have wrapper groups.");
  const groups = [...html.matchAll(/<details class="nav-group[^"]*"[^>]*>[\s\S]*?<\/details>/g)];
  assert.ok(groups.every(([group]) => (group.match(/class="nav-btn"/g) || []).length > 1), "Every collapsible navigation group must contain multiple destinations.");
  assert.match(html, /<button class="nav-btn nav-direct" data-tab="tab-draft">[\s\S]*?<span>Draft Room<\/span><\/button>/, "Draft Room should be a direct destination.");
  for (const label of ["My Roster", "Schedule &amp; Coverage", "Waiver Planner", "Trade Analyzer", "Team Grade", "Playoff Scenarios", "Compare Players", "Strength of Schedule"]) {
    assert.ok(html.includes(`>${label}</option>`) || html.includes(`>${label}</button>`), `Navigation should use a clear label for ${label}.`);
  }
  assert.match(html, /<button class="nav-btn active nav-direct" data-tab="tab-inbox" aria-current="page">/, "GM Inbox must be a direct navigation item.");
  assert.match(html, /<option value="tab-inbox" selected>/, "Initial mobile navigation must match the active section.");
  assert.match(html, /<div id="tab-inbox" class="tab-page active">/, "Initial content panel must match the active navigation item.");
  assert.match(html, /<div id="tab-roster" class="tab-page">/, "Roster Overview must not start active.");
  assert.doesNotMatch(html, /id="demoLeagueBtn"|>Explore demo</, "The demo entry point should not clutter the main app header.");
  assert.doesNotMatch(html, /tab-workspace|Workspace &amp; Backups|id="(?:saveWorkspaceBtn|exportWorkspaceBtn|restoreWorkspaceBtn)"/, "Manual backup tools must not appear in the app.");
  assert.match(html, /<details class="control-section league-section">[\s\S]*?<summary class="control-section-heading">CURRENT LEAGUE<\/summary>/, "Secondary league selectors should stay tucked away until needed.");
});

test("page reload updates connected leagues without manual refresh controls", () => {
  const app = read("app.js");
  assert.doesNotMatch(read("index.html"), /id="(?:retryDataBtn|refresh[^"]*Btn)"|>Refresh analysis</);
  assert.match(app, /await initApp\(true, false, true\);/, "Resuming a league must update player statuses rather than relying solely on the 24-hour cache.");
  assert.match(app, /await initApp\(false, false, true\);/, "A normal page load must also request fresh player statuses.");
  assert.match(app, /const data = await fetchEspnLeague\(league\.leagueId, league\.season\)/, "ESPN refresh must fetch current league data instead of reusing its saved response.");
  assert.match(app, /Yahoo roster data is a file snapshot\. Re-import the file to refresh it\./, "File-import leagues should explain how their data is refreshed.");
  assert.match(app, /markDataSource\("league", error\)/, "League refresh failures should be surfaced in data freshness.");
});

test("phone landscape layout and player chart provide responsive reading affordances", () => {
  const html = read("index.html");
  const css = read("styles.css");
  const app = read("app.js");

  assert.match(css, /@media \(max-width:960px\) and \(orientation:landscape\) and \(max-height:500px\)/, "Phone landscape must use a compact horizontal layout.");
  assert.match(css, /\.body-layout \{ flex-direction:row;/, "Landscape layout must keep navigation beside the content.");
  assert.match(html, /id="analyticsChartHelp"/, "Chart should explain how to read its plotted points.");
  assert.match(html, /class="analytics-chart" role="img"/, "Chart should have an accessible description.");
  assert.match(app, /chartPoints\.filter\(point => point\.rank < 10\)/, "Only the top ten ranked players should receive chart labels to limit overlap.");
  assert.doesNotMatch(app, /if \(rank >= 10\)/, "Lower-ranked players must retain team logos, not anonymous dots.");
  assert.match(app, /layoutAnalyticsMarkers\(pool\.map/, "Chart logos must be laid out with collision avoidance.");
  assert.match(html, /Connectors link separated logos to exact data points/, "Displaced markers must explain their exact plotted values.");
});

test("connected layout and page hierarchy avoid redundant introductory cards", () => {
  const html = read("index.html");
  const app = read("app.js");
  const panels = [...html.matchAll(/<div id="(tab-[^"]+)" class="tab-page(?: active)?">([\s\S]*?)(?=<div id="tab-|<\/main>)/g)];
  assert.equal(panels.length, 17);
  for (const [, id, content] of panels) assert.match(content, /<h2\b/, `${id} must have a proper page heading.`);
  assert.match(html, /<details id="connectionSettings"[^>]*open>/);
  assert.match(app, /connection\.open = !connected/);
  assert.doesNotMatch(app, /"Your next moves"/, "Inbox must not reintroduce a duplicate introductory banner.");
  assert.match(html, /id="gmInboxDataDetails"/, "Source caveats must remain accessible without the removed banner.");
  assert.match(read("styles.css"), /\.connection-fields \.account-field \{ grid-column:1; grid-row:2; \}/);
});

test("browser regression harness is wired to the app and includes saved-state coverage", () => {
  const html = read("tests/optimizer-regression.html");
  const appHtml = read("index.html");

  assert.match(html, /src="\.\.\/index\.html\?v=20261031-visual-hierarchy-1&amp;resume=0"/, "Regression harness must load the current app release without resuming personal snapshots.");
  assert.doesNotMatch(appHtml, /id="loadRecordsBtn"/, "Records must load automatically without a manual refresh button.");
  assert.match(html, /runOptimizerFixtures/, "Regression harness must execute its fixtures.");
  assert.match(html, /Cross-league queue saves to target budget/, "Saved FAAB state should remain covered.");
  assert.match(html, /Newsletter standings movement uses saved issue/, "Saved newsletter state should remain covered.");
  assert.match(appHtml, /id="gmInboxFilter"/, "GM Inbox must provide action filters.");
  assert.match(html, /GM Inbox action filters group recommendation types/, "GM Inbox action categories should remain covered.");
  assert.match(appHtml, /id="tab-compare"/, "Dedicated player comparison must remain accessible.");
  assert.match(html, /Player comparison blocks moves involving kickoff-locked players/, "Player comparison must retain lock regression coverage.");
  assert.match(appHtml, /id="tab-grades"/, "Team grades must remain accessible.");
  assert.match(html, /Team grades use exact documented thresholds/, "Team grade thresholds must retain regression coverage.");
  assert.match(appHtml, /id="draftGrades"/, "Draft review must be available in the Draft Room.");
  assert.match(html, /Draft ADP grades use exact round-value thresholds/, "Draft grade boundaries must remain covered.");
  assert.match(appHtml, /id="tab-planner"/, "Multiweek planning must remain accessible.");
  assert.match(html, /Multiweek planner never counts one player in two starter slots/, "Multiweek slot coverage must remain covered.");
});

test("Inbox integrates a compact recap and keeps recreational tools secondary", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.doesNotMatch(html, /(?:id|data-tab|value)="tab-newsletter"/, "Newsletter must not remain a duplicate destination.");
  assert.match(html, /<details id="inboxRecap" class="gm-secondary">/, "The recap should be collapsed within Inbox.");
  assert.match(html, /id="gmSchedule"/, "Upcoming coverage belongs alongside decisions.");
  assert.match(app, /matching\.slice\(0, 3\)/, "Only three actions should be shown initially.");
  assert.match(app, /summary: summary\.slice\(0, 3\)/, "Recaps should have at most three highlights.");
  assert.match(app, /leagueRecordsCache\.get\(getLeagueRecordsKey\(league\)\)/, "Recaps must use completed results, not current live scores.");
  assert.match(app, /gmSchedule"\)\?\.addEventListener\("click", handleGMInboxClick\)/, "Schedule shortcuts must actually navigate.");
});

test("navigation provides an accessible content landmark and consistent destination order", () => {
  const html = read("index.html");
  assert.match(html, /<a class="skip-to-tool" href="#mainContent">/, "Keyboard users need a shortcut past navigation.");
  assert.match(html, /<main id="mainContent" class="content-stack" tabindex="-1" aria-label="Current tool">/, "The current tool needs a focusable main landmark.");
  const desktop = [...html.matchAll(/data-tab="(tab-[^"]+)"/g)].map(match => match[1]);
  const mobile = [...html.matchAll(/<option value="(tab-[^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(desktop, mobile, "Desktop and mobile destinations should appear in exactly the same order.");
});

test("decision tools use existing destinations and disclose unverified provider data", () => {
  const html = read("index.html");
  assert.equal([...html.matchAll(/class="tab-page(?: active)?"/g)].length, 17);
  assert.match(html, /id="decisionDataStatus"[^>]*role="status"/);
  assert.match(html, /id="gmChecklist"[^>]*aria-label="Game-day checklist"/);
  assert.match(html, /id="optimizerChecklist"[^>]*aria-label="Game-day checklist"/);
  assert.match(html, /provider balance and waiver deadline are not verified/);
  assert.doesNotMatch(html, /<option value="custom">Custom<\/option>|ADP consensus/);
});

test("shared fetch helper reports network, HTTP, JSON, timeout and successful responses", async () => {
  const sandbox = {
    window: {},
    location: { href: "https://fantasy.example/" },
    URL,
    AbortController, AbortSignal, setTimeout, clearTimeout,
    fetch: async () => ({ ok: true, json: async () => ({ ready: true }) })
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(read("data-fetch.js"), context, { filename: "data-fetch.js" });
  const fetchJson = sandbox.window.FFOData.fetchJson;

  assert.deepEqual(await fetchJson("https://api.example/v1/success"), { ready: true });

  sandbox.fetch = async () => ({ ok: false, status: 404 });
  await assert.rejects(fetchJson("https://api.example/v1/missing"), /api\.example returned 404 for \/v1\/missing/);

  sandbox.fetch = async () => { throw vm.runInContext('new TypeError("Failed to fetch")', context); };
  await assert.rejects(fetchJson("https://api.example/v1/offline"), /Request to api\.example\/v1\/offline failed: Failed to fetch/);

  sandbox.fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError("Invalid JSON"); } });
  await assert.rejects(fetchJson("https://api.example/v1/malformed"), /api\.example returned invalid JSON for \/v1\/malformed/);
  let triggerTimeout;
  let timeoutCleared = false;
  sandbox.setTimeout = (callback, delay) => { triggerTimeout = callback; assert.equal(delay, 20000); return 42; };
  sandbox.clearTimeout = id => { timeoutCleared = id === 42; };
  sandbox.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  const pendingRequest = fetchJson("https://api.example/v1/hung");
  triggerTimeout();
  await assert.rejects(pendingRequest, /timed out after 20 seconds/);
  assert.equal(timeoutCleared, true);
});
