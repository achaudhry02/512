import type { UserRole } from "@/lib/types";

export type PermissionAction =
  | "view_financials"
  | "export_reports"
  | "edit_daily_sales"
  | "edit_cash_reconciliation"
  | "edit_operations"
  | "edit_financials"
  | "manage_imports"
  | "manage_inventory"
  | "manage_settings"
  | "manage_members"
  | "close_day"
  | "reopen_day"
  | "delete_records";

const pageAccess: Record<UserRole, string[]> = {
  owner: ["*"],
  manager: [
    "/dashboard", "/onboarding", "/daily-sales", "/bulk-entry", "/inventory", "/vendors",
    "/expenses", "/cash-reconciliation", "/end-of-day-close", "/bank-matching", "/smart-import",
    "/pos-integrations", "/fuel", "/fuel-reconciliation", "/lottery", "/deli", "/payroll", "/reports",
  ],
  employee: ["/dashboard", "/daily-sales", "/cash-reconciliation"],
  accountant: ["/dashboard", "/expenses", "/cash-reconciliation", "/bank-matching", "/payroll", "/reports"],
};

const actionAccess: Record<PermissionAction, UserRole[]> = {
  view_financials: ["owner", "manager", "accountant"],
  export_reports: ["owner", "manager", "accountant"],
  edit_daily_sales: ["owner", "manager", "employee"],
  edit_cash_reconciliation: ["owner", "manager", "employee"],
  edit_operations: ["owner", "manager"],
  edit_financials: ["owner", "manager"],
  manage_imports: ["owner", "manager"],
  manage_inventory: ["owner", "manager"],
  manage_settings: ["owner"],
  manage_members: ["owner"],
  close_day: ["owner", "manager"],
  reopen_day: ["owner"],
  delete_records: ["owner", "manager"],
};

export function canViewPage(role: UserRole, route: string) {
  const pathname = route.split("?")[0];
  return pageAccess[role].includes("*") || pageAccess[role].some((allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`));
}

export function canPerformAction(role: UserRole, action: PermissionAction) {
  return actionAccess[action].includes(role);
}

export function roleForStore(userId: string, storeOwnerId: string, memberRole?: UserRole | null): UserRole {
  return userId === storeOwnerId ? "owner" : memberRole ?? "employee";
}
