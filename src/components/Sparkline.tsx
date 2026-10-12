import { lttb } from "../lib/stats";

export interface SparkSeries {
  x: number[];
  y: number[];
  color: string;
  /** Start of production; the region before it is shaded. */
  from?: number;
}

const W = 240;
const H = 56;
const PAD = 4;

/** Tiny overlay line chart for quantity cards. Scales to its container. */
export function Sparkline({ series }: { series: SparkSeries[] }) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const s of series) {
    for (let i = 0; i < s.x.length; i++) {
      if (!Number.isFinite(s.y[i]) || !Number.isFinite(s.x[i])) continue;
      x0 = Math.min(x0, s.x[i]);
      x1 = Math.max(x1, s.x[i]);
      y0 = Math.min(y0, s.y[i]);
      y1 = Math.max(y1, s.y[i]);
    }
  }
  if (!(x1 > x0)) return <div className="h-14" />;
  if (!(y1 > y0)) {
    y0 -= 1;
    y1 += 1;
  }
  const sx = (v: number) => ((v - x0) / (x1 - x0)) * W;
  const sy = (v: number) => H - PAD - ((v - y0) / (y1 - y0)) * (H - 2 * PAD);

  const paths = series.map((s) => {
    const idx = lttb(s.x, s.y, 140);
    let d = "";
    let pen = false;
    for (const i of idx) {
      if (!Number.isFinite(s.y[i])) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${sx(s.x[i]).toFixed(1)} ${sy(s.y[i]).toFixed(1)}`;
      pen = true;
    }
    return d;
  });

  const shade = series.length === 1 && series[0].from !== undefined && series[0].from > x0 ? sx(series[0].from) : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-14 w-full overflow-visible" aria-hidden>
      {shade > 0 && (
        <>
          <rect x={0} y={0} width={shade} height={H} className="fill-muted/10" />
          <line x1={shade} x2={shade} y1={0} y2={H} className="stroke-muted/50" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        </>
      )}
      {series.length > 1 &&
        series.map((s, i) =>
          s.from !== undefined && s.from > x0 ? (
            <line key={`m${i}`} x1={sx(s.from)} x2={sx(s.from)} y1={H - 6} y2={H} stroke={s.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          ) : null,
        )}
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={series[i].color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          opacity={series.length > 1 ? 0.85 : 1}
        />
      ))}
    </svg>
  );
}
