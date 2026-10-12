import { describe, expect, it } from "vitest";
import { distributionOf, panelToDistribution, panelToFigure, type FigureOptions } from "./figureData";
import type { Summary } from "./stats";
import type { Panel, PlotSeries } from "./workspace";

const summary = (from: number, equilibrationFraction: number): Summary => ({
  n: 1,
  mean: 0,
  sd: 0,
  min: 0,
  max: 0,
  from,
  equilibrationFraction,
  se: 0,
  slope: 0,
  blockSe: 0,
});

function series(id: string, n: number, x0 = 0): PlotSeries {
  const x = Array.from({ length: n }, (_, i) => x0 + i);
  return { id, fileId: id, quantity: "q", name: id, color: "#123456", x, y: x.map((v) => Math.sin(v / 50)), summary: summary(10, 0.1) };
}

const options = (patch: Partial<FigureOptions> = {}): FigureOptions => ({
  smooth: 0,
  showRaw: true,
  aggregate: false,
  fullRes: false,
  markEquilibration: false,
  summaries: new Map(),
  ...patch,
});

const panel = (...s: PlotSeries[]): Panel => ({ id: "p", yLabel: "Y (K)", unit: "K", series: s });

describe("panelToFigure", () => {
  it("downsamples long series to 2500 points unless full resolution is on", () => {
    expect(panelToFigure(panel(series("a", 10_000)), "Y", options()).figure.lines[0].x).toHaveLength(2500);
    expect(panelToFigure(panel(series("a", 10_000)), "Y", options({ fullRes: true })).figure.lines[0].x).toHaveLength(10_000);
  });

  it("draws the smoothed line over a faint raw line kept out of the legend", () => {
    const { lines } = panelToFigure(panel(series("a", 100), series("b", 100)), "Y", options({ smooth: 5 })).figure;
    expect(lines).toHaveLength(4);
    expect(lines.filter((l) => l.legend === false && l.opacity === 0.25)).toHaveLength(2);
  });

  it("combines series as mean ± SD, and reports when their x values differ", () => {
    const ok = panelToFigure(panel(series("a", 50), series("b", 50)), "Y", options({ aggregate: true }));
    expect(ok.aggregateFailed).toBe(false);
    expect(ok.figure.bands).toHaveLength(1);
    expect(ok.figure.lines.at(-1)!.name).toBe("Mean ± SD (n = 2)");

    const bad = panelToFigure(panel(series("a", 50), series("b", 50, 7)), "Y", options({ aggregate: true }));
    expect(bad.aggregateFailed).toBe(true);
    expect(bad.figure.bands).toHaveLength(0);
  });

  it("marks equilibration only for series that had an equilibration period", () => {
    const summaries = new Map([
      ["a", summary(12, 0.2)],
      ["b", summary(0, 0)],
    ]);
    const { rules } = panelToFigure(panel(series("a", 50), series("b", 50)), "Y", options({ markEquilibration: true, summaries })).figure;
    expect(rules).toEqual([{ x: 12, color: "#123456" }]);
  });

  it("hides the legend for a single line and uses the given y label", () => {
    const { figure } = panelToFigure(panel(series("a", 50)), "Custom (K)", options());
    expect(figure.yLabel).toBe("Custom (K)");
    expect(figure.lines.every((l) => l.legend === false)).toBe(true);
  });
});

describe("panelToDistribution", () => {
  const s = { ...series("a", 400), summary: summary(100, 0.25) };

  it("draws a density line over a faint histogram, from the production region only", () => {
    const fig = panelToDistribution(panel(s), "T (K)", { summaries: new Map(), range: null, showHistogram: true });
    expect(fig.xLabel).toBe("T (K)");
    expect(fig.yLabel).toBe("Probability density");
    const [hist, density] = fig.lines;
    expect(hist.opacity).toBe(0.35);
    expect(density.x).toHaveLength(200);
    // Only y values from x >= 100 can appear in the histogram range.
    const prod = s.y.slice(100);
    expect(hist.x[0]).toBeCloseTo(Math.min(...prod));
    expect(hist.x.at(-1)).toBeCloseTo(Math.max(...prod));
  });

  it("stops at the unstable point and honours a manual range", () => {
    const unstable = { ...s, unstableFrom: 200 };
    const auto = panelToDistribution(panel(unstable), "T", { summaries: new Map(), range: null, showHistogram: true });
    expect(auto.lines[0].x.at(-1)).toBeCloseTo(Math.max(...s.y.slice(100, 200)));
    const manual = panelToDistribution(panel(s), "T", { summaries: new Map(), range: { from: 0, to: 49 }, showHistogram: true });
    expect(manual.lines[0].x.at(-1)).toBeCloseTo(Math.max(...s.y.slice(0, 50)));
  });

  it("skips the histogram when raw data are hidden", () => {
    expect(panelToDistribution(panel(s), "T", { summaries: new Map(), range: null, showHistogram: false }).lines).toHaveLength(1);
  });
});

describe("distributionOf", () => {
  it("counts exactly the production frames", () => {
    const s = { ...series("a", 400), summary: summary(100, 0.25), unstableFrom: 350 };
    const [d] = distributionOf(panel(s), { summaries: new Map(), range: null });
    expect(d.histogram.counts.reduce((a, b) => a + b, 0)).toBe(250);
    expect(d.kde).not.toBeNull();
  });
});
