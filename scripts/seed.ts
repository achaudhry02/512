import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import type { ExpenseCategory } from "@/lib/types";

function loadLocalEnv() {
  if (!existsSync(".env.local")) {
    return;
  }

  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    process.env[key] ??= valueParts.join("=").replace(/^["']|["']$/g, "");
  }
}

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const seedUserId = process.env.SEED_USER_ID;
const seedEmail = process.env.SEED_USER_EMAIL ?? "owner@example.com";
const seedStoreName = process.env.SEED_STORE_NAME ?? "Main Street Market";

function required(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required. Add it to .env.local or export it before running npm run seed.`);
  }

  return value;
}

function isoDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function seededExpenseCategory(index: number): ExpenseCategory {
  const categories: ExpenseCategory[] = [
    "Inventory",
    "Utilities",
    "Fuel purchase",
    "Capital Candy",
    "Repairs",
    "Insurance",
  ];

  return categories[index % categories.length];
}

async function main() {
  const supabase = createClient(required(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"), required(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      persistSession: false,
    },
  });
  const userId = required(seedUserId, "SEED_USER_ID");

  const { error: userError } = await supabase.from("users").upsert({
    id: userId,
    email: seedEmail,
    full_name: "Demo Owner",
  });

  if (userError) {
    throw userError;
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .insert({
      user_id: userId,
      name: seedStoreName,
      address: "100 Main Street",
      city: "Springfield",
      state: "IL",
      zip: "62701",
    })
    .select("id")
    .single();

  if (storeError) {
    throw storeError;
  }

  const storeId = store.id as string;
  const dailySales = Array.from({ length: 14 }, (_, index) => {
    const weekendLift = index % 6 === 0 ? 850 : 0;
    const grocerySales = 980 + index * 22;
    const deliSales = 420 + weekendLift / 5 + index * 8;
    const hotFoodSales = 200 + weekendLift / 6 + index * 4;
    const lotterySales = 760 + index * 14;
    const cigaretteSales = 1120 + index * 16;
    const beerSales = 780 + weekendLift / 5;
    const otherSales = 650 + index * 10;
    const insideSales = grocerySales + deliSales + hotFoodSales + lotterySales + cigaretteSales + beerSales + otherSales;

    return {
      user_id: userId,
      store_id: storeId,
      date: isoDate(index),
      inside_sales: insideSales,
      fuel_gallons_sold: 1700 + weekendLift / 3 + index * 18,
      fuel_retail_price: 3.59 - (index % 3) * 0.02,
      fuel_cost_per_gallon: 3.31 + (index % 4) * 0.015,
      lottery_sales: lotterySales,
      lottery_payouts: 280 + (index % 5) * 35,
      deli_sales: deliSales,
      hot_food_sales: hotFoodSales,
      cigarette_sales: cigaretteSales,
      beer_sales: beerSales,
      grocery_sales: grocerySales,
      other_sales: otherSales,
      cash_total: Math.round(insideSales * 0.54),
      card_total: Math.round(insideSales * 0.46),
      expenses: index % 4 === 0 ? 180 + index * 12 : 0,
      payroll: 300 + (index % 3) * 25,
      notes: index === 0 ? "Seeded daily closeout." : null,
    };
  });

  const expenses = Array.from({ length: 10 }, (_, index) => ({
    user_id: userId,
    store_id: storeId,
    date: isoDate(index),
    vendor_name: ["Capital Candy", "Fuel Distributor", "City Utilities", "Beverage Warehouse"][index % 4],
    category: seededExpenseCategory(index),
    amount: 180 + index * 45 + (index % 3 === 0 ? 600 : 0),
    payment_method: "ACH",
    notes: index % 3 === 0 ? "Seeded higher invoice for Profit Leak Finder testing." : null,
  }));

  const fuelEntries = dailySales.slice(0, 7).map((sale, index) => ({
    user_id: userId,
    store_id: storeId,
    date: sale.date,
    gallons_sold: sale.fuel_gallons_sold,
    cost_per_gallon: index === 2 ? 3.48 : sale.fuel_cost_per_gallon,
    retail_price_per_gallon: sale.fuel_retail_price,
    notes: index === 2 ? "Low-margin seeded fuel day." : null,
  }));

  const payrollEntries = [
    {
      user_id: userId,
      store_id: storeId,
      employee_name: "Jordan Lee",
      date_range_start: isoDate(13),
      date_range_end: isoDate(7),
      hours_worked: 38.5,
      hourly_rate: 18,
      notes: "Shift lead.",
    },
    {
      user_id: userId,
      store_id: storeId,
      employee_name: "Mia Patel",
      date_range_start: isoDate(6),
      date_range_end: isoDate(0),
      hours_worked: 36,
      hourly_rate: 17,
      notes: "Seeded payroll data.",
    },
  ];

  const now = new Date();
  const monthlyTotals = [{
    user_id: userId,
    store_id: storeId,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    grocery_sales: 36500,
    deli_sales: 8500,
    hot_food_sales: 6200,
    fuel_gallons_sold: 61500,
    fuel_revenue: 220785,
    fuel_cost: 208485,
    lottery_sales: 26500,
    beer_sales: 31400,
    cigarette_sales: 42200,
    vape_nicotine_sales: 7800,
    other_sales: 14900,
    cash_sales: 164500,
    card_sales: 225300,
    payroll: 10800,
    inventory_purchases: 48500,
    vendor_expenses: 12600,
    utilities: 2100,
    rent_mortgage: 7600,
    insurance: 1400,
    repairs_maintenance: 1850,
    miscellaneous_expenses: 2400,
    notes: "Seeded monthly totals entry. Daily records remain separate.",
  }];

  const vendors = [
    { user_id: userId, store_id: storeId, name: "Capital Candy", normalized_name: "capital candy", category: "Capital Candy", contact_person: "Chris Morgan", phone: "555-0101", email: "orders@capitalcandy.example", products_supplied: "Candy, snacks, drinks, grocery", average_weekly_spend: 1850, total_spend: 7400, notes: "Primary distributor." },
    { user_id: userId, store_id: storeId, name: "Metro Beverage", normalized_name: "metro beverage", category: "Beer / Alcohol", contact_person: "Dana Ruiz", phone: "555-0110", email: null, products_supplied: "Beer and malt beverages", average_weekly_spend: 1200, total_spend: 4800, notes: null },
    { user_id: userId, store_id: storeId, name: "Regional Fuel Supply", normalized_name: "regional fuel supply", category: "Fuel purchase", contact_person: "Sam Reed", phone: "555-0125", email: null, products_supplied: "Regular, mid-grade, and premium fuel", average_weekly_spend: 17500, total_spend: 70000, notes: null },
  ];

  const products = [
    { name: "Bottled Water 20 oz", sku_upc: "1001001001", category: "Drinks", unit_cost: 0.42, unit_retail_price: 1.49, quantity_on_hand: 36, reorder_level: 12, menu_export_enabled: true, menu_name: "Cold Bottled Water", menu_description: "20 oz bottled water", menu_category: "Cold Drinks", notes: null },
    { name: "Salted Chips 2 oz", sku_upc: "1001001002", category: "Snacks", unit_cost: 0.68, unit_retail_price: 1.89, quantity_on_hand: 8, reorder_level: 12, menu_export_enabled: true, menu_name: "Salted Chips", menu_description: "2 oz bag", menu_category: "Snacks", notes: "Reorder on next delivery." },
    { name: "Breakfast Sandwich", sku_upc: "1001001003", category: "Hot food", unit_cost: 1.45, unit_retail_price: 4.99, quantity_on_hand: 14, reorder_level: 8, menu_export_enabled: true, menu_name: "Breakfast Sandwich", menu_description: "Hot breakfast sandwich", menu_category: "Hot Food", notes: "Prepared daily." },
    { name: "Household Paper Towels", sku_upc: "1001001004", category: "Household", unit_cost: 2.1, unit_retail_price: 4.79, quantity_on_hand: 3, reorder_level: 5, menu_export_enabled: false, menu_name: null, menu_description: null, menu_category: null, notes: null },
  ].map((product) => ({ ...product, user_id: userId, store_id: storeId }));

  const employees = [
    { name: "Jordan Lee", role: "Manager", hourly_rate: 18, phone: "555-0140", email: "jordan@example.com", active: true, notes: "Shift lead." },
    { name: "Mia Patel", role: "Employee/Cashier", hourly_rate: 16.5, phone: "555-0141", email: null, active: true, notes: null },
    { name: "Alex Owner", role: "Owner/Admin", hourly_rate: 0, phone: null, email: seedEmail, active: true, notes: null },
  ].map((employee) => ({ ...employee, user_id: userId, store_id: storeId }));

  const marginSettings = [
    { category: "grocery", gross_margin_percent: 28, notes: "Demo grocery margin" },
    { category: "candy", gross_margin_percent: 32, notes: "Demo candy margin" },
    { category: "snacks", gross_margin_percent: 32, notes: "Demo snack margin" },
    { category: "drinks", gross_margin_percent: 35, notes: "Demo drink margin" },
    { category: "cigarettes", gross_margin_percent: 18, notes: "Demo cigarette margin" },
    { category: "vape_nicotine", gross_margin_percent: 35, notes: "Demo vape/nicotine margin" },
    { category: "beer", gross_margin_percent: 24, notes: "Demo beer margin" },
    { category: "deli", gross_margin_percent: 55, notes: "Demo deli margin" },
    { category: "hot_food", gross_margin_percent: 55, notes: "Demo hot food margin" },
    { category: "lottery", gross_margin_percent: 6, notes: "Demo lottery commission" },
    { category: "fuel", gross_margin_percent: 0, notes: "Fuel uses price minus cost" },
    { category: "other", gross_margin_percent: 28, notes: "Demo other sales margin" },
  ].map((setting) => ({ ...setting, user_id: userId, store_id: storeId }));

  const { error: salesError } = await supabase.from("daily_sales").insert(dailySales);
  if (salesError) throw salesError;

  const { error: expenseError } = await supabase.from("expenses").insert(expenses);
  if (expenseError) throw expenseError;

  const { error: fuelError } = await supabase.from("fuel_entries").insert(fuelEntries);
  if (fuelError) throw fuelError;

  const { error: payrollError } = await supabase.from("payroll_entries").insert(payrollEntries);
  if (payrollError) throw payrollError;

  const { error: monthlyError } = await supabase.from("monthly_totals").insert(monthlyTotals);
  if (monthlyError) throw monthlyError;

  const { error: vendorError } = await supabase.from("vendors").insert(vendors);
  if (vendorError) throw vendorError;

  const { error: productError } = await supabase.from("products").insert(products);
  if (productError) throw productError;

  const [{ data: capitalCandy }, { data: inventoryProducts }] = await Promise.all([
    supabase.from("vendors").select("id").eq("user_id", userId).eq("store_id", storeId).eq("normalized_name", "capital candy").single(),
    supabase.from("products").select("id,name,sku_upc,unit_cost").eq("user_id", userId).eq("store_id", storeId).in("sku_upc", ["1001001001", "1001001002", "1001001004"]),
  ]);
  const orderProducts = (inventoryProducts ?? []).filter((product) => product.sku_upc !== "1001001004");
  if (capitalCandy?.id && orderProducts.length) {
    const { data: purchaseOrder, error: purchaseOrderError } = await supabase.from("purchase_orders").insert({
      user_id: userId,
      store_id: storeId,
      vendor_id: capitalCandy.id,
      po_number: `DEMO-PO-${isoDate(0).replaceAll("-", "")}`,
      status: "ordered",
      order_date: isoDate(0),
      expected_date: isoDate(-3),
      total_cost: orderProducts.reduce((total, product) => total + Number(product.unit_cost) * 24, 0),
      notes: "Demo reorder generated from low-stock suggestions.",
    }).select("id").single();
    if (purchaseOrderError) throw purchaseOrderError;

    const { error: purchaseItemsError } = await supabase.from("purchase_order_items").insert(orderProducts.map((product) => ({
      user_id: userId,
      store_id: storeId,
      purchase_order_id: purchaseOrder.id,
      product_id: product.id,
      product_name: product.name,
      sku_upc: product.sku_upc,
      ordered_quantity: 24,
      received_quantity: 0,
      unit_cost: product.unit_cost,
    })));
    if (purchaseItemsError) throw purchaseItemsError;
  }

  const paperTowels = (inventoryProducts ?? []).find((product) => product.sku_upc === "1001001004");
  if (paperTowels) {
    const { error: adjustmentError } = await supabase.from("inventory_adjustments").insert({
      user_id: userId,
      store_id: storeId,
      product_id: paperTowels.id,
      adjustment_date: isoDate(1),
      adjustment_type: "damage",
      quantity_delta: -1,
      unit_cost: paperTowels.unit_cost,
      reason: "Damaged packaging",
      notes: "Seeded shrink/loss example.",
      source_type: "seed",
    });
    if (adjustmentError) throw adjustmentError;
  }

  const { error: employeeError } = await supabase.from("employees").insert(employees);
  if (employeeError) throw employeeError;

  const { error: marginError } = await supabase.from("margin_settings").upsert(marginSettings, { onConflict: "user_id,store_id,category" });
  if (marginError) throw marginError;

  console.log(`Seeded ${seedStoreName} with sales, expenses, inventory operations, purchase orders, vendors, employees, and margin settings.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
