(() => {
  const KEY = "fantasy-front-office:usage-consent:v1";
  const BETA_KEY = "fantasy-front-office:usage-beta-agreement:v1";
  const EVENTS = new Set(["visit", "demo_start", "connect_start", "connect_success", "connect_failure", "tool_open", "recommendation_review", "first_recommendation_review", "return_week"]);
  const PROVIDERS = new Set(["none", "sleeper", "espn", "yahoo", "demo"]);
  const TOOLS = new Set(["none", ...[...document.querySelectorAll(".nav-btn")].map(button => button.dataset.tab)]);
  const privacySignal = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";
  const seen = new Set();
  const ONCE_PER_PAGE = new Set(["visit", "return_week", "first_recommendation_review"]);
  let preference = null;
  let agreement = false;
  let available = false;
  let eligible = false;
  let availability;
  let enabled = false;
  let lastError = "";
  let dialog;
  function report(error) {
    lastError = `Usage measurement unavailable: ${error.message}`;
    console.warn(lastError);
    if (dialog?.open) dialog.querySelector("[role=status]").textContent = lastError;
  }
  try {
    preference = localStorage.getItem(KEY);
    agreement = localStorage.getItem(BETA_KEY) === "yes";
  } catch (error) { report(error); }
  const isAllowed = () => available && eligible && !privacySignal && agreement && preference === "yes";
  function accessMessage() {
    if (privacySignal) return "Sync unavailable: your browser requests privacy. We do not override Global Privacy Control or Do Not Track.";
    if (!available) return lastError || "Checking US eligibility. Sync is disabled until this check succeeds.";
    if (!eligible) return "Sync is currently limited to confirmed US locations. Your location is outside the US or could not be confirmed.";
    return lastError || "Accept the agreement to enable sync.";
  }
  function renderConnectionChoices() {
    document.querySelectorAll("[data-usage-connect]").forEach(container => {
      if (!container.querySelector("[data-usage-connect-choice]")) {
        container.innerHTML = '<p class="usage-connect-heading">Required to sync a league</p><label class="usage-connect-choice"><input type="checkbox" data-usage-connect-choice><span><strong>I agree to limited usage measurement (18+)</strong><small>Event, provider and tool names only. No usernames, league IDs or rosters. US-only. Withdrawing pauses tools, not saved plans.</small></span></label><p class="usage-connect-status" role="status"></p><button type="button" class="link-button" data-usage-settings>Read usage privacy and terms</button>';
      }
      const input = container.querySelector("[data-usage-connect-choice]");
      input.checked = isAllowed();
      input.disabled = privacySignal || !available || !eligible;
      container.classList.toggle("is-agreed", isAllowed());
      container.querySelector(".usage-connect-heading").textContent = isAllowed() ? "Usage agreement accepted" : "Required to sync a league";
      container.querySelector(".usage-connect-status").textContent = isAllowed() ? "Agreement saved on this browser. You can now sync." : accessMessage();
    });
    const requirement = document.getElementById("usageSyncRequirement");
    if (requirement) requirement.textContent = isAllowed() ? "Usage agreement accepted. Sync is available." : "Sync is disabled until you accept the usage agreement below.";
    document.querySelectorAll("#syncBtn, #yahooImportFile, [data-usage-continue]").forEach(button => {
      const provider = document.querySelector("#providerSelect")?.value;
      const providerUnavailable = button.id === "syncBtn" && !["sleeper", "espn"].includes(provider);
      button.disabled = !isAllowed() || providerUnavailable || button.dataset.syncBusy === "true";
      button.setAttribute("aria-describedby", "usageSyncRequirement");
    });
  }
  function updateAccess() {
    const wasEnabled = enabled;
    enabled = isAllowed();
    renderConnectionChoices();
    document.dispatchEvent(new CustomEvent("ffo:usage-access", { detail: { allowed: enabled } }));
    if (enabled && !wasEnabled) startVisit();
  }
  function checkAvailability() {
    if (!availability) availability = (async () => {
      try {
        const response = await fetch("/api/usage", { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
        if (!response.ok) throw new Error("The measurement service is temporarily unavailable; connected access is paused.");
        available = true;
        eligible = response.headers.get("X-FFO-Connected-Beta") === "eligible";
        lastError = "";
      } catch (error) {
        available = false;
        eligible = false;
        report(error);
      }
      updateAccess();
      return isAllowed();
    })();
    return availability;
  }
  function saveAgreement(value) {
    if (value && (!available || !eligible || privacySignal)) throw new Error(accessMessage());
    if (value) {
      localStorage.setItem(KEY, "yes");
      localStorage.setItem(BETA_KEY, "yes");
    } else {
      preference = "no";
      agreement = false;
      updateAccess();
      localStorage.removeItem(BETA_KEY);
      localStorage.setItem(KEY, "no");
      localStorage.removeItem(`${KEY}:last-visit`);
    }
    preference = value ? "yes" : "no";
    agreement = value;
    seen.clear();
    updateAccess();
  }
  async function checkAccess() {
    await checkAvailability();
    return isAllowed();
  }
  async function requireConnectionAccess({ refresh = false } = {}) {
    if (refresh) availability = null;
    await checkAvailability();
    if (!isAllowed()) {
      renderConnectionChoices();
      document.dispatchEvent(new CustomEvent("ffo:usage-access", { detail: { allowed: false, requested: true } }));
    }
    return isAllowed();
  }
  async function track(event, { provider = "none", tool = "none" } = {}) {
    if (!enabled || !EVENTS.has(event) || !PROVIDERS.has(provider) || !TOOLS.has(tool)) return;
    const key = ONCE_PER_PAGE.has(event) ? event : `${event}:${provider}:${tool}`;
    if (ONCE_PER_PAGE.has(event) && seen.has(key)) return;
    if (ONCE_PER_PAGE.has(event)) seen.add(key);
    try {
      const response = await fetch("/api/usage", {
        method: "POST", credentials: "omit", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, provider, tool })
      });
      if (!response.ok) throw new Error(`server returned ${response.status}`);
      lastError = "";
      if (event === "recommendation_review") await track("first_recommendation_review", { provider, tool });
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
      dialog.innerHTML = '<div class="share-dialog-head"><h3 id="usageTitle">Usage privacy and terms</h3><button type="button" class="share-dialog-close" aria-label="Close">×</button></div><div class="usage-dialog-body"><p>Syncing and connected tools require limited usage measurement for this US-only beta, ages 18+. This is a condition of access, not an optional feature or a claim that measurement is technically necessary to sync a league. You can decline and use the public information pages.</p><div class="usage-disclosure"><h4>What gets shared</h4><p>Event names, provider type and tool names, such as opening a tool or a connection failing.</p><h4>What stays private</h4><p>No usernames, league IDs, rosters, URL parameters or visitor IDs are included in usage events.</p></div><p class="usage-dialog-note">Separate from Cloudflare page-visit analytics. Cloudflare still handles ordinary network metadata. Browser privacy signals and non-US or unknown locations pause connected access. Withdrawing agreement pauses syncing and connected tools but does not delete your local plans. <a href="/privacy">Full privacy notice</a> · <a href="/terms">Terms</a>.</p><label class="usage-consent" for="usageConsent"><input type="checkbox" id="usageConsent"><span><strong>I agree to required limited usage measurement (18+)</strong><small>Uncheck and save to withdraw and pause connected access.</small></span></label><p class="usage-dialog-status" role="status"></p></div><div class="share-dialog-actions"><button type="button" class="btn-builder-action" data-usage-save>Save agreement</button></div>';
      document.body.append(dialog);
      dialog.querySelector(".share-dialog-close").addEventListener("click", () => dialog.close());
      dialog.querySelector("[data-usage-save]").addEventListener("click", () => {
        try {
          saveAgreement(dialog.querySelector("#usageConsent").checked);
          dialog.querySelector("[role=status]").textContent = isAllowed() ? "Agreement saved. Sync is now available." : "Agreement withdrawn. Connected tools are paused; local plans remain on this device.";
        } catch (error) { report(error); }
      });
    }
    dialog.querySelector("#usageConsent").checked = isAllowed();
    dialog.querySelector("#usageConsent").disabled = privacySignal || !available || !eligible;
    dialog.querySelector("[role=status]").textContent = isAllowed() ? "Connected access enabled." : accessMessage();
    dialog.showModal();
    availability = null;
    await checkAvailability();
    dialog.querySelector("#usageConsent").disabled = privacySignal || !available || !eligible;
    dialog.querySelector("[role=status]").textContent = isAllowed() ? "Connected access enabled." : accessMessage();
  }
  document.addEventListener("click", event => { if (event.target.closest("[data-usage-settings]")) open(); });
  document.addEventListener("change", event => {
    if (!event.target.matches("[data-usage-connect-choice]")) return;
    try { saveAgreement(event.target.checked); }
    catch (error) { report(error); renderConnectionChoices(); }
  });
  window.FFOUsage = Object.freeze({ track, isAllowed, checkAccess, requireConnectionAccess, accessMessage, mountConnectionChoices: renderConnectionChoices });
  renderConnectionChoices();
  checkAvailability();
})();
