import { Copy, TriangleAlert } from "lucide-react";
import { Fragment } from "react";
import { fmt, pm } from "../lib/format";
import type { Summary } from "../lib/stats";
import { Card, IconButton } from "./ui";

export interface StatsRow {
  id: string;
  name: string;
  color: string;
  summary: Summary;
}

export interface StatsGroup {
  id: string;
  label: string;
  unit: string;
  rows: StatsRow[];
}

export function StatsTable({
  groups,
  timeUnit,
  manual,
  onCopy,
}: {
  groups: StatsGroup[];
  /** Unit of the x axis when it is time; null for profiles (e.g. per residue). */
  timeUnit: string | null;
  manual: boolean;
  onCopy: (text: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold text-ink">Production statistics</h2>
        <span className="text-[12px] text-muted">
          {manual ? "Manual range" : timeUnit ? "Region detected automatically per series" : "Whole profile"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] tabular-nums">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-muted">
              <th className="px-4 py-2 font-medium">Series</th>
              {timeUnit && <th className="px-3 py-2 text-right font-medium">From</th>}
              <th className="px-3 py-2 text-right font-medium">Mean ± SE</th>
              <th className="px-3 py-2 text-right font-medium" title="Independent error estimate by blocking (Flyvbjerg–Petersen)">
                SE (block)
              </th>
              <th className="px-3 py-2 text-right font-medium">SD</th>
              {timeUnit && <th className="px-3 py-2 text-right font-medium">Drift</th>}
              <th className="px-3 py-2 text-right font-medium">Frames</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.id}>
                {groups.length > 1 && (
                  <tr>
                    <td colSpan={8} className="bg-raised/60 px-4 py-1.5 text-[12px] font-semibold text-ink">
                      {g.label}
                    </td>
                  </tr>
                )}
                {g.rows.map((r) => {
                  const s = r.summary;
                  const text = pm(s.mean, s.se, g.unit);
                  return (
                    <tr key={r.id} className="border-t border-line/70 transition-colors hover:bg-raised/40">
                      <td className="max-w-[260px] px-4 py-2">
                        <span className="flex items-center gap-2">
                          <span className="size-2 shrink-0 rounded-full" style={{ background: r.color }} />
                          <span className="truncate text-ink">{r.name}</span>
                        </span>
                      </td>
                      {timeUnit && (
                        <td className="px-3 py-2 text-right text-muted">
                          {fmt(s.from, 3)} {timeUnit}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right font-medium text-ink">{text}</td>
                      <BlockCell se={s.se} blockSe={s.blockSe} />
                      <td className="px-3 py-2 text-right text-muted">{fmt(s.sd, 3)}</td>
                      {timeUnit && (
                        <td className="px-3 py-2 text-right text-muted">
                          {Number.isFinite(s.slope) ? `${s.slope >= 0 ? "+" : ""}${fmt(s.slope, 2)} ${g.unit ? `${g.unit}/` : "per "}${timeUnit}` : "–"}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right text-muted">{s.n.toLocaleString()}</td>
                      <td className="pr-2">
                        <IconButton label={`Copy ${text}`} onClick={() => onCopy(text)} className="size-7">
                          <Copy className="size-3.5" />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-[11.5px] leading-relaxed text-muted">
        SE is corrected for autocorrelation (statistical inefficiency), so it reflects the number of independent samples, not frames.
        SE (block) estimates the same error by block averaging; when the two differ by more than 2×, the run is probably not converged.
        {!manual && timeUnit && " Production starts where the effective sample count is largest (Chodera, JCTC 2016)."}
      </p>
    </Card>
  );
}

/** The blocking error, flagged when it disagrees with the autocorrelation error. */
function BlockCell({ se, blockSe }: { se: number; blockSe: number }) {
  if (!Number.isFinite(blockSe)) {
    return (
      <td className="px-3 py-2 text-right text-muted" title="No block size gives a stable error: the region is too short or still drifting.">
        –
      </td>
    );
  }
  const ratio = blockSe / se;
  const disagree = Number.isFinite(ratio) && (ratio > 2 || ratio < 0.5);
  return (
    <td
      className={`px-3 py-2 text-right ${disagree ? "text-warn" : "text-muted"}`}
      title={disagree ? `The two error estimates differ by ${ratio.toFixed(1)}×: the run may not be converged.` : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {disagree && <TriangleAlert className="size-3.5" />}
        {fmt(blockSe, 2)}
      </span>
    </td>
  );
}
