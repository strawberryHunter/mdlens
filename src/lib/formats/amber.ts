import { columnsToQuantities, type Column, type Dataset } from "../dataset";

const KCAL = "kcal/mol";

const NAMES: Record<string, [string, string]> = {
  "TEMP(K)": ["Temperature", "K"],
  PRESS: ["Pressure", "bar"],
  Etot: ["Total energy", KCAL],
  EKtot: ["Kinetic energy", KCAL],
  EPtot: ["Potential energy", KCAL],
  BOND: ["Bond", KCAL],
  ANGLE: ["Angle", KCAL],
  DIHED: ["Dihedral", KCAL],
  "1-4 NB": ["1-4 van der Waals", KCAL],
  "1-4 EEL": ["1-4 electrostatic", KCAL],
  VDWAALS: ["van der Waals", KCAL],
  EELEC: ["Electrostatic", KCAL],
  EHBOND: ["H-bond", KCAL],
  RESTRAINT: ["Restraint", KCAL],
  "EAMBER (non-restraint)": ["Energy (non-restraint)", KCAL],
  EKCMT: ["Kinetic energy (COM)", KCAL],
  VIRIAL: ["Virial", KCAL],
  VOLUME: ["Volume", "Å³"],
  Density: ["Density", "g/cm³"],
  // Thermodynamic integration: dV/dλ, the integrand of the free-energy estimate.
  "DV/DL": ["dV/dλ", KCAL],
};

const PAIR = /([A-Za-z0-9][A-Za-z0-9()/_ -]*?)\s*=\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|\*+|NaN)/g;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * AMBER mdout (sander/pmemd MD). Each frame is a block of `KEY = value` pairs starting at
 * `NSTEP =`. The averages and fluctuations blocks at the end are skipped. In TI runs every
 * step is printed once per TI region; region 1 is read.
 */
export function parseAmberMdout(text: string): Dataset {
  const frames: Map<string, number>[] = [];
  const order: string[] = [];
  let current: Map<string, number> | null = null;
  let skipNext = false;
  let region = 1;
  let otherRegionFrames = 0;
  let overflows = 0;
  let nans = 0;

  for (const line of text.split(/\r?\n/)) {
    if (/A V E R A G E S|F L U C T U A T I O N S/.test(line)) {
      skipNext = true;
      current = null;
      continue;
    }
    const regionMark = line.match(/^\|\s*TI region\s+(\d+)\s*$/);
    if (regionMark) {
      region = Number(regionMark[1]);
      continue;
    }
    if (/^\s*-{20,}\s*$/.test(line)) {
      current = null;
      continue;
    }
    if (/\bNSTEP\s*=/.test(line) && /TIME\(PS\)/.test(line)) {
      if (skipNext) {
        skipNext = false;
        current = null;
        continue;
      }
      if (region !== 1) {
        otherRegionFrames++;
        current = null;
        continue;
      }
      current = new Map();
      frames.push(current);
    }
    if (!current) continue;
    for (const [, key, value] of line.matchAll(PAIR)) {
      const k = key.trim();
      // Fortran prints ***** when a value does not fit its field.
      const overflow = /^\*+$/.test(value);
      if (overflow) overflows++;
      if (value === "NaN") nans++;
      current.set(k, overflow ? NaN : Number(value));
      if (!order.includes(k)) order.push(k);
    }
  }

  const x = frames.map((f) => f.get("TIME(PS)") ?? NaN);
  const columns: Column[] = order
    .filter((k) => k !== "NSTEP" && k !== "TIME(PS)")
    .map((k) => {
      const [name, unit] = NAMES[k] ?? [k, KCAL];
      return { name, unit, values: frames.map((f) => f.get(k) ?? NaN) };
    });

  const notes: string[] = [];
  if (otherRegionFrames) {
    notes.push(`TI output: region 1 is shown; ${otherRegionFrames} ${plural(otherRegionFrames, "frame", "frames")} from other TI regions ${plural(otherRegionFrames, "was", "were")} skipped.`);
  }
  if (overflows) {
    notes.push(`${overflows} ${plural(overflows, "value", "values")} printed as ***** (field overflow) ${plural(overflows, "is", "are")} shown as missing.`);
  }
  if (nans) notes.push(`${nans} ${plural(nans, "value is", "values are")} NaN.`);

  return {
    engine: "AMBER",
    title: "AMBER mdout",
    xName: "Time",
    xUnit: "ps",
    quantities: columnsToQuantities(x, columns),
    notes,
  };
}
