import { describe, expect, it } from "vitest";
import {
  dashboardTab,
  filterContracts,
  indicatorFor,
  parseDollarsToCents,
  type ContractRow,
} from "./contracts";

const TODAY = "2026-11-06";

describe("expiration status", () => {
  it("executed lease far from end is active (green)", () => {
    const tab = dashboardTab({ status: "executed", end_date: "2027-12-31" }, TODAY);
    expect(tab).toBe("active");
    expect(indicatorFor(tab)).toBe("green");
  });

  it("executed lease ending within 60 days is expiring (yellow)", () => {
    expect(dashboardTab({ status: "executed", end_date: "2027-01-05" }, TODAY)).toBe("expiring"); // 60 days
    expect(dashboardTab({ status: "executed", end_date: "2027-01-06" }, TODAY)).toBe("active"); // 61 days
    expect(indicatorFor("expiring")).toBe("yellow");
  });

  it("end date itself is still in force; the day after is expired (red)", () => {
    expect(dashboardTab({ status: "executed", end_date: TODAY }, TODAY)).toBe("expiring");
    expect(dashboardTab({ status: "executed", end_date: "2026-11-05" }, TODAY)).toBe("expired");
    expect(indicatorFor("expired")).toBe("red");
  });

  it("terminated goes to expired; month-to-month without end date stays active", () => {
    expect(dashboardTab({ status: "terminated", end_date: "2030-01-01" }, TODAY)).toBe("expired");
    expect(dashboardTab({ status: "executed", end_date: null }, TODAY)).toBe("active");
  });

  it("draft, pending, archived map to their own tabs regardless of dates", () => {
    expect(dashboardTab({ status: "draft", end_date: "2020-01-01" }, TODAY)).toBe("drafts");
    expect(dashboardTab({ status: "pending_signature", end_date: "2020-01-01" }, TODAY)).toBe("pending");
    expect(dashboardTab({ status: "archived", end_date: "2020-01-01" }, TODAY)).toBe("archived");
    expect(indicatorFor("pending")).toBe("blue");
  });
});

const base: Omit<ContractRow, "id" | "name" | "status" | "end_date"> = {
  lease_type: "gas_station_adjacent",
  monthly_rent_cents: 250000,
  start_date: "2025-01-01",
  property_id: "p1",
  property_name: "Fuel Plaza",
  building_name: null,
  unit_label: "Suite A",
  tenant_name: "Jane Doe",
  business_name: "Main Street Burger Shop",
};

const rows: ContractRow[] = [
  { ...base, id: "c1", name: "Burger lease", status: "executed", end_date: "2028-01-01" },
  { ...base, id: "c2", name: "Old laundromat", status: "executed", end_date: "2025-06-30", business_name: "Suds" },
  { ...base, id: "c3", name: "House", status: "draft", end_date: null, lease_type: "residential", monthly_rent_cents: 150000 },
];

describe("dashboard tabs and search", () => {
  it("expired contracts appear only in the expired tab", () => {
    expect(filterContracts(rows, { tab: "expired" }, TODAY).map((r) => r.id)).toEqual(["c2"]);
    expect(filterContracts(rows, { tab: "active" }, TODAY).map((r) => r.id)).toEqual(["c1"]);
  });

  it("searches business name, suite, and contract id", () => {
    expect(filterContracts(rows, { q: "suds" }, TODAY).map((r) => r.id)).toEqual(["c2"]);
    expect(filterContracts(rows, { q: "suite a" }, TODAY)).toHaveLength(3);
    expect(filterContracts(rows, { q: "c3" }, TODAY).map((r) => r.id)).toEqual(["c3"]);
  });

  it("filters by lease type and rent range", () => {
    expect(filterContracts(rows, { leaseType: "residential" }, TODAY).map((r) => r.id)).toEqual(["c3"]);
    expect(filterContracts(rows, { minRent: 200000 }, TODAY).map((r) => r.id)).toEqual(["c1", "c2"]);
  });
});

describe("money parsing", () => {
  it("parses dollars to integer cents exactly", () => {
    expect(parseDollarsToCents("$2,500")).toBe(250000);
    expect(parseDollarsToCents("2652.25")).toBe(265225);
    expect(parseDollarsToCents("10.5")).toBe(1050);
    expect(parseDollarsToCents("")).toBeNull();
    expect(() => parseDollarsToCents("12.345")).toThrow();
    expect(() => parseDollarsToCents("-5")).toThrow();
  });
});
