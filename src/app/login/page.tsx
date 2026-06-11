"use client";

import { ArrowRight, ChartNoAxesCombined, ShieldCheck, Sparkles, Store, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      setLoading(false);
      return;
    }

    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
              },
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account, then sign in.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="grid min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_15%,rgba(34,211,238,0.18),transparent_28rem),linear-gradient(135deg,#f8fafc_0%,#eef3f9_100%)] lg:grid-cols-[1.02fr_0.98fr]">
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-950 text-cyan-300 shadow-xl shadow-slate-950/20 ring-1 ring-white/20">
            <Store className="h-7 w-7" />
          </div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-700 ring-1 ring-cyan-100">
            <Sparkles className="h-3.5 w-3.5" />
            Owner portal
          </p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Convenience Store Command Center
          </h1>
          <p className="mt-4 text-base font-medium leading-7 text-slate-600">
            Sign in to manage daily sales, expenses, fuel, lottery, deli, payroll,
            and profit from one mobile-friendly dashboard.
          </p>

          {!isSupabaseConfigured ? (
            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50/90 p-4 text-sm font-semibold text-amber-900 shadow-sm">
              Supabase environment variables are not configured. Set
              NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in
              .env.local to enable authentication and live data.
            </div>
          ) : null}

          <form className="mt-8 rounded-[2rem] border border-white/80 bg-white p-5 shadow-premium" onSubmit={handleSubmit}>
            <div className="mb-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-sm font-black">
              <button
                className={`rounded-xl px-3 py-2 transition ${
                  mode === "login" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => setMode("login")}
                type="button"
              >
                Login
              </button>
              <button
                className={`rounded-xl px-3 py-2 transition ${
                  mode === "signup" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => setMode("signup")}
                type="button"
              >
                Sign up
              </button>
            </div>

            {mode === "signup" ? (
              <label className="mb-4 block">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Full name</span>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Alex Owner"
                  type="text"
                  value={fullName}
                />
              </label>
            ) : null}

            <label className="mb-4 block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Email</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="mb-4 block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Password</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                required
                type="password"
                value={password}
              />
            </label>

            {error ? <p className="mb-4 text-sm font-semibold text-red-600">{error}</p> : null}
            {message ? <p className="mb-4 text-sm font-semibold text-emerald-700">{message}</p> : null}

            <button
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-600/25 transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? "Working..." : mode === "login" ? "Login" : "Create account"}
              <ArrowRight className="h-4 w-4" />
            </button>

          </form>
        </div>
      </section>

      <section className="relative hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),transparent_28rem),linear-gradient(180deg,#07111f_0%,#020617_100%)] p-10 text-white lg:flex lg:items-center">
        <div className="absolute right-10 top-10 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
          Built for multi-shift operators
        </div>
        <div className="mx-auto max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 ring-1 ring-white/10">
            <ShieldCheck className="h-4 w-4" />
            Secure store data
          </div>
          <h2 className="text-4xl font-black tracking-tight">A boardroom-grade command view for everyday store decisions.</h2>
          <p className="mt-4 text-sm font-medium leading-6 text-slate-300">
            Designed for owners who need margin clarity across fuel, lottery, foodservice, payroll, and vendor spend without waiting for month-end bookkeeping.
          </p>
          <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Today&apos;s command snapshot</p>
                <p className="mt-1 text-2xl font-black">$18,420 sales</p>
              </div>
              <div className="rounded-2xl bg-cyan-400 p-3 text-slate-950">
                <WalletCards className="h-6 w-6" />
              </div>
            </div>
            {[
              ["Fuel margin", "$596"],
              ["Lottery profit", "$-361"],
              ["Deli gross profit", "$483"],
              ["Net profit estimate", "$1,842"],
            ].map(([label, value]) => (
              <div
                className="mb-3 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3"
                key={label}
              >
                <span className="text-sm text-slate-300">{label}</span>
                <span className="font-black">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              ["8", "profit modules"],
              ["CSV", "P&L export"],
              ["RLS", "data isolation"],
            ].map(([value, label]) => (
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 text-center" key={label}>
                <p className="text-2xl font-black">{value}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-cyan-100">
            <ChartNoAxesCombined className="h-5 w-5" />
            <p className="text-sm font-bold">Professional enough for paid SaaS pilots with convenience store owners.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
