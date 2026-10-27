// VERIFY-AI rules engine.
// All thresholds are ILLUSTRATIVE and chosen for the synthetic demo. They are not real AICTE norms.

const CONFIG = {
  requiredDocs: ["society_reg", "land", "building_plan", "fire_noc", "affidavit", "faculty", "bank"],
  sqmPerSeat: 9,            // minimum built-up area per sanctioned seat
  areaTolerance: 0.05,      // allowed difference between NOC area and approved plan area
  studentsPerFaculty: 20,   // 1 faculty per N students of intake
  minFdLakh: 50,            // minimum fixed deposit corpus
  minLeaseYears: 30,
  nameMatchHard: 0.6,       // below this similarity -> different entity
  nameMatchSoft: 0.95,      // below this -> variant spelling
  editGapDays: 1,           // modified this many days after created -> suspicious
  suspiciousSoftware: ["photoshop", "canva", "online pdf editor", "gimp", "pixlr"],
};

const WEIGHT = { high: 25, medium: 10, low: 3, info: 2 };

const day = (s) => (s ? new Date(s + "T00:00:00Z") : null);
const diffDays = (a, b) => Math.round((day(a) - day(b)) / 86400000);

const STOP = new Set(["the", "of", "and", "sri", "shri", "smt"]);
const tokens = (s) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((t) => t && !STOP.has(t))
    .map((t) => t.replace(/(ional|ion|al)$/, "")); // crude stem: Educational ~ Education

function similarity(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((t) => B.has(t) && inter++);
  return inter / new Set([...A, ...B]).size;
}

function mkFinding(id, severity, category, title, detail, evidence, action) {
  return { id, severity, category, title, detail, evidence, action };
}

const ev = (doc, field, value) => ({ doc, field, value });

/**
 * Run all checks on one application.
 * @param app   application record
 * @param ctx   { all: [every application] } used for cross-application duplicate checks
 */
