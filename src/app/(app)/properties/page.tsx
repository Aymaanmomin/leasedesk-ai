import Link from "next/link";
import { requireOrg } from "@/lib/supabase/server";
import { Button, Card, PageHeader } from "@/components/ui";

export default async function PropertiesPage() {
  const { supabase, orgId } = await requireOrg();
  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, name, address_line, city, state, zip, category, units(count)")
    .eq("organization_id", orgId)
    .order("name");
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader title="Properties" actions={<Link href="/properties/new"><Button>Add Property</Button></Link>} />
      {properties.length === 0 ? (
        <Card className="text-center text-sm text-slate-500">No properties yet.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <Link key={p.id} href={`/properties/${p.id}`}>
              <Card className="h-full hover:border-teal-400">
                <p className="font-medium">{p.name}</p>
                <p className="mt-1 text-sm text-slate-500">{p.address_line}, {p.city}, {p.state} {p.zip}</p>
                <p className="mt-3 text-xs text-slate-500">
                  {(p.units as unknown as { count: number }[])[0]?.count ?? 0} units · {p.category.replaceAll("_", " ")}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
