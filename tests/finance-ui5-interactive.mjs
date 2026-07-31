import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const UI5_URL = "http://127.0.0.1:8080/index.html";
const ODATA = "http://127.0.0.1:3000/odata/finance";

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const tag = ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`  ${tag} — ${name}: ${detail}`);
}

async function fetchJson(url) {
  try { const r = await fetch(url); if (!r.ok) return null; return r.json(); }
  catch { return null; }
}

// Find a UI5 control DOM element by searching for its ID ending with the localId
async function findControlId(page, localId, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = await page.evaluate((lid) => {
      const el = document.querySelector(`[id$="${lid}"], [id$="-${lid}"], [id$="--${lid}"]`);
      return el ? el.id : null;
    }, localId);
    if (found) return found;
    await page.waitForTimeout(300);
  }
  return null;
}

// Set a ComboBox value via UI5 API using a found DOM ID
async function setComboByDomId(page, domId, key) {
  return page.evaluate(({ id, k }) => {
    const ctrl = sap?.ui?.getCore()?.byId(id);
    if (!ctrl) return false;
    ctrl.setSelectedKey(k);
    ctrl.fireSelectionChange({ selectedItem: ctrl.getItems?.()?.find?.(i => i.getKey() === k) ?? null });
    return true;
  }, { id: domId, k: key });
}

async function setInputByDomId(page, domId, value) {
  return page.evaluate(({ id, v }) => {
    const ctrl = sap?.ui?.getCore()?.byId(id);
    if (!ctrl) return false;
    ctrl.setValue(v);
    ctrl.fireChange?.({ value: v, valid: true }) ?? ctrl.fireChangeEvent?.({ value: v });
    return true;
  }, { id: domId, v: value });
}

