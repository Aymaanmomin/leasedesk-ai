import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Field, PageHeader, Select } from "@/components/ui";
import { dashboardTab, formatCents, indicatorFor, LEASE_TYPE_LABELS, TAB_LABELS } from "@/lib/contracts";
import { setContractStatus } from "../../actions";

const NEXT_STATUSES: Record<string, string[]> = {
  draft: ["pending_signature", "archived"],
  pending_signature: ["draft", "archived"],
  executed: ["terminated", "archived"],
  terminated: ["archived"],
  archived: [],
};

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, orgId, role } = await requireOrg();
  const { data: c } = await supabase
    .from("contracts")
    .select("*, properties(id, name, address_line, city, state, zip), units(building_name, unit_label), tenants(legal_name, business_name, email)")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!c) notFound();
  const { data: log } = await supabase
    .from("activity_logs")
    .select("id, event_type, details, created_at")
    .eq("contract_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const tab = dashboardTab(c);
  const locked = c.executed_at !== null;
  const rows: [string, string][] = [
    ["Contract ID", c.id],
    ["Lease type", LEASE_TYPE_LABELS[c.lease_type as keyof typeof LEASE_TYPE_LABELS]],
    ["Property", `${c.properties?.name} — ${c.properties?.address_line}, ${c.properties?.city}, ${c.properties?.state} ${c.properties?.zip}`],
    ["Building / suite", [c.units?.building_name, c.units?.unit_label].filter(Boolean).join(" — ") || "—"],
    ["Tenant", c.tenants ? [c.tenants.legal_name, c.tenants.business_name].filter(Boolean).join(" / ") : "—"],
    ["Monthly rent", formatCents(c.monthly_rent_cents)],
    ["Start date", c.start_date ?? "—"],
    ["Expiration date", c.end_date ?? "—"],
  ];

  return (
    <>
      <PageHeader title={c.name} actions={<Badge color={indicatorFor(tab)}>{TAB_LABELS[tab]}</Badge>} />
      {locked && (
        <p className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          This contract is executed and locked. Its terms cannot be edited by anyone. Changes will require a separately
          signed amendment or replacement agreement (coming in Milestone 6).
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <dl className="divide-y divide-slate-100 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-4 py-2">
                <dt className="text-slate-500">{k}</dt>
                <dd className="col-span-2 break-words">{v}</dd>
              </div>
            ))}
          </dl>
          <Link className="mt-4 inline-block text-sm text-teal-700 underline" href={`/properties/${c.properties?.id}`}>View property</Link>
        </Card>
        <div className="space-y-6">
          {role !== "viewer" && NEXT_STATUSES[c.status].length > 0 && (
            <Card>
              <h2 className="mb-3 font-medium">Change status</h2>
              <ActionForm action={setContractStatus} submitLabel="Update status" className="space-y-3">
                <input type="hidden" name="id" value={c.id} />
                <Field label="New status">
                  <Select name="status">
                    {NEXT_STATUSES[c.status].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </Select>
                </Field>
              </ActionForm>
            </Card>
          )}
          <Card>
            <h2 className="mb-3 font-medium">Activity</h2>
            <ul className="space-y-2 text-sm">
              {log?.length ? log.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{e.event_type.replaceAll("_", " ")}</span>
                  <span className="block text-xs text-slate-500">{new Date(e.created_at).toLocaleString()}</span>
                </li>
              )) : <li className="text-slate-500">No activity yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
