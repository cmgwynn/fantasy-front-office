// In-app feedback: a short form that opens a pre-filled email (no backend, no league data attached).
(() => {
  const ADDRESS = "support@fantasyfo.com";
  let dialog;

  function currentToolName() {
    const active = document.querySelector(".tab-page.active");
    const button = active && document.querySelector(`[data-tab="${active.id}"]`);
    return button?.textContent.trim() || active?.id || "Unknown";
  }

  function appVersion() {
    const src = document.querySelector('script[src*="app.js?v="]')?.getAttribute("src") || "";
    return src.split("v=")[1] || "unknown";
  }

  function buildMailto(kind, message) {
    const subject = `Fantasy Front Office ${kind.toLowerCase()}: ${message.trim().split(/\s+/).slice(0, 8).join(" ")}`.slice(0, 120);
    const provider = typeof state !== "undefined" ? state.activeLeague?.provider || "none" : "none";
    const body = `${message.trim()}\n\n---\nType: ${kind}\nTool: ${currentToolName()}\nProvider: ${provider}\nVersion: ${appVersion()}\nScreen: ${window.innerWidth}x${window.innerHeight}\nBrowser: ${navigator.userAgent}`;
    return `mailto:${ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function getDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "share-dialog feedback-dialog";
    dialog.setAttribute("aria-labelledby", "feedbackTitle");
    dialog.innerHTML = `<form method="dialog" class="feedback-form">
      <div class="share-dialog-head"><h3 id="feedbackTitle">Send feedback</h3><button type="button" class="share-dialog-close" data-feedback-close aria-label="Close">×</button></div>
      <fieldset class="feedback-kinds"><legend class="sr-only">Feedback type</legend>
        <label><input type="radio" name="feedbackKind" value="Bug" checked><span>Something's broken</span></label>
        <label><input type="radio" name="feedbackKind" value="Idea"><span>Idea</span></label>
        <label><input type="radio" name="feedbackKind" value="Other"><span>Other</span></label>
      </fieldset>
      <label class="feedback-message">What happened or what would help?
        <textarea id="feedbackMessage" rows="5" maxlength="1500" required placeholder="e.g. Week 9 projections look off for my ESPN league"></textarea>
      </label>
      <p class="share-dialog-status">Opens your email app with the current tool and browser info added. No passwords or league data are included.</p>
      <div class="share-dialog-actions"><button type="submit" class="connect-button">Open email</button></div>
    </form>`;
    document.body.appendChild(dialog);
    dialog.addEventListener("click", event => {
      if (event.target === dialog || event.target.closest("[data-feedback-close]")) dialog.close();
    });
    dialog.querySelector("form").addEventListener("submit", event => {
      const message = dialog.querySelector("#feedbackMessage").value;
      if (!message.trim()) { event.preventDefault(); return; }
      const kind = dialog.querySelector('input[name="feedbackKind"]:checked')?.value || "Other";
      window.location.href = buildMailto(kind, message);
      dialog.querySelector("#feedbackMessage").value = "";
    });
    return dialog;
  }

  function open() {
    const box = getDialog();
    if (!box.open) box.showModal();
    box.querySelector("#feedbackMessage").focus();
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-feedback]")) open();
  });

  window.FFOFeedback = Object.freeze({ open, buildMailto });
})();
