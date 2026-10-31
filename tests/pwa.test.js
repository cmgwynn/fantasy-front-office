const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("app manifest launches cleanly in standalone mode with correctly sized icons", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.id, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.name, "Fantasy Front Office");
  assert.ok(manifest.icons.some(icon => icon.purpose === "maskable" && icon.sizes === "512x512"));
  for (const icon of [...manifest.icons, { src: "/icons/apple-touch-icon.png", sizes: "180x180" }]) {
    const png = fs.readFileSync(path.join(root, icon.src.slice(1)));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
  for (const file of ["index.html", "install.html"]) {
    const html = read(file);
    assert.match(html, /rel="manifest" href="manifest.webmanifest"/);
    assert.match(html, /rel="apple-touch-icon" href="icons\/apple-touch-icon.png"/);
    assert.match(html, /data-install-app/);
    assert.match(html, /id="appInstallStatus"/);
    assert.match(html, /src="pwa.js\?v=/);
  }
});

function workerFixture() {
  const listeners = {};
  const saved = new Map();
  const deleted = [];
  const offline = new Response(read("offline.html"), { headers: { "Content-Type": "text/html" } });
  const cache = {
    add: async request => { saved.set(request.url, offline); },
    match: async url => saved.get(new URL(url, "https://fantasyfo.com").href)
  };
  const sandbox = {
    self: {
      location: { origin: "https://fantasyfo.com" },
      addEventListener: (name, handler) => { listeners[name] = handler; },
      skipWaiting: async () => {},
      clients: { claim: async () => {} }
    },
    caches: {
      open: async () => cache,
      keys: async () => ["ffo-offline-v0", "ffo-offline-v1", "other-app-cache"],
      delete: async name => { deleted.push(name); }
    },
    Request: class extends Request {
      constructor(url, options) { super(new URL(url, "https://fantasyfo.com"), options); }
    },
    Response, URL,
    fetch: async () => new Response("Current online page")
  };
  vm.runInNewContext(read("service-worker.js"), sandbox);
  const lifecycle = async name => {
    let promise;
    listeners[name]({ waitUntil: value => { promise = value; } });
    await promise;
  };
  const fetchRequest = async request => {
    let promise;
    listeners.fetch({ request, respondWith: value => { promise = value; } });
    return promise ? await promise : null;
  };
  return { sandbox, saved, deleted, lifecycle, fetchRequest };
}

test("worker caches only offline guidance and cleans up only its own older cache", async () => {
  const worker = workerFixture();
  await worker.lifecycle("install");
  await worker.lifecycle("activate");
  assert.deepEqual([...worker.saved.keys()], ["https://fantasyfo.com/offline.html"]);
  assert.deepEqual(worker.deleted, ["ffo-offline-v0"]);
  const offline = read("offline.html");
  assert.doesNotMatch(offline, /<script|<link|https:\/\//);
  assert.match(offline, /You're offline/);
  assert.match(read("_headers"), /\/service-worker\.js\n  Cache-Control: no-cache/);
  assert.match(read("_headers"), /no-cache, no-transform/);
});

test("worker never caches provider data or app assets and preserves HTTP failures", async () => {
  const worker = workerFixture();
  await worker.lifecycle("install");
  for (const request of [
    { url: "https://api.sleeper.app/v1/league/123", method: "GET", mode: "cors" },
    { url: "https://fantasyfo.com/app.js", method: "GET", mode: "no-cors" },
    { url: "https://fantasyfo.com/", method: "POST", mode: "navigate" }
  ]) assert.equal(await worker.fetchRequest(request), null);
  const navigation = { url: "https://fantasyfo.com/?provider=sleeper&user=private", method: "GET", mode: "navigate" };
  assert.equal(await (await worker.fetchRequest(navigation)).text(), "Current online page");
  worker.sandbox.fetch = async () => new Response("Provider error", { status: 503 });
  assert.equal((await worker.fetchRequest(navigation)).status, 503);
  worker.sandbox.fetch = async () => { throw new TypeError("Network unavailable"); };
  const cached = worker.saved.get("https://fantasyfo.com/offline.html");
  Object.defineProperty(cached, "redirected", { value: true });
  const fallback = await worker.fetchRequest(navigation);
  assert.equal(fallback.redirected, false, "Cloudflare's redirected offline document must become a valid navigation response.");
  assert.match(await fallback.text(), /You're offline/);
  assert.equal(worker.saved.size, 1);
  worker.saved.clear();
  assert.equal((await worker.fetchRequest(navigation)).status, 503);
});

function installFixture({ installed = false, failedRegistration = false, hostname = "fantasyfo.com" } = {}) {
  const listeners = {};
  const clicks = [];
  const links = [{ hidden: false, addEventListener: (_, callback) => clicks.push(callback) }];
  const status = { textContent: "" };
  const registrations = [];
  const errors = [];
  const sandbox = {
    document: { querySelectorAll: () => links, getElementById: () => status },
    window: {
      isSecureContext: true,
      matchMedia: () => ({ matches: installed, addEventListener: () => {} }),
      addEventListener: (name, handler) => { listeners[name] = handler; }
    },
    navigator: { serviceWorker: { register: async (...args) => {
      registrations.push(args);
      if (failedRegistration) throw new Error("Worker blocked");
    } } },
    location: { hostname },
    console: { error: (...args) => errors.push(args) }
  };
  vm.runInNewContext(read("pwa.js"), sandbox);
  return { listeners, clicks, links, status, registrations, errors };
}

test("install prompt requires a click, is consumed once, and cancellation remains explicit", async () => {
  const fixture = installFixture();
  let prompts = 0, prevented = 0;
  fixture.listeners.beforeinstallprompt({
    preventDefault: () => {},
    prompt: async () => { prompts++; },
    userChoice: Promise.resolve({ outcome: "dismissed" })
  });
  assert.equal(prompts, 0);
  await fixture.clicks[0]({ preventDefault: () => { prevented++; } });
  assert.equal(prompts, 1);
  assert.match(fixture.status.textContent, /cancelled/);
  await fixture.clicks[0]({ preventDefault: () => { prevented++; } });
  assert.equal(prevented, 1, "Without a prompt, the link must retain normal navigation to help.");
});

test("standalone apps hide install links and registration failures are surfaced", async () => {
  const installed = installFixture({ installed: true });
  assert.equal(installed.links[0].hidden, true);
  const failed = installFixture({ failedRegistration: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(failed.status.textContent, /could not finish/);
  assert.equal(failed.errors.length, 1);
  assert.equal(failed.registrations[0][0], "/service-worker.js?v=20261031-app-install-2");
  const oldDomain = installFixture({ hostname: "fantasy-front-office.pages.dev" });
  assert.equal(oldDomain.registrations.length, 0, "Do not create a second installed app on the old domain.");
});
