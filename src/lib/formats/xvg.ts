import { canonicalName, splitLabel, type Dataset } from "../dataset";
import { graceToUnicode } from "../grace";
import { dimensionOf, normalizeUnit } from "../units";

export interface XvgSeries {
  /** Legend text from the file (Unicode), or "" when the file has none. */
  name: string;
  x: number[];
  y: number[];
  /** Error column of `@TYPE xydy` files. */
  dy?: number[];
}

export interface XvgData {
  title: string;
  subtitle: string;
  xLabel: string;
  yLabel: string;
  /** Grace set type, e.g. "xy" or "xydy". */
  type: string;
  series: XvgSeries[];
  /** Non-comment lines that could not be read as numbers. */
  skippedLines: number;
}

const SPECIAL = /^([-+]?)(nan|inf|infinity)$/i;

/** A number, NaN for a missing/nan cell, or undefined when the cell is not numeric at all. */
function readCell(cell: string): number | undefined {
  if (cell === "") return NaN;
  const n = Number(cell);
  if (!Number.isNaN(n)) return n;
  const m = cell.match(SPECIAL);
  if (!m) return undefined;
  return m[2].toLowerCase() === "nan" ? NaN : m[1] === "-" ? -Infinity : Infinity;
}

/**
 * Parses GROMACS/Grace .xvg text. Also accepts plain whitespace or comma separated
 * tables (.dat/.csv), optionally with a header row naming the columns.
 *
 * Column layout: the first column is x, every other column is a series. Blocks separated
 * by `&` lines are separate datasets; legends `@ sN legend` are numbered across all of them.
 */
export function parseXvg(text: string): XvgData {
  let title = "";
  let subtitle = "";
  let xLabel = "";
  let yLabel = "";
  let type = "xy";
  const legends: string[] = [];
  const blocks: number[][][] = [];
  let rows: number[][] = [];
  let skippedLines = 0;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("&")) {
      if (rows.length) blocks.push(rows);
      rows = [];
      continue;
    }

    if (line.startsWith("@")) {
      const d = line.slice(1).trim();
      let m: RegExpMatchArray | null;
      if ((m = d.match(/^title\s+"(.*)"/))) title = m[1];
      else if ((m = d.match(/^subtitle\s+"(.*)"/))) subtitle = m[1];
      else if ((m = d.match(/^xaxis\s+label\s+"(.*)"/))) xLabel = m[1];
      else if ((m = d.match(/^yaxis\s+label\s+"(.*)"/))) yLabel = m[1];
      else if ((m = d.match(/^s(\d+)\s+legend\s+"(.*)"/))) legends[Number(m[1])] = m[2];
      else if ((m = d.match(/^legend\s+string\s+(\d+)\s+"(.*)"/))) legends[Number(m[1])] = m[2];
      else if ((m = d.match(/^TYPE\s+(\S+)/i))) type = m[1].toLowerCase();
      continue;
    }

    const cells = line.includes(",") ? line.split(/\s*,\s*/) : line.split(/\s+/);
    const values = cells.map(readCell);
    if (values.some((v) => v === undefined)) {
      // Header row of a plain table: first cell names x, the rest name the series.
      if (!rows.length && !blocks.length && cells.length >= 2 && !xLabel) {
        xLabel = cells[0];
        cells.slice(1).forEach((c, i) => (legends[i] ??= c));
      } else {
        skippedLines++;
      }
      continue;
    }
    rows.push(values as number[]);
  }
  if (rows.length) blocks.push(rows);

  const series: XvgSeries[] = [];
  let legendIndex = 0;
  const nextName = () => graceToUnicode(legends[legendIndex++] ?? "");

  for (const block of blocks) {
    let width = 0;
    for (const r of block) if (r.length > width) width = r.length;
    const column = (j: number) => block.map((r) => (j < r.length ? r[j] : NaN));

    if (width === 1) {
      series.push({ name: nextName(), x: block.map((_, i) => i), y: column(0) });
      continue;
    }
    const x = column(0);
    if (type === "xydy" && width >= 3) {
      series.push({ name: nextName(), x, y: column(1), dy: column(2) });
      continue;
    }
    for (let j = 1; j < width; j++) series.push({ name: nextName(), x, y: column(j) });
  }

  return {
    title: graceToUnicode(title),
    subtitle: graceToUnicode(subtitle),
    xLabel: graceToUnicode(xLabel),
    yLabel: graceToUnicode(yLabel),
    type,
    series,
    skippedLines,
  };
}

// gmx energy writes one unit list for all selected terms; used when it can't be matched 1:1.
const GMX_UNITS: Record<string, string> = {
  Temperature: "K",
  Pressure: "bar",
  "Pres. DC": "bar",
  Density: "kg/m³",
  Volume: "nm³",
  "Box X": "nm",
  "Box Y": "nm",
  "Box Z": "nm",
};

export function xvgDataset(text: string): Dataset {
  const d = parseXvg(text);
  const x = splitLabel(d.xLabel);
  const y = splitLabel(d.yLabel);
  // gmx energy with several terms: "(K), (bar), (kg/m^3)".
  const units = [...d.yLabel.matchAll(/\(([^()]*)\)/g)].map((m) => normalizeUnit(m[1]));
  const perSeries = /\)\s*,\s*\(/.test(d.yLabel);
  const single = d.series.length === 1;

  const quantities = d.series.map((s, i) => {
    // One series: the axis label names it ("RMSD (nm)"); several: the legends do.
    const raw = single ? y.name || s.name : s.name || y.name;
    const name = canonicalName(raw || d.title || `Column ${i + 1}`);
    let unit = y.unit;
    if (perSeries) {
      unit =
        units.length === d.series.length
          ? units[i]
          : (GMX_UNITS[name] ?? units.find((u) => dimensionOf(u) === "energy") ?? units[0] ?? "");
    }
    return { name, unit, x: s.x, y: s.y, dy: s.dy };
  });

  return {
    engine: "GROMACS",
    title: d.title,
    xName: x.name || "x",
    xUnit: x.unit,
    quantities,
    notes: d.skippedLines ? [`${d.skippedLines} unreadable lines were skipped.`] : [],
  };
}
