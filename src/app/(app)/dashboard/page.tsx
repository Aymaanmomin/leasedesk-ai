import Link from "next/link";
import { requireOrg } from "@/lib/supabase/server";
import { listContracts } from "@/lib/queries";
import {
  dashboardTab, filterContracts, formatCents, indicatorFor, LEASE_TYPE_LABELS, TAB_LABELS,
  type DashboardTab, type LeaseType,
} from "@/lib/contracts";
import { Badge, Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { loadDemoData } from "../actions";

const TABS = Object.keys(TAB_LABELS) as DashboardTab[];

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, orgId, role } = await requireOrg();
  const [contracts, { count: propertyCount }] = await Promise.all([
    listContracts(supabase, orgId),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
  ]);
  const { data: properties } = await supabase.from("properties").select("id, name").eq("organization_id", orgId).order("name");

  const today = new Date();
  const tab = (TABS.includes(sp.tab as DashboardTab) ? sp.tab : "active") as DashboardTab;
  const counts = Object.fromEntries(TABS.map((t) => [t, 0])) as Record<DashboardTab, number>;
  for (const c of contracts) counts[dashboardTab(c, today)]++;
  const inForce = contracts.filter((c) => ["active", "expiring"].includes(dashboardTab(c, today)));
  const monthlyRent = inForce.reduce((s, c) => s + (c.monthly_rent_cents ?? 0), 0);

  const toCents = (v?: string) => (v && /^\d+(\.\d+)?$/.test(v) ? Math.round(Number(v) * 100) : null);
  const rows = filterContracts(contracts, {
    tab,
    q: sp.q,
    leaseType: (sp.type as LeaseType) || "",
    propertyId: sp.property || undefined,
    minRent: toCents(sp.min),
    maxRent: toCents(sp.max),
    expiresBefore: sp.before || undefined,
  }, today);

  const stats = [
    ["Total properties", String(propertyCount ?? 0)],
    ["Active leases", String(inForce.length)],
    ["Monthly contracted rent", formatCents(monthlyRent)],
    ["Pending signatures", String(counts.pending)],
    ["Expiring (60 days)", String(counts.expiring)],
    ["Expired", String(counts.expired)],
  ];

  const tabHref = (t: DashboardTab) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    p.set("tab", t);
    return `/dashboard?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={<Link href="/contracts/new"><Button>Add Contract</Button></Link>}
      />

      {contracts.length === 0 && role !== "viewer" && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 border-dashed">
          <p className="text-sm text-slate-600">No contracts yet. Add a property to get started, or load fictional demo data to explore.</p>
          <form action={loadDemoData}><Button variant="secondary">Load demo data</Button></form>
        </Card>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t}
            href={tabHref(t)}
            role="tab"
            aria-selected={t === tab}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${t === tab ? "border-teal-600 font-medium text-teal-700" : "border-transparent text-slate-600 hover:text-slate-900"}`}
          >
            {TAB_LABELS[t]} <span className="text-slate-400">({counts[t]})</span>
          </Link>
        ))}
      </div>

      <form className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-7" method="get">
        <input type="hidden" name="tab" value={tab} />
        <Input name="q" defaultValue={sp.q} placeholder="Search name, tenant, business, property, suite, ID" className="col-span-2" aria-label="Search" />
        <Select name="type" defaultValue={sp.type ?? ""} aria-label="Lease type">
          <option value="">All lease types</option>
          {Object.entries(LEASE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select name="property" defaultValue={sp.property ?? ""} aria-label="Property">
          <option value="">All properties</option>
          {properties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Input name="min" defaultValue={sp.min} placeholder="Min rent $" inputMode="decimal" aria-label="Minimum rent" />
        <Input name="before" defaultValue={sp.before} type="date" aria-label="Expires before" title="Expires before" />
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Contract", "Property", "Building / Suite", "Tenant", "Lease type", "Monthly rent", "Start", "Expires", "Status"].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No contracts in this view.</td></tr>
            )}
            {rows.map((c) => {
              const t = dashboardTab(c, today);
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium"><Link className="text-teal-700 hover:underline" href={`/contracts/${c.id}`}>{c.name}</Link></td>
                  <td className="px-4 py-3">{c.property_name}</td>
                  <td className="px-4 py-3">{[c.building_name, c.unit_label].filter(Boolean).join(" — ") || "—"}</td>
                  <td className="px-4 py-3">{c.business_name ?? c.tenant_name ?? "—"}</td>
                  <td className="px-4 py-3">{LEASE_TYPE_LABELS[c.lease_type]}</td>
                  <td className="px-4 py-3">{formatCents(c.monthly_rent_cents)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{c.start_date ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{c.end_date ?? "—"}</td>
                  <td className="px-4 py-3"><Badge color={indicatorFor(t)}>{TAB_LABELS[t]}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
