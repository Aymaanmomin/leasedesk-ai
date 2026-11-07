// Deterministic contract status logic. No AI, no I/O — fully unit tested.

export type ContractStatus = "draft" | "pending_signature" | "executed" | "terminated" | "archived";
export type LeaseType = "residential" | "business_park" | "gas_station_adjacent";
export type DashboardTab = "active" | "expiring" | "expired" | "drafts" | "pending" | "archived";
export type Indicator = "green" | "yellow" | "red" | "blue" | "gray";

export const EXPIRING_WINDOW_DAYS = 60;

export const LEASE_TYPE_LABELS: Record<LeaseType, string> = {
  residential: "Residential",
  business_park: "Business Park / Commercial",
  gas_station_adjacent: "Gas Station Adjacent",
};

export const TAB_LABELS: Record<DashboardTab, string> = {
  active: "Active",
  expiring: "Expiring Soon",
  expired: "Expired / Old",
  drafts: "Drafts",
  pending: "Pending Signature",
  archived: "Archived",
};

/** Parse a YYYY-MM-DD date as a UTC calendar day number (timezone-safe). */
function dayNumber(date: string | Date): number {
  if (typeof date === "string") {
    const [y, m, d] = date.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  }
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

export function daysUntil(endDate: string, today: Date | string): number {
  return dayNumber(endDate) - dayNumber(today);
}

/**
 * Which dashboard tab a contract belongs in.
 * An executed lease is "expired" once today is after its end date (the end date itself is the last active day).
 */
export function dashboardTab(
  c: { status: ContractStatus; end_date: string | null },
  today: Date | string = new Date(),
): DashboardTab {
  switch (c.status) {
    case "draft":
      return "drafts";
    case "pending_signature":
      return "pending";
    case "archived":
      return "archived";
    case "terminated":
      return "expired";
    case "executed": {
      if (!c.end_date) return "active"; // month-to-month / no fixed end
      const left = daysUntil(c.end_date, today);
      if (left < 0) return "expired";
      if (left <= EXPIRING_WINDOW_DAYS) return "expiring";
      return "active";
    }
  }
}

export function indicatorFor(tab: DashboardTab): Indicator {
  return ({
    active: "green",
    expiring: "yellow",
    expired: "red",
    pending: "blue",
    drafts: "gray",
    archived: "gray",
  } as const)[tab];
}

export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/** Parse "2,500.50" / "$2500" into integer cents without floating-point drift. */
export function parseDollarsToCents(input: string): number | null {
  const clean = input.replace(/[$,\s]/g, "");
  if (clean === "") return null;
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(clean);
  if (!m) throw new Error("Enter a dollar amount like 2500 or 2,500.00");
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export interface ContractFilter {
  q?: string;
  tab?: DashboardTab;
  leaseType?: LeaseType | "";
  propertyId?: string;
  minRent?: number | null; // cents
  maxRent?: number | null; // cents
  expiresBefore?: string;  // YYYY-MM-DD
}

export interface ContractRow {
  id: string;
  name: string;
  lease_type: LeaseType;
  status: ContractStatus;
  monthly_rent_cents: number | null;
  start_date: string | null;
  end_date: string | null;
  property_id: string;
  property_name: string;
  building_name: string | null;
  unit_label: string | null;
  tenant_name: string | null;
  business_name: string | null;
}

export function filterContracts(rows: ContractRow[], f: ContractFilter, today: Date | string = new Date()) {
  const q = f.q?.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.tab && dashboardTab(r, today) !== f.tab) return false;
    if (f.leaseType && r.lease_type !== f.leaseType) return false;
    if (f.propertyId && r.property_id !== f.propertyId) return false;
    if (f.minRent != null && (r.monthly_rent_cents ?? 0) < f.minRent) return false;
    if (f.maxRent != null && (r.monthly_rent_cents ?? 0) > f.maxRent) return false;
    if (f.expiresBefore && (!r.end_date || r.end_date > f.expiresBefore)) return false;
    if (q) {
      const hay = [r.name, r.tenant_name, r.business_name, r.property_name, r.building_name, r.unit_label, r.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
