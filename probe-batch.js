const http = require("http");
const boundary = "batch_test_123";
const getReq = "GET /odata/product-odata?$top=3 HTTP/1.1\r\nAccept: application/json\r\n\r\n";
const body = "--" + boundary + "\r\nContent-Type: application/http\r\nContent-Transfer-Encoding: binary\r\n\r\n" + getReq + "\r\n--" + boundary + "--\r\n";
const req = http.request({
  host: "127.0.0.1",
  port: 3000,
  path: "/odata/$batch",
  method: "POST",
  headers: {
    "Content-Type": "multipart/mixed; boundary=" + boundary,
    "OData-Version": "4.0",
    "Content-Length": Buffer.byteLength(body)
  }
}, function (r) {
  let b = Buffer.alloc(0);
  r.on("data", function (d) { b = Buffer.concat([b, d]); });
  r.on("end", function () {
    const s = b.toString("utf8");
    console.log("STATUS", r.statusCode, "CT", r.headers["content-type"]);
    console.log("=== RAW RESPONSE ===");
    console.log(s);
  });
});
req.write(body);
req.end();
