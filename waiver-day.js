// Waiver day across leagues: free agents who'd start for you in more than one league, plus FAAB/priority side by side.
// Classic script loaded before app.js; uses Gameday's multi-league data (rostered ids + waiver settings).
(() => {
  const esc = value => draftEscapeHtml(String(value ?? ""));
  const SKILL = new Set(["QB", "RB", "WR", "TE"]);
  const HELD = new Set(["IR", "Out", "PUP", "Suspended", "Doubtful"]);
  const MIN_GAIN = 0.5;

  function projectionOf(id, fallback) {
    const player = state.players[id];
    return Number.isFinite(player?.projectedPoints) && player.projectedPoints > 0 ? player.projectedPoints : Number(fallback) || 0;
  }

  function trackedLeagues() {
    return (window.FFOGameday?.data?.leagues || []).filter(entry => !entry.hidden && !entry.error && Array.isArray(entry.rostered) && entry.me);
  }

  // Weakest current starter at the same position in that league, measured on the shared weekly projection.
  function weakestStarter(entry, position) {
    const starters = (entry.me.players || []).filter(player => !player.empty && player.position === position)
      .map(player => ({ player, proj: projectionOf(player.id, player.proj) }));
    if (!starters.length) return null;
    return starters.reduce((low, row) => row.proj < low.proj ? row : low);
  }

  function buildTargets(leagues, players = Object.values(state.players)) {
    const rosteredSets = leagues.map(entry => new Set(entry.rostered.map(String)));
    const pool = players.filter(player => player && !player.isPick && player.isCurrentNfl && !player.isDemo &&
      SKILL.has(player.position) && !HELD.has(player.injuryStatus) && player.projectedPoints > 0)
      .sort((a, b) => b.projectedPoints - a.projectedPoints).slice(0, 400);
    return pool.map(player => {
      const spots = leagues.map((entry, index) => {
        if (rosteredSets[index].has(String(player.id))) return null;
        const low = weakestStarter(entry, player.position);
        const gain = low ? player.projectedPoints - low.proj : 0;
        return { entry, low, gain };
      }).filter(Boolean);
      const upgrades = spots.filter(spot => spot.gain >= MIN_GAIN);
      return { player, spots, upgrades, score: upgrades.reduce((sum, spot) => sum + spot.gain, 0) };
    }).filter(target => target.upgrades.length)
      .sort((a, b) => b.upgrades.length - a.upgrades.length || b.score - a.score).slice(0, 8);
  }

  function budgetChip(entry) {
    const waiver = entry.waiver || {};
    const value = waiver.faab
      ? `$${Math.max(0, waiver.budget - waiver.spent)} <small>of $${waiver.budget} FAAB</small>`
      : waiver.priority ? `#${waiver.priority} <small>waiver priority</small>` : '<small>Waiver info unavailable</small>';
    const sub = waiver.faab && waiver.priority ? `<em>Priority #${waiver.priority}</em>` : "";
    return `<div class="wd-budget"><span class="wd-budget-league">${esc(entry.name)}</span><b>${value}</b>${sub}</div>`;
  }

  function targetCard({ player, spots, upgrades }) {
    const chips = spots.sort((a, b) => b.gain - a.gain).map(spot => {
      const upgrade = spot.gain >= MIN_GAIN;
      const detail = upgrade ? `+${spot.gain.toFixed(1)} over ${spot.low.player.name}` : "Depth only";
      return `<li class="${upgrade ? "is-upgrade" : ""}"><span>${esc(spot.entry.name)}</span><small>${esc(detail)}</small></li>`;
    }).join("");
    const taken = trackedLeagues().length - spots.length;
    return `<article class="wd-target">
      <div class="wd-target-head">${renderComparisonPortrait(player)}<div><b>${esc(player.name)}</b><small>${esc(player.position)} · ${esc(player.team)} · ${player.projectedPoints.toFixed(1)} proj</small></div>
      <span class="wd-count" title="Same-position projection comparisons, not optimized lineups">Potential upgrade in ${upgrades.length}</span></div>
      <ul class="wd-spots">${chips}</ul>${taken > 0 ? `<p class="wd-taken">Rostered in ${taken} of your other league${taken === 1 ? "" : "s"}</p>` : ""}
    </article>`;
  }

  function render() {
    const root = document.getElementById("waiverDayAll");
    if (!root || typeof state === "undefined") return;
    const gd = window.FFOGameday;
    if (gd && !gd.data) {
      if (gd.readStore?.().sources.length) gd.ensureData?.().catch(() => {});
      root.hidden = true;
      return;
    }
    const leagues = trackedLeagues();
    if (leagues.length < 2) { root.hidden = true; root.innerHTML = ""; return; }
    if (Number(gd.data.week) !== Number(state.week) || String(gd.data.season) !== String(state.activeLeague?.season || state.season)) {
      root.hidden = false;
      root.innerHTML = '<h3>Waiver day · all your leagues</h3><p class="comparison-note">Select the current Gameday season and week to compare potential upgrades. Historical projections cannot be matched to current saved rosters.</p>';
      return;
    }
    const targets = buildTargets(leagues);
    root.hidden = false;
    root.innerHTML = `<div class="push-section-head"><h3>Waiver day · all your leagues</h3><span class="comparison-note">Potential same-position upgrades · Week ${Number(state.week)}</span></div>
      <div class="wd-budgets">${leagues.map(budgetChip).join("")}</div>
      ${targets.length ? `<div class="wd-targets">${targets.map(targetCard).join("")}</div>` : '<p class="draft-empty">No potential upgrades found in the eligible player pool. This is not a full lineup or roster-space check.</p>'}
      <p class="comparison-note">Uses the active league's Week ${Number(state.week)} projections across all leagues; scoring differences can change the result. Compares same-position starters, not flex eligibility, kickoff locks or legal add/drop moves. Review in each league's Waiver Planner before claiming. Availability is from the last Gameday refresh.</p>`;
  }

  document.addEventListener("ffo:gameday-data", () => {
    if (document.getElementById("tab-waiver")?.classList.contains("active")) render();
  });

  window.FFOWaiverDay = Object.freeze({ render, buildTargets, weakestStarter });
})();
