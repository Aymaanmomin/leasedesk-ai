import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * DEMO DATA for development only. Fictional names and addresses.
 * Dates are relative to today so every dashboard tab has something in it.
 */
function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function seedDemoData(supabase: SupabaseClient, orgId: string, userId: string) {
  const props = [
    { name: "Fuel Plaza", address_line: "100 Demo Hwy", city: "Austin", zip: "78701", category: "gas_station_adjacent" },
    { name: "North Business Park", address_line: "200 Sample Blvd", city: "Dallas", zip: "75201", category: "business_park" },
    { name: "Elm Street Residential House", address_line: "300 Example St", city: "Houston", zip: "77002", category: "residential" },
  ].map((p) => ({ ...p, state: "TX", organization_id: orgId, description: "[Demo] fictional property" }));

  const { data: properties, error } = await supabase.from("properties").insert(props).select("id, name");
  if (error) throw new Error(error.message);
  const byName = Object.fromEntries(properties.map((p) => [p.name, p.id as string]));

  const { data: units, error: uErr } = await supabase
    .from("units")
    .insert([
      { organization_id: orgId, property_id: byName["Fuel Plaza"], unit_label: "Suite A", square_feet: 1400 },
      { organization_id: orgId, property_id: byName["Fuel Plaza"], unit_label: "Suite B", square_feet: 1200 },
      { organization_id: orgId, property_id: byName["North Business Park"], building_name: "Building 2", unit_label: "Unit 210" },
    ])
    .select("id, unit_label");
  if (uErr) throw new Error(uErr.message);
  const unit = Object.fromEntries(units.map((u) => [u.unit_label, u.id as string]));

  const { data: tenants, error: tErr } = await supabase
    .from("tenants")
    .insert([
      { organization_id: orgId, legal_name: "Demo Burger LLC", business_name: "Main Street Burger Shop" },
      { organization_id: orgId, legal_name: "Demo Suds Inc.", business_name: "Bubbles Laundromat" },
      { organization_id: orgId, legal_name: "Demo Tech Co.", business_name: "Demo Tech" },
      { organization_id: orgId, legal_name: "Jordan Example" },
    ])
    .select("id, legal_name");
  if (tErr) throw new Error(tErr.message);
  const tenant = Object.fromEntries(tenants.map((t) => [t.legal_name, t.id as string]));

  const c = (o: Record<string, unknown>) => ({ organization_id: orgId, created_by: userId, ...o });
  const { error: cErr } = await supabase.from("contracts").insert([
    c({ name: "[Demo] Burger Shop Lease", lease_type: "gas_station_adjacent", status: "executed", property_id: byName["Fuel Plaza"], unit_id: unit["Suite A"], tenant_id: tenant["Demo Burger LLC"], monthly_rent_cents: 250000, start_date: isoDaysFromNow(-400), end_date: isoDaysFromNow(700) }),
    c({ name: "[Demo] Laundromat Lease", lease_type: "gas_station_adjacent", status: "executed", property_id: byName["Fuel Plaza"], unit_id: unit["Suite B"], tenant_id: tenant["Demo Suds Inc."], monthly_rent_cents: 180000, start_date: isoDaysFromNow(-700), end_date: isoDaysFromNow(40) }),
    c({ name: "[Demo] Office Lease — Unit 210", lease_type: "business_park", status: "executed", property_id: byName["North Business Park"], unit_id: unit["Unit 210"], tenant_id: tenant["Demo Tech Co."], monthly_rent_cents: 320000, start_date: isoDaysFromNow(-1100), end_date: isoDaysFromNow(-20) }),
    c({ name: "[Demo] Elm Street House Lease", lease_type: "residential", status: "pending_signature", property_id: byName["Elm Street Residential House"], tenant_id: tenant["Jordan Example"], monthly_rent_cents: 165000, start_date: isoDaysFromNow(15), end_date: isoDaysFromNow(380) }),
    c({ name: "[Demo] Draft — Suite B Renewal", lease_type: "gas_station_adjacent", status: "draft", property_id: byName["Fuel Plaza"], unit_id: unit["Suite B"], monthly_rent_cents: 185000 }),
  ]);
  if (cErr) throw new Error(cErr.message);
}
