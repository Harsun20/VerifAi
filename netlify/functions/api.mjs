import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { getDatabase } from "@netlify/database";

const db = getDatabase();
const documents = getStore("verifyai-documents");
const DEMO_USERS = [
  { username: "demo.admin", password: "Admin-Demo!84xQ", role: "admin", name: "Demo Administrator", salt: "verifyai-admin-salt-v1" },
  { username: "demo.officer", password: "Officer-Demo!72pR", role: "officer", name: "Demo Compliance Officer", salt: "verifyai-officer-salt-v1" },
  { username: "demo.applicant", password: "Applicant-Demo!63mK", role: "applicant", name: "Demo Applicant", salt: "verifyai-applicant-salt-v1" },
];
const ALLOWED_TYPES = new Set(["pdf", "png", "jpg", "jpeg", "txt"]);
const ALLOWED_STATUSES = new Set(["Submitted", "Under Review", "Needs Correction", "Approved", "Rejected"]);
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
let seedPromise;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const passHash = (password, salt) => scryptSync(password, salt, 64).toString("hex");

async function ensureDemoData() {
  seedPromise ||= (async () => {
    for (const user of DEMO_USERS) {
      await db.sql`INSERT INTO users (username, password_hash, password_salt, role, display_name)
        VALUES (${user.username}, ${passHash(user.password, user.salt)}, ${user.salt}, ${user.role}, ${user.name})
        ON CONFLICT (username) DO NOTHING`;
    }
    const sampleCases = [
      { reference: "APP-1042", title: "Institution registration package", type: "Institution Registration", status: "Under Review", score: 76, level: "High", findings: [{ severity: "high", code: "DATE_MISMATCH", title: "Date fields need review", detail: "The fictional sample record contains inconsistent date values.", recommendation: "Compare the original documents and confirm the correct date." }, { severity: "medium", code: "EXPIRY_REVIEW", title: "Expiry requires review", detail: "A sample certificate is marked as near expiry.", recommendation: "Request an updated certificate if the expiry is confirmed." }] },
      { reference: "APP-1043", title: "Faculty credential submission", type: "Faculty Credential", status: "Needs Correction", score: 48, level: "Medium", findings: [{ severity: "medium", code: "MISSING_FIELD", title: "Required field missing", detail: "The sample record is missing a registration/reference field.", recommendation: "Ask the applicant to supply the missing reference." }] },
      { reference: "APP-1044", title: "Annual compliance return", type: "Annual Compliance", status: "Submitted", score: 12, level: "Low", findings: [{ severity: "low", code: "MANUAL_REVIEW", title: "Routine review recommended", detail: "Automated checks did not identify a high-priority issue. Human review is still required.", recommendation: "Continue with standard officer review." }] },
    ];
    for (const item of sampleCases) {
      await db.sql`INSERT INTO cases (reference, applicant_id, title, application_type, status, risk_score, risk_level, findings, extracted_text)
        SELECT ${item.reference}, id, ${item.title}, ${item.type}, ${item.status}, ${item.score}, ${item.level}, ${JSON.stringify(item.findings)}::jsonb, ${"Fictional seeded demonstration record. No real personal data."}
        FROM users WHERE username = ${"demo.applicant"}
        ON CONFLICT (reference) DO NOTHING`;
    }
  })();
  try { await seedPromise; } catch (error) { seedPromise = undefined; throw error; }
}

async function apiUser(request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const tokenHash = sha256(header.slice(7));
  const rows = await db.sql`SELECT u.id, u.username, u.role, u.display_name
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash} AND s.expires_at > NOW() AND u.active = TRUE`;
  return rows[0] || null;
}

async function audit(actor, action, ref, details = "") {
  const prior = await db.sql`SELECT event_hash FROM audit_events ORDER BY id DESC LIMIT 1`;
  const previous = prior[0]?.event_hash || "GENESIS";
  const created = new Date().toISOString();
  const canonical = [previous, actor?.username || "system", action, ref, details, created].join("|");
  const eventHash = sha256(canonical);
  await db.sql`INSERT INTO audit_events (actor_id, actor_name, action, entity_ref, details, created_at, previous_hash, event_hash)
    VALUES (${actor?.id || null}, ${actor?.username || "system"}, ${action}, ${ref}, ${details.slice(0, 500)}, ${created}, ${previous}, ${eventHash})`;
}

