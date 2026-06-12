"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizedRuleKey, rowGrossProfit, rowGrossSales, rowMarginPercent } from "@/lib/smart-import";
import type {
  CommandCenterData,
  ImportRecord,
  ImportRow,
  ParsedImportResult,
  ParsedImportRow,
  Store,
  TableName,
  TableRowMap,
  UserProfile,
} from "@/lib/types";

const tableNames: TableName[] = [
  "daily_sales",
  "expenses",
  "fuel_entries",
  "lottery_entries",
  "deli_entries",
  "payroll_entries",
];

const smartImportTableNames = [
  "imports",
  "import_rows",
  "vendors",
  "product_categories",
  "products",
  "product_sales",
  "department_sales",
  "store_sales_summaries",
  "fuel_grade_sales",
  "tender_sales",
  "category_rules",
  "vendor_rules",
  "product_rules",
] as const;

const emptyData: CommandCenterData = {
  daily_sales: [],
  expenses: [],
  fuel_entries: [],
  lottery_entries: [],
  deli_entries: [],
  payroll_entries: [],
  imports: [],
  import_rows: [],
  vendors: [],
  product_categories: [],
  products: [],
  product_sales: [],
  department_sales: [],
  store_sales_summaries: [],
  fuel_grade_sales: [],
  tender_sales: [],
  category_rules: [],
  vendor_rules: [],
  product_rules: [],
};

type EntryPayload<T extends TableName> = Omit<
  TableRowMap[T],
  "id" | "user_id" | "store_id" | "created_at" | "updated_at"
>;

type CommandCenterContextValue = {
  user: User | null;
  profile: UserProfile | null;
  store: Store | null;
  data: CommandCenterData;
  authLoading: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveEntry: <T extends TableName>(
    table: T,
    payload: EntryPayload<T>,
    id?: string,
  ) => Promise<void>;
  deleteEntry: <T extends TableName>(table: T, id: string) => Promise<void>;
  saveSmartImport: (parsedImport: ParsedImportResult, rows: ParsedImportRow[]) => Promise<void>;
  updateProfile: (payload: Partial<Pick<UserProfile, "full_name">>) => Promise<void>;
  updateStore: (payload: Partial<Omit<Store, "id" | "user_id">>) => Promise<void>;
};

const CommandCenterContext = createContext<CommandCenterContextValue | undefined>(undefined);

function normalizedVendor(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() || "unknown vendor";
}

function rowDate(row: ParsedImportRow) {
  return row.date || new Date().toISOString().slice(0, 10);
}

function rowAmount(row: ParsedImportRow) {
  return row.total || row.quantity * (row.unitRetailPrice || row.unitCost);
}

function importRowPayload(row: ParsedImportRow, importId: string, userId: string, storeId: string): Omit<ImportRow, "id"> {
  return {
    user_id: userId,
    store_id: storeId,
    import_id: importId,
    row_index: row.rowIndex,
    row_hash: row.rowHash,
    date: row.date,
    vendor: row.vendor || null,
    description: row.description || null,
    product_name: row.productName || null,
    sku_upc: row.skuUpc || null,
    quantity: row.quantity,
    unit_cost: row.unitCost,
    unit_retail_price: row.unitRetailPrice,
    total: rowAmount(row),
    suggested_category: row.suggestedCategory,
    confidence_score: row.confidenceScore,
    import_destination: row.importDestination,
    needs_review: row.needsReview,
    ignored: row.ignored || row.importDestination === "ignore",
    raw_data: row.rawData,
  };
}

function importRecordPayload(
  parsedImport: ParsedImportResult,
  rowCount: number,
  userId: string,
  storeId: string,
): Omit<ImportRecord, "id"> {
  return {
    user_id: userId,
    store_id: storeId,
    original_file_name: parsedImport.fileName,
    file_type: parsedImport.fileType,
    file_size: parsedImport.fileSize,
    file_hash: parsedImport.fileHash,
    row_count: rowCount,
    status: "imported",
    metadata: {
      parser: parsedImport.parser,
      warnings: parsedImport.warnings,
    },
  };
}

