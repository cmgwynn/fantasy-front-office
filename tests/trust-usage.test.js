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

function usageContext(consent, previousWeek, { us = false, privacy = false, beta = false, service = true, storageFails = false } = {}) {
  const values = new Map(consent ? [["fantasy-front-office:usage-consent:v1", consent === "no" ? "no" : "yes"]] : []);
  if (beta) values.set("fantasy-front-office:usage-beta-agreement:v1", "yes");
  if (previousWeek) values.set("fantasy-front-office:usage-consent:v1:last-visit", String(previousWeek));
  const requests = [];
  const listeners = {};
  const choice = {};
  const controls = [{ id: "syncBtn", dataset: {}, setAttribute() {} }, { dataset: {}, setAttribute() {} }];
  const nodes = { "[data-usage-connect-choice]": choice, ".usage-connect-heading": {}, ".usage-connect-status": {} };
  const notice = { innerHTML: "", classList: { toggle() {} }, querySelector: selector => selector === "[data-usage-connect-choice]" && !notice.innerHTML ? null : nodes[selector] };
  const context = {
    window: {}, navigator: { globalPrivacyControl: privacy }, console, URLSearchParams, Date, Set,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    document: {
      dispatchEvent() {}, getElementById: () => null, querySelector: () => ({ value: "sleeper" }),
      querySelectorAll: selector => selector === ".nav-btn" ? [{ dataset: { tab: "tab-opt" } }] : selector === "[data-usage-connect]" ? [notice] : controls,
      addEventListener(event, callback) { listeners[event] = callback; }
    },
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => { if (storageFails) throw new Error("Storage blocked"); values.set(key, value); }, removeItem: key => { if (storageFails) throw new Error("Storage blocked"); values.delete(key); } },
    fetch: async (url, options) => {
      if (options.method === "POST") requests.push({ url, options });
      return { ok: service, headers: new Headers({ "X-FFO-Connected-Beta": us ? "eligible" : "unavailable" }) };
    }
  };
  vm.runInNewContext(read("usage-metrics.js"), context);
  return { ...context.window.FFOUsage, requests, values, notice, listeners, choice, controls };
}

test("usage tracking does not send events without beta agreement", async () => {
  const { track, requests } = usageContext(false);
  await track("connect_success", { provider: "sleeper" });
  assert.equal(requests.length, 0);
});

test("US beta agreement is unchecked and required before connecting", async () => {
  const usage = usageContext(false, undefined, { us: true });
  assert.equal(await usage.checkAccess(), false);
  assert.equal(usage.choice.checked, false);
  assert.ok(usage.controls.every(control => control.disabled));
  assert.match(usage.notice.innerHTML, /Required to sync a league/);
  await usage.track("connect_success", { provider: "sleeper" });
  assert.equal(usage.requests.length, 0);
  assert.equal(await usage.requireConnectionAccess(), false);
  usage.listeners.change({ target: { matches: () => true, checked: true } });
  assert.ok(usage.controls.every(control => !control.disabled), "Explicit acceptance enables sync immediately.");
  assert.equal(await usage.requireConnectionAccess(), true);
  await usage.track("connect_start", { provider: "sleeper" });
  await usage.track("connect_success", { provider: "sleeper" });
  assert.deepEqual(usage.requests.map(entry => JSON.parse(entry.options.body).event), ["visit", "connect_start", "connect_success"]);
  assert.equal(usage.values.get("fantasy-front-office:usage-consent:v1"), "yes");
  assert.equal(usage.values.get("fantasy-front-office:usage-beta-agreement:v1"), "yes");
});

test("saved optional choices do not imply beta agreement and browser privacy signals block access", async () => {
  for (const [consent, privacy, beta] of [["no", false, false], [true, false, false], [true, true, true]]) {
    const usage = usageContext(consent, undefined, { us: true, privacy, beta });
    assert.equal(await usage.checkAccess(), false);
    await usage.track("connect_success", { provider: "espn" });
    assert.equal(usage.requests.length, 0);
  }
});

