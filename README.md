# VerifyAI — SIH26261

A two-part document review prototype based on the supplied SIH deck. The frontend is a static HTML5, CSS3, JavaScript, and Bootstrap site deployed on Netlify. The backend is a Python Flask API deployed on Render. It stores data in SQLite using SQL queries and can extract PDF text and optionally run image OCR through Tesseract.

## Stack used

- HTML5, CSS3, JavaScript, and Bootstrap for the Netlify frontend.
- Python and Flask for the backend and existing server-rendered prototype.
- SQL with SQLite for users, cases, and audit records.
- PyMuPDF for PDF text extraction; Tesseract is optional for image OCR.

The supplied deck also lists Celery and Redis as possible background-processing components. They are not needed for this synchronous prototype and are not included as active services. The current review checks are rule-based and are not official document authentication.

## Uploading to GitHub

Extract the ZIP first. Add the extracted project root as a repository with GitHub Desktop (or import the full folder with Git); the browser upload page often handles selected files but does not reliably include nested folders when files are picked one at a time.

## Project layout

```text
VerifyAI-SIH26261/
├── frontend/            # Static site source and Netlify build script
│   ├── public/           # HTML, CSS, and JavaScript
│   └── build.js          # Writes the backend URL into the built site
├── backend/             # Flask app, SQL persistence, templates, and uploads
├── netlify.toml         # Netlify site configuration
└── render.yaml          # Render free demo backend configuration
```

## Deploy the backend first (free prototype)

1. Push the complete extracted project folder to a Git repository. Keep `frontend`, `backend`, `netlify.toml`, and `render.yaml` together at the repository root.
2. In Render, choose **New → Blueprint**, connect the repository, and deploy the root `render.yaml`. It selects the **Free** web service plan and does not create a paid disk.
3. Wait for the backend to become live. Copy its HTTPS URL, such as `https://your-api.onrender.com`.
4. The prototype seeds fictional demo users and sample cases. Sign in with one of these shared demo accounts:

   | Role | Username | Password |
   |---|---|---|
   | Administrator | `demo.admin` | `Admin-Demo!84xQ` |
   | Compliance Officer | `demo.officer` | `Officer-Demo!72pR` |
   | Applicant | `demo.applicant` | `Applicant-Demo!63mK` |

5. After deploying the frontend, set Render's `VERIFYAI_ALLOWED_ORIGINS` environment variable to the exact Netlify site origin, then redeploy the backend.

**Prototype storage warning:** Render Free has an ephemeral filesystem and spins down after 15 minutes without traffic. The local SQLite database, uploaded files, and review changes can disappear on spin-down, restart, or redeploy; the fictional demo records are recreated when the app starts. The first request after sleep can take about a minute. Use only synthetic documents and data. This setup is for a demonstration, not real applications or confidential records.
## Deploy the frontend to Netlify

1. Create a Netlify site from the same Git repository. The included `netlify.toml` sets the base directory to `frontend`, runs `node build.js`, and publishes `frontend/dist`.
2. In the Netlify site environment variables, set `VERIFYAI_API_BASE_URL` to the backend HTTPS URL copied from Render (no `/api` suffix and no trailing slash).
3. Deploy the Netlify site and copy its HTTPS origin (for example, `https://your-site.netlify.app`).
4. Set that origin as `VERIFYAI_ALLOWED_ORIGINS` in Render and redeploy the backend.
5. Trigger a Netlify redeploy so the frontend build embeds the configured backend URL.

The Netlify site is the standalone user interface. The Flask API and database run on Render; Netlify does not host the Flask process or persistent SQLite database.

## Local development

Backend (PowerShell, from `backend/`):

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:VERIFYAI_SEED_DEMO_DATA = "true"
python app.py
```

The backend listens on `http://127.0.0.1:5000`. The included fictional local demo accounts are `demo.admin` / `Admin-Demo!84xQ`, `demo.officer` / `Officer-Demo!72pR`, and `demo.applicant` / `Applicant-Demo!63mK`. Use synthetic documents only.

Frontend (from `frontend/`, with Node.js installed):

```powershell
$env:VERIFYAI_API_BASE_URL = "http://127.0.0.1:5000"
node build.js
```

Serve the resulting `dist/` folder from a local static web server. For local cross-origin access, add that local site origin to the backend's `VERIFYAI_ALLOWED_ORIGINS` setting.

## Notes

- `GET /api/health` checks the Flask service and database. JSON endpoints are under `/api/v1/`.
- Uploads are limited to 12 MB and accepted types are PDF, PNG, JPG, JPEG, and TXT.
- Image OCR uses Tesseract; `backend/apt.txt` installs it for Render builds. PDF text extraction works without OCR.
- The free Render blueprint deliberately enables shared fictional demo accounts. Anyone who can reach the public demo can sign in with the published credentials, so never enter real personal, institutional, or confidential documents.
- This is a functional prototype, not a production-certified document verification service. Review real-data privacy, account recovery, backups, malware scanning, retention, database scaling, and independent security before using confidential records.