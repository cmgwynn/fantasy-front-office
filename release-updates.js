(() => {
  const current = new URL(document.querySelector('script[src*="app.js?v="]').src).searchParams.get("v");
  let checking = false;
  let lastCheck = 0;
  let dismissed = "";
  async function check() {
    if (checking || document.hidden || Date.now() - lastCheck < 60000) return;
    checking = true;
    lastCheck = Date.now();
    try {
      const response = await fetch("/release.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`Release check returned ${response.status}`);
      const release = await response.json();
      if (typeof release.version !== "string" || !/^\d{8}-[a-z0-9-]+$/.test(release.version)) throw new Error("Invalid release metadata");
      if (release.version === current || release.version === dismissed || document.getElementById("releaseUpdate")) return;
      const banner = document.createElement("aside");
      banner.id = "releaseUpdate";
      banner.className = "workspace-banner release-update";
      banner.setAttribute("aria-label", "Website update");
      banner.innerHTML = '<span role="status">A new version is available. Reload when you are ready; your local plans stay on this device.</span><button type="button" class="btn-builder-action" data-release-reload>Reload update</button><button type="button" class="btn-builder-action" data-release-later>Later</button>';
      document.querySelector("main").prepend(banner);
      banner.querySelector("[data-release-later]").addEventListener("click", () => { dismissed = release.version; banner.remove(); });
      banner.querySelector("[data-release-reload]").addEventListener("click", async event => {
        event.currentTarget.disabled = true;
        try {
          if (await saveReloadWorkspace() === false) throw new Error("The reload snapshot could not be saved.");
          location.reload();
        } catch (error) {
          console.error("Update reload failed:", error);
          banner.querySelector("[role=status]").textContent = "Could not finish saving. Retry after checking your local plans.";
          banner.querySelector("[data-release-reload]").disabled = false;
        }
      });
    } catch (error) {
      console.warn("Fantasy FO release check failed; the current app remains available:", error);
    } finally { checking = false; }
  }
  document.addEventListener("visibilitychange", check);
  setInterval(check, 5 * 60000);
  setTimeout(check, 10000);
  window.FFOReleaseUpdates = Object.freeze({ check });
})();
