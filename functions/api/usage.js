const EVENTS = new Set(["visit", "demo_start", "connect_start", "connect_success", "connect_failure", "tool_open", "recommendation_review", "return_week"]);
const PROVIDERS = new Set(["none", "sleeper", "espn", "yahoo", "demo"]);
const TOOLS = new Set(["none", "tab-inbox", "tab-intel", "tab-connect", "tab-roster", "tab-opt", "tab-planner", "tab-waiver", "tab-trade", "tab-standings", "tab-matchup", "tab-bracket", "tab-analytics", "tab-weekly-matchups", "tab-compare", "tab-sos", "tab-draft", "tab-grades", "tab-power", "tab-records"]);

export async function onRequest({ request, env }) {
  const privacySignal = request.headers.get("Sec-GPC") === "1" || request.headers.get("DNT") === "1";
  const respond = (status, message) => new Response(message, { status, headers: {
    "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8",
    "X-FFO-Connected-Beta": env.FFO_USAGE && request.cf?.country === "US" && !privacySignal ? "eligible" : "unavailable"
  } });
  if (request.method === "GET") return respond(env.FFO_USAGE ? 200 : 503, env.FFO_USAGE ? "Usage measurement available." : "Usage measurement is not configured.");
  if (request.method !== "POST") return respond(405, "POST required.");
  if (request.headers.get("Origin") !== new URL(request.url).origin) return respond(403, "Same-origin requests only.");
  if (privacySignal) return respond(403, "Usage measurement disabled by browser privacy signal.");
  if (request.cf?.country !== "US") return respond(403, "Usage measurement is limited to the US beta.");
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return respond(415, "JSON required.");
  if (!env.FFO_USAGE) return respond(503, "Usage measurement is not configured.");
  const reader = request.body?.getReader();
  if (!reader) return respond(400, "Missing event.");
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 512) { await reader.cancel(); return respond(413, "Event too large."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { return respond(400, "Invalid JSON."); }
  if (!payload || Array.isArray(payload) || Object.keys(payload).sort().join(",") !== "event,provider,tool" ||
      !EVENTS.has(payload.event) || !PROVIDERS.has(payload.provider) || !TOOLS.has(payload.tool)) return respond(400, "Invalid event.");
  try {
    env.FFO_USAGE.writeDataPoint({ blobs: [payload.event, payload.provider, payload.tool], doubles: [1] });
  } catch (error) {
    console.error("Usage dataset write failed:", error.message);
    return respond(503, "Usage measurement unavailable.");
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
