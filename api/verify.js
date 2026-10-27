const wrap = require("./_adapter");
module.exports = wrap(require("../netlify/functions/verify").handler);
