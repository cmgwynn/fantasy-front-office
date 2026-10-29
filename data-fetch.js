(() => {
  async function fetchJson(input, options) {
    const endpoint = new URL(String(input), location.href);
    let response;
    try {
      response = await fetch(input, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Request to ${endpoint.host}${endpoint.pathname} failed: ${message}`);
    }
    if (!response.ok) throw new Error(`${endpoint.host} returned ${response.status} for ${endpoint.pathname}.`);
    try {
      return await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${endpoint.host} returned invalid JSON for ${endpoint.pathname}: ${message}`);
    }
  }

  window.FFOData = Object.freeze({ fetchJson });
})();
