import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Page } from "playwright";

function loadLocalEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...parts] = trimmed.split("=");
    process.env[key] ??= parts.join("=").replace(/^["']|["']$/g, "");
  }
}

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required for the authenticated browser test.`);
  return value;
}

loadLocalEnv();

const baseUrl = process.env.E2E_TEST_BASE_URL ?? "http://localhost:3000";
const email = required(process.env.E2E_TEST_EMAIL ?? process.env.POS_TEST_EMAIL, "E2E_TEST_EMAIL or POS_TEST_EMAIL");
const password = required(process.env.E2E_TEST_PASSWORD ?? process.env.POS_TEST_PASSWORD, "E2E_TEST_PASSWORD or POS_TEST_PASSWORD");
const headless = process.env.E2E_TEST_HEADED !== "1";
const supabaseUrl = required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
const publicKey = required(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
);
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const storeName = `Phase 10 E2E ${suffix}`;
const dailyDate = "2098-03-01";

async function waitForWorkspace(page: Page) {
  await page.getByRole("heading", { name: "Convenience Store Command Center" }).waitFor({ state: "visible", timeout: 20_000 });
  await page.getByLabel("Active store").waitFor({ state: "visible", timeout: 20_000 });
}

async function waitForSelectedStore(page: Page, storeId: string) {
  await page.waitForFunction(
    (expectedStoreId) => Array.from(document.querySelectorAll("select")).some((select) => select.value === expectedStoreId),
    storeId,
    { timeout: 20_000 },
  );
}

async function loginThroughUi(page: Page) {
  await page.goto(`${baseUrl}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.getByLabel("Full name").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Create account" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await waitForWorkspace(page);
}

