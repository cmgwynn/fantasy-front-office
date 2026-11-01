// Shareable PNG cards for league group chats (standings, power rankings, playoff odds, weekly recap).
// Classic script loaded before app.js; card builders read app.js globals only when a card is requested.
(() => {
  const W = 1080;
  const PAD = 64;
  const C = {
    bg: "#111817", panel: "#1A2421", card: "#24312C", border: "#3B4D44", text: "#F1F4F2", muted: "#B0BDB6",
    accent: "#46D0AE", good: "#43CF8E", bad: "#EE796F", warn: "#E9B95F", mine: "rgba(70,208,174,0.14)"
  };
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  const font = (weight, size) => `${weight} ${size}px ${FONT}`;

  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    return new Promise(resolve => {
      const img = new Image();
      const timer = setTimeout(() => resolve(null), 4000);
      img.crossOrigin = "anonymous";
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      // The app's plain <img> tags leave a non-CORS cached copy; a distinct URL forces a CORS-clean fetch.
      try {
        const url = new URL(src, location.href);
        if (url.origin !== location.origin) url.searchParams.set("ffo-share", "1");
        img.src = url.href;
      } catch {
        img.src = src;
      }
    });
  }

  function fit(ctx, text, maxWidth) {
    text = String(text ?? "");
    if (ctx.measureText(text).width <= maxWidth) return text;
    while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
    return `${text.trimEnd()}…`;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function avatar(ctx, img, initials, cx, cy, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.clip();
    if (img) {
      const s = Math.max((r * 2) / img.width, (r * 2) / img.height);
      ctx.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
    } else {
      ctx.fillStyle = C.accent;
      ctx.font = font(800, Math.round(r * 0.8));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(initials || "?").slice(0, 2).toUpperCase(), cx, cy + 1);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const initialsOf = name => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("");
  const toneColor = tone => tone === "good" ? C.good : tone === "bad" ? C.bad : tone === "warn" ? C.warn : tone === "accent" ? C.accent : C.text;

  function drawHeader(ctx, spec) {
    let y = PAD;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = C.accent;
    ctx.font = font(800, 26);
    ctx.fillText(fit(ctx, String(spec.eyebrow || "").toUpperCase(), W - PAD * 2), PAD, y + 26);
    y += 44;
    ctx.fillStyle = C.text;
    ctx.font = font(800, 64);
    ctx.fillText(fit(ctx, spec.title, W - PAD * 2), PAD, y + 60);
    y += 78;
    if (spec.subtitle) {
      ctx.fillStyle = C.muted;
      ctx.font = font(500, 28);
      ctx.fillText(fit(ctx, spec.subtitle, W - PAD * 2), PAD, y + 28);
      y += 44;
    }
    return y + 20;
  }

  function drawFooter(ctx, height) {
    const y = height - PAD + 8;
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, y - 44);
    ctx.lineTo(W - PAD, y - 44);
    ctx.stroke();
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = C.text;
    ctx.font = font(800, 26);
    ctx.fillText("FANTASY FRONT OFFICE", PAD, y);
    ctx.textAlign = "right";
    ctx.fillStyle = C.accent;
    ctx.font = font(700, 26);
    ctx.fillText("fantasyfo.com", W - PAD, y);
  }

  const ROW_H = 84;
  const VS_H = 120;

  function measure(spec) {
    let h = PAD + 44 + 78 + (spec.subtitle ? 44 : 0) + 20;
    if (spec.callouts?.length) h += 132;
    (spec.rows || []).forEach(row => { h += row.kind === "versus" ? VS_H + 12 : ROW_H + (row.cutAfter ? 42 : 6); });
    return h + 40 + PAD + 40;
  }

  function drawCallouts(ctx, callouts, y) {
    const gap = 16;
    const n = Math.min(3, callouts.length);
    const w = (W - PAD * 2 - gap * (n - 1)) / n;
    callouts.slice(0, 3).forEach((callout, index) => {
      const x = PAD + index * (w + gap);
      roundRect(ctx, x, y, w, 112, 18);
      ctx.fillStyle = C.panel;
      ctx.fill();
      ctx.textAlign = "left";
      ctx.fillStyle = C.muted;
      ctx.font = font(700, 20);
      ctx.fillText(fit(ctx, callout.label.toUpperCase(), w - 36), x + 18, y + 34);
      ctx.fillStyle = toneColor(callout.tone || "accent");
      ctx.font = font(800, 34);
      ctx.fillText(fit(ctx, callout.value, w - 36), x + 18, y + 74);
      if (callout.sub) {
        ctx.fillStyle = C.muted;
        ctx.font = font(500, 20);
        ctx.fillText(fit(ctx, callout.sub, w - 36), x + 18, y + 100);
      }
    });
    return y + 132;
  }

  function drawRow(ctx, row, img, y) {
    const x = PAD, w = W - PAD * 2;
    roundRect(ctx, x, y, w, ROW_H, 18);
    ctx.fillStyle = row.highlight ? C.mine : C.panel;
    ctx.fill();
    if (row.highlight) { ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = row.rankTone ? toneColor(row.rankTone) : C.muted;
    ctx.font = font(800, 30);
    ctx.fillText(String(row.rank ?? ""), x + 40, y + ROW_H / 2);
    avatar(ctx, img, row.initials || initialsOf(row.title), x + 112, y + ROW_H / 2, 28);
    const valueW = row.bar !== undefined ? 330 : 230;
    const textX = x + 158, textW = w - (textX - x) - valueW - 16;
    ctx.textAlign = "left";
    ctx.fillStyle = C.text;
    ctx.font = font(750, 30);
    ctx.fillText(fit(ctx, row.title, textW), textX, y + (row.subtitle ? 30 : ROW_H / 2));
    if (row.subtitle) {
      ctx.fillStyle = C.muted;
      ctx.font = font(500, 22);
      ctx.fillText(fit(ctx, row.subtitle, textW), textX, y + 60);
    }
    const right = x + w - 24;
    if (row.bar !== undefined && row.bar !== null) {
      const barW = 150, barX = right - barW - 124, barY = y + ROW_H / 2 - 7;
      roundRect(ctx, barX, barY, barW, 14, 7);
      ctx.fillStyle = C.card;
      ctx.fill();
      if (row.bar > 0) {
        roundRect(ctx, barX, barY, Math.max(14, barW * Math.min(100, row.bar) / 100), 14, 7);
        ctx.fillStyle = toneColor(row.tone || "accent");
        ctx.fill();
      }
    }
    ctx.textAlign = "right";
    ctx.fillStyle = toneColor(row.tone);
    ctx.font = font(800, 32);
    ctx.fillText(fit(ctx, row.value, valueW), right, y + (row.valueSub ? 32 : ROW_H / 2));
    if (row.valueSub) {
      ctx.fillStyle = C.muted;
      ctx.font = font(500, 20);
      ctx.fillText(fit(ctx, row.valueSub, valueW), right, y + 60);
    }
    let next = y + ROW_H + 6;
    if (row.cutAfter) {
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, next + 10);
      ctx.lineTo(x + w - 130, next + 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = "right";
      ctx.fillStyle = C.accent;
      ctx.font = font(700, 16);
      ctx.textBaseline = "middle";
      ctx.fillText("PLAYOFF LINE", x + w, next + 11);
      next += 36;
    }
    return next;
  }

  function drawVersus(ctx, row, imgs, y) {
    const x = PAD, w = W - PAD * 2;
    roundRect(ctx, x, y, w, VS_H, 20);
    ctx.fillStyle = row.highlight ? C.mine : C.panel;
    ctx.fill();
    if (row.highlight) { ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.stroke(); }
    const half = w / 2;
    const side = (team, img, left) => {
      const cx = left ? x + 56 : x + w - 56;
      avatar(ctx, img, initialsOf(team.title), cx, y + VS_H / 2, 34);
      const nameX = left ? x + 104 : x + w - 104;
      const nameW = half - 104 - 158;
      ctx.textAlign = left ? "left" : "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = team.dim ? C.muted : C.text;
      ctx.font = font(750, 26);
      ctx.fillText(fit(ctx, team.title, nameW), nameX, y + 46);
      if (team.subtitle) {
        ctx.fillStyle = C.muted;
        ctx.font = font(500, 20);
        ctx.fillText(fit(ctx, team.subtitle, nameW), nameX, y + 80);
      }
      const scoreX = left ? x + half - 24 : x + half + 24;
      ctx.textAlign = left ? "right" : "left";
      ctx.fillStyle = team.win ? C.good : team.dim ? C.muted : C.text;
      ctx.font = font(800, 40);
      ctx.fillText(team.score ?? "—", scoreX, y + 52);
      if (team.scoreSub) {
        ctx.fillStyle = C.muted;
        ctx.font = font(600, 18);
        ctx.fillText(team.scoreSub, scoreX, y + 86);
      }
    };
    side(row.left, imgs[0], true);
    if (row.right) side(row.right, imgs[1], false);
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + half, y + 24);
    ctx.lineTo(x + half, y + VS_H - 24);
    ctx.stroke();
    return y + VS_H + 12;
  }

  async function renderCard(spec) {
    const rows = spec.rows || [];
    const images = await Promise.all(rows.map(row => row.kind === "versus"
      ? Promise.all([loadImage(row.left?.image), loadImage(row.right?.image)])
      : loadImage(row.image)));
    const height = measure(spec);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const glow = ctx.createLinearGradient(0, 0, W, height);
    glow.addColorStop(0, "#15221E");
    glow.addColorStop(0.55, C.bg);
    glow.addColorStop(1, "#0E1413");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, height);
    ctx.fillStyle = C.accent;
    ctx.fillRect(0, 0, W, 10);
    let y = drawHeader(ctx, spec);
    if (spec.callouts?.length) y = drawCallouts(ctx, spec.callouts, y);
    rows.forEach((row, index) => { y = row.kind === "versus" ? drawVersus(ctx, row, images[index], y) : drawRow(ctx, row, images[index], y); });
    drawFooter(ctx, height);
    return canvas;
  }

  const toBlob = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not create the image.")), "image/png"));

  function slug(text) {
    return String(text || "card").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "card";
  }

  let dialog;
  function getDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "share-dialog";
    dialog.setAttribute("aria-labelledby", "shareDialogTitle");
    dialog.innerHTML = `<div class="share-dialog-head"><h3 id="shareDialogTitle">Share to your league</h3><button type="button" class="share-dialog-close" data-share-close aria-label="Close">×</button></div>
      <div class="share-dialog-preview"><img alt="" data-share-preview></div>
      <p class="share-dialog-status" role="status" data-share-status></p>
      <div class="share-dialog-actions"><button type="button" class="connect-button" data-share-native>Share</button><button type="button" class="btn-builder-action" data-share-copy>Copy image</button><button type="button" class="btn-builder-action" data-share-download>Download</button></div>`;
    document.body.appendChild(dialog);
    dialog.addEventListener("click", event => {
      if (event.target === dialog || event.target.closest("[data-share-close]")) dialog.close();
    });
    dialog.addEventListener("close", () => {
      const img = dialog.querySelector("[data-share-preview]");
      if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
      img.removeAttribute("src");
    });
    return dialog;
  }

  async function openShare(spec) {
    const box = getDialog();
    const status = box.querySelector("[data-share-status]");
    const preview = box.querySelector("[data-share-preview]");
    const nativeBtn = box.querySelector("[data-share-native]");
    const copyBtn = box.querySelector("[data-share-copy]");
    const downloadBtn = box.querySelector("[data-share-download]");
    status.textContent = "Building image…";
    [nativeBtn, copyBtn, downloadBtn].forEach(button => { button.disabled = true; });
    if (!box.open) box.showModal();
    let blob;
    try {
      blob = await toBlob(await renderCard(spec));
    } catch (error) {
      status.textContent = error.message || "Could not create the image.";
      return;
    }
    const name = `${slug(`${spec.eyebrow} ${spec.title}`)}.png`;
    const file = new File([blob], name, { type: "image/png" });
    if (preview.src.startsWith("blob:")) URL.revokeObjectURL(preview.src);
    preview.src = URL.createObjectURL(blob);
    preview.alt = `${spec.title} — ${spec.eyebrow}`;
    const canNative = Boolean(navigator.canShare?.({ files: [file] }));
    const canCopy = typeof window.ClipboardItem === "function" && Boolean(navigator.clipboard?.write);
    nativeBtn.hidden = !canNative;
    copyBtn.hidden = !canCopy;
    [nativeBtn, copyBtn, downloadBtn].forEach(button => { button.disabled = false; });
    status.textContent = canNative ? "Send it straight to your group chat." : "Copy or download, then paste it in your group chat.";
    nativeBtn.onclick = async () => {
      try { await navigator.share({ files: [file], title: spec.title, text: `${spec.title} · ${spec.eyebrow} — via fantasyfo.com` }); status.textContent = "Shared."; }
      catch (error) { if (error?.name !== "AbortError") status.textContent = "Sharing was blocked. Try Copy image or Download."; }
    };
    copyBtn.onclick = async () => {
      try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); status.textContent = "Copied — paste it in your group chat."; }
      catch { status.textContent = "Copy was blocked by the browser. Use Download instead."; }
    };
    downloadBtn.onclick = () => {
      const link = document.createElement("a");
      link.href = preview.src;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      status.textContent = "Saved to your downloads.";
    };
  }

  // ---- Card builders (read app.js state at call time) ----
  const fmt1 = value => Number.isFinite(value) ? value.toFixed(1) : "—";
  const record = m => `${m.wins || 0}-${m.losses || 0}${m.ties ? `-${m.ties}` : ""}`;
  const leagueLabel = () => state.activeLeague?.name || "My league";
  const selectedManager = () => state.managers[Number(document.getElementById("teamSelect")?.value || "0")];
  const teamParts = m => typeof splitTeamLabel === "function" ? splitTeamLabel(m) : [m.teamName, ""];

  function standingsSpec() {
    const standings = getPlayoffStandings();
    const cut = getResolvedPlayoffTeamCount();
    const mine = selectedManager();
    return {
      eyebrow: `${leagueLabel()} · Week ${state.week}`,
      title: "Standings",
      subtitle: `Top ${cut} make the playoffs`,
      rows: standings.current.map((m, index) => {
        const info = standings.info.get(m.rosterId) || {};
        const pct = Number.isFinite(info.playoffPct) ? info.playoffPct : Number.isFinite(m.playoffPct) ? m.playoffPct : null;
        const [team, owner] = teamParts(m);
        return {
          rank: index + 1, rankTone: index < cut ? "accent" : null, image: m.ownerAvatar, title: team,
          subtitle: `${owner ? `${owner} · ` : ""}PF ${fmt1(m.pf)}`, value: record(m),
          valueSub: pct === null ? "" : `${Math.round(pct)}% playoffs`, highlight: m === mine, cutAfter: index === cut - 1 && index < standings.current.length - 1
        };
      })
    };
  }

  function powerSpec() {
    const ranked = [...state.managers].sort((a, b) => (a.currentRank || 99) - (b.currentRank || 99));
    const weekly = typeof getWeeklyLuckByRoster === "function" ? getWeeklyLuckByRoster() : null;
    const mine = selectedManager();
    const top = ranked[0]?.power || 1;
    return {
      eyebrow: `${leagueLabel()} · Week ${state.week}`,
      title: "Power Rankings",
      subtitle: "Points scored + all-play strength, not just record",
      rows: ranked.map(m => {
        const luck = weekly?.get(String(m.rosterId))?.luck;
        const [team] = teamParts(m);
        return {
          rank: m.currentRank, image: m.ownerAvatar, title: team,
          subtitle: `${record(m)} · PF ${fmt1(m.pf)}${Number.isFinite(luck) ? ` · luck ${luck >= 0 ? "+" : ""}${luck.toFixed(1)}W` : ""}`,
          value: fmt1(m.power), valueSub: "power", bar: Math.max(0, Math.min(100, (m.power / top) * 100)), tone: "accent", highlight: m === mine
        };
      })
    };
  }

  function playoffSpec() {
    const standings = getPlayoffStandings();
    const cut = getResolvedPlayoffTeamCount();
    const mine = selectedManager();
    const oddsOrder = standings.projected.map((m, seed) => {
      const info = standings.info.get(m.rosterId) || {};
      const pct = Number.isFinite(info.playoffPct) ? info.playoffPct : Number.isFinite(m.playoffPct) ? m.playoffPct : 0;
      return { m, info, pct, seed };
    }).sort((a, b) => b.pct - a.pct || a.seed - b.seed);
    return {
      eyebrow: `${leagueLabel()} · Week ${state.week}`,
      title: "Playoff Odds",
      subtitle: standings.fromSimulation ? "Simulated from the rest of the schedule" : "Projected from current form",
      rows: oddsOrder.map(({ m, info, pct }, index) => {
        const [team] = teamParts(m);
        return {
          rank: index + 1, rankTone: index < cut ? "accent" : null, image: m.ownerAvatar, title: team,
          subtitle: `${record(m)}${Number.isFinite(info.titlePct) ? ` · ${info.titlePct < 1 && info.titlePct > 0 ? "<1" : Math.round(info.titlePct)}% title` : ""}`,
          value: `${pct > 99 && pct < 100 ? ">99" : pct < 1 && pct > 0 ? "<1" : Math.round(pct)}%`,
          bar: pct, tone: pct >= 65 ? "good" : pct <= 30 ? "bad" : "warn", highlight: m === mine, cutAfter: index === cut - 1 && index < oddsOrder.length - 1
        };
      })
    };
  }

  function weekSpec() {
    const view = typeof getScheduleShareView === "function" ? getScheduleShareView() : null;
    if (!view || !view.games.length) throw new Error("Open a schedule week with published matchups first.");
    const { week, games, projections } = view;
    const current = Number(state.week) || 0;
    const final = week < current;
    const mine = selectedManager();
    const byId = id => state.managers.find(m => String(m.rosterId) === String(id));
    const scored = [];
    const rows = games.filter(game => game.awayId !== null).map(game => {
      const home = byId(game.homeId), away = byId(game.awayId);
      const projA = projections ? getScheduleTeamProjection(home, week, projections) : null;
      const projB = projections ? getScheduleTeamProjection(away, week, projections) : null;
      const hasScores = Number.isFinite(game.homePts) && Number.isFinite(game.awayPts) && (game.homePts > 0 || game.awayPts > 0);
      const a = final && hasScores ? game.homePts : projA;
      const b = final && hasScores ? game.awayPts : projB;
      const odds = !final && projA !== null && projB !== null ? Math.round(computeHeadToHeadWinProb(projA, projB)) : null;
      if (final && hasScores) scored.push({ home, away, a, b });
      const side = (m, score, otherScore, pct) => ({
        title: m ? teamParts(m)[0] : "TBD", subtitle: m ? record(m) : "", image: m?.ownerAvatar,
        score: Number.isFinite(score) ? score.toFixed(1) : "—",
        scoreSub: final ? (score > otherScore ? "WIN" : score < otherScore ? "" : "TIE") : pct !== null ? `${pct}% to win` : "projected",
        win: final && score > otherScore, dim: final && score < otherScore
      });
      return {
        kind: "versus", highlight: [home, away].includes(mine),
        left: side(home, a, b, odds), right: side(away, b, a, odds === null ? null : 100 - odds)
      };
    }).sort((x, y) => Number(y.highlight) - Number(x.highlight));
    let callouts = [];
    if (scored.length) {
      const sides = scored.flatMap(g => [{ m: g.home, pts: g.a }, { m: g.away, pts: g.b }]);
      const high = sides.reduce((best, s) => s.pts > best.pts ? s : best);
      const close = scored.reduce((best, g) => Math.abs(g.a - g.b) < Math.abs(best.a - best.b) ? g : best);
      const blow = scored.reduce((best, g) => Math.abs(g.a - g.b) > Math.abs(best.a - best.b) ? g : best);
      const winnerName = g => teamParts(g.a >= g.b ? g.home : g.away)[0];
      callouts = [
        { label: "Top score", value: fmt1(high.pts), sub: teamParts(high.m)[0], tone: "good" },
        { label: "Closest game", value: `${fmt1(Math.abs(close.a - close.b))} pts`, sub: `${winnerName(close)} survived`, tone: "warn" },
        { label: "Biggest blowout", value: `${fmt1(Math.abs(blow.a - blow.b))} pts`, sub: `${winnerName(blow)} rolled`, tone: "bad" }
      ];
    }
    return {
      eyebrow: `${leagueLabel()} · Week ${week}`,
      title: final ? "Weekly Recap" : week === current ? "This Week's Matchups" : `Week ${week} Preview`,
      subtitle: final ? "Final scores" : "Projected scores and win odds",
      callouts, rows
    };
  }

  const BUILDERS = { standings: standingsSpec, power: powerSpec, playoffs: playoffSpec, week: weekSpec };

  async function shareFromApp(kind, trigger) {
    if (typeof state === "undefined" || !state.activeLeague || !state.managers?.length) return;
    if (trigger) trigger.disabled = true;
    try {
      await openShare(BUILDERS[kind]());
    } catch (error) {
      const box = getDialog();
      if (!box.open) box.showModal();
      box.querySelector("[data-share-preview]").removeAttribute("src");
      box.querySelector("[data-share-status]").textContent = error.message || "Could not build that card.";
      box.querySelectorAll(".share-dialog-actions button").forEach(button => { button.hidden = true; });
    } finally {
      if (trigger) trigger.disabled = false;
    }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-share-card]");
    if (button) shareFromApp(button.dataset.shareCard, button);
  });

  window.FFOShare = Object.freeze({ renderCard, openShare, shareFromApp, builders: BUILDERS });
})();