test("withdrawing beta agreement immediately pauses access and stops future events", async () => {
  const usage = usageContext(true, undefined, { us: true, beta: true });
  assert.equal(await usage.checkAccess(), true);
  const before = usage.requests.length;
  usage.listeners.change({ target: { matches: () => true, checked: false } });
  assert.equal(usage.isAllowed(), false);
  assert.ok(usage.controls.every(control => control.disabled));
  await usage.track("connect_success", { provider: "sleeper" });
  assert.equal(usage.requests.length, before);
  assert.equal(usage.values.get("fantasy-front-office:usage-consent:v1"), "no");
  assert.equal(usage.values.has("fantasy-front-office:usage-beta-agreement:v1"), false);
});

test("non-US/unknown locations, unavailable service and failed agreement saves cannot unlock beta access", async () => {
  for (const options of [{}, { us: true, privacy: true }, { us: true, service: false }, { us: true, storageFails: true }]) {
    const usage = usageContext(false, undefined, options);
    await usage.checkAccess();
    usage.listeners.change({ target: { matches: () => true, checked: true } });
    assert.equal(await usage.requireConnectionAccess(), false);
    assert.equal(usage.requests.length, 0);
  }
});

test("withdrawal stops in-memory access even when browser storage fails", async () => {
  const usage = usageContext(true, undefined, { us: true, beta: true, storageFails: true });
  assert.equal(await usage.checkAccess(), true);
  const before = usage.requests.length;
  usage.listeners.change({ target: { matches: () => true, checked: false } });
  assert.equal(usage.isAllowed(), false);
  await usage.track("tool_open", { tool: "tab-opt" });
  assert.equal(usage.requests.length, before);
});

test("agreement updates preserve a busy sync button until its connection attempt ends", async () => {
  const usage = usageContext(true, undefined, { us: true, beta: true });
  await usage.checkAccess();
  usage.controls[0].dataset.syncBusy = "true";
  usage.mountConnectionChoices();
  assert.equal(usage.controls[0].disabled, true);
  assert.equal(usage.controls[1].disabled, false);
  delete usage.controls[0].dataset.syncBusy;
  usage.mountConnectionChoices();
  assert.equal(usage.controls[0].disabled, false);
});

test("usage privacy has scoped spacing, disclosure sections and an associated consent label", () => {
  const source = read("usage-metrics.js");
  assert.match(source, /class="usage-dialog-body"/);
  assert.match(source, /What gets shared/);
  assert.match(source, /What stays private/);
  assert.match(source, /class="usage-consent" for="usageConsent"/);
  assert.match(source, /class="share-dialog-actions"/);
  assert.match(read("styles.css"), /\.usage-dialog \{ overflow:auto; \}/);
});

test("returning beta participants report a new week without transmitting dates or IDs", async () => {
  const week = Math.floor(Date.now() / (7 * 86400000));
  const returning = usageContext(true, week - 1, { us: true, beta: true });
  await returning.checkAccess();
  assert.deepEqual(returning.requests.map(entry => JSON.parse(entry.options.body).event), ["visit", "return_week"]);
  const sameWeek = usageContext(true, week, { us: true, beta: true });
  await sameWeek.checkAccess();
  assert.equal(sameWeek.requests.length, 1);
  assert.equal(returning.values.get("fantasy-front-office:usage-consent:v1:last-visit"), String(week));
});

test("usage tracking strictly limits payloads and counts repeated tool opens", async () => {
  const { track, requests, checkAccess } = usageContext(true, undefined, { us: true, beta: true });
  await checkAccess();
  await track("tool_open", { provider: "sleeper", tool: "tab-opt", username: "do-not-send" });
  await track("tool_open", { provider: "sleeper", tool: "tab-opt" });
  await track("unrecognized_event");
  await track("connect_failure", { provider: "private-user-value" });
  await track("tool_open", { tool: "https://example.test/?user=secret" });
  assert.equal(requests.length, 3, "One visit and two tool opens; not unique users.");
  assert.deepEqual(JSON.parse(requests[1].options.body), { event: "tool_open", provider: "sleeper", tool: "tab-opt" });
  assert.equal(requests[1].options.referrerPolicy, "no-referrer");
  assert.equal(requests[1].options.credentials, "omit");
  assert.ok(requests.every(request => request.url === "/api/usage"));
});

