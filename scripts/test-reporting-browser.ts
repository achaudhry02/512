import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { chromium } from "playwright";

const baseUrl = process.env.REPORT_TEST_BASE_URL ?? "http://localhost:3000";
function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required for the reporting browser test.`);
  return value;
}
const email = required(process.env.REPORT_TEST_EMAIL ?? process.env.E2E_TEST_EMAIL, "REPORT_TEST_EMAIL or E2E_TEST_EMAIL");
const password = required(process.env.REPORT_TEST_PASSWORD ?? process.env.E2E_TEST_PASSWORD, "REPORT_TEST_PASSWORD or E2E_TEST_PASSWORD");
const headed = process.env.REPORT_TEST_HEADED === "1";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function signIn(page: import("playwright").Page) {
  await page.goto(`${baseUrl}/login`);
  await page.waitForLoadState("domcontentloaded");
  if (page.url().includes("/dashboard")) return;

  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: "visible", timeout: 15_000 }).catch(async () => {
    throw new Error(`Login form did not become available at ${page.url()}: ${(await page.locator("main").innerText()).slice(0, 500)}`);
  });
  await emailInput.fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

async function main() {
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  try {
  await signIn(page);
  await page.goto(`${baseUrl}/reports`);
  await page.getByRole("heading", { name: "Reporting center" }).waitFor({ state: "visible", timeout: 15_000 });

  const storeSelect = page.getByRole("combobox", { name: "Store" });
  assert.ok(await storeSelect.locator("option").count(), "authenticated reporting should load at least one store");

  const now = new Date();
  const expectedStart = isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const expectedEnd = isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)));
  await page.getByRole("combobox", { name: "Period" }).selectOption("last_month");
  await assert.doesNotReject(async () => {
    await page.getByRole("textbox", { name: "Report start date" }).waitFor({ state: "visible" });
    assert.equal(await page.getByRole("textbox", { name: "Report start date" }).inputValue(), expectedStart);
    assert.equal(await page.getByRole("textbox", { name: "Report end date" }).inputValue(), expectedEnd);
  }, "last-month preset should update both report dates");

  const estimateToggle = page.getByRole("checkbox", { name: "Include estimates" });
  await estimateToggle.uncheck();
  await page.getByText("Actual tracked data only", { exact: true }).waitFor({ state: "visible" });
  await estimateToggle.check();

  for (const heading of [
    "Detailed operating P&L",
    "Weekly P&L",
    "Product and category profitability",
    "Fuel margin by grade",
    "Import history and audit log",
    "Cash reconciliation status",
    "Vendor spend",
    "Inventory value",
  ]) {
    await page.getByRole("heading", { name: heading }).waitFor({ state: "attached" });
  }

  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV" }).click();
  const csvDownload = await csvPromise;
  const csvPath = await csvDownload.path();
  assert.ok(csvPath, "CSV download should produce a local file");
  const csvText = await readFile(csvPath, "utf8");
  assert.match(csvText, /Net operating profit/, "CSV should include the operating P&L");

  const pdfPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF" }).click();
  const pdfDownload = await pdfPromise;
  const pdfPath = await pdfDownload.path();
  assert.ok(pdfPath, "PDF download should produce a local file");
  const pdfBytes = await readFile(pdfPath);
  assert.equal(pdfBytes.subarray(0, 4).toString(), "%PDF", "PDF export should be a valid PDF document");

  const zipPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Accountant ZIP" }).click();
  const zipDownload = await zipPromise;
  const zipPath = await zipDownload.path();
  assert.ok(zipPath, "accountant package should produce a local file");
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  for (const expectedFile of ["summary.csv", "pnl.csv", "weekly-pnl.csv", "cash-reconciliation.csv", "import-history.csv", "README.txt"]) {
    assert.ok(zip.file(expectedFile), `accountant ZIP should include ${expectedFile}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("heading", { name: "Reporting center" }).waitFor({ state: "visible" });
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(hasHorizontalOverflow, false, "reporting page should not overflow the mobile viewport");

  assert.deepEqual(browserErrors, [], `reporting flow should not emit browser errors: ${browserErrors.join("\n")}`);
  console.log("Authenticated reporting browser tests passed.");
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
