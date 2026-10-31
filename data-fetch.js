(() => {
  async function fetchJson(input, options) {
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
