"use client";

import { ResourceManager, type ResourceField } from "@/components/resource-manager";
import { currency, percent } from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import { storeCategories, type Product } from "@/lib/types";

export default function InventoryPage() {
  const { data, loading, saveResource, deleteResource } = useCommandCenter();
  const vendorOptions = [{ label: "No vendor", value: "" }, ...data.vendors.map((vendor) => ({ label: vendor.name, value: vendor.id }))];
  const fields: ResourceField[] = [
    { name: "name", label: "Product name", type: "text", required: true },
    { name: "sku_upc", label: "SKU / barcode", type: "text" },
    { name: "category", label: "Category", type: "select", required: true, options: storeCategories.map((category) => ({ label: category, value: category })) },
    { name: "vendor_id", label: "Vendor", type: "select", options: vendorOptions },
    { name: "unit_cost", label: "Cost price", type: "number", min: "0", step: "0.01", required: true },
    { name: "unit_retail_price", label: "Sell price", type: "number", min: "0", step: "0.01", required: true },
    { name: "quantity_on_hand", label: "Quantity on hand", type: "number", min: "0", step: "1", required: true },
    { name: "reorder_level", label: "Reorder level", type: "number", min: "0", step: "1", required: true },
    { name: "notes", label: "Notes", type: "textarea", className: "md:col-span-2" },
  ];

  return (
    <ResourceManager<Product>
      addLabel="Add product"
      columns={[
        { header: "Product", cell: (row) => <div><p className="font-black text-slate-950">{row.name}</p><p className="text-xs text-slate-500">{row.sku_upc || "No SKU"}</p></div> },
        { header: "Category", cell: (row) => row.category },
        { header: "Cost / price", cell: (row) => `${currency(row.unit_cost)} / ${currency(row.unit_retail_price)}` },
        { header: "Margin", cell: (row) => percent(row.unit_retail_price > 0 ? ((row.unit_retail_price - row.unit_cost) / row.unit_retail_price) * 100 : 0) },
        { header: "Stock", cell: (row) => <span className={row.quantity_on_hand <= row.reorder_level ? "rounded-full bg-red-100 px-2 py-1 text-xs font-black text-red-700" : "text-emerald-700"}>{row.quantity_on_hand}{row.quantity_on_hand <= row.reorder_level ? " Low" : ""}</span> },
      ]}
      defaultValues={{ name: "", sku_upc: "", category: "Grocery", vendor_id: "", product_category_id: "", unit_cost: 0, unit_retail_price: 0, quantity_on_hand: 0, reorder_level: 5, notes: "" }}
      description="Track item cost, retail price, margin, stock on hand, reorder thresholds, and suppliers."
      emptyMessage="No products found. Add the first inventory item."
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
        notes: String(values.notes).trim() || null,
      })}
      rows={data.products}
      title="Inventory"
    />
  );
}
