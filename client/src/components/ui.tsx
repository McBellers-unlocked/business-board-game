import clsx from "clsx";
import { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({ className, variant = "primary", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const cls = clsx(
    "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none",
    variant === "primary" && "bg-brand-600 text-white hover:bg-brand-700",
    variant === "secondary" && "bg-ink-100 text-ink-50 border border-ink-300 hover:bg-ink-200",
    variant === "ghost" && "bg-transparent text-ink-700 hover:bg-ink-100",
    variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
    className
  );
  return <button className={cls} {...rest} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "block w-full rounded-md border border-ink-300 bg-ink-100 px-3 py-2 text-sm shadow-sm",
        "focus:border-brand-500 focus:ring-brand-500 focus:outline-none",
        props.className
      )}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        "block w-full rounded-md border border-ink-300 bg-ink-100 px-3 py-2 text-sm shadow-sm",
        "focus:border-brand-500 focus:ring-brand-500 focus:outline-none",
        props.className
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        "block w-full rounded-md border border-ink-300 bg-ink-100 px-3 py-2 text-sm shadow-sm",
        "focus:border-brand-500 focus:ring-brand-500 focus:outline-none",
        props.className
      )}
    />
  );
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("rounded-lg bg-ink-100 shadow ring-1 ring-ink-300/40", className)} {...rest} />;
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("p-4", className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={clsx("font-semibold text-ink-900", className)} {...rest} />;
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "good" | "warn" | "bad" | "info"; children: React.ReactNode; className?: string }) {
  const cls = clsx(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
    tone === "neutral" && "bg-ink-300/60 text-ink-50",
    tone === "good" && "bg-green-800/60 text-green-300",
    tone === "warn" && "bg-yellow-800/60 text-yellow-300",
    tone === "bad" && "bg-red-800/60 text-red-300",
    tone === "info" && "bg-brand-600/40 text-brand-500",
    className
  );
  return <span className={cls}>{children}</span>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-ink-700 mb-1">{children}</label>;
}

export function SectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={clsx("text-lg font-semibold text-ink-900 mb-3", className)}>{children}</h2>;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-ink-900 p-3 ring-1 ring-ink-300/40">
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className="text-xl font-semibold text-ink-50">{value}</div>
      {hint ? <div className="text-xs text-ink-500 mt-0.5">{hint}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx("animate-spin h-4 w-4 text-brand-600", className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
