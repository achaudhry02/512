"use client";

import { Plus, Save, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { useCommandCenter } from "@/lib/data-provider";
import { defaultMarginSettings, marginCategoryLabel } from "@/lib/margin-settings";
import type { MarginCategory, UserRole } from "@/lib/types";

export default function SettingsPage() {
  const { createStore, data, inviteStoreMember, profile, removeStoreMember, saveEntry, selectStore, store, stores, updateProfile, updateStore, updateStoreMemberRole } = useCommandCenter();
  const [fullName, setFullName] = useState("");
  const [storeForm, setStoreForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    cash_variance_threshold: "5",
    card_mismatch_threshold: "5",
    fuel_variance_threshold: "25",
  });
  const [newStoreName, setNewStoreName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("employee");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingMargins, setSavingMargins] = useState(false);
  const [margins, setMargins] = useState<Record<MarginCategory, number>>(() =>
    Object.fromEntries(defaultMarginSettings.map((entry) => [entry.category, entry.gross_margin_percent])) as Record<MarginCategory, number>,
  );
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
      cash_variance_threshold: String(store?.cash_variance_threshold ?? 5),
      card_mismatch_threshold: String(store?.card_mismatch_threshold ?? 5),
      fuel_variance_threshold: String(store?.fuel_variance_threshold ?? 25),
    });
  }, [profile, store]);

  useEffect(() => {
    setMargins(
      Object.fromEntries(
        defaultMarginSettings.map((defaultSetting) => {
          const saved = data.margin_settings.find((entry) => entry.category === defaultSetting.category);
          return [defaultSetting.category, saved?.gross_margin_percent ?? defaultSetting.gross_margin_percent];
        }),
      ) as Record<MarginCategory, number>,
    );
  }, [data.margin_settings]);

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
        cash_variance_threshold: Number(storeForm.cash_variance_threshold) || 5,
        card_mismatch_threshold: Number(storeForm.card_mismatch_threshold) || 5,
        fuel_variance_threshold: Number(storeForm.fuel_variance_threshold) || 25,
      });
      setMessage("Settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage(null);
    setError(null);

    try {
      await createStore({ name: newStoreName || "New Convenience Store" });
      setNewStoreName("");
      setMessage("Store created and selected.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create store.");
    } finally {
      setCreating(false);
    }
  }

  async function handleInviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await inviteStoreMember(inviteEmail, inviteRole);
      setInviteEmail("");
      setMessage("Member invitation saved. It will activate when that email signs in.");
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to invite member.");
    }
  }

  async function handleSaveMargins() {
    setSavingMargins(true);
    setMessage(null);
    setError(null);

    try {
      for (const defaultSetting of defaultMarginSettings) {
        const existing = data.margin_settings.find((entry) => entry.category === defaultSetting.category);
        await saveEntry("margin_settings", {
          category: defaultSetting.category,
          gross_margin_percent: margins[defaultSetting.category],
          notes: existing?.notes ?? defaultSetting.notes,
        }, existing?.id);
      }
      setMessage("Margin settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save margin settings.");
    } finally {
      setSavingMargins(false);
    }
  }

  function resetMarginDefaults() {
    setMargins(
      Object.fromEntries(defaultMarginSettings.map((entry) => [entry.category, entry.gross_margin_percent])) as Record<MarginCategory, number>,
    );
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
            <label className="block md:col-span-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Role</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold capitalize text-slate-500"
                disabled
                type="text"
                value={profile?.role ?? "owner"}
              />
            </label>
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
            {[
              ["cash_variance_threshold", "Cash variance threshold"],
              ["card_mismatch_threshold", "Card mismatch threshold"],
              ["fuel_variance_threshold", "Fuel variance threshold"],
            ].map(([key, label]) => (
              <label className="block" key={key}><span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</span><input className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" min="0" onChange={(event) => setStoreForm((current) => ({ ...current, [key]: event.target.value }))} step="0.01" type="number" value={storeForm[key as keyof typeof storeForm]} /></label>
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
          <h3 className="text-xl font-black text-slate-950">Stores</h3>
          <div className="mt-5 space-y-3">
            {stores.map((candidate) => (
              <button
                className={`w-full rounded-2xl border p-4 text-left text-sm transition ${
                  candidate.id === store?.id
                    ? "border-cyan-200 bg-cyan-50 text-cyan-950"
                    : "border-slate-100 bg-slate-50/80 text-slate-600 hover:border-slate-200"
                }`}
                key={candidate.id}
                onClick={() => void selectStore(candidate.id)}
                type="button"
              >
                <span className="block font-black text-slate-950">{candidate.name}</span>
                <span className="mt-1 block font-semibold">
                  {[candidate.city, candidate.state].filter(Boolean).join(", ") || "No address saved"}
                </span>
              </button>
            ))}
          </div>

          <form className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-4" onSubmit={handleCreateStore}>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">New store</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                onChange={(event) => setNewStoreName(event.target.value)}
                placeholder="Second location"
                type="text"
                value={newStoreName}
              />
            </label>
            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
              disabled={creating}
              type="submit"
            >
              <Plus className="h-4 w-4" />
              {creating ? "Creating..." : "Create store"}
            </button>
          </form>

          <h3 className="mt-8 text-xl font-black text-slate-950">Production readiness</h3>
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
                Store-member RLS grants access by active store and role while blocking non-members.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="font-bold text-slate-950">Backups</p>
              <p className="mt-1">
                Configure Supabase backups and grant each member only the role required for their work.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card" id="members">
        <div className="border-b border-slate-100 px-5 py-5"><h3 className="text-xl font-black text-slate-950">Members</h3><p className="mt-1 text-sm font-medium text-slate-500">Invite staff and accountants to this store. The primary owner cannot be removed or demoted.</p></div>
        <form className="grid gap-3 border-b border-slate-100 bg-slate-50 p-5 sm:grid-cols-[1fr_180px_auto]" onSubmit={handleInviteMember}><input aria-label="Member email" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm" onChange={(event) => setInviteEmail(event.target.value)} placeholder="member@example.com" required type="email" value={inviteEmail} /><select aria-label="Invitation role" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" onChange={(event) => setInviteRole(event.target.value as UserRole)} value={inviteRole}>{["manager","employee","accountant","owner"].map((role) => <option key={role} value={role}>{role}</option>)}</select><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white" type="submit"><UserPlus className="h-4 w-4" />Invite</button></form>
        <div className="divide-y divide-slate-100">{data.store_members.map((member) => { const primaryOwner = member.user_id === store?.user_id; return <div className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_180px_auto] sm:items-center" key={member.id}><div><p className="font-black text-slate-950">{member.invited_email || member.user_id || "Pending member"}</p><p className="mt-1 text-xs font-semibold text-slate-500">{member.accepted_at ? "Active member" : "Invitation pending"}{primaryOwner ? " · Primary owner" : ""}</p></div><select aria-label={`Role for ${member.invited_email ?? member.id}`} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold capitalize" disabled={primaryOwner} onChange={(event) => void updateStoreMemberRole(member.id, event.target.value as UserRole)} value={member.role}>{["owner","manager","employee","accountant"].map((role) => <option key={role} value={role}>{role}</option>)}</select><button aria-label={`Remove ${member.invited_email ?? member.id}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-200 text-rose-700 disabled:opacity-30" disabled={primaryOwner} onClick={() => void removeStoreMember(member.id)} title="Remove member" type="button"><Trash2 className="h-4 w-4" /></button></div>; })}{!data.store_members.length ? <p className="px-5 py-8 text-sm font-semibold text-slate-500">Apply migrations 009 and 010 to load store memberships.</p> : null}</div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-card" id="margin-settings">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5 sm:px-6">
          <h3 className="text-xl font-black text-slate-950">Margin settings</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Configure gross margin assumptions used by dashboard, reports, Profit Leak Finder, and monthly totals when product-level cost is not available.
          </p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:p-6">
          {defaultMarginSettings.map((setting) => (
            <label className="block" key={setting.category}>
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{marginCategoryLabel(setting.category)}</span>
              <div className="mt-2 flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100">
                <input
                  className="w-full bg-transparent px-4 py-3 text-sm font-semibold outline-none"
                  min="-100"
                  onChange={(event) =>
                    setMargins((current) => ({
                      ...current,
                      [setting.category]: Number(event.target.value) || 0,
                    }))
                  }
                  step="0.01"
                  type="number"
                  value={margins[setting.category]}
                />
                <span className="border-l border-slate-200 px-3 text-sm font-black text-slate-500">%</span>
              </div>
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-5 sm:flex-row sm:px-6">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-600/20 transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:opacity-60"
            disabled={savingMargins}
            onClick={() => void handleSaveMargins()}
            type="button"
          >
            <Save className="h-4 w-4" />
            {savingMargins ? "Saving..." : "Save margin settings"}
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm"
            onClick={resetMarginDefaults}
            type="button"
          >
            Reset defaults
          </button>
        </div>
      </section>
    </div>
  );
}
