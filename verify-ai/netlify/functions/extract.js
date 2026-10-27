// POST /api/extract { text, filename? }
// Stand-in for the OCR + classification stage: takes text (as OCR would output),
// classifies the document type, extracts key fields with regex, and runs quick sanity checks.
const { json, parse } = require("./_lib/http");

const TYPES = {
  fire_noc: { label: "Fire Safety NOC", kw: ["fire", "no objection", "noc", "fire safety", "fire services"] },
  land: { label: "Land Document", kw: ["sale deed", "lease deed", "survey no", "sub-registrar", "schedule of property", "lessor"] },
  building_plan: { label: "Approved Building Plan", kw: ["building plan", "sanctioned", "development authority", "built-up", "plan approval"] },
  society_reg: { label: "Trust / Society Registration", kw: ["registration certificate", "society", "trust deed", "registrar of societies", "registered under"] },
  affidavit: { label: "Notarised Affidavit", kw: ["affidavit", "solemnly", "deponent", "notary", "do hereby declare"] },
  faculty: { label: "Faculty Roster", kw: ["faculty", "designation", "professor", "qualification", "roster"] },
  bank: { label: "Bank / FD Statement", kw: ["bank", "fixed deposit", "fd no", "account no", "balance", "statement"] },
};

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

function toISO(raw) {
  let m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = raw.match(/(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3})[a-z]*[\s,.-]+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}`;
  return null;
}

// Find a date that follows one of the given labels, e.g. "Date of issue: 12/03/2026"
function labelledDate(text, labels) {
  const re = new RegExp("(?:" + labels.join("|") + ")[^\\n\\d]{0,25}([0-9]{1,2}[\\/\\-. ][A-Za-z0-9]{1,9}[\\/\\-., ]+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})", "i");
  const m = text.match(re);
  return m ? toISO(m[1]) : null;
}

function labelled(text, labels) {
  const re = new RegExp("(?:" + labels.join("|") + ")\\s*[:\\-]\\s*([^\\n]+)", "i");
  const m = text.match(re);
  return m ? m[1].trim().replace(/[.;,]$/, "") : null;
}

function classify(text) {
  const t = text.toLowerCase();
  const scores = Object.entries(TYPES).map(([key, v]) => ({
    key, label: v.label, hits: v.kw.filter((k) => t.includes(k)),
  })).map((s) => ({ ...s, score: s.hits.length }));
  scores.sort((a, b) => b.score - a.score);
  const total = scores.reduce((s, x) => s + x.score, 0) || 1;
  const top = scores[0];
  return { type: top.score ? top.key : "unknown", label: top.score ? top.label : "Unclassified",
           confidence: top.score ? Math.min(0.99, 0.45 + (top.score / total) * 0.5 + top.score * 0.03) : 0.1,
           matchedKeywords: top.hits, alternatives: scores.slice(1, 3).filter((s) => s.score).map((s) => s.label) };
}

function extractFields(text) {
  const f = {};
  const put = (k, v) => { if (v !== null && v !== undefined && v !== "") f[k] = v; };
  put("holder_or_applicant_name", labelled(text, ["name of (?:the )?(?:trust|society|applicant|institution|holder|account holder)", "applicant", "account holder", "deponent"]));
  put("issue_date", labelledDate(text, ["date of issue", "issued on", "issue date", "dated", "date"]));
  put("valid_until", labelledDate(text, ["valid (?:up )?(?:to|until|till)", "validity", "expires? on"]));
  put("approval_date", labelledDate(text, ["date of approval", "sanctioned on", "approved on"]));
  put("registration_date", labelledDate(text, ["date of registration", "registered on"]));
  const area = text.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*(?:m|mtrs?|metres?|meters?)|sqm|m2|m²)/i);
  if (area) put("area_sqm", Number(area[1].replace(/,/g, "")));
  const pan = text.match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/);
  if (pan) put("pan", pan[0]);
  const reg = text.match(/(?:registration|reg\.?)\s*(?:no\.?|number)\s*[:\-]?\s*([A-Z0-9\/\-]{5,25})/i);
  if (reg) put("registration_no", reg[1]);
  const survey = text.match(/survey\s*(?:no\.?|number)\s*[:\-]?\s*([0-9A-Za-z\/\-]{2,12})/i);
  if (survey) put("survey_no", survey[1]);
  const fd = text.match(/(?:₹|rs\.?|inr)\s*([\d,.]+)\s*(lakh|lakhs|crore|cr)?/i);
  if (fd) {
    let v = parseFloat(fd[1].replace(/,/g, ""));
    const unit = (fd[2] || "").toLowerCase();
    if (unit.startsWith("cr")) v *= 100; else if (!unit.startsWith("lakh")) v /= 100000;
    put("amount_lakh", Math.round(v * 10) / 10);
  }
  const intake = text.match(/intake\s*(?:of)?\s*[:\-]?\s*(\d{2,4})/i);
  if (intake) put("intake", Number(intake[1]));
  return f;
}

function sanity(fields, text, filename) {
  const notes = [];
  const today = new Date().toISOString().slice(0, 10);
  if (fields.issue_date && fields.issue_date > today) notes.push({ severity: "high", text: `Issue date ${fields.issue_date} is in the future.` });
  if (fields.issue_date && fields.valid_until && fields.valid_until < fields.issue_date) notes.push({ severity: "high", text: "Validity ends before the issue date." });
  if (fields.valid_until && fields.valid_until < today) notes.push({ severity: "medium", text: `Document expired on ${fields.valid_until}.` });
  if (/photoshop|canva|edited|online pdf/i.test(text + " " + (filename || ""))) notes.push({ severity: "medium", text: "Text or filename hints at editing software." });
  if (text.trim().length < 80) notes.push({ severity: "low", text: "Very little text recovered; OCR quality may be poor." });
  return notes;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST" });
  const b = parse(event);
  if (!b || typeof b.text !== "string" || !b.text.trim()) return json(400, { error: "Provide 'text' (document text as OCR would output it)" });
  if (b.text.length > 20000) return json(413, { error: "Text too long (20,000 character limit)" });
  const t0 = Date.now();
  const classification = classify(b.text);
  const fields = extractFields(b.text);
  return json(200, {
    filename: b.filename || null, classification, fields,
    fieldCount: Object.keys(fields).length, checks: sanity(fields, b.text, b.filename),
    ranInMs: Date.now() - t0,
    note: "Demo extractor: regex and keyword scoring over supplied text. A production build would run Tesseract/PaddleOCR on the uploaded file first.",
  });
};
