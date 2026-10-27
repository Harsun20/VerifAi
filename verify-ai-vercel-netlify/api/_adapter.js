// Lets the Netlify-style handlers in netlify/functions run as Vercel serverless functions.
module.exports = (handler) => async (req, res) => {
  const body = typeof req.body === "string" ? req.body : req.body ? JSON.stringify(req.body) : "";
  const out = await handler({ httpMethod: req.method, queryStringParameters: req.query || {}, body });
  Object.entries(out.headers || {}).forEach(([k, v]) => res.setHeader(k, v));
  res.status(out.statusCode).send(out.body || "");
};
