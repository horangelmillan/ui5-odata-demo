// UI5 server middleware (single /odata handler).
// Mounted at `mountPath: /odata` by ui5 serve, so connect strips that prefix:
// inside here `req.url` is the path AFTER /odata (e.g. "/$metadata",
// "/product-odata", "/product-odata/104"). We reconstruct the target path.
//
//  - GET /odata/$metadata  -> serves a STANDARD OData V4 EDMX document
//    (webapp/model/metadata.xml). This works around the server's non-standard
//    $metadata (custom CSDL `entities`/`metadata` wrapper) which the UI5 OData
//    V4 metadata converter cannot parse.
//  - any other /odata/*     -> proxied verbatim to the real server at
//    http://127.0.0.1:3000 (data protocol, writes, $batch, etc.)
//  - everything else        -> next() (UI5 app + /resources served by ui5 serve)
const fs = require("fs");
const path = require("path");
const http = require("http");

const LOG = path.join(__dirname, "..", "shim.log");
function log() {
  try { fs.appendFileSync(LOG, Array.prototype.join.call(arguments, " ") + "\n"); } catch (e) {}
}

module.exports = function (params) {
  params = params || {};
  const edmx = fs.readFileSync(
    path.join(__dirname, "..", "webapp", "model", "metadata.xml"),
    "utf-8"
  );
  const TARGET_HOST = "127.0.0.1";
  const TARGET_PORT = 3000;

  return function (req, res, next) {
    const stripped = req.url || "";
    const fullPath = "/odata" + stripped;
    log("[shim] method=" + req.method + " url=" + JSON.stringify(req.url) + " fullPath=" + JSON.stringify(fullPath));

    const wantsMetadata =
      (req.method === "GET" || req.method === "HEAD") &&
      (stripped.indexOf("/$metadata") !== -1 || stripped === "/" || stripped === "");
    if (wantsMetadata) {
      log("[shim] SERVE EDMX for " + JSON.stringify(stripped) + " (" + req.method + ")");
      res.setHeader("Content-Type", "application/xml");
      res.setHeader("OData-Version", "4.0");
      res.statusCode = 200;
      if (req.method === "HEAD") return res.end();
      return res.end(edmx);
    }

    const headers = Object.assign({}, req.headers, {
      host: TARGET_HOST + ":" + TARGET_PORT
    });
    const options = {
      host: TARGET_HOST,
      port: TARGET_PORT,
      method: req.method,
      path: fullPath,
      headers: headers
    };
    const proxyReq = http.request(options, function (proxyRes) {
      const chunks = [];
      proxyRes.on("data", function (c) { chunks.push(c); });
      proxyRes.on("end", function () {
        const body = Buffer.concat(chunks).toString("utf8");
        log("[shim] proxy -> " + fullPath + " status=" + proxyRes.statusCode +
            " ctype=" + (proxyRes.headers["content-type"] || "") +
            " len=" + body.length);
        if (body.length < 600) log("[shim] body: " + body);
      });
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", function (e) {
      log("[shim] proxy ERROR " + String(e));
      res.statusCode = 502;
      res.end(String(e));
    });
    req.pipe(proxyReq);
  };
};
