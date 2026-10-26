# VerifyAI frontend

Static HTML5, CSS3, JavaScript, and Bootstrap interface for the Flask API. Netlify builds this directory with `node build.js` and publishes `dist/`.

Set `VERIFYAI_API_BASE_URL` in the Netlify site environment to the HTTPS base URL of the backend (without a trailing slash). The build writes this setting into `dist/config.js`.