function caseView(row) {
  return {
    id: row.id, reference: row.reference, title: row.title, application_type: row.application_type,
    status: row.status, risk_score: row.risk_score, risk_level: row.risk_level,
    findings: row.findings || [], review_note: row.review_note || "", file_name: row.file_name || "",
    has_file: Boolean(row.blob_key), created_at: row.created_at, updated_at: row.updated_at,
    applicant_name: row.applicant_name,
  };
}

async function caseForUser(id, user) {
  const rows = await db.sql`SELECT c.*, u.display_name AS applicant_name
    FROM cases c JOIN users u ON u.id = c.applicant_id WHERE c.id = ${id}`;
  const row = rows[0];
  if (!row || (user.role === "applicant" && String(row.applicant_id) !== String(user.id))) return null;
  return row;
}

function analyzeText(text, type, duplicate) {
  const findings = [];
  const lower = text.toLowerCase();
  if (!text.trim()) {
    findings.push({ severity: "medium", code: "NO_TEXT", title: "No readable text extracted", detail: "This Netlify prototype only analyzes plain-text uploads; PDF and image files are stored for manual review.", recommendation: "Review the original document manually or upload a plain-text extract." });
  } else {
    const required = {
      "Institution Registration": ["institution", "registration"],
      "Faculty Credential": ["name", "qualification"],
      "Annual Compliance": ["institution", "year"],
      "General Application": ["name", "date"],
    }[type] || ["name", "date"];
    const missing = required.filter((term) => !lower.includes(term));
    if (missing.length) findings.push({ severity: "medium", code: "MISSING_FIELD", title: "Expected information not detected", detail: `The text check did not find: ${missing.join(", ")}. This is not proof that the information is absent.`, recommendation: "Review the original document and confirm whether the information is present." });
    const expiry = text.match(/(?:expiry|expires|valid\s+until|validity)\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
    if (expiry) {
      const parts = expiry[1].split(/[/-]/).map(Number);
      const year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
      const date = new Date(year, parts[1] - 1, parts[0]);
      if (!Number.isNaN(date.valueOf()) && date < new Date()) findings.push({ severity: "high", code: "EXPIRED_DATE", title: "Possible expired validity date", detail: `The extracted date ${expiry[1]} appears to be in the past.`, recommendation: "Confirm the date format and issuing authority before requesting an updated document." });
      else if (!Number.isNaN(date.valueOf()) && date < new Date(Date.now() + 60 * 86400000)) findings.push({ severity: "medium", code: "EXPIRY_SOON", title: "Validity date may be approaching", detail: `The extracted date ${expiry[1]} is within the next 60 days.`, recommendation: "Confirm the date and plan renewal if applicable." });
    }
    if (/\b(sample|demo|specimen|not for official use)\b/i.test(text)) findings.push({ severity: "low", code: "SAMPLE_MARKER", title: "Sample or specimen marker found", detail: "The text contains a sample/demo/specimen marker.", recommendation: "Confirm this is an intended demonstration document." });
  }
  if (duplicate) findings.push({ severity: "medium", code: "DUPLICATE_FILE", title: "Identical file already submitted", detail: `The file hash matches an existing submission (${duplicate}).`, recommendation: "Check whether the duplicate is an intended resubmission." });
  if (!findings.length) findings.push({ severity: "low", code: "RULES_PASSED", title: "No configured rule failures detected", detail: "The configured text checks found no priority issue. This does not prove authenticity.", recommendation: "Continue with human review." });
  const score = Math.min(100, findings.reduce((sum, f) => sum + ({ high: 35, medium: 18, low: 7 }[f.severity] || 7), 0));
  return { findings, score, level: score >= 60 ? "High" : score >= 25 ? "Medium" : "Low" };
}

async function handle(request) {
  await ensureDemoData();
  const url = new URL(request.url);
  let path = url.pathname.replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api\/v1/, "");
  if (!path.startsWith("/")) path = `/${path}`;
  const method = request.method.toUpperCase();

  if (path === "/health" && method === "GET") {
    await db.sql`SELECT 1`;
    return json({ status: "ok", service: "VerifyAI Netlify prototype", database: "connected" });
  }

  if (path === "/auth/login" && method === "POST") {
    const body = await request.json();
    const username = String(body.username || "").trim().slice(0, 80);
    const password = String(body.password || "");
    const attempts = await db.sql`SELECT failure_count, locked_until FROM login_attempts WHERE username = ${username}`;
    if (attempts[0]?.locked_until && new Date(attempts[0].locked_until) > new Date()) return json({ error: "Too many attempts. Wait one minute before trying again." }, 429);
    const users = await db.sql`SELECT id, username, password_hash, password_salt, role, display_name FROM users WHERE username = ${username} AND active = TRUE`;
    const user = users[0];
    const actual = user ? Buffer.from(passHash(password, user.password_salt), "hex") : scryptSync(password || "invalid", "verifyai-dummy-salt", 64);
    const expected = user ? Buffer.from(user.password_hash, "hex") : scryptSync("not-the-password", "verifyai-dummy-salt", 64);
    const valid = user && actual.length === expected.length && timingSafeEqual(actual, expected);
    if (!valid) {
      await db.sql`INSERT INTO login_attempts (username, failure_count) VALUES (${username || "unknown"}, 1)
        ON CONFLICT (username) DO UPDATE SET failure_count = login_attempts.failure_count + 1,
        locked_until = CASE WHEN login_attempts.failure_count + 1 >= 5 THEN NOW() + INTERVAL '1 minute' ELSE login_attempts.locked_until END`;
      await audit(null, "LOGIN_FAILURE", username || "unknown", "Netlify API sign-in failed");
      return json({ error: "Invalid username or password." }, 401);
    }
    await db.sql`DELETE FROM login_attempts WHERE username = ${username}`;
    const token = randomBytes(32).toString("hex");
    await db.sql`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${sha256(token)}, ${user.id}, NOW() + INTERVAL '12 hours')`;
    await audit(user, "LOGIN_SUCCESS", username, "Signed in through the Netlify API");
    return json({ user: { username: user.username, display_name: user.display_name, role: user.role }, accessToken: token });
  }

  if (path === "/auth/logout" && method === "POST") {
    const user = await apiUser(request);
    if (!user) return json({ error: "Sign in required." }, 401);
    await db.sql`DELETE FROM sessions WHERE token_hash = ${sha256((request.headers.get("authorization") || "").slice(7))}`;
    await audit(user, "LOGOUT", user.username, "Signed out through the Netlify API");
    return json({ status: "ok" });
  }

  if (path === "/cases" && method === "GET") {
    const user = await apiUser(request);
    if (!user) return json({ error: "Sign in required." }, 401);
    const rows = user.role === "applicant"
      ? await db.sql`SELECT c.*, u.display_name AS applicant_name FROM cases c JOIN users u ON u.id = c.applicant_id WHERE c.applicant_id = ${user.id} ORDER BY c.updated_at DESC`
      : await db.sql`SELECT c.*, u.display_name AS applicant_name FROM cases c JOIN users u ON u.id = c.applicant_id ORDER BY c.updated_at DESC`;
    return json({ cases: rows.map(caseView) });
  }

  if (path === "/cases" && method === "POST") {
    const user = await apiUser(request);
    if (!user) return json({ error: "Sign in required." }, 401);
    const form = await request.formData();
    const title = String(form.get("title") || "").trim().slice(0, 120);
    const type = String(form.get("application_type") || "General Application");
    const file = form.get("document");
    if (!title || !["Institution Registration", "Faculty Credential", "Annual Compliance", "General Application"].includes(type) || !file || typeof file.arrayBuffer !== "function") return json({ error: "Provide a title, application type, and document." }, 400);
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) return json({ error: "Choose a non-empty file smaller than 4 MB." }, 413);
    const filename = String(file.name || "document").replace(/[\\/\r\n]/g, "").slice(0, 200);
    const extension = filename.includes(".") ? filename.split(".").pop().toLowerCase() : "";
    if (!ALLOWED_TYPES.has(extension)) return json({ error: "Use a PDF, PNG, JPG, JPEG, or TXT file." }, 400);
    const bytes = await file.arrayBuffer();
    const fileHash = sha256(Buffer.from(bytes));
    const fileType = file.type || "application/octet-stream";
    const blobKey = randomBytes(18).toString("hex");
    await documents.set(blobKey, bytes, { metadata: { filename, fileType } });
    const extracted = extension === "txt" ? Buffer.from(bytes).toString("utf8").slice(0, 100000) : "";
    const duplicates = await db.sql`SELECT reference FROM cases WHERE file_hash = ${fileHash} LIMIT 1`;
    const analysis = analyzeText(extracted, type, duplicates[0]?.reference);
    const status = analysis.level === "High" ? "Under Review" : "Submitted";
    const ref = `VAI-${randomBytes(3).toString("hex").toUpperCase()}`;
    const created = await db.sql`INSERT INTO cases (reference, applicant_id, title, application_type, status, risk_score, risk_level, findings, extracted_text, file_name, file_type, blob_key, file_hash)
      VALUES (${ref}, ${user.id}, ${title}, ${type}, ${status}, ${analysis.score}, ${analysis.level}, ${JSON.stringify(analysis.findings)}::jsonb, ${extracted}, ${filename}, ${fileType}, ${blobKey}, ${fileHash})
      RETURNING id, reference, title, application_type, status, risk_score, risk_level, findings, review_note, file_name, blob_key, created_at, updated_at`;
    await audit(user, "CASE_CREATED", ref, `Created application; ${analysis.level} risk`);
    const row = await db.sql`SELECT c.*, u.display_name AS applicant_name FROM cases c JOIN users u ON u.id = c.applicant_id WHERE c.id = ${created[0].id}`;
    return json({ case: caseView(row[0]) }, 201);
  }

  const fileMatch = path.match(/^\/cases\/(\d+)\/file$/);
  if (fileMatch && method === "GET") {
    const user = await apiUser(request);
    if (!user) return json({ error: "Sign in required." }, 401);
    const row = await caseForUser(Number(fileMatch[1]), user);
    if (!row || !row.blob_key) return json({ error: "File not found." }, 404);
    const content = await documents.get(row.blob_key, { type: "arrayBuffer" });
    if (!content) return json({ error: "File not found." }, 404);
    await audit(user, "DOCUMENT_VIEWED", row.reference, "Authorized document download");
    const filename = encodeURIComponent(row.file_name || "document");
    return new Response(content, { headers: { "content-type": row.file_type || "application/octet-stream", "content-disposition": `attachment; filename*=UTF-8''${filename}`, "cache-control": "no-store" } });
  }

  const reviewMatch = path.match(/^\/cases\/(\d+)\/review$/);
  if (reviewMatch && method === "POST") {
    const user = await apiUser(request);
    if (!user) return json({ error: "Sign in required." }, 401);
    if (!["admin", "officer"].includes(user.role)) return json({ error: "Your role cannot update reviews." }, 403);
    const id = Number(reviewMatch[1]);
    const current = await caseForUser(id, user);
    if (!current) return json({ error: "Case not found." }, 404);
    const body = await request.json();
    const status = String(body.status || "");
    const note = String(body.review_note || "").trim().slice(0, 1000);
    if (!ALLOWED_STATUSES.has(status)) return json({ error: "Invalid case status." }, 400);
    await db.sql`UPDATE cases SET status = ${status}, review_note = ${note}, updated_at = NOW() WHERE id = ${id}`;
    await audit(user, "CASE_REVIEWED", current.reference, `Status set to ${status}; note length ${note.length}`);
    const rows = await db.sql`SELECT c.*, u.display_name AS applicant_name FROM cases c JOIN users u ON u.id = c.applicant_id WHERE c.id = ${id}`;
    return json({ case: caseView(rows[0]) });
  }

  const detailMatch = path.match(/^\/cases\/(\d+)$/);
  if (detailMatch && method === "GET") {
    const user = await apiUser(request);
    if (!user) return json({ error: "Sign in required." }, 401);
    const row = await caseForUser(Number(detailMatch[1]), user);
    if (!row) return json({ error: "Case not found." }, 404);
    return json({ case: caseView(row) });
  }

  return json({ error: "Not found." }, 404);
}

export default async (request) => {
  try { return await handle(request); }
  catch (error) {
    console.error("VerifyAI API error", error);
    return json({ error: "The request could not be completed." }, 500);
  }
};