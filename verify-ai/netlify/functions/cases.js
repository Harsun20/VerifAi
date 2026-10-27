// GET /api/cases            -> list (filters: q, outcome, priority, state)
// GET /api/cases?id=APP-2601 -> full detail with evidence-linked findings
const { json } = require("./_lib/http");
const { verify } = require("./_lib/rules");
const apps = require("./_lib/applications.json");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });
  const qs = event.queryStringParameters || {};
  const ctx = { all: apps };

  if (qs.id) {
    const app = apps.find((a) => a.id === qs.id);
    if (!app) return json(404, { error: `No application ${qs.id}` });
    return json(200, { application: app, result: verify(app, ctx) });
  }

  let rows = apps.map((a) => {
    const r = verify(a, ctx);
    return {
      id: a.id, institution: a.institution, city: a.city, state: a.state, programType: a.programType,
      submittedOn: a.submittedOn, proposedIntake: a.proposedIntake,
      score: r.score, priority: r.priority, outcome: r.outcome, counts: r.counts,
      topFinding: r.findings[0] ? r.findings[0].title : null,
    };
  });
  const q = (qs.q || "").toLowerCase();
  if (q) rows = rows.filter((r) => [r.id, r.institution, r.city, r.state].join(" ").toLowerCase().includes(q));
  if (qs.outcome) rows = rows.filter((r) => r.outcome === qs.outcome);
  if (qs.priority) rows = rows.filter((r) => r.priority === qs.priority);
  if (qs.state) rows = rows.filter((r) => r.state === qs.state);
  rows.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return json(200, { total: rows.length, cases: rows });
};
