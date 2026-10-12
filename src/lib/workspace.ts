import { findInstability, type Dataset } from "./dataset";
import { summarize, type Summary } from "./stats";
import {
  conversionFactor,
  dimensionOf,
  displayUnit,
  formatLabel,
  normalizeUnit,
  type Dimension,
  type UnitPrefs,
} from "./units";

// Okabe–Ito: distinguishable with the common forms of colour blindness.
export const PALETTE = ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9", "#000000", "#999999"];
const DASHES = ["", "5 3", "1.5 2", "7 2 1.5 2"];

export interface LoadedFile {
  id: string;
  name: string;
  /** Legend text; editable. */
  label: string;
  color: string;
  visible: boolean;
  dataset: Dataset;
  /** Parser notes plus what loading found (e.g. where the run became unstable). */
  notes: string[];
  /** x value (recorded units) where the run became unstable; frames from here on are left out of statistics. */
  unstableFrom: number | null;
  /** Production statistics per quantity, in recorded units. */
  summaries: Summary[];
}

export type Category = "thermo" | "energy" | "structure" | "other";

/** One observable across all loaded files ("Temperature" from a NAMD log and an OpenMM CSV). */
export interface CatalogEntry {
  key: string;
  name: string;
  unit: string;
  dim: Dimension | null;
  category: Category;
  refs: { fileId: string; index: number }[];
  constant: boolean;
}

const PRIORITY = [
  "Temperature",
  "Pressure",
  "Density",
  "Volume",
  "Potential energy",
  "Total energy",
  "Kinetic energy",
  "Conserved energy",
  "RMSD",
  "RMSF",
];

export const isTimeAxis = (d: Dataset) => dimensionOf(d.xUnit) === "time";

export function loadFile(id: string, name: string, dataset: Dataset, color: string): LoadedFile {
  const whole = { from: -Infinity, to: Infinity };
  const time = isTimeAxis(dataset);
  const instability = time ? findInstability(dataset) : null;
  const notes = [...dataset.notes];
  if (instability) {
    notes.push(
      `${instability.quantity} becomes NaN at ${instability.from} ${dataset.xUnit} and stays that way (${instability.frames} of ${instability.total} frames): the run likely became unstable. Statistics use only the frames before it.`,
    );
  }
  const until = instability?.from ?? Infinity;
  return {
    id,
    name,
    label: name.replace(/\.(xvg|log|out|mdout|csv|dat|txt|colvar)$/i, ""),
    color,
    visible: true,
    dataset,
    notes,
    unstableFrom: instability?.from ?? null,
    // Equilibration only means something along time.
    summaries: dataset.quantities.map((q) => summarize(q.x, q.y, time ? undefined : whole, until)),
  };
}

export const quantityKey = (name: string, unit: string) =>
  `${name.toLowerCase()}|${dimensionOf(unit) ?? normalizeUnit(unit)}`;

function categoryOf(name: string, dim: Dimension | null): Category {
  if (dim === "temperature" || dim === "pressure" || dim === "volume" || dim === "density" || /^box /i.test(name)) {
    return "thermo";
  }
  if (dim === "energy") return "energy";
  if (dim === "length" || dim === "area" || /rmsd|rmsf|radius|^rg|sasa|area|distance|hbond/i.test(name)) return "structure";
  return "other";
}

function isConstant(y: number[]): boolean {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of y) {
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return !(hi > lo);
}

export function buildCatalog(files: LoadedFile[]): CatalogEntry[] {
  const entries = new Map<string, CatalogEntry>();
  for (const f of files) {
    f.dataset.quantities.forEach((q, index) => {
      const key = quantityKey(q.name, q.unit);
      let e = entries.get(key);
      if (!e) {
        const dim = dimensionOf(q.unit);
        e = { key, name: q.name, unit: q.unit, dim, category: categoryOf(q.name, dim), refs: [], constant: true };
        entries.set(key, e);
      }
      e.refs.push({ fileId: f.id, index });
      if (!isConstant(q.y)) e.constant = false;
    });
  }
  const rank = (e: CatalogEntry) => {
    const i = PRIORITY.indexOf(e.name);
    return i < 0 ? PRIORITY.length : i;
  };
  return [...entries.values()]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i)
    .map(({ e }) => e);
}

export function timeAxis(dataset: Dataset, prefs: UnitPrefs): { factor: number; unit: string } {
  if (!isTimeAxis(dataset)) return { factor: 1, unit: dataset.xUnit };
  const unit = displayUnit(dataset.xUnit, prefs);
  return { factor: conversionFactor(dataset.xUnit, unit) ?? 1, unit };
}

/** Rescales a summary computed in recorded units. Both factors are positive. */
export function scaleSummary(s: Summary, fy: number, fx: number): Summary {
  return {
    ...s,
    mean: s.mean * fy,
    sd: s.sd * fy,
    se: s.se * fy,
    min: s.min * fy,
    max: s.max * fy,
    from: s.from * fx,
    slope: (s.slope * fy) / fx,
  };
}

