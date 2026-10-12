import { normalizeUnit } from "./units";

export type Engine = "GROMACS" | "NAMD" | "OpenMM" | "CHARMM" | "LAMMPS" | "AMBER" | "PLUMED" | "Table";

/** One observable over time (or over residues, frames…), as recorded by the engine. */
export interface Quantity {
  /** Engine-independent name where one exists ("Temperature", "Potential energy"), else the engine's. */
  name: string;
  /** Normalised unit, "" when unknown or dimensionless. */
  unit: string;
  x: number[];
  y: number[];
  dy?: number[];
}

/** Everything read from one file, whatever engine wrote it. */
export interface Dataset {
  engine: Engine;
  title: string;
  xName: string;
  xUnit: string;
  quantities: Quantity[];
  /** Things the user should know about how the file was read. */
  notes: string[];
}

/** "Time (ps)" → { name: "Time", unit: "ps" }. */
export function splitLabel(label: string): { name: string; unit: string } {
  const m = label.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return m ? { name: m[1].trim(), unit: normalizeUnit(m[2]) } : { name: label.trim(), unit: "" };
}

// Names used by several engines and analysis tools for the same observable.
const CANONICAL: Record<string, string> = {
  temperature: "Temperature",
  temp: "Temperature",
  pressure: "Pressure",
  potential: "Potential energy",
  "potential energy": "Potential energy",
  "kinetic en.": "Kinetic energy",
  "kinetic energy": "Kinetic energy",
  "total energy": "Total energy",
  "conserved en.": "Conserved energy",
  "conserved energy": "Conserved energy",
  volume: "Volume",
  "box volume": "Volume",
  density: "Density",
  "box-x": "Box X",
  "box-y": "Box Y",
  "box-z": "Box Z",
  rmsd: "RMSD",
  rmsf: "RMSF",
};

export function canonicalName(name: string): string {
  const trimmed = name.trim();
  return CANONICAL[trimmed.toLowerCase()] ?? trimmed;
}

const NUMBER = /[-+]?(?:\d+\.\d*|\.\d+|\d+)(?:[eEdD][-+]?\d+)?/g;

/**
 * Numbers in a line of fixed-width output. Fortran-style columns can run together
 * ("97.16924-207513.13059"), which whitespace splitting would misread.
 */
export function numbersIn(s: string): number[] {
  return (s.match(NUMBER) ?? []).map((t) => Number(t.replace(/[dD]/, "e")));
}

/**
 * Makes a clock that restarts (several runs in one log) continue where the previous run
 * ended. Modifies `x` in place and returns the number of runs found.
 */
export function joinSegments(x: number[]): number {
  let offset = 0;
  let prev = -Infinity;
  let prevAdjusted = 0;
  let dt = 0;
  let segments = 1;
  for (let i = 0; i < x.length; i++) {
    const t = x[i];
    if (!Number.isFinite(t)) continue;
    if (t < prev) {
      offset = prevAdjusted + dt - t;
      segments++;
    } else if (prev > -Infinity && t > prev) {
      dt = t - prev;
    }
    prev = t;
    prevAdjusted = t + offset;
    x[i] = prevAdjusted;
  }
  return segments;
}

export interface Column {
  name: string;
  unit: string;
  values: number[];
}

/** Builds quantities that share one x array, dropping columns with no finite values. */
export function columnsToQuantities(x: number[], columns: Column[]): Quantity[] {
  return columns
    .filter((c) => c.values.some(Number.isFinite))
    .map((c) => ({ name: c.name, unit: c.unit, x, y: c.values }));
}

export interface Instability {
  /** Quantity that revealed it (Temperature, or an energy when there is no temperature). */
  quantity: string;
  /** x value of the first bad frame. */
  from: number;
  frames: number;
  total: number;
}

/**
 * Where a run blew up: the first frame from which the temperature (or total/potential energy)
 * is non-finite for at least 90% of the remaining frames, and for at least two frames. A
 * single missing value, such as a truncated last line, is not an instability.
 */
export function findInstability(d: Dataset): Instability | null {
  const q =
    d.quantities.find((c) => c.name === "Temperature") ??
    d.quantities.find((c) => c.name === "Total energy") ??
    d.quantities.find((c) => c.name === "Potential energy");
  if (!q) return null;
  const n = q.y.length;
  const badFrom = new Array<number>(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) badFrom[i] = badFrom[i + 1] + (Number.isFinite(q.y[i]) ? 0 : 1);
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(q.y[i])) continue;
    if (badFrom[i] >= 2 && badFrom[i] >= 0.9 * (n - i)) return { quantity: q.name, from: q.x[i], frames: badFrom[i], total: n };
  }
  return null;
}
