"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity, requireOrg } from "@/lib/supabase/server";
import { parseDollarsToCents } from "@/lib/contracts";
import { seedDemoData } from "@/lib/demo-data";

export type ActionState = { error?: string; ok?: boolean };

const opt = (s: z.ZodString) => s.trim().optional().transform((v) => (v ? v : null));

async function requireWriter() {
  const ctx = await requireOrg();
  if (ctx.role === "viewer") throw new Error("Read-only viewers cannot make changes");
  return ctx;
}

const propertySchema = z.object({
  name: z.string().trim().min(1, "Property name is required"),
  address_line: z.string().trim().min(1, "Address is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().toUpperCase().length(2, "Use a 2-letter state code"),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "ZIP must be 5 digits"),
  category: z.enum(["residential", "business_park", "gas_station_adjacent", "commercial", "other"]),
  description: opt(z.string()),
  internal_notes: opt(z.string()),
});

export async function saveProperty(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireWriter();
    const parsed = propertySchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const id = form.get("id") ? String(form.get("id")) : null;
    if (id) {
      const { error } = await ctx.supabase.from("properties").update(parsed.data).eq("id", id).eq("organization_id", ctx.orgId);
      if (error) return { error: error.message };
      await logActivity(ctx, "property_updated", { property_id: id, name: parsed.data.name });
      revalidatePath(`/properties/${id}`);
      return { ok: true };
    }
    const { data, error } = await ctx.supabase
      .from("properties")
      .insert({ ...parsed.data, organization_id: ctx.orgId })
      .select("id")
      .single();
    if (error) return { error: error.message };
    await logActivity(ctx, "property_created", { property_id: data.id, name: parsed.data.name });
    redirect(`/properties/${data.id}`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { error: (e as Error).message };
  }
}

const unitSchema = z.object({
  property_id: z.string().uuid(),
  building_name: opt(z.string()),
  unit_label: z.string().trim().min(1, "Suite or unit is required"),
  square_feet: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Square feet must be a positive whole number"),
});

export async function addUnit(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireWriter();
    const parsed = unitSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { error } = await ctx.supabase.from("units").insert({ ...parsed.data, organization_id: ctx.orgId });
    if (error) return { error: error.code === "23505" ? "That unit already exists" : error.message };
    await logActivity(ctx, "unit_created", parsed.data);
    revalidatePath(`/properties/${parsed.data.property_id}`);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const contractSchema = z.object({
  name: z.string().trim().min(1, "Contract name is required"),
  lease_type: z.enum(["residential", "business_park", "gas_station_adjacent"]),
  status: z.enum(["draft", "pending_signature", "executed", "terminated", "archived"]),
  property_id: z.string().uuid("Choose a property"),
  unit_id: opt(z.string()),
  tenant_legal_name: opt(z.string()),
  tenant_business_name: opt(z.string()),
  tenant_email: opt(z.string()),
  monthly_rent: z.string().optional(),
  start_date: opt(z.string()),
  end_date: opt(z.string()),
});

export async function saveContract(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireWriter();
    const parsed = contractSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const d = parsed.data;
    if (d.start_date && d.end_date && d.end_date < d.start_date) return { error: "End date must be on or after start date" };
    let rent: number | null;
    try {
      rent = parseDollarsToCents(d.monthly_rent ?? "");
    } catch (e) {
      return { error: (e as Error).message };
    }

    let tenant_id: string | null = null;
    if (d.tenant_legal_name) {
      const { data, error } = await ctx.supabase
        .from("tenants")
        .insert({
          organization_id: ctx.orgId,
          legal_name: d.tenant_legal_name,
          business_name: d.tenant_business_name,
          email: d.tenant_email,
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      tenant_id = data.id;
    }

    const { data, error } = await ctx.supabase
      .from("contracts")
      .insert({
        organization_id: ctx.orgId,
        property_id: d.property_id,
        unit_id: d.unit_id,
        tenant_id,
        name: d.name,
        lease_type: d.lease_type,
        status: d.status,
        monthly_rent_cents: rent,
        start_date: d.start_date,
        end_date: d.end_date,
        created_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    await logActivity(ctx, "contract_created", { name: d.name, status: d.status }, data.id);
    redirect(`/contracts/${data.id}`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { error: (e as Error).message };
  }
}

export async function setContractStatus(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireWriter();
    const id = String(form.get("id"));
    const status = z.enum(["draft", "pending_signature", "executed", "terminated", "archived"]).parse(form.get("status"));
    const { error } = await ctx.supabase.from("contracts").update({ status }).eq("id", id).eq("organization_id", ctx.orgId);
    if (error) return { error: error.message };
    await logActivity(ctx, "contract_status_changed", { status }, id);
    revalidatePath(`/contracts/${id}`);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function loadDemoData(): Promise<void> {
  const ctx = await requireWriter();
  await seedDemoData(ctx.supabase, ctx.orgId, ctx.user.id);
  await logActivity(ctx, "demo_data_loaded");
  revalidatePath("/dashboard");
}

function isRedirect(e: unknown) {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}
