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

    // Finance entity sets: the OData metadata exposes entity set names (used by
    // UI5 bindings) sometimes with hyphens (e.g., "supplier-invoice-odata") but
    // the backend controller endpoints use the literal camelCase (e.g.,
    // "supplierinvoice-odata"). This map pairs the metadata name (what the UI5
    // ODataModel sends) to the actual backend endpoint name.
    var FINANCE_ENDPOINT_MAP = {
        "invoice-odata": "invoice-odata",
        "customer-odata": "customer-odata",
        "payment-odata": "payment-odata",
        "company-odata": "company-odata",
        "supplier-odata": "supplier-odata",
        "gl-account-odata": "glaccount-odata",
        "supplier-invoice-odata": "supplierinvoice-odata",
        "invoice-item-odata": "invoiceitem-odata",
        "invoiceItem-odata": "invoiceitem-odata"
    };
    var FINANCE_RE = new RegExp("^/?(" + Object.keys(FINANCE_ENDPOINT_MAP).join("|") + ")(\\?|\\(|/|$)");

    return function (req, res, next) {
        var stripped = req.url || "";
        // Rewrite root entity set paths to /finance/ for the backend
        // using the endpoint map to resolve metadata names to actual paths.
        stripped = stripped.replace(FINANCE_RE, function(match, entitySet, rest) {
            var backendName = FINANCE_ENDPOINT_MAP[entitySet];
            return "/finance/" + backendName + rest;
        });
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
