const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("handcuffs only select known lower-depth healthy RBs on the same team", () => {
  const players = [
    { id: "starter", team: "KC", position: "RB", depthOrder: 1, isCurrentNfl: true },
    { id: "backup", team: "KC", position: "RB", depthOrder: 2, isCurrentNfl: true },
    { id: "third", team: "KC", position: "RB", depthOrder: 3, isCurrentNfl: true },
    { id: "unknown", team: "KC", position: "RB", depthOrder: 0, isCurrentNfl: true }
  ];
  const context = { window: {}, document: { addEventListener() {} }, PLAYER_INDEX_BY_TEAM: new Map([["KC", players]]) };
  vm.runInNewContext(read("playoff-push.js"), context);
  const find = context.window.FFOPlayoffPush.findHandcuff;
  assert.equal(find(players[0]).id, "backup");
  assert.equal(find(players[1]).id, "third");
  assert.equal(find(players[2]), null, "A starter must not be relabeled as the backup of a third-string player.");
  assert.equal(find(players[3]), null, "Unknown depth is not sufficient evidence.");
  players[1].injuryStatus = "Out";
  assert.equal(find(players[0]).id, "third");
});

test("playoff labels never imply mathematical must-win, clinch or elimination", () => {
  const context = { window: {}, document: { addEventListener() {} } };
  vm.runInNewContext(read("playoff-push.js"), context);
  const classify = context.window.FFOPlayoffPush.classifyLeague;
  for (const rank of [1, 6, 7, 12]) {
    for (const gap of [-7, -1, 0, 1, 7, null]) {
      for (const playoffStart of [15, undefined]) {
        const result = classify({ playoffStart, standing: { rank, playoffTeams: 6, gap } }, 10);
        assert.doesNotMatch(result.status, /must-win|clinched|eliminated/i);
      }
    }
  }
});

function usageContext(consent, previousWeek) {
  const values = new Map(consent ? [["fantasy-front-office:usage-consent:v1", "yes"]] : []);
  if (previousWeek) values.set("fantasy-front-office:usage-consent:v1:last-visit", String(previousWeek));
  const requests = [];
  const context = {
    window: {}, console, URLSearchParams, Date, Set,
    document: { querySelectorAll: () => [{ dataset: { tab: "tab-opt" } }], addEventListener() {} },
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: true }; }
  };
  vm.runInNewContext(read("usage-metrics.js"), context);
  return { track: context.window.FFOUsage.track, requests, values };
}

test("usage tracking is opt-in and does not send anything by default", async () => {
  const { track, requests } = usageContext(false);
  await track("connect_success", { provider: "sleeper" });
  assert.equal(requests.length, 0);
});

test("regular opted-in visitors report a new reporting week without transmitting dates or IDs", () => {
  const week = Math.floor(Date.now() / (7 * 86400000));
  const returning = usageContext(true, week - 1);
  assert.deepEqual(returning.requests.map(entry => JSON.parse(entry.options.body).event), ["visit", "return_week"]);
  const sameWeek = usageContext(true, week);
  assert.equal(sameWeek.requests.length, 1);
  assert.equal(returning.values.get("fantasy-front-office:usage-consent:v1:last-visit"), String(week));
});

test("usage tracking strictly limits payloads and deduplicates per page load", async () => {
  const { track, requests } = usageContext(true);
  await track("tool_open", { provider: "sleeper", tool: "tab-opt", username: "do-not-send" });
  await track("tool_open", { provider: "sleeper", tool: "tab-opt" });
  await track("unrecognized_event");
  await track("connect_failure", { provider: "private-user-value" });
  await track("tool_open", { tool: "https://example.test/?user=secret" });
  assert.equal(requests.length, 2, "One visit and one tool event only.");
  assert.deepEqual(JSON.parse(requests[1].options.body), { event: "tool_open", provider: "sleeper", tool: "tab-opt" });
  assert.equal(requests[1].options.referrerPolicy, "no-referrer");
  assert.equal(requests[1].options.credentials, "omit");
  assert.ok(requests.every(request => request.url === "/api/usage"));
});

const endpoint = () => import(`data:text/javascript;base64,${Buffer.from(read("functions/api/usage.js")).toString("base64")}`);
function request(payload, options = {}) {
  return new Request("https://fantasyfo.com/api/usage", {
    method: "POST", headers: { Origin: "https://fantasyfo.com", "Content-Type": "application/json", ...options.headers },
    body: typeof payload === "string" ? payload : JSON.stringify(payload)
  });
}

