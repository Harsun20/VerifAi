// POST /api/decision { id, action, note, officer }
// Stateless: validates the decision and returns a tamper-evident audit record.
// The frontend keeps the trail in localStorage. In production this would write to PostgreSQL.
const crypto = require("crypto");
const { json, parse } = require("./_lib/http");
const apps = require("./_lib/applications.json");

const ACTIONS = { approve: "Cleared for approval", correction: "Correction requested", escalate: "Escalated to audit team", reject: "Rejected" };

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST" });
  const b = parse(event);
  if (!b) return json(400, { error: "Invalid JSON" });
  if (!apps.some((a) => a.id === b.id)) return json(404, { error: "Unknown application" });
  if (!ACTIONS[b.action]) return json(400, { error: "action must be one of " + Object.keys(ACTIONS).join(", ") });
  const entry = {
    id: b.id, action: b.action, label: ACTIONS[b.action],
    note: String(b.note || "").slice(0, 500), officer: String(b.officer || "Demo Officer").slice(0, 60),
    at: new Date().toISOString(), prevHash: String(b.prevHash || "GENESIS"),
  };
  entry.hash = crypto.createHash("sha256").update(JSON.stringify(entry)).digest("hex").slice(0, 16);
  return json(200, { entry });
};
