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
import type { PosMapping, PosPreviewRow } from "@/lib/pos-import";
import { normalizedRuleKey, rowGrossProfit, rowGrossSales, rowMarginPercent } from "@/lib/smart-import";
import type {
  BulkMonthlyEntry,
  CommandCenterData,
  ImportRecord,
  ImportRow,
  MonthlyTotal,
  ParsedImportResult,
  ParsedImportRow,
  PosSystemKey,
  ResourceRowMap,
  ResourceTableName,
  Store,
  TableName,
  TableRowMap,
  UserProfile,
  UserRole,
} from "@/lib/types";

const selectedStoreStorageKey = "store-command-center-selected-store-id";

const tableNames: TableName[] = [
  "daily_sales",
  "monthly_totals",
  "cash_reconciliations",
  "expenses",
  "fuel_entries",
  "fuel_grades",
  "fuel_deliveries",
  "fuel_tank_readings",
  "fuel_reconciliations",
  "margin_settings",
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

const posImportTableNames = [
  "pos_systems",
  "pos_imports",
  "pos_column_mappings",
  "pos_import_rows",
] as const;

const resourceTableNames: ResourceTableName[] = ["products", "vendors", "employees"];

function orderColumnForTable(table: TableName) {
  if (table === "payroll_entries") return "date_range_start";
  if (table === "monthly_totals") return "year";
  if (table === "fuel_grades") return "sort_order";
  if (table === "margin_settings") return "category";
  return "date";
}

const emptyData: CommandCenterData = {
  daily_sales: [],
  monthly_totals: [],
  cash_reconciliations: [],
  expenses: [],
  fuel_entries: [],
  fuel_grades: [],
  fuel_deliveries: [],
  fuel_tank_readings: [],
  fuel_reconciliations: [],
  margin_settings: [],
  lottery_entries: [],
  deli_entries: [],
  payroll_entries: [],
  pos_systems: [],
  pos_imports: [],
  pos_column_mappings: [],
  pos_import_rows: [],
  imports: [],
  import_rows: [],
  vendors: [],
  employees: [],
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

type ResourcePayload<T extends ResourceTableName> = Omit<
  ResourceRowMap[T],
  "id" | "user_id" | "store_id" | "created_at" | "updated_at"
>;

type CommandCenterContextValue = {
  user: User | null;
  profile: UserProfile | null;
  store: Store | null;
  stores: Store[];
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
  saveBulkMonthlyEntries: (entries: BulkMonthlyEntry[], overwrite: boolean) => Promise<void>;
  saveMonthlyTotal: (
    payload: Omit<MonthlyTotal, "id" | "user_id" | "store_id" | "created_at" | "updated_at">,
    id?: string,
  ) => Promise<void>;
  deleteMonthlyTotal: (id: string) => Promise<void>;
  deleteEntry: <T extends TableName>(table: T, id: string) => Promise<void>;
  saveResource: <T extends ResourceTableName>(
    table: T,
    payload: ResourcePayload<T>,
    id?: string,
  ) => Promise<void>;
  deleteResource: <T extends ResourceTableName>(table: T, id: string) => Promise<void>;
  saveSmartImport: (parsedImport: ParsedImportResult, rows: ParsedImportRow[]) => Promise<void>;
  savePosColumnMapping: (
    posKey: PosSystemKey,
    templateName: string,
    mapping: PosMapping,
    id?: string,
  ) => Promise<void>;
  savePosImport: (payload: {
    posKey: PosSystemKey;
    posName: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    fileHash: string;
    mappingTemplateName: string | null;
    duplicateStrategy: "skip" | "overwrite";
    rows: PosPreviewRow[];
  }) => Promise<void>;
  updateProfile: (payload: Partial<Pick<UserProfile, "full_name" | "selected_store_id">>) => Promise<void>;
  updateStore: (payload: Partial<Omit<Store, "id" | "user_id">>) => Promise<void>;
  createStore: (payload: Partial<Omit<Store, "id" | "user_id">>) => Promise<void>;
  selectStore: (storeId: string) => Promise<void>;
};

const CommandCenterContext = createContext<CommandCenterContextValue | undefined>(undefined);

function normalizedVendor(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() || "unknown vendor";
}

function normalizeRole(role: unknown): UserRole {
  return role === "manager" || role === "employee" || role === "accountant" ? role : "owner";
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
  const [stores, setStores] = useState<Store[]>([]);
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
      setStores([]);
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
      setStores([]);
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
        role: "owner",
        selected_store_id: null,
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

      let stores = (storesResponse.data ?? []) as Store[];

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

      const selectedStoreId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(selectedStoreStorageKey)
          : null;
      const profileSelectedStoreId = (profileRow as UserProfile | null)?.selected_store_id ?? null;
      const activeStore =
        stores.find((candidate) => candidate.id === selectedStoreId) ??
        stores.find((candidate) => candidate.id === profileSelectedStoreId) ??
        stores[0];

      if (activeStore && selectedStoreId !== activeStore.id && typeof window !== "undefined") {
        window.localStorage.setItem(selectedStoreStorageKey, activeStore.id);
      }
      const nextData: CommandCenterData = { ...emptyData };

      if (activeStore) {
        const tableResults = await Promise.all(
          tableNames.map(async (table) => {
            let query = supabase
              .from(table)
              .select("*")
              .eq("user_id", activeUser.id)
              .eq("store_id", activeStore.id)
              .order(orderColumnForTable(table), { ascending: false });

            if (table === "monthly_totals") {
              query = query.order("month", { ascending: false });
            }

            const { data: rows, error: tableError } = await query;

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

        const posImportResults = await Promise.all(
          posImportTableNames.map(async (table) => {
            const orderColumn =
              table === "pos_import_rows"
                ? "row_index"
                : table === "pos_systems"
                  ? "name"
                  : "created_at";
            const { data: rows, error: tableError } = await supabase
              .from(table)
              .select("*")
              .eq("user_id", activeUser.id)
              .eq("store_id", activeStore.id)
              .order(orderColumn, { ascending: table === "pos_import_rows" || table === "pos_systems" });

            if (tableError) {
              throw tableError;
            }

            return [table, rows ?? []] as const;
          }),
        );

        for (const [table, rows] of posImportResults) {
          nextData[table] = rows as never;
        }

        const resourceResults = await Promise.all(
          resourceTableNames
            .filter((table) => table === "employees")
            .map(async (table) => {
              const { data: rows, error: tableError } = await supabase
                .from(table)
                .select("*")
                .eq("user_id", activeUser.id)
                .eq("store_id", activeStore.id)
                .order("name");

              if (tableError) throw tableError;
              return [table, rows ?? []] as const;
            }),
        );

        for (const [table, rows] of resourceResults) {
          nextData[table] = rows as never;
        }
      }

      setProfile({
        ...(profileRow as UserProfile),
        role: normalizeRole((profileRow as UserProfile).role),
        selected_store_id: (profileRow as UserProfile).selected_store_id ?? activeStore?.id ?? null,
      });
      setStore(activeStore ?? null);
      setStores(stores);
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
        role: "owner",
        selected_store_id: null,
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
      setStores([]);
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

  const saveBulkMonthlyEntries = useCallback(
    async (entries: BulkMonthlyEntry[], overwrite: boolean) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !store) {
        throw new Error("You must be signed in before saving bulk entries.");
      }

      const dates = entries.map((entry) => entry.date);
      const duplicateInputDates = dates.filter((date, index) => dates.indexOf(date) !== index);
      if (duplicateInputDates.length) {
        throw new Error(`Duplicate dates found in this month: ${Array.from(new Set(duplicateInputDates)).sort().join(", ")}.`);
      }
      const existingDates = new Set(
        data.daily_sales
          .filter((sale) => dates.includes(sale.date))
          .map((sale) => sale.date),
      );

      if (existingDates.size && !overwrite) {
        throw new Error(`Duplicate dates found: ${Array.from(existingDates).sort().join(", ")}. Enable overwrite to replace them.`);
      }

      const dailyRows = entries.map((entry) => {
        const totalSales =
          entry.grocery_sales +
          entry.deli_sales +
          entry.hot_food_sales +
          entry.lottery_sales +
          entry.beer_sales +
          entry.cigarette_sales +
          entry.other_sales;

        return {
          user_id: user.id,
          store_id: store.id,
          date: entry.date,
          inside_sales: totalSales,
          fuel_gallons_sold: entry.fuel_gallons_sold,
          fuel_retail_price: entry.fuel_price_per_gallon,
          fuel_cost_per_gallon: entry.fuel_cost_per_gallon,
          lottery_sales: entry.lottery_sales,
          lottery_payouts: 0,
          deli_sales: entry.deli_sales,
          hot_food_sales: entry.hot_food_sales,
          cigarette_sales: entry.cigarette_sales,
          beer_sales: entry.beer_sales,
          grocery_sales: entry.grocery_sales,
          other_sales: entry.other_sales,
          cash_total: entry.cash_total,
          card_total: entry.card_total,
          expenses: entry.expenses,
          payroll: entry.payroll,
          notes: entry.notes,
        };
      });

      const { error: salesError } = overwrite
        ? await supabase.from("daily_sales").upsert(dailyRows, { onConflict: "user_id,store_id,date" })
        : await supabase.from("daily_sales").insert(dailyRows);

      if (salesError) {
        setError(salesError.message);
        throw salesError;
      }

      if (overwrite && dates.length) {
        const { error: expenseDeleteError } = await supabase
          .from("expenses")
          .delete()
          .eq("user_id", user.id)
          .eq("store_id", store.id)
          .in("date", dates)
          .like("notes", "Bulk monthly entry%");

        if (expenseDeleteError) {
          setError(expenseDeleteError.message);
          throw expenseDeleteError;
        }

        const { error: payrollDeleteError } = await supabase
          .from("payroll_entries")
          .delete()
          .eq("user_id", user.id)
          .eq("store_id", store.id)
          .in("date_range_start", dates)
          .like("notes", "Bulk monthly entry%");

        if (payrollDeleteError) {
          setError(payrollDeleteError.message);
          throw payrollDeleteError;
        }
      }

      const expenseRows = entries
        .filter((entry) => entry.expenses > 0)
        .map((entry) => ({
          user_id: user.id,
          store_id: store.id,
          date: entry.date,
          vendor_name: "Bulk monthly entry",
          category: "Other",
          amount: entry.expenses,
          payment_method: "Other",
          notes: `Bulk monthly entry expenses for ${entry.date}`,
        }));

      if (expenseRows.length) {
        const { error: expenseError } = await supabase.from("expenses").insert(expenseRows);
        if (expenseError) {
          setError(expenseError.message);
          throw expenseError;
        }
      }

      const payrollRows = entries
        .filter((entry) => entry.payroll > 0)
        .map((entry) => ({
          user_id: user.id,
          store_id: store.id,
          employee_name: "Bulk monthly payroll",
          date_range_start: entry.date,
          date_range_end: entry.date,
          hours_worked: 1,
          hourly_rate: entry.payroll,
          notes: `Bulk monthly entry payroll for ${entry.date}`,
        }));

      if (payrollRows.length) {
        const { error: payrollError } = await supabase.from("payroll_entries").insert(payrollRows);
        if (payrollError) {
          setError(payrollError.message);
          throw payrollError;
        }
      }

      await refresh();
    },
    [data.daily_sales, refresh, store, user],
  );

  const saveMonthlyTotal = useCallback(
    async (
      payload: Omit<MonthlyTotal, "id" | "user_id" | "store_id" | "created_at" | "updated_at">,
      id?: string,
    ) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !store) {
        throw new Error("You must be signed in before saving monthly totals.");
      }

      if (payload.month < 1 || payload.month > 12) {
        throw new Error("Month must be between 1 and 12.");
      }

      const dbPayload = {
        ...payload,
        user_id: user.id,
        store_id: store.id,
      };
      const result = id
        ? await supabase.from("monthly_totals").update(dbPayload).eq("id", id).eq("user_id", user.id)
        : await supabase.from("monthly_totals").insert(dbPayload);

      if (result.error) {
        setError(result.error.message);
        throw result.error;
      }

      await refresh();
    },
    [refresh, store, user],
  );

  const deleteMonthlyTotal = useCallback(
    async (id: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) {
        throw new Error("You must be signed in before deleting monthly totals.");
      }

      const { error: deleteError } = await supabase
        .from("monthly_totals")
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

  const saveResource = useCallback(
    async <T extends ResourceTableName>(table: T, payload: ResourcePayload<T>, id?: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !store) {
        throw new Error("You must be signed in before saving records.");
      }

      const dbPayload = { ...payload, user_id: user.id, store_id: store.id };
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

  const deleteResource = useCallback(
    async <T extends ResourceTableName>(table: T, id: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) throw new Error("You must be signed in before deleting records.");
      const { error: deleteError } = await supabase.from(table).delete().eq("id", id).eq("user_id", user.id);
      if (deleteError) {
        setError(deleteError.message);
        throw deleteError;
      }
      await refresh();
    },
    [refresh, user],
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

  const savePosColumnMapping = useCallback(
    async (posKey: PosSystemKey, templateName: string, mapping: PosMapping, id?: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const activeUser = sessionData.session?.user ?? user;
      if (!activeUser) {
        throw new Error("You must be signed in before saving POS mappings.");
      }
      let activeStore = store?.user_id === activeUser.id ? store : null;
      if (!activeStore) {
        const { data: stores, error: storesError } = await supabase
          .from("stores")
          .select("*")
          .eq("user_id", activeUser.id)
          .order("created_at", { ascending: true });
        if (storesError) throw storesError;
        activeStore = (stores?.[0] as Store | undefined) ?? null;
      }
      if (!activeStore) {
        const { data: newStore, error: newStoreError } = await supabase
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
        if (newStoreError) throw newStoreError;
        activeStore = newStore as Store;
      }

      const payload = {
        user_id: activeUser.id,
        store_id: activeStore.id,
        pos_key: posKey,
        template_name: templateName.trim() || "Default mapping",
        mapping,
        is_default: false,
        notes: null,
      };

      const result = id
        ? await supabase.from("pos_column_mappings").update(payload).eq("id", id).eq("user_id", activeUser.id)
        : await supabase
          .from("pos_column_mappings")
          .upsert(payload, { onConflict: "user_id,store_id,pos_key,template_name" });

      if (result.error) {
        setError(result.error.message);
        throw result.error;
      }

      await refresh();
    },
    [refresh, store, user],
  );

  const savePosImport = useCallback(
    async ({
      duplicateStrategy,
      fileHash,
      fileName,
      fileSize,
      fileType,
      mappingTemplateName,
      posKey,
      posName,
      rows,
    }: {
      posKey: PosSystemKey;
      posName: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      fileHash: string;
      mappingTemplateName: string | null;
      duplicateStrategy: "skip" | "overwrite";
      rows: PosPreviewRow[];
    }) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const activeUser = sessionData.session?.user ?? user;
      if (!activeUser) {
        throw new Error("You must be signed in before saving POS imports.");
      }
      let activeStore = store?.user_id === activeUser.id ? store : null;
      if (!activeStore) {
        const { data: stores, error: storesError } = await supabase
          .from("stores")
          .select("*")
          .eq("user_id", activeUser.id)
          .order("created_at", { ascending: true });
        if (storesError) throw storesError;
        activeStore = (stores?.[0] as Store | undefined) ?? null;
      }
      if (!activeStore) {
        const { data: newStore, error: newStoreError } = await supabase
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
        if (newStoreError) throw newStoreError;
        activeStore = newStore as Store;
      }

      const rowsWithHardErrors = rows.filter((row) =>
        row.import_action !== "skip" &&
        row.validation_errors.some((message) => !message.startsWith("Duplicate POS")),
      );
      if (rowsWithHardErrors.length) {
        throw new Error(`Fix validation errors before saving. First bad row: ${rowsWithHardErrors[0].row_index}.`);
      }

      const candidateRows = rows.filter((row) => row.import_action !== "skip");
      if (!candidateRows.length) {
        throw new Error("No POS rows selected for import.");
      }

      const candidateDuplicateKeys = candidateRows.map((row) => row.duplicate_key);
      const { data: existingDuplicateRows, error: duplicateLookupError } = await supabase
        .from("pos_import_rows")
        .select("duplicate_key")
        .eq("user_id", activeUser.id)
        .eq("store_id", activeStore.id)
        .eq("pos_key", posKey)
        .in("duplicate_key", candidateDuplicateKeys);

      if (duplicateLookupError) {
        setError(duplicateLookupError.message);
        throw duplicateLookupError;
      }

      const existingDuplicateKeys = new Set((existingDuplicateRows ?? []).map((row: { duplicate_key: string }) => row.duplicate_key));
      const rowsToSave = duplicateStrategy === "skip"
        ? candidateRows.filter((row) => !existingDuplicateKeys.has(row.duplicate_key))
        : candidateRows;

      if (!rowsToSave.length) {
        await refresh();
        return;
      }

      const duplicateKeys = rowsToSave.map((row) => row.duplicate_key);
      if (duplicateStrategy === "overwrite" && duplicateKeys.length) {
        const { error: deleteError } = await supabase
          .from("pos_import_rows")
          .delete()
          .eq("user_id", activeUser.id)
          .eq("store_id", activeStore.id)
          .eq("pos_key", posKey)
          .in("duplicate_key", duplicateKeys);

        if (deleteError) {
          setError(deleteError.message);
          throw deleteError;
        }
      }

      const { data: importRecord, error: importError } = await supabase
        .from("pos_imports")
        .insert({
          user_id: activeUser.id,
          store_id: activeStore.id,
          pos_key: posKey,
          pos_name: posName,
          original_file_name: fileName,
          file_type: fileType,
          file_size: fileSize,
          file_hash: fileHash,
          row_count: rows.length,
          imported_row_count: rowsToSave.length,
          status: "imported",
          duplicate_strategy: duplicateStrategy,
          mapping_template_name: mappingTemplateName,
          metadata: {
            skipped_rows: rows.filter((row) => row.import_action === "skip").length,
            validation_error_rows: rows.filter((row) => row.validation_errors.length).length,
          },
        })
        .select("*")
        .single();

      if (importError) {
        setError(importError.message);
        throw importError;
      }

      const posImportId = importRecord.id as string;
      const { error: rowsError } = await supabase.from("pos_import_rows").insert(
        rowsToSave.map((row) => ({
          ...row,
          pos_import_id: posImportId,
          user_id: activeUser.id,
          store_id: activeStore.id,
          import_action: duplicateStrategy === "overwrite" ? "overwrite" : row.import_action,
        })),
      );

      if (rowsError) {
        setError(rowsError.message);
        throw rowsError;
      }

      await refresh();
    },
    [refresh, store, user],
  );

  const updateProfile = useCallback(
    async (payload: Partial<Pick<UserProfile, "full_name" | "selected_store_id">>) => {
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

  const selectStore = useCallback(
    async (storeId: string) => {
      if (!stores.some((candidate) => candidate.id === storeId)) {
        throw new Error("You do not have access to that store.");
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(selectedStoreStorageKey, storeId);
      }

      const supabase = getSupabaseBrowserClient();
      if (supabase && user) {
        const { error: updateError } = await supabase
          .from("users")
          .update({ selected_store_id: storeId })
          .eq("id", user.id);

        if (updateError) {
          console.warn("Unable to persist selected store:", updateError.message);
        }
      }

      await refresh();
    },
    [refresh, stores, user],
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

  const createStore = useCallback(
    async (payload: Partial<Omit<Store, "id" | "user_id">>) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) {
        throw new Error("You must be signed in to create a store.");
      }

      const { data: newStore, error: insertError } = await supabase
        .from("stores")
        .insert({
          user_id: user.id,
          name: payload.name || "New Convenience Store",
          address: payload.address ?? null,
          city: payload.city ?? null,
          state: payload.state ?? null,
          zip: payload.zip ?? null,
        })
        .select("*")
        .single();

      if (insertError) {
        setError(insertError.message);
        throw insertError;
      }

      if (newStore?.id && typeof window !== "undefined") {
        window.localStorage.setItem(selectedStoreStorageKey, newStore.id);
      }

      await refresh();
    },
    [refresh, user],
  );

  const value = useMemo<CommandCenterContextValue>(
    () => ({
      user,
      profile,
      store,
      stores,
      data,
      authLoading,
      loading,
      error,
      refresh,
      saveEntry,
      saveBulkMonthlyEntries,
      saveMonthlyTotal,
      deleteMonthlyTotal,
      deleteEntry,
      saveResource,
      deleteResource,
      saveSmartImport,
      savePosColumnMapping,
      savePosImport,
      updateProfile,
      updateStore,
      createStore,
      selectStore,
    }),
    [
      createStore,
      data,
      deleteEntry,
      deleteMonthlyTotal,
      deleteResource,
      error,
      authLoading,
      loading,
      profile,
      refresh,
      saveEntry,
      saveMonthlyTotal,
      saveResource,
      saveBulkMonthlyEntries,
      saveSmartImport,
      savePosColumnMapping,
      savePosImport,
      selectStore,
      store,
      stores,
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