test("first-party usage endpoint accepts only fixed fields and writes no request metadata", async () => {
  const { onRequest } = await endpoint();
  const writes = [];
  const env = { FFO_USAGE: { writeDataPoint: point => writes.push(point) } };
  const valid = { event: "connect_success", provider: "sleeper", tool: "none" };
  assert.equal((await onRequest({ request: request(valid), env })).status, 204);
  assert.deepEqual(writes, [{ blobs: ["connect_success", "sleeper", "none"], doubles: [1] }]);
  for (const invalid of [{ ...valid, username: "private" }, { ...valid, event: "unknown" }, null, [], "not json"]) {
    assert.equal((await onRequest({ request: request(invalid), env })).status, 400);
  }
  assert.equal((await onRequest({ request: request(valid, { headers: { Origin: "https://other.test" } }), env })).status, 403);
  assert.equal((await onRequest({ request: request("x".repeat(513)), env })).status, 413);
  assert.equal((await onRequest({ request: request(valid, { headers: { "Content-Type": "text/plain" } }), env })).status, 415);
  assert.equal(writes.length, 1);
});

test("unconfigured measurement explicitly reports unavailable instead of accepting events", async () => {
  const { onRequest } = await endpoint();
  const response = await onRequest({ request: request({ event: "visit", provider: "none", tool: "none" }), env: {} });
  assert.equal(response.status, 503);
  assert.match(await response.text(), /not configured/);
  assert.equal((await onRequest({ request: new Request("https://fantasyfo.com/api/usage"), env: {} })).status, 503);
  assert.equal((await onRequest({ request: new Request("https://fantasyfo.com/api/usage"), env: { FFO_USAGE: {} } })).status, 200);
});

test("release metadata matches the app assets and fresh welcome avoids eager database initialization", () => {
  const release = JSON.parse(read("release.json"));
  const version = read("index.html").match(/app\.js\?v=([^"]+)/)[1];
  assert.equal(release.version, version);
  const app = read("app.js");
  assert.match(app, /if \(params\.get\("resume"\) === "0"\) return;/);
  assert.match(app, /await ensureFootballData\(\)/);
  for (const file of ["usage-metrics.js", "release-updates.js"]) {
    const result = require("node:child_process").spawnSync(process.execPath, ["--check", path.join(__dirname, "..", file)], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
});

test("release prompts are dismissible and failed snapshot saves never trigger reload", async () => {
  let version = "20261102-trust-1";
  let clock = 60001;
  let banner = null;
  let reloads = 0;
  let saveSuccess = false;
  const controls = new Map(["[data-release-later]", "[data-release-reload]", "[role=status]"].map(selector => [
    selector, { disabled: false, addEventListener(name, callback) { this[name] = callback; } }
  ]));
  const context = {
    window: {}, URL, console: { warn() {}, error() {} },
    Date: { now: () => clock }, setInterval() {}, setTimeout() {},
    location: { reload() { reloads += 1; } },
    saveReloadWorkspace: async () => saveSuccess,
    fetch: async () => ({ ok: true, json: async () => ({ version }) }),
    document: {
      hidden: false, addEventListener() {},
      querySelector: selector => selector === "main" ? { prepend: node => { banner = node; } } : { src: "https://fantasyfo.com/app.js?v=20261102-trust-1" },
      getElementById: () => banner,
      createElement: () => ({ setAttribute() {}, querySelector: selector => controls.get(selector), remove() { banner = null; } })
    }
  };
  vm.runInNewContext(read("release-updates.js"), context);
  const check = () => context.window.FFOReleaseUpdates.check();
  await check();
  assert.equal(banner, null);
  version = "20261102-trust-2";
  clock += 60001;
  await check();
  assert.ok(banner, "A different release should offer a reload.");
  const reload = controls.get("[data-release-reload]");
  await reload.click({ currentTarget: reload });
  assert.equal(reloads, 0);
  assert.equal(reload.disabled, false);
  assert.match(controls.get("[role=status]").textContent, /Could not finish saving/);
  saveSuccess = true;
  await reload.click({ currentTarget: reload });
  assert.equal(reloads, 1);
  controls.get("[data-release-later]").click();
  assert.equal(banner, null);
  clock += 60001;
  await check();
  assert.equal(banner, null, "Later suppresses the same release for this session.");
});
