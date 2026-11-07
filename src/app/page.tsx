import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-2xl font-semibold">LeaseDesk AI — setup needed</h1>
        <p className="mt-3 text-slate-600">
          Copy <code>.env.example</code> to <code>.env.local</code> and fill in your Supabase URL and anon key,
          then restart the dev server. See README.md.
        </p>
      </main>
    );
  }
  redirect("/dashboard");
}
