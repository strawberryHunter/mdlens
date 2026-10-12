import { describe, expect, it } from "vitest";
import type { Dataset } from "./dataset";
import { DEFAULT_UNITS } from "./units";
import { summarize } from "./stats";
import { buildCatalog, buildPanels, loadFile, scaleSummary, timeAxis } from "./workspace";

const namd: Dataset = {
  engine: "NAMD",
  title: "",
  xName: "Time",
  xUnit: "ps",
  quantities: [
    { name: "Temperature", unit: "K", x: [0, 1000, 2000], y: [299, 300, 301] },
    { name: "Potential energy", unit: "kcal/mol", x: [0, 1000, 2000], y: [-10, -10, -10] },
  ],
  notes: [],
};

const openmm: Dataset = {
  engine: "OpenMM",
  title: "",
  xName: "Time",
  xUnit: "ps",
  quantities: [
    { name: "Potential energy", unit: "kJ/mol", x: [0, 1000], y: [-41.84, -42] },
    { name: "Temperature", unit: "K", x: [0, 1000], y: [300, 302] },
  ],
  notes: [],
};

const files = [loadFile("a", "equil.log", namd, "#111"), loadFile("b", "prod.csv", openmm, "#222")];

describe("buildCatalog", () => {
  const catalog = buildCatalog(files);

  it("merges the same observable across engines and orders by importance", () => {
    expect(catalog.map((e) => e.name)).toEqual(["Temperature", "Potential energy"]);
    expect(catalog[0].refs).toHaveLength(2);
    expect(catalog[0].category).toBe("thermo");
    expect(catalog[1].category).toBe("energy");
  });

  it("flags quantities that never change in any file", () => {
    expect(catalog[1].constant).toBe(false);
    expect(buildCatalog([files[0]])[1].constant).toBe(true);
  });
});

describe("buildPanels", () => {
  const catalog = buildCatalog(files);

  it("converts every file to one unit per panel and time to the preferred unit", () => {
    const { panels, xLabel } = buildPanels(["potential energy|energy"], catalog, files, DEFAULT_UNITS, false);
    expect(xLabel).toBe("Time (ns)");
    expect(panels[0].yLabel).toBe("Potential energy (kcal/mol)");
    const fromOpenmm = panels[0].series.find((s) => s.fileId === "b")!;
    expect(fromOpenmm.y[0]).toBeCloseTo(-10);
    expect(fromOpenmm.x).toEqual([0, 1]);
  });

  it("names lines after files, and skips hidden files", () => {
    const hidden = files.map((f) => (f.id === "b" ? { ...f, visible: false } : f));
    const { panels } = buildPanels(["temperature|temperature"], catalog, hidden, DEFAULT_UNITS, false);
    expect(panels[0].series.map((s) => s.name)).toEqual(["equil"]);
  });

  it("stacks one panel per quantity unless merging same-unit quantities", () => {
    const keys = ["temperature|temperature", "potential energy|energy"];
    expect(buildPanels(keys, catalog, files, DEFAULT_UNITS, false).panels).toHaveLength(2);
    expect(buildPanels(keys, catalog, files, DEFAULT_UNITS, true).panels).toHaveLength(2);
  });

  it("scales summaries with the units", () => {
    const { panels } = buildPanels(["potential energy|energy"], catalog, files, { ...DEFAULT_UNITS, energy: "kJ/mol" }, false);
    const fromNamd = panels[0].series.find((s) => s.fileId === "a")!;
    expect(fromNamd.summary.mean).toBeCloseTo(-41.84);
  });
});

describe("timeAxis", () => {
  it("converts time axes to the preferred unit and leaves other axes alone", () => {
    expect(timeAxis({ ...namd, xUnit: "fs" }, DEFAULT_UNITS)).toEqual({ factor: 1e-6, unit: "ns" });
    expect(timeAxis({ ...namd, xName: "Residue", xUnit: "" }, DEFAULT_UNITS)).toEqual({ factor: 1, unit: "" });
  });
});

describe("scaleSummary", () => {
  it("scales values by the y factor, the start by the x factor and the slope by their ratio", () => {
    const s = summarize([0, 1, 2, 3], [1, 2, 3, 4], { from: 0, to: Infinity });
    const scaled = scaleSummary(s, 10, 0.5);
    expect([scaled.mean, scaled.sd, scaled.min, scaled.max]).toEqual([s.mean * 10, s.sd * 10, 10, 40]);
    expect(scaled.se).toBeCloseTo(s.se * 10);
    expect(scaled.from).toBe(0);
    expect(scaled.slope).toBeCloseTo((s.slope * 10) / 0.5);
  });
});

describe("buildPanels with mixed x axes", () => {
  const steps: Dataset = { ...namd, xName: "Step", xUnit: "", quantities: [{ name: "Temperature", unit: "K", x: [0, 500, 1000], y: [300, 301, 302] }] };
  const mixed = [files[0], loadFile("c", "tail.log", steps, "#333")];
  const catalog = buildCatalog(mixed);

  it("keeps the time axis and lists files on other axes", () => {
    const r = buildPanels(["temperature|temperature"], catalog, mixed, DEFAULT_UNITS, false);
    expect(r.xIsTime).toBe(true);
    expect(r.panels[0].series.map((s) => s.fileId)).toEqual(["a"]);
    expect(r.excluded).toEqual([{ fileId: "c", label: "tail", axis: "Step" }]);
  });

  it("uses the other axis when no file has time", () => {
    const r = buildPanels(["temperature|temperature"], catalog, mixed.map((f) => (f.id === "a" ? { ...f, visible: false } : f)), DEFAULT_UNITS, false);
    expect(r.xIsTime).toBe(false);
    expect(r.xLabel).toBe("Step");
    expect(r.excluded).toEqual([]);
  });

  it("drops a panel whose quantity only exists in excluded files", () => {
    const onlySteps: Dataset = { ...steps, quantities: [{ name: "Lambda", unit: "", x: [0, 1], y: [0, 1] }] };
    const fs = [files[0], loadFile("d", "lambda.dat", onlySteps, "#444")];
    const r = buildPanels(["temperature|temperature", "lambda|"], buildCatalog(fs), fs, DEFAULT_UNITS, false);
    expect(r.panels.map((p) => p.yLabel)).toEqual(["Temperature (K)"]);
    expect(r.excluded.map((e) => e.fileId)).toEqual(["d"]);
  });
});

describe("unstable runs", () => {
  const blown: Dataset = {
    ...namd,
    quantities: [
      { name: "Temperature", unit: "K", x: [0, 1000, 2000, 3000], y: [300, 301, NaN, NaN] },
      { name: "Potential energy", unit: "kcal/mol", x: [0, 1000, 2000, 3000], y: [-10, -11, 5e9, 6e9] },
    ],
  };
  const f = loadFile("u", "blown.log", blown, "#555");

  it("records where the run became unstable and leaves later frames out of statistics", () => {
    expect(f.unstableFrom).toBe(2000);
    expect(f.summaries[1].max).toBe(-10);
    expect(f.notes.at(-1)).toMatch(/Temperature becomes NaN at 2000 ps/);
  });

  it("passes the point on to plotted series in display units", () => {
    const { panels } = buildPanels(["potential energy|energy"], buildCatalog([f]), [f], DEFAULT_UNITS, false);
    expect(panels[0].series[0].unstableFrom).toBe(2);
  });
});
