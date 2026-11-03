(() => {
  const KEY = "fantasy-front-office:usage-consent:v1";
  const EVENTS = new Set(["visit", "demo_start", "connect_start", "connect_success", "connect_failure", "tool_open", "recommendation_review", "return_week"]);
  const PROVIDERS = new Set(["none", "sleeper", "espn", "yahoo", "demo"]);
  const TOOLS = new Set(["none", ...[...document.querySelectorAll(".nav-btn")].map(button => button.dataset.tab)]);
  const seen = new Set();
  let enabled = false;
  let lastError = "";
  let dialog;
  function report(error) {
    lastError = `Usage measurement unavailable: ${error.message}`;
    console.warn(lastError);
    if (dialog?.open) dialog.querySelector("[role=status]").textContent = lastError;
  }
  try { enabled = localStorage.getItem(KEY) === "yes"; } catch (error) { report(error); }
  async function track(event, { provider = "none", tool = "none" } = {}) {
    if (!enabled || !EVENTS.has(event) || !PROVIDERS.has(provider) || !TOOLS.has(tool)) return;
    const key = `${event}:${provider}:${tool}`;
    if (seen.has(key)) return;
    seen.add(key);
    try {
      const response = await fetch("/api/usage", {
        method: "POST", credentials: "omit", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, provider, tool })
      });
      if (!response.ok) throw new Error(`server returned ${response.status}`);
      lastError = "";
    } catch (error) { seen.delete(key); report(error); }
  }
  function startVisit() {
    track("visit");
    try {
      const previous = Number(localStorage.getItem(`${KEY}:last-visit`));
      const week = Math.floor(Date.now() / (7 * 86400000));
      if (previous && week > previous) track("return_week");
      localStorage.setItem(`${KEY}:last-visit`, String(week));
    } catch (error) { report(error); }
  }
  async function open() {
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "share-dialog usage-dialog";
      dialog.setAttribute("aria-labelledby", "usageTitle");
      dialog.innerHTML = '<div class="share-dialog-head"><h3 id="usageTitle">Usage privacy</h3><button type="button" class="share-dialog-close" aria-label="Close">×</button></div><div class="usage-dialog-body"><p>Help improve Fantasy Front Office by sharing limited usage events. This is optional and off by default.</p><div class="usage-disclosure"><h4>What gets shared</h4><p>Event names, provider type and tool names, such as opening a tool or a connection failing.</p><h4>What stays private</h4><p>No usernames, league IDs, rosters, URL parameters or visitor IDs are included.</p></div><p class="usage-dialog-note">Separate from Cloudflare page-visit analytics. Cloudflare still handles ordinary network metadata. You can turn this off here at any time.</p><label class="usage-consent" for="usageConsent"><input type="checkbox" id="usageConsent"><span><strong>Share limited usage events</strong><small>Help us find connection problems and useful tools.</small></span></label><p class="usage-dialog-status" role="status"></p></div><div class="share-dialog-actions"><button type="button" class="btn-builder-action" data-usage-save>Save preference</button></div>';
      document.body.append(dialog);
      dialog.querySelector(".share-dialog-close").addEventListener("click", () => dialog.close());
      dialog.querySelector("[data-usage-save]").addEventListener("click", () => {
        try {
          const value = dialog.querySelector("#usageConsent").checked;
          localStorage.setItem(KEY, value ? "yes" : "no");
          enabled = value;
          seen.clear();
          if (!enabled) localStorage.removeItem(`${KEY}:last-visit`);
          dialog.querySelector("[role=status]").textContent = enabled ? "Enabled. Only future events will be sent." : "Disabled. No future usage events will be sent.";
          if (enabled) startVisit();
        } catch (error) { report(error); }
      });
    }
    dialog.querySelector("#usageConsent").checked = enabled;
    dialog.querySelector("#usageConsent").disabled = false;
    dialog.querySelector("[role=status]").textContent = lastError || (enabled ? "Currently enabled." : "Currently disabled.");
    dialog.showModal();
    try {
      const response = await fetch("/api/usage", { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
      if (!response.ok) throw new Error("The operator has not enabled the measurement service, or it is temporarily unavailable.");
      lastError = "";
      dialog.querySelector("[role=status]").textContent = enabled ? "Currently enabled." : "Currently disabled.";
    } catch (error) {
      if (!enabled) dialog.querySelector("#usageConsent").disabled = true;
      report(error);
    }
  }
  document.addEventListener("click", event => { if (event.target.closest("[data-usage-settings]")) open(); });
  if (enabled) startVisit();
  window.FFOUsage = Object.freeze({ track });
})();
