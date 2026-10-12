import { describe, expect, it } from "vitest";
import { fmt, pm, roundPM } from "./format";

describe("roundPM", () => {
  it.each([
    [0.2153, 0.0312, "0.22", "0.03"],
    [0.2153, 0.0152, "0.215", "0.015"],
    [300.43, 1.3, "300.4", "1.3"],
    [-85786.34, 12.3, "-85786", "12"],
    [299.97, 0.42, "300.0", "0.4"],
  ])("%d ± %d → %s ± %s", (mean, err, m, e) => {
    expect(roundPM(mean, err)).toEqual([m, e]);
  });

  it("writes a mean that rounds to zero without a minus sign", () => {
    expect(roundPM(-0.3, 2)).toEqual(["0", "2"]);
    expect(roundPM(-0.0004, 0.012)).toEqual(["0.000", "0.012"]);
    expect(roundPM(-0.004, 0.012)).toEqual(["-0.004", "0.012"]);
  });

  it("falls back when the error is missing", () => {
    expect(roundPM(1.23456, NaN)).toEqual(["1.235", "–"]);
  });
});

describe("pm and fmt", () => {
  it("formats with a unit", () => {
    expect(pm(0.2153, 0.0312, "nm")).toBe("0.22 ± 0.03 nm");
  });

  it("uses exponents for extremes", () => {
    expect(fmt(1.5e-5)).toBe("1.50e-5");
    expect(fmt(NaN)).toBe("–");
  });
});
