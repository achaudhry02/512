"use client";

import { Edit3, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type FieldType = "text" | "email" | "tel" | "number" | "textarea" | "select" | "checkbox";

export type ResourceField = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  min?: string;
  step?: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
  className?: string;
};

export type ResourceColumn<Row> = {
  header: string;
  cell: (row: Row) => ReactNode;
  className?: string;
};

type ResourceManagerProps<Row extends { id: string }> = {
  title: string;
  description: string;
  addLabel: string;
  emptyMessage: string;
  rows: Row[];
  loading: boolean;
  fields: ResourceField[];
  columns: ResourceColumn<Row>[];
  defaultValues: Record<string, string | number | boolean>;
  getSearchText: (row: Row) => string;
  filterField?: { label: string; options: string[]; value: (row: Row) => string };
  preparePayload: (values: Record<string, string | boolean>) => unknown;
  onSave: (payload: never, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function formValues(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, typeof value === "boolean" ? value : value == null ? "" : String(value)]),
  ) as Record<string, string | boolean>;
}

export function ResourceManager<Row extends { id: string }>({
  addLabel,
  columns,
  defaultValues,
  description,
  emptyMessage,
  fields,
  filterField,
  getSearchText,
  loading,
  onDelete,
  onSave,
  preparePayload,
  rows,
  title,
}: ResourceManagerProps<Row>) {
  const [editingId, setEditingId] = useState<string>();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string | boolean>>(() => formValues(defaultValues));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !normalizedQuery || getSearchText(row).toLowerCase().includes(normalizedQuery);
      const matchesFilter = !filter || !filterField || filterField.value(row) === filter;
      return matchesSearch && matchesFilter;
    });
  }, [filter, filterField, getSearchText, query, rows]);

  function resetForm(show = false) {
    setEditingId(undefined);
    setValues(formValues(defaultValues));
    setOpen(show);
    setError(null);
  }

  function edit(row: Row) {
    setEditingId(row.id);
    setValues(formValues(row as Record<string, unknown>));
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSave(preparePayload(values) as never, editingId);
      resetForm(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this record.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this record? This cannot be undone.")) return;
    setError(null);
    try {
      await onDelete(id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this record.");
    }
  }

  return (
    <div>
      <div className="mb-7 flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-950 sm:text-4xl">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">{description}</p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800"
          onClick={() => resetForm(!open)}
          type="button"
        >
          <Plus className="h-4 w-4" />
          {open ? "Close" : addLabel}
        </button>
      </div>

      {error ? <div className="mb-5 border-l-4 border-red-500 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

      {open ? (
        <form className="mb-7 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card" onSubmit={submit}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="font-black text-slate-950">{editingId ? "Edit record" : addLabel}</h3>
            <button aria-label="Close form" className="p-2 text-slate-500 hover:text-slate-950" onClick={() => resetForm(false)} type="button">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {fields.map((field) => (
              <label className={cn("block", field.className)} key={field.name}>
                <span className="text-xs font-black uppercase text-slate-500">{field.label}</span>
                {field.type === "textarea" ? (
                  <textarea className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:bg-white" onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} placeholder={field.placeholder} value={String(values[field.name] ?? "")} />
                ) : field.type === "select" ? (
                  <select className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:bg-white" onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} required={field.required} value={String(values[field.name] ?? "")}>
                    {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : field.type === "checkbox" ? (
                  <input className="mt-3 h-5 w-5 accent-cyan-600" checked={Boolean(values[field.name])} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.checked }))} type="checkbox" />
                ) : (
                  <input className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:bg-white" min={field.min} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} placeholder={field.placeholder} required={field.required} step={field.step} type={field.type} value={String(values[field.name] ?? "")} />
                )}
              </label>
            ))}
          </div>
          <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
            <button className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60" disabled={submitting} type="submit">
              <Save className="h-4 w-4" /> {submitting ? "Saving..." : "Save"}
            </button>
            <button className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold" onClick={() => resetForm(false)} type="button">Cancel</button>
          </div>
        </form>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input aria-label={`Search ${title}`} className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-cyan-500" onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}...`} value={query} />
        </label>
        {filterField ? (
          <select aria-label={filterField.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-cyan-500" onChange={(event) => setFilter(event.target.value)} value={filter}>
            <option value="">All {filterField.label.toLowerCase()}</option>
            {filterField.options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-950 text-left text-xs uppercase text-slate-300"><tr>{columns.map((column) => <th className={cn("px-4 py-3 font-black", column.className)} key={column.header}>{column.header}</th>)}<th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={columns.length + 1}>Loading...</td></tr> : visibleRows.length ? visibleRows.map((row) => (
                <tr className="hover:bg-cyan-50/40" key={row.id}>
                  {columns.map((column) => <td className={cn("px-4 py-3 font-semibold text-slate-700", column.className)} key={column.header}>{column.cell(row)}</td>)}
                  <td className="px-4 py-3"><div className="flex justify-end gap-2"><button aria-label="Edit record" className="rounded-lg border border-slate-200 p-2 hover:text-cyan-700" onClick={() => edit(row)} type="button"><Edit3 className="h-4 w-4" /></button><button aria-label="Delete record" className="rounded-lg border border-slate-200 p-2 hover:text-red-700" onClick={() => void remove(row.id)} type="button"><Trash2 className="h-4 w-4" /></button></div></td>
                </tr>
              )) : <tr><td className="px-4 py-12 text-center font-semibold text-slate-500" colSpan={columns.length + 1}>{emptyMessage}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
