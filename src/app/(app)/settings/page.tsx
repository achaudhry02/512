"use client";

import { Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { useCommandCenter } from "@/lib/data-provider";

export default function SettingsPage() {
  const { profile, store, updateProfile, updateStore } = useCommandCenter();
  const [fullName, setFullName] = useState("");
  const [storeForm, setStoreForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setStoreForm({
      name: store?.name ?? "",
      address: store?.address ?? "",
      city: store?.city ?? "",
      state: store?.state ?? "",
      zip: store?.zip ?? "",
    });
  }, [profile, store]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await updateProfile({ full_name: fullName || null });
      await updateStore({
        name: storeForm.name || "My Convenience Store",
        address: storeForm.address || null,
        city: storeForm.city || null,
        state: storeForm.state || null,
        zip: storeForm.zip || null,
      });
      setMessage("Settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Store settings"
        description="Maintain owner and store information used throughout the command center."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
        <form
          className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-card"
          onSubmit={handleSubmit}
        >
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5 sm:px-6">
            <h3 className="text-xl font-black text-slate-950">Profile</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">Owner identity and store information for the workspace.</p>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 sm:p-6">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Full name</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                onChange={(event) => setFullName(event.target.value)}
                type="text"
                value={fullName}
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Email</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500"
                disabled
                type="email"
                value={profile?.email ?? ""}
              />
            </label>
          </div>

          <div className="border-t border-slate-100 px-5 pt-5 sm:px-6">
            <h3 className="text-xl font-black text-slate-950">Store</h3>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 sm:p-6">
            {[
              ["name", "Store name"],
              ["address", "Address"],
              ["city", "City"],
              ["state", "State"],
              ["zip", "ZIP"],
            ].map(([key, label]) => (
              <label className={key === "address" ? "block md:col-span-2" : "block"} key={key}>
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) =>
                    setStoreForm((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  type="text"
                  value={storeForm[key as keyof typeof storeForm]}
                />
              </label>
            ))}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-6">
            {message ? <p className="mb-4 text-sm font-semibold text-emerald-700">{message}</p> : null}
            {error ? <p className="mb-4 text-sm font-semibold text-red-600">{error}</p> : null}

            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-600/20 transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </form>

        <aside className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
          <h3 className="text-xl font-black text-slate-950">Production readiness</h3>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="font-bold text-slate-950">Authentication</p>
              <p className="mt-1">
                Supabase authentication is active when environment variables are configured and the user is signed in.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="font-bold text-slate-950">Data isolation</p>
              <p className="mt-1">
                The SQL schema includes row-level security policies so each user only sees their own store data.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="font-bold text-slate-950">Backups</p>
              <p className="mt-1">
                Configure Supabase backups and invite only trusted store owners in production.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
