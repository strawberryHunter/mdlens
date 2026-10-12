import type { Dataset } from "./dataset";
import { parseFile } from "./formats/detect";
import { analyzeDataset, type Analysis } from "./workspace";

export interface FileInput {
  name: string;
  text: string;
}

export type FileResult =
  | { ok: true; name: string; dataset: Dataset; analysis: Analysis }
  | { ok: false; name: string; error: string };

// Per-atom output (e.g. gmx traj -of) can have millions of columns; that is not a plot.
export const MAX_QUANTITIES = 200;

/**
 * Parses and analyses files. Never throws: a file that fails, has no data, or is per-atom
 * output becomes an error result (and is not sent back from a worker in full).
 */
export function readFiles(files: FileInput[]): FileResult[] {
  return files.map(({ name, text }): FileResult => {
    try {
      const dataset = parseFile(name, text);
      const n = dataset.quantities.length;
      if (!n) return { ok: false, name, error: "no data recognised" };
      if (n > MAX_QUANTITIES) return { ok: false, name, error: `${n.toLocaleString()} columns (per-atom output)` };
      return { ok: true, name, dataset, analysis: analyzeDataset(dataset) };
    } catch (err) {
      return { ok: false, name, error: `could not be read (${err instanceof Error ? err.message : String(err)})` };
    }
  });
}
