const fs = require("node:fs");
const path = require("node:path");
const apiBaseUrl = (process.env.VERIFYAI_API_BASE_URL || "").trim().replace(/\/$/, "");
if (!apiBaseUrl || (!/^https:\/\//i.test(apiBaseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(apiBaseUrl))) {
  console.error("Set VERIFYAI_API_BASE_URL to the HTTPS URL of the deployed Flask backend before building the Netlify frontend.");
  process.exit(1);
}
const publicDir = path.join(__dirname, "public");
const outputDir = path.join(__dirname, "dist");
fs.rmSync(outputDir, { recursive: true, force: true });
fs.cpSync(publicDir, outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "config.js"), `window.VERIFYAI_API_BASE_URL = ${JSON.stringify(apiBaseUrl)};\n`);
console.log("Frontend built for", apiBaseUrl);