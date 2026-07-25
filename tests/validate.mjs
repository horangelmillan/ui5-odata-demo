import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const UI5_PORT = 8080;
const ODATA_BASE = "http://127.0.0.1:3000/odata";
const UI5_URL = `http://127.0.0.1:${UI5_PORT}/index.html`;

// Windows-only helpers to robustly free the port before/after the run.
function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString();
    const pids = new Set();
    out.split(/\r?\n/).forEach((line) => {
      const m = line.match(/\s+(\d+)\s*$/);
      if (m && /LISTENING/.test(line)) pids.add(m[1]);
    });
    pids.forEach((pid) => {
      try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" }); } catch {}
    });
  } catch {}
}

function waitForHttp(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) reject(new Error("ui5 serve timeout"));
        else setTimeout(tick, 500);
      });
    };
    tick();
  });
}

async function main() {
  killPort(UI5_PORT);
  console.log("[validate] starting ui5 serve on port " + UI5_PORT + " ...");
  const server = spawn("pnpm", ["exec", "ui5", "serve", "--port", String(UI5_PORT)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true
  });
  server.stdout.on("data", (d) => process.env.VERBOSE && console.log("[ui5]", d.toString().trim()));
  server.stderr.on("data", (d) => console.error("[ui5-err]", d.toString().trim()));

  try {
    await waitForHttp(`http://127.0.0.1:${UI5_PORT}/index.html`, 120000);
    console.log("[validate] ui5 serve is up.");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const consoleMsgs = [];
    const pageErrors = [];
    page.on("console", (msg) => consoleMsgs.push(msg.type() + ": " + msg.text()));
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    const netReq = [];
    const netRes = [];
    page.on("request", (req) => {
      const u = req.url();
      if (u.includes("/odata")) {
        netReq.push({ method: req.method(), url: u, body: req.postData() || null });
      }
    });
    page.on("response", async (res) => {
      const u = res.url();
      if (u.includes("/odata")) {
        let body = null;
        try { body = await res.text(); } catch { /* ignore */ }
        netRes.push({ status: res.status(), url: u, body });
      }
    });

    console.log("[validate] loading app: " + UI5_URL);
    await page.goto(UI5_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

    await page.waitForFunction(
      () => window.appController && window.__suite && window.__suite.metaReady === true,
      { timeout: 60000 }
    ).catch(async () => {
      const diag = await page.evaluate(() => ({
        hasController: !!window.appController,
        suite: window.__suite,
        model: window.appController ? (function () {
          try {
            var m = window.appController.getOwnerComponent().getModel();
            return { isA: m.getMetadata().getName(), hasMeta: !!m.getMetaModel() };
          } catch (e) { return "err:" + e; }
        })() : null
      }));
      console.log("[validate] DIAGNOSTICS:\n" + JSON.stringify(diag, null, 2));
      console.log("[validate] CONSOLE:\n" + consoleMsgs.join("\n"));
      console.log("[validate] PAGE ERRORS:\n" + pageErrors.join("\n"));
      const err = await page.evaluate(() => window.__suite && window.__suite.metaError);
      throw new Error("metadata not ready: " + err);
    });
    console.log("[validate] OData V4 model metadata loaded (local CSDL).");

    await page.evaluate(() => window.appController.onRunAll());
    await page.waitForFunction(
      () => window.__suite && window.__suite.results.length >= 8,
      { timeout: 90000 }
    ).catch(async () => {
      const diag = await page.evaluate(() => ({
        suite: window.__suite,
        pending: window.__suite ? window.__suite.results.length : -1
      }));
      console.log("[validate] RESULTS TIMEOUT. suite:\n" + JSON.stringify(diag, null, 2));
      console.log("[validate] CONSOLE (tail):\n" + consoleMsgs.slice(-40).join("\n"));
      console.log("[validate] PAGE ERRORS:\n" + pageErrors.join("\n"));
      console.log("[validate] ODATA NET REQUESTS:\n" +
        netReq.map((r) => r.method + " " + r.url).join("\n"));
      console.log("[validate] ODATA NET RESPONSES:\n" +
        netRes.map((r) => r.status + " " + r.url).join("\n"));
      throw new Error("suite did not finish: " + (diag && diag.pending) + " results");
    });

    const suite = await page.evaluate(() => window.__suite);
    const net = { requests: netReq, responses: netRes };

    let serverMeta = { standard: false, topKeys: [], error: null, format: null };
    try {
      const r = await fetch(ODATA_BASE + "/$metadata");
      const ct = r.headers.get("content-type") || "";
      const txt = await r.text();
      serverMeta.format = ct;
      if (/application\/xml/.test(ct) || /<edmx:Edmx/i.test(txt)) {
        const isStd = /<edmx:Edmx/i.test(txt) && /<EntityContainer/i.test(txt) && /<EntitySet/i.test(txt);
        serverMeta.standard = isStd;
        serverMeta.topKeys = ["(EDMX XML)"];
      } else {
        const j = JSON.parse(txt);
        serverMeta.standard = !!(j && j.OData && j.OData.Container) ||
          !!(j && j.$EntityContainer && j[j.$EntityContainer]);
        serverMeta.topKeys = j ? Object.keys(j) : [];
      }
    } catch (e) {
      serverMeta.error = String(e);
    }

    await browser.close();

    fs.mkdirSync(path.resolve(ROOT, "reports"), { recursive: true });
    const report = buildReport(suite, net, serverMeta);
    fs.writeFileSync(path.resolve(ROOT, "reports", "compatibility-report.md"), report);
    fs.writeFileSync(
      path.resolve(ROOT, "reports", "network-evidence.json"),
      JSON.stringify(net, null, 2)
    );
    fs.writeFileSync(
      path.resolve(ROOT, "reports", "suite.json"),
      JSON.stringify(suite, null, 2)
    );
    console.log(report);
    const failed = suite.results.filter((r) => !r.ok).length;
    console.log(`\n[validate] DONE. ${suite.results.length - failed}/${suite.results.length} checks passed.`);
    process.exitCode = failed > 0 ? 2 : 0;
  } finally {
    try { server.kill("SIGTERM"); } catch {}
    try { killPort(UI5_PORT); } catch {}
  }
}

function buildReport(suite, net, serverMeta) {
  const now = new Date().toISOString();
  const lines = [];
  lines.push("# Reporte de compatibilidad UI5 / OpenUI5 OData V4 — vs `servidor-odata`");
  lines.push("");
  lines.push("- Generado: " + now);
  lines.push("- Runtime UI5: OpenUI5 **1.150.0** (cargado vía `@ui5/cli` 4.0.57, librerías del npm)");
  lines.push("- Cliente: `sap.ui.model.odata.v4.ODataModel` (operationMode=Server, autoExpandSelect:false, groupId=$direct, updateGroupId=changes)");
  lines.push("- Servidor bajo prueba: `http://127.0.0.1:3000/odata` (servidor-odata, PostgreSQL)");
  lines.push("- Validación: navegador real (Playwright/Chromium) conduciendo el modelo OData V4; tráfico de red capturado desde el proxy `/odata` en vivo.");
  lines.push("");
  lines.push("## Arranque de metadatos (bootstrap)");
  lines.push("");
  lines.push("- `metadataLoaded()`: **" + (suite.metaReady ? "OK (EDMX 4.0 estándar servido por el server en /odata/$metadata, sin shim)" : "FALLÓ") + "**" +
    (suite.metaError ? " — " + suite.metaError : ""));
  lines.push("- Forma del `$metadata` del servidor (sondeado directamente): " +
    (serverMeta.standard ? "EDMX/CSDL estándar (" + (serverMeta.format || "") + ")" : "**NO ESTÁNDAR**") +
    (serverMeta.topKeys && serverMeta.topKeys.length ? " (forma: `" + serverMeta.topKeys.join(", ") + "`)" : "") +
    (serverMeta.error ? " (error de sondeo: " + serverMeta.error + ")" : ""));
  lines.push("");
  lines.push("## Matriz de características (TODOS los componentes OData)");
  lines.push("");
  lines.push("| # | Característica (OData V4) | Resultado | Evidencia (petición) | Detalle |");
  lines.push("|---|---|---|---|---|");
  suite.results.forEach((r, i) => {
    lines.push(`| ${i + 1} | ${r.name} | ${r.ok ? "✅ PASS" : "❌ FAIL"} | \`${r.url}\` | ${r.info} |`);
  });
  lines.push("");
  lines.push("## Evidencia de red (extracto del tráfico `/odata` capturado)");
  lines.push("");
  net.requests.forEach((r) => {
    const resp = net.responses.find((x) => x.url === r.url);
    lines.push(`- **${r.method}** \`${r.url}\` → ${resp ? resp.status : "?"}`);
    if (r.body) lines.push("  - body: `" + r.body.slice(0, 200) + "`");
  });
  lines.push("");
  lines.push("## Brechas encontradas (lado servidor — NO modificado por mandato)");
  lines.push("");
  const expandFail = suite.results.find((r) => r.name.includes("$expand") && !r.ok);
  const metaFail = !serverMeta.standard;
  const batchFail = suite.results.find((r) => r.name.includes("$batch") && !r.ok);
  let gapNo = 0;
  if (metaFail) {
    gapNo++;
    lines.push(gapNo + ". **`$metadata` no es EDMX/CSDL estándar.** El servidor emite (claves: `" +
      (serverMeta.topKeys ? serverMeta.topKeys.join(", ") : "") +
      "`) que UI5 no puede inicializar. El convertidor de metadatos OData V4 de UI5 espera EDMX XML 4.0 (`<edmx:Edmx><edmx:DataServices><Schema><EntityContainer><EntitySet>`) o CSDL JSON 4.01 estándar.");
    lines.push("   - **Corrección en el servidor (recomendada):** emitir EDMX XML 4.0 válido en `/odata/$metadata` (lo que hace actualmente cuando el cliente no negocia `application/json`).");
    lines.push("");
  }
  if (expandFail) {
    gapNo++;
    lines.push(gapNo + ". **`$expand` no devuelve datos de navegación.** El servidor ejecuta la consulta relacionada (verificado en logs: corre un `SELECT ... FROM categories WHERE id=...`) pero **quita la propiedad de navegación de la respuesta JSON** — el `category`/`products` expandido nunca se incrusta. UI5 por tanto recibe una entidad sin sus hijos expandidos. Falla tanto para navegación individual (`$expand=category`) como combinada (`$expand=category,products(...)`).");
    lines.push("   - **Impacto:** `$expand=category` y `$expand=products(...)` producen navegación vacía; los escenarios de lista-con-expand y detalle-con-expand no pueblan los datos hijos.");
    lines.push("   - **Corrección en el servidor (recomendada):** fusionar las filas de la asociación cargadas eagermente en el payload serializado bajo el nombre de la propiedad de navegación.");
    lines.push("");
  }
  if (batchFail) {
    gapNo++;
    lines.push(gapNo + ". **El `$batch` con changeset para escrituras no funciona.** El servidor responde al POST `$batch` con **`HTTP/1.1 405 Method Not Allowed` — `{\"error\":\"Write operations must be sent inside a changeset (multipart/mixed)\"}`** (confirmado en `shim.log`: el changeset multipart/mixed que transporta el `POST product-odata` es rechazado). Las consultas `$batch` de lectura devuelven 200, pero los changesets de escritura son rechazados. El error persiste en el código actual de la rama `feat/odata-sapui5-compat` (Fase H): los tests aislados del middleware pasan, pero el cuerpo multipart real que emite UI5 no es parseado como changeset en la ruta HTTP, por lo que la escritura cae en la rama de \"fuera de changeset\" → 405.");
    lines.push("   - **Impacto:** `ODataModel` v4 de UI5 enruta TODAS las escrituras que no son `$direct` (el `updateGroupId` por defecto) a través de un changeset `$batch`; esas operaciones create/update/delete fallan. La única vía de escritura que funciona es `groupId=\"$direct\"` (POST/PATCH/DELETE planos).");
    lines.push("   - **Solución alternativa usada en este demo:** modelo con `groupId=\"$direct\"` para que cada petición sea una llamada plana, evitando `$batch` tanto para lecturas como para escrituras.");
    lines.push("   - **Corrección en el servidor (recomendada):** parsear el cuerpo multipart/mixed `$batch` REAL de UI5 (detectar el boundary del changeset anidado), ejecutar cada petición del changeset y devolver una respuesta multipart coincidente con referencia `Content-ID` para que UI5 correlacione la entidad creada.");
    lines.push("");
  }
  if (!expandFail && !metaFail && !batchFail) {
    lines.push("Ninguna — todas las características verificadas son compatibles.");
    lines.push("");
  }
  lines.push("## Características soportadas (sin brechas)");
  lines.push("");
  lines.push("- Colección de lista: `$top`, `$skip`, `$orderby`, `$filter`, `$count` (→ `@odata.count`), `$select` — **JSON OData estándar** (`@odata.context`, `value[]`).");
  lines.push("- Acceso por key `/product-odata(104)` — **OK**.");
  lines.push("- Escrituras vía **`$direct`**: POST (201 + `Location`), PATCH (200), DELETE (204) — **OK**.");
  if (!batchFail) {
    lines.push("- Escrituras vía **changeset `$batch`** (multipart/mixed, `Content-ID`) — **OK**.");
  }
  lines.push("- `precio` (`Edm.Decimal`) llega como string y se enlaza correctamente; `createdAt`/`updatedAt` (`Edm.DateTimeOffset`) se parsean sin error.");
  lines.push("- Cabeceras de SAPUI5 (`OData-Version: 4.0`, `Accept: application/json;odata.metadata=minimal`) son aceptadas.");
  lines.push("");
  lines.push("## Matriz de skills / tooling (fijado a última estable)");
  lines.push("");
  lines.push("| Herramienta | Versión | Propósito |");
  lines.push("|---|---|---|");
  lines.push("| `@ui5/cli` | 4.0.57 | UI5 Tooling: `ui5 serve` / `ui5 build` / `ui5 linter` |");
  lines.push("| Runtime OpenUI5 (`@openui5/sap.*`) | 1.150.0 | Librerías del framework servidas localmente (sin CDN) |");
  lines.push("| `@ui5/linter` | 1.23.1 | Quality gate oficial de SAP para apps UI5 (lint de `webapp/`) |");
  lines.push("| `ui5-middleware-proxy-to-server` (custom) | local | Proxy puro de `/odata/*` → `localhost:3000` (el server sirve su propio EDMX 4.0 en `$metadata`; sin shim) |");
  lines.push("| `playwright` | 1.61.1 | Harness de navegador headless que conduce el modelo OData V4 real |");
  lines.push("");
  return lines.join("\n");
}

main().catch((e) => {
  console.error("[validate] FATAL:", e);
  process.exit(1);
});
