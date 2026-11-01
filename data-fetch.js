(() => {
  // Several tools request the same public Sleeper feeds during one load; share one response briefly.
  const SHARED_TTL_MS = 30000;
  const SHARED_FEEDS = /^https:\/\/api\.sleeper\.app\/v1\/(state\/nfl|projections\/nfl\/regular\/\d{4}\/\d+)$/;
  const shared = new Map();

  function fetchJson(input, options) {
    const url = String(input);
    if (options || !SHARED_FEEDS.test(url)) return requestJson(input, options);
    const hit = shared.get(url);
    // Reuse only responses produced by the current fetch implementation (tests and extensions may swap it).
    if (hit && hit.fetch === window.fetch && Date.now() - hit.at < SHARED_TTL_MS) return hit.promise.then(data => structuredClone(data));
    const promise = requestJson(input);
    shared.set(url, { at: Date.now(), fetch: window.fetch, promise });
    promise.catch(() => { if (shared.get(url)?.promise === promise) shared.delete(url); });
    return promise.then(data => structuredClone(data));
  }

  async function requestJson(input, options) {
    const endpoint = new URL(String(input), location.href);
    const controller = new AbortController();
    const signal = options?.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      let response;
      try {
        response = await fetch(input, { ...options, signal });
      } catch (error) {
        const message = controller.signal.aborted ? "timed out after 20 seconds" : error instanceof Error ? error.message : String(error);
        throw new Error(`Request to ${endpoint.host}${endpoint.pathname} failed: ${message}`);
      }
      if (!response.ok) throw new Error(`${endpoint.host} returned ${response.status} for ${endpoint.pathname}.`);
      try {
        return await response.json();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (controller.signal.aborted) throw new Error(`Request to ${endpoint.host}${endpoint.pathname} timed out after 20 seconds.`);
        throw new Error(`${endpoint.host} returned invalid JSON for ${endpoint.pathname}: ${message}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  window.FFOData = Object.freeze({ fetchJson });
})();
