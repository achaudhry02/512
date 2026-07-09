import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Page } from "playwright";

const baseUrl = process.env.POS_TEST_BASE_URL ?? "http://localhost:3000";
const email = process.env.POS_TEST_EMAIL ?? "codex.pos.tester@gmail.com";
const password = process.env.POS_TEST_PASSWORD ?? "TestPass123!";
const headless = process.env.POS_TEST_HEADED !== "1";

const samples = [
  { pos: "generic", file: "generic-pos-import-template.csv", expect: ["Bottled Water", "$17.88"] },
  { pos: "gilbarco_passport", file: "gilbarco-passport-sample.csv", expect: ["Regular Unleaded", "245.2"] },
  { pos: "square", file: "square-pos-sample.csv", expect: ["Energy Drink", "$23.92"] },
  { pos: "clover", file: "clover-pos-sample.csv", expect: ["Breakfast Sandwich", "$69.86"] },
  { pos: "shopify_pos", file: "shopify-pos-sample.csv", expect: ["Household Paper Towels", "$10.15"] },
];

function samplePath(file: string) {
  return path.join(process.cwd(), "samples", "uploads", file);
}

async function pageText(page: Page) {
  return page.locator("body").innerText();
}

async function signIn(page: Page) {
  await page.goto(`${baseUrl}/login`);
  await page.waitForLoadState("domcontentloaded");

  if (page.url().includes("/dashboard")) return;

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Login" }).last().click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function openPos(page: Page) {
  await page.goto(`${baseUrl}/pos-integrations`);
  await page.waitForLoadState("domcontentloaded");
  await page.getByTestId("pos-system-select").waitFor({ state: "visible", timeout: 15000 });
}

async function uploadAndPreview(page: Page, pos: string, file: string) {
  await openPos(page);
  await page.getByTestId("pos-system-select").selectOption(pos);
  await page.getByTestId("pos-template-name").fill(`${pos} browser test`);
  await page.getByTestId("pos-file-input").waitFor({ state: "attached", timeout: 15000 });
  await page.waitForFunction(() => {
    const input = document.querySelector('[data-testid="pos-file-input"]') as HTMLInputElement | null;
    return input && !input.disabled;
  }, null, { timeout: 15000 });
  await page.getByTestId("pos-file-input").setInputFiles(samplePath(file));
  await page.getByTestId("pos-preview").waitFor({ state: "visible", timeout: 15000 });
  const text = await pageText(page);
  assert.match(text, /rows selected/i, `${file} should show preview row counts`);
  assert.doesNotMatch(text, /Bad number|Missing or invalid date/i, `${file} should not have validation errors`);
  return text;
}

async function saveImport(page: Page, label: string) {
  await page.getByTestId("pos-save-import").click();
  await page.waitForTimeout(3500);
  const text = await pageText(page);
  assert.doesNotMatch(text, /Unable to save POS import/i, `${label}: POS import should save without an error banner`);
  const previewVisible = await page.getByTestId("pos-preview").isVisible().catch(() => false);
  assert.ok(
    !previewVisible || /Imported \d+ POS rows|No new POS rows to import/i.test(text),
    `${label}: POS import should either clear preview or show a completed import message`,
  );
}

async function main() {
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

  try {
    await signIn(page);
    await openPos(page);

    for (const sample of samples) {
      console.log(`Testing ${sample.file}`);
      const preview = await uploadAndPreview(page, sample.pos, sample.file);
      for (const expected of sample.expect) {
        assert.ok(preview.includes(expected), `${sample.file} preview should include ${expected}`);
      }
      await page.getByTestId("pos-save-mapping").click();
      await page.waitForFunction(() => document.body.innerText.includes("POS mapping template saved."), null, { timeout: 15000 });
      if ((await pageText(page)).includes("Duplicate POS date/source/transaction detected")) {
        await page.getByTestId("pos-duplicate-strategy").selectOption("overwrite");
      }
      await saveImport(page, sample.file);
    }

    const tmpDir = mkdtempSync(path.join(tmpdir(), "pos-bad-import-"));
    const badCsv = path.join(tmpDir, "bad-pos.csv");
    writeFileSync(
      badCsv,
      [
        "date,transaction_id,department_category,item_name,quantity_sold,net_sales",
        ",BAD-1,Grocery,Bad Date,1,10.00",
        "2026-07-02,BAD-2,Grocery,Bad Number,not-a-number,10.00",
      ].join("\n"),
      "utf8",
    );
    await openPos(page);
    await page.getByTestId("pos-system-select").selectOption("generic");
    await page.getByTestId("pos-file-input").setInputFiles(badCsv);
    await page.getByTestId("pos-preview").waitFor({ state: "visible", timeout: 15000 });
    const badText = await pageText(page);
    assert.match(badText, /Missing or invalid date/i, "bad CSV should show missing date validation");
    assert.match(badText, /Bad number for Quantity sold/i, "bad CSV should show bad number validation");

    await uploadAndPreview(page, "generic", "generic-pos-import-template.csv");
    assert.match(await pageText(page), /Duplicate POS date\/source\/transaction detected/i, "duplicate upload should be detected");
    await page.getByTestId("pos-duplicate-strategy").selectOption("skip");
    await page.getByTestId("pos-save-import").click();
    await page.waitForFunction(() => document.body.innerText.includes("No new POS rows to import. Duplicate rows were skipped."), null, { timeout: 15000 });

    await uploadAndPreview(page, "generic", "generic-pos-import-template.csv");
    await page.getByTestId("pos-duplicate-strategy").selectOption("overwrite");
    await page.getByTestId("pos-save-import").click();
    await page.waitForTimeout(3500);
    const afterOverwriteText = await pageText(page);
    assert.doesNotMatch(afterOverwriteText, /Unable to save POS import/i, "duplicate overwrite should save without an error banner");
    assert.match(afterOverwriteText, /Generic POS CSV/i, "overwrite should preserve the Generic POS source in the UI");

    await page.goto(`${baseUrl}/dashboard`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("live dashboard"), null, { timeout: 15000 });
    await page.waitForTimeout(2500);
    const dashboardText = await pageText(page);
    assert.match(dashboardText, /dashboard/i, "dashboard should load for authenticated user");
    assert.match(dashboardText, /Grocery|Fuel|Deli|Drinks|Snacks|Beer/i, "dashboard category intelligence should include imported POS departments");

    await page.goto(`${baseUrl}/reports`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForFunction(() => document.body.innerText.includes("Sales by POS source"), null, { timeout: 15000 });
    await page.waitForTimeout(2500);
    const reportsText = await pageText(page);
    assert.match(reportsText, /Sales by POS source/i, "reports should include POS source report");
    assert.match(reportsText, /POS payment breakdown/i, "reports should include payment breakdown");
    assert.match(reportsText, /Department sales from POS/i, "reports should include department sales");
    assert.match(reportsText, /POS fuel and unmapped rows/i, "reports should include POS fuel totals and errors");
    assert.match(reportsText, /Square|Clover|Gilbarco Passport|Shopify POS|Generic POS CSV/i, "reports should include imported POS source names");

    const relevantConsoleErrors = errors.filter((entry) =>
      !entry.includes("favicon") &&
      !entry.includes("The width(-1) and height(-1) of chart should be greater than 0"),
    );
    assert.deepEqual(relevantConsoleErrors, [], "browser console should not have app errors or warnings");
  } finally {
    await browser.close();
  }

  console.log("Authenticated POS integration browser flow passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
