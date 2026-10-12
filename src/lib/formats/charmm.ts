import { columnsToQuantities, joinSegments, numbersIn, type Column, type Dataset } from "../dataset";

const KCAL = "kcal/mol";

// Upper-cased CHARMM energy term → [name, unit]. Unlisted terms are energies in kcal/mol.
const NAMES: Record<string, [string, string]> = {
  TOTENER: ["Total energy", KCAL],
  TOTKE: ["Kinetic energy", KCAL],
  ENERGY: ["Potential energy", KCAL],
  TEMPERATURE: ["Temperature", "K"],
  GRMS: ["RMS gradient", "kcal/mol/Å"],
  HFCTOTE: ["Total energy (HFC)", KCAL],
  HFCKE: ["Kinetic energy (HFC)", KCAL],
  EHFCOR: ["HFC correction", KCAL],
  VIRKE: ["Virial kinetic energy", KCAL],
  BONDS: ["Bond", KCAL],
  ANGLES: ["Angle", KCAL],
  "UREY-B": ["Urey–Bradley", KCAL],
  DIHEDRALS: ["Dihedral", KCAL],
  IMPROPERS: ["Improper", KCAL],
  CMAPS: ["CMAP", KCAL],
  VDWAALS: ["van der Waals", KCAL],
  ELEC: ["Electrostatic", KCAL],
  HBONDS: ["H-bond", KCAL],
  IMNBVDW: ["Image van der Waals", KCAL],
  IMELEC: ["Image electrostatic", KCAL],
  IMHBND: ["Image H-bond", KCAL],
  EWKSUM: ["Ewald k-space", KCAL],
  EWSELF: ["Ewald self", KCAL],
  EWEXCL: ["Ewald exclusion", KCAL],
  VIRE: ["External virial", KCAL],
  VIRI: ["Internal virial", KCAL],
  PRESSE: ["External pressure", "atm"],
  PRESSI: ["Pressure", "atm"],
  VOLUME: ["Volume", "Å³"],
};

/**
 * CHARMM output: `DYNA <GROUP>:` header lines name the fields of the matching
 * `DYNA <GROUP>>` lines; a plain `DYNA>` line starts a new frame. AVER/FLUC lines are ignored.
 */
export function parseCharmmOut(text: string): Dataset {
  const headers = new Map<string, string[]>();
  const frames: Map<string, number>[] = [];
  const order: string[] = [];
  const seen = new Set<string>();
  let current: Map<string, number> | null = null;
  let unnamed = 0;

  for (const line of text.split(/\r?\n/)) {
    let m = line.match(/^DYNA ([A-Z]+):\s+(.*)$/);
    if (m) {
      headers.set(m[1] === "DYN" ? "" : m[1], m[2].trim().split(/\s+/));
      continue;
    }
    m = line.match(/^DYNA(?: ([A-Z]+))?>(.*)$/);
    if (!m) continue;
    const group = m[1] ?? "";
    const names = headers.get(group);
    if (!names) {
      unnamed++;
      continue;
    }
    if (group === "") {
      current = new Map();
      frames.push(current);
    }
    if (!current) continue;
    const values = numbersIn(m[2]);
    names.forEach((name, i) => {
      if (i >= values.length) return;
      const key = group ? `${group}:${name}` : name;
      current!.set(key, values[i]);
      if (!seen.has(key)) {
        seen.add(key);
        order.push(key);
      }
    });
  }

  const notes: string[] = [];
  const x = frames.map((f) => f.get("Time") ?? NaN);
  const runs = joinSegments(x);
  if (runs > 1) notes.push(`${runs} dynamics runs found; they are joined end to end.`);
  if (unnamed) notes.push(`${unnamed} DYNA line${unnamed === 1 ? "" : "s"} without a matching "DYNA …:" header ${unnamed === 1 ? "was" : "were"} skipped.`);

  const columns: Column[] = order
    .filter((key) => key !== "Step" && key !== "Time")
    .map((key) => {
      const raw = key.includes(":") ? key.split(":")[1] : key;
      const [name, unit] = NAMES[raw.toUpperCase()] ?? [raw, KCAL];
      return { name, unit, values: frames.map((f) => f.get(key) ?? NaN) };
    });

  return {
    engine: "CHARMM",
    title: "CHARMM dynamics",
    xName: "Time",
    xUnit: "ps",
    quantities: columnsToQuantities(x, columns),
    notes,
  };
}
