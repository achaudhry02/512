import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
  if (!value) throw new Error(`${name} is required for the live inventory test.`);
  return value;
}

loadLocalEnv();
const url = required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
const key = required(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Supabase publishable key");
const email = required(process.env.INVENTORY_TEST_EMAIL ?? process.env.E2E_TEST_EMAIL, "INVENTORY_TEST_EMAIL or E2E_TEST_EMAIL");
const password = required(process.env.INVENTORY_TEST_PASSWORD ?? process.env.E2E_TEST_PASSWORD, "INVENTORY_TEST_PASSWORD or E2E_TEST_PASSWORD");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const { data: auth, error: authError } = await client.auth.signInWithPassword({ email, password });
  if (authError) throw authError;
  const userId = auth.user.id;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let storeId: string | null = null;

  try {
    const { data: store, error: storeError } = await client.from("stores").insert({ user_id: userId, name: `Inventory RC ${suffix}` }).select("id").single();
    if (storeError) throw storeError;
    storeId = store.id;
    const { error: membershipError } = await client.from("store_members").upsert({ user_id: userId, store_id: storeId, role: "owner", invited_email: email, accepted_at: new Date().toISOString() }, { onConflict: "user_id,store_id" });
    if (membershipError) throw membershipError;

    const { data: vendor, error: vendorError } = await client.from("vendors").insert({ user_id: userId, store_id: storeId, name: "Inventory Test Vendor", normalized_name: `inventory-test-${suffix}`, category: "Other" }).select("id").single();
    if (vendorError) throw vendorError;
    const { data: product, error: productError } = await client.from("products").insert({ user_id: userId, store_id: storeId, vendor_id: vendor.id, name: `Inventory Test Product ${suffix}`, sku_upc: `INV-${suffix}`, category: "Grocery", unit_cost: 1, unit_retail_price: 3, quantity_on_hand: 10, reorder_level: 2 }).select("id").single();
    if (productError) throw productError;
    const { data: order, error: orderError } = await client.from("purchase_orders").insert({ user_id: userId, store_id: storeId, vendor_id: vendor.id, po_number: `PO-${suffix}`, status: "ordered", total_cost: 10 }).select("id").single();
    if (orderError) throw orderError;
    const { error: itemError } = await client.from("purchase_order_items").insert({ user_id: userId, store_id: storeId, purchase_order_id: order.id, product_id: product.id, product_name: `Inventory Test Product ${suffix}`, sku_upc: `INV-${suffix}`, ordered_quantity: 5, received_quantity: 0, unit_cost: 2 });
    if (itemError) throw itemError;

    const { error: receiveError } = await client.rpc("receive_purchase_order", { p_purchase_order_id: order.id });
    if (receiveError) throw receiveError;
    const { data: receivedProduct } = await client.from("products").select("quantity_on_hand,unit_cost").eq("id", product.id).single();
    assert.equal(receivedProduct?.quantity_on_hand, 15, "PO receipt should increase inventory once");
    assert.equal(receivedProduct?.unit_cost, 2, "PO receipt should update the latest unit cost");
    const { error: duplicateReceiptError } = await client.rpc("receive_purchase_order", { p_purchase_order_id: order.id });
    assert.ok(duplicateReceiptError, "receiving the same PO twice must be rejected");
    const { count: receiptCount } = await client.from("inventory_adjustments").select("id", { count: "exact", head: true }).eq("purchase_order_id", order.id).eq("adjustment_type", "receipt");
    assert.equal(receiptCount, 1, "duplicate receipt must not create a second adjustment");
    const { count: costCount } = await client.from("vendor_item_costs").select("id", { count: "exact", head: true }).eq("purchase_order_id", order.id);
    assert.equal(costCount, 1, "PO receipt should create one vendor cost record");
    const { count: priceCount } = await client.from("price_history").select("id", { count: "exact", head: true }).eq("product_id", product.id);
    assert.equal(priceCount, 1, "receipt cost change should create price history");

    const { error: adjustmentError } = await client.rpc("record_inventory_adjustment", { p_product_id: product.id, p_adjustment_type: "shrink", p_quantity_delta: -2, p_unit_cost: 2, p_reason: "Phase 11 shrink test" });
    if (adjustmentError) throw adjustmentError;
    const salePayload = { user_id: userId, store_id: storeId, product_id: product.id, vendor_id: vendor.id, date: "2099-01-01", product_name: `Inventory Test Product ${suffix}`, sku_upc: `INV-${suffix}`, quantity_sold: 3, unit_cost: 2, unit_retail_price: 3, gross_sales: 9, gross_profit: 3, margin_percent: 33.333, category: "Grocery", vendor: "Inventory Test Vendor" };
    const { data: sale, error: saleError } = await client.from("product_sales").insert(salePayload).select("id").single();
    if (saleError) throw saleError;
    const { data: afterSale } = await client.from("products").select("quantity_on_hand").eq("id", product.id).single();
    assert.equal(afterSale?.quantity_on_hand, 10, "manual shrink and product sale should deduct inventory exactly once");
    const { error: saleDeleteError } = await client.from("product_sales").delete().eq("id", sale.id);
    if (saleDeleteError) throw saleDeleteError;
    const { data: afterReversal } = await client.from("products").select("quantity_on_hand").eq("id", product.id).single();
    assert.equal(afterReversal?.quantity_on_hand, 13, "sale deletion should restore inventory exactly once");

    console.log("Live inventory receipt, history, adjustment, sale, and reversal test passed.");
  } finally {
    if (storeId) await client.from("stores").delete().eq("id", storeId);
    await client.auth.signOut();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
