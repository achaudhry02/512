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
import { defaultMarginSettings } from "@/lib/margin-settings";
import { buildSampleStoreData } from "@/lib/onboarding";
import { canPerformAction, roleForStore, type PermissionAction } from "@/lib/permissions";
import { devInfo } from "@/lib/dev-log";
import { planPosDuplicateImport, type PosMapping, type PosPreviewRow } from "@/lib/pos-import";
import { normalizedRuleKey, rowGrossProfit, rowGrossSales, rowMarginPercent } from "@/lib/smart-import";
import type {
  BulkMonthlyEntry,
  CommandCenterData,
  ImportRecord,
  ImportRow,
  InventoryAdjustmentType,
  MonthlyTotal,
  ParsedImportResult,
  ParsedImportRow,
  PosSystemKey,
  ResourceRowMap,
  ResourceTableName,
  Store,
  StoreMember,
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
  "daily_close_statuses",
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
  "cash_flow_entries",
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
  "cash_flow_entries",
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

const inventoryOperationTableNames = [
  "purchase_orders",
  "purchase_order_items",
  "inventory_adjustments",
  "price_history",
  "vendor_item_costs",
] as const;

const resourceTableNames: ResourceTableName[] = ["products", "vendors", "employees"];

function orderColumnForTable(table: TableName) {
  if (table === "payroll_entries") return "date_range_start";
  if (table === "monthly_totals") return "year";
  if (table === "fuel_grades") return "sort_order";
  if (table === "margin_settings") return "category";
  if (table === "daily_close_statuses") return "date";
  return "date";
}

const emptyData: CommandCenterData = {
  daily_sales: [],
  monthly_totals: [],
  cash_reconciliations: [],
  daily_close_statuses: [],
  store_members: [],
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
  cash_flow_entries: [],
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
  purchase_orders: [],
  purchase_order_items: [],
  inventory_adjustments: [],
  price_history: [],
  vendor_item_costs: [],
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
  role: UserRole;
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
  rollbackSmartImport: (importId: string) => Promise<void>;
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
  createPurchaseOrder: (payload: {
    vendorId: string;
    expectedDate: string | null;
    notes: string | null;
    items: { productId: string; quantity: number; unitCost: number }[];
  }) => Promise<void>;
  receivePurchaseOrder: (id: string) => Promise<void>;
  cancelPurchaseOrder: (id: string) => Promise<void>;
  saveInventoryAdjustment: (payload: {
    productId: string;
    adjustmentType: InventoryAdjustmentType;
    quantityDelta: number;
    unitCost?: number | null;
    reason?: string | null;
    notes?: string | null;
    adjustmentDate?: string;
  }) => Promise<void>;
  saveDefaultMargins: () => Promise<void>;
  seedSampleData: () => Promise<void>;
  inviteStoreMember: (email: string, role: UserRole) => Promise<void>;
  updateStoreMemberRole: (id: string, role: UserRole) => Promise<void>;
  removeStoreMember: (id: string) => Promise<void>;
};

const CommandCenterContext = createContext<CommandCenterContextValue | undefined>(undefined);

function normalizedVendor(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() || "unknown vendor";
}

function normalizeRole(role: unknown): UserRole {
  return role === "manager" || role === "employee" || role === "accountant" ? role : "owner";
}

function actionForTable(table: TableName): PermissionAction {
  if (table === "daily_sales") return "edit_daily_sales";
  if (table === "cash_reconciliations") return "edit_cash_reconciliation";
  if (table === "daily_close_statuses") return "close_day";
  if (["monthly_totals", "expenses", "payroll_entries", "cash_flow_entries"].includes(table)) return "edit_financials";
  return "edit_operations";
}

function isUnavailableOptionalTable(error: { code?: string; message?: string }) {
  return error.code === "42P01"
    || error.code === "PGRST205"
    || error.message?.includes("Could not find the table") === true;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function rowDate(row: ParsedImportRow) {
  return row.date || new Date().toISOString().slice(0, 10);
}

function rowAmount(row: ParsedImportRow) {
  return row.total || row.quantity * (row.unitRetailPrice || row.unitCost);
}

function rowDuplicateKey(row: ParsedImportRow) {
  const date = row.date ?? "no-date";
  const vendor = normalizedVendor(row.vendor || "unknown");
  const amount = rowAmount(row).toFixed(2);
  const invoice = String(row.rawData.invoice_number ?? row.rawData.invoice ?? row.rawData["invoice #"] ?? "").trim();
  const bankTransaction = String(
    row.rawData.transaction_id ?? row.rawData.transaction ?? row.rawData["transaction id"] ?? row.rawData.check_number ?? "",
  ).trim();

  if (invoice) return `invoice:${vendor}:${invoice}`;
  if (bankTransaction) return `bank:${vendor}:${bankTransaction}`;
  return `vendor-date-amount:${vendor}:${date}:${amount}`;
}

function importRowPayload(row: ParsedImportRow, importId: string, userId: string, storeId: string): Omit<ImportRow, "id"> {
  const ignored = row.ignored || row.importDestination === "ignore";
  const rowStatus = row.rowStatus ?? (
    ignored ? "ignored" : row.duplicateReason ? "duplicate" : row.needsReview || row.importDestination === "needs_review" ? "draft" : "reviewed"
  );

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
    ignored,
    row_status: rowStatus,
    duplicate_key: row.duplicateKey ?? rowDuplicateKey(row),
    duplicate_reason: row.duplicateReason ?? null,
    reviewed_at: rowStatus === "reviewed" || rowStatus === "posted" ? new Date().toISOString() : null,
    posted_at: null,
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
    status: "posted",
    metadata: {
      parser: parsedImport.parser,
      warnings: parsedImport.warnings,
      file_hash: parsedImport.fileHash,
      posted_records: [],
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
  const [role, setRole] = useState<UserRole>("owner");
  const [store, setStore] = useState<Store | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [data, setData] = useState<CommandCenterData>(emptyData);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requireAction = useCallback((action: PermissionAction) => {
    if (!canPerformAction(role, action)) throw new Error(`Your ${role} role cannot perform this action.`);
  }, [role]);

  const loadSupabaseData = useCallback(async (activeUser: User | null) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setUser(null);
      setProfile(null);
      setRole("owner");
      setStore(null);
      setStores([]);
      setData(emptyData);
      setError("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      setAuthLoading(false);
      setLoading(false);
      return;
    }

    if (!activeUser) {
      devInfo("[auth] no active Supabase session");
      setUser(activeUser);
      setProfile(null);
      setRole("owner");
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
    devInfo("[auth] active Supabase session", {
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

      const { data: existingProfile, error: profileLookupError } = await supabase
        .from("users")
        .select("*")
        .eq("id", activeUser.id)
        .maybeSingle();

      if (profileLookupError) {
        throw profileLookupError;
      }

      let profileRow = existingProfile as UserProfile | null;
      if (!profileRow) {
        const { data: insertedProfile, error: profileInsertError } = await supabase
          .from("users")
          .insert(profilePayload)
          .select("*")
          .single();
        if (profileInsertError) throw profileInsertError;
        profileRow = insertedProfile as UserProfile;
      }

      if (activeUser.email) {
        const { error: claimError } = await supabase
          .from("store_members")
          .update({ user_id: activeUser.id, accepted_at: new Date().toISOString() })
          .is("user_id", null)
          .ilike("invited_email", activeUser.email);
        if (claimError && !isUnavailableOptionalTable(claimError)) throw claimError;
      }

      const storesResponse = await supabase
        .from("stores")
        .select("*")
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
        if (newStore) {
          await supabase.from("store_members").upsert({
            user_id: activeUser.id,
            store_id: newStore.id,
            role: "owner",
            invited_email: activeUser.email ?? null,
            accepted_at: new Date().toISOString(),
          }, { onConflict: "user_id,store_id" });
        }
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
        const { data: memberRows, error: memberError } = await supabase
          .from("store_members")
          .select("*")
          .eq("store_id", activeStore.id)
          .order("created_at", { ascending: true });
        if (memberError && !isUnavailableOptionalTable(memberError)) throw memberError;
        nextData.store_members = (memberRows ?? []) as StoreMember[];

        const tableResults = await Promise.all(
          tableNames.map(async (table) => {
            let query = supabase
              .from(table)
              .select("*")
              .eq("store_id", activeStore.id)
              .order(orderColumnForTable(table), { ascending: false });

            if (table === "monthly_totals") {
              query = query.order("month", { ascending: false });
            }

            const { data: rows, error: tableError } = await query;

            if (tableError && table === "daily_close_statuses" && isUnavailableOptionalTable(tableError)) {
              return [table, []] as const;
            }
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

        const inventoryOperationResults = await Promise.all(
          inventoryOperationTableNames.map(async (table) => {
            const orderColumn =
              table === "purchase_orders"
                ? "order_date"
                : table === "purchase_order_items"
                  ? "created_at"
                  : table === "inventory_adjustments"
                    ? "adjustment_date"
                    : table === "price_history"
                      ? "changed_at"
                      : "effective_date";
            const { data: rows, error: tableError } = await supabase
              .from(table)
              .select("*")
              .eq("store_id", activeStore.id)
              .order(orderColumn, { ascending: false });

            if (tableError) {
              if (isUnavailableOptionalTable(tableError)) {
                devInfo(`[inventory] ${table} is unavailable until the Phase 7 schema is applied.`);
                return [table, []] as const;
              }
              throw tableError;
            }
            return [table, rows ?? []] as const;
          }),
        );

        for (const [table, rows] of inventoryOperationResults) {
          nextData[table] = rows as never;
        }

        const resourceResults = await Promise.all(
          resourceTableNames
            .filter((table) => table === "employees")
            .map(async (table) => {
              const { data: rows, error: tableError } = await supabase
                .from(table)
                .select("*")
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
      const membership = nextData.store_members.find((member) => member.user_id === activeUser.id && member.accepted_at);
      setRole(activeStore ? roleForStore(activeUser.id, activeStore.user_id, membership?.role) : "employee");
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
      setError(errorMessage(loadError, "Unable to load store data."));
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
    devInfo("[auth] refresh getSession", {
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
      devInfo("[auth] initial getSession", {
        hasSession: Boolean(sessionData.session),
        userId: sessionData.session?.user.id ?? null,
      });
      if (mounted) {
        void loadSupabaseData(sessionData.session?.user ?? null);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      devInfo("[auth] onAuthStateChange", {
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
      requireAction(actionForTable(table));
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
        ? await supabase.from(table).update(dbPayload).eq("id", id).eq("store_id", store.id)
        : await supabase.from(table).insert(dbPayload);

      if (result.error) {
        setError(result.error.message);
        throw result.error;
      }

      await refresh();
    },
    [refresh, requireAction, store, user],
  );

  const saveBulkMonthlyEntries = useCallback(
    async (entries: BulkMonthlyEntry[], overwrite: boolean) => {
      requireAction("edit_daily_sales");
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
    [data.daily_sales, refresh, requireAction, store, user],
  );

  const saveMonthlyTotal = useCallback(
    async (
      payload: Omit<MonthlyTotal, "id" | "user_id" | "store_id" | "created_at" | "updated_at">,
      id?: string,
    ) => {
      requireAction("edit_financials");
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
        ? await supabase.from("monthly_totals").update(dbPayload).eq("id", id).eq("store_id", store.id)
        : await supabase.from("monthly_totals").insert(dbPayload);

      if (result.error) {
        setError(result.error.message);
        throw result.error;
      }

      await refresh();
    },
    [refresh, requireAction, store, user],
  );

  const deleteMonthlyTotal = useCallback(
    async (id: string) => {
      requireAction("delete_records");
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) {
        throw new Error("You must be signed in before deleting monthly totals.");
      }

      const { error: deleteError } = await supabase
        .from("monthly_totals")
        .delete()
        .eq("id", id)
        .eq("store_id", store?.id ?? "");

      if (deleteError) {
        setError(deleteError.message);
        throw deleteError;
      }

      await refresh();
    },
    [refresh, requireAction, store?.id, user],
  );

  const saveResource = useCallback(
    async <T extends ResourceTableName>(table: T, payload: ResourcePayload<T>, id?: string) => {
      requireAction(table === "employees" ? "manage_members" : "manage_inventory");
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !store) {
        throw new Error("You must be signed in before saving records.");
      }

      const dbPayload = { ...payload, user_id: user.id, store_id: store.id };
      const result = id
        ? await supabase.from(table).update(dbPayload).eq("id", id).eq("store_id", store.id)
        : await supabase.from(table).insert(dbPayload);

      if (result.error) {
        setError(result.error.message);
        throw result.error;
      }
      await refresh();
    },
    [refresh, requireAction, store, user],
  );

  const deleteResource = useCallback(
    async <T extends ResourceTableName>(table: T, id: string) => {
      requireAction(table === "employees" ? "manage_members" : "manage_inventory");
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) throw new Error("You must be signed in before deleting records.");
      const { error: deleteError } = await supabase.from(table).delete().eq("id", id).eq("store_id", store?.id ?? "");
      if (deleteError) {
        setError(deleteError.message);
        throw deleteError;
      }
      await refresh();
    },
    [refresh, requireAction, store?.id, user],
  );

  const createPurchaseOrder = useCallback(
    async ({
      expectedDate,
      items,
      notes,
      vendorId,
    }: {
      vendorId: string;
      expectedDate: string | null;
      notes: string | null;
      items: { productId: string; quantity: number; unitCost: number }[];
    }) => {
      requireAction("manage_inventory");
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !store) {
        throw new Error("You must be signed in before creating a purchase order.");
      }
      if (!data.vendors.some((vendor) => vendor.id === vendorId)) {
        throw new Error("Select a valid vendor.");
      }
      if (!items.length) throw new Error("Add at least one item to the purchase order.");
      if (new Set(items.map((item) => item.productId)).size !== items.length) {
        throw new Error("Each product can appear only once on a purchase order.");
      }
      if (items.some((item) => item.quantity <= 0 || item.unitCost < 0)) {
        throw new Error("Purchase order quantities must be positive and costs cannot be negative.");
      }

      const now = new Date();
      const poNumber = `PO-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${now.getTime().toString().slice(-6)}`;
      const totalCost = items.reduce((total, item) => total + item.quantity * item.unitCost, 0);
      const { data: order, error: orderError } = await supabase
        .from("purchase_orders")
        .insert({
          user_id: user.id,
          store_id: store.id,
          vendor_id: vendorId,
          po_number: poNumber,
          status: "ordered",
          order_date: now.toISOString().slice(0, 10),
          expected_date: expectedDate,
          total_cost: totalCost,
          notes,
        })
        .select("id")
        .single();

      if (orderError || !order?.id) {
        const failure = orderError ?? new Error("Purchase order was not created.");
        setError(failure.message);
        throw failure;
      }

      const itemRows = items.map((item) => {
        const product = data.products.find((candidate) => candidate.id === item.productId);
        if (!product) throw new Error("A selected inventory product no longer exists.");
        return {
          user_id: user.id,
          store_id: store.id,
          purchase_order_id: order.id,
          product_id: product.id,
          product_name: product.name,
          sku_upc: product.sku_upc,
          ordered_quantity: item.quantity,
          received_quantity: 0,
          unit_cost: item.unitCost,
        };
      });
      const { error: itemError } = await supabase.from("purchase_order_items").insert(itemRows);
      if (itemError) {
        await supabase.from("purchase_orders").delete().eq("id", order.id).eq("store_id", store.id);
        setError(itemError.message);
        throw itemError;
      }
      await refresh();
    },
    [data.products, data.vendors, refresh, requireAction, store, user],
  );

  const receivePurchaseOrder = useCallback(
    async (id: string) => {
      requireAction("manage_inventory");
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) throw new Error("You must be signed in before receiving inventory.");
      const { error: receiveError } = await supabase.rpc("receive_purchase_order", {
        p_purchase_order_id: id,
      });
      if (receiveError) {
        setError(receiveError.message);
        throw receiveError;
      }
      await refresh();
    },
    [refresh, requireAction, user],
  );

  const cancelPurchaseOrder = useCallback(
    async (id: string) => {
      requireAction("manage_inventory");
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) throw new Error("You must be signed in before cancelling a purchase order.");
      const { error: cancelError } = await supabase
        .from("purchase_orders")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("store_id", store?.id ?? "")
        .in("status", ["draft", "ordered", "partially_received"]);
      if (cancelError) {
        setError(cancelError.message);
        throw cancelError;
      }
      await refresh();
    },
    [refresh, requireAction, store?.id, user],
  );

  const saveInventoryAdjustment = useCallback(
    async ({
      adjustmentDate,
      adjustmentType,
      notes,
      productId,
      quantityDelta,
      reason,
      unitCost,
    }: {
      productId: string;
      adjustmentType: InventoryAdjustmentType;
      quantityDelta: number;
      unitCost?: number | null;
      reason?: string | null;
      notes?: string | null;
      adjustmentDate?: string;
    }) => {
      requireAction("manage_inventory");
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) throw new Error("You must be signed in before adjusting inventory.");
      if (!Number.isFinite(quantityDelta) || quantityDelta === 0) {
        throw new Error("Adjustment quantity cannot be zero.");
      }
      const { error: adjustmentError } = await supabase.rpc("record_inventory_adjustment", {
        p_product_id: productId,
        p_adjustment_type: adjustmentType,
        p_quantity_delta: quantityDelta,
        p_unit_cost: unitCost ?? null,
        p_reason: reason ?? null,
        p_notes: notes ?? null,
        p_adjustment_date: adjustmentDate ?? new Date().toISOString().slice(0, 10),
      });
      if (adjustmentError) {
        setError(adjustmentError.message);
        throw adjustmentError;
      }
      await refresh();
    },
    [refresh, requireAction, user],
  );

  const deleteEntry = useCallback(
    async <T extends TableName>(table: T, id: string) => {
      requireAction("delete_records");
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) {
        throw new Error("You must be signed in before deleting entries.");
      }

      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq("id", id)
        .eq("store_id", store?.id ?? "");

      if (deleteError) {
        setError(deleteError.message);
        throw deleteError;
      }

      await refresh();
    },
    [refresh, requireAction, store?.id, user],
  );

  const saveSmartImport = useCallback(
    async (parsedImport: ParsedImportResult, rows: ParsedImportRow[]) => {
      requireAction("manage_imports");
      const existingDuplicateKeys = new Set(data.import_rows.map((row) => row.duplicate_key).filter(Boolean));
      const acceptedRows = rows.filter((row) => {
        const duplicateKey = row.duplicateKey ?? rowDuplicateKey(row);
        return (
          !row.ignored &&
          row.importDestination !== "ignore" &&
          row.importDestination !== "needs_review" &&
          !row.duplicateReason &&
          !existingDuplicateKeys.has(duplicateKey)
        );
      });

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
      devInfo("[auth] smart import getSession", {
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
      const postedRecords: Array<{ table: string; id: string; row_hash: string }> = [];

      function recordPosted(table: string, id: string | undefined, row: ParsedImportRow) {
        if (id) {
          postedRecords.push({ table, id, row_hash: row.rowHash });
        }
      }

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
          const { data: expense, error: expenseError } = await supabase.from("expenses").insert({
            user_id: userId,
            store_id: storeId,
            date,
            vendor_name: row.vendor || "Imported vendor",
            category: row.suggestedCategory,
            amount,
            payment_method: "Other",
            notes: `Imported from ${parsedImport.fileName}: ${row.description}`,
          }).select("id").single();
          if (expenseError) {
            console.error("Smart Import expenses insert failed:", expenseError, { row, userId, storeId });
            throw expenseError;
          }
          recordPosted("expenses", expense?.id as string | undefined, row);
        } else if (row.importDestination === "fuel_entries") {
          const { data: fuelEntry, error: fuelError } = await supabase.from("fuel_entries").insert({
            user_id: userId,
            store_id: storeId,
            date,
            gallons_sold: row.quantity,
            cost_per_gallon: row.unitCost,
            retail_price_per_gallon: row.unitRetailPrice,
            notes: `Imported from ${parsedImport.fileName}: ${row.description}`,
          }).select("id").single();
          if (fuelError) {
            console.error("Smart Import fuel_entries insert failed:", fuelError, { row, userId, storeId });
            throw fuelError;
          }
          recordPosted("fuel_entries", fuelEntry?.id as string | undefined, row);
        } else if (row.importDestination === "lottery_entries") {
          const { data: lotteryEntry, error: lotteryError } = await supabase.from("lottery_entries").insert({
            user_id: userId,
            store_id: storeId,
            date,
            lottery_sales: amount,
            lottery_payouts: 0,
            commission_percentage: 6,
            notes: `Imported from ${parsedImport.fileName}: ${row.description}`,
          }).select("id").single();
          if (lotteryError) {
            console.error("Smart Import lottery_entries insert failed:", lotteryError, { row, userId, storeId });
            throw lotteryError;
          }
          recordPosted("lottery_entries", lotteryEntry?.id as string | undefined, row);
        } else if (row.importDestination === "deli_entries") {
          const { data: deliEntry, error: deliError } = await supabase.from("deli_entries").insert({
            user_id: userId,
            store_id: storeId,
            date,
            deli_sales: amount,
            food_cost: row.quantity * row.unitCost,
            waste_amount: 0,
            notes: `Imported from ${parsedImport.fileName}: ${row.description}`,
          }).select("id").single();
          if (deliError) {
            console.error("Smart Import deli_entries insert failed:", deliError, { row, userId, storeId });
            throw deliError;
          }
          recordPosted("deli_entries", deliEntry?.id as string | undefined, row);
        } else if (row.importDestination === "payroll_entries") {
          const { data: payrollEntry, error: payrollError } = await supabase.from("payroll_entries").insert({
            user_id: userId,
            store_id: storeId,
            employee_name: row.description || row.vendor || "Imported payroll",
            date_range_start: date,
            date_range_end: date,
            hours_worked: row.quantity,
            hourly_rate: row.unitCost || row.unitRetailPrice,
            notes: `Imported from ${parsedImport.fileName}`,
          }).select("id").single();
          if (payrollError) {
            console.error("Smart Import payroll_entries insert failed:", payrollError, { row, userId, storeId });
            throw payrollError;
          }
          recordPosted("payroll_entries", payrollEntry?.id as string | undefined, row);
        } else if (row.importDestination === "cash_flow_entries") {
          const cashFlowType = row.suggestedCategory === "Card processor deposit"
            ? "card_processor_deposit"
            : row.suggestedCategory === "Cash deposit"
              ? "cash_deposit"
              : row.suggestedCategory === "Loan payment"
                ? "loan_payment"
                : row.suggestedCategory === "Owner draw"
                  ? "owner_draw"
                  : row.suggestedCategory === "Transfer"
                    ? "transfer"
                    : row.suggestedCategory === "Fees"
                      ? "fee"
                      : "other";
          const { data: cashFlowEntry, error: cashFlowError } = await supabase.from("cash_flow_entries").insert({
            user_id: userId,
            store_id: storeId,
            import_id: importId,
            import_row_id: importRowId,
            date,
            flow_type: cashFlowType,
            vendor_name: row.vendor || null,
            description: row.description || null,
            amount,
            notes: `Imported from ${parsedImport.fileName}`,
          }).select("id").single();
          if (cashFlowError) {
            console.error("Smart Import cash_flow_entries insert failed:", cashFlowError, { row, userId, storeId });
            throw cashFlowError;
          }
          recordPosted("cash_flow_entries", cashFlowEntry?.id as string | undefined, row);
        } else if (row.importDestination === "department_sales") {
          const raw = row.rawData;
          const { data: departmentSale, error: departmentError } = await supabase.from("department_sales").insert({
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
          }).select("id").single();
          if (departmentError) {
            console.error("Smart Import department_sales insert failed:", departmentError, { row, userId, storeId });
            throw departmentError;
          }
          recordPosted("department_sales", departmentSale?.id as string | undefined, row);
        } else if (row.importDestination === "store_sales_summaries") {
          const raw = row.rawData;
          const { data: storeSummary, error: summaryError } = await supabase.from("store_sales_summaries").insert({
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
          }).select("id").single();
          if (summaryError) {
            console.error("Smart Import store_sales_summaries insert failed:", summaryError, { row, userId, storeId });
            throw summaryError;
          }
          recordPosted("store_sales_summaries", storeSummary?.id as string | undefined, row);
        } else if (row.importDestination === "fuel_grade_sales") {
          const raw = row.rawData;
          const { data: fuelGradeSale, error: fuelGradeError } = await supabase.from("fuel_grade_sales").insert({
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
          }).select("id").single();
          if (fuelGradeError) {
            console.error("Smart Import fuel_grade_sales insert failed:", fuelGradeError, { row, userId, storeId });
            throw fuelGradeError;
          }
          recordPosted("fuel_grade_sales", fuelGradeSale?.id as string | undefined, row);
        } else if (row.importDestination === "tender_sales") {
          const raw = row.rawData;
          const { data: tenderSale, error: tenderError } = await supabase.from("tender_sales").insert({
            user_id: userId,
            store_id: storeId,
            import_id: importId,
            report_start_date: parsedImport.reportStartDate ?? row.date,
            report_end_date: parsedImport.reportEndDate ?? row.date,
            payment_method: String(raw.payment_method ?? row.productName ?? row.description),
            count: Number(raw.count ?? row.quantity ?? 0),
            sales_amount: Number(raw.sales_amount ?? row.total ?? 0),
          }).select("id").single();
          if (tenderError) {
            console.error("Smart Import tender_sales insert failed:", tenderError, { row, userId, storeId });
            throw tenderError;
          }
          recordPosted("tender_sales", tenderSale?.id as string | undefined, row);
        } else if (row.importDestination === "product_sales") {
          const vendor = await ensureVendor(row);
          const category = await ensureCategory(row);
          const product = await ensureProduct(row, vendor.id, category.id);
          const { data: productSale, error: saleError } = await supabase.from("product_sales").insert({
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
          }).select("id").single();
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
          recordPosted("product_sales", productSale?.id as string | undefined, row);
        }
      }

      if (postedRecords.length) {
        const postedAt = new Date().toISOString();
        const { error: rowStatusError } = await supabase
          .from("import_rows")
          .update({ row_status: "posted", posted_at: postedAt, imported_at: postedAt })
          .eq("import_id", importId)
          .in("row_hash", postedRecords.map((record) => record.row_hash));
        if (rowStatusError) {
          console.error("Smart Import import_rows status update failed:", rowStatusError);
          throw rowStatusError;
        }
      }

      const { error: metadataUpdateError } = await supabase
        .from("imports")
        .update({
          status: "posted",
          metadata: {
            ...((importRecord.metadata as Record<string, unknown> | null) ?? {}),
            parser: parsedImport.parser,
            warnings: parsedImport.warnings,
            posted_records: postedRecords,
            posted_at: new Date().toISOString(),
            skipped_duplicate_rows: rows.length - acceptedRows.length,
          },
        })
        .eq("id", importId)
        .eq("store_id", storeId);
      if (metadataUpdateError) {
        console.error("Smart Import imports metadata update failed:", metadataUpdateError);
        throw metadataUpdateError;
      }

      await saveLearnedCorrections();
      await refresh();
    },
    [data.import_rows, data.imports, refresh, requireAction, store, user],
  );

  const rollbackSmartImport = useCallback(
    async (importId: string) => {
      requireAction("manage_imports");
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) {
        throw new Error("You must be signed in before rolling back imports.");
      }

      const importRecord = data.imports.find((record) => record.id === importId);
      if (!importRecord) {
        throw new Error("Import record was not found.");
      }
      if (importRecord.status === "rolled_back") {
        throw new Error("This import has already been rolled back.");
      }

      const metadata = importRecord.metadata ?? {};
      const postedRecords = Array.isArray(metadata.posted_records)
        ? metadata.posted_records.filter(
            (record): record is { table: string; id: string } =>
              typeof record === "object" &&
              record !== null &&
              typeof (record as { table?: unknown }).table === "string" &&
              typeof (record as { id?: unknown }).id === "string",
          )
        : [];
      const allowedRollbackTables = new Set([
        "expenses",
        "fuel_entries",
        "lottery_entries",
        "deli_entries",
        "payroll_entries",
        "cash_flow_entries",
        "department_sales",
        "store_sales_summaries",
        "fuel_grade_sales",
        "tender_sales",
        "product_sales",
      ]);
      const recordsByTable = postedRecords.reduce<Record<string, string[]>>((groups, record) => {
        if (allowedRollbackTables.has(record.table)) {
          groups[record.table] = [...(groups[record.table] ?? []), record.id];
        }
        return groups;
      }, {});

      for (const [table, ids] of Object.entries(recordsByTable)) {
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq("store_id", store?.id ?? "")
          .in("id", ids);
        if (deleteError) {
          setError(deleteError.message);
          throw deleteError;
        }
      }

      for (const table of [
        "cash_flow_entries",
        "department_sales",
        "store_sales_summaries",
        "fuel_grade_sales",
        "tender_sales",
        "product_sales",
      ]) {
        const { error: fallbackDeleteError } = await supabase
          .from(table)
          .delete()
          .eq("store_id", store?.id ?? "")
          .eq("import_id", importId);
        if (fallbackDeleteError) {
          setError(fallbackDeleteError.message);
          throw fallbackDeleteError;
        }
      }

      const rolledBackAt = new Date().toISOString();
      const { error: rowUpdateError } = await supabase
        .from("import_rows")
        .update({ row_status: "rolled_back" })
        .eq("store_id", store?.id ?? "")
        .eq("import_id", importId);
      if (rowUpdateError) {
        setError(rowUpdateError.message);
        throw rowUpdateError;
      }

      const { error: importUpdateError } = await supabase
        .from("imports")
        .update({
          status: "rolled_back",
          metadata: {
            ...metadata,
            rolled_back_at: rolledBackAt,
            rollback_deleted_records: postedRecords.length,
          },
        })
        .eq("id", importId)
        .eq("store_id", store?.id ?? "");
      if (importUpdateError) {
        setError(importUpdateError.message);
        throw importUpdateError;
      }

      await refresh();
    },
    [data.imports, refresh, requireAction, store?.id, user],
  );

  const savePosColumnMapping = useCallback(
    async (posKey: PosSystemKey, templateName: string, mapping: PosMapping, id?: string) => {
      requireAction("manage_imports");
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const activeUser = sessionData.session?.user ?? user;
      if (!activeUser) {
        throw new Error("You must be signed in before saving POS mappings.");
      }
      let activeStore = store;
      if (!activeStore) {
        const { data: stores, error: storesError } = await supabase
          .from("stores")
          .select("*")
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
        ? await supabase.from("pos_column_mappings").update(payload).eq("id", id).eq("store_id", activeStore.id)
        : await supabase
          .from("pos_column_mappings")
          .upsert(payload, { onConflict: "user_id,store_id,pos_key,template_name" });

      if (result.error) {
        setError(result.error.message);
        throw result.error;
      }

      await refresh();
    },
    [refresh, requireAction, store, user],
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
      requireAction("manage_imports");
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const activeUser = sessionData.session?.user ?? user;
      if (!activeUser) {
        throw new Error("You must be signed in before saving POS imports.");
      }
      let activeStore = store;
      if (!activeStore) {
        const { data: stores, error: storesError } = await supabase
          .from("stores")
          .select("*")
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
        .eq("store_id", activeStore.id)
        .eq("pos_key", posKey)
        .in("duplicate_key", candidateDuplicateKeys);

      if (duplicateLookupError) {
        setError(duplicateLookupError.message);
        throw duplicateLookupError;
      }

      const existingDuplicateKeys = new Set((existingDuplicateRows ?? []).map((row: { duplicate_key: string }) => row.duplicate_key));
      const { rowsToSave, duplicateKeysToDelete } = planPosDuplicateImport(
        rows,
        existingDuplicateKeys,
        duplicateStrategy,
      );

      if (!rowsToSave.length) {
        await refresh();
        return;
      }

      if (duplicateStrategy === "overwrite" && duplicateKeysToDelete.length) {
        const { error: deleteError } = await supabase
          .from("pos_import_rows")
          .delete()
          .eq("store_id", activeStore.id)
          .eq("pos_key", posKey)
          .in("duplicate_key", duplicateKeysToDelete);

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
    [refresh, requireAction, store, user],
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
      requireAction("manage_settings");
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !store) {
        throw new Error("You must be signed in to update store settings.");
      }

      const { error: updateError } = await supabase
        .from("stores")
        .update(payload)
        .eq("id", store.id);

      if (updateError) {
        setError(updateError.message);
        throw updateError;
      }

      await refresh();
    },
    [refresh, requireAction, store, user],
  );

  const createStore = useCallback(
    async (payload: Partial<Omit<Store, "id" | "user_id">>) => {
      requireAction("manage_settings");
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

      if (newStore?.id) {
        await supabase.from("store_members").upsert({
          user_id: user.id,
          store_id: newStore.id,
          role: "owner",
          invited_email: user.email ?? null,
          accepted_at: new Date().toISOString(),
        }, { onConflict: "user_id,store_id" });
        const { error: selectionError } = await supabase
          .from("users")
          .update({ selected_store_id: newStore.id })
          .eq("id", user.id);
        if (selectionError) {
          setError(selectionError.message);
          throw selectionError;
        }

        const createdStore = newStore as Store;
        setStores((current) => [...current.filter((candidate) => candidate.id !== createdStore.id), createdStore]);
        setStore(createdStore);
        setData(emptyData);
        setProfile((current) => current ? { ...current, selected_store_id: createdStore.id } : current);
      }
    },
    [requireAction, user],
  );

  const saveDefaultMargins = useCallback(async () => {
    requireAction("manage_settings");
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || !store) {
      throw new Error("Select a store before saving margin settings.");
    }

    const { error: upsertError } = await supabase.from("margin_settings").upsert(
      defaultMarginSettings.map((setting) => ({
        user_id: user.id,
        store_id: store.id,
        category: setting.category,
        gross_margin_percent: setting.gross_margin_percent,
        notes: setting.notes,
      })),
      { onConflict: "user_id,store_id,category" },
    );

    if (upsertError) {
      setError(upsertError.message);
      throw upsertError;
    }

    await refresh();
  }, [refresh, requireAction, store, user]);

  const seedSampleData = useCallback(async () => {
    requireAction("manage_settings");
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || !store) {
      throw new Error("Select a store before adding sample data.");
    }

    const sample = buildSampleStoreData(new Date().toISOString().slice(0, 10));
    const scope = { user_id: user.id, store_id: store.id };
    const insertRows = async (table: string, rows: Record<string, unknown>[]) => {
      const { error: insertError } = await supabase.from(table).insert(rows.map((row) => ({ ...scope, ...row })));
      if (insertError) throw insertError;
    };

    try {
      if (!data.margin_settings.length) {
        await saveDefaultMargins();
      }
      if (!data.daily_sales.length) await insertRows("daily_sales", sample.dailySales);
      if (!data.expenses.length) await insertRows("expenses", sample.expenses);
      if (!data.fuel_entries.length) await insertRows("fuel_entries", sample.fuelEntries);
      if (!data.lottery_entries.length) await insertRows("lottery_entries", sample.lotteryEntries);
      if (!data.deli_entries.length) await insertRows("deli_entries", sample.deliEntries);
      if (!data.fuel_grades.length) await insertRows("fuel_grades", sample.fuelGrades);
      if (!data.vendors.length) await insertRows("vendors", [sample.vendor]);
      if (!data.employees.length) await insertRows("employees", [sample.employee]);
      if (!data.products.length) await insertRows("products", [sample.product]);
    } catch (seedError) {
      const message = errorMessage(seedError, "Unable to add sample data.");
      setError(message);
      throw seedError;
    }

    await refresh();
  }, [data, refresh, requireAction, saveDefaultMargins, store, user]);

  const inviteStoreMember = useCallback(async (email: string, memberRole: UserRole) => {
    requireAction("manage_members");
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || !store) throw new Error("Select a store before inviting members.");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) throw new Error("Enter a valid email address.");
    const { error: inviteError } = await supabase.from("store_members").insert({
      user_id: null,
      store_id: store.id,
      role: memberRole,
      invited_email: normalizedEmail,
      accepted_at: null,
    });
    if (inviteError) throw inviteError;
    await refresh();
  }, [refresh, requireAction, store, user]);

  const updateStoreMemberRole = useCallback(async (id: string, memberRole: UserRole) => {
    requireAction("manage_members");
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !store) throw new Error("Select a store before updating members.");
    const member = data.store_members.find((row) => row.id === id);
    if (!member) throw new Error("Store member was not found.");
    if (member.user_id === store.user_id && memberRole !== "owner") throw new Error("The primary store owner cannot be demoted.");
    const { error: updateError } = await supabase.from("store_members").update({ role: memberRole }).eq("id", id).eq("store_id", store.id);
    if (updateError) throw updateError;
    await refresh();
  }, [data.store_members, refresh, requireAction, store]);

  const removeStoreMember = useCallback(async (id: string) => {
    requireAction("manage_members");
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !store) throw new Error("Select a store before removing members.");
    const member = data.store_members.find((row) => row.id === id);
    if (!member) throw new Error("Store member was not found.");
    if (member.user_id === store.user_id) throw new Error("The primary store owner cannot be removed.");
    const owners = data.store_members.filter((row) => row.role === "owner" && row.accepted_at);
    if (member.role === "owner" && owners.length <= 1) throw new Error("The last owner cannot be removed.");
    const { error: deleteError } = await supabase.from("store_members").delete().eq("id", id).eq("store_id", store.id);
    if (deleteError) throw deleteError;
    await refresh();
  }, [data.store_members, refresh, requireAction, store]);

  const value = useMemo<CommandCenterContextValue>(
    () => ({
      user,
      profile,
      role,
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
      rollbackSmartImport,
      savePosColumnMapping,
      savePosImport,
      updateProfile,
      updateStore,
      createStore,
      selectStore,
      createPurchaseOrder,
      receivePurchaseOrder,
      cancelPurchaseOrder,
      saveInventoryAdjustment,
      saveDefaultMargins,
      seedSampleData,
      inviteStoreMember,
      updateStoreMemberRole,
      removeStoreMember,
    }),
    [
      cancelPurchaseOrder,
      createStore,
      createPurchaseOrder,
      data,
      deleteEntry,
      deleteMonthlyTotal,
      deleteResource,
      error,
      authLoading,
      loading,
      profile,
      role,
      refresh,
      receivePurchaseOrder,
      saveEntry,
      saveMonthlyTotal,
      saveResource,
      saveBulkMonthlyEntries,
      saveInventoryAdjustment,
      saveDefaultMargins,
      seedSampleData,
      inviteStoreMember,
      updateStoreMemberRole,
      removeStoreMember,
      saveSmartImport,
      rollbackSmartImport,
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
