// Playoff push: must-win games across leagues, playoff-week schedule for your roster, and handcuffs to stash.
// Classic script loaded before app.js; reads app.js globals only at render time.
(() => {
  const esc = value => draftEscapeHtml(String(value ?? ""));
  const ORDER = { "Bubble team": 0, "Chasing a spot": 1, "Above the cut": 2, "In the field": 3, "Outside the field": 4, "Regular season over": 5 };
  const TONE = { "Bubble team": "warn", "Chasing a spot": "warn", "Above the cut": "good", "In the field": "good", "Outside the field": "muted", "Regular season over": "accent" };

  function normTeam(team) {
    const code = String(team || "").toUpperCase().trim();
    return code === "JAC" ? "JAX" : code === "LA" ? "LAR" : code;
  }

  // Classify a league from the Gameday standing; gap < 0 is cushion over the first team out.
  function classifyLeague(entry, currentWeek) {
    const standing = entry.standing;
    if (!standing) return null;
    const weeksLeft = entry.playoffStart ? Math.max(0, entry.playoffStart - currentWeek) : null;
    const inField = standing.rank <= standing.playoffTeams;
    if (weeksLeft === 0) return { status: "Regular season over", weeksLeft, inField, note: "Check your provider for final seeds and tiebreakers." };
    const left = weeksLeft ?? 99;
    if (standing.gap === null) return { status: "In the field", weeksLeft, inField, note: "No cut-line gap available; check your league's format." };
    if (inField) {
      const cushion = -standing.gap;
      if (cushion >= 2) return { status: "Above the cut", weeksLeft, inField, note: `${fmtGames(cushion)} over the cut; not a clinch calculation` };
      return { status: "Bubble team", weeksLeft, inField, note: cushion > 0 ? `Only ${fmtGames(cushion)} over the cut` : "Tied at the cut line" };
    }
    if (standing.gap > left) return { status: "Outside the field", weeksLeft, inField, note: `${fmtGames(standing.gap)} back; check provider rules before assuming elimination` };
    if (standing.gap <= 1) return { status: "Bubble team", weeksLeft, inField, note: standing.gap > 0 ? `${fmtGames(standing.gap)} back of the last spot` : "Tied at the cut line" };
    return { status: "Chasing a spot", weeksLeft, inField, note: `${fmtGames(standing.gap)} back — win and watch the scoreboard` };
  }

  function fmtGames(value) {
    const abs = Math.abs(value);
    return `${Number.isInteger(abs) ? abs : abs.toFixed(1)} game${abs === 1 ? "" : "s"}`;
  }

  function renderStakes() {
    const gd = window.FFOGameday;
    const leagues = (gd?.data?.leagues || []).filter(entry => !entry.hidden && !entry.error && entry.standing);
    if (!gd) return "";
    if (!gd.data) {
      if (!gd.readStore?.().sources.length) return section("What's at stake this week", "Across all your saved leagues", '<p class="draft-empty">Save your leagues in Gameday to see which games matter most.</p>');
      gd.ensureData?.().catch(() => {});
      return section("What's at stake this week", "Across all your saved leagues", '<p class="draft-empty">Checking your leagues…</p>');
    }
    if (!leagues.length) {
      return section("What's at stake this week", "Across all your saved leagues", '<p class="draft-empty">Save your leagues in Gameday to see which games matter most.</p>');
    }
    const week = Number(gd.data.week) || Number(state.week) || 0;
    const rows = leagues.map(entry => ({ entry, info: classifyLeague(entry, week) })).filter(row => row.info)
      .sort((a, b) => ORDER[a.info.status] - ORDER[b.info.status] || (a.entry.standing.rank - b.entry.standing.rank));
    const mustWin = rows.filter(row => row.info.status === "Bubble team").length;
    const cards = rows.map(({ entry, info }) => {
      const st = entry.standing;
      const record = `${st.wins}-${st.losses}${st.ties ? `-${st.ties}` : ""}`;
      const odds = Number.isFinite(entry.winPct) ? Math.round(entry.winPct) : null;
      const opp = entry.opp?.name ? `vs ${entry.opp.name}` : "No opponent this week";
      return `<article class="push-stake is-${TONE[info.status]}">
        <div class="push-stake-head"><span class="push-stake-tag">${esc(info.status)}</span><span class="push-stake-league">${esc(entry.name)}</span></div>
        <p class="push-stake-rank"><b>${st.rank}${ordinalSuffix(st.rank)}</b> of ${st.teams} · ${record}${info.weeksLeft ? ` · ${info.weeksLeft} wk${info.weeksLeft === 1 ? "" : "s"} left` : ""}</p>
        <p class="push-stake-note">${esc(info.note)}</p>
        <div class="push-stake-foot"><span>${esc(opp)}${odds !== null ? ` · <b>${odds}%</b> to win` : ""}</span>
        <button type="button" class="btn-builder-action" data-gameday-manage="${esc(entry.key)}" data-gameday-tab="tab-opt">Set lineup</button></div>
      </article>`;
    }).join("");
    const sub = `${mustWin} bubble league${mustWin === 1 ? "" : "s"} · Standings-based signals, not elimination or clinch odds`;
    return section("What's at stake this week", sub, `<div class="push-stakes">${cards}</div>`);
  }

  function ordinalSuffix(n) {
    const mod = n % 100;
    if (mod >= 11 && mod <= 13) return "th";
    return ["th", "st", "nd", "rd"][n % 10] || "th";
  }

  function section(title, sub, body) {
    return `<section class="comparison-card push-section"><div class="push-section-head"><h3>${esc(title)}</h3><span class="comparison-note">${esc(sub)}</span></div>${body}</section>`;
  }

  function matchupCell(player, week) {
    const team = normTeam(player.team);
    if (!team || team === "FA") return '<td class="push-cell is-unknown">—</td>';
    if (CURRENT_BYE_WEEKS[team] === week) return '<td class="push-cell is-bye">BYE</td>';
    const game = CURRENT_NFL_SCHEDULE[team]?.[week];
    if (!game) return '<td class="push-cell is-unknown">TBD</td>';
    const pos = ["QB", "RB", "WR", "TE", "DEF"].includes(player.position) ? player.position : "WR";
    const rank = getDvpRanksForSeason(state.activeLeague?.season || state.season)[pos]?.[game.opp] || 16;
    const tone = rank >= 22 ? "good" : rank <= 10 ? "bad" : "neutral";
    const label = tone === "good" ? "Good matchup" : tone === "bad" ? "Tough matchup" : "Neutral matchup";
    return `<td class="push-cell is-${tone}" title="${esc(`${label}: ${game.opp} is ${33 - rank}${ordinalSuffix(33 - rank)}-toughest vs ${pos}`)}"><span>${game.isHome ? "vs" : "@"}</span> ${esc(game.opp)}</td>`;
  }

  function renderSchedule(manager) {
    const weeks = getPlayoffWeeksForActiveLeague();
    const players = getPlannerRosterIds(manager).map(id => state.players[id])
      .filter(player => player && !player.isPick && player.position !== "K")
      .sort((a, b) => (b.baseValue || 0) - (a.baseValue || 0)).slice(0, 14);
    if (!players.length) return section("Your playoff schedule", "", '<p class="draft-empty">No rostered players to check.</p>');
    const rows = players.map(player => {
      const profile = getPlayerPlayoffSosProfile(player);
      const tone = profile.letter.startsWith("A") ? "good" : ["D", "F"].includes(profile.letter) ? "bad" : "neutral";
      return `<tr><th scope="row"><div class="push-player">${renderComparisonPortrait(player)}<span><b>${esc(player.name)}</b><small>${esc(player.position)} · ${esc(player.team || "FA")}</small></span></div></th>${weeks.map(week => matchupCell(player, week)).join("")}<td class="push-grade is-${tone}">${esc(profile.letter)}</td></tr>`;
    }).join("");
    const byes = players.filter(player => weeks.includes(CURRENT_BYE_WEEKS[normTeam(player.team)])).map(player => player.name);
    const tough = players.filter(player => ["D", "F"].includes(getPlayerPlayoffSosProfile(player).letter)).map(player => player.name);
    const notes = [byes.length ? `On bye during your playoffs: ${byes.join(", ")}.` : "", tough.length ? `Tough playoff slate: ${tough.slice(0, 4).join(", ")}${tough.length > 4 ? "…" : ""} — worth a backup plan.` : ""].filter(Boolean);
    return section("Your playoff schedule", `Weeks ${weeks[0]}–${weeks[weeks.length - 1]} · green = soft defense, red = tough`, `
      <div class="table-wrap push-table-wrap"><table class="push-table"><thead><tr><th scope="col">Player</th>${weeks.map(week => `<th scope="col">Wk ${week}</th>`).join("")}<th scope="col">Grade</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${notes.length ? `<ul class="push-notes">${notes.map(note => `<li>${esc(note)}</li>`).join("")}</ul>` : ""}`);
  }

  function findHandcuff(starter) {
    const team = starter.team;
    if (!starter.depthOrder) return null;
    const candidates = (PLAYER_INDEX_BY_TEAM.get(team) || []).filter(player => player.position === "RB" && player.id !== starter.id && player.isCurrentNfl && player.depthOrder > starter.depthOrder && !["IR", "Out", "Doubtful", "PUP", "Suspended"].includes(player.injuryStatus));
    if (!candidates.length) return null;
    const ranked = candidates.sort((a, b) => {
      const da = a.depthOrder || 99, db = b.depthOrder || 99;
      return da - db || (b.baseValue || 0) - (a.baseValue || 0) || (a.searchRank || 99999) - (b.searchRank || 99999);
    });
    return ranked[0];
  }

  function renderHandcuffs(manager) {
    const mine = new Set(getPlannerRosterIds(manager).map(String));
    const backs = [...mine].map(id => state.players[id]).filter(player => player?.position === "RB" && player.team && player.team !== "FA")
      .sort((a, b) => (b.baseValue || 0) - (a.baseValue || 0)).slice(0, 3);
    if (!backs.length) return "";
    const ownerOf = id => state.managers.find(team => (team.players || []).map(String).includes(String(id)));
    const cards = backs.map(starter => {
      const cuff = findHandcuff(starter);
      if (!cuff) return "";
      const owner = ownerOf(cuff.id);
      const status = mine.has(String(cuff.id)) ? { tone: "good", text: "Already on your roster" }
        : owner ? { tone: "muted", text: `Rostered by ${splitTeamLabel(owner)[0]}` }
        : { tone: "accent", text: "Potential stash — confirm availability and role" };
      return `<article class="push-cuff is-${status.tone}">
        <div class="push-cuff-pair">${renderComparisonPortrait(starter)}<span class="push-cuff-arrow" aria-hidden="true">→</span>${renderComparisonPortrait(cuff)}</div>
        <div class="push-cuff-text"><small>If ${esc(starter.name)} goes down</small><b>${esc(cuff.name)}</b><span>${esc(cuff.team)} RB${cuff.depthOrder ? ` · depth #${cuff.depthOrder}` : ""}</span><em>${esc(status.text)}</em></div>
      </article>`;
    }).filter(Boolean).join("");
    if (!cards) return "";
    return section("Potential RB handcuffs", "Depth-chart candidates, not guaranteed injury replacements", `<div class="push-cuffs">${cards}</div>`);
  }

  function render() {
    const root = document.getElementById("playoffPushView");
    if (!root || typeof state === "undefined") return;
    const manager = state.managers?.[Number(document.getElementById("teamSelect")?.value || "0")];
    if (!state.activeLeague || !manager) {
      root.innerHTML = `${renderStakes()}<p class="draft-empty">Connect a league to see your playoff schedule and handcuffs.</p>`;
      return;
    }
    root.innerHTML = `${renderStakes()}${renderSchedule(manager)}${renderHandcuffs(manager)}`;
  }

  document.addEventListener("ffo:gameday-data", () => {
    const root = document.getElementById("playoffPushView");
    if (root && !root.hidden) render();
  });

  window.FFOPlayoffPush = Object.freeze({ render, classifyLeague, findHandcuff });
})();