function learnedKeyword(row: ParsedImportRow) {
  const source = row.description || row.productName || row.vendor;
  return source
    .split(/\s+/)
    .filter((word) => word.length > 2 && !/^\d+(\.\d+)?$/.test(word))
    .slice(0, 4)
    .join(" ")
    .trim();
}

function correctedRows(rows: ParsedImportRow[]) {
  return rows.filter(
    (row) =>
      !row.ignored &&
      row.importDestination !== "ignore" &&
      row.importDestination !== "needs_review" &&
      row.originalSuggestedCategory &&
      row.originalSuggestedCategory !== row.suggestedCategory,
  );
}

export function CommandCenterProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [data, setData] = useState<CommandCenterData>(emptyData);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSupabaseData = useCallback(async (activeUser: User | null) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setUser(null);
      setProfile(null);
      setStore(null);
      setData(emptyData);
      setError("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      setAuthLoading(false);
      setLoading(false);
      return;
    }

    if (!activeUser) {
      console.info("[auth] no active Supabase session");
      setUser(activeUser);
      setProfile(null);
      setStore(null);
      setData(emptyData);
      setError(null);
      setAuthLoading(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setUser(activeUser);
    setAuthLoading(false);
    console.info("[auth] active Supabase session", {
      userId: activeUser.id,
      email: activeUser.email,
    });

    try {
      const profilePayload: UserProfile = {
        id: activeUser.id,
        email: activeUser.email ?? "",
        full_name:
          typeof activeUser.user_metadata?.full_name === "string"
            ? activeUser.user_metadata.full_name
            : null,
      };

      const { data: profileRow, error: profileError } = await supabase
        .from("users")
        .upsert(profilePayload, { onConflict: "id" })
        .select("*")
        .single();

      if (profileError) {
        throw profileError;
      }

      const storesResponse = await supabase
        .from("stores")
        .select("*")
        .eq("user_id", activeUser.id)
        .order("created_at", { ascending: true });

      if (storesResponse.error) {
        throw storesResponse.error;
      }

      let stores = storesResponse.data;

      if (!stores?.length) {
        const { data: newStore, error: storeError } = await supabase
          .from("stores")
          .insert({
            user_id: activeUser.id,
            name: "My Convenience Store",
            address: null,
            city: null,
            state: null,
            zip: null,
          })
          .select("*")
          .single();

        if (storeError) {
          throw storeError;
        }

        stores = newStore ? [newStore] : [];
      }

      const activeStore = stores?.[0] as Store | undefined;
      const nextData: CommandCenterData = { ...emptyData };

      if (activeStore) {
        const tableResults = await Promise.all(
          tableNames.map(async (table) => {
            const { data: rows, error: tableError } = await supabase
              .from(table)
              .select("*")
              .eq("user_id", activeUser.id)
              .eq("store_id", activeStore.id)
              .order(table === "payroll_entries" ? "date_range_start" : "date", {
                ascending: false,
              });

            if (tableError) {
              throw tableError;
            }

            return [table, rows ?? []] as const;
          }),
        );

        for (const [table, rows] of tableResults) {
          nextData[table] = rows as never;
        }

        const smartImportResults = await Promise.all(
          smartImportTableNames.map(async (table) => {
            const orderColumn =
              table === "product_sales"
                ? "date"
                : table === "import_rows"
                  ? "row_index"
                  : "created_at";
            const { data: rows, error: tableError } = await supabase
              .from(table)
              .select("*")
              .eq("user_id", activeUser.id)
              .eq("store_id", activeStore.id)
              .order(orderColumn, { ascending: table === "import_rows" });

            if (tableError) {
              throw tableError;
            }

            return [table, rows ?? []] as const;
          }),
        );

        for (const [table, rows] of smartImportResults) {
          nextData[table] = rows as never;
        }
      }

      setProfile(profileRow as UserProfile);
      setStore(activeStore ?? null);
      setData(nextData);
    } catch (loadError) {
      setUser(activeUser);
      setProfile((current) => current ?? {
        id: activeUser.id,
        email: activeUser.email ?? "",
        full_name:
          typeof activeUser.user_metadata?.full_name === "string"
            ? activeUser.user_metadata.full_name
            : null,
      });
      setError(loadError instanceof Error ? loadError.message : "Unable to load store data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      setAuthLoading(false);
      setLoading(false);
      return;
    }

    const { data: sessionData } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    console.info("[auth] refresh getSession", {
      hasSession: Boolean(sessionData.session),
      userId: sessionData.session?.user.id ?? null,
    });
    await loadSupabaseData(sessionData.session?.user ?? null);
  }, [loadSupabaseData]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setUser(null);
      setProfile(null);
      setStore(null);
      setData(emptyData);
      setError("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      setAuthLoading(false);
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data: sessionData }) => {
      console.info("[auth] initial getSession", {
        hasSession: Boolean(sessionData.session),
        userId: sessionData.session?.user.id ?? null,
      });
      if (mounted) {
        void loadSupabaseData(sessionData.session?.user ?? null);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.info("[auth] onAuthStateChange", {
        event,
        hasSession: Boolean(session),
        userId: session?.user.id ?? null,
      });
      void loadSupabaseData(session?.user ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadSupabaseData]);

  const saveEntry = useCallback(
    async <T extends TableName>(table: T, payload: EntryPayload<T>, id?: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !store) {
        throw new Error("You must be signed in before saving entries.");
      }

      setError(null);

      const dbPayload = {
        ...payload,
        user_id: user.id,
        store_id: store.id,
      };

      const result = id
        ? await supabase.from(table).update(dbPayload).eq("id", id).eq("user_id", user.id)
        : await supabase.from(table).insert(dbPayload);

      if (result.error) {
        setError(result.error.message);
        throw result.error;
      }

      await refresh();
    },
    [refresh, store, user],
  );

  const deleteEntry = useCallback(
    async <T extends TableName>(table: T, id: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) {
        throw new Error("You must be signed in before deleting entries.");
      }

      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (deleteError) {
        setError(deleteError.message);
        throw deleteError;
      }

      await refresh();
    },
    [refresh, user],
  );

  const saveSmartImport = useCallback(
    async (parsedImport: ParsedImportResult, rows: ParsedImportRow[]) => {
      const acceptedRows = rows.filter(
        (row) => !row.ignored && row.importDestination !== "ignore" && row.importDestination !== "needs_review",
      );

      if (data.imports.some((record) => record.file_hash === parsedImport.fileHash)) {
        console.error("Smart Import duplicate file:", {
          fileName: parsedImport.fileName,
          fileHash: parsedImport.fileHash,
        });
        throw new Error("This file has already been imported. Smart Import prevented a duplicate file import.");
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        console.error("Smart Import Supabase client missing.");
        throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      console.info("[auth] smart import getSession", {
        hasSession: Boolean(session),
        userId: session?.user.id ?? null,
        importRowsCount: rows.length,
        acceptedRowsCount: acceptedRows.length,
      });

      if (sessionError) {
        console.warn("Smart Import session check failed:", sessionError);
      }

      const activeUser = session?.user ?? user;

      if (!activeUser) {
        console.error("Smart Import missing authenticated user.", {
          hasSession: Boolean(session),
          hasProviderUser: Boolean(user),
          importRowsCount: rows.length,
        });
        throw new Error("You must be signed in before importing rows.");
      }

      const supabaseClient = supabase;
      const userId = activeUser.id;
      setUser(activeUser);

      let activeStore = store?.user_id === userId ? store : null;
      if (!activeStore) {
        const { data: stores, error: storesError } = await supabaseClient
          .from("stores")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        if (storesError) {
          console.error("Smart Import stores select failed:", storesError);
          throw storesError;
        }

        activeStore = (stores?.[0] as Store | undefined) ?? null;
      }

      if (!activeStore) {
        const { data: newStore, error: newStoreError } = await supabaseClient
          .from("stores")
          .insert({
            user_id: userId,
            name: "My Convenience Store",
            address: null,
            city: null,
            state: null,
            zip: null,
          })
          .select("*")
          .single();

        if (newStoreError) {
          console.error("Smart Import store insert failed:", newStoreError);
          throw newStoreError;
        }

        activeStore = newStore as Store;
      }

      setStore(activeStore);
      const storeId = activeStore.id;

      const existingRowHashes = new Set(data.import_rows.map((row) => row.row_hash));
      const rowsToRecord = rows.filter((row) => !existingRowHashes.has(row.rowHash));
      const { data: importRecord, error: importError } = await supabase
        .from("imports")
        .insert(importRecordPayload(parsedImport, acceptedRows.length, userId, storeId))
        .select("*")
        .single();

      if (importError) {
        console.error("Smart Import imports insert failed:", importError);
        throw importError;
      }

      const importId = importRecord.id as string;
      const importRowPayloads = rowsToRecord.map((row) => importRowPayload(row, importId, userId, storeId));
      const { data: insertedImportRows, error: importRowsError } = importRowPayloads.length
        ? await supabase.from("import_rows").insert(importRowPayloads).select("id,row_hash")
        : { data: [], error: null };

      if (importRowsError) {
        console.error("Smart Import import_rows insert failed:", importRowsError);
        throw importRowsError;
      }

      const importRowIdByHash = new Map(
        (insertedImportRows ?? []).map((row: { id: string; row_hash: string }) => [row.row_hash, row.id]),
      );

      async function ensureVendor(row: ParsedImportRow) {
        const name = row.vendor || "Unknown vendor";
        const normalized = normalizedVendor(name);
        const { data: vendor, error: vendorError } = await supabaseClient
          .from("vendors")
          .upsert(
            {
              user_id: userId,
              store_id: storeId,
              name,
              normalized_name: normalized,
              category: row.suggestedCategory,
            },
            { onConflict: "user_id,store_id,normalized_name" },
          )
          .select("*")
          .single();

        if (vendorError) {
          console.error("Smart Import vendors upsert failed:", vendorError, {
            vendor: name,
            userId,
            storeId,
          });
          throw vendorError;
        }

        return vendor as { id: string; name: string };
      }

      async function ensureCategory(row: ParsedImportRow) {
        const { data: category, error: categoryError } = await supabaseClient
          .from("product_categories")
          .upsert(
            {
              user_id: userId,
              store_id: storeId,
              name: row.suggestedCategory,
              parent_category: null,
            },
            { onConflict: "user_id,store_id,name" },
          )
          .select("*")
          .single();

        if (categoryError) {
          console.error("Smart Import product_categories upsert failed:", categoryError, {
            category: row.suggestedCategory,
            userId,
            storeId,
          });
          throw categoryError;
        }

        return category as { id: string };
      }

      async function ensureProduct(row: ParsedImportRow, vendorId: string, categoryId: string) {
        const name = row.productName || row.description || "Imported product";
        const { data: product, error: productError } = await supabaseClient
          .from("products")
          .upsert(
            {
              user_id: userId,
              store_id: storeId,
              product_category_id: categoryId,
              vendor_id: vendorId,
              name,
              sku_upc: row.skuUpc || null,
              category: row.suggestedCategory,
              unit_cost: row.unitCost,
              unit_retail_price: row.unitRetailPrice,
            },
            { onConflict: "user_id,store_id,name" },
          )
          .select("*")
          .single();

        if (productError) {
          console.error("Smart Import products upsert failed:", productError, {
            product: name,
            skuUpc: row.skuUpc,
            userId,
            storeId,
          });
          throw productError;
        }

        return product as { id: string; name: string };
      }

      async function saveLearnedCorrections() {
        const corrections = correctedRows(rows);

        for (const row of corrections) {
          if (row.vendor) {
            const normalized = normalizedRuleKey(row.vendor);
            const { error: vendorRuleError } = await supabaseClient
              .from("vendor_rules")
              .upsert(
                {
                  user_id: userId,
                  store_id: storeId,
                  vendor_name: row.vendor,
                  normalized_vendor: normalized,
                  category: row.suggestedCategory,
                  import_destination: row.importDestination,
                  confidence_score: 95,
                  usage_count: 1,
                },
                { onConflict: "user_id,store_id,normalized_vendor" },
              );
            if (vendorRuleError) {
              console.error("Smart Import vendor_rules upsert failed:", vendorRuleError, {
                vendor: row.vendor,
                category: row.suggestedCategory,
                userId,
                storeId,
              });
              throw vendorRuleError;
            }
          }

          if (row.productName || row.skuUpc) {
            const normalized = normalizedRuleKey(row.productName || row.skuUpc);
            const { error: productRuleError } = await supabaseClient
              .from("product_rules")
              .upsert(
                {
                  user_id: userId,
                  store_id: storeId,
                  product_name: row.productName || row.description || "Imported product",
                  sku_upc: row.skuUpc || null,
                  normalized_product: normalized,
                  category: row.suggestedCategory,
                  import_destination: row.importDestination,
                  confidence_score: 95,
                  usage_count: 1,
                },
                { onConflict: "user_id,store_id,normalized_product" },
              );
            if (productRuleError) {
              console.error("Smart Import product_rules upsert failed:", productRuleError, {
                product: row.productName,
                skuUpc: row.skuUpc,
                category: row.suggestedCategory,
                userId,
                storeId,
              });
              throw productRuleError;
            }
          }

          const keyword = learnedKeyword(row);
          if (keyword) {
            const normalized = normalizedRuleKey(keyword);
            const { error: categoryRuleError } = await supabaseClient
              .from("category_rules")
              .upsert(
                {
                  user_id: userId,
                  store_id: storeId,
                  keyword,
                  normalized_keyword: normalized,
                  category: row.suggestedCategory,
                  import_destination: row.importDestination,
                  confidence_score: 95,
                  usage_count: 1,
                },
                { onConflict: "user_id,store_id,normalized_keyword" },
              );
            if (categoryRuleError) {
              console.error("Smart Import category_rules upsert failed:", categoryRuleError, {
                keyword,
                category: row.suggestedCategory,
                userId,
                storeId,
              });
              throw categoryRuleError;
            }
          }
        }
      }

      for (const row of acceptedRows) {
        if (!importRowIdByHash.has(row.rowHash)) {
          continue;
        }

        const date = rowDate(row);
        const amount = rowAmount(row);
        const importRowId = importRowIdByHash.get(row.rowHash) ?? null;

        if (row.importDestination === "expenses") {
          const { error: expenseError } = await supabase.from("expenses").insert({
            user_id: userId,
            store_id: storeId,
            date,
            vendor_name: row.vendor || "Imported vendor",
            category: row.suggestedCategory,
            amount,
            payment_method: "Other",
            notes: `Imported from ${parsedImport.fileName}: ${row.description}`,
          });
          if (expenseError) {
            console.error("Smart Import expenses insert failed:", expenseError, { row, userId, storeId });
            throw expenseError;
          }
        } else if (row.importDestination === "fuel_entries") {
          const { error: fuelError } = await supabase.from("fuel_entries").insert({
            user_id: userId,
            store_id: storeId,
            date,
            gallons_sold: row.quantity,
            cost_per_gallon: row.unitCost,
            retail_price_per_gallon: row.unitRetailPrice,
            notes: `Imported from ${parsedImport.fileName}: ${row.description}`,
          });
          if (fuelError) {
            console.error("Smart Import fuel_entries insert failed:", fuelError, { row, userId, storeId });
            throw fuelError;
          }
        } else if (row.importDestination === "lottery_entries") {
          const { error: lotteryError } = await supabase.from("lottery_entries").insert({
            user_id: userId,
            store_id: storeId,
            date,
            lottery_sales: amount,
            lottery_payouts: 0,
            commission_percentage: 6,
            notes: `Imported from ${parsedImport.fileName}: ${row.description}`,
          });
          if (lotteryError) {
            console.error("Smart Import lottery_entries insert failed:", lotteryError, { row, userId, storeId });
            throw lotteryError;
          }
        } else if (row.importDestination === "deli_entries") {
          const { error: deliError } = await supabase.from("deli_entries").insert({
            user_id: userId,
            store_id: storeId,
            date,
            deli_sales: amount,
            food_cost: row.quantity * row.unitCost,
            waste_amount: 0,
            notes: `Imported from ${parsedImport.fileName}: ${row.description}`,
          });
          if (deliError) {
            console.error("Smart Import deli_entries insert failed:", deliError, { row, userId, storeId });
            throw deliError;
          }
        } else if (row.importDestination === "payroll_entries") {
          const { error: payrollError } = await supabase.from("payroll_entries").insert({
            user_id: userId,
            store_id: storeId,
            employee_name: row.description || row.vendor || "Imported payroll",
            date_range_start: date,
            date_range_end: date,
            hours_worked: row.quantity,
            hourly_rate: row.unitCost || row.unitRetailPrice,
            notes: `Imported from ${parsedImport.fileName}`,
          });
          if (payrollError) {
            console.error("Smart Import payroll_entries insert failed:", payrollError, { row, userId, storeId });
            throw payrollError;
          }
        } else if (row.importDestination === "department_sales") {
          const raw = row.rawData;
          const { error: departmentError } = await supabase.from("department_sales").insert({
            user_id: userId,
            store_id: storeId,
            import_id: importId,
            report_start_date: parsedImport.reportStartDate ?? row.date,
            report_end_date: parsedImport.reportEndDate ?? row.date,
            department_name: String(raw.department_name ?? row.productName ?? row.description),
            gross_sales: Number(raw.gross_sales ?? 0),
            item_count: Number(raw.item_count ?? 0),
            refund_count: Number(raw.refund_count ?? 0),
            net_count: Number(raw.net_count ?? row.quantity ?? 0),
            refund_amount: Number(raw.refund_amount ?? 0),
            discount_amount: Number(raw.discount_amount ?? 0),
            net_sales: Number(raw.net_sales ?? row.total ?? 0),
            percent_of_sales: Number(raw.percent_of_sales ?? 0),
          });
          if (departmentError) {
            console.error("Smart Import department_sales insert failed:", departmentError, { row, userId, storeId });
            throw departmentError;
          }
        } else if (row.importDestination === "store_sales_summaries") {
          const raw = row.rawData;
          const { error: summaryError } = await supabase.from("store_sales_summaries").insert({
            user_id: userId,
            store_id: storeId,
            import_id: importId,
            report_start_date: parsedImport.reportStartDate ?? row.date,
            report_end_date: parsedImport.reportEndDate ?? row.date,
            grand_total_store_sales: Number(raw.grandTotalStoreSales ?? raw.grand_total_store_sales ?? 0),
            total_fuel_sales_volume: Number(raw.totalFuelSalesVolume ?? raw.total_fuel_sales_volume ?? 0),
            total_fuel_sales_dollars: Number(raw.totalFuelSalesDollars ?? raw.total_fuel_sales_dollars ?? 0),
            fuel_discounts: Number(raw.fuelDiscounts ?? raw.fuel_discounts ?? 0),
            total_non_fuel_sales: Number(raw.totalNonFuelSales ?? raw.total_non_fuel_sales ?? 0),
            other_discounts: Number(raw.otherDiscounts ?? raw.other_discounts ?? 0),
            total_taxes_collected: Number(raw.totalTaxesCollected ?? raw.total_taxes_collected ?? 0),
            total_sales: Number(raw.totalSales ?? raw.total_sales ?? 0),
            total_revenue: Number(raw.totalRevenue ?? raw.total_revenue ?? 0),
            network_revenue: Number(raw.networkRevenue ?? raw.network_revenue ?? 0),
          });
          if (summaryError) {
            console.error("Smart Import store_sales_summaries insert failed:", summaryError, { row, userId, storeId });
            throw summaryError;
          }
        } else if (row.importDestination === "fuel_grade_sales") {
          const raw = row.rawData;
          const { error: fuelGradeError } = await supabase.from("fuel_grade_sales").insert({
            user_id: userId,
            store_id: storeId,
            import_id: importId,
            report_start_date: parsedImport.reportStartDate ?? row.date,
            report_end_date: parsedImport.reportEndDate ?? row.date,
            grade: String(raw.grade ?? row.skuUpc ?? ""),
            grade_name: String(raw.grade_name ?? row.productName ?? ""),
            volume: Number(raw.volume ?? row.quantity ?? 0),
            sales: Number(raw.sales ?? row.total ?? 0),
            percent_of_total_fuel_sales: Number(raw.percent_of_total_fuel_sales ?? 0),
          });
          if (fuelGradeError) {
            console.error("Smart Import fuel_grade_sales insert failed:", fuelGradeError, { row, userId, storeId });
            throw fuelGradeError;
          }
        } else if (row.importDestination === "tender_sales") {
          const raw = row.rawData;
          const { error: tenderError } = await supabase.from("tender_sales").insert({
            user_id: userId,
            store_id: storeId,
            import_id: importId,
            report_start_date: parsedImport.reportStartDate ?? row.date,
            report_end_date: parsedImport.reportEndDate ?? row.date,
            payment_method: String(raw.payment_method ?? row.productName ?? row.description),
            count: Number(raw.count ?? row.quantity ?? 0),
            sales_amount: Number(raw.sales_amount ?? row.total ?? 0),
          });
          if (tenderError) {
            console.error("Smart Import tender_sales insert failed:", tenderError, { row, userId, storeId });
            throw tenderError;
          }
        } else if (row.importDestination === "product_sales") {
          const vendor = await ensureVendor(row);
          const category = await ensureCategory(row);
          const product = await ensureProduct(row, vendor.id, category.id);
          const { error: saleError } = await supabase.from("product_sales").insert({
            user_id: userId,
            store_id: storeId,
            import_id: importId,
            import_row_id: importRowId,
            product_id: product.id,
            vendor_id: vendor.id,
            date,
            product_name: product.name,
            sku_upc: row.skuUpc || null,
            quantity_sold: row.quantity,
            unit_cost: row.unitCost,
            unit_retail_price: row.unitRetailPrice,
            gross_sales: rowGrossSales(row),
            gross_profit: rowGrossProfit(row),
            margin_percent: rowMarginPercent(row),
            category: row.suggestedCategory,
            vendor: vendor.name,
          });
          if (saleError) {
            console.error("Smart Import product_sales insert failed:", saleError, {
              row,
              productId: product.id,
              vendorId: vendor.id,
              userId,
              storeId,
            });
            throw saleError;
          }
        }
      }

      await saveLearnedCorrections();
      await refresh();
    },
    [data.import_rows, data.imports, refresh, store, user],
  );

  const updateProfile = useCallback(
    async (payload: Partial<Pick<UserProfile, "full_name">>) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) {
        throw new Error("You must be signed in to update your profile.");
      }

      const { error: updateError } = await supabase
        .from("users")
        .update(payload)
        .eq("id", user.id);

      if (updateError) {
        setError(updateError.message);
        throw updateError;
      }

      await refresh();
    },
    [refresh, user],
  );

  const updateStore = useCallback(
    async (payload: Partial<Omit<Store, "id" | "user_id">>) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !store) {
        throw new Error("You must be signed in to update store settings.");
      }

      const { error: updateError } = await supabase
        .from("stores")
        .update(payload)
        .eq("id", store.id)
        .eq("user_id", user.id);

      if (updateError) {
        setError(updateError.message);
        throw updateError;
      }

      await refresh();
    },
    [refresh, store, user],
  );

  const value = useMemo<CommandCenterContextValue>(
    () => ({
      user,
      profile,
      store,
      data,
      authLoading,
      loading,
      error,
      refresh,
      saveEntry,
      deleteEntry,
      saveSmartImport,
      updateProfile,
      updateStore,
    }),
    [
      data,
      deleteEntry,
      error,
      authLoading,
      loading,
      profile,
      refresh,
      saveEntry,
      saveSmartImport,
      store,
      updateProfile,
      updateStore,
      user,
    ],
  );

  return (
    <CommandCenterContext.Provider value={value}>
      {children}
    </CommandCenterContext.Provider>
  );
}

export function useCommandCenter() {
  const context = useContext(CommandCenterContext);

  if (!context) {
    throw new Error("useCommandCenter must be used inside CommandCenterProvider.");
  }

  return context;
}
