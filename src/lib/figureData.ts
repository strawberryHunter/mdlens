import type { FigureBand, FigureLine, FigurePanel, FigureRule } from "./figure";
import { aggregate, lttb, movingAverage, type Summary } from "./stats";
import { PALETTE, type Panel } from "./workspace";

const MAX_POINTS = 2500;

export interface FigureOptions {
  smooth: number;
  showRaw: boolean;
  aggregate: boolean;
  fullRes: boolean;
  markEquilibration: boolean;
  /** Statistics to use per series id (auto-detected or manual range). */
  summaries: Map<string, Summary>;
}

/** Downsamples x and companion arrays with the indices LTTB picks on (x, ys[0]). */
function decimate(x: number[], ys: number[][], enabled: boolean): number[][] {
  if (!enabled || x.length <= MAX_POINTS) return [x, ...ys];
  const idx = lttb(x, ys[0], MAX_POINTS);
  return [idx.map((i) => x[i]), ...ys.map((y) => idx.map((i) => y[i]))];
}

/** Lines, bands and markers for one panel. `aggregateFailed` when series can't be averaged. */
export function panelToFigure(panel: Panel, yLabel: string, o: FigureOptions): { figure: FigurePanel; aggregateFailed: boolean } {
  const lines: FigureLine[] = [];
  const bands: FigureBand[] = [];
  const rules: FigureRule[] = [];
  const thin = !o.fullRes;
  const smoothed = (y: number[]) => (o.smooth > 1 ? movingAverage(y, o.smooth) : y);

  const agg = o.aggregate && panel.series.length >= 2 ? aggregate(panel.series) : null;
  if (agg) {
    if (o.showRaw) {
      for (const s of panel.series) {
        const [x, y] = decimate(s.x, [s.y], thin);
        lines.push({ name: s.name, color: "#9a9a9a", x, y, opacity: 0.45, legend: false });
      }
    }
    const mean = smoothed(agg.mean);
    const sd = smoothed(agg.sd);
    const [x, m, lo, hi] = decimate(agg.x, [mean, mean.map((v, i) => v - sd[i]), mean.map((v, i) => v + sd[i])], thin);
    bands.push({ color: PALETTE[0], x, lo, hi });
    lines.push({ name: `Mean ± SD (n = ${panel.series.length})`, color: PALETTE[0], x, y: m });
  } else {
    for (const s of panel.series) {
      if (o.smooth > 1 && o.showRaw) {
        const [x, y] = decimate(s.x, [s.y], thin);
        lines.push({ name: s.name, color: s.color, x, y, opacity: 0.25, dash: s.dash, legend: false });
      }
      const y = smoothed(s.y);
      if (s.dy) {
        const dy = s.dy;
        const [x, , lo, hi] = decimate(s.x, [y, y.map((v, i) => v - dy[i]), y.map((v, i) => v + dy[i])], thin);
        bands.push({ color: s.color, x, lo, hi });
      }
      const [x, yy] = decimate(s.x, [y], thin);
      lines.push({ name: s.name, color: s.color, x, y: yy, dash: s.dash });
    }
  }

  if (o.markEquilibration) {
    for (const s of panel.series) {
      const summary = o.summaries.get(s.id);
      if (summary && summary.equilibrationFraction > 0) rules.push({ x: summary.from, color: agg ? "#666" : s.color });
    }
  }

  // A single line needs no legend; the axis label says what it is.
  if (lines.filter((l) => l.legend !== false).length === 1 && !agg) lines.forEach((l) => (l.legend = false));

  return { figure: { yLabel, lines, bands, rules }, aggregateFailed: o.aggregate && panel.series.length >= 2 && !agg };
}
