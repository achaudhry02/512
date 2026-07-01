"use client";

import { ResourceManager, type ResourceField } from "@/components/resource-manager";
import { currency } from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import type { Employee } from "@/lib/types";

const roles = ["Owner/Admin", "Manager", "Employee/Cashier"];

export default function EmployeesPage() {
  const { data, loading, saveResource, deleteResource } = useCommandCenter();
  const fields: ResourceField[] = [
    { name: "name", label: "Employee name", type: "text", required: true },
    { name: "role", label: "Role", type: "select", options: roles.map((role) => ({ label: role, value: role })) },
    { name: "hourly_rate", label: "Hourly rate", type: "number", min: "0", step: "0.01", required: true },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "email", label: "Email", type: "email" },
    { name: "active", label: "Active employee", type: "checkbox" },
    { name: "notes", label: "Notes", type: "textarea", className: "md:col-span-2" },
  ];

  return (
    <ResourceManager<Employee>
      addLabel="Add employee"
      columns={[
        { header: "Employee", cell: (row) => <div><p className="font-black text-slate-950">{row.name}</p><p className="text-xs text-slate-500">{row.email || row.phone || "No contact"}</p></div> },
        { header: "Role", cell: (row) => row.role },
        { header: "Hourly rate", cell: (row) => currency(row.hourly_rate) },
        { header: "Status", cell: (row) => <span className={row.active ? "text-emerald-700" : "text-slate-500"}>{row.active ? "Active" : "Inactive"}</span> },
      ]}
      defaultValues={{ name: "", role: "Employee/Cashier", hourly_rate: 15, phone: "", email: "", active: true, notes: "" }}
      description="Maintain the staff roster and standard rates used when entering weekly payroll."
      emptyMessage="No employees found. Add the first team member."
      fields={fields}
      filterField={{ label: "Roles", options: roles, value: (row) => row.role }}
      getSearchText={(row) => `${row.name} ${row.role} ${row.email ?? ""}`}
      loading={loading}
      onDelete={(id) => deleteResource("employees", id)}
      onSave={(payload, id) => saveResource("employees", payload, id)}
      preparePayload={(values) => ({ name: String(values.name).trim(), role: String(values.role), hourly_rate: Number(values.hourly_rate), phone: String(values.phone).trim() || null, email: String(values.email).trim() || null, active: Boolean(values.active), notes: String(values.notes).trim() || null })}
      rows={data.employees}
      title="Employees"
    />
  );
}
