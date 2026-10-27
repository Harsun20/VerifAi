// POST /api/verify  { id, edits?: { docKey: { field: value } } }
// Re-runs the rules engine, optionally on a what-if copy where the officer edits extracted values.
const { json, parse } = require("./_lib/http");
const { verify } = require("./_lib/rules");
const apps = require("./_lib/applications.json");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST" });
  const body = parse(event);
  if (!body || !body.id) return json(400, { error: "Body must be JSON with an 'id'" });
  const original = apps.find((a) => a.id === body.id);
  if (!original) return json(404, { error: `No application ${body.id}` });

  const app = JSON.parse(JSON.stringify(original));
  let editCount = 0;
  for (const [doc, fields] of Object.entries(body.edits || {})) {
    if (!app.documents[doc] || typeof fields !== "object") continue;
    for (const [k, v] of Object.entries(fields)) {
      if (k in app.documents[doc].fields) {
        const cur = app.documents[doc].fields[k];
        app.documents[doc].fields[k] = typeof cur === "number" ? Number(v) : String(v);
        editCount++;
      }
    }
  }
  const t0 = Date.now();
  const before = verify(original, { all: apps });
  const after = verify(app, { all: apps });
  const ids = (r) => new Set(r.findings.map((f) => f.id));
  const b = ids(before), a = ids(after);
  return json(200, {
    id: app.id, editsApplied: editCount, ranInMs: Date.now() - t0, result: after,
    delta: {
      scoreChange: after.score - before.score,
      resolved: before.findings.filter((f) => !a.has(f.id)).map((f) => f.title),
      introduced: after.findings.filter((f) => !b.has(f.id)).map((f) => f.title),
    },
    pipeline: ["Intake", "Classification", "Field extraction", "Checklist rules", "Anomaly signals",
               "Cross-document checks", "Evidence-linked report"],
  });
};
