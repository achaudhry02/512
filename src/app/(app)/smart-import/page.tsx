"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  PackageSearch,
  Upload,
  WandSparkles,
} from "lucide-react";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { currency, numberFormatter, percent, sum } from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import type { ParsedImportResult, ParsedImportRow, ProductSale, SmartImportDestination } from "@/lib/types";
import { expenseCategories, smartImportDestinations } from "@/lib/types";

const acceptedTypes = ".pdf,.csv,.xlsx,.xls";

function destinationLabel(destination: SmartImportDestination) {
  return destination.replaceAll("_", " ");
}

function productReports(productSales: ProductSale[]) {
  const products = Object.values(
    productSales.reduce<Record<string, { name: string; quantity: number; sales: number; profit: number; margin: number }>>(
      (items, sale) => {
        const key = sale.sku_upc || sale.product_name;
        const current = items[key] ?? {
          name: sale.product_name,
          quantity: 0,
          sales: 0,
          profit: 0,
          margin: 0,
        };
        current.quantity += sale.quantity_sold;
        current.sales += sale.gross_sales;
        current.profit += sale.gross_profit;
        current.margin = current.sales > 0 ? (current.profit / current.sales) * 100 : 0;
        items[key] = current;
        return items;
      },
      {},
    ),
  );
  const vendors = Object.values(
    productSales.reduce<Record<string, { name: string; spend: number; sales: number }>>((items, sale) => {
      const name = sale.vendor || "Unknown vendor";
      const current = items[name] ?? { name, spend: 0, sales: 0 };
      current.spend += sale.quantity_sold * sale.unit_cost;
      current.sales += sale.gross_sales;
      items[name] = current;
      return items;
    }, {}),
  );
  const categories = Object.values(
    productSales.reduce<Record<string, { name: string; sales: number; cost: number; profit: number; margin: number }>>(
      (items, sale) => {
        const current = items[sale.category] ?? { name: sale.category, sales: 0, cost: 0, profit: 0, margin: 0 };
        current.sales += sale.gross_sales;
        current.cost += sale.quantity_sold * sale.unit_cost;
        current.profit += sale.gross_profit;
        current.margin = current.sales > 0 ? (current.profit / current.sales) * 100 : 0;
        items[sale.category] = current;
        return items;
      },
      {},
    ),
  );
  const monthTrends = Object.values(
    productSales.reduce<Record<string, { name: string; sales: number; quantity: number }>>((items, sale) => {
      const name = sale.date.slice(0, 7);
      const current = items[name] ?? { name, sales: 0, quantity: 0 };
      current.sales += sale.gross_sales;
      current.quantity += sale.quantity_sold;
      items[name] = current;
      return items;
    }, {}),
  ).sort((a, b) => a.name.localeCompare(b.name));
  const vendorMonthSpend = productSales.reduce<Record<string, number>>((items, sale) => {
    const key = `${sale.vendor || "Unknown vendor"}|${sale.date.slice(0, 7)}`;
    items[key] = (items[key] ?? 0) + sale.quantity_sold * sale.unit_cost;
    return items;
  }, {});
  const vendorMonthOverMonth = vendors
    .map((vendor) => {
      const months = Object.entries(vendorMonthSpend)
        .filter(([key]) => key.startsWith(`${vendor.name}|`))
        .map(([key, spend]) => ({ month: key.split("|")[1], spend }))
        .sort((a, b) => a.month.localeCompare(b.month));
      const current = months[months.length - 1]?.spend ?? 0;
      const previous = months[months.length - 2]?.spend ?? 0;
      return {
        name: vendor.name,
        change: current - previous,
      };
    })
    .filter((vendor) => vendor.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const weekTrends = Object.values(
    productSales.reduce<Record<string, { name: string; sales: number; quantity: number }>>((items, sale) => {
      const date = new Date(`${sale.date}T00:00:00`);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const name = weekStart.toISOString().slice(0, 10);
      const current = items[name] ?? { name, sales: 0, quantity: 0 };
      current.sales += sale.gross_sales;
      current.quantity += sale.quantity_sold;
      items[name] = current;
      return items;
    }, {}),
  ).sort((a, b) => a.name.localeCompare(b.name));

  return {
    bestSelling: [...products].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    worstSelling: [...products].sort((a, b) => a.quantity - b.quantity).slice(0, 5),
    highestMargin: [...products].sort((a, b) => b.margin - a.margin).slice(0, 5),
    lowestMargin: [...products].sort((a, b) => a.margin - b.margin).slice(0, 5),
    deadInventory: products.filter((product) => product.quantity <= 2 || product.margin < 10).slice(0, 5),
    topVendors: [...vendors].sort((a, b) => b.spend - a.spend).slice(0, 5),
    topCategories: [...categories].sort((a, b) => b.sales - a.sales).slice(0, 5),
    categoryProfit: [...categories].sort((a, b) => b.profit - a.profit),
    vendorSpend: [...vendors].sort((a, b) => b.spend - a.spend),
    vendorMonthOverMonth,
    monthTrends,
    weekTrends,
  };
}

export default function SmartImportPage() {
  const { authLoading, data, saveSmartImport } = useCommandCenter();
  const [parsedImport, setParsedImport] = useState<ParsedImportResult | null>(null);
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const reports = useMemo(() => productReports(data.product_sales), [data.product_sales]);
  const duplicateFile = parsedImport
    ? data.imports.some((record) => record.file_hash === parsedImport.fileHash)
    : false;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "rules",
        JSON.stringify({
          category_rules: data.category_rules,
          vendor_rules: data.vendor_rules,
          product_rules: data.product_rules,
        }),
      );
      const response = await fetch("/api/smart-import/parse", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to parse file.");
      }

      setParsedImport(payload as ParsedImportResult);
      setRows((payload as ParsedImportResult).rows);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to parse file.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function updateRow(rowHash: string, patch: Partial<ParsedImportRow>) {
    setRows((current) =>
      current.map((row) => (row.rowHash === rowHash ? { ...row, ...patch } : row)),
    );
  }

  async function confirmImport() {
    if (!parsedImport) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await saveSmartImport(parsedImport, rows);
      setMessage("Import confirmed. Rows were saved to the selected destinations.");
      setParsedImport(null);
      setRows([]);
    } catch (saveError) {
      console.error("Smart Import confirm error:", saveError);

      const message =
        saveError instanceof Error
          ? saveError.message
          : typeof saveError === "object" && saveError !== null && "message" in saveError
            ? String((saveError as { message?: unknown }).message)
            : JSON.stringify(saveError);

      setError(message || "Unable to confirm import.");
    } finally {
      setSaving(false);
    }
  }

  const reviewableRows = rows.filter((row) => !row.ignored && row.importDestination !== "ignore");
  const needsReviewCount = rows.filter((row) => row.needsReview || row.importDestination === "needs_review").length;

  return (
    <div>
      <PageHeader
        eyebrow="Smart Import"
        title="Upload statements, invoices, and sales reports"
        description="Parse PDFs, Excel workbooks, and CSV files, auto-categorize messy line items, review every row, then import only after confirmation."
      />

      <section className="mb-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-card">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-950 text-cyan-300">
            <WandSparkles className="h-7 w-7" />
          </div>
          <h3 className="text-2xl font-black text-slate-950">Smart Import workflow</h3>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
            Upload bank statements, vendor invoices, Capital Candy invoices, POS reports, payroll exports, fuel reports, or lottery reports.
          </p>
          <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-cyan-200 bg-cyan-50/70 px-6 py-10 text-center transition hover:border-cyan-400 hover:bg-cyan-50">
            {uploading ? <Loader2 className="h-10 w-10 animate-spin text-cyan-700" /> : <Upload className="h-10 w-10 text-cyan-700" />}
            <span className="mt-4 text-sm font-black text-slate-950">
              {uploading ? "Reading file..." : "Choose PDF, Excel, or CSV"}
            </span>
            <span className="mt-1 text-xs font-semibold text-slate-500">{acceptedTypes}</span>
            <input accept={acceptedTypes} className="sr-only" disabled={uploading} onChange={handleFileChange} type="file" />
          </label>
          <div className="mt-5 grid gap-3 text-sm text-slate-600">
            {[
              "Rows are never saved until Confirm Import.",
              "Unclear PDF extraction is marked Needs Review.",
              "File hashes and row hashes prevent duplicate imports.",
            ].map((item) => (
              <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 font-semibold" key={item}>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-card">
          <h3 className="text-xl font-black text-slate-950">Import status</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Imported files</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{data.imports.length}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Product rows</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{data.product_sales.length}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Vendors</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{data.vendors.length}</p>
            </div>
          </div>
          <div className="mt-3 rounded-2xl bg-cyan-50 p-4 text-sm font-bold text-cyan-800">
            Learning system active: {data.vendor_rules.length + data.product_rules.length + data.category_rules.length} saved rules will be checked before built-in guesses.
          </div>
          {authLoading ? (
            <div className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
              Checking login...
            </div>
          ) : null}
          {message ? <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</p> : null}
          {error ? <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}
          {parsedImport ? (
            <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
              <p className="text-sm font-black">{parsedImport.fileName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {parsedImport.rows.length} extracted rows · parser: {parsedImport.parser}
              </p>
              {parsedImport.reportType ? (
                <p className="mt-2 text-xs font-bold text-cyan-200">
                  Report type: {parsedImport.reportType === "department_sales" ? "Department Sales" : "Store Sales Summary"}
                  {parsedImport.reportStartDate || parsedImport.reportEndDate
                    ? ` · Period: ${parsedImport.reportStartDate ?? "unknown"} to ${parsedImport.reportEndDate ?? "unknown"}`
                    : ""}
                </p>
              ) : null}
              {duplicateFile ? (
                <p className="mt-3 rounded-xl bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-100 ring-1 ring-rose-300/20">
                  Duplicate file detected. Confirm Import is disabled for this file hash.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {parsedImport?.reportType ? (
        <section className="mb-8 space-y-4 rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
          <div>
            <h3 className="text-xl font-black text-slate-950">
              {parsedImport.reportType === "department_sales" ? "Department Sales preview" : "Store Sales Summary preview"}
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Parser attempted: {parsedImport.parserAttempted ?? parsedImport.parser}
            </p>
            {parsedImport.parseError ? (
              <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
                Parsing error: {parsedImport.parseError}
              </p>
            ) : null}
          </div>

          {parsedImport.departmentSalesRows?.length ? (
            <div className="overflow-x-auto rounded-3xl border border-slate-100">
              <table className="min-w-[1100px] divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.12em] text-slate-300">
                  <tr>
                    {["Department", "Gross Sales", "Item Count", "Refunds", "Net Count", "Refund Amount", "Discounts", "Net Sales", "% Sales"].map((header) => (
                      <th className="px-4 py-3 font-black" key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedImport.departmentSalesRows.map((row) => (
                    <tr key={row.departmentName}>
                      <td className="px-4 py-3 font-bold text-slate-900">{row.departmentName}</td>
                      <td className="px-4 py-3">{currency(row.grossSales)}</td>
                      <td className="px-4 py-3">{numberFormatter.format(row.itemCount)}</td>
                      <td className="px-4 py-3">{numberFormatter.format(row.refundCount)}</td>
                      <td className="px-4 py-3">{numberFormatter.format(row.netCount)}</td>
                      <td className="px-4 py-3">{currency(row.refundAmount)}</td>
                      <td className="px-4 py-3">{currency(row.discountAmount)}</td>
                      <td className="px-4 py-3 font-black">{currency(row.netSales)}</td>
                      <td className="px-4 py-3">{percent(row.percentOfSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {parsedImport.storeSalesSummary ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Fuel sales", parsedImport.storeSalesSummary.totalFuelSalesDollars],
                ["Non fuel sales", parsedImport.storeSalesSummary.totalNonFuelSales],
                ["Total sales", parsedImport.storeSalesSummary.totalSales],
                ["Total revenue", parsedImport.storeSalesSummary.totalRevenue],
              ].map(([label, value]) => (
                <div className="rounded-2xl bg-slate-50 p-4" key={label}>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                  <p className="mt-2 text-xl font-black text-slate-950">{currency(Number(value))}</p>
                </div>
              ))}
            </div>
          ) : null}

          {parsedImport.fuelGradeSalesRows?.length ? (
            <div className="overflow-x-auto rounded-3xl border border-slate-100">
              <table className="min-w-[720px] divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.12em] text-slate-300">
                  <tr>{["Grade", "Name", "Volume", "Sales", "% Fuel Sales"].map((header) => <th className="px-4 py-3 font-black" key={header}>{header}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedImport.fuelGradeSalesRows.map((row) => (
                    <tr key={row.grade}>
                      <td className="px-4 py-3 font-bold">{row.grade}</td>
                      <td className="px-4 py-3">{row.gradeName}</td>
                      <td className="px-4 py-3">{numberFormatter.format(row.volume)}</td>
                      <td className="px-4 py-3 font-black">{currency(row.sales)}</td>
                      <td className="px-4 py-3">{percent(row.percentOfTotalFuelSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {parsedImport.tenderSalesRows?.length ? (
            <div className="overflow-x-auto rounded-3xl border border-slate-100">
              <table className="min-w-[520px] divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.12em] text-slate-300">
                  <tr>{["Payment Method", "Count", "Sales Amount"].map((header) => <th className="px-4 py-3 font-black" key={header}>{header}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedImport.tenderSalesRows.map((row) => (
                    <tr key={row.paymentMethod}>
                      <td className="px-4 py-3 font-bold">{row.paymentMethod}</td>
                      <td className="px-4 py-3">{numberFormatter.format(row.count)}</td>
                      <td className="px-4 py-3 font-black">{currency(row.salesAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {parsedImport.rawTextPreview ? (
            <details className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-black text-slate-800">
                Raw extracted text debug
              </summary>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">
                {parsedImport.rawTextPreview}
              </pre>
            </details>
          ) : null}
        </section>
      ) : null}

      {parsedImport ? (
        <section className="mb-8 overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-card">
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-950">Review before saving</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {reviewableRows.length} rows selected · {needsReviewCount} need review
              </p>
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving || duplicateFile || authLoading}
              onClick={confirmImport}
              type="button"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {authLoading ? "Checking login..." : "Confirm Import"}
            </button>
          </div>
          {parsedImport.warnings.length ? (
            <div className="border-b border-amber-100 bg-amber-50 px-5 py-3">
              {parsedImport.warnings.map((warning) => (
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-800" key={warning}>
                  <AlertTriangle className="h-4 w-4" />
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-[1800px] divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.12em] text-slate-300">
                <tr>
                  {[
                    "Save",
                    "Date",
                    "Vendor",
                    "Description",
                    "Product name",
                    "SKU / UPC",
                    "Qty",
                    "Unit cost",
                    "Unit price",
                    "Total",
                    "Suggested category",
                    "Confidence",
                    "Destination",
                  ].map((header) => (
                    <th className="px-4 py-3 font-black" key={header}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr className={row.needsReview ? "bg-amber-50/50" : "hover:bg-cyan-50/30"} key={row.rowHash}>
                    <td className="px-4 py-3">
                      <input
                        checked={!row.ignored && row.importDestination !== "ignore"}
                        onChange={(event) =>
                          updateRow(row.rowHash, {
                            ignored: !event.target.checked,
                            importDestination: event.target.checked ? row.importDestination : "ignore",
                          })
                        }
                        type="checkbox"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input className="w-36 rounded-xl border border-slate-200 px-3 py-2 font-semibold" onChange={(event) => updateRow(row.rowHash, { date: event.target.value })} type="date" value={row.date ?? ""} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="w-44 rounded-xl border border-slate-200 px-3 py-2 font-semibold" onChange={(event) => updateRow(row.rowHash, { vendor: event.target.value })} value={row.vendor} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="w-72 rounded-xl border border-slate-200 px-3 py-2 font-semibold" onChange={(event) => updateRow(row.rowHash, { description: event.target.value })} value={row.description} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="w-56 rounded-xl border border-slate-200 px-3 py-2 font-semibold" onChange={(event) => updateRow(row.rowHash, { productName: event.target.value })} value={row.productName} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="w-40 rounded-xl border border-slate-200 px-3 py-2 font-semibold" onChange={(event) => updateRow(row.rowHash, { skuUpc: event.target.value })} value={row.skuUpc} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="w-24 rounded-xl border border-slate-200 px-3 py-2 font-semibold" onChange={(event) => updateRow(row.rowHash, { quantity: Number(event.target.value) })} step="0.001" type="number" value={row.quantity} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="w-28 rounded-xl border border-slate-200 px-3 py-2 font-semibold" onChange={(event) => updateRow(row.rowHash, { unitCost: Number(event.target.value) })} step="0.0001" type="number" value={row.unitCost} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="w-28 rounded-xl border border-slate-200 px-3 py-2 font-semibold" onChange={(event) => updateRow(row.rowHash, { unitRetailPrice: Number(event.target.value) })} step="0.0001" type="number" value={row.unitRetailPrice} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="w-28 rounded-xl border border-slate-200 px-3 py-2 font-semibold" onChange={(event) => updateRow(row.rowHash, { total: Number(event.target.value) })} step="0.01" type="number" value={row.total} />
                    </td>
                    <td className="px-4 py-3">
                      <select className="w-52 rounded-xl border border-slate-200 px-3 py-2 font-semibold" onChange={(event) => updateRow(row.rowHash, { suggestedCategory: event.target.value as ParsedImportRow["suggestedCategory"], needsReview: false })} value={row.suggestedCategory}>
                        {expenseCategories.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.confidenceScore < 60 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {row.confidenceScore}%
                      </span>
                      {row.confidenceScore === 95 ? (
                        <p className="mt-1 text-[11px] font-bold text-cyan-700">learned rule</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <select className="w-44 rounded-xl border border-slate-200 px-3 py-2 font-semibold" onChange={(event) => updateRow(row.rowHash, { importDestination: event.target.value as SmartImportDestination, needsReview: event.target.value === "needs_review" })} value={row.importDestination}>
                        {smartImportDestinations.map((destination) => (
                          <option key={destination} value={destination}>{destinationLabel(destination)}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-3">
        <ReportCard
          icon={<PackageSearch className="h-5 w-5" />}
          title="Product Sales Breakdown"
          rows={[
            ["Best-selling products", reports.bestSelling.map((item) => `${item.name} (${numberFormatter.format(item.quantity)})`).join(", ") || "No product sales yet"],
            ["Worst-selling products", reports.worstSelling.map((item) => `${item.name} (${numberFormatter.format(item.quantity)})`).join(", ") || "No product sales yet"],
            ["Highest-margin products", reports.highestMargin.map((item) => `${item.name} (${percent(item.margin)})`).join(", ") || "No product sales yet"],
            ["Lowest-margin products", reports.lowestMargin.map((item) => `${item.name} (${percent(item.margin)})`).join(", ") || "No product sales yet"],
            ["Dead inventory", reports.deadInventory.map((item) => item.name).join(", ") || "None detected"],
            ["Weekly trends", reports.weekTrends.map((item) => `${item.name}: ${currency(item.sales)}`).join(", ") || "No weekly trend yet"],
            ["Monthly trends", reports.monthTrends.map((item) => `${item.name}: ${currency(item.sales)}`).join(", ") || "No monthly trend yet"],
          ]}
        />
        <ReportCard
          icon={<FileText className="h-5 w-5" />}
          title="Vendor Spend Report"
          rows={[
            ["Top vendors", reports.topVendors.map((item) => `${item.name}: ${currency(item.spend)}`).join(", ") || "No vendor data yet"],
            ["Month-over-month", reports.vendorMonthOverMonth.map((item) => `${item.name}: ${item.change >= 0 ? "+" : ""}${currency(item.change)}`).join(", ") || "No month-over-month change yet"],
            ["Capital Candy spend", currency(sum(data.product_sales.filter((sale) => sale.vendor?.toLowerCase().includes("capital candy")).map((sale) => sale.quantity_sold * sale.unit_cost)))],
            ["Inventory cost trends", reports.vendorSpend.map((item) => `${item.name}: ${currency(item.spend)}`).join(", ") || "No spend yet"],
          ]}
        />
        <ReportCard
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title="Category Profit Report"
          rows={[
            ...reports.categoryProfit.slice(0, 6).map((item) => [
              item.name,
              `${currency(item.sales)} sales · ${currency(item.cost)} cost · ${currency(item.profit)} profit · ${percent(item.margin)} margin`,
            ] as [string, string]),
            ...(reports.categoryProfit.length ? [] : [["No category data", "Upload a POS or vendor report to populate category profit."] as [string, string]]),
          ]}
        />
      </section>
    </div>
  );
}

function ReportCard({
  icon,
  rows,
  title,
}: {
  icon: ReactNode;
  rows: [string, string][];
  title: string;
}) {
  return (
    <div className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl bg-slate-950 p-3 text-cyan-300">{icon}</div>
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
      </div>
      <div className="space-y-3">
        {rows.map(([label, value]) => (
          <div className="rounded-2xl bg-slate-50 p-4" key={label}>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-800">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
