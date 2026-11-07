import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { addUnit, saveProperty } from "../../actions";
import { PropertyFields } from "../property-fields";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, orgId } = await requireOrg();
  const { data: p } = await supabase.from("properties").select("*").eq("id", id).eq("organization_id", orgId).maybeSingle();
  if (!p) notFound();
  const [{ data: units }, { data: contracts }] = await Promise.all([
    supabase.from("units").select("id, building_name, unit_label, square_feet").eq("property_id", id).order("building_name").order("unit_label"),
    supabase.from("contracts").select("id, name, status").eq("property_id", id).order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <PageHeader title={p.name} actions={<Link className="text-sm text-teal-700 underline" href="/properties">All properties</Link>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-medium">Property details</h2>
          <ActionForm action={saveProperty} submitLabel="Save changes">
            <PropertyFields p={p} />
          </ActionForm>
        </Card>
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-medium">Buildings &amp; units</h2>
            <ul className="mb-4 space-y-1 text-sm">
              {units?.length ? units.map((u) => (
                <li key={u.id} className="flex justify-between">
                  <span>{[u.building_name, u.unit_label].filter(Boolean).join(" — ")}</span>
                  <span className="text-slate-500">{u.square_feet ? `${u.square_feet.toLocaleString()} sq ft` : ""}</span>
                </li>
              )) : <li className="text-slate-500">No units yet.</li>}
            </ul>
            <ActionForm action={addUnit} submitLabel="Add unit" successMessage="Unit added." className="space-y-3">
              <input type="hidden" name="property_id" value={p.id} />
              <Field label="Building (optional)"><Input name="building_name" placeholder="Building 2" /></Field>
              <Field label="Suite / unit"><Input name="unit_label" placeholder="Suite A" required /></Field>
              <Field label="Square feet (optional)"><Input name="square_feet" inputMode="numeric" /></Field>
            </ActionForm>
          </Card>
          <Card>
            <h2 className="mb-3 font-medium">Contracts</h2>
            <ul className="space-y-1 text-sm">
              {contracts?.length ? contracts.map((c) => (
                <li key={c.id}><Link className="text-teal-700 hover:underline" href={`/contracts/${c.id}`}>{c.name}</Link></li>
              )) : <li className="text-slate-500">None yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
