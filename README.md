# VERIFY-AI — Netlify-ready certificate verifier prototype

A responsive prototype blueprint for reviewing many kinds of government certificate submissions, including identity, tax identity, income, caste/community, domicile/residence, birth, death, marriage, education, land/property, food entitlement, disability, and other certificate types. It includes a demo sign-in screen, a one-click demo login, synthetic application records, case review, checklist validation, and a session audit trail.

## Demo sign-in
- Username: `demo`
- Password: `verifyai-demo`
- Or select **Continue with demo login**.

The login is a front-end demo gate with credentials visible in the shipped files. It is not authentication and does not protect data. Use only synthetic data. Do not use this prototype to verify real applicants or make official decisions.

## Deploy to Netlify
1. Extract the ZIP.
2. Upload the `verify-ai-netlify` folder to a GitHub repository.
3. In Netlify, choose **Add new site → Import an existing project** and select that repository.
4. Set **Build command** to blank, **Publish directory** to `public`, and **Functions directory** to `netlify/functions`.
5. Deploy. Netlify reads `netlify.toml` for the function setup.

The front end is in `public/`. The serverless demo API is in `netlify/functions/api.js`.

## API
- `GET /.netlify/functions/api` — returns synthetic cases.
- `POST /.netlify/functions/api` with `{"action":"validate","applicant":"Demo User","category":"Income certificate","documents":["Application form","Identity proof"]}` — runs the sample checklist.
- `POST /.netlify/functions/api` with `{"action":"review","id":"VA-26041","status":"In progress"}` — updates a demo case status.

## Prototype limitations
- All people, organisations, case IDs, dates, identifiers, and evidence values are fabricated.
- Category options illustrate intended breadth; they do not mean each certificate type is supported by verified rules.
- Checklist behavior is basic and deterministic. This prototype does not upload or parse certificates, perform OCR, verify signatures, connect to government registries or DigiLocker, or make official decisions.
- API changes are held in function-instance memory and can reset.
- Before real use, replace the demo gate with secure authentication and authorization, add durable storage, secure document handling, verified rules for each certificate authority, privacy controls, audit retention, and human review.