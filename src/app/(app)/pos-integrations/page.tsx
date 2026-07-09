"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Save,
  Upload,
} from "lucide-react";
import Papa from "papaparse";
import { useMemo, useState, type ChangeEvent } from "react";
import { PageHeader } from "@/components/page-header";
import {
  currency,
  numberFormatter,
  posDepartmentSales,
  posPaymentBreakdown,
  posSalesBySource,
  sum,
} from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  defaultPosMappings,
  genericPosTemplateCsv,
  mapRowsToPosPreview,
  posFieldLabels,
  posFieldOrder,
  posSystems,
  validatePosPreviewRows,
  type PosMapping,
  type PosPreviewRow,
} from "@/lib/pos-import";
import type { PosSystemKey } from "@/lib/types";

async function fileHash(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function downloadText(fileName: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function sourceColumns(rows: Record<string, unknown>[]) {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).sort((a, b) => a.localeCompare(b));
}

export default function PosIntegrationsPage() {
  const { data, loading, savePosColumnMapping, savePosImport, store, user } = useCommandCenter();
  const [posKey, setPosKey] = useState<PosSystemKey>("generic");
  const [mapping, setMapping] = useState<PosMapping>(defaultPosMappings.generic);
  const [templateName, setTemplateName] = useState("Default mapping");
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [previewRows, setPreviewRows] = useState<PosPreviewRow[]>([]);
  const [fileMeta, setFileMeta] = useState<{ name: string; type: string; size: number; hash: string } | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "overwrite">("skip");
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedPos = posSystems.find((system) => system.key === posKey) ?? posSystems[posSystems.length - 1];
  const columns = useMemo(() => sourceColumns(rawRows), [rawRows]);
  const existingDuplicateKeys = useMemo(
    () => new Set(data.pos_import_rows.filter((row) => row.pos_key === posKey).map((row) => row.duplicate_key)),
    [data.pos_import_rows, posKey],
  );
  const validationErrors = useMemo(() => validatePosPreviewRows(previewRows), [previewRows]);
  const importableRows = previewRows.filter((row) => row.import_action !== "skip");
  const importHistory = data.pos_imports.slice().sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const sourceReport = posSalesBySource(data.pos_import_rows);
  const paymentReport = Object.entries(posPaymentBreakdown(data.pos_import_rows)).filter(([, value]) => value > 0);
  const departmentReport = Object.entries(posDepartmentSales(data.pos_import_rows)).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const fuelGallons = sum(data.pos_import_rows.map((row) => row.fuel_gallons));
  const fuelSales = sum(data.pos_import_rows.map((row) => row.fuel_sales));
  const errorRows = data.pos_import_rows.filter((row) => row.validation_errors.length);

  function applyPosPreset(nextPosKey: PosSystemKey) {
    setPosKey(nextPosKey);
    setMapping(defaultPosMappings[nextPosKey]);
    setTemplateName(`${posSystems.find((system) => system.key === nextPosKey)?.name ?? "POS"} default`);
    if (rawRows.length) {
      const pos = posSystems.find((system) => system.key === nextPosKey) ?? selectedPos;
      setPreviewRows(mapRowsToPosPreview(rawRows, defaultPosMappings[nextPosKey], nextPosKey, pos.name, existingDuplicateKeys));
    }
  }

  function rebuildPreview(nextMapping = mapping) {
    setPreviewRows(mapRowsToPosPreview(rawRows, nextMapping, posKey, selectedPos.name, existingDuplicateKeys));
  }

  async function loadExistingDuplicateKeys(nextPosKey: PosSystemKey) {
    const keys = new Set(data.pos_import_rows.filter((row) => row.pos_key === nextPosKey).map((row) => row.duplicate_key));
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || !store) {
      return keys;
    }

    const { data: rows } = await supabase
      .from("pos_import_rows")
      .select("duplicate_key")
      .eq("user_id", user.id)
      .eq("store_id", store.id)
      .eq("pos_key", nextPosKey);

    for (const row of rows ?? []) {
      if (typeof row.duplicate_key === "string") {
        keys.add(row.duplicate_key);
      }
    }

    return keys;
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setError(null);
    setMessage(null);

    try {
      const hash = await fileHash(file);
      const text = await file.text();
      const parsed = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (parsed.errors.length) {
        throw new Error(parsed.errors[0].message);
      }

      const rows = parsed.data.filter((row) => Object.values(row).some((value) => String(value ?? "").trim()));
      const liveDuplicateKeys = await loadExistingDuplicateKeys(posKey);
      setRawRows(rows);
      setFileMeta({ name: file.name, type: file.type || "text/csv", size: file.size, hash });
      setPreviewRows(mapRowsToPosPreview(rows, mapping, posKey, selectedPos.name, liveDuplicateKeys));
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Unable to parse CSV file.");
    } finally {
      setParsing(false);
      event.target.value = "";
    }
  }

  function updateMapping(field: keyof PosMapping, value: string) {
    const nextMapping = { ...mapping, [field]: value || undefined };
    setMapping(nextMapping);
    if (rawRows.length) {
      rebuildPreview(nextMapping);
    }
  }

  function updateRow(rowHash: string, patch: Partial<PosPreviewRow>) {
    setPreviewRows((rows) => rows.map((row) => (row.row_hash === rowHash ? { ...row, ...patch } : row)));
  }

  async function saveMapping() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await savePosColumnMapping(posKey, templateName, mapping);
      setMessage("POS mapping template saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save mapping.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmImport() {
    if (!fileMeta) {
      setError("Upload a POS CSV before saving.");
      return;
    }

    const rowsForSave = previewRows.map((row) => {
      const duplicateErrors = row.validation_errors.filter((issue) => issue.startsWith("Duplicate POS"));
      const nonDuplicateErrors = row.validation_errors.filter((issue) => !issue.startsWith("Duplicate POS"));

      if (duplicateErrors.length && duplicateStrategy === "overwrite") {
        return { ...row, import_action: "overwrite" as const, validation_errors: nonDuplicateErrors };
      }

      if (duplicateErrors.length && duplicateStrategy === "skip") {
        return { ...row, import_action: "skip" as const };
      }

      return row;
    });
    const blockingErrors = rowsForSave.flatMap((row) =>
      row.import_action === "skip"
        ? []
        : row.validation_errors.map((issue) => `Row ${row.row_index}: ${issue}`),
    );
    const selectedRows = rowsForSave.filter((row) => row.import_action !== "skip");

    if (blockingErrors.length) {
      setError(`Fix validation errors before saving. First issue: ${blockingErrors[0]}`);
      return;
    }

    if (!selectedRows.length) {
      setMessage("No new POS rows to import. Duplicate rows were skipped.");
      setRawRows([]);
      setPreviewRows([]);
      setFileMeta(null);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await savePosImport({
        posKey,
        posName: selectedPos.name,
        fileName: fileMeta.name,
        fileType: fileMeta.type,
        fileSize: fileMeta.size,
        fileHash: fileMeta.hash,
        mappingTemplateName: templateName,
        duplicateStrategy,
        rows: rowsForSave,
      });
      setMessage(`Imported ${importableRows.length} POS rows from ${selectedPos.name}.`);
      setRawRows([]);
      setPreviewRows([]);
      setFileMeta(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save POS import.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="POS Integrations"
        title="Flexible POS import center"
        description="Upload CSV exports from common convenience-store and retail POS systems, map columns once, preview rows, then import sales, departments, payments, fuel, tax, discounts, refunds, and item details."
        actions={
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20"
            onClick={() => downloadText("generic-pos-import-template.csv", genericPosTemplateCsv())}
            type="button"
          >
            <Download className="h-4 w-4" />
            CSV Template
          </button>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
          <h3 className="text-xl font-black text-slate-950">POS source</h3>
          <label className="mt-4 block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Select POS system</span>
            <select
              data-testid="pos-system-select"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800"
              onChange={(event) => applyPosPreset(event.target.value as PosSystemKey)}
              value={posKey}
            >
              {posSystems.map((system) => (
                <option key={system.key} value={system.key}>{system.name}</option>
              ))}
            </select>
          </label>
          <p className="mt-3 rounded-2xl bg-cyan-50 p-3 text-sm font-semibold text-cyan-800">{selectedPos.notes}</p>
          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-cyan-200 bg-cyan-50/70 px-6 py-10 text-center transition hover:border-cyan-400 hover:bg-cyan-50">
            {parsing ? <Loader2 className="h-10 w-10 animate-spin text-cyan-700" /> : <Upload className="h-10 w-10 text-cyan-700" />}
            <span className="mt-4 text-sm font-black text-slate-950">{parsing ? "Reading CSV..." : "Upload POS CSV export"}</span>
            <span className="mt-1 text-xs font-semibold text-slate-500">CSV files from Passport, Commander, Square, Clover, Shopify POS, and more</span>
            <input data-testid="pos-file-input" accept=".csv,text/csv" className="sr-only" disabled={parsing || loading} onChange={handleFileChange} type="file" />
          </label>
          {fileMeta ? (
            <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white">
              <p className="text-sm font-black">{fileMeta.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{rawRows.length} rows loaded</p>
            </div>
          ) : null}
          {message ? <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p> : null}
          {error ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        </div>

        <div className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-950">Column mapping</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">Choose a CSV column for each internal field, or leave it skipped.</p>
            </div>
            <button
              data-testid="pos-save-mapping"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm"
              disabled={saving}
              onClick={saveMapping}
              type="button"
            >
              <Save className="h-4 w-4" />
              Save mapping
            </button>
          </div>
          <input
            data-testid="pos-template-name"
            className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800"
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Template name"
            value={templateName}
          />
          <div className="mt-4 grid max-h-[520px] gap-3 overflow-auto pr-1 md:grid-cols-2">
            {posFieldOrder.map((field) => (
              <label className="rounded-2xl bg-slate-50 p-3" key={field}>
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{posFieldLabels[field]}</span>
                <select
                  data-testid={`pos-mapping-${field}`}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800"
                  onChange={(event) => updateMapping(field, event.target.value)}
                  value={mapping[field] ?? ""}
                >
                  <option value="">Skip / not in this export</option>
                  {columns.map((column) => (
                    <option key={column} value={column}>{column}</option>
                  ))}
                  {!columns.includes(mapping[field] ?? "") && mapping[field] ? (
                    <option value={mapping[field]}>{mapping[field]}</option>
                  ) : null}
                </select>
              </label>
            ))}
          </div>
        </div>
      </section>

      {previewRows.length ? (
        <section data-testid="pos-preview" className="mt-8 overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-card">
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-950">Preview before saving</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {importableRows.length} rows selected, {previewRows.filter((row) => row.import_action === "skip").length} skipped, {validationErrors.length} validation issues.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                data-testid="pos-duplicate-strategy"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800"
                onChange={(event) => setDuplicateStrategy(event.target.value as "skip" | "overwrite")}
                value={duplicateStrategy}
              >
                <option value="skip">Skip duplicates</option>
                <option value="overwrite">Overwrite duplicates</option>
              </select>
              <button
                data-testid="pos-save-import"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-600/20 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
                onClick={confirmImport}
                type="button"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save POS import
              </button>
            </div>
          </div>
          {validationErrors.length ? (
            <div className="border-b border-amber-100 bg-amber-50 px-5 py-3">
              {validationErrors.slice(0, 5).map((issue) => (
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-800" key={issue}>
                  <AlertTriangle className="h-4 w-4" />
                  {issue}
                </p>
              ))}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-[1700px] divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.12em] text-slate-300">
                <tr>
                  {["Save", "Date", "POS", "Txn ID", "Department", "Item", "SKU", "Qty", "Gross", "Discounts", "Refunds", "Net", "Tax", "Cash", "Card", "EBT", "Fuel gal", "Fuel sales", "Errors"].map((header) => (
                    <th className="px-4 py-3 font-black" key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((row) => (
                  <tr className={row.validation_errors.length ? "bg-amber-50/60" : "hover:bg-cyan-50/30"} key={row.row_hash}>
                    <td className="px-4 py-3">
                      <input
                        checked={row.import_action !== "skip"}
                        onChange={(event) => updateRow(row.row_hash, { import_action: event.target.checked ? "import" : "skip" })}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-4 py-3 font-bold">{row.date ?? "Missing"}</td>
                    <td className="px-4 py-3">{row.pos_name}</td>
                    <td className="px-4 py-3">{row.transaction_id ?? "-"}</td>
                    <td className="px-4 py-3">{row.department_category ?? "Unmapped"}</td>
                    <td className="px-4 py-3">{row.item_name ?? "-"}</td>
                    <td className="px-4 py-3">{row.sku_barcode ?? "-"}</td>
                    <td className="px-4 py-3">{numberFormatter.format(row.quantity_sold)}</td>
                    <td className="px-4 py-3">{currency(row.gross_sales)}</td>
                    <td className="px-4 py-3">{currency(row.discounts)}</td>
                    <td className="px-4 py-3">{currency(row.refunds)}</td>
                    <td className="px-4 py-3 font-black">{currency(row.net_sales)}</td>
                    <td className="px-4 py-3">{currency(row.tax)}</td>
                    <td className="px-4 py-3">{currency(row.cash_total)}</td>
                    <td className="px-4 py-3">{currency(row.card_total)}</td>
                    <td className="px-4 py-3">{currency(row.ebt_total)}</td>
                    <td className="px-4 py-3">{numberFormatter.format(row.fuel_gallons)}</td>
                    <td className="px-4 py-3">{currency(row.fuel_sales)}</td>
                    <td className="px-4 py-3 text-xs font-bold text-amber-700">{row.validation_errors.join(" ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <ReportCard testId="pos-source-report" title="Sales by POS source" rows={sourceReport.map((item) => [item.name, `${currency(item.sales)} across ${item.rows} rows`])} />
        <ReportCard testId="pos-payment-report" title="Payment breakdown" rows={paymentReport.map(([name, value]) => [name, currency(value)])} />
        <ReportCard testId="pos-fuel-report" title="Fuel imported" rows={[["Fuel gallons", numberFormatter.format(fuelGallons)], ["Fuel sales", currency(fuelSales)]]} />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div data-testid="pos-department-report" className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
          <h3 className="text-xl font-black text-slate-950">Department sales from POS</h3>
          <div className="mt-4 space-y-3">
            {departmentReport.length ? departmentReport.map(([name, value]) => (
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3" key={name}>
                <span className="text-sm font-bold text-slate-700">{name}</span>
                <span className="text-sm font-black text-slate-950">{currency(value)}</span>
              </div>
            )) : <p className="text-sm font-semibold text-slate-500">No POS department rows imported yet.</p>}
          </div>
        </div>

        <div data-testid="pos-import-history" className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
          <h3 className="text-xl font-black text-slate-950">Import history</h3>
          <div className="mt-4 space-y-3">
            {importHistory.slice(0, 8).map((record) => (
              <div className="rounded-2xl bg-slate-50 p-4" key={record.id}>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-cyan-700" />
                  <p className="text-sm font-black text-slate-950">{record.original_file_name}</p>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {record.pos_name} · {record.imported_row_count}/{record.row_count} rows · {record.duplicate_strategy}
                </p>
              </div>
            ))}
            {!importHistory.length ? <p className="text-sm font-semibold text-slate-500">No POS imports yet.</p> : null}
          </div>
        </div>
      </section>

      <section data-testid="pos-error-report" className="mt-8 rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
        <h3 className="text-xl font-black text-slate-950">Unmapped rows / errors</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.12em] text-slate-300">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">POS</th><th className="px-4 py-3">Row</th><th className="px-4 py-3">Errors</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {errorRows.slice(0, 10).map((row) => (
                <tr key={row.id}><td className="px-4 py-3">{row.date ?? "-"}</td><td className="px-4 py-3">{row.pos_name}</td><td className="px-4 py-3">{row.row_index}</td><td className="px-4 py-3">{row.validation_errors.join(", ")}</td></tr>
              ))}
            </tbody>
          </table>
          {!errorRows.length ? <p className="py-6 text-sm font-semibold text-slate-500">No saved POS error rows.</p> : null}
        </div>
      </section>
    </div>
  );
}

function ReportCard({ rows, testId, title }: { rows: [string, string][]; testId?: string; title: string }) {
  return (
    <div data-testid={testId} className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
      <h3 className="text-xl font-black text-slate-950">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.length ? rows.map(([label, value]) => (
          <div className="rounded-2xl bg-slate-50 p-4" key={label}>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
            <p className="mt-2 text-sm font-bold text-slate-800">{value}</p>
          </div>
        )) : <p className="text-sm font-semibold text-slate-500">No POS data imported yet.</p>}
      </div>
    </div>
  );
}
