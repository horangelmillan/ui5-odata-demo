// UI5 server middleware: pure reverse proxy for /odata -> http://127.0.0.1:3000.
// Mounted at `mountPath: /odata` by ui5 serve, so connect strips that prefix:
// inside here `req.url` is the path AFTER /odata (e.g. "/$metadata",
// "/product-odata", "/product-odata/104"). We reconstruct the target path.
//
// Unlike the old `metadata-shim`, this proxy forwards EVERYTHING verbatim to the
// real servidor-odata, including `$metadata`. The server now serves a valid OData
// V4 CSDL JSON 4.01 document at /odata/$metadata, so UI5 ODataModel v4 bootstraps
// directly from the server with NO shim.
const http = require("http");
const fs = require("fs");
const path = require("path");

const LOG = path.join(__dirname, "..", "shim.log");
function log() {
  try { fs.appendFileSync(LOG, Array.prototype.join.call(arguments, " ") + "\n"); } catch (e) {}
}

module.exports = function () {
  const TARGET_HOST = "127.0.0.1";
  const TARGET_PORT = 3000;

    // Finance entity sets need /finance/ prefix in the URL, but the OData V4 model
    // binds to entity set names directly (e.g., "invoice-odata"), not to the URL
    // path "finance/invoice-odata". Rewrite root entity set paths to /finance/.
    var FINANCE_ENTITY_SETS = [
        "invoice-odata", "customer-odata", "payment-odata",
        "company-odata", "supplier-odata", "gl-account-odata",
        "supplier-invoice-odata", "invoice-item-odata"
    ];
    var FINANCE_RE = new RegExp("^/(" + FINANCE_ENTITY_SETS.join("|") + ")(\\?|/|$)");

    return function (req, res, next) {
        var stripped = req.url || "";
        // Rewrite root entity set paths to /finance/ for the backend
        stripped = stripped.replace(FINANCE_RE, "/finance/$1$2");
        var fullPath = "/odata" + stripped;
    log("[proxy] " + req.method + " " + JSON.stringify(req.url) + " -> " + fullPath);

    const headers = Object.assign({}, req.headers, {
      host: TARGET_HOST + ":" + TARGET_PORT,
    });
    const options = {
      host: TARGET_HOST,
      port: TARGET_PORT,
      method: req.method,
      path: fullPath,
      headers: headers,
    };
    const proxyReq = http.request(options, function (proxyRes) {
      const chunks = [];
      proxyRes.on("data", function (c) { chunks.push(c); });
      proxyRes.on("end", function () {
        const body = Buffer.concat(chunks).toString("utf8");
        log("[proxy] <- " + fullPath + " status=" + proxyRes.statusCode +
            " ctype=" + (proxyRes.headers["content-type"] || "") + " len=" + body.length);
      });
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", function (e) {
      log("[proxy] ERROR " + String(e));
      res.statusCode = 502;
      res.end(String(e));
    });
    req.pipe(proxyReq);
  };
};
