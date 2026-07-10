import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

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
const publicKey = required(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
);
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
  const { error: profileError } = await admin.from("users").insert({
    id: data.user.id,
    email,
    full_name: `RLS ${label}`,
    role: "owner",
  });
  if (profileError) throw profileError;
  return { id: data.user.id, email };
}

async function signedInClient(email: string) {
  const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function main() {
  let storeId: string | null = null;
  let saleId: string | null = null;
  try {
    const userA = await createTestUser("a");
    const userB = await createTestUser("b");
    const { data: store, error: storeError } = await admin
      .from("stores")
      .insert({ user_id: userA.id, name: "RLS Isolation Store" })
      .select("id")
      .single();
    if (storeError) throw storeError;
    storeId = store.id as string;

    const clientA = await signedInClient(userA.email);
    const clientB = await signedInClient(userB.email);
    const { data: sale, error: saleError } = await clientA
      .from("daily_sales")
      .insert({ user_id: userA.id, store_id: storeId, date: "2099-01-01", grocery_sales: 42 })
      .select("id")
      .single();
    if (saleError) throw saleError;
    saleId = sale.id as string;

    const { data: ownerRows, error: ownerReadError } = await clientA.from("daily_sales").select("id").eq("id", saleId);
    assert.ifError(ownerReadError);
    assert.equal(ownerRows?.length, 1, "the owner should read their row");

    const { data: foreignRows, error: foreignReadError } = await clientB.from("daily_sales").select("id").eq("id", saleId);
    assert.ifError(foreignReadError);
    assert.deepEqual(foreignRows, [], "another authenticated user must not read the row");

    const { data: foreignUpdate, error: foreignUpdateError } = await clientB
      .from("daily_sales")
      .update({ grocery_sales: 999 })
      .eq("id", saleId)
      .select("id");
    assert.ifError(foreignUpdateError);
    assert.deepEqual(foreignUpdate, [], "another authenticated user must not update the row");

    const { error: forgedInsertError } = await clientA.from("daily_sales").insert({
      user_id: userB.id,
      store_id: storeId,
      date: "2099-01-02",
      grocery_sales: 1,
    });
    assert.ok(forgedInsertError, "WITH CHECK must reject rows owned by another user");

    const anonymous = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: anonymousRows, error: anonymousError } = await anonymous.from("daily_sales").select("id").eq("id", saleId);
    assert.ifError(anonymousError);
    assert.deepEqual(anonymousRows, [], "anonymous users must not read business data");

    console.log("Live Supabase RLS isolation test passed.");
  } finally {
    if (createdUserIds.length) {
      await admin.from("daily_sales").delete().in("user_id", createdUserIds);
      await admin.from("stores").delete().in("user_id", createdUserIds);
      await admin.from("users").delete().in("id", createdUserIds);
      for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
    }
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
