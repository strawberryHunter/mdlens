// Agreement with pymbar (the reference implementation of Chodera 2016).
// Regenerate the fixture with validation/make_reference.py.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFile } from "./formats/detect";
import { blockingSE, detectEquilibration, histogram, kde, reblock, statisticalInefficiency, summarize } from "./stats";

interface Case {
  y: number[];
  g_fast: number;
  t0: number;
  production_mean: number;
  production_se: number;
  block_levels_se: number[];
  block_optimal: number | null;
  block_se: number | null;
  hist_edges: number[];
  hist_density: number[];
  kde_bandwidth: number;
  kde_x: number[];
  kde_density: number[];
}

const reference = JSON.parse(readFileSync(new URL("./__fixtures__/pymbar_reference.json", import.meta.url), "utf8")) as {
  cases: Record<string, Case>;
};
const cases = Object.entries(reference.cases);
const index = (y: number[]) => y.map((_, i) => i);

describe("agreement with pymbar 4.2", () => {
  it.each(cases)("%s: statistical inefficiency matches statistical_inefficiency(fast=True)", (_, c) => {
    expect(Math.abs(statisticalInefficiency(c.y) - c.g_fast) / c.g_fast).toBeLessThan(1e-12);
  });

  it.each(cases)("%s: mean and SE over pymbar's production region match", (_, c) => {
    const s = summarize(index(c.y), c.y, { from: c.t0, to: Infinity });
    expect(Math.abs(s.mean - c.production_mean)).toBeLessThan(1e-9 * Math.max(1, Math.abs(c.production_mean)));
    expect(Math.abs(s.se - c.production_se) / c.production_se).toBeLessThan(1e-12);
  });

  it.each(cases)("%s: exhaustive search finds the same equilibration start as detect_equilibration", (_, c) => {
    expect(detectEquilibration(index(c.y), c.y, c.y.length, c.y.length).start).toBe(c.t0);
  });

  it.each(cases)("%s: the app's default (runs up to 2000 frames) gives pymbar's equilibration start and mean", (_, c) => {
    expect(detectEquilibration(index(c.y), c.y).start).toBe(c.t0);
    const s = summarize(index(c.y), c.y);
    expect(Math.abs(s.mean - c.production_mean)).toBeLessThan(1e-9 * Math.max(1, Math.abs(c.production_mean)));
  });
});

const close = (a: number, b: number, rel: number) => Math.abs(a - b) <= rel * Math.max(1e-300, Math.abs(b));

describe("agreement with pyblock 0.6, numpy and scipy on pymbar's production region", () => {
  it.each(cases)("%s: blocking standard errors match pyblock.blocking.reblock at every level", (_, c) => {
    const levels = reblock(c.y.slice(c.t0));
    expect(levels).toHaveLength(c.block_levels_se.length);
    levels.forEach((l, i) => expect(close(l.se, c.block_levels_se[i], 1e-10)).toBe(true));
  });

  it.each(cases)("%s: the chosen block size matches find_optimal_block", (_, c) => {
    const b = blockingSE(c.y.slice(c.t0));
    if (c.block_optimal === null) expect(b.se).toBeNaN();
    else {
      expect(b.blockSize).toBe(2 ** c.block_optimal);
      expect(close(b.se, c.block_se!, 1e-10)).toBe(true);
    }
  });

  it.each(cases)("%s: histogram matches numpy.histogram(bins='auto', density=True)", (_, c) => {
    const h = histogram(c.y.slice(c.t0));
    expect(h.edges).toHaveLength(c.hist_edges.length);
    h.edges.forEach((e, i) => expect(close(e, c.hist_edges[i], 1e-12)).toBe(true));
    h.density.forEach((d, i) => expect(close(d, c.hist_density[i], 1e-10)).toBe(true));
  });

  it.each(cases)("%s: KDE matches scipy.stats.gaussian_kde (Scott's rule)", (_, c) => {
    const k = kde(c.y.slice(c.t0))!;
    expect(close(k.bandwidth, c.kde_bandwidth, 1e-12)).toBe(true);
    k.x.forEach((x, i) => expect(close(x, c.kde_x[i], 1e-12)).toBe(true));
    k.density.forEach((d, i) => expect(Math.abs(d - c.kde_density[i])).toBeLessThan(1e-10 * Math.max(...c.kde_density)));
  });
});

describe("independent parsers agree", () => {
  it("MDLens reads the same NAMD temperatures as the Python reference script", () => {
    const text = readFileSync(new URL("../../public/samples/namd_equil.log", import.meta.url), "utf8");
    const temperature = parseFile("namd_equil.log", text).quantities.find((q) => q.name === "Temperature")!;
    const expected = reference.cases.namd_sample_temperature.y;
    expect(temperature.y).toHaveLength(expected.length);
    expect(Math.max(...temperature.y.map((v, i) => Math.abs(v - expected[i])))).toBeLessThan(1e-9);
  });
});
