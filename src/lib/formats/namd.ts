import { columnsToQuantities, numbersIn, type Column, type Dataset } from "../dataset";

const KCAL = "kcal/mol";

// ETITLE keyword → [name, unit]. Everything not listed is an energy term in kcal/mol.
const NAMES: Record<string, [string, string]> = {
  BOND: ["Bond", KCAL],
  ANGLE: ["Angle", KCAL],
  DIHED: ["Dihedral", KCAL],
  IMPRP: ["Improper", KCAL],
  CROSS: ["CMAP", KCAL],
  ELECT: ["Electrostatic", KCAL],
  VDW: ["van der Waals", KCAL],
  BOUNDARY: ["Boundary", KCAL],
  MISC: ["Misc", KCAL],
  KINETIC: ["Kinetic energy", KCAL],
  TOTAL: ["Total energy", KCAL],
  TOTAL2: ["Total energy 2", KCAL],
  TOTAL3: ["Total energy 3", KCAL],
  POTENTIAL: ["Potential energy", KCAL],
  TEMP: ["Temperature", "K"],
  TEMPAVG: ["Temperature (average)", "K"],
  PRESSURE: ["Pressure", "bar"],
  GPRESSURE: ["Group pressure", "bar"],
  PRESSAVG: ["Pressure (average)", "bar"],
  GPRESSAVG: ["Group pressure (average)", "bar"],
  VOLUME: ["Volume", "Å³"],
};

/** NAMD standard output: `ETITLE:` names the columns of every `ENERGY:` line. */
export function parseNamdLog(text: string): Dataset {
  let titles: string[] | null = null;
  let timestepFs: number | null = null;
  const rows: number[][] = [];

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("ENERGY:")) {
      if (titles) rows.push(numbersIn(line.slice(7)));
    } else if (line.startsWith("ETITLE:")) {
      titles ??= line.slice(7).trim().split(/\s+/);
    } else if (timestepFs === null) {
      const m = line.match(/^Info: TIMESTEP\s+([\d.eE+-]+)/);
      if (m) timestepFs = Number(m[1]);
    }
  }

  const notes: string[] = [];
  if (!titles) return { engine: "NAMD", title: "", xName: "Step", xUnit: "", quantities: [], notes };

  const steps = rows.map((r) => r[0]);
  const x = timestepFs ? steps.map((s) => (s * timestepFs!) / 1000) : steps;
  if (!timestepFs) notes.push("TIMESTEP not found in the log; x axis is the step number.");

  const columns: Column[] = titles.slice(1).map((key, j) => {
    const [name, unit] = NAMES[key] ?? [key, KCAL];
    return { name, unit, values: rows.map((r) => r[j + 1] ?? NaN) };
  });

  return {
    engine: "NAMD",
    title: "NAMD energies",
    xName: timestepFs ? "Time" : "Step",
    xUnit: timestepFs ? "ps" : "",
    quantities: columnsToQuantities(x, columns),
    notes,
  };
}
