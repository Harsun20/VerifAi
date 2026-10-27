const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
};
const json = (status, body) => ({ statusCode: status, headers, body: JSON.stringify(body) });
const parse = (event) => { try { return JSON.parse(event.body || "{}"); } catch { return null; } };
module.exports = { json, parse };
