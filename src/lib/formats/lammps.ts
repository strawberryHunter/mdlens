import { columnsToQuantities, joinSegments, type Column, type Dataset } from "../dataset";

interface UnitSystem {
  time: string;
  energy: string;
  pressure: string;
  length: string;
  density: string;
  temperature: string;
  /** Default timestep, in `time` units. */
  dt: number;
}

// https://docs.lammps.org/units.html
const SYSTEMS: Record<string, UnitSystem> = {
  real: { time: "fs", energy: "kcal/mol", pressure: "atm", length: "Å", density: "g/cm³", temperature: "K", dt: 1 },
  metal: { time: "ps", energy: "eV", pressure: "bar", length: "Å", density: "g/cm³", temperature: "K", dt: 0.001 },
  si: { time: "s", energy: "J", pressure: "Pa", length: "m", density: "kg/m³", temperature: "K", dt: 1e-8 },
  cgs: { time: "s", energy: "erg", pressure: "dyne/cm²", length: "cm", density: "g/cm³", temperature: "K", dt: 1e-8 },
  electron: { time: "fs", energy: "Hartree", pressure: "Pa", length: "Bohr", density: "", temperature: "K", dt: 0.001 },
  lj: { time: "τ", energy: "", pressure: "", length: "", density: "", temperature: "", dt: 0.005 },
};

const cube = (length: string) => (length ? `${length}³` : "");

function quantityFor(key: string, u: UnitSystem): [string, string] {
  const energy: Record<string, string> = {
    PotEng: "Potential energy",
    KinEng: "Kinetic energy",
    TotEng: "Total energy",
    Enthalpy: "Enthalpy",
    Econserve: "Conserved energy",
    Ecouple: "Coupling energy",
    E_pair: "Pair energy",
    E_mol: "Molecular energy",
    E_bond: "Bond",
    E_angle: "Angle",
    E_dihed: "Dihedral",
    E_impro: "Improper",
    E_vdwl: "van der Waals",
    E_coul: "Coulomb",
    E_long: "Long-range Coulomb",
    E_tail: "Tail correction",
  };
  if (key in energy) return [energy[key], u.energy];
  if (key === "Temp") return ["Temperature", u.temperature];
  if (key === "Press") return ["Pressure", u.pressure];
  if (/^P[xyz]{2}$/.test(key)) return [`Pressure ${key.slice(1)}`, u.pressure];
  if (key === "Volume") return ["Volume", cube(u.length)];
  if (key === "Density") return ["Density", u.density];
  if (/^L[xyz]$/.test(key)) return [`Box ${key[1].toUpperCase()}`, u.length];
  if (/^[xyz](lo|hi)$/.test(key)) return [key, u.length];
  if (key === "CPU") return ["CPU time", "s"];
  return [key, ""];
}

const NOT_QUANTITIES = new Set(["Step", "Time", "Elapsed", "Elaplong"]);
const KEYWORD = /^[A-Za-z_][\w[\]/:.-]*$/;

function readRow(line: string, width: number): number[] | null {
  const cells = line.trim().split(/\s+/);
  if (cells.length !== width) return null;
  const values = cells.map((c) => (/^[-+]?(nan|inf)$/i.test(c) ? NaN : Number(c)));
  return values.some((v, i) => Number.isNaN(v) && !/nan|inf/i.test(cells[i])) ? null : values;
}

/** log.lammps with one-line thermo output (thermo_style one/custom); several runs are merged. */
export function parseLammpsLog(text: string): Dataset {
  const lines = text.split(/\r?\n/);
  let style = "lj";
  let dt: number | null = null;
  const blocks: { header: string[]; rows: number[][] }[] = [];
  const notes: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^units\s+(\w+)/))) {
      style = m[1];
      continue;
    }
    if ((m = line.match(/^timestep\s+([\d.eE+-]+)/))) {
      dt = Number(m[1]);
      continue;
    }

    const header = line.split(/\s+/);
    if (header.length < 2 || !header.every((h) => KEYWORD.test(h)) || !(header.includes("Step") || header.includes("Time"))) {
      continue;
    }
    const rows: number[][] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const next = lines[j];
      if (/^\s*WARNING/.test(next)) continue;
      const row = readRow(next, header.length);
      if (!row) break;
      rows.push(row);
    }
    if (!rows.length) continue;
    blocks.push({ header, rows });
    i = j - 1;
  }

  const u = SYSTEMS[style] ?? SYSTEMS.lj;
  if (!SYSTEMS[style]) notes.push(`Units style "${style}" is not supported; values are shown without units.`);

  // Merge runs. LAMMPS repeats the last step of a run as the first step of the next.
  const keys: string[] = [];
  const records: Map<string, number>[] = [];
  let lastStep: number | undefined;
  for (const { header, rows } of blocks) {
    for (const h of header) if (!keys.includes(h)) keys.push(h);
    const stepIndex = header.indexOf("Step");
    rows.forEach((row, r) => {
      if (r === 0 && stepIndex >= 0 && row[stepIndex] === lastStep) return;
      records.push(new Map(header.map((h, k) => [h, row[k]])));
    });
    if (stepIndex >= 0) lastStep = rows[rows.length - 1][stepIndex];
  }

  let x: number[];
  let xName = "Time";
  if (keys.includes("Time")) {
    x = records.map((r) => r.get("Time") ?? NaN);
  } else if (keys.includes("Step")) {
    if (dt === null) notes.push(`timestep not found; assumed the ${style} default of ${u.dt} ${u.time}.`);
    const step = dt ?? u.dt;
    x = records.map((r) => (r.get("Step") ?? NaN) * step);
  } else {
    x = records.map((_, i) => i);
    xName = "Frame";
  }
  if (joinSegments(x) > 1) notes.push("The step counter was reset between runs; runs are joined end to end.");

  const columns: Column[] = keys
    .filter((k) => !NOT_QUANTITIES.has(k))
    .map((k) => {
      const [name, unit] = quantityFor(k, u);
      return { name, unit, values: records.map((r) => r.get(k) ?? NaN) };
    });

  return {
    engine: "LAMMPS",
    title: `LAMMPS thermo (${style} units)`,
    xName,
    xUnit: xName === "Time" ? u.time : "",
    quantities: columnsToQuantities(x, columns),
    notes,
  };
}
