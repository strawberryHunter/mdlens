import { describe, expect, it } from "vitest";
import { conversionFactor, DEFAULT_UNITS, dimensionOf, displayUnit, formatLabel, normalizeUnit, type UnitPrefs } from "./units";

describe("normalizeUnit", () => {
  it.each([
    ["kJ/mole", "kJ/mol"],
    ["kJ mol^-1", "kJ/mol"],
    ["kJ mol⁻¹", "kJ/mol"],
    ["kcal/mole", "kcal/mol"],
    ["nm^2", "nm²"],
    ["nm^3", "nm³"],
    ["A", "Å"],
    ["A^3", "Å³"],
    ["Angstrom", "Å"],
    ["kcal/mol/A", "kcal/mol/Å"],
    ["g/mL", "g/cm³"],
    ["kg/m^3", "kg/m³"],
    ["us", "µs"],
    ["K", "K"],
    ["bar", "bar"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeUnit(raw)).toBe(expected);
  });
});

describe("conversionFactor", () => {
  it("converts within a dimension", () => {
    expect(conversionFactor("ps", "ns")).toBe(1e-3);
    expect(conversionFactor("fs", "ps")).toBe(1e-3);
    expect(conversionFactor("nm", "Å")).toBe(10);
    expect(conversionFactor("nm²", "Å²")).toBe(100);
    expect(conversionFactor("Å³", "nm³")).toBeCloseTo(1e-3);
    expect(conversionFactor("kcal/mol", "kJ/mol")).toBe(4.184);
    expect(conversionFactor("atm", "bar")).toBe(1.01325);
    expect(conversionFactor("kg/m³", "g/cm³")).toBe(1e-3);
  });

  it("converts forces as energy per length", () => {
    expect(conversionFactor("kJ/mol/nm", "kcal/mol/Å")).toBeCloseTo(1 / 41.84);
  });

  it("refuses to mix dimensions and passes unknown identical units", () => {
    expect(conversionFactor("K", "bar")).toBeNull();
    expect(conversionFactor("degrees", "degrees")).toBe(1);
    expect(conversionFactor("degrees", "rad")).toBeNull();
  });
});

describe("displayUnit", () => {
  const prefs: UnitPrefs = { time: "ns", length: "Å", energy: "kcal/mol", pressure: "atm" };

  it("applies preferences per dimension", () => {
    expect(displayUnit("ps", prefs)).toBe("ns");
    expect(displayUnit("nm", prefs)).toBe("Å");
    expect(displayUnit("nm²", prefs)).toBe("Å²");
    expect(displayUnit("nm³", prefs)).toBe("Å³");
    expect(displayUnit("kJ/mol", prefs)).toBe("kcal/mol");
    expect(displayUnit("kJ/mol/nm", prefs)).toBe("kcal/mol/Å");
    expect(displayUnit("bar", prefs)).toBe("atm");
    expect(displayUnit("K", prefs)).toBe("K");
  });

  it("keeps recorded units on auto", () => {
    expect(displayUnit("kcal/mol", DEFAULT_UNITS)).toBe("kcal/mol");
    expect(displayUnit("Å³", DEFAULT_UNITS)).toBe("Å³");
    expect(displayUnit("fs", DEFAULT_UNITS)).toBe("ns");
  });
});

describe("helpers", () => {
  it("dimensionOf", () => {
    expect(dimensionOf("kcal/mol")).toBe("energy");
    expect(dimensionOf("#")).toBeNull();
  });

  it("formatLabel", () => {
    expect(formatLabel("RMSD", "Å")).toBe("RMSD (Å)");
    expect(formatLabel("Count", "")).toBe("Count");
    expect(formatLabel("", "kJ/mol")).toBe("(kJ/mol)");
  });
});
