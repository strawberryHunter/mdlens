import { ChevronDown } from "lucide-react";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Engine } from "../lib/dataset";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  icon?: ReactNode;
};

export function Button({ variant = "secondary", size = "md", icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-accent text-white shadow-sm shadow-accent/30 hover:brightness-110",
        variant === "secondary" && "border border-line bg-surface text-ink hover:border-muted/40 hover:bg-raised",
        variant === "ghost" && "text-muted hover:bg-raised hover:text-ink",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cx("flex rounded-lg bg-raised p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 whitespace-nowrap rounded-md px-2 py-1 text-[12.5px] font-medium transition-all",
            o.value === value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-[13px]">
      <span className="text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === "string" ? label : undefined}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          checked ? "bg-accent" : "bg-line",
        )}
      >
        <span
          className={cx("absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform", checked && "translate-x-4")}
        />
      </button>
    </div>
  );
}

export function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted transition-colors hover:text-ink"
      >
        {title}
        <ChevronDown className={cx("size-3.5 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </section>
  );
}

export const inputClass =
  "h-8 w-full rounded-lg border border-line bg-bg px-2.5 text-[13px] text-ink placeholder:text-muted/60 transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

/**
 * A labelled group of buttons (e.g. a Segmented control). A <label> would hand its whole
 * text to the first button as that button's accessible name.
 */
export function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="space-y-1">
      <span className="block text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <input
      type="number"
      className={inputClass}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (e.target.value !== "" && Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
      }}
    />
  );
}

export const ENGINE_COLORS: Record<Engine, string> = {
  GROMACS: "#3b82f6",
  NAMD: "#f97316",
  OpenMM: "#14b8a6",
  CHARMM: "#a855f7",
  LAMMPS: "#ef4444",
  AMBER: "#eab308",
  PLUMED: "#22c55e",
  Table: "#94a3b8",
};

export function EngineBadge({ engine }: { engine: Engine }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-raised px-1.5 py-0.5 text-[11px] font-semibold text-ink">
      <span className="size-1.5 rounded-full" style={{ background: ENGINE_COLORS[engine] }} />
      {engine}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-line bg-surface shadow-soft", className)}>{children}</div>;
}
