const APP_ORIGIN = "https://fantasyfo.com";
const PROVIDER_HOSTS = [/^(www\.)?sleeper\.com$/, /^fantasy\.espn\.com$/, /(^|\.)cbssports\.com$/];
const frame = document.getElementById("app");

function greetApp() {
  frame.contentWindow?.postMessage({ type: "ffo-panel:hello", version: chrome.runtime.getManifest().version }, APP_ORIGIN);
}

frame.addEventListener("load", greetApp);

window.addEventListener("message", async event => {
  if (event.origin !== APP_ORIGIN || event.source !== frame.contentWindow) return;
  const message = event.data;
  if (message?.type === "ffo-panel:ready") { greetApp(); return; }
  if (message?.type !== "ffo-panel:open" || typeof message.url !== "string") return;
  let url;
  try { url = new URL(message.url); } catch { return; }
  if (url.protocol !== "https:" || !PROVIDER_HOSTS.some(pattern => pattern.test(url.hostname))) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id !== undefined) await chrome.tabs.update(tab.id, { url: url.href });
    else await chrome.tabs.create({ url: url.href });
    frame.contentWindow?.postMessage({ type: "ffo-panel:opened", url: url.href }, APP_ORIGIN);
  } catch (error) {
    frame.contentWindow?.postMessage({ type: "ffo-panel:failed", message: String(error?.message || error) }, APP_ORIGIN);
  }
});
