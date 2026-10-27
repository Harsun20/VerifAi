/* VERIFY-AI front end: vanilla JS, hash routing, talks to /api/* (Netlify Functions). */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const view = $("#view");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fdate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || "") ? `${+s.slice(8)} ${MON[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}` : s || "");
  const OUTCOME = {
    issues: ["Missing requirements or incompatibility identified", "Shows the evidence-linked finding and the recommended action."],
    manual: ["Source unavailable or manual verification needed", "Routed to an authorised official for manual checks."],
    clear: ["No pre-defined issue detected", "Continue through review and cross-checking."],
  };
  const SEV = { high: "High", medium: "Medium", low: "Low", info: "Info" };
  const LABELS = {
    trust_name: "Trust name", registration_no: "Registration no.", registration_date: "Registered on", pan: "PAN",
    holder_name: "Holder name", deed_type: "Deed type", survey_no: "Survey no.", area_sqm: "Land area (sq m)",
    issue_date: "Issued on", lease_years: "Lease (years)", applicant_name: "Applicant name",
    approved_built_up_sqm: "Built-up (sq m)", approval_date: "Approved on", authority: "Authority",
    built_up_sqm: "Built-up (sq m)", valid_until: "Valid until", deponent_trust: "Deponent", declared_intake: "Declared intake",
    date: "Dated", faculty_count: "Faculty count", proposed_intake: "Proposed intake", account_holder: "Account holder",
    fd_lakh: "FD (₹ lakh)", as_of: "As of",
  };
  const SRC = { verified: "Verified at source", unavailable: "Source unavailable", not_applicable: "No source check" };

  /* ---------- api ---------- */
  async function api(path, opts) {
    let res;
    try { res = await fetch("/api/" + path, opts); } catch (e) { throw new Error("Could not reach the backend. Run with `netlify dev` or deploy to Netlify so /api works."); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }
  const post = (p, body) => api(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  /* ---------- local audit store ---------- */
  const store = {
    get() { try { return JSON.parse(localStorage.getItem("verifyai.audit") || "[]"); } catch { return []; } },
    add(e) { try { const a = this.get(); a.unshift(e); localStorage.setItem("verifyai.audit", JSON.stringify(a.slice(0, 200))); } catch {} },
    clear() { try { localStorage.removeItem("verifyai.audit"); } catch {} },
  };
  const decisionFor = (id) => store.get().find((e) => e.id === id);

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  const loading = (t = "Loading…") => (view.innerHTML = `<p class="muted">${t}</p>`);
  const fail = (e) => (view.innerHTML = `<div class="err"><b>Something went wrong.</b> ${esc(e.message)}</div>`);

  /* ---------- views ---------- */
  async function dashboard() {
    loading();
    const s = await api("stats");
    const max = Math.max(...s.byCategory.map((c) => c.count), 1);
    view.innerHTML = `
      <div class="page-head"><div><h1>Overview</h1>
      <p class="sub">${s.totalApplications} synthetic applications were run through the rules engine. Every finding is linked to the document fields that triggered it.</p></div>
      <a class="btn" href="#/queue">Open review queue</a></div>
      <div class="outcomes">
        ${["issues", "manual", "clear"].map((k) => `<button class="outcome ${k}" data-o="${k}"><span class="n">${s.outcomes[k]}</span><span class="l">${OUTCOME[k][0]}</span><span class="d">${OUTCOME[k][1]}</span></button>`).join("")}
      </div>
      <div class="grid2">
        <div class="panel"><h2>What the checks found</h2>
          <div class="bars">${s.byCategory.map((c) => `<div class="bar"><span>${esc(c.name)}</span><span class="track"><i style="width:${(c.count / max) * 100}%"></i></span><b>${c.count}</b></div>`).join("")}</div>
          <div class="stat-row" style="margin-top:18px">
            <div><b>${s.totalFindings}</b><span>findings raised</span></div>
            <div><b>${s.bySeverity.high}</b><span>high severity</span></div>
            <div><b>${Math.round(s.estimatedMinutesSaved / 60)} h</b><span>manual checking avoided (illustrative: 12 min per finding)</span></div>
          </div></div>
        <div class="panel"><h2>Review first</h2>
          <ul class="mini">${s.top.map((t) => `<li><span><a href="#/case/${t.id}">${t.id}</a><br><span class="muted">${esc(t.institution)}</span></span><span class="tag ${t.priority}">${t.priority} · ${t.score}</span></li>`).join("")}</ul></div>
      </div>`;
    view.querySelectorAll(".outcome").forEach((b) => (b.onclick = () => (location.hash = "#/queue?outcome=" + b.dataset.o)));
  }

  async function queue(params) {
    loading();
    const q = new URLSearchParams(params);
    const data = await api("cases?" + q.toString());
    const sel = (name, opts, label) => `<select name="${name}" aria-label="${label}"><option value="">${label}</option>${opts.map(([v, t]) => `<option value="${v}" ${q.get(name) === v ? "selected" : ""}>${t}</option>`).join("")}</select>`;
    view.innerHTML = `
      <div class="page-head"><div><h1>Review queue</h1><p class="sub">Highest risk first, so officers start with the cases that most need attention.</p></div></div>
      <form class="filters" id="f">
        <input name="q" type="search" placeholder="Search by ID, institution, city" aria-label="Search" value="${esc(q.get("q") || "")}">
        ${sel("outcome", Object.entries(OUTCOME).map(([k, v]) => [k, v[0]]), "Any outcome")}
        ${sel("priority", ["Critical", "High", "Medium", "Low"].map((x) => [x, x]), "Any priority")}
        <button class="btn ghost" type="submit">Apply</button>
      </form>
      <div class="panel tbl-wrap">${data.cases.length ? `<table><thead><tr><th>Case</th><th>Institution</th><th>Request</th><th>Priority</th><th>Top finding</th><th>Decision</th></tr></thead><tbody>
        ${data.cases.map((c) => { const d = decisionFor(c.id); return `<tr>
          <td><a href="#/case/${c.id}">${c.id}</a><br><span class="muted">${fdate(c.submittedOn)}</span></td>
          <td>${esc(c.institution)}<br><span class="muted">${esc(c.city)}, ${esc(c.state)}</span></td>
          <td>${esc(c.programType)}<br><span class="muted">Intake ${c.proposedIntake}</span></td>
          <td><span class="score"><span class="tag ${c.priority}">${c.priority}</span><i><em style="width:${c.score}%"></em></i>${c.score}</span></td>
          <td>${c.topFinding ? esc(c.topFinding) : '<span class="muted">None</span>'}${c.counts.high ? `<br><span class="muted">${c.counts.high} high, ${c.counts.medium} medium</span>` : ""}</td>
          <td>${d ? esc(d.label) : '<span class="muted">Pending</span>'}</td></tr>`; }).join("")}
        </tbody></table>` : `<div class="empty">No cases match these filters. Clear a filter to see more.</div>`}</div>`;
    $("#f").onsubmit = (e) => {
      e.preventDefault();
      const p = new URLSearchParams();
      new FormData(e.target).forEach((v, k) => v && p.set(k, v));
      location.hash = "#/queue" + (p.toString() ? "?" + p : "");
    };
  }

  async function casePage(id) {
    loading();
    const { application: app, result } = await api("cases?id=" + encodeURIComponent(id));
    let current = result, dirty = {}, active = null;

    function sheetHTML(key, doc) {
      if (!doc.present) {
        return `<section class="sheet missing" data-doc="${key}"><header><b>${esc(doc.label)}</b><span class="src">Not submitted</span></header>
          <div class="f" data-doc="${key}" data-field="present"><label>Status</label><span class="none">Missing from submission</span></div></section>`;
      }
      const rows = Object.entries(doc.fields).map(([k, v]) => `<div class="f" data-doc="${key}" data-field="${k}"><label for="i-${key}-${k}">${LABELS[k] || k}</label>
        <textarea rows="1" id="i-${key}-${k}" data-doc="${key}" data-k="${k}" spellcheck="false" title="${/date|until|as_of|^date$/.test(k) ? fdate(v) : ''}">${esc(v)}</textarea></div>`).join("");
      return `<section class="sheet" data-doc="${key}"><header><b>${esc(doc.label)}</b><span class="src">${SRC[doc.source]}</span></header>${rows}
        <div class="metahead">File properties</div>
        <div class="f meta" data-doc="${key}" data-field="meta.modified"><label>Modified</label><span>${fdate(doc.meta.modified)}</span></div>
        <div class="f meta" data-doc="${key}" data-field="meta.software"><label>Software</label><span>${esc(doc.meta.software)}</span></div></section>`;
    }

    function render(delta) {
      const r = current, dec = decisionFor(app.id);
      view.innerHTML = `
        <div class="crumbs"><a href="#/queue">Review queue</a> / ${app.id}</div>
        <div class="page-head"><div><h1>${esc(app.institution)}</h1>
          <p class="sub">${esc(app.programType)} · ${esc(app.city)}, ${esc(app.state)} · submitted ${fdate(app.submittedOn)} · proposed intake ${app.proposedIntake}</p></div>
          <div class="verdict"><span class="dial">${r.score}</span><div><span class="tag ${r.priority}">${r.priority} priority</span><br><span class="muted">${OUTCOME[r.outcome][0]}</span></div></div></div>
        ${delta ? `<div class="delta" role="status"><b>Re-run complete.</b> Score ${delta.scoreChange > 0 ? "+" : ""}${delta.scoreChange}.
          ${delta.resolved.length ? `<br>Resolved: ${delta.resolved.map(esc).join("; ")}.` : ""}${delta.introduced.length ? `<br>New: ${delta.introduced.map(esc).join("; ")}.` : ""}
          ${!delta.resolved.length && !delta.introduced.length ? "<br>No change in findings." : ""}</div>` : ""}
        <div class="case-grid">
          <div>
            <h2>Findings (${r.findings.length})</h2>
            <div class="findings">${r.findings.length ? r.findings.map((f, i) => `
              <button class="finding ${f.severity}" data-i="${i}" aria-pressed="${active === i}">
                <span class="top"><span class="tag ${f.severity}">${SEV[f.severity]}</span><span class="cat">${esc(f.category)}</span></span>
                <strong>${esc(f.title)}</strong><p>${esc(f.detail)}</p>
                <div class="act"><b>Recommended:</b> ${esc(f.action)}</div></button>`).join("")
              : `<div class="empty">No pre-defined issue detected. Continue with standard review.</div>`}</div>
            <div class="panel decision" style="margin-top:18px"><h2>Officer decision</h2>
              ${dec ? `<p><span class="tag clear">${esc(dec.label)}</span> <span class="muted">${new Date(dec.at).toLocaleString()}</span></p><p>${esc(dec.note) || "<span class='muted'>No note.</span>"}</p><p class="hash">audit hash ${dec.hash}</p>` : ""}
              <label for="note" class="muted">Note for the audit trail (optional)</label>
              <textarea id="note" maxlength="500"></textarea>
              <div class="row">
                <button class="btn" data-a="approve">Clear for approval</button>
                <button class="btn ghost" data-a="correction">Request correction</button>
                <button class="btn ghost" data-a="escalate">Escalate to audit</button>
                <button class="btn danger" data-a="reject">Reject</button></div></div>
          </div>
          <div>
            <div class="toolbar"><h2 style="margin:0">Submitted documents</h2><span class="muted">Click a finding to see its evidence. Edit a value to test a fix.</span>
              <button class="btn" id="rerun" disabled>Re-run checks</button></div>
            <div class="pipeline" aria-label="Pipeline">${["Intake", "Classification", "Field extraction", "Checklist rules", "Anomaly signals", "Cross-document checks", "Evidence-linked report"].map((p) => `<span class="on">${p}</span>`).join("")}</div>
            <div class="sheets" style="margin-top:12px">${Object.entries(app.documents).map(([k, d]) => sheetHTML(k, d)).join("")}</div>
          </div>
        </div>`;
      bind();
      if (active !== null) highlight(active);
    }

    function autosize(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }

    function highlight(i) {
      view.querySelectorAll(".f.mark").forEach((n) => n.classList.remove("mark"));
      const f = current.findings[i]; if (!f) return;
      let first = null;
      f.evidence.forEach((e) => {
        const n = view.querySelector(`.f[data-doc="${e.doc}"][data-field="${e.field}"]`);
        if (n) { n.classList.add("mark"); first = first || n; }
      });
      if (first) first.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }

    function bind() {
      view.querySelectorAll(".finding").forEach((b) => (b.onclick = () => {
        active = active === +b.dataset.i ? null : +b.dataset.i;
        view.querySelectorAll(".finding").forEach((x) => x.setAttribute("aria-pressed", String(+x.dataset.i === active)));
        if (active === null) view.querySelectorAll(".f.mark").forEach((n) => n.classList.remove("mark")); else highlight(active);
      }));
      view.querySelectorAll(".sheet textarea").forEach(autosize);
      view.querySelectorAll(".sheet textarea").forEach((inp) => (inp.onkeydown = (e) => e.key === "Enter" && e.preventDefault(), inp.oninput = () => {
        autosize(inp);
        const { doc, k } = inp.dataset, orig = app.documents[doc].fields[k];
        const row = inp.closest(".f");
        if (String(orig) !== inp.value) { (dirty[doc] = dirty[doc] || {})[k] = inp.value; row.classList.add("dirty"); }
        else { delete dirty[doc][k]; row.classList.remove("dirty"); }
        $("#rerun").disabled = !Object.values(dirty).some((o) => Object.keys(o).length);
      }));
      $("#rerun").onclick = async (e) => {
        e.target.disabled = true; e.target.textContent = "Running…";
        try {
          const out = await post("verify", { id: app.id, edits: dirty });
          current = out.result; active = null;
          // reflect edits in the displayed copy so what-if values stay visible
          for (const [d, o] of Object.entries(dirty)) for (const [k, v] of Object.entries(o)) {
            const cur = app.documents[d].fields[k]; app.documents[d].fields[k] = typeof cur === "number" ? Number(v) : v;
          }
          dirty = {};
          render(out.delta);
          toast(`Checks re-run in ${out.ranInMs} ms. Edits are a what-if and are not saved.`);
        } catch (err) { toast(err.message); e.target.disabled = false; e.target.textContent = "Re-run checks"; }
      };
      view.querySelectorAll("[data-a]").forEach((b) => (b.onclick = async () => {
        const prev = store.get()[0];
        try {
          const out = await post("decision", { id: app.id, action: b.dataset.a, note: $("#note").value, prevHash: prev ? prev.hash : "GENESIS" });
          store.add(out.entry); toast("Decision recorded: " + out.entry.label); render();
        } catch (err) { toast(err.message); }
      }));
    }
    render();
  }

  /* ---------- document lab ---------- */
  const SAMPLES = {
    "Fire NOC (clean)": "GOVERNMENT FIRE SERVICES DEPARTMENT\nFIRE SAFETY NO OBJECTION CERTIFICATE\nName of Applicant: Riverstone Education Trust\nBuilding: Academic block A, Survey No: 214/3B\nBuilt-up area: 2,480 sq m\nDate of Issue: 14/03/2026\nValid up to: 13/03/2027\nIssued by the District Fire Authority.",
    "Fire NOC (suspicious)": "FIRE SAFETY NOC (edited in Online PDF Editor)\nName of Applicant: Riverstone Education Trust\nBuilt-up area: 2,480 sq m\nDate of Issue: 02/05/2027\nValid up to: 01/05/2026\nIssued by the District Fire Authority.",
    "Affidavit": "AFFIDAVIT\nI, the deponent, do hereby solemnly affirm and declare as follows.\nDeponent: Riverstone Education Trust\nThe institution proposes an intake of 240 students for the academic year.\nDate: 20/09/2026\nSworn before the Notary Public.",
    "Bank statement": "NATIONAL EXAMPLE BANK - Statement of Fixed Deposit\nAccount holder: Riverstone Education Trust\nFD No: 00481122\nBalance: ₹ 72.5 lakh\nDate: 05/09/2026",
  };

  function lab() {
    view.innerHTML = `
      <div class="page-head"><div><h1>Document lab</h1><p class="sub">Paste text as OCR would return it, or load a sample. The backend classifies the document, pulls out key fields, and runs quick sanity checks.</p></div></div>
      <div class="lab">
        <div class="panel"><h2>Document text</h2>
          <div class="chips">${Object.keys(SAMPLES).map((k) => `<button class="chip" data-s="${esc(k)}">${esc(k)}</button>`).join("")}</div>
          <label class="sr" for="txt">Document text</label>
          <textarea id="txt" placeholder="Paste document text here"></textarea>
          <p style="margin:12px 0 0"><button class="btn" id="go">Extract and check</button></p></div>
        <div class="panel" id="out"><h2>Result</h2><div class="empty">Load a sample or paste text, then choose Extract and check.</div></div>
      </div>`;
    view.querySelectorAll(".chip").forEach((c) => (c.onclick = () => ($("#txt").value = SAMPLES[c.dataset.s])));
    $("#go").onclick = async () => {
      const text = $("#txt").value;
      if (!text.trim()) { toast("Add some document text first."); return; }
      $("#go").disabled = true;
      try {
        const r = await post("extract", { text });
        const c = r.classification;
        $("#out").innerHTML = `<h2>Result</h2>
          <h3>${esc(c.label)}</h3><div class="conf" title="Confidence"><i style="width:${Math.round(c.confidence * 100)}%"></i></div>
          <p class="muted">Confidence ${Math.round(c.confidence * 100)}%${c.matchedKeywords.length ? " · matched: " + c.matchedKeywords.map(esc).join(", ") : ""}${c.alternatives.length ? " · also considered: " + c.alternatives.map(esc).join(", ") : ""}</p>
          <h3 style="margin-top:14px">Extracted fields (${r.fieldCount})</h3>
          ${r.fieldCount ? `<dl class="kv">${Object.entries(r.fields).map(([k, v]) => `<dt>${esc(k.replace(/_/g, " "))}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : `<p class="muted">No fields recognised.</p>`}
          <h3 style="margin-top:14px">Checks</h3>
          ${r.checks.length ? r.checks.map((x) => `<p><span class="tag ${x.severity}">${SEV[x.severity]}</span> ${esc(x.text)}</p>`).join("") : `<p><span class="tag clear">Clear</span> No issues found in this document.</p>`}
          <p class="muted" style="font-size:13px">${esc(r.note)}</p>`;
      } catch (e) { $("#out").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
      $("#go").disabled = false;
    };
  }

  function audit() {
    const a = store.get();
    view.innerHTML = `<div class="page-head"><div><h1>Audit trail</h1><p class="sub">Every officer decision is hash-chained to the one before it. In this demo the trail lives in your browser only.</p></div>
      ${a.length ? `<button class="btn ghost" id="clr">Clear trail</button>` : ""}</div>
      <div class="panel">${a.length ? `<ul class="trail">${a.map((e) => `<li><b><a href="#/case/${e.id}">${e.id}</a></b> · ${esc(e.label)} · ${esc(e.officer)}<br><span class="muted">${new Date(e.at).toLocaleString()}${e.note ? " · " + esc(e.note) : ""}</span><br><span class="hash">${e.hash} ← ${esc(e.prevHash)}</span></li>`).join("")}</ul>` : `<div class="empty">No decisions yet. Open a case from the review queue and record one.</div>`}</div>`;
    const c = $("#clr"); if (c) c.onclick = () => { store.clear(); audit(); };
  }

  function about() {
    view.innerHTML = `<div class="page-head"><div><h1>About this prototype</h1></div></div>
      <div class="panel prose">
        <h2>What it does</h2>
        <p>VERIFY-AI helps an officer review an application by showing what is missing, what does not agree across documents, and what looks edited, then putting the riskiest cases first. The officer always makes the final decision.</p>
        <h2>What is real in this build</h2>
        <p>A rules engine runs on a Netlify Function: completeness, validity, name matching across documents, area and faculty norms, timeline order, file-metadata anomalies, cross-application duplicates and source status. Try <code>/api/cases</code>, <code>/api/stats</code>, <code>/api/verify</code>, <code>/api/extract</code> and <code>/api/decision</code>.</p>
        <h2>What is simulated</h2>
        <p>There is no real OCR here, so the Document lab takes text. Source checks (DigiLocker, NAD) are marked in the data rather than called. Decisions are stored in your browser, not a database. All records and thresholds are synthetic.</p>
        <h2>Next steps from the roadmap</h2>
        <p>Tesseract or PaddleOCR on uploaded files, PostgreSQL storage, role-based login, and approved integrations with official sources.</p>
      </div>`;
  }

  /* ---------- router ---------- */
  const routes = { dashboard, queue, lab, audit, about };
  async function route() {
    const raw = location.hash.replace(/^#\/?/, "") || "dashboard";
    const [path, qs] = raw.split("?");
    const [name, arg] = path.split("/");
    const navKey = name === "case" ? "queue" : routes[name] ? name : "dashboard";
    document.querySelectorAll("#nav a").forEach((a) => (a.dataset.r === navKey ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    try {
      if (name === "case" && arg) await casePage(arg);
      else await (routes[name] || dashboard)(qs || "");
    } catch (e) { fail(e); }
    window.scrollTo(0, 0);
    $("#main").focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", route);
  route();
})();
