import { describe, expect, it } from "vitest";
import { canonicalName, columnsToQuantities, findInstability, joinSegments, numbersIn, splitLabel, type Dataset } from "./dataset";

describe("splitLabel", () => {
  it.each([
    ["Time (ps)", { name: "Time", unit: "ps" }],
    ["Potential Energy (kJ/mole)", { name: "Potential Energy", unit: "kJ/mol" }],
    ["(kJ/mol)", { name: "", unit: "kJ/mol" }],
    ["Residue", { name: "Residue", unit: "" }],
    ["Box Volume (nm^3)", { name: "Box Volume", unit: "nm³" }],
  ])("%s", (label, expected) => {
    expect(splitLabel(label)).toEqual(expected);
  });
});

describe("canonicalName", () => {
  it("maps engine spellings to one name and leaves others alone", () => {
    expect(canonicalName("Kinetic En.")).toBe("Kinetic energy");
    expect(canonicalName(" potential ")).toBe("Potential energy");
    expect(canonicalName("Box Volume")).toBe("Volume");
    expect(canonicalName("LJ (SR)")).toBe("LJ (SR)");
  });
});

describe("numbersIn", () => {
  it("splits fixed-width columns that run together", () => {
    expect(numbersIn("   97.16924-207513.13059 201255.32717")).toEqual([97.16924, -207513.13059, 201255.32717]);
  });

  it("reads exponents, including Fortran D exponents", () => {
    expect(numbersIn("1.5e-3 2.0D+02 -3")).toEqual([0.0015, 200, -3]);
  });
});

describe("joinSegments", () => {
  it("continues a clock that restarts", () => {
    const x = [0, 1, 2, 0, 1, 2];
    expect(joinSegments(x)).toBe(2);
    expect(x).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("leaves a monotonic clock and NaN alone", () => {
    const x = [0, 1, NaN, 3];
    expect(joinSegments(x)).toBe(1);
    expect(x).toEqual([0, 1, NaN, 3]);
  });

  it("keeps repeated time stamps as they are", () => {
    const x = [0, 1, 1, 2];
    expect(joinSegments(x)).toBe(1);
    expect(x).toEqual([0, 1, 1, 2]);
  });
});

describe("columnsToQuantities", () => {
  it("drops columns without any finite value", () => {
    const q = columnsToQuantities([0, 1], [
      { name: "a", unit: "K", values: [1, 2] },
      { name: "b", unit: "", values: [NaN, NaN] },
    ]);
    expect(q.map((c) => c.name)).toEqual(["a"]);
    expect(q[0]).toMatchObject({ unit: "K", x: [0, 1], y: [1, 2] });
  });
});

describe("findInstability", () => {
  const dataset = (name: string, y: number[]): Dataset => ({
    engine: "AMBER",
    title: "",
    xName: "Time",
    xUnit: "ps",
    quantities: [{ name, unit: "K", x: y.map((_, i) => i * 10), y }],
    notes: [],
  });

  it("finds where the temperature turns NaN for good", () => {
    expect(findInstability(dataset("Temperature", [300, 301, 299, NaN, NaN, NaN, NaN]))).toEqual({
      quantity: "Temperature",
      from: 30,
      frames: 4,
      total: 7,
    });
  });

  it("ignores isolated gaps and a single missing last value", () => {
    expect(findInstability(dataset("Temperature", [300, NaN, 301, 299, 300, NaN]))).toBeNull();
  });

  it("falls back to the total energy and returns null without either", () => {
    expect(findInstability(dataset("Total energy", [1, 2, NaN, NaN]))?.quantity).toBe("Total energy");
    expect(findInstability(dataset("RMSD", [1, NaN, NaN]))).toBeNull();
  });
});
