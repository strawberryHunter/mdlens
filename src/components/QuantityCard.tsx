import { CircleCheck, Minus, TriangleAlert } from "lucide-react";
import { fmt, roundPM } from "../lib/format";
import type { CatalogEntry, Panel } from "../lib/workspace";
import { Sparkline } from "./Sparkline";
import { cx } from "./ui";

function Status({ panel, timeUnit, constant }: { panel: Panel; timeUnit: string | null; constant: boolean }) {
  if (constant) {
    return (
      <span className="inline-flex items-center gap-1 text-muted">
        <Minus className="size-3.5" /> Constant
      </span>
    );
  }
  if (!timeUnit || !panel.series.length) return <span className="text-muted">Profile</span>;
  const unstable = panel.series.filter((s) => s.unstableFrom !== undefined);
  if (unstable.length) {
    return (
      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400" title="Temperature became NaN and stayed that way. Statistics use only the frames before it.">
        <TriangleAlert className="size-3.5" />
        {panel.series.length === 1
          ? `Unstable from ${fmt(unstable[0].unstableFrom!, 3)} ${timeUnit}`
          : `${unstable.length} of ${panel.series.length} became unstable`}
      </span>
    );
  }
  const unsettled = panel.series.filter((s) => s.summary.equilibrationFraction > 0.5);
  if (unsettled.length) {
    return (
      <span className="inline-flex items-center gap-1 text-warn" title="Equilibration took more than half of the run. Consider running longer.">
        <TriangleAlert className="size-3.5" />
        {panel.series.length === 1 ? "Still relaxing at > 50% of run" : `${unsettled.length} of ${panel.series.length} still relaxing`}
      </span>
    );
  }
  const s = panel.series[0].summary;
  const text =
    panel.series.length > 1
      ? `All ${panel.series.length} equilibrated`
      : s.equilibrationFraction > 0
        ? `Equilibrated at ${fmt(s.from, 3)} ${timeUnit}`
        : "Stationary from start";
  return (
    <span className="inline-flex items-center gap-1 text-ok">
      <CircleCheck className="size-3.5" /> {text}
    </span>
  );
}

export function QuantityCard({
  entry,
  panel,
  order,
  timeUnit,
  onToggle,
}: {
  entry: CatalogEntry;
  panel: Panel;
  /** Position in the figure (1-based), or 0 when not plotted. */
  order: number;
  timeUnit: string | null;
  onToggle: () => void;
}) {
  const single = panel.series.length === 1 ? panel.series[0] : null;
  const [mean, err] = single ? roundPM(single.summary.mean, single.summary.se) : ["", ""];

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={order > 0}
      className={cx(
        "group relative flex animate-fade-up flex-col gap-2 rounded-2xl border bg-surface p-4 text-left shadow-soft transition-all",
        "hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        order > 0 ? "border-accent ring-1 ring-accent" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink">{entry.name}</div>
          <div className="text-[11px] text-muted">{panel.unit || "no unit"}</div>
        </div>
        <span
          className={cx(
            "grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors",
            order > 0 ? "bg-accent text-white" : "border border-line text-transparent group-hover:border-accent/60",
          )}
        >
          {order > 0 ? order : ""}
        </span>
      </div>

      {single ? (
        <div className="flex items-baseline gap-1.5 tabular-nums">
          <span className="text-2xl font-semibold tracking-tight text-ink">{mean}</span>
          {err && err !== "–" && <span className="text-[13px] text-muted">± {err}</span>}
        </div>
      ) : (
        <div className="space-y-0.5 text-[12px] tabular-nums">
          {panel.series.slice(0, 3).map((s) => {
            const [m, e] = roundPM(s.summary.mean, s.summary.se);
            return (
              <div key={s.id} className="flex items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-muted">{s.name}</span>
                <span className="text-ink">
                  {m}
                  {e !== "–" && <span className="text-muted"> ± {e}</span>}
                </span>
              </div>
            );
          })}
          {panel.series.length > 3 && <div className="text-muted">+{panel.series.length - 3} more</div>}
        </div>
      )}

      <Sparkline series={panel.series.map((s) => ({ x: s.x, y: s.y, color: s.color, from: timeUnit ? s.summary.from : undefined }))} />

      <div className="text-[11.5px] font-medium">
        <Status panel={panel} timeUnit={timeUnit} constant={entry.constant} />
      </div>
    </button>
  );
}
