import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContractRow } from "./contracts";

type Joined = {
  id: string; name: string; lease_type: ContractRow["lease_type"]; status: ContractRow["status"];
  monthly_rent_cents: number | null; start_date: string | null; end_date: string | null; property_id: string;
  properties: { name: string } | null;
  units: { building_name: string | null; unit_label: string } | null;
  tenants: { legal_name: string; business_name: string | null } | null;
};

/** RLS limits this to the signed-in user's organization; orgId is an extra explicit filter. */
export async function listContracts(supabase: SupabaseClient, orgId: string): Promise<ContractRow[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select("id, name, lease_type, status, monthly_rent_cents, start_date, end_date, property_id, properties(name), units(building_name, unit_label), tenants(legal_name, business_name)")
    .eq("organization_id", orgId)
    .order("end_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data as unknown as Joined[]).map((c) => ({
    id: c.id,
    name: c.name,
    lease_type: c.lease_type,
    status: c.status,
    monthly_rent_cents: c.monthly_rent_cents,
    start_date: c.start_date,
    end_date: c.end_date,
    property_id: c.property_id,
    property_name: c.properties?.name ?? "",
    building_name: c.units?.building_name ?? null,
    unit_label: c.units?.unit_label ?? null,
    tenant_name: c.tenants?.legal_name ?? null,
    business_name: c.tenants?.business_name ?? null,
  }));
}
