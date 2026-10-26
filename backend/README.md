# VerifyAI Flask backend

Python Flask application with a JSON API under `/api/v1/`, SQLite persistence through SQL, protected uploads, rule-based review findings, audit events, and PDF reports. The Render Free prototype seeds fictional demonstration accounts and cases.

Deploy the repository root as a Render Blueprint. The free service uses temporary local storage: SQLite records and uploaded files can be cleared whenever it sleeps, restarts, or redeploys. Set `VERIFYAI_ALLOWED_ORIGINS` to the exact Netlify site origin. Use only synthetic demo data.