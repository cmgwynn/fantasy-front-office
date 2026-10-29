const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("browser JavaScript entry points parse", () => {
  for (const file of ["app.js", "data-fetch.js", "demo-league.js", "league-records.js", "monetization-config.js"]) {
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
});

test("HTML references existing local assets in the expected script order", () => {
  const html = read("index.html");
  const assets = [
    ...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)
  ].map(match => match[1]).filter(asset => !/^(?:[a-z]+:)?\/\//i.test(asset));

  assert.ok(assets.length > 0, "Expected local CSS or JavaScript assets.");
  assert.ok(assets.every(asset => asset.endsWith("?v=20261029-inbox-3")), "All local assets must use the current release version.");
  for (const asset of assets) {
    assert.ok(fs.existsSync(path.join(root, asset.split("?")[0])), `Missing local asset: ${asset}`);
  }

  const configIndex = html.indexOf('<script src="monetization-config.js?');
  const dataFetchIndex = html.indexOf('<script src="data-fetch.js?');
  const demoIndex = html.indexOf('<script src="demo-league.js?');
  const recordsIndex = html.indexOf('<script src="league-records.js?');
  const appIndex = html.indexOf('<script src="app.js?');
  assert.ok(configIndex >= 0, "Monetization configuration script is missing.");
  assert.ok(dataFetchIndex > configIndex, "Data-fetch module must load after configuration.");
  assert.ok(demoIndex > dataFetchIndex, "Demo module must load before the app.");
  assert.ok(recordsIndex > demoIndex, "Records module must load after the demo module.");
  assert.ok(appIndex > recordsIndex, "App script must load after its dependencies.");
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
  assert.match(html, /<button class="nav-btn active" data-tab="tab-inbox" aria-current="page">/, "Initial active section must be the first navigation item.");
  assert.match(html, /<option value="tab-inbox" selected>/, "Initial mobile navigation must match the active section.");
  assert.match(html, /<div id="tab-inbox" class="tab-page active">/, "Initial content panel must match the active navigation item.");
  assert.match(html, /<div id="tab-roster" class="tab-page">/, "Roster Overview must not start active.");
});

test("browser regression harness is wired to the app and includes saved-state coverage", () => {
  const html = read("tests/optimizer-regression.html");
  const appHtml = read("index.html");

  assert.match(html, /src="\.\.\/index\.html\?v=20261029-inbox-3"/, "Regression harness must load the current app release.");
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
});

test("shared fetch helper reports network, HTTP, JSON, and successful responses", async () => {
  const sandbox = {
    window: {},
    location: { href: "https://fantasy.example/" },
    URL,
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
});
