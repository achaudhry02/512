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

function sampleExpenseCategory(index: number): ExpenseCategory {
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

    return {
      user_id: userId,
      store_id: storeId,
      date: isoDate(index),
      inside_sales: 4300 + weekendLift + index * 45,
      fuel_gallons_sold: 1700 + weekendLift / 3 + index * 18,
      fuel_retail_price: 3.59 - (index % 3) * 0.02,
      fuel_cost_per_gallon: 3.31 + (index % 4) * 0.015,
      lottery_sales: 760 + index * 14,
      lottery_payouts: 280 + (index % 5) * 35,
      deli_sales: 620 + weekendLift / 4 + index * 12,
      cigarette_sales: 1120 + index * 16,
      beer_sales: 780 + weekendLift / 5,
      grocery_sales: 980 + index * 22,
      other_sales: 650 + index * 10,
      notes: index === 0 ? "Seeded daily closeout." : null,
    };
  });

  const expenses = Array.from({ length: 10 }, (_, index) => ({
    user_id: userId,
    store_id: storeId,
    date: isoDate(index),
    vendor_name: ["Capital Candy", "Fuel Distributor", "City Utilities", "Beverage Warehouse"][index % 4],
    category: sampleExpenseCategory(index),
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

  const { error: salesError } = await supabase.from("daily_sales").insert(dailySales);
  if (salesError) throw salesError;

  const { error: expenseError } = await supabase.from("expenses").insert(expenses);
  if (expenseError) throw expenseError;

  const { error: fuelError } = await supabase.from("fuel_entries").insert(fuelEntries);
  if (fuelError) throw fuelError;

  const { error: payrollError } = await supabase.from("payroll_entries").insert(payrollEntries);
  if (payrollError) throw payrollError;

  console.log(`Seeded ${seedStoreName} with sample sales, expenses, fuel, and payroll data.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
