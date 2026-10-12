import { describe, expect, it } from "vitest";
import { blockingSE, histogram, kde, linspace, reblock } from "./stats";

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ar1(n: number, phi: number, seed: number) {
  const r = rng(seed);
  let e = 0;
  return Array.from({ length: n }, () => {
    const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    return (e = phi * e + Math.sqrt(1 - phi * phi) * z);
  });
}

describe("reblock and blockingSE", () => {
  it("halves the data at each level and drops an odd last value", () => {
    expect(reblock([1, 2, 3, 4, 5]).map((l) => [l.blockSize, l.blocks])).toEqual([
      [1, 5],
      [2, 2],
    ]);
  });

  it("recovers the AR(1) standard error of the mean, sqrt((1+φ)/(1−φ)/N), within 25%", () => {
    const phi = 0.9;
    const n = 2 ** 17;
    const theory = Math.sqrt((1 + phi) / (1 - phi) / n);
    const { se } = blockingSE(ar1(n, phi, 7));
    expect(Math.abs(se - theory) / theory).toBeLessThan(0.25);
  });

  it("gives NaN for a drifting series, whose error never stops growing with block size", () => {
    expect(blockingSE(Array.from({ length: 256 }, (_, i) => i)).se).toBeNaN();
  });

  it("finds a block size for uncorrelated data", () => {
    expect(blockingSE(ar1(4096, 0, 5)).se).toBeGreaterThan(0);
  });
});

describe("histogram", () => {
  it("counts every value once, with the last bin closed on the right", () => {
    const h = histogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(11);
    expect(h.edges[0]).toBe(0);
    expect(h.edges.at(-1)).toBe(10);
  });

  it("integrates to one", () => {
    const h = histogram(ar1(5000, 0.5, 1));
    const area = h.density.reduce((sum, d, i) => sum + d * (h.edges[i + 1] - h.edges[i]), 0);
    expect(area).toBeCloseTo(1, 12);
  });

  it("puts constant data in one bin around the value", () => {
    expect(histogram([2, 2, 2])).toEqual({ edges: [1.5, 2.5], counts: [3], density: [1] });
  });
});

describe("kde", () => {
  it("integrates to about one over its grid", () => {
    const k = kde(ar1(3000, 0.3, 2))!;
    const dx = k.x[1] - k.x[0];
    expect(k.density.reduce((a, b) => a + b, 0) * dx).toBeCloseTo(1, 2);
  });

  it("returns null without spread", () => {
    expect(kde([1, 1, 1])).toBeNull();
    expect(kde([1])).toBeNull();
  });
});

describe("linspace", () => {
  it("ends exactly at stop", () => {
    expect(linspace(0, 1, 4)).toEqual([0, 1 / 3, 2 / 3, 1]);
    expect(linspace(5, 6, 1)).toEqual([5]);
  });
});
