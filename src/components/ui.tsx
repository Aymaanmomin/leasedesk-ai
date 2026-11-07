// Small shadcn-style primitives (Tailwind only). Swap for shadcn/ui components as the app grows.
import type { ComponentProps, ReactNode } from "react";
import type { Indicator } from "@/lib/contracts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50",
        variant === "primary" && "bg-teal-600 text-white hover:bg-teal-700",
        variant === "secondary" && "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        variant === "ghost" && "text-slate-700 hover:bg-slate-100",
        className,
      )}
      {...props}
    />
  );
}

export const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(inputClass, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={cx(inputClass, props.className)} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-lg border border-slate-200 bg-white p-5 shadow-sm", className)} {...props} />;
}

const badgeColors: Record<Indicator, string> = {
  green: "bg-green-100 text-green-800 ring-green-600/20",
  yellow: "bg-yellow-100 text-yellow-800 ring-yellow-600/20",
  red: "bg-red-100 text-red-800 ring-red-600/20",
  blue: "bg-blue-100 text-blue-800 ring-blue-600/20",
  gray: "bg-slate-100 text-slate-700 ring-slate-500/20",
};

export function Badge({ color, children }: { color: Indicator; children: ReactNode }) {
  return (
    <span className={cx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", badgeColors[color])}>
      {children}
    </span>
  );
}

export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      {actions}
    </div>
  );
}

export const GENERAL_DISCLAIMER =
  "LeaseDesk AI provides automated document drafting, contract organization, and informational analysis tools. It does not provide legal advice and is not a law firm. AI-generated content may contain errors or omissions. We strongly recommend having a licensed attorney in the applicable jurisdiction review every lease, amendment, and important legal provision before signing or relying on it.";