function verify(app, ctx = {}) {
  const f = [];
  const d = app.documents;
  const sub = app.submittedOn;

  // R1 completeness
  for (const key of CONFIG.requiredDocs) {
    if (!d[key] || !d[key].present) {
      f.push(mkFinding("R1-" + key, "high", "Missing document",
        `${(d[key] && d[key].label) || key} not submitted`,
        "A mandatory document is absent from the submission.",
        [ev(key, "present", "false")],
        "Request the applicant to upload the missing document before review proceeds."));
    }
  }
  const has = (k) => d[k] && d[k].present;

  // R2 validity
  if (has("fire_noc")) {
    const n = d.fire_noc.fields;
    if (day(n.valid_until) < day(sub)) {
      f.push(mkFinding("R2-noc", "high", "Expired document", "Fire NOC expired before submission",
        `NOC validity ended ${Math.abs(diffDays(n.valid_until, sub))} day(s) before the application date.`,
        [ev("fire_noc", "valid_until", n.valid_until), ev("fire_noc", "issue_date", n.issue_date)],
        "Request a renewed Fire Safety NOC."));
    }
  }
  if (has("land") && d.land.fields.deed_type === "Lease Deed" && d.land.fields.lease_years < CONFIG.minLeaseYears) {
    f.push(mkFinding("R2-lease", "medium", "Incompatible requirement", "Lease tenure below required minimum",
      `Lease is ${d.land.fields.lease_years} years; ${CONFIG.minLeaseYears} years required.`,
      [ev("land", "lease_years", d.land.fields.lease_years), ev("land", "deed_type", "Lease Deed")],
      "Ask for an extended lease deed or proof of ownership."));
  }

  // R3 name consistency across documents
  const names = [
    ["society_reg", "trust_name"], ["land", "holder_name"], ["building_plan", "applicant_name"],
    ["fire_noc", "applicant_name"], ["affidavit", "deponent_trust"], ["bank", "account_holder"],
  ].filter(([k]) => has(k)).map(([k, fld]) => ({ doc: k, field: fld, value: d[k].fields[fld] }));
  const anchor = names.find((n) => n.doc === "society_reg");
  if (anchor) {
    for (const n of names) {
      if (n === anchor) continue;
      const s = similarity(anchor.value, n.value);
      if (s < CONFIG.nameMatchHard) {
        f.push(mkFinding("R3-" + n.doc, "high", "Cross-document mismatch",
          `Entity name differs in ${d[n.doc].label}`,
          `Name similarity to the registered trust is ${(s * 100).toFixed(0)}%. This may be a different legal entity.`,
          [ev(anchor.doc, anchor.field, anchor.value), ev(n.doc, n.field, n.value)],
          "Seek clarification or a name-change/link document from the applicant."));
      } else if (s < CONFIG.nameMatchSoft) {
        f.push(mkFinding("R3-" + n.doc, "low", "Cross-document mismatch",
          `Name spelling variant in ${d[n.doc].label}`,
          `Similarity ${(s * 100).toFixed(0)}%. Likely a spelling or suffix variant.`,
          [ev(anchor.doc, anchor.field, anchor.value), ev(n.doc, n.field, n.value)],
          "Officer to confirm it is the same entity; consider requesting a corrected copy."));
      }
    }
  }

  // R4 area checks
  if (has("fire_noc") && has("building_plan")) {
    const a = d.fire_noc.fields.built_up_sqm, b = d.building_plan.fields.approved_built_up_sqm;
    if (Math.abs(a - b) / b > CONFIG.areaTolerance) {
      f.push(mkFinding("R4-mismatch", "medium", "Cross-document mismatch", "Built-up area differs between NOC and plan",
        `Fire NOC states ${a} sq m but the approved plan states ${b} sq m (${(Math.abs(a - b) / b * 100).toFixed(1)}% gap).`,
        [ev("fire_noc", "built_up_sqm", a), ev("building_plan", "approved_built_up_sqm", b)],
        "Ask the applicant to reconcile the two figures or provide an amended document."));
    }
  }
  if (has("building_plan")) {
    const need = app.proposedIntake * CONFIG.sqmPerSeat, have = d.building_plan.fields.approved_built_up_sqm;
    if (have < need) {
      f.push(mkFinding("R4-shortfall", "high", "Incompatible requirement", "Built-up area below requirement for intake",
        `Intake of ${app.proposedIntake} needs at least ${need} sq m; plan approves ${have} sq m.`,
        [ev("building_plan", "approved_built_up_sqm", have)],
        "Advise reduction of intake or submission of an enlarged approved plan."));
    }
  }

  // R5 timeline sanity
  const dates = [
    ["fire_noc", "issue_date"], ["land", "issue_date"], ["building_plan", "approval_date"],
    ["society_reg", "registration_date"], ["affidavit", "date"], ["bank", "as_of"],
  ].filter(([k]) => has(k));
  for (const [k, fld] of dates) {
    if (day(d[k].fields[fld]) > day(sub)) {
      f.push(mkFinding("R5-future-" + k, "high", "Timeline error", `${d[k].label} is dated after submission`,
        `${fld} is ${diffDays(d[k].fields[fld], sub)} day(s) after the application date ${sub}.`,
        [ev(k, fld, d[k].fields[fld])],
        "Treat as a possible forgery or data-entry error; request a corrected document."));
    }
  }
  if (has("building_plan") && has("land") && day(d.building_plan.fields.approval_date) < day(d.land.fields.issue_date)) {
    f.push(mkFinding("R5-plan-before-land", "medium", "Timeline error", "Building plan approved before land document date",
      "The plan was approved before the applicant held the land document.",
      [ev("building_plan", "approval_date", d.building_plan.fields.approval_date), ev("land", "issue_date", d.land.fields.issue_date)],
      "Verify the sequence of events with the issuing authority."));
  }
  if (has("society_reg") && has("land") && day(d.society_reg.fields.registration_date) > day(d.land.fields.issue_date)) {
    f.push(mkFinding("R5-trust-after-land", "high", "Timeline error", "Trust registered after the land document",
      "The land is held by an entity that was not yet registered at the time.",
      [ev("society_reg", "registration_date", d.society_reg.fields.registration_date), ev("land", "issue_date", d.land.fields.issue_date)],
      "Request supporting documents explaining the sequence."));
  }

  // R6 file metadata anomalies
  for (const key of Object.keys(d)) {
    const doc = d[key];
    if (!doc.present || !doc.meta) continue;
    const gap = diffDays(doc.meta.modified, doc.meta.created);
    const sw = (doc.meta.software || "").toLowerCase();
    const suspicious = CONFIG.suspiciousSoftware.some((s) => sw.includes(s));
    if (suspicious || gap > CONFIG.editGapDays) {
      f.push(mkFinding("R6-" + key, suspicious ? "high" : "medium", "Anomaly signal",
        `Possible edit detected in ${doc.label}`,
        `File was modified ${gap} day(s) after creation using "${doc.meta.software}".`,
        [ev(key, "meta.modified", doc.meta.modified), ev(key, "meta.software", doc.meta.software)],
        "Request the original issuing-authority copy and verify at source."));
    }
  }

  // R7 faculty adequacy / intake consistency
  if (has("faculty")) {
    const need = Math.ceil(d.faculty.fields.proposed_intake / CONFIG.studentsPerFaculty), have = d.faculty.fields.faculty_count;
    if (have < need) {
      f.push(mkFinding("R7-faculty", have < need * 0.7 ? "high" : "medium", "Incompatible requirement", "Faculty strength below norm",
        `${have} faculty listed; ${need} needed for an intake of ${d.faculty.fields.proposed_intake}.`,
        [ev("faculty", "faculty_count", have)],
        "Request an updated faculty roster."));
    }
  }
  if (has("affidavit") && d.affidavit.fields.declared_intake !== app.proposedIntake) {
    f.push(mkFinding("R7-intake", "medium", "Cross-document mismatch", "Affidavit intake differs from application",
      `Affidavit declares ${d.affidavit.fields.declared_intake}; application proposes ${app.proposedIntake}.`,
      [ev("affidavit", "declared_intake", d.affidavit.fields.declared_intake)],
      "Ask for a corrected affidavit."));
  }

  // R8 financial corpus
  if (has("bank") && d.bank.fields.fd_lakh < CONFIG.minFdLakh) {
    f.push(mkFinding("R8-fd", "medium", "Incompatible requirement", "Fixed deposit below required corpus",
      `FD of ₹${d.bank.fields.fd_lakh} lakh is below the ₹${CONFIG.minFdLakh} lakh minimum.`,
      [ev("bank", "fd_lakh", d.bank.fields.fd_lakh)],
      "Request proof of additional funds."));
  }

  // R9 cross-application duplicates
  const others = (ctx.all || []).filter((o) => o.id !== app.id);
  const pan = has("society_reg") && d.society_reg.fields.pan;
  const survey = has("land") && d.land.fields.survey_no;
  for (const o of others) {
    if (pan && o.documents.society_reg.present && o.documents.society_reg.fields.pan === pan && o.trust !== app.trust) {
      f.push(mkFinding("R9-pan-" + o.id, "high", "Cross-application duplicate", `PAN also used by ${o.id}`,
        `The same PAN appears under a different trust: ${o.trust}.`,
        [ev("society_reg", "pan", pan)], "Escalate to the audit team; possible identity reuse."));
    }
    if (survey && o.documents.land.present && o.documents.land.fields.survey_no === survey && o.documents.land.fields.holder_name !== d.land.fields.holder_name) {
      f.push(mkFinding("R9-land-" + o.id, "high", "Cross-application duplicate", `Land survey no. also claimed by ${o.id}`,
        `Survey no. ${survey} is claimed by two different holders.`,
        [ev("land", "survey_no", survey)], "Escalate to the audit team; verify with land records."));
    }
  }

  // R10 source verification status
  for (const key of Object.keys(d)) {
    if (d[key].present && d[key].source === "unavailable") {
      f.push(mkFinding("R10-" + key, "info", "Source unavailable", `${d[key].label} could not be verified at source`,
        "No online source (e.g. DigiLocker/NAD) was reachable for this document type.",
        [ev(key, "source", "unavailable")], "Route for manual verification."));
    }
  }

  const order = { high: 0, medium: 1, low: 2, info: 3 };
  f.sort((a, b) => order[a.severity] - order[b.severity]);
  const score = Math.min(100, f.reduce((s, x) => s + WEIGHT[x.severity], 0));
  const counts = { high: 0, medium: 0, low: 0, info: 0 };
  f.forEach((x) => counts[x.severity]++);
  const outcome = counts.high || counts.medium ? "issues"
    : counts.low || counts.info ? "manual" : "clear";
  const priority = score >= 50 ? "Critical" : score >= 25 ? "High" : score >= 10 ? "Medium" : "Low";

  return { score, priority, outcome, counts, findings: f };
}

module.exports = { CONFIG, verify, similarity };
