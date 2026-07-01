"use client";

import { ResourceManager, type ResourceField } from "@/components/resource-manager";
import { currency } from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import { expenseCategories, type Vendor } from "@/lib/types";

export default function VendorsPage() {
  const { data, loading, saveResource, deleteResource } = useCommandCenter();
  const fields: ResourceField[] = [
    { name: "name", label: "Vendor name", type: "text", required: true },
    { name: "contact_person", label: "Contact person", type: "text" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "email", label: "Email", type: "email" },
    { name: "category", label: "Category", type: "select", options: expenseCategories.map((category) => ({ label: category, value: category })) },
    { name: "average_weekly_spend", label: "Average weekly spend", type: "number", min: "0", step: "0.01" },
    { name: "products_supplied", label: "Products supplied", type: "textarea" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <ResourceManager<Vendor>
      addLabel="Add vendor"
      columns={[
        { header: "Vendor", cell: (row) => <div><p className="font-black text-slate-950">{row.name}</p><p className="text-xs text-slate-500">{row.contact_person || "No contact"}</p></div> },
        { header: "Contact", cell: (row) => row.phone || row.email || "-" },
        { header: "Products", cell: (row) => row.products_supplied || "-" },
        { header: "Weekly spend", cell: (row) => currency(row.average_weekly_spend) },
        { header: "Recorded spend", cell: (row) => currency(row.total_spend) },
      ]}
      defaultValues={{ name: "", normalized_name: "", category: "Other", total_spend: 0, contact_person: "", phone: "", email: "", products_supplied: "", average_weekly_spend: 0, notes: "" }}
      description="Keep supplier contacts, product coverage, and expected weekly purchasing in one place."
      emptyMessage="No vendors found. Add Capital Candy or another supplier."
      fields={fields}
      getSearchText={(row) => `${row.name} ${row.contact_person ?? ""} ${row.products_supplied ?? ""}`}
      loading={loading}
      onDelete={(id) => deleteResource("vendors", id)}
      onSave={(payload, id) => saveResource("vendors", payload, id)}
      preparePayload={(values) => ({
        name: String(values.name).trim(), normalized_name: String(values.name).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
        category: String(values.category), total_spend: Number(values.total_spend || 0),
        contact_person: String(values.contact_person).trim() || null, phone: String(values.phone).trim() || null,
        email: String(values.email).trim() || null, products_supplied: String(values.products_supplied).trim() || null,
        average_weekly_spend: Number(values.average_weekly_spend), notes: String(values.notes).trim() || null,
      })}
      rows={data.vendors}
      title="Vendors"
    />
  );
}