test("connection attempts count each outcome; first recommendation review is once per page", async () => {
  const usage = usageContext(true, undefined, { us: true, beta: true });
  await usage.checkAccess();
  for (const event of ["connect_start", "connect_failure", "connect_start", "connect_success", "recommendation_review", "recommendation_review"]) {
    await usage.track(event, { provider: "sleeper", tool: "tab-opt" });
  }
  const events = usage.requests.map(entry => JSON.parse(entry.options.body).event);
  assert.equal(events.filter(event => event === "connect_start").length, 2);
  assert.equal(events.filter(event => event === "first_recommendation_review").length, 1);
  assert.equal(events.filter(event => event === "recommendation_review").length, 2);
  await usage.track("visit");
  assert.equal(usage.requests.filter(entry => JSON.parse(entry.options.body).event === "visit").length, 1);
});

const endpoint = () => import(`data:text/javascript;base64,${Buffer.from(read("functions/api/usage.js")).toString("base64")}`);
function request(payload, options = {}) {
  const request = new Request("https://fantasyfo.com/api/usage", {
    method: "POST", headers: { Origin: "https://fantasyfo.com", "Content-Type": "application/json", ...options.headers },
    body: typeof payload === "string" ? payload : JSON.stringify(payload)
  });
  Object.defineProperty(request, "cf", { value: { country: "US" } });
  return request;
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
  assert.equal((await onRequest({ request: request(valid, { headers: { "Sec-GPC": "1" } }), env })).status, 403);
  assert.equal((await onRequest({ request: request(valid, { headers: { DNT: "1" } }), env })).status, 403);
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

test("the connection page event destination is allowlisted", async () => {
  const { onRequest } = await endpoint();
  const writes = [];
  const response = await onRequest({
    request: request({ event: "tool_open", provider: "none", tool: "tab-connect" }),
    env: { FFO_USAGE: { writeDataPoint: point => writes.push(point) } }
  });
  assert.equal(response.status, 204);
  assert.deepEqual(writes, [{ blobs: ["tool_open", "none", "tab-connect"], doubles: [1] }]);
});

test("usage writes reject non-US and unknown locations without touching the dataset", async () => {
  const { onRequest } = await endpoint();
  const writes = [];
  for (const country of ["GB", "DE", undefined]) {
    const request = new Request("https://fantasyfo.com/api/usage", {
      method: "POST", headers: { Origin: "https://fantasyfo.com", "Content-Type": "application/json" },
      body: JSON.stringify({ event: "visit", provider: "none", tool: "none" })
    });
    if (country) Object.defineProperty(request, "cf", { value: { country } });
    const response = await onRequest({ request, env: { FFO_USAGE: { writeDataPoint: point => writes.push(point) } } });
    assert.equal(response.status, 403);
  }
  assert.equal(writes.length, 0);
});

test("beta eligibility is US-only, no-store, and respects edge GPC without storing geography", async () => {
  const { onRequest } = await endpoint();
  for (const [country, gpc, configured, expected] of [
    ["US", false, true, "eligible"], ["US", true, true, "unavailable"],
    ["GB", false, true, "unavailable"], ["DE", false, true, "unavailable"],
    [undefined, false, true, "unavailable"], ["US", false, false, "unavailable"]
  ]) {
    const request = new Request("https://fantasyfo.com/api/usage", { headers: gpc ? { "Sec-GPC": "1" } : {} });
    Object.defineProperty(request, "cf", { value: { country } });
    const response = await onRequest({ request, env: configured ? { FFO_USAGE: {} } : {} });
    assert.equal(response.headers.get("X-FFO-Connected-Beta"), expected);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.doesNotMatch(await response.text(), /country|US|GB|DE/);
  }
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
  let version = "20261109-gameday-recovery-1";
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
      querySelector: selector => selector === "main" ? { prepend: node => { banner = node; } } : { src: "https://fantasyfo.com/app.js?v=20261109-gameday-recovery-1" },
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
