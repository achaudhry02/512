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
import type {
  CommandCenterData,
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

const emptyData: CommandCenterData = {
  daily_sales: [],
  expenses: [],
  fuel_entries: [],
  lottery_entries: [],
  deli_entries: [],
  payroll_entries: [],
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
  updateProfile: (payload: Partial<Pick<UserProfile, "full_name">>) => Promise<void>;
  updateStore: (payload: Partial<Omit<Store, "id" | "user_id">>) => Promise<void>;
};

const CommandCenterContext = createContext<CommandCenterContextValue | undefined>(undefined);

function cloneSampleData(): CommandCenterData {
  return JSON.parse(JSON.stringify(sampleData)) as CommandCenterData;
}

function demoId(table: TableName) {
  return `${table}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString()}`;
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

      let { data: stores, error: storesError } = await supabase
        .from("stores")
        .select("*")
        .eq("user_id", activeUser.id)
        .order("created_at", { ascending: true });

      if (storesError) {
        throw storesError;
      }

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