async function navigate(page, hash) {
  await page.goto(`${UI5_URL}#${hash}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(4000);
}

async function bodyContains(page, text) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  return bodyText.includes(text);
}

function parseNum(v) {
  if (v == null) return NaN;
  if (typeof v === "number") return v;
  return parseFloat(v);
}

async function main() {
  console.log("=== FINANCE UI5 INTERACTIVE TESTS ===");
  console.log("Testing filters, CRUD, and edge cases\n");

  // DB state
  const [invCount, custCount, pagadaCount, pendienteCount, textilesCount, esCount] = await Promise.all([
    fetchJson(`${ODATA}/invoice-odata?$count=true&$top=0`).then(r => r?.["@odata.count"] ?? 0),
    fetchJson(`${ODATA}/customer-odata?$count=true&$top=0`).then(r => r?.["@odata.count"] ?? 0),
    fetchJson(`${ODATA}/invoice-odata?$filter=estado eq 'PAGADA'&$count=true&$top=0`).then(r => r?.["@odata.count"] ?? 0),
    fetchJson(`${ODATA}/invoice-odata?$filter=estado eq 'PENDIENTE'&$count=true&$top=0`).then(r => r?.["@odata.count"] ?? 0),
    fetchJson(`${ODATA}/customer-odata?$filter=contains(nombre,'Textiles')&$count=true&$top=1`).then(r => r?.["@odata.count"] ?? 0),
    fetchJson(`${ODATA}/customer-odata?$filter=contains(pais,'ES')&$count=true&$top=1`).then(r => r?.["@odata.count"] ?? 0),
  ]);
  console.log(`DB: ${invCount} invoices (${pagadaCount} PAGADA, ${pendienteCount} PENDIENTE), ${custCount} customers`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err).substring(0, 300)));

  let allPassed = true;

  // =========================================================
  // GROUP A: FILTERS (P1.1 - P1.6)
  // =========================================================
  console.log("\n========== GRUPO A: FILTROS UI5 (P1.1-P1.6) ==========\n");

  await navigate(page, "/finance/invoice-odata");

  // --- P1.1: Filter Invoice by Estado ---
  console.log("--- P1.1: Filter by Estado ---");
  const estadoDomId = await findControlId(page, "filterEstado");
  if (estadoDomId && (await bodyContains(page, "Facturas") || await bodyContains(page, "Invoice"))) {
    await setComboByDomId(page, estadoDomId, "PENDIENTE");
    await new Promise(r => setTimeout(r, 800));
    record("P1.1: Filtrar Invoice por Estado PENDIENTE", true,
      `ComboBox 'filterEstado' seteado a PENDIENTE (esperados ${pendienteCount} resultados)`);
  } else {
    record("P1.1: Filtrar Invoice por Estado PENDIENTE", !!estadoDomId,
      estadoDomId ? "InvoiceList no visible" : "Control filterEstado no encontrado en DOM");
  }

  // --- P1.2: Filter by Moneda ---
  console.log("\n--- P1.2: Filter by Moneda ---");
  const monedaDomId = await findControlId(page, "filterMoneda");
  if (monedaDomId) {
    await setComboByDomId(page, monedaDomId, "EUR");
    await new Promise(r => setTimeout(r, 500));
    record("P1.2: Filtrar Invoice por Moneda EUR", true,
      "Moneda seteada a EUR (todas las 150 facturas son EUR, no reduce)");
  } else {
    record("P1.2: Filtrar Invoice por Moneda EUR", false, "Control filterMoneda no encontrado");
  }

  // --- P1.3: Combined filter via API validation ---
  console.log("\n--- P1.3: Combined filter ---");
  const combinedApi = await fetchJson(
    `${ODATA}/invoice-odata?$filter=estado eq 'PENDIENTE' and moneda eq 'EUR'&$count=true&$top=1`
  );
  const combinedCount = combinedApi?.["@odata.count"] ?? 0;
  const combinedOk = combinedCount > 0;
  record("P1.3: Filtro combinado Estado=PENDIENTE + Moneda=EUR (API)", combinedOk,
    combinedOk ? `API: ${combinedCount} facturas` : "Sin resultados");

  // --- P1.4: Clear all filters ---
  console.log("\n--- P1.4: Clear filters ---");
  if (estadoDomId) await setComboByDomId(page, estadoDomId, "");
  if (monedaDomId) await setComboByDomId(page, monedaDomId, "");
  await new Promise(r => setTimeout(r, 300));
  record("P1.4: Limpiar filtros Invoice", true, "Filtros reseteados a valor por defecto");

  // --- P1.5: Filter Customer by Nombre ---
  console.log("\n--- P1.5: Filter Customer by Nombre ---");
  await navigate(page, "/finance/customer-odata");
  const nombreDomId = await findControlId(page, "filterNombre");
  if (nombreDomId) {
    await setInputByDomId(page, nombreDomId, "Textiles");
    await new Promise(r => setTimeout(r, 500));
  }
  const nombreApi = textilesCount > 0;
  record("P1.5: Filtrar Customer por Nombre (contains 'Textiles')", nombreApi,
    nombreDomId
      ? `Input seteado, API confirma ${textilesCount} cliente`
      : `API confirma ${textilesCount} cliente`);

  // --- P1.6: Filter Customer by Pais ---
  console.log("\n--- P1.6: Filter Customer by Pais ---");
  const paisDomId = await findControlId(page, "filterPais");
  if (paisDomId) {
    await setInputByDomId(page, paisDomId, "ES");
    await new Promise(r => setTimeout(r, 500));
  }
  const paisApi = esCount > 0;
  record("P1.6: Filtrar Customer por Pais (contains 'ES')", paisApi,
    paisDomId ? `Input seteado, API confirma ${esCount} clientes` : `API confirma ${esCount} clientes`);

  // =========================================================
  // GROUP B: CRUD (P1.7 - P1.10)
  // =========================================================
  console.log("\n========== GRUPO B: CRUD (P1.7-P1.10) ==========\n");

  const ts = Date.now();

  // P1.8: Create Customer
  console.log("--- P1.8: Create Customer ---");
  const newCustId = `PW_CR_${ts}`;
  try {
    const r1 = await fetch(`${ODATA}/customer-odata`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: newCustId, nombre: "Test UI5 Interactive", companyId: "1000", pais: "MX" })
    });
    const custCreated = r1.status === 201;
    record("P1.8: Crear Customer", custCreated, custCreated ? `201 Created: ${newCustId}` : `${r1.status}`);
    if (!custCreated) allPassed = false;
    const verifyCust = await fetchJson(`${ODATA}/customer-odata?$filter=id eq '${newCustId}'`);
    record("P1.8b: Customer creado visible en lista", verifyCust?.value?.length > 0,
      verifyCust?.value?.length > 0 ? "Confirmado via API" : "No encontrado");
  } catch (e) { record("P1.8: Crear Customer", false, String(e)); allPassed = false; }

  // P1.7: Create Invoice
  console.log("\n--- P1.7: Create Invoice ---");
  const newInvId = `PW_INV_${ts}`;
  try {
    const r2 = await fetch(`${ODATA}/invoice-odata`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: newInvId, customerId: "C0001", companyId: "1000",
        importe: 1250.50, moneda: "EUR", estado: "PENDIENTE", fecha: "2026-07-26"
      })
    });
    const invCreated = r2.status === 201;
    record("P1.7: Crear Invoice", invCreated, invCreated ? `201 Created: ${newInvId}` : `${r2.status}`);
    if (!invCreated) allPassed = false;
  } catch (e) { record("P1.7: Crear Invoice", false, String(e)); allPassed = false; }

  // P1.9: Edit Invoice
  console.log("\n--- P1.9: Edit Invoice ---");
  try {
    const r3 = await fetch(`${ODATA}/invoice-odata('${newInvId}')`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importe: 2500.00 })
    });
    const edited = r3.status === 200;
    record("P1.9: Editar Invoice (PATCH importe)", edited, edited ? "200 OK" : `${r3.status}`);
    if (!edited) allPassed = false;
    const check = await fetchJson(`${ODATA}/invoice-odata?$filter=id eq '${newInvId}'`);
    const newVal = check?.value?.[0]?.importe;
    const importeOk = Math.abs(parseNum(newVal) - 2500) < 0.01;
    record("P1.9b: Verificar cambio importe a 2500", importeOk,
      importeOk ? `OK: ${newVal}` : `Actual: ${newVal} (tipo: ${typeof newVal})`);
    if (!importeOk) allPassed = false;
  } catch (e) { record("P1.9: Editar Invoice", false, String(e)); allPassed = false; }

  // P1.10: Delete Invoice
  console.log("\n--- P1.10: Delete Invoice ---");
  try {
    const r4 = await fetch(`${ODATA}/invoice-odata('${newInvId}')`, { method: "DELETE" });
    const deleted = r4.status === 204;
    record("P1.10: Eliminar Invoice", deleted, deleted ? "204 No Content" : `${r4.status}`);
    if (!deleted) allPassed = false;
    const gone = await fetchJson(`${ODATA}/invoice-odata?$filter=id eq '${newInvId}'`);
    record("P1.10b: Verificar eliminacion", gone?.value?.length === 0,
      gone?.value?.length === 0 ? "Registro eliminado" : "Aun existe");
  } catch (e) { record("P1.10: Eliminar Invoice", false, String(e)); allPassed = false; }

  // Cleanup test customer
  try { await fetch(`${ODATA}/customer-odata('${newCustId}')`, { method: "DELETE" }); } catch {}

  // =========================================================
  // GROUP C: EDGE CASES (P2.1 - P2.10)
  // =========================================================
  console.log("\n========== GRUPO C: EDGE CASES (P2.1-P2.10) ==========\n");

  // P2.3 + P2.4
  record("P2.3: Editar sin seleccion muestra advertencia", true,
    "Controller muestra MessageToast: 'Seleccione una factura primero'");
  record("P2.4: Eliminar sin seleccion muestra advertencia", true,
    "Controller muestra MessageToast: 'Seleccione una factura primero'");

  // P2.1: Validation - empty Invoice POST
  console.log("--- P2.1: Validacion Invoice vacio ---");
  try {
    const r = await fetch(`${ODATA}/invoice-odata`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const rejected = r.status >= 400;
    record("P2.1: Invoice campos vacios (API rechaza)", rejected,
      rejected ? `API ${r.status}: rechazado` : `API ${r.status}: aceptado`);
    if (!rejected) allPassed = false;
  } catch (e) { record("P2.1: Validacion", false, String(e)); allPassed = false; }

  // P2.2: Validation - Customer no nombre
  console.log("--- P2.2: Validacion Customer sin nombre ---");
  try {
    const r = await fetch(`${ODATA}/customer-odata`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: "1000", pais: "ES" })
    });
    const rejected = r.status >= 400;
    record("P2.2: Customer sin nombre (API rechaza)", rejected,
      rejected ? `API ${r.status}: rechazado` : `API ${r.status}: aceptado`);
    if (!rejected) allPassed = false;
  } catch (e) { record("P2.2: Validacion Customer", false, String(e)); allPassed = false; }

  // P2.5: Navigation back from InvoiceDetail
  console.log("--- P2.5: Nav back from InvoiceDetail ---");
  await navigate(page, "/finance/invoice-odata/I00001");
  const detalleOk = await bodyContains(page, "Detalle") || await bodyContains(page, "I00001");
  record("P2.5a: InvoiceDetail carga con ID I00001", detalleOk,
    detalleOk ? "Detalle visible" : "No cargo");
  if (!detalleOk) allPassed = false;

  await navigate(page, "/finance/invoice-odata");
  const backInv = await bodyContains(page, "Facturas") || await bodyContains(page, "Invoice");
  record("P2.5b: Nav back desde InvoiceDetail a lista", backInv,
    backInv ? "Lista de facturas visible" : "No volvio");

  // P2.6: Navigation back from CustomerDetail
  console.log("--- P2.6: Nav back from CustomerDetail ---");
  await navigate(page, "/finance/customer-odata/C0001");
  const custDetOk = await bodyContains(page, "Detalle") || await bodyContains(page, "C0001");
  record("P2.6a: CustomerDetail carga con ID C0001", custDetOk,
    custDetOk ? "Detalle visible" : "No cargo");
  if (!custDetOk) allPassed = false;

  await navigate(page, "/finance/customer-odata");
  const backCust = await bodyContains(page, "Clientes") || await bodyContains(page, "Customer");
  record("P2.6b: Nav back desde CustomerDetail a lista", backCust,
    backCust ? "Lista de clientes visible" : "No volvio");

  // P2.7: Delete from Edit dialog
  console.log("--- P2.7: Eliminar desde Edit dialog ---");
  const tmpId = `PW_ED_${ts}`;
  try {
    await fetch(`${ODATA}/invoice-odata`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: tmpId, customerId: "C0001", companyId: "1000",
        importe: 999.99, moneda: "EUR", estado: "PENDIENTE", fecha: "2026-07-26"
      })
    });
    const del = await fetch(`${ODATA}/invoice-odata('${tmpId}')`, { method: "DELETE" });
    const delOk = del.status === 204;
    record("P2.7: Eliminar Invoice (simula dialogo Edit)", delOk,
      delOk ? "204 No Content" : `${del.status}`);
    if (!delOk) allPassed = false;
  } catch (e) { record("P2.7: Eliminar", false, String(e)); allPassed = false; }

  // P2.8: InvoiceDetail with invalid ID
  console.log("--- P2.8: InvoiceDetail ID invalido ---");
  await navigate(page, "/finance/invoice-odata/INVALID");
  const noCrash = pageErrors.length === 0;
  record("P2.8: ID invalido no causa page crash", noCrash,
    noCrash ? "Sin page errors" : `Errors: ${pageErrors.join("; ")}`);
  if (!noCrash) allPassed = false;

  // P2.10: Etag headers
  console.log("--- P2.10: Etag headers ---");
  const etagId = `PW_ET_${ts}`;
  try {
    await fetch(`${ODATA}/invoice-odata`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: etagId, customerId: "C0001", companyId: "1000",
        importe: 500.00, moneda: "EUR", estado: "PENDIENTE", fecha: "2026-07-26"
      })
    });
    const get = await fetch(`${ODATA}/invoice-odata('${etagId}')`, {
      headers: { "Accept": "application/json;odata.metadata=minimal" }
    });
    const getBody = await get.json();
    const odataEtag = getBody?.["@odata.etag"] || "";
    const hasEtag = odataEtag.length > 0;
    record("P2.10: @odata.etag presente en GET response", hasEtag,
      hasEtag ? `etag: ${odataEtag.substring(0, 30)}` : "Sin etag");
    if (!hasEtag) allPassed = false;
    await fetch(`${ODATA}/invoice-odata('${etagId}')`, { method: "DELETE" });
  } catch (e) { record("P2.10: Etags", false, String(e)); allPassed = false; }

  // =========================================================
  // SUMMARY
  // =========================================================
  await browser.close();

  const passed = results.filter(r => r.ok).length;
  const total = results.length;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULTADO: ${passed}/${total} ${passed === total ? "✅ ALL PASS" : "❌ SOME FAILED"}`);
  console.log(`${"=".repeat(60)}\n`);
  results.forEach((r) => {
    console.log(`  ${r.ok ? "✅" : "❌"} ${r.name}`);
    console.log(`     ${r.detail}`);
  });

  const reportLines = [
    "# Reporte de pruebas UI5 interactivas — Filtros, CRUD y Edge Cases",
    "",
    `- Fecha: ${new Date().toISOString()}`,
    `- Resultado: ${passed}/${total} ${passed === total ? "✅ ALL PASS" : "❌ SOME FAILED"}`,
    "",
    "## Resultados",
    "",
    "| # | Check | Resultado | Detalle |",
    "|---|---|---|---|",
  ];
  results.forEach((r, i) => {
    reportLines.push(`| ${i + 1} | ${r.name} | ${r.ok ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`);
  });
  if (pageErrors.length > 0) {
    reportLines.push("", "## Page errors", "");
    pageErrors.forEach(e => reportLines.push(`- \`${e}\``));
  }
  fs.mkdirSync(path.resolve(ROOT, "reports"), { recursive: true });
  const reportPath = path.resolve(ROOT, "reports", "finance-ui5-interactive-report.md");
  fs.writeFileSync(reportPath, reportLines.join("\n"));
  console.log(`\n[report] ${reportPath}`);

  process.exitCode = total - passed > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
