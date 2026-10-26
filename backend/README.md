# VerifyAI Flask backend

Python Flask application with HTML templates for local use, a JSON API under `/api/v1/`, SQLite persistence through SQL, protected uploads, rule-based review findings, audit events, and PDF reports.

Deploy the complete repository using the root `render.yaml`. The Netlify frontend calls this service through signed bearer tokens. Set `VERIFYAI_ALLOWED_ORIGINS` in Render to the exact HTTPS origin of the Netlify site. Use `flask --app app create-user` from the Render Shell to provision an administrator, officer, or applicant.

The backend uses a persistent Render disk for SQLite and uploads. This is a single-instance prototype deployment. See the root README for the full deployment sequence and limitations.