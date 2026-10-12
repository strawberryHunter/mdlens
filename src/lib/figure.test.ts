// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildFigure, figureHeightIn, type FigurePanel, type FigureSpec } from "./figure";

const rmsd: FigurePanel = {
  yLabel: "RMSD (nm)",
  lines: [
    { name: "rep 1", color: "#0072B2", x: [0, 100, 200], y: [0, 0.2, 0.22] },
    { name: "rep 2", color: "#D55E00", x: [0, 100, 200], y: [0, 0.25, 0.27], dash: "5 3" },
  ],
  bands: [],
  rules: [{ x: 50, color: "#0072B2" }],
};

const base: FigureSpec = {
  widthIn: 3.3,
  heightIn: 2.5,
  fontPt: 8,
  lineWidthPt: 1,
  xLabel: "Time (ns)",
  title: "",
  panels: [rmsd],
  highlight: null,
  yFromZero: false,
  frame: true,
  grid: false,
  legend: "top-right",
  panelLabels: true,
  document,
};

const texts = (svg: SVGSVGElement) => [...svg.querySelectorAll("text")].map((t) => t.textContent);

describe("buildFigure", () => {
  it("sizes the SVG from inches", () => {
    const svg = buildFigure(base);
    expect(svg.getAttribute("width")).toBe("317");
    expect(svg.getAttribute("height")).toBe("240");
  });

  it("draws axis labels and a left-aligned legend with dashes", () => {
    const svg = buildFigure(base);
    expect(texts(svg)).toEqual(expect.arrayContaining(["Time (ns)", "RMSD (nm)", "rep 1", "rep 2"]));
    const label = [...svg.querySelectorAll("text")].find((t) => t.textContent === "rep 1")!;
    expect(label.closest("g")!.getAttribute("text-anchor")).toBe("start");
    expect(svg.querySelector('line[stroke-dasharray="5 3"]')).not.toBeNull();
  });

  it("puts an auto legend in an empty corner", () => {
    // Data fills the right half from bottom to top; the left half is empty.
    const x = Array.from({ length: 400 }, (_, i) => i);
    const zigzag = x.map((i) => (i < 200 ? NaN : i % 2 ? 100 : 0));
    const rightHalf: FigurePanel = {
      yLabel: "y",
      lines: [
        { name: "a", color: "#000", x, y: zigzag },
        { name: "b", color: "#f00", x, y: zigzag.map((v) => v / 2) },
      ],
      bands: [],
      rules: [],
    };
    const svg = buildFigure({ ...base, panels: [rightHalf], legend: "auto" });
    const g = [...svg.querySelectorAll("text")].find((t) => t.textContent === "a")!.closest("g")!;
    const [, tx, ty] = g.getAttribute("transform")!.match(/translate\(([\d.]+),([\d.]+)\)/)!.map(Number);
    expect(tx).toBeLessThan(317 / 2);
    expect(ty).toBeLessThan(240 / 2);
  });

  it("adds a title and hides the legend on request", () => {
    expect(texts(buildFigure({ ...base, title: "Backbone RMSD" }))).toContain("Backbone RMSD");
    expect(texts(buildFigure({ ...base, legend: "none" }))).not.toContain("rep 1");
  });

  it("stacks panels on one x axis with a, b labels and a single legend", () => {
    const temp: FigurePanel = { ...rmsd, yLabel: "Temperature (K)", rules: [] };
    const svg = buildFigure({ ...base, panels: [rmsd, temp] });
    const t = texts(svg);
    expect(t.filter((s) => s === "Time (ns)")).toHaveLength(1);
    expect(t).toEqual(expect.arrayContaining(["a", "b", "RMSD (nm)", "Temperature (K)"]));
    expect(t.filter((s) => s === "rep 1")).toHaveLength(1);
  });

  it("gives every panel its own labelled x axis when independentX is on", () => {
    const a: FigurePanel = { yLabel: "Density", xLabel: "Temperature (K)", lines: [{ name: "", color: "#000", x: [290, 310], y: [0, 1] }], bands: [], rules: [] };
    const b: FigurePanel = { yLabel: "Density", xLabel: "Pressure (bar)", lines: [{ name: "", color: "#000", x: [-500, 500], y: [0, 1] }], bands: [], rules: [] };
    const t = texts(buildFigure({ ...base, panels: [a, b], independentX: true }));
    expect(t).toEqual(expect.arrayContaining(["Temperature (K)", "Pressure (bar)", "290", "−400"]));
  });

  it("shrinks a y label that is longer than its panel and keeps panel letters above the plots", () => {
    const long: FigurePanel = { ...rmsd, yLabel: "A very long y axis label (kcal/mol) that cannot fit", rules: [] };
    const svg = buildFigure({ ...base, panels: [rmsd, long] });
    const label = [...svg.querySelectorAll("text")].find((t) => t.textContent === long.yLabel)!;
    expect(Number(label.getAttribute("font-size"))).toBeLessThan((8 * 96) / 72);
    // The letter sits in the gap above the second panel's plot area (which starts 1.1 em down).
    const fs = (8 * 96) / 72;
    const letterY = Number([...svg.querySelectorAll("text")].find((t) => t.textContent === "b")!.getAttribute("y"));
    const panelTop = Number(
      [...svg.children].filter((e) => /^translate\(0,/.test(e.getAttribute("transform") ?? ""))[1].getAttribute("transform")!.match(/,([\d.]+)\)/)![1],
    );
    expect(letterY).toBeGreaterThan(panelTop);
    expect(letterY).toBeLessThan(panelTop + 1.1 * fs);
  });

  it("keeps stacked panels at a readable height", () => {
    expect(figureHeightIn({ heightIn: 2.5, panels: [rmsd] })).toBe(2.5);
    expect(figureHeightIn({ heightIn: 2.5, panels: [rmsd, rmsd, rmsd] })).toBeCloseTo(4.1);
  });

  it("copes with a flat line and NaN gaps", () => {
    const flat: FigurePanel = { yLabel: "", lines: [{ name: "flat", color: "#000", x: [0, 1, 2], y: [1, NaN, 1] }], bands: [], rules: [] };
    expect(buildFigure({ ...base, panels: [flat] }).querySelectorAll("path").length).toBeGreaterThan(0);
  });
});