export interface PlotSeries {
  id: string;
  fileId: string;
  quantity: string;
  name: string;
  color: string;
  dash?: string;
  x: number[];
  y: number[];
  dy?: number[];
  /** Production statistics in display units (auto-detected region). */
  summary: Summary;
  /** Where the run became unstable, in display units. */
  unstableFrom?: number;
}

export interface Panel {
  id: string;
  yLabel: string;
  unit: string;
  series: PlotSeries[];
}

/** A file left out of a figure because its x axis is not the figure's (e.g. steps among times). */
export interface ExcludedFile {
  fileId: string;
  label: string;
  axis: string;
}

const axisKind = (d: Dataset) => (isTimeAxis(d) ? "time" : `${d.xName}|${d.xUnit}`);

/**
 * Turns the selected catalog entries into figure panels: one per quantity, or one per unit
 * when `merge` is on. Values are converted to the preferred units. Panels share one x axis,
 * so files whose x axis is of another kind are left out and listed in `excluded`; time wins
 * when there is a choice.
 */
export function buildPanels(
  selected: string[],
  catalog: CatalogEntry[],
  files: LoadedFile[],
  prefs: UnitPrefs,
  merge: boolean,
): { panels: Panel[]; xLabel: string; xIsTime: boolean; excluded: ExcludedFile[] } {
  const fileById = new Map(files.map((f) => [f.id, f]));
  const entries = selected.map((k) => catalog.find((e) => e.key === k)).filter((e): e is CatalogEntry => !!e);

  const contributing = [
    ...new Set(entries.flatMap((e) => e.refs.map((r) => r.fileId)).filter((id) => fileById.get(id)?.visible)),
  ].map((id) => fileById.get(id)!);
  const kinds = contributing.map((f) => axisKind(f.dataset));
  const figureAxis = kinds.includes("time") ? "time" : kinds[0];
  const excluded: ExcludedFile[] = contributing
    .filter((f) => axisKind(f.dataset) !== figureAxis)
    .map((f) => ({ fileId: f.id, label: f.label, axis: formatLabel(f.dataset.xName, f.dataset.xUnit) }));
  const onAxis = (f: LoadedFile) => f.visible && axisKind(f.dataset) === figureAxis;

  const groups: CatalogEntry[][] = [];
  for (const e of entries) {
    const unit = displayUnit(e.unit, prefs);
    const group = merge ? groups.find((g) => displayUnit(g[0].unit, prefs) === unit && unit !== "") : undefined;
    if (group) group.push(e);
    else groups.push([e]);
  }

  let xLabel = "";
  const panels = groups.map((group) => {
    const unit = displayUnit(group[0].unit, prefs);
    const groupFiles = new Set(group.flatMap((e) => e.refs.filter((r) => onAxis(fileById.get(r.fileId)!)).map((r) => r.fileId)));
    const manyFiles = groupFiles.size > 1;

    const series: PlotSeries[] = group.flatMap((e, qi) =>
      e.refs.flatMap(({ fileId, index }) => {
        const f = fileById.get(fileId);
        if (!f || !onAxis(f)) return [];
        const q = f.dataset.quantities[index];
        const fy = conversionFactor(q.unit, unit) ?? 1;
        const tx = timeAxis(f.dataset, prefs);
        xLabel ||= formatLabel(f.dataset.xName, tx.unit);
        const several = group.length > 1;
        return [
          {
            id: `${fileId}:${index}`,
            fileId,
            quantity: e.key,
            name: several ? (manyFiles ? `${f.label} · ${q.name}` : q.name) : f.label,
            color: several && !manyFiles ? PALETTE[qi % PALETTE.length] : f.color,
            dash: several && manyFiles ? DASHES[qi % DASHES.length] || undefined : undefined,
            x: tx.factor === 1 ? q.x : q.x.map((v) => v * tx.factor),
            y: fy === 1 ? q.y : q.y.map((v) => v * fy),
            dy: q.dy && fy !== 1 ? q.dy.map((v) => v * fy) : q.dy,
            summary: scaleSummary(f.summaries[index], fy, tx.factor),
            unstableFrom: f.unstableFrom === null ? undefined : f.unstableFrom * tx.factor,
          },
        ];
      }),
    );

    const names = group.map((e) => e.name);
    const yLabel = formatLabel(names.length === 1 || names.length <= 3 ? names.join(", ") : "", unit);
    return { id: group.map((e) => e.key).join("+"), yLabel, unit, series };
  });

  // A quantity that only exists in excluded files would be an empty panel.
  return { panels: panels.filter((p) => p.series.length), xLabel, xIsTime: figureAxis === "time", excluded };
}