function createBulkCsv() {
  const headers = [
    "date", "grocery_sales", "deli_sales", "hot_food_sales", "fuel_gallons_sold",
    "fuel_price_per_gallon", "fuel_cost_per_gallon", "lottery_sales", "beer_sales",
    "cigarette_sales", "other_sales", "cash_total", "card_total", "expenses", "payroll", "notes",
  ];
  const rows = Array.from({ length: 28 }, (_, index) => {
    const date = `2098-02-${String(index + 1).padStart(2, "0")}`;
    return index === 0
      ? [date, 120, 30, 20, 100, 3.5, 3.2, 40, 25, 35, 10, 140, 140, 15, 25, "Phase 10 bulk smoke"]
      : [date, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ""];
  });
  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

async function main() {
  const tempDir = mkdtempSync(path.join(tmpdir(), "cstore-phase10-"));
  const bulkFile = path.join(tempDir, `bulk-${suffix}.csv`);
  const posFile = path.join(tempDir, `pos-${suffix}.csv`);
  const smartFile = path.join(tempDir, `smart-${suffix}.csv`);
  writeFileSync(bulkFile, createBulkCsv());
  writeFileSync(
    posFile,
    `date,transaction_id,department_category,item_name,quantity_sold,gross_sales,net_sales,cash_total,card_total,fuel_gallons,fuel_sales,fuel_cost\n${dailyDate},PHASE10-${suffix},Grocery,Phase 10 Water,2,5,5,2,3,10,35,32\n`,
  );
  writeFileSync(
    smartFile,
    `Date,Vendor,Description,Product Name,SKU,Quantity,Unit Cost,Unit Retail Price,Total\n${dailyDate},Capital Candy,Phase 10 candy delivery,Phase 10 Candy,PHASE10-${suffix},4,1.00,2.00,8.00\n`,
  );

  const cleanupClient = createClient(supabaseUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await cleanupClient.auth.signInWithPassword({ email, password });
  if (authError) throw authError;
  const userId = authData.user.id;
  const { data: profile, error: profileError } = await cleanupClient.from("users").select("selected_store_id").eq("id", userId).single();
  if (profileError) throw profileError;
  const originalStoreId = profile.selected_store_id as string | null;

  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });

  let testStoreId: string | null = null;
  try {
    await loginThroughUi(page);

    await page.goto(`${baseUrl}/settings`);
    await waitForWorkspace(page);
    await page.getByLabel("New store").fill(storeName);
    await page.getByRole("button", { name: "Create store" }).click();
    const storeCreated = page.getByText("Store created and selected.", { exact: true });
    const storeErrorBanner = page.locator("main .border-red-200");
    await storeCreated.or(storeErrorBanner).waitFor({ state: "visible", timeout: 20_000 });
    assert.equal(await storeCreated.isVisible(), true, `store creation failed: ${await storeErrorBanner.allTextContents()}`);
    const { data: testStore, error: storeError } = await cleanupClient.from("stores").select("id").eq("user_id", userId).eq("name", storeName).single();
    if (storeError) throw storeError;
    testStoreId = testStore.id as string;
    await waitForSelectedStore(page, testStoreId);

    await page.goto(`${baseUrl}/daily-sales`);
    await waitForWorkspace(page);
    await waitForSelectedStore(page, testStoreId);
    await page.getByLabel("Date").fill(dailyDate);
    await page.getByLabel("Fuel gallons sold").fill("100");
    await page.getByLabel("Fuel retail price").fill("3.50");
    await page.getByLabel("Fuel cost per gallon").fill("3.20");
    await page.getByLabel("Grocery sales").fill("200");
    await page.getByLabel("Deli sales").fill("50");
    await page.getByLabel("Cash total").fill("100");
    await page.getByLabel("Card total").fill("150");
    await page.getByLabel("Notes").fill(`Phase 10 daily ${suffix}`);
    await page.getByRole("button", { name: "Add entry" }).click();
    await page.getByRole("button", { name: "Add entry" }).waitFor({ state: "visible", timeout: 20_000 });
    const formError = page.locator(".border-red-200");
    if (await formError.isVisible()) throw new Error(`Daily entry failed: ${await formError.innerText()}`);
    const { data: savedDailyRows, error: savedDailyError } = await cleanupClient
      .from("daily_sales")
      .select("id")
      .eq("store_id", testStoreId)
      .eq("date", dailyDate);
    if (savedDailyError) throw savedDailyError;
    assert.equal(savedDailyRows.length, 1, "daily entry should persist in the selected store");
    await page.getByText(dailyDate, { exact: true }).waitFor({ state: "visible", timeout: 20_000 });

    await page.goto(`${baseUrl}/bulk-entry?mode=bulk`);
    await waitForWorkspace(page);
    await waitForSelectedStore(page, testStoreId);
    await page.getByLabel("Month").fill("2098-02");
    await page.locator('input[type="file"]').setInputFiles(bulkFile);
    await page.getByText(`Imported 28 rows from ${path.basename(bulkFile)}. Review before saving.`, { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
    await page.getByRole("button", { name: "Preview month" }).click();
    const saveAll = page.getByRole("button", { name: "Save all days" });
    await saveAll.waitFor({ state: "visible" });
    assert.equal(await saveAll.isEnabled(), true, "valid bulk rows should be saveable");
    await saveAll.click();
    const bulkSuccess = "Saved 28 daily entries for 2098-02. Dashboard and reports now include this month.";
    await page.waitForFunction((success) => document.body.innerText.includes(success) || /cannot perform|unable to save|permission denied/i.test(document.body.innerText), bulkSuccess, { timeout: 30_000 });
    const bulkPageText = await page.locator("main").innerText();
    assert.ok(bulkPageText.includes(bulkSuccess), `bulk save failed: ${bulkPageText.slice(-700)}`);

    await page.goto(`${baseUrl}/pos-integrations`);
    await waitForWorkspace(page);
    await waitForSelectedStore(page, testStoreId);
    await page.getByTestId("pos-system-select").selectOption("generic");
    await page.getByTestId("pos-file-input").setInputFiles(posFile);
    await page.getByTestId("pos-preview").waitFor({ state: "visible", timeout: 20_000 });
    await page.getByText("Phase 10 Water", { exact: true }).waitFor({ state: "visible" });
    await page.getByTestId("pos-save-import").click();
    await page.waitForFunction(() => /Imported \d+ POS rows/.test(document.body.innerText), null, { timeout: 30_000 });

    await page.goto(`${baseUrl}/smart-import`);
    await waitForWorkspace(page);
    await waitForSelectedStore(page, testStoreId);
    await page.locator('input[type="file"]').setInputFiles(smartFile);
    await page.getByRole("heading", { name: "Review before saving" }).waitFor({ state: "visible", timeout: 30_000 });
    await page.getByText(path.basename(smartFile), { exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Confirm Import" }).click();
    await page.getByText("Import confirmed. Rows were saved to the selected destinations.", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    const { data: importedProduct, error: importedProductError } = await cleanupClient
      .from("products")
      .select("id,quantity_on_hand")
      .eq("store_id", testStoreId)
      .eq("sku_upc", `PHASE10-${suffix}`)
      .single();
    if (importedProductError) throw importedProductError;
    const importHistoryRow = page.getByRole("row").filter({ hasText: path.basename(smartFile) });
    await importHistoryRow.getByRole("button", { name: "Roll back" }).click();
    await page.getByText("Import rolled back. Posted rows were removed and the audit record was kept.", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    const { data: rolledBackProduct, error: rolledBackProductError } = await cleanupClient
      .from("products")
      .select("quantity_on_hand")
      .eq("id", importedProduct.id)
      .single();
    if (rolledBackProductError) throw rolledBackProductError;
    assert.equal(rolledBackProduct.quantity_on_hand, importedProduct.quantity_on_hand + 4, "Smart Import rollback should reverse the product sale inventory deduction");

    await page.goto(`${baseUrl}/cash-reconciliation`);
    await waitForWorkspace(page);
    await waitForSelectedStore(page, testStoreId);
    await page.getByLabel("Date").fill(dailyDate);
    await page.getByRole("button", { name: "Pull expected totals" }).click();
    await page.getByLabel("Starting drawer cash").fill("100");
    await page.getByLabel("Ending drawer cash").fill("200");
    await page.getByLabel("Card batch total").fill("150");
    await page.getByRole("button", { name: "Save reconciliation" }).click();
    await page.getByText("Cash reconciliation saved.", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });

    await page.goto(`${baseUrl}/end-of-day-close`);
    await waitForWorkspace(page);
    await waitForSelectedStore(page, testStoreId);
    await page.getByLabel("Close date").fill(dailyDate);
    await page.getByRole("heading", { name: "End-of-Day Close" }).waitFor({ state: "visible" });
    await page.getByLabel("Override reason").fill("E2E override: lottery and bank review remain pending.");
    await page.getByLabel("Notes").fill(`Phase 10 close ${suffix}`);
    await page.getByLabel("Lottery not applicable").check();
    await page.getByLabel("Bank deposit pending").check();
    await page.getByRole("button", { name: "Close Day" }).click();
    const closeResponse = page.locator("section").filter({ hasText: "Review and close" }).locator("p.mt-4.text-sm.font-bold");
    await closeResponse.waitFor({ state: "visible", timeout: 20_000 });
    assert.equal(await closeResponse.innerText(), "Business day closed.", "close submission should succeed");
    const { data: closedRow, error: closedRowError } = await cleanupClient
      .from("daily_close_statuses")
      .select("id,status,lottery_completed,lottery_not_applicable,bank_deposit_matched,bank_deposit_pending")
      .eq("store_id", testStoreId)
      .eq("date", dailyDate)
      .single();
    if (closedRowError) throw closedRowError;
    assert.equal(closedRow.status, "closed");
    assert.equal(closedRow.lottery_completed, false);
    assert.equal(closedRow.lottery_not_applicable, true);
    assert.equal(closedRow.bank_deposit_matched, false, "pending deposit must not be persisted as matched");
    assert.equal(closedRow.bank_deposit_pending, true);
    await page.getByRole("button", { name: "Reopen Day" }).click();
    await page.getByText("Business day reopened.", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
    const { data: reopenedRow, error: reopenedRowError } = await cleanupClient
      .from("daily_close_statuses")
      .select("status,reopened_by")
      .eq("id", closedRow.id)
      .single();
    if (reopenedRowError) throw reopenedRowError;
    assert.equal(reopenedRow.status, "in_progress");
    assert.equal(reopenedRow.reopened_by, userId, "owner reopen RPC should record the actor");

    await page.goto(`${baseUrl}/bank-matching`);
    await waitForWorkspace(page);
    await waitForSelectedStore(page, testStoreId);
    await page.getByRole("heading", { name: "Bank Matching" }).waitFor({ state: "visible" });

    await page.goto(`${baseUrl}/reports`);
    await waitForWorkspace(page);
    await waitForSelectedStore(page, testStoreId);
    await page.getByLabel("Report start date").fill("2098-02-01");
    await page.getByLabel("Report end date").fill(dailyDate);
    await page.getByText("P&L confidence", { exact: true }).first().waitFor({ state: "visible" });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSV" }).click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /\.csv$/i, "report export should download a CSV file");

    assert.deepEqual(browserErrors, [], `browser console should stay clean:\n${browserErrors.join("\n")}`);
    console.log("Authenticated critical workflow browser test passed.");
  } finally {
    await browser.close();
    if (testStoreId) {
      // Delete tracked sales while the parent store still exists so inventory reversal triggers remain valid.
      await cleanupClient.from("product_sales").delete().eq("store_id", testStoreId).eq("user_id", userId);
      if (originalStoreId) {
        await cleanupClient.from("users").update({ selected_store_id: originalStoreId }).eq("id", userId);
      }
      const { error: cleanupError } = await cleanupClient.from("stores").delete().eq("id", testStoreId).eq("user_id", userId);
      if (cleanupError) console.error(`Unable to remove test store ${testStoreId}: ${cleanupError.message}`);
    }
    await cleanupClient.auth.signOut();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
