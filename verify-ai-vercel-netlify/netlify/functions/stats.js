// GET /api/stats -> dashboard aggregates
const { json } = require("./_lib/http");
const { verify } = require("./_lib/rules");
const apps = require("./_lib/applications.json");

exports.handler = async () => {
  const results = apps.map((a) => ({ a, r: verify(a, { all: apps }) }));
  const outcomes = { issues: 0, manual: 0, clear: 0 };
  const byCategory = {}, bySeverity = { high: 0, medium: 0, low: 0, info: 0 }, byState = {};
  let findings = 0;
  for (const { a, r } of results) {
    outcomes[r.outcome]++;
    byState[a.state] = (byState[a.state] || 0) + 1;
    for (const f of r.findings) {
      findings++;
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
      bySeverity[f.severity]++;
    }
  }
  const top = results.slice().sort((x, y) => y.r.score - x.r.score).slice(0, 5)
    .map(({ a, r }) => ({ id: a.id, institution: a.institution, score: r.score, priority: r.priority }));
  return json(200, {
    totalApplications: apps.length, totalFindings: findings, outcomes, bySeverity,
    byCategory: Object.entries(byCategory).sort((x, y) => y[1] - x[1]).map(([name, count]) => ({ name, count })),
    byState: Object.entries(byState).sort((x, y) => y[1] - x[1]).map(([name, count]) => ({ name, count })),
    top,
    // illustrative figure: 12 minutes of manual checking saved per auto-flagged finding
    estimatedMinutesSaved: findings * 12,
  });
};
