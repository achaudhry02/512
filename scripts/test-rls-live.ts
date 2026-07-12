import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  if (!value) throw new Error(`${name} is required for the live RLS test.`);
  return value;
}

loadLocalEnv();
const url = required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
const publicKey = required(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Supabase publishable key");
const serviceKey = required(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `Rls-${suffix}-Aa1!`;
const createdUserIds: string[] = [];

async function createTestUser(label: string) {
  const email = `codex-rls-${label}-${suffix}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  createdUserIds.push(data.user.id);
  const profileRole = ["owner", "manager", "employee", "accountant"].includes(label) ? label : "employee";
  const { error: profileError } = await admin.from("users").insert({ id: data.user.id, email, full_name: `RLS ${label}`, role: profileRole });
  if (profileError) throw profileError;
  const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

async function expectVisible(client: SupabaseClient, table: string, id: string, message: string) {
  const { data, error } = await client.from(table).select("id").eq("id", id);
  assert.ifError(error);
  assert.equal(data?.length, 1, message);
}

async function expectHidden(client: SupabaseClient, table: string, id: string, message: string) {
  const { data, error } = await client.from(table).select("id").eq("id", id);
  assert.ifError(error);
  assert.deepEqual(data, [], message);
}

async function main() {
  let storeId: string | null = null;
  try {
    const owner = await createTestUser("owner");
    const manager = await createTestUser("manager");
    const employee = await createTestUser("employee");
    const accountant = await createTestUser("accountant");
    const outsider = await createTestUser("outsider");
    const { data: store, error: storeError } = await admin.from("stores").insert({ user_id: owner.id, name: "RLS Role Store" }).select("id").single();
    if (storeError) throw storeError;
    storeId = store.id as string;
    const { error: memberError } = await admin.from("store_members").insert([
      { user_id: owner.id, store_id: storeId, role: "owner", accepted_at: new Date().toISOString() },
      { user_id: manager.id, store_id: storeId, role: "manager", accepted_at: new Date().toISOString() },
      { user_id: employee.id, store_id: storeId, role: "employee", accepted_at: new Date().toISOString() },
      { user_id: accountant.id, store_id: storeId, role: "accountant", accepted_at: new Date().toISOString() },
    ]);
    if (memberError) throw memberError;

    const { data: sale, error: saleError } = await owner.client.from("daily_sales").insert({ user_id: owner.id, store_id: storeId, date: "2099-01-01", grocery_sales: 42 }).select("id").single();
    if (saleError) throw saleError;
    const saleId = sale.id as string;
    const { data: expense, error: expenseError } = await admin.from("expenses").insert({ user_id: owner.id, store_id: storeId, date: "2099-01-01", vendor_name: "RLS Vendor", category: "Other", amount: 10 }).select("id").single();
    if (expenseError) throw expenseError;
    const expenseId = expense.id as string;

    await expectVisible(owner.client, "daily_sales", saleId, "owner can read operations");
    await expectVisible(manager.client, "daily_sales", saleId, "manager can read operations");
    const { data: managerUpdate, error: managerUpdateError } = await manager.client.from("daily_sales").update({ grocery_sales: 43 }).eq("id", saleId).select("id");
    assert.ifError(managerUpdateError);
    assert.equal(managerUpdate?.length, 1, "manager can edit operations");

    await expectVisible(employee.client, "daily_sales", saleId, "employee can read daily sales");
    const { data: employeeUpdate, error: employeeUpdateError } = await employee.client.from("daily_sales").update({ grocery_sales: 44 }).eq("id", saleId).select("id");
    assert.ifError(employeeUpdateError);
    assert.equal(employeeUpdate?.length, 1, "employee can edit daily sales");
    await expectHidden(employee.client, "expenses", expenseId, "employee cannot read financial records");

    await expectVisible(accountant.client, "expenses", expenseId, "accountant can read financial records");
    const { data: accountantUpdate, error: accountantUpdateError } = await accountant.client.from("expenses").update({ amount: 999 }).eq("id", expenseId).select("id");
    assert.ifError(accountantUpdateError);
    assert.deepEqual(accountantUpdate, [], "accountant is read-only");

    await expectHidden(outsider.client, "daily_sales", saleId, "non-member cannot read operations");
    await expectHidden(outsider.client, "expenses", expenseId, "non-member cannot read financial records");
    console.log("Live Supabase role and store-membership RLS test passed.");
  } finally {
    if (storeId) await admin.from("stores").delete().eq("id", storeId);
    if (createdUserIds.length) {
      await admin.from("users").delete().in("id", createdUserIds);
      for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
    }
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
