import Link from "next/link";
import { requireOrg } from "@/lib/supabase/server";
import { GENERAL_DISCLAIMER } from "@/components/ui";
import { signOut } from "../(auth)/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/properties", label: "Properties" },
  { href: "/contracts/new", label: "Add Contract" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { orgName, user, role } = await requireOrg();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="text-lg font-semibold text-teal-700">LeaseDesk AI</Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
            <span className="hidden sm:inline">{orgName} · {user.email} · {role}</span>
            <form action={signOut}>
              <button className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs leading-relaxed text-slate-500">{GENERAL_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
