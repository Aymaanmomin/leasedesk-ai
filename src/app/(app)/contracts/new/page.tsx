import Link from "next/link";
import { requireOrg } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { LEASE_TYPE_LABELS } from "@/lib/contracts";
import { saveContract } from "../../actions";

export default async function NewContractPage() {
  const { supabase, orgId } = await requireOrg();
  const { data: properties } = await supabase
    .from("properties")
    .select("id, name, units(id, building_name, unit_label)")
    .eq("organization_id", orgId)
    .order("name");

  if (!properties?.length) {
    return (
      <Card className="max-w-xl">
        <p className="text-sm text-slate-600">Add a property before recording a contract.</p>
        <Link className="mt-3 inline-block text-teal-700 underline" href="/properties/new">Add a property</Link>
      </Card>
    );
  }

  return (
    <>
      <PageHeader title="Add Contract Record" />
      <p className="mb-4 max-w-3xl text-sm text-slate-600">
        Record an existing or planned lease. The guided lease questionnaire and draft generation arrive in Milestone 2.
      </p>
      <Card className="max-w-3xl">
        <ActionForm action={saveContract} submitLabel="Save contract">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Contract name"><Input name="name" placeholder="Burger Shop Lease — Suite A" required /></Field></div>
            <Field label="Lease type">
              <Select name="lease_type" required>
                {Object.entries(LEASE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Status" hint="Use Executed only for leases already signed outside LeaseDesk. Executed records are locked.">
              <Select name="status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="pending_signature">Pending signature</option>
                <option value="executed">Executed (signed)</option>
              </Select>
            </Field>
            <Field label="Property">
              <Select name="property_id" required>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Building / suite (optional)" hint="Must belong to the selected property.">
              <Select name="unit_id" defaultValue="">
                <option value="">—</option>
                {properties.map((p) => (
                  <optgroup key={p.id} label={p.name}>
                    {(p.units as { id: string; building_name: string | null; unit_label: string }[]).map((u) => (
                      <option key={u.id} value={u.id}>{[u.building_name, u.unit_label].filter(Boolean).join(" — ")}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field label="Tenant legal name (optional)"><Input name="tenant_legal_name" /></Field>
            <Field label="Business name (optional)"><Input name="tenant_business_name" /></Field>
            <Field label="Tenant email (optional)"><Input name="tenant_email" type="email" /></Field>
            <Field label="Monthly rent (USD)"><Input name="monthly_rent" inputMode="decimal" placeholder="2,500.00" /></Field>
            <Field label="Start date"><Input name="start_date" type="date" /></Field>
            <Field label="Expiration date"><Input name="end_date" type="date" /></Field>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
