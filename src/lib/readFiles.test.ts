import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_QUANTITIES, readFiles } from "./readFiles";
import { readFilesAsync } from "./readFilesClient";
import { analyzeDataset, loadFile } from "./workspace";

const sample = (name: string) => ({ name, text: readFileSync(new URL(`../../public/samples/${name}`, import.meta.url), "utf8") });

describe("readFiles", () => {
  it("parses and analyses each file", () => {
    const [r] = readFiles([sample("namd_equil.log")]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dataset.engine).toBe("NAMD");
    expect(r.analysis.summaries).toHaveLength(r.dataset.quantities.length);
  });

  it("turns files without data and per-atom output into error results", () => {
    const wide = Array.from({ length: MAX_QUANTITIES + 2 }, (_, i) => i).join(" ");
    const results = readFiles([
      { name: "notes.txt", text: "just words\nno numbers here\n" },
      { name: "forces.xvg", text: `${wide}\n${wide}\n` },
    ]);
    expect(results).toEqual([
      { ok: false, name: "notes.txt", error: "no data recognised" },
      { ok: false, name: "forces.xvg", error: `${MAX_QUANTITIES + 1} columns (per-atom output)` },
    ]);
  });
});

describe("readFilesAsync", () => {
  it("falls back to the main thread where Web Workers do not exist", async () => {
    expect(typeof Worker).toBe("undefined");
    const [r] = await readFilesAsync([sample("charmm_dyn.out")]);
    expect(r.ok && r.dataset.engine).toBe("CHARMM");
  });
});

describe("analyzeDataset", () => {
  it("is what loadFile uses when no analysis is passed in", () => {
    const [r] = readFiles([sample("prod.mdout")]);
    if (!r.ok) throw new Error("sample failed");
    const viaLoad = loadFile("a", "prod.mdout", r.dataset, "#000");
    expect(viaLoad.summaries).toEqual(analyzeDataset(r.dataset).summaries);
    expect(loadFile("a", "prod.mdout", r.dataset, "#000", r.analysis).summaries).toEqual(viaLoad.summaries);
  });
});
