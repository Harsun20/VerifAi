# VERIFY-AI prototype (SIH26261)

A deployable Netlify site: static front end plus a serverless backend, running on **synthetic data only**.

## Deploy
Push the **contents** of this folder so `netlify.toml` sits at the repo root. If Netlify shows a build command or publish directory you typed earlier (e.g. `node build.js` / `dist`), clear them in Site configuration > Build & deploy > Build settings, or set Publish directory to `public` and leave the build command empty.

Dragging only `public/` onto Netlify would skip the backend, so use Git or the CLI.

**Option A, Git (recommended)**
1. Push this folder to a GitHub repo.
2. Netlify > Add new site > Import from Git > pick the repo.
3. Build command: leave empty. Publish directory: `public`. Functions: `netlify/functions` (already set in `netlify.toml`).
4. Deploy.

**Option B, Netlify CLI**
```
npm i -g netlify-cli
netlify login
netlify deploy --prod      # first run: create a new site; publish dir = public
```

## Run locally
```
npm i -g netlify-cli
netlify dev                # http://localhost:8888, /api/* works
```

## Backend (Netlify Functions, no dependencies)
| Endpoint | Method | What it does |
|---|---|---|
| `/api/cases` | GET | Ranked queue; filters `q`, `outcome`, `priority`, `state`. `?id=APP-2604` returns full case and findings |
| `/api/stats` | GET | Dashboard aggregates |
| `/api/verify` | POST `{id, edits?}` | Re-runs rules; `edits` is a what-if on extracted values and returns what changed |
| `/api/extract` | POST `{text}` | Classifies a document and extracts fields from OCR-style text, with sanity checks |
| `/api/decision` | POST `{id, action, note}` | Validates an officer decision and returns a hash-chained audit entry |

Rules live in `netlify/functions/_lib/rules.js` (completeness, expiry, name matching, area/faculty/FD norms, timeline order, metadata edits, duplicate PAN/survey no., source status). Thresholds are illustrative, not official.

## Data
`netlify/functions/_lib/applications.json` holds 24 fictional applications with deliberately planted issues. Regenerate with `python tools/generate_data.py`.

## Limits of the prototype
- No real OCR: the Document lab takes pasted text. Production would add Tesseract/PaddleOCR.
- Functions are stateless; officer decisions are kept in the browser's localStorage. Production would use PostgreSQL.
- No login. Add role-based auth before any real use.
