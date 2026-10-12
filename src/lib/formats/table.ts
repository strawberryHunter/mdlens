import { canonicalName, columnsToQuantities, splitLabel, type Column, type Dataset, type Engine } from "../dataset";

function splitCells(line: string, sep: "comma" | "tab" | "space"): string[] {
  const cells = sep === "comma" ? line.split(",") : sep === "tab" ? line.split("\t") : line.trim().split(/\s+/);
  return cells.map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
}

// "0.8%" appears in OpenMM's Progress column.
function readCell(cell: string): number {
  const c = cell.endsWith("%") ? cell.slice(0, -1) : cell;
  const n = Number(c);
  return c !== "" && !Number.isNaN(n) ? n : NaN;
}

const isNumeric = (cell: string) => !Number.isNaN(readCell(cell));
// A data row is mostly numbers; OpenMM adds text columns such as "Time Remaining".
const isDataRow = (cells: string[]) => cells.filter(isNumeric).length >= Math.max(1, Math.ceil(cells.length / 2));
// Columns that describe the run rather than the system.
const BOOKKEEPING = /^(step|progress|time remaining|elapsed time)$/i;

/**
 * Column tables: OpenMM StateDataReporter CSV, PLUMED COLVAR/HILLS, cpptraj .dat,
 * LAMMPS fix ave/time, NAMD colvars traj, and any CSV/TSV/whitespace table.
 * The column names come from (in order of preference) an OpenMM `#"…"` header, a PLUMED
 * `#! FIELDS` line, a non-numeric first row, or the last comment line with the right width.
 */
export function parseTable(text: string): Dataset {
  const lines = text.split(/\r?\n/);
  let engine: Engine = "Table";
  let header: string[] | null = null;
  const comments: string[] = [];
  const dataLines: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#"')) {
      engine = "OpenMM";
      header = splitCells(line.slice(1), line.includes('"\t"') ? "tab" : "comma");
      continue;
    }
    if (line.startsWith("#! FIELDS")) {
      engine = "PLUMED";
      header = line.split(/\s+/).slice(2);
      continue;
    }
    if (line.startsWith("#") || line.startsWith("@")) {
      if (!dataLines.length) comments.push(line);
      continue;
    }
    dataLines.push(line);
  }

  const sep = dataLines[0]?.includes(",") ? "comma" : dataLines[0]?.includes("\t") ? "tab" : "space";
  if (!header && dataLines.length && !isDataRow(splitCells(dataLines[0], sep))) {
    header = splitCells(dataLines.shift()!, sep);
  }

  // Keep mostly-numeric rows of the most common width; anything else is noise.
  const rows = dataLines.map((l) => splitCells(l, sep)).filter(isDataRow);
  const widths = new Map<number, number>();
  for (const r of rows) widths.set(r.length, (widths.get(r.length) ?? 0) + 1);
  const width = [...widths].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const table = rows.filter((r) => r.length === width).map((r) => r.map(readCell));

  const empty: Dataset = { engine, title: "", xName: "x", xUnit: "", quantities: [], notes: [] };
  if (width < 2 || table.length < 2) return empty;

  if (!header) {
    for (let i = comments.length - 1; i >= 0; i--) {
      const cells = comments[i].replace(/^#+/, "").trim().split(/\s+/);
      if (cells.length === width) {
        header = cells;
        break;
      }
    }
  }
  const names = header?.length === width ? header : Array.from({ length: width }, (_, j) => (j === 0 ? "x" : `Column ${j + 1}`));

  const labels = names.map(splitLabel);
  // OpenMM writes both Step and Time; time is the better x axis.
  let xi = labels.findIndex((l) => /^time$/i.test(l.name));
  if (xi < 0) xi = 0;
  const xLabel = labels[xi];
  const x = table.map((r) => r[xi]);
  const skip = new Set([xi, ...labels.flatMap((l, j) => (BOOKKEEPING.test(l.name) ? [j] : []))]);

  const columns: Column[] = labels.flatMap((l, j) =>
    skip.has(j) ? [] : [{ name: canonicalName(l.name), unit: l.unit, values: table.map((r) => r[j]) }],
  );

  const xName = /^#?frame$/i.test(xLabel.name) ? "Frame" : /^time$/i.test(xLabel.name) ? "Time" : xLabel.name;
  return {
    engine,
    title: engine === "OpenMM" ? "OpenMM state data" : engine === "PLUMED" ? "PLUMED" : "",
    xName,
    // PLUMED reports time in ps unless told otherwise.
    xUnit: xLabel.unit || (engine === "PLUMED" && xName === "Time" ? "ps" : ""),
    quantities: columnsToQuantities(x, columns),
    notes: [],
  };
}
