# VERIFY-AI — Netlify-ready demo

A responsive prototype based on the VERIFY-AI / SIH26261 presentation. Includes synthetic application records, dashboard, searchable case table, evidence-linked findings, rule checklist, a simple validation form, status updates, and a session audit trail.

## Deploy to Netlify
1. Extract this ZIP.
2. Push the extracted folder to a GitHub repository.
3. In Netlify, choose **Add new site → Import an existing project** and select the repository.
4. Build settings: **Build command:** leave blank; **Publish directory:** `public`; **Functions directory:** `netlify/functions`.
5. Deploy. Netlify detects `netlify.toml` and publishes the serverless function.

Alternatively, install Node.js and run `npm install -g netlify-cli`, then from the project folder run `netlify dev` to test locally.

## API
- `GET /.netlify/functions/api` — returns synthetic cases.
- `POST /.netlify/functions/api` with `{"action":"validate","applicant":"Demo User","category":"KYC","documents":["Application form","Identity proof"]}` — runs checklist rules.
- `POST /.netlify/functions/api` with `{"action":"review","id":"VA-26041","status":"In progress"}` — updates a demo case status.

## Important limitations
- All people, organisations, case IDs, dates, identifiers, and evidence values are fabricated.
- The API keeps changes in function-instance memory; state may reset and is not durable.
- This prototype does not upload or parse files, perform OCR, verify cryptographic signatures, connect to AICTE/NAD/DigiLocker or other registries, or make official regulatory decisions.
- Do not enter real personal or confidential data. Before production use, add authentication/authorization, durable database storage, secure file handling, audit retention, privacy controls, and human review.
