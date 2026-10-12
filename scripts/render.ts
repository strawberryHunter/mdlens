// Renders MD output files to an SVG figure from the command line, with the app's code.
// Usage: npm run render -- out.svg "Temperature" a.log [b.csv ...]
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { JSDOM } from "jsdom";
import { buildFigure } from "../src/lib/figure";
import { panelToFigure } from "../src/lib/figureData";
import { parseFile } from "../src/lib/formats/detect";
import { DEFAULT_UNITS } from "../src/lib/units";
import { buildCatalog, buildPanels, loadFile, PALETTE } from "../src/lib/workspace";

const [out, quantity, ...inputs] = process.argv.slice(2);
if (!out || !quantity || !inputs.length) {
  console.error('Usage: npm run render -- out.svg "Temperature" a.log [b.csv ...]');
  process.exit(1);
}

const files = inputs.map((path, i) => loadFile(`f${i}`, basename(path), parseFile(path, readFileSync(path, "utf8")), PALETTE[i % PALETTE.length]));
const catalog = buildCatalog(files);
const keys = quantity.split(",").map((name) => catalog.find((e) => e.name.toLowerCase() === name.trim().toLowerCase())?.key);
if (keys.some((k) => !k)) {
  console.error(`Unknown quantity. Available: ${catalog.map((e) => e.name).join(", ")}`);
  process.exit(1);
}

const { panels, xLabel } = buildPanels(keys as string[], catalog, files, DEFAULT_UNITS, false);
const summaries = new Map(panels.flatMap((p) => p.series.map((s) => [s.id, s.summary] as const)));
const { document } = new JSDOM("").window;
const svg = buildFigure({
  widthIn: 3.3,
  heightIn: 2.5,
  fontPt: 8,
  lineWidthPt: 1,
  xLabel,
  title: "",
  panels: panels.map((p) =>
    panelToFigure(p, p.yLabel, { smooth: 0, showRaw: true, aggregate: false, fullRes: false, markEquilibration: true, summaries }).figure,
  ),
  highlight: null,
  yFromZero: false,
  frame: true,
  grid: false,
  legend: "auto",
  panelLabels: true,
  document,
});
writeFileSync(out, svg.outerHTML);
console.log(`Wrote ${out}`);
