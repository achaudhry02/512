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
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { sampleData, sampleProfile, sampleStore } from "@/lib/sample-data";
import { rowGrossProfit, rowGrossSales, rowMarginPercent } from "@/lib/smart-import";
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
  loading: boolean;
  error: string | null;
  demoMode: boolean;
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

function cloneSampleData(): CommandCenterData {
  return JSON.parse(JSON.stringify(sampleData)) as CommandCenterData;
}

function demoId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString()}`;
}

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

export function CommandCenterProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [data, setData] = useState<CommandCenterData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const demoMode = !isSupabaseConfigured;

  const loadDemo = useCallback(() => {
    setUser(null);
    setProfile(sampleProfile);
    setStore(sampleStore);
    setData(cloneSampleData());
    setError(null);
    setLoading(false);
  }, []);

  const loadSupabaseData = useCallback(async (activeUser: User | null) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !activeUser) {
      setUser(activeUser);
      setProfile(null);
      setStore(null);
      setData(emptyData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

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

      setUser(activeUser);
      setProfile(profileRow as UserProfile);
      setStore(activeStore ?? null);
      setData(nextData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load store data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (demoMode) {
      loadDemo();
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    await loadSupabaseData(sessionData.session?.user ?? null);
  }, [demoMode, loadDemo, loadSupabaseData]);

  useEffect(() => {
    if (demoMode) {
      loadDemo();
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      loadDemo();
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (mounted) {
        void loadSupabaseData(sessionData.session?.user ?? null);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadSupabaseData(session?.user ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [demoMode, loadDemo, loadSupabaseData]);

  const saveEntry = useCallback(
    async <T extends TableName>(table: T, payload: EntryPayload<T>, id?: string) => {
      if (demoMode) {
        setData((current) => {
          const rows = current[table] as TableRowMap[T][];
          const existing = rows.find((row) => row.id === id);
          const nextRow = {
            ...(existing ?? {
              id: demoId(table),
              user_id: sampleProfile.id,
              store_id: sampleStore.id,
            }),
            ...payload,
          } as TableRowMap[T];

          return {
            ...current,
            [table]: existing
              ? rows.map((row) => (row.id === id ? nextRow : row))
              : [nextRow, ...rows],
          };
        });
        return;
      }

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
    [demoMode, refresh, store, user],
  );

  const deleteEntry = useCallback(
    async <T extends TableName>(table: T, id: string) => {
      if (demoMode) {
        setData((current) => ({
          ...current,
          [table]: current[table].filter((row) => row.id !== id),
        }));
        return;
      }

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
    [demoMode, refresh, user],
  );

  const saveSmartImport = useCallback(
    async (parsedImport: ParsedImportResult, rows: ParsedImportRow[]) => {
      const acceptedRows = rows.filter(
        (row) => !row.ignored && row.importDestination !== "ignore" && row.importDestination !== "needs_review",
      );

      if (data.imports.some((record) => record.file_hash === parsedImport.fileHash)) {
        throw new Error("This file has already been imported. Smart Import prevented a duplicate file import.");
      }

      if (demoMode) {
        const existingRowHashes = new Set(data.import_rows.map((row) => row.row_hash));
        const importId = demoId("imports");
        const userId = sampleProfile.id;
        const storeId = sampleStore.id;
        const importRecord: ImportRecord = {
          id: importId,
          ...importRecordPayload(parsedImport, acceptedRows.length, userId, storeId),
        };
        const importRows = rows
          .filter((row) => !existingRowHashes.has(row.rowHash))
          .map<ImportRow>((row) => ({
            id: demoId("import_rows"),
            ...importRowPayload(row, importId, userId, storeId),
          }));
        const importRowIdByHash = new Map(importRows.map((row) => [row.row_hash, row.id]));

        setData((current) => {
          const vendors = [...current.vendors];
          const categories = [...current.product_categories];
          const products = [...current.products];
          const productSales = [...current.product_sales];
          const expenses = [...current.expenses];
          const fuelEntries = [...current.fuel_entries];
          const lotteryEntries = [...current.lottery_entries];
          const deliEntries = [...current.deli_entries];
          const payrollEntries = [...current.payroll_entries];

          function ensureVendor(name: string, category: ParsedImportRow["suggestedCategory"]) {
            const normalized = normalizedVendor(name);
            let vendor = vendors.find((entry) => entry.normalized_name === normalized);
            if (!vendor) {
              vendor = {
                id: demoId("vendors"),
                user_id: userId,
                store_id: storeId,
                name: name || "Unknown vendor",
                normalized_name: normalized,
                category,
                total_spend: 0,
              };
              vendors.push(vendor);
            }
            return vendor;
          }

          function ensureCategory(name: ParsedImportRow["suggestedCategory"]) {
            let category = categories.find((entry) => entry.name === name);
            if (!category) {
              category = {
                id: demoId("product_categories"),
                user_id: userId,
                store_id: storeId,
                name,
                parent_category: null,
              };
              categories.push(category);
            }
            return category;
          }

          function ensureProduct(row: ParsedImportRow, vendorId: string, categoryId: string) {
            const productName = row.productName || row.description || "Imported product";
            let product = products.find(
              (entry) =>
                (row.skuUpc && entry.sku_upc === row.skuUpc) ||
                entry.name.toLowerCase() === productName.toLowerCase(),
            );
            if (!product) {
              product = {
                id: demoId("products"),
                user_id: userId,
                store_id: storeId,
                product_category_id: categoryId,
                vendor_id: vendorId,
                name: productName,
                sku_upc: row.skuUpc || null,
                category: row.suggestedCategory,
                unit_cost: row.unitCost,
                unit_retail_price: row.unitRetailPrice,
              };
              products.push(product);
            }
            return product;
          }

          for (const row of acceptedRows) {
            if (!importRowIdByHash.has(row.rowHash)) {
              continue;
            }

            const amount = rowAmount(row);
            const date = rowDate(row);

            if (row.importDestination === "expenses") {
              expenses.unshift({
                id: demoId("expenses"),
                user_id: userId,
                store_id: storeId,
                date,
                vendor_name: row.vendor || "Imported vendor",
                category: row.suggestedCategory,
                amount,
                payment_method: "Other",
                notes: `Imported from ${parsedImport.fileName}: ${row.description}`,
              });
            } else if (row.importDestination === "fuel_entries") {
              fuelEntries.unshift({
                id: demoId("fuel_entries"),
                user_id: userId,
                store_id: storeId,
                date,
                gallons_sold: row.quantity,
                cost_per_gallon: row.unitCost,
                retail_price_per_gallon: row.unitRetailPrice,
                notes: `Imported from ${parsedImport.fileName}: ${row.description}`,
              });
            } else if (row.importDestination === "lottery_entries") {
              lotteryEntries.unshift({
                id: demoId("lottery_entries"),
                user_id: userId,
                store_id: storeId,
                date,
                lottery_sales: amount,
                lottery_payouts: 0,
                commission_percentage: 6,
                notes: `Imported from ${parsedImport.fileName}: ${row.description}`,
              });
            } else if (row.importDestination === "deli_entries") {
              deliEntries.unshift({
                id: demoId("deli_entries"),
                user_id: userId,
                store_id: storeId,
                date,
                deli_sales: amount,
                food_cost: row.quantity * row.unitCost,
                waste_amount: 0,
                notes: `Imported from ${parsedImport.fileName}: ${row.description}`,
              });
            } else if (row.importDestination === "payroll_entries") {
              payrollEntries.unshift({
                id: demoId("payroll_entries"),
                user_id: userId,
                store_id: storeId,
                employee_name: row.description || row.vendor || "Imported payroll",
                date_range_start: date,
                date_range_end: date,
                hours_worked: row.quantity,
                hourly_rate: row.unitCost || row.unitRetailPrice,
                notes: `Imported from ${parsedImport.fileName}`,
              });
            } else if (row.importDestination === "product_sales") {
              const vendor = ensureVendor(row.vendor, row.suggestedCategory);
              const category = ensureCategory(row.suggestedCategory);
              const product = ensureProduct(row, vendor.id, category.id);
              const grossSales = rowGrossSales(row);
              const grossProfit = rowGrossProfit(row);
              vendor.total_spend += row.quantity * row.unitCost;
              productSales.unshift({
                id: demoId("product_sales"),
                user_id: userId,
                store_id: storeId,
                import_id: importId,
                import_row_id: importRowIdByHash.get(row.rowHash) ?? null,
                product_id: product.id,
                vendor_id: vendor.id,
                date,
                product_name: product.name,
                sku_upc: row.skuUpc || null,
                quantity_sold: row.quantity,
                unit_cost: row.unitCost,
                unit_retail_price: row.unitRetailPrice,
                gross_sales: grossSales,
                gross_profit: grossProfit,
                margin_percent: rowMarginPercent(row),
                category: row.suggestedCategory,
                vendor: vendor.name,
              });
            }
          }

          return {
            ...current,
            imports: [importRecord, ...current.imports],
            import_rows: [...importRows, ...current.import_rows],
            vendors,
            product_categories: categories,
            products,
            product_sales: productSales,
            expenses,
            fuel_entries: fuelEntries,
            lottery_entries: lotteryEntries,
            deli_entries: deliEntries,
            payroll_entries: payrollEntries,
          };
        });

        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user || !store) {
        throw new Error("You must be signed in before importing rows.");
      }
      const supabaseClient = supabase;
      const userId = user.id;
      const storeId = store.id;

      const existingRowHashes = new Set(data.import_rows.map((row) => row.row_hash));
      const rowsToRecord = rows.filter((row) => !existingRowHashes.has(row.rowHash));
      const { data: importRecord, error: importError } = await supabase
        .from("imports")
        .insert(importRecordPayload(parsedImport, acceptedRows.length, userId, storeId))
        .select("*")
        .single();

      if (importError) {
        throw importError;
      }

      const importId = importRecord.id as string;
      const importRowPayloads = rowsToRecord.map((row) => importRowPayload(row, importId, userId, storeId));
      const { data: insertedImportRows, error: importRowsError } = importRowPayloads.length
        ? await supabase.from("import_rows").insert(importRowPayloads).select("id,row_hash")
        : { data: [], error: null };

      if (importRowsError) {
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
          throw productError;
        }

        return product as { id: string; name: string };
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
          if (expenseError) throw expenseError;
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
          if (fuelError) throw fuelError;
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
          if (lotteryError) throw lotteryError;
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
          if (deliError) throw deliError;
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
          if (payrollError) throw payrollError;
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
          if (saleError) throw saleError;
        }
      }

      await refresh();
    },
    [data.import_rows, data.imports, demoMode, refresh, store, user],
  );

  const updateProfile = useCallback(
    async (payload: Partial<Pick<UserProfile, "full_name">>) => {
      if (demoMode) {
        setProfile((current) => ({ ...(current ?? sampleProfile), ...payload }));
        return;
      }

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
    [demoMode, refresh, user],
  );

  const updateStore = useCallback(
    async (payload: Partial<Omit<Store, "id" | "user_id">>) => {
      if (demoMode) {
        setStore((current) => ({ ...(current ?? sampleStore), ...payload }));
        return;
      }

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
    [demoMode, refresh, store, user],
  );

  const value = useMemo<CommandCenterContextValue>(
    () => ({
      user,
      profile,
      store,
      data,
      loading,
      error,
      demoMode,
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
      demoMode,
      error,
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
