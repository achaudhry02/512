"use client";

import { Edit3, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { inDateRange, todayIso } from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import type { TableName, TableRowMap } from "@/lib/types";
import { cn } from "@/lib/utils";

type FieldType = "date" | "text" | "number" | "textarea" | "select";

export type FieldConfig = {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  step?: string;
  min?: string;
  className?: string;
};

export type ColumnConfig<Row> = {
  header: string;
  cell: (row: Row) => string;
  className?: string;
};

type EntryManagerProps<T extends TableName> = {
  table: T;
  title: string;
  description: string;
  fields: FieldConfig[];
  columns: ColumnConfig<TableRowMap[T]>[];
  defaultValues: Record<string, string | number>;
  dateAccessor?: (row: TableRowMap[T]) => string;
  helper?: string;
  transformPayload?: (
    payload: Record<string, string | number | null>,
  ) => Record<string, string | number | null>;
};

function toFormValues(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value == null ? "" : String(value)]),
  ) as Record<string, string>;
}

export function EntryManager<T extends TableName>({
  columns,
  dateAccessor,
  defaultValues,
  description,
  fields,
  helper,
  table,
  title,
  transformPayload,
}: EntryManagerProps<T>) {
  const { data, deleteEntry, loading, saveEntry } = useCommandCenter();
  const rows = data[table] as TableRowMap[T][];
  const [editingId, setEditingId] = useState<string | undefined>();
  const [formOpen, setFormOpen] = useState(true);
  const [formValues, setFormValues] = useState<Record<string, string>>(
    toFormValues(defaultValues),
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const date = dateAccessor ? dateAccessor(row) : (row as { date: string }).date;
      return inDateRange(date, startDate || undefined, endDate || undefined);
    });
  }, [dateAccessor, endDate, rows, startDate]);

  function resetForm() {
    setEditingId(undefined);
    setFormValues(toFormValues(defaultValues));
    setFormOpen(true);
  }

  function editRow(row: TableRowMap[T]) {
    setEditingId(row.id);
    setFormValues(toFormValues(row as Record<string, unknown>));
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setActionError(null);

    const rawPayload = fields.reduce<Record<string, string | number | null>>((values, field) => {
      const value = formValues[field.name] ?? "";

      if (field.type === "number") {
        values[field.name] = value === "" ? 0 : Number(value);
      } else if (field.type === "textarea") {
        values[field.name] = value.trim() || null;
      } else {
        values[field.name] = value;
      }

      return values;
    }, {});
    const payload = transformPayload ? transformPayload(rawPayload) : rawPayload;

    try {
      await saveEntry(table, payload as never, editingId);
      resetForm();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to save entry.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this entry? This cannot be undone.")) {
      return;
    }

    setActionError(null);
    try {
      await deleteEntry(table, id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to delete entry.");
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-5 rounded-[2rem] border border-white/80 bg-white/75 p-6 shadow-card backdrop-blur-xl sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-700 ring-1 ring-cyan-100">
            Store operations
          </p>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
            {title}
          </h2>
          <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-slate-600 sm:text-base">
            {description}
          </p>
          {helper ? (
            <p className="mt-3 inline-flex rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white">
              {helper}
            </p>
          ) : null}
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
          onClick={() => {
            resetForm();
            setFormOpen((current) => !current);
          }}
          type="button"
        >
          <Plus className="h-4 w-4" />
          {formOpen ? "Hide form" : "Add entry"}
        </button>
      </div>

      {actionError ? (
        <div className="mb-6 rounded-3xl border border-red-200 bg-red-50/90 p-4 text-sm font-semibold text-red-700 shadow-sm">
          {actionError}
        </div>
      ) : null}

      {formOpen ? (
        <form
          className="mb-8 overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-card"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5 sm:px-6">
            <div>
              <h3 className="text-lg font-black text-slate-950">
                {editingId ? "Edit entry" : "Add new entry"}
              </h3>
              <p className="text-sm text-slate-500">
                Calculated fields update automatically in summaries and reports.
              </p>
            </div>
            {editingId ? (
              <button
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                onClick={resetForm}
                type="button"
                aria-label="Cancel edit"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 sm:p-6 xl:grid-cols-3">
            {fields.map((field) => (
              <label className={cn("block", field.className)} key={field.name}>
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{field.label}</span>
                {field.type === "textarea" ? (
                  <textarea
                    className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    value={formValues[field.name] ?? ""}
                  />
                ) : field.type === "select" ? (
                  <select
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                    required={field.required}
                    value={formValues[field.name] ?? ""}
                  >
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                    min={field.min}
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    required={field.required}
                    step={field.step}
                    type={field.type}
                    value={formValues[field.name] ?? ""}
                  />
                )}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-6">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-600/20 transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              <Save className="h-4 w-4" />
              {submitting ? "Saving..." : editingId ? "Save changes" : "Add entry"}
            </button>
            <button
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
              onClick={resetForm}
              type="button"
            >
              Reset
            </button>
          </div>
        </form>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 rounded-[1.75rem] border border-white/80 bg-white/85 p-4 shadow-card backdrop-blur-xl sm:flex-row sm:items-center">
        <div className="text-sm font-black text-slate-800">Filter by date range</div>
        <input
          className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
          onChange={(event) => setStartDate(event.target.value)}
          type="date"
          value={startDate}
        />
        <input
          className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
          onChange={(event) => setEndDate(event.target.value)}
          type="date"
          value={endDate}
        />
        <button
          className="rounded-2xl px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-100"
          onClick={() => {
            setStartDate("");
            setEndDate("");
          }}
          type="button"
        >
          Clear
        </button>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.12em] text-slate-300">
              <tr>
                {columns.map((column) => (
                  <th className={cn("px-5 py-4 font-black", column.className)} key={column.header}>
                    {column.header}
                  </th>
                ))}
                <th className="px-5 py-4 text-right font-black">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-5 py-10 text-center font-semibold text-slate-500" colSpan={columns.length + 1}>
                    Loading entries...
                  </td>
                </tr>
              ) : filteredRows.length ? (
                filteredRows.map((row) => (
                  <tr className="transition hover:bg-cyan-50/40" key={row.id}>
                    {columns.map((column) => (
                      <td className={cn("px-5 py-4 font-semibold text-slate-700", column.className)} key={column.header}>
                        {column.cell(row)}
                      </td>
                    ))}
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                          onClick={() => editRow(row)}
                          type="button"
                          aria-label="Edit entry"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                          onClick={() => void handleDelete(row.id)}
                          type="button"
                          aria-label="Delete entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-12 text-center font-semibold text-slate-500" colSpan={columns.length + 1}>
                    No entries found. Add your first entry for {todayIso()}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
