import { Eye, EyeOff, Info, Plus, X } from "lucide-react";
import { fmt } from "../lib/format";
import type { UnitPrefs } from "../lib/units";
import { timeAxis, type LoadedFile } from "../lib/workspace";
import { Card, EngineBadge, IconButton, cx } from "./ui";

function span(file: LoadedFile, prefs: UnitPrefs): string {
  const xs = file.dataset.quantities[0]?.x ?? [];
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of xs) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!(hi > lo)) return "";
  const t = timeAxis(file.dataset, prefs);
  return `${fmt((hi - lo) * t.factor, 3)} ${t.unit || file.dataset.xName}`;
}

export function FileRail({
  files,
  prefs,
  onUpdate,
  onRemove,
  onAdd,
  onClear,
  className,
}: {
  files: LoadedFile[];
  prefs: UnitPrefs;
  onUpdate: (id: string, patch: Partial<LoadedFile>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onClear: () => void;
  className?: string;
}) {
  return (
    <Card className={cx("p-2", className)}>
      <div className="flex items-center justify-between px-2 py-1.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          Files <span className="ml-1 rounded bg-raised px-1.5 py-0.5 text-[10px] text-ink">{files.length}</span>
        </h2>
        <IconButton label="Add files" onClick={onAdd}>
          <Plus className="size-4" />
        </IconButton>
      </div>

      <ul className="space-y-1">
        {files.map((f) => (
          <li
            key={f.id}
            className={cx("group rounded-xl px-2 py-2 transition-colors hover:bg-raised/70", !f.visible && "opacity-50")}
          >
            <div className="flex items-center gap-2">
              <label className="relative size-3.5 shrink-0 cursor-pointer rounded-full ring-2 ring-surface" style={{ background: f.color }} title="Line colour">
                <input
                  type="color"
                  value={f.color}
                  onChange={(e) => onUpdate(f.id, { color: e.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label={`Colour of ${f.label}`}
                />
              </label>
              <input
                value={f.label}
                onChange={(e) => onUpdate(f.id, { label: e.target.value })}
                aria-label="Legend name"
                title={f.name}
                className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[13px] font-medium text-ink hover:border-line focus:border-accent focus:outline-none"
              />
              <IconButton label={f.visible ? "Hide" : "Show"} onClick={() => onUpdate(f.id, { visible: !f.visible })} className="size-7">
                {f.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </IconButton>
              <IconButton label={`Remove ${f.name}`} onClick={() => onRemove(f.id)} className="size-7 opacity-0 group-hover:opacity-100 focus:opacity-100">
                <X className="size-3.5" />
              </IconButton>
            </div>
            <div className="mt-1 flex items-center gap-2 pl-5.5 text-[11px] text-muted" style={{ paddingLeft: 22 }}>
              <EngineBadge engine={f.dataset.engine} />
              <span className="truncate">
                {f.dataset.quantities.length} quantities{span(f, prefs) && ` · ${span(f, prefs)}`}
              </span>
            </div>
            {f.dataset.notes.map((n) => (
              <p key={n} className="mt-1 flex gap-1 text-[11px] leading-snug text-warn" style={{ paddingLeft: 22 }}>
                <Info className="mt-px size-3 shrink-0" /> {n}
              </p>
            ))}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onClear}
        className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-muted transition-colors hover:bg-raised hover:text-ink"
      >
        Clear all
      </button>
    </Card>
  );
}
