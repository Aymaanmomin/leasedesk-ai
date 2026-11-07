import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component; middleware refreshes the session.
          }
        },
      },
    },
  );
}

/** Returns the signed-in user and their organization, or redirects. */
export async function requireOrg() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations(name)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");
  const org = membership.organizations as unknown as { name: string } | null;
  return {
    supabase,
    user,
    orgId: membership.organization_id as string,
    orgName: org?.name ?? "",
    role: membership.role as "owner" | "manager" | "viewer",
  };
}

export async function logActivity(
  ctx: { supabase: Awaited<ReturnType<typeof createClient>>; orgId: string; user: { id: string } },
  eventType: string,
  details: Record<string, unknown> = {},
  contractId?: string,
) {
  await ctx.supabase.from("activity_logs").insert({
    organization_id: ctx.orgId,
    actor_id: ctx.user.id,
    event_type: eventType,
    contract_id: contractId ?? null,
    details,
  });
}
