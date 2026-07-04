const SESSION_KEY = "ar-agent-debug-logs-b71e7b";
const MAX_LOGS = 80;

export function agentDebugLog(runId, hypothesisId, location, message, data = {}) {
  const entry = {
    sessionId: "b71e7b",
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };

  try {
    const existing = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]");
    existing.push(entry);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(existing.slice(-MAX_LOGS)));
  } catch {
    // ignore storage failures
  }

  fetch("http://127.0.0.1:7845/ingest/01689d5b-0807-4fe1-8339-b38ccac8431d", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b71e7b" },
    body: JSON.stringify(entry),
  }).catch(() => {});
}

export function getAgentDebugLogs() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]");
  } catch {
    return [];
  }
}
