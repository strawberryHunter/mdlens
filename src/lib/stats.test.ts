import { describe, expect, it } from "vitest";
import { aggregate, lttb, meanSd, movingAverage, rangeStats } from "./stats";

describe("movingAverage", () => {
  it("averages a centered window and shrinks at the edges", () => {
    expect(movingAverage([1, 2, 3, 4, 5], 3)).toEqual([1.5, 2, 3, 4, 4.5]);
  });

  it("is the identity for window ≤ 1", () => {
    expect(movingAverage([3, 1, 2], 1)).toEqual([3, 1, 2]);
  });

  it("skips NaN", () => {
    expect(movingAverage([1, NaN, 3], 3)).toEqual([1, 2, 3]);
  });
});

describe("rangeStats", () => {
  const x = [0, 1, 2, 3, 4];
  const y = [10, 2, 4, 4, 6];

  it("computes mean, sample SD, min and max", () => {
    const s = rangeStats(x, y, 1, 4);
    expect(s.n).toBe(4);
    expect(s.mean).toBe(4);
    expect(s.sd).toBeCloseTo(Math.sqrt(8 / 3));
    expect([s.min, s.max]).toEqual([2, 6]);
  });

  it("returns NaN for an empty range", () => {
    expect(rangeStats(x, y, 10, 20)).toMatchObject({ n: 0, mean: NaN, sd: NaN });
  });

  it("meanSd matches", () => {
    expect(meanSd([1, 2, 3])).toEqual({ n: 3, mean: 2, sd: 1 });
  });
});

describe("lttb", () => {
  const n = 10_000;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = x.map((i) => (i === 5_000 ? 100 : Math.sin(i / 500)));

  it("returns the requested number of points, keeping both ends", () => {
    const idx = lttb(x, y, 500);
    expect(idx).toHaveLength(500);
    expect(idx[0]).toBe(0);
    expect(idx[idx.length - 1]).toBe(n - 1);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it("keeps a single-frame spike", () => {
    expect(lttb(x, y, 500)).toContain(5_000);
  });

  it("returns every index when there is nothing to drop", () => {
    expect(lttb([0, 1, 2], [0, 1, 2], 10)).toEqual([0, 1, 2]);
  });
});

describe("aggregate", () => {
  it("computes point-by-point mean and SD", () => {
    const a = aggregate([
      { x: [0, 1], y: [1, 2] },
      { x: [0, 1], y: [3, 4] },
    ]);
    expect(a).toEqual({ x: [0, 1], mean: [2, 3], sd: [Math.SQRT2, Math.SQRT2] });
  });

  it("tolerates rounding in GROMACS time stamps", () => {
    expect(aggregate([
      { x: [0, 100000], y: [1, 1] },
      { x: [0, 99999.996], y: [1, 1] },
    ])).not.toBeNull();
  });

  it("refuses series with different x", () => {
    expect(aggregate([
      { x: [0, 1], y: [1, 2] },
      { x: [0, 2], y: [1, 2] },
    ])).toBeNull();
    expect(aggregate([{ x: [0], y: [1] }])).toBeNull();
  });
});
