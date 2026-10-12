import { describe, expect, it } from "vitest";
import { detectEquilibration, statisticalInefficiency, summarize } from "./stats";

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussians(n: number, seed: number) {
  const r = rng(seed);
  return Array.from({ length: n }, () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()));
}

function ar1(n: number, phi: number, seed: number) {
  const g = gaussians(n, seed);
  let e = 0;
  return g.map((v) => (e = phi * e + Math.sqrt(1 - phi * phi) * v));
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("statisticalInefficiency", () => {
  it("is about 1 for white noise", () => {
    expect(statisticalInefficiency(gaussians(5000, 1))).toBeLessThan(1.5);
  });

  it("is about (1 + φ) / (1 − φ) for AR(1) noise", () => {
    const g = statisticalInefficiency(ar1(20000, 0.9, 2));
    expect(g).toBeGreaterThan(12);
    expect(g).toBeLessThan(28);
  });

  it("is 1 for a constant", () => {
    expect(statisticalInefficiency([3, 3, 3, 3, 3])).toBe(1);
  });
});

describe("detectEquilibration", () => {
  it("finds the end of an exponential relaxation", () => {
    const noise = ar1(2000, 0.5, 3);
    const y = noise.map((e, i) => 10 * Math.exp(-i / 100) + 0.5 * e);
    const { start } = detectEquilibration(range(2000), y);
    expect(start).toBeGreaterThan(150);
    expect(start).toBeLessThan(900);
  });

  it("keeps a stationary series from the start", () => {
    const { start } = detectEquilibration(range(2000), gaussians(2000, 4));
    expect(start).toBeLessThan(400);
  });
});

describe("summarize", () => {
  it("reports a larger standard error for correlated data", () => {
    const y = ar1(5000, 0.95, 5);
    const s = summarize(range(5000), y, { from: 0, to: Infinity });
    expect(s.se).toBeGreaterThan((2 * s.sd) / Math.sqrt(s.n));
  });

  it("drops frames at or after `until` before detecting equilibration", () => {
    const y = [...Array(50).fill(1), ...Array(50).fill(1e6)];
    const s = summarize(range(100), y, undefined, 50);
    expect(s.max).toBe(1);
    expect(s.n).toBeLessThanOrEqual(50);
  });

  it("ignores `until` when a manual range is given", () => {
    expect(summarize(range(10), range(10), { from: 0, to: 9 }, 5).n).toBe(10);
  });

  it("uses the given range", () => {
    const s = summarize(range(100), range(100), { from: 50, to: 59 });
    expect(s).toMatchObject({ n: 10, mean: 54.5, from: 50 });
    expect(s.slope).toBeCloseTo(1);
    expect(s.equilibrationFraction).toBeCloseTo(50 / 99);
  });
});
