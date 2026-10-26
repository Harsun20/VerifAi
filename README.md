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
└── render.yaml          # Render Flask API and persistent disk configuration
```

## Deploy the backend first

1. Push the complete extracted project folder to a Git repository. Keep the `frontend`, `backend`, `netlify.toml`, and `render.yaml` paths together at the repository root.
2. In Render, create a Blueprint from the repository. Render uses the root `render.yaml` and deploys the Flask service from `backend/`.
3. The Blueprint creates a secret key, disables demo accounts, and stores SQLite data plus uploads on a persistent disk. The disk requires a paid Render web service. This SQLite setup is for a single-instance prototype.
4. Copy the deployed backend HTTPS URL, such as `https://your-api.onrender.com`.
5. In the Render service environment, set `VERIFYAI_ALLOWED_ORIGINS` to your Netlify site origin after Netlify is created, for example `https://your-site.netlify.app`. It must match exactly, with no path or trailing slash. Redeploy the backend after setting it.
6. Create accounts from the Render Shell with `flask --app app create-user`. Choose `admin`, `officer`, or `applicant`; use a unique username and a password with at least 12 characters.

The backend uses a signed bearer token for the separated frontend. Tokens stay in browser memory and expire after 12 hours. Do not put the backend secret in the frontend.

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
- Demo seeding is enabled locally by default and disabled in production. Do not enable demo accounts on a public service.
- This is a functional prototype, not a production-certified document verification service. Review real-data privacy, account recovery, backups, malware scanning, retention, database scaling, and independent security before using confidential records.