export type Dimension =
  | "time"
  | "length"
  | "area"
  | "volume"
  | "energy"
  | "force"
  | "pressure"
  | "density"
  | "temperature";

const MICRO = "µ";

// Factor to a base unit per dimension (ps, nm, nm², nm³, kJ/mol, bar, g/cm³, K).
const UNITS: Record<string, [Dimension, number]> = {
  fs: ["time", 1e-3],
  ps: ["time", 1],
  ns: ["time", 1e3],
  [`${MICRO}s`]: ["time", 1e6],
  nm: ["length", 1],
  "Å": ["length", 0.1],
  "nm²": ["area", 1],
  "Å²": ["area", 0.01],
  "nm³": ["volume", 1],
  "Å³": ["volume", 1e-3],
  "kJ/mol": ["energy", 1],
  "kcal/mol": ["energy", 4.184],
  eV: ["energy", 96.485332],
  bar: ["pressure", 1],
  atm: ["pressure", 1.01325],
  "g/cm³": ["density", 1],
  "kg/m³": ["density", 1e-3],
  K: ["temperature", 1],
};

/** One spelling per unit: "kJ/mole" → "kJ/mol", "nm^2" → "nm²", "A^3" → "Å³", "g/mL" → "g/cm³". */
export function normalizeUnit(raw: string): string {
  let u = raw.trim();
  if (!u) return "";
  u = u.replace(/\s*\/\s*/g, "/");
  u = u.replace(/(?:\^|\*\*)\s*2/g, "²").replace(/(?:\^|\*\*)\s*3/g, "³");
  u = u.replace(/\bmole\b/gi, "mol").replace(/\s*mol\s*(?:⁻¹|\^?-1)/g, "/mol");
  u = u.replace(/(^|[\s/(])(?:Angstroms?|Ang|A)(?=$|[²³/\s)])/g, "$1Å");
  u = u.replace(/^(?:us|μs)$/, `${MICRO}s`);
  if (/^g\/ml$/i.test(u)) u = "g/cm³";
  u = u.replace(/^kj(?=\/)/i, "kJ").replace(/^kcal(?=\/)/i, "kcal");
  return u;
}

interface UnitInfo {
  dim: Dimension;
  toBase: number;
}

export function unitInfo(raw: string): UnitInfo | null {
  const u = normalizeUnit(raw);
  const known = UNITS[u];
  if (known) return { dim: known[0], toBase: known[1] };
  // Force: energy per length, e.g. kJ/mol/nm.
  const m = u.match(/^(.+)\/(nm|Å)$/);
  if (m && UNITS[m[1]]?.[0] === "energy") return { dim: "force", toBase: UNITS[m[1]][1] / UNITS[m[2]][1] };
  return null;
}

export const dimensionOf = (unit: string): Dimension | null => unitInfo(unit)?.dim ?? null;

export type TimeUnit = "fs" | "ps" | "ns" | "µs";

export interface UnitPrefs {
  time: TimeUnit;
  length: "auto" | "nm" | "Å";
  energy: "auto" | "kJ/mol" | "kcal/mol" | "eV";
  pressure: "auto" | "bar" | "atm";
}

export const DEFAULT_UNITS: UnitPrefs = { time: "ns", length: "auto", energy: "auto", pressure: "auto" };

/** The unit to show a quantity recorded in `unit` in. "auto" keeps the recorded unit. */
export function displayUnit(unit: string, prefs: UnitPrefs): string {
  const u = normalizeUnit(unit);
  const info = unitInfo(u);
  if (!info) return u;
  const len = prefs.length === "auto" ? null : prefs.length;
  switch (info.dim) {
    case "time":
      return prefs.time === "µs" ? `${MICRO}s` : prefs.time;
    case "length":
      return len ?? u;
    case "area":
      return len ? `${len}²` : u;
    case "volume":
      return len ? `${len}³` : u;
    case "energy":
      return prefs.energy === "auto" ? u : prefs.energy;
    case "force": {
      const [energy, length] = u.split(/\/(?=[^/]+$)/);
      return `${prefs.energy === "auto" ? energy : prefs.energy}/${len ?? length}`;
    }
    case "pressure":
      return prefs.pressure === "auto" ? u : prefs.pressure;
    default:
      return u;
  }
}

/** Multiply values in `from` by this to get `to`; null when the units measure different things. */
export function conversionFactor(from: string, to: string): number | null {
  if (normalizeUnit(from) === normalizeUnit(to)) return 1;
  const a = unitInfo(from);
  const b = unitInfo(to);
  if (!a || !b || a.dim !== b.dim) return null;
  return a.toBase / b.toBase;
}

export function formatLabel(name: string, unit: string): string {
  if (!unit) return name;
  return name ? `${name} (${unit})` : `(${unit})`;
}
