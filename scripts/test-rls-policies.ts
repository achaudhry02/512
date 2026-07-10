import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("supabase/schema.sql", "utf8");
const tableNames = [...schema.matchAll(/create table if not exists public\.([a-z_]+)\s*\(/gi)]
  .map((match) => match[1]);
const policyBlocks = [...schema.matchAll(/create policy[\s\S]*?;/gi)].map((match) => match[0]);

assert.ok(tableNames.length >= 30, "the schema audit should discover all application tables");
assert.equal(new Set(tableNames).size, tableNames.length, "table declarations should be unique");
assert.doesNotMatch(schema, /auth\.role\s*\(/i, "RLS should use JWT ownership, not the deprecated auth.role helper");

for (const table of tableNames) {
  assert.match(
    schema,
    new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    `${table} must enable RLS`,
  );
  assert.match(
    schema,
    new RegExp(`grant [^;]+ on table public\\.${table} to authenticated`, "i"),
    `${table} must explicitly grant authenticated access`,
  );

  const ownershipPolicies = policyBlocks.filter((block) =>
    new RegExp(`on public\\.${table}\\b`, "i").test(block) && /auth\.uid\s*\(\s*\)/i.test(block),
  );
  assert.ok(ownershipPolicies.length > 0, `${table} must have an auth.uid() ownership policy`);
}

for (const policy of policyBlocks.filter((block) => /for\s+(update|all)\b/i.test(block))) {
  assert.match(policy, /with check\s*\(/i, "UPDATE and ALL policies must protect the resulting row with WITH CHECK");
}

console.log(`RLS schema audit passed for ${tableNames.length} tables and ${policyBlocks.length} policies.`);
