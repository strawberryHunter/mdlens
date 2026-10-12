// Agreement with pymbar (the reference implementation of Chodera 2016).
// Regenerate the fixture with validation/make_reference.py.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFile } from "./formats/detect";
import { detectEquilibration, statisticalInefficiency, summarize } from "./stats";

interface Case {
  y: number[];
  g_fast: number;
  t0: number;
  production_mean: number;
  production_se: number;
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

  it.each(cases)("%s: the app's fast default gives a production mean within 1 SE of pymbar's", (_, c) => {
    const s = summarize(index(c.y), c.y);
    expect(Math.abs(s.mean - c.production_mean)).toBeLessThan(c.production_se);
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
