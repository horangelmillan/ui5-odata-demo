import { chromium } from "playwright";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text().substring(0, 200));
  });
  page.on("pageerror", (err) => errors.push(String(err).substring(0, 200)));

  // 1. Load initial page
  console.log("=== STEP 1: Load app ===");
  await page.goto("http://127.0.0.1:8080/index.html", { waitUntil: "networkidle", timeout: 30000 });
  await sleep(4000);
  const initUrl = page.url();
  const initText = (await page.evaluate(() => document.body.innerText)).substring(0, 500);
  console.log("URL:", initUrl);
  console.log("Text:", initText.substring(0, 200));

  // 2. Click Finance button
  console.log("\n=== STEP 2: Click Finance button ===");
  const buttons = await page.locator('button').all();
  let financeBtn = null;
  for (const btn of buttons) {
    const txt = await btn.textContent();
    if (txt && txt.includes("Finance")) {
      financeBtn = btn;
      console.log("Found Finance button:", txt);
      break;
    }
  }
  if (!financeBtn) {
    // Try finding by bound text
    financeBtn = page.locator('button[text*="Finance"], span:has-text("Finance") button, button:has-text("Finance")').first();
  }
  if (financeBtn) {
    await financeBtn.click();
    await sleep(4000);
    const urlAfterFinance = page.url();
    const textAfterFinance = (await page.evaluate(() => document.body.innerText)).substring(0, 1000);
    console.log("URL after Finance click:", urlAfterFinance);
    console.log("Body text after Finance click:", textAfterFinance.substring(0, 300));
    if (textAfterFinance.includes("Finance") || textAfterFinance.includes("Facturas") || textAfterFinance.includes("Clientes") || textAfterFinance.includes("Pagos")) {
      console.log("✅ Finance dashboard rendered correctly");
    } else {
      console.log("❌ Finance dashboard NOT rendered");
    }
  } else {
    console.log("❌ Could not find Finance button");
  }

  // 3. Click Facturas link
  console.log("\n=== STEP 3: Click Facturas link ===");
  const items = await page.locator('.sapMLIB, .sapMList li, [role="listitem"], li').all();
  let facturaItem = null;
  for (const item of items) {
    const txt = await item.textContent();
    if (txt && (txt.includes("Factura") || txt.includes("Invoice"))) {
      facturaItem = item;
      console.log("Found Facturas item:", txt.substring(0, 100));
      break;
    }
  }
  if (!facturaItem) {
    // Try broader search
    const facturaPage = page.locator('text=Facturas').first();
    if (await facturaPage.isVisible()) {
      await facturaPage.click();
      console.log("Clicked via text selector");
    }
  } else {
    await facturaItem.click();
  }

  await sleep(5000);
  const urlAfterFacturas = page.url();
  const textAfterFacturas = (await page.evaluate(() => document.body.innerText)).substring(0, 1500);
  console.log("URL after Facturas click:", urlAfterFacturas);
  console.log("Body text after Facturas:", textAfterFacturas.substring(0, 500));

  // Check for table data
  if (textAfterFacturas.includes("PENDIENTE") || textAfterFacturas.includes("PAGADA") || textAfterFacturas.includes("VENCIDA")) {
    console.log("✅ Invoice table has data (found status values)");
  } else if (textAfterFacturas.includes("Factura") || textAfterFacturas.includes("Invoice")) {
    console.log("⚠️ Invoice view loaded but may not have data");
  } else {
    console.log("❌ Invoice view did not load");
  }

  console.log("\n=== Console errors ===");
  errors.forEach(e => console.log("  ", e));
  if (errors.length === 0) console.log("  None");

  await browser.close();
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
