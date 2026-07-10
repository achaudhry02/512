"use client";

import {
  Barcode,
  Boxes,
  ClipboardList,
  Download,
  PackageCheck,
  Plus,
  ScanBarcode,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { ResourceManager, type ResourceField } from "@/components/resource-manager";
import { currency, percent } from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import { buildMenuExportCsv, inventoryInsights } from "@/lib/inventory-operations";
import { storeCategories, type InventoryAdjustmentType, type Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type InventoryTab = "catalog" | "purchase-orders" | "adjustments" | "insights";
type PurchaseOrderLine = { productId: string; quantity: number; unitCost: number };

const manualAdjustmentTypes: { value: InventoryAdjustmentType; label: string }[] = [
  { value: "receipt", label: "Manual receipt" },
  { value: "shrink", label: "Shrink" },
  { value: "loss", label: "Loss / theft" },
  { value: "damage", label: "Damage / spoilage" },
  { value: "count", label: "Physical count correction" },
  { value: "return", label: "Customer/vendor return" },
  { value: "correction", label: "Other correction" },
];

function InventoryStat({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "red" | "emerald" | "amber" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-950",
    red: "border-red-200 bg-red-50 text-red-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return <div className={cn("rounded-lg border p-4", tones[tone])}><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>;
}

function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">{children}</div>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return <tr><td className="px-4 py-10 text-center text-sm font-semibold text-slate-500" colSpan={colSpan}>{text}</td></tr>;
}

export default function InventoryPage() {
  const {
    cancelPurchaseOrder,
    createPurchaseOrder,
    data,
    deleteResource,
    loading,
    receivePurchaseOrder,
    saveInventoryAdjustment,
    saveResource,
  } = useCommandCenter();
  const [tab, setTab] = useState<InventoryTab>("catalog");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [matchedProductId, setMatchedProductId] = useState<string | null>(null);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [showPurchaseOrderForm, setShowPurchaseOrderForm] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [purchaseLines, setPurchaseLines] = useState<PurchaseOrderLine[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [pendingOrderAction, setPendingOrderAction] = useState<{ id: string; kind: "receive" | "cancel" } | null>(null);
  const [adjustmentProductId, setAdjustmentProductId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<InventoryAdjustmentType>("shrink");
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("");
  const [adjustmentDate, setAdjustmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  const insights = useMemo(
    () => inventoryInsights(data.products, data.product_sales, data.inventory_adjustments, data.vendor_item_costs),
    [data.inventory_adjustments, data.product_sales, data.products, data.vendor_item_costs],
  );
  const matchedProduct = data.products.find((product) => product.id === matchedProductId) ?? null;
  const menuProductCount = data.products.filter((product) => product.menu_export_enabled).length;
  const vendorById = new Map(data.vendors.map((vendor) => [vendor.id, vendor]));

  const vendorOptions = [{ label: "No vendor", value: "" }, ...data.vendors.map((vendor) => ({ label: vendor.name, value: vendor.id }))];
  const fields: ResourceField[] = [
    { name: "name", label: "Product name", type: "text", required: true },
    { name: "sku_upc", label: "SKU / barcode", type: "text", placeholder: "Scan or type barcode" },
    { name: "category", label: "Category", type: "select", required: true, options: storeCategories.map((category) => ({ label: category, value: category })) },
    { name: "vendor_id", label: "Vendor", type: "select", options: vendorOptions },
    { name: "unit_cost", label: "Cost price", type: "number", min: "0", step: "0.01", required: true },
    { name: "unit_retail_price", label: "Sell price", type: "number", min: "0", step: "0.01", required: true },
    { name: "quantity_on_hand", label: "Quantity on hand", type: "number", step: "0.001", required: true },
    { name: "reorder_level", label: "Reorder level", type: "number", min: "0", step: "0.001", required: true },
    { name: "menu_export_enabled", label: "Include in menu export", type: "checkbox" },
    { name: "menu_name", label: "Menu name", type: "text" },
    { name: "menu_category", label: "Menu category", type: "text" },
    { name: "menu_description", label: "Menu description", type: "textarea", className: "md:col-span-2" },
    { name: "notes", label: "Internal notes", type: "textarea", className: "md:col-span-2" },
  ];

  function resetMessages() {
    setOperationMessage(null);
    setOperationError(null);
  }

  function handleBarcodeLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    const normalized = barcodeValue.trim().toLowerCase();
    const match = data.products.find((product) => product.sku_upc?.toLowerCase() === normalized)
      ?? data.products.find((product) => product.name.toLowerCase() === normalized);
    setMatchedProductId(match?.id ?? null);
    if (!match) setOperationError("No inventory item matches that barcode or exact product name.");
  }

  function openAdjustmentForProduct(productId: string, type: InventoryAdjustmentType = "receipt") {
    resetMessages();
    setAdjustmentProductId(productId);
    setAdjustmentType(type);
    setAdjustmentQuantity("");
    setTab("adjustments");
  }

  function downloadMenuExport() {
    const csv = buildMenuExportCsv(data.products);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `inventory-menu-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function addPurchaseLine() {
    const unusedProduct = data.products.find((product) => !purchaseLines.some((line) => line.productId === product.id));
    if (!unusedProduct) {
      setOperationError("All inventory products are already on this order.");
      return;
    }
    setPurchaseLines((current) => [...current, { productId: unusedProduct.id, quantity: 1, unitCost: unusedProduct.unit_cost }]);
  }

  async function handleCreatePurchaseOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setSavingOrder(true);
    try {
      await createPurchaseOrder({
        vendorId,
        expectedDate: expectedDate || null,
        notes: purchaseNotes.trim() || null,
        items: purchaseLines,
      });
      setVendorId("");
      setExpectedDate("");
      setPurchaseNotes("");
      setPurchaseLines([]);
      setShowPurchaseOrderForm(false);
      setOperationMessage("Purchase order created.");
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Unable to create purchase order.");
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleReceiveOrder(id: string) {
    resetMessages();
    try {
      await receivePurchaseOrder(id);
      setPendingOrderAction(null);
      setOperationMessage("Purchase order received and inventory updated.");
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Unable to receive purchase order.");
    }
  }

  async function handleCancelOrder(id: string) {
    resetMessages();
    try {
      await cancelPurchaseOrder(id);
      setPendingOrderAction(null);
      setOperationMessage("Purchase order cancelled.");
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Unable to cancel purchase order.");
    }
  }

  async function handleAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setSavingAdjustment(true);
    try {
      const enteredQuantity = Number(adjustmentQuantity);
      const negativeType = ["shrink", "loss", "damage"].includes(adjustmentType);
      const quantityDelta = negativeType ? -Math.abs(enteredQuantity) : enteredQuantity;
      await saveInventoryAdjustment({
        productId: adjustmentProductId,
        adjustmentType,
        quantityDelta,
        adjustmentDate,
        reason: adjustmentReason.trim() || null,
        notes: adjustmentNotes.trim() || null,
      });
      setAdjustmentQuantity("");
      setAdjustmentReason("");
      setAdjustmentNotes("");
      setOperationMessage("Inventory adjustment saved and stock updated.");
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Unable to save inventory adjustment.");
    } finally {
      setSavingAdjustment(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Inventory operations"
        title="Inventory"
        description="Manage products, purchase orders, receiving, stock adjustments, reorder decisions, and menu exports."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InventoryStat label="Inventory value" value={currency(insights.inventoryValue)} />
        <InventoryStat label="Low stock" value={String(insights.lowStock.length)} tone={insights.lowStock.length ? "red" : "emerald"} />
        <InventoryStat label="Dead stock value" value={currency(insights.deadStock.reduce((total, entry) => total + entry.tiedUpValue, 0))} tone="amber" />
        <InventoryStat label="Shrink / loss" value={currency(insights.shrinkLoss.cost)} tone={insights.shrinkLoss.cost ? "red" : "emerald"} />
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1" role="tablist" aria-label="Inventory sections">
        {([
          ["catalog", "Catalog", Boxes],
          ["purchase-orders", "Purchase orders", ClipboardList],
          ["adjustments", "Adjustments", PackageCheck],
          ["insights", "Insights", TrendingUp],
        ] as const).map(([value, label, Icon]) => (
          <button
            aria-selected={tab === value}
            className={cn("inline-flex min-w-max flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-black", tab === value ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50")}
            key={value}
            onClick={() => setTab(value)}
            role="tab"
            type="button"
          ><Icon className="h-4 w-4" />{label}</button>
        ))}
      </div>

      {operationMessage ? <div className="mb-5 border-l-4 border-emerald-500 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{operationMessage}</div> : null}
      {operationError ? <div className="mb-5 border-l-4 border-red-500 bg-red-50 p-4 text-sm font-bold text-red-800">{operationError}</div> : null}

      {tab === "catalog" ? (
        <div className="space-y-6">
          <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <form onSubmit={handleBarcodeLookup}>
              <label className="block text-xs font-black uppercase text-slate-500" htmlFor="barcode-lookup">Barcode scanner lookup</label>
              <div className="mt-2 flex gap-2">
                <div className="relative flex-1"><ScanBarcode className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" /><input autoComplete="off" autoFocus className="w-full rounded-lg border border-slate-200 py-3 pl-11 pr-3 text-base font-bold outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" id="barcode-lookup" onChange={(event) => setBarcodeValue(event.target.value)} placeholder="Scan barcode and press Enter" value={barcodeValue} /></div>
                <button aria-label="Find barcode" className="rounded-lg bg-cyan-600 px-4 text-white" type="submit"><Barcode className="h-5 w-5" /></button>
              </div>
              {matchedProduct ? <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span className="font-black text-slate-950">{matchedProduct.name}</span><span className="text-slate-500">{matchedProduct.quantity_on_hand} on hand</span><button className="font-black text-cyan-700" onClick={() => openAdjustmentForProduct(matchedProduct.id)} type="button">Receive or adjust</button></div> : null}
            </form>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={!menuProductCount} onClick={downloadMenuExport} type="button"><Download className="h-4 w-4" />Export menu CSV ({menuProductCount})</button>
          </section>

          <ResourceManager<Product>
            addLabel="Add product"
            columns={[
              { header: "Product", cell: (row) => <div><p className="font-black text-slate-950">{row.name}</p><p className="text-xs text-slate-500">{row.sku_upc || "No SKU"}</p></div> },
              { header: "Category", cell: (row) => row.category },
              { header: "Cost / price", cell: (row) => `${currency(row.unit_cost)} / ${currency(row.unit_retail_price)}` },
              { header: "Margin", cell: (row) => percent(row.unit_retail_price > 0 ? ((row.unit_retail_price - row.unit_cost) / row.unit_retail_price) * 100 : 0) },
              { header: "Stock", cell: (row) => <button className={cn("rounded-full px-2 py-1 text-xs font-black", row.quantity_on_hand <= row.reorder_level ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700")} onClick={() => openAdjustmentForProduct(row.id)} type="button">{row.quantity_on_hand}{row.quantity_on_hand <= row.reorder_level ? " Low" : ""}</button> },
              { header: "Menu", cell: (row) => row.menu_export_enabled ? "Included" : "Not included" },
            ]}
            defaultValues={{ name: "", sku_upc: "", category: "Grocery", vendor_id: "", product_category_id: "", unit_cost: 0, unit_retail_price: 0, quantity_on_hand: 0, reorder_level: 5, menu_export_enabled: false, menu_name: "", menu_description: "", menu_category: "", notes: "" }}
            description="Scan barcodes, track cost and retail price, set reorder points, and choose products for delivery-menu export."
            emptyMessage="No products found. Add or scan the first inventory item."
            fields={fields}
            filterField={{ label: "Categories", options: [...storeCategories], value: (row) => row.category }}
            getSearchText={(row) => `${row.name} ${row.sku_upc ?? ""} ${row.category}`}
            loading={loading}
            onDelete={(id) => deleteResource("products", id)}
            onSave={(payload, id) => saveResource("products", payload, id)}
            preparePayload={(values) => ({
              name: String(values.name).trim(), sku_upc: String(values.sku_upc).trim() || null,
              category: String(values.category), vendor_id: String(values.vendor_id) || null, product_category_id: null,
              unit_cost: Number(values.unit_cost), unit_retail_price: Number(values.unit_retail_price),
              quantity_on_hand: Number(values.quantity_on_hand), reorder_level: Number(values.reorder_level),
              menu_export_enabled: Boolean(values.menu_export_enabled), menu_name: String(values.menu_name).trim() || null,
              menu_description: String(values.menu_description).trim() || null, menu_category: String(values.menu_category).trim() || null,
              notes: String(values.notes).trim() || null,
            })}
            rows={data.products}
            title="Product catalog"
          />
        </div>
      ) : null}

      {tab === "purchase-orders" ? (
        <section>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-black text-slate-950">Purchase orders</h3><p className="mt-1 text-sm text-slate-500">Create vendor orders and receive every outstanding line into stock.</p></div><button className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white" onClick={() => { setShowPurchaseOrderForm((current) => !current); resetMessages(); if (!purchaseLines.length) addPurchaseLine(); }} type="button"><Plus className="h-4 w-4" />New purchase order</button></div>
          {showPurchaseOrderForm ? (
            <form className="mb-6 rounded-lg border border-slate-200 bg-white" onSubmit={handleCreatePurchaseOrder}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h4 className="font-black text-slate-950">New purchase order</h4><button aria-label="Close purchase order form" onClick={() => setShowPurchaseOrderForm(false)} type="button"><X className="h-5 w-5" /></button></div>
              <div className="grid gap-4 p-5 md:grid-cols-3"><label className="block"><span className="text-xs font-black uppercase text-slate-500">Vendor</span><select className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm" onChange={(event) => setVendorId(event.target.value)} required value={vendorId}><option value="">Select vendor</option>{data.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label><label className="block"><span className="text-xs font-black uppercase text-slate-500">Expected date</span><input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm" onChange={(event) => setExpectedDate(event.target.value)} type="date" value={expectedDate} /></label><label className="block"><span className="text-xs font-black uppercase text-slate-500">Notes</span><input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm" onChange={(event) => setPurchaseNotes(event.target.value)} value={purchaseNotes} /></label></div>
              <div className="border-t border-slate-100 px-5 py-4"><div className="space-y-3">{purchaseLines.map((line, index) => <div className="grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_8rem_9rem_auto]" key={`${line.productId}-${index}`}><select aria-label={`Product ${index + 1}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" onChange={(event) => { const product = data.products.find((entry) => entry.id === event.target.value); setPurchaseLines((current) => current.map((entry, lineIndex) => lineIndex === index ? { ...entry, productId: event.target.value, unitCost: product?.unit_cost ?? 0 } : entry)); }} value={line.productId}>{data.products.map((product) => <option key={product.id} value={product.id}>{product.name} {product.sku_upc ? `(${product.sku_upc})` : ""}</option>)}</select><input aria-label={`Quantity ${index + 1}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" min="0.001" onChange={(event) => setPurchaseLines((current) => current.map((entry, lineIndex) => lineIndex === index ? { ...entry, quantity: Number(event.target.value) } : entry))} step="0.001" type="number" value={line.quantity} /><input aria-label={`Unit cost ${index + 1}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" min="0" onChange={(event) => setPurchaseLines((current) => current.map((entry, lineIndex) => lineIndex === index ? { ...entry, unitCost: Number(event.target.value) } : entry))} step="0.0001" type="number" value={line.unitCost} /><button aria-label={`Remove line ${index + 1}`} className="rounded-lg border border-slate-200 bg-white p-2 text-red-600" onClick={() => setPurchaseLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} type="button"><X className="h-4 w-4" /></button></div>)}</div><button className="mt-3 text-sm font-black text-cyan-700" onClick={addPurchaseLine} type="button">+ Add line</button></div>
              <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-black text-slate-700">Order total: {currency(purchaseLines.reduce((total, line) => total + line.quantity * line.unitCost, 0))}</p><button className="rounded-lg bg-cyan-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50" disabled={savingOrder || !purchaseLines.length} type="submit">{savingOrder ? "Creating..." : "Create purchase order"}</button></div>
            </form>
          ) : null}
          <div className="space-y-3">{data.purchase_orders.map((order) => { const items = data.purchase_order_items.filter((item) => item.purchase_order_id === order.id); const canAct = !["received", "cancelled"].includes(order.status); const pendingAction = pendingOrderAction?.id === order.id ? pendingOrderAction.kind : null; return <article className="rounded-lg border border-slate-200 bg-white p-5" key={order.id}><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-black text-slate-950">{order.po_number}</h4><span className={cn("rounded-full px-2 py-1 text-xs font-black capitalize", order.status === "received" ? "bg-emerald-100 text-emerald-700" : order.status === "cancelled" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700")}>{order.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-sm text-slate-500">{vendorById.get(order.vendor_id)?.name ?? "Unknown vendor"} - Ordered {order.order_date}{order.expected_date ? ` - Expected ${order.expected_date}` : ""}</p></div><div className="flex flex-wrap gap-2"><span className="px-2 py-2 text-sm font-black text-slate-950">{currency(order.total_cost)}</span>{canAct && !pendingAction ? <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-black text-white" onClick={() => setPendingOrderAction({ id: order.id, kind: "receive" })} type="button">Receive all</button> : null}{canAct && !pendingAction ? <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-slate-600" onClick={() => setPendingOrderAction({ id: order.id, kind: "cancel" })} type="button">Cancel</button> : null}{pendingAction === "receive" ? <button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-black text-white" onClick={() => void handleReceiveOrder(order.id)} type="button">Confirm receive</button> : null}{pendingAction === "cancel" ? <button className="rounded-lg bg-red-700 px-3 py-2 text-sm font-black text-white" onClick={() => void handleCancelOrder(order.id)} type="button">Confirm cancel</button> : null}{pendingAction ? <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-slate-600" onClick={() => setPendingOrderAction(null)} type="button">Keep open</button> : null}</div></div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <div className="rounded-lg bg-slate-50 p-3 text-sm" key={item.id}><p className="font-black text-slate-800">{item.product_name}</p><p className="mt-1 text-slate-500">{item.received_quantity} / {item.ordered_quantity} received - {currency(item.unit_cost)} each</p></div>)}</div></article>; })}{!data.purchase_orders.length ? <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm font-semibold text-slate-500">No purchase orders yet.</div> : null}</div>
        </section>
      ) : null}

      {tab === "adjustments" ? (
        <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <form className="h-fit rounded-lg border border-slate-200 bg-white p-5" onSubmit={handleAdjustment}><h3 className="text-xl font-black text-slate-950">Record stock adjustment</h3><p className="mt-1 text-sm text-slate-500">Use negative quantities for count/correction entries that reduce stock.</p><div className="mt-5 space-y-4"><label className="block"><span className="text-xs font-black uppercase text-slate-500">Product</span><select className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm" onChange={(event) => setAdjustmentProductId(event.target.value)} required value={adjustmentProductId}><option value="">Select product</option>{data.products.map((product) => <option key={product.id} value={product.id}>{product.name} - {product.quantity_on_hand} on hand</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-xs font-black uppercase text-slate-500">Type</span><select className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm" onChange={(event) => setAdjustmentType(event.target.value as InventoryAdjustmentType)} value={adjustmentType}>{manualAdjustmentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label className="block"><span className="text-xs font-black uppercase text-slate-500">Date</span><input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm" onChange={(event) => setAdjustmentDate(event.target.value)} required type="date" value={adjustmentDate} /></label></div><label className="block"><span className="text-xs font-black uppercase text-slate-500">Quantity</span><input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-base font-bold" onChange={(event) => setAdjustmentQuantity(event.target.value)} required step="0.001" type="number" value={adjustmentQuantity} /></label><label className="block"><span className="text-xs font-black uppercase text-slate-500">Reason</span><input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm" onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="Cycle count, breakage, theft..." value={adjustmentReason} /></label><label className="block"><span className="text-xs font-black uppercase text-slate-500">Notes</span><textarea className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm" onChange={(event) => setAdjustmentNotes(event.target.value)} value={adjustmentNotes} /></label><button className="w-full rounded-lg bg-cyan-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={savingAdjustment} type="submit">{savingAdjustment ? "Saving..." : "Save adjustment"}</button></div></form>
          <div><h3 className="mb-4 text-xl font-black text-slate-950">Adjustment history</h3><TableShell><table className="min-w-full text-sm"><thead className="bg-slate-950 text-left text-xs uppercase text-slate-300"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Product</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Quantity</th><th className="px-4 py-3">Reason</th></tr></thead><tbody className="divide-y divide-slate-100">{data.inventory_adjustments.slice(0, 100).map((adjustment) => <tr key={adjustment.id}><td className="px-4 py-3">{adjustment.adjustment_date}</td><td className="px-4 py-3 font-bold text-slate-800">{data.products.find((product) => product.id === adjustment.product_id)?.name ?? "Deleted product"}</td><td className="px-4 py-3 capitalize">{adjustment.adjustment_type.replaceAll("_", " ")}</td><td className={cn("px-4 py-3 text-right font-black", adjustment.quantity_delta < 0 ? "text-red-700" : "text-emerald-700")}>{adjustment.quantity_delta > 0 ? "+" : ""}{adjustment.quantity_delta}</td><td className="px-4 py-3 text-slate-500">{adjustment.reason || adjustment.notes || "-"}</td></tr>)}{!data.inventory_adjustments.length ? <EmptyRow colSpan={5} text="No inventory adjustments recorded." /> : null}</tbody></table></TableShell></div>
        </section>
      ) : null}

      {tab === "insights" ? (
        <div className="space-y-7">
          <section><div className="mb-3 flex items-center gap-2"><TriangleAlert className="h-5 w-5 text-amber-600" /><h3 className="text-xl font-black text-slate-950">Reorder suggestions</h3></div><TableShell><table className="min-w-full text-sm"><thead className="bg-slate-950 text-left text-xs uppercase text-slate-300"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">On hand</th><th className="px-4 py-3 text-right">Sold 30d</th><th className="px-4 py-3 text-right">Suggested</th><th className="px-4 py-3 text-right">Est. cost</th></tr></thead><tbody className="divide-y divide-slate-100">{insights.reorderSuggestions.map((entry) => <tr key={entry.productId}><td className="px-4 py-3 font-bold text-slate-800">{entry.productName}<span className="ml-2 text-xs font-normal text-slate-400">{entry.skuUpc}</span></td><td className="px-4 py-3 text-right text-red-700">{entry.quantityOnHand}</td><td className="px-4 py-3 text-right">{entry.quantitySold30}</td><td className="px-4 py-3 text-right font-black">{entry.suggestedQuantity}</td><td className="px-4 py-3 text-right">{currency(entry.estimatedCost)}</td></tr>)}{!insights.reorderSuggestions.length ? <EmptyRow colSpan={5} text="Stock levels are above their reorder points." /> : null}</tbody></table></TableShell></section>
          <div className="grid gap-7 xl:grid-cols-2"><section><h3 className="mb-3 text-xl font-black text-slate-950">Dead stock (60+ days)</h3><TableShell><table className="min-w-full text-sm"><thead className="bg-slate-950 text-left text-xs uppercase text-slate-300"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Last sale</th><th className="px-4 py-3 text-right">Tied-up value</th></tr></thead><tbody className="divide-y divide-slate-100">{insights.deadStock.slice(0, 20).map((entry) => <tr key={entry.product.id}><td className="px-4 py-3 font-bold">{entry.product.name}</td><td className="px-4 py-3 text-slate-500">{entry.lastSaleDate || "No sales"}</td><td className="px-4 py-3 text-right font-black">{currency(entry.tiedUpValue)}</td></tr>)}{!insights.deadStock.length ? <EmptyRow colSpan={3} text="No dead stock identified." /> : null}</tbody></table></TableShell></section><section><h3 className="mb-3 text-xl font-black text-slate-950">Fast movers (30 days)</h3><TableShell><table className="min-w-full text-sm"><thead className="bg-slate-950 text-left text-xs uppercase text-slate-300"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Units</th><th className="px-4 py-3 text-right">Sales</th></tr></thead><tbody className="divide-y divide-slate-100">{insights.fastMovers.slice(0, 20).map((entry) => <tr key={entry.product.id}><td className="px-4 py-3 font-bold">{entry.product.name}</td><td className="px-4 py-3 text-right">{entry.quantitySold30}</td><td className="px-4 py-3 text-right font-black">{currency(entry.revenue30)}</td></tr>)}{!insights.fastMovers.length ? <EmptyRow colSpan={3} text="No linked product sales in the last 30 days." /> : null}</tbody></table></TableShell></section></div>
          <div className="grid gap-7 xl:grid-cols-2"><section><h3 className="mb-3 text-xl font-black text-slate-950">High-margin products</h3><TableShell><table className="min-w-full text-sm"><thead className="bg-slate-950 text-left text-xs uppercase text-slate-300"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Retail</th><th className="px-4 py-3 text-right">Margin</th></tr></thead><tbody className="divide-y divide-slate-100">{insights.highMargin.slice(0, 20).map((entry) => <tr key={entry.product.id}><td className="px-4 py-3 font-bold">{entry.product.name}</td><td className="px-4 py-3 text-right">{currency(entry.product.unit_retail_price)}</td><td className="px-4 py-3 text-right font-black text-emerald-700">{percent(entry.marginPercent)}</td></tr>)}{!insights.highMargin.length ? <EmptyRow colSpan={3} text="Add product cost and retail prices to calculate margins." /> : null}</tbody></table></TableShell></section><section><h3 className="mb-3 text-xl font-black text-slate-950">Vendor cost increases</h3><TableShell><table className="min-w-full text-sm"><thead className="bg-slate-950 text-left text-xs uppercase text-slate-300"><tr><th className="px-4 py-3">Product / vendor</th><th className="px-4 py-3 text-right">Cost change</th><th className="px-4 py-3 text-right">Increase</th></tr></thead><tbody className="divide-y divide-slate-100">{insights.costIncreases.slice(0, 20).map((entry) => <tr key={`${entry.productId}-${entry.vendorId}`}><td className="px-4 py-3"><p className="font-bold">{entry.productName}</p><p className="text-xs text-slate-500">{vendorById.get(entry.vendorId)?.name ?? "Unknown vendor"}</p></td><td className="px-4 py-3 text-right">{currency(entry.previousCost)} to {currency(entry.currentCost)}</td><td className="px-4 py-3 text-right font-black text-red-700">{percent(entry.increasePercent)}</td></tr>)}{!insights.costIncreases.length ? <EmptyRow colSpan={3} text="Receive multiple purchase orders to compare vendor costs." /> : null}</tbody></table></TableShell></section></div>
          <section><h3 className="mb-3 text-xl font-black text-slate-950">Price change history</h3><TableShell><table className="min-w-full text-sm"><thead className="bg-slate-950 text-left text-xs uppercase text-slate-300"><tr><th className="px-4 py-3">Changed</th><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Cost</th><th className="px-4 py-3 text-right">Retail</th></tr></thead><tbody className="divide-y divide-slate-100">{data.price_history.slice(0, 50).map((entry) => <tr key={entry.id}><td className="px-4 py-3 text-slate-500">{entry.changed_at.slice(0, 10)}</td><td className="px-4 py-3 font-bold">{data.products.find((product) => product.id === entry.product_id)?.name ?? "Deleted product"}</td><td className="px-4 py-3 text-right">{currency(entry.old_unit_cost)} to {currency(entry.new_unit_cost)}</td><td className="px-4 py-3 text-right">{currency(entry.old_retail_price)} to {currency(entry.new_retail_price)}</td></tr>)}{!data.price_history.length ? <EmptyRow colSpan={4} text="Price changes will appear after product costs or retail prices are updated." /> : null}</tbody></table></TableShell></section>
        </div>
      ) : null}
    </div>
  );
}
