import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSavedSettings } from "./settings";

describe("parseSavedSettings", () => {
  it("returns the defaults when nothing is saved", () => {
    expect(parseSavedSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("merges saved values, including nested units, over the defaults", () => {
    const s = parseSavedSettings(JSON.stringify({ fontPt: 10, units: { energy: "kcal/mol" } }));
    expect(s.fontPt).toBe(10);
    expect(s.units).toEqual({ ...DEFAULT_SETTINGS.units, energy: "kcal/mol" });
    expect(s.widthIn).toBe(DEFAULT_SETTINGS.widthIn);
  });

  it("throws on text that is not JSON, so the caller can report it", () => {
    expect(() => parseSavedSettings("{not json")).toThrow();
  });
});
