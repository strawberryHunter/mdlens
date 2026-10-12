// Real-world damage: crashed and truncated runs, overflowed fields, cut-off logs.
// Every file must still load, and the parser must say what it skipped.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadFile } from "../workspace";
import { parseFile } from "./detect";

const read = (name: string) => readFileSync(new URL(`../../../validation/messy/${name}`, import.meta.url), "utf8");

describe("messy example files", () => {
  it.each([
    ["lammps_crashed.log", "LAMMPS", 4, [/Run 1 stopped before finishing: "ERROR: Lost atoms/, /2 WARNING lines/]],
    ["lammps_truncated.log", "LAMMPS", 4, [/log ends inside run 1/]],
    ["amber_overflow.mdout", "AMBER", 3, [/2 values printed as \*\*\*\*\*/]],
    ["namd_tail.log", "NAMD", 4, [/2 ENERGY lines before the first ETITLE/, /1 ENERGY line has a different number of columns/, /TIMESTEP not found/]],
    ["openmm_restarted.csv", "OpenMM", 5, [/2 lines did not fit the 4-column table/]],
    ["charmm_cut.out", "CHARMM", 2, [/2 DYNA lines without a matching/]],
    ["gromacs_crashed.xvg", "GROMACS", 5, [/1 unreadable line was skipped/]],
  ] as const)("%s", (name, engine, frames, notes) => {
    const d = parseFile(name, read(name));
    expect(d.engine).toBe(engine);
    expect(d.quantities.length).toBeGreaterThan(0);
    expect(d.quantities[0].x).toHaveLength(frames);
    for (const pattern of notes) expect(d.notes.join("\n")).toMatch(pattern);
  });

  it("reads AMBER TI output once per step, keeps dV/dλ, and flags the blow-up", () => {
    const d = parseFile("amber_ti_blowup.mdout", read("amber_ti_blowup.mdout"));
    const dvdl = d.quantities.find((q) => q.name === "dV/dλ")!;
    expect(dvdl.x).toEqual([9, 11, 13, 15]);
    expect(dvdl.y).toEqual([3.7314, 4.0021, -4.5482, -4.6001]);
    expect(d.quantities.map((q) => q.name)).not.toContain("DL");
    const notes = d.notes.join("\n");
    expect(notes).toMatch(/region 1 is shown; 4 frames from other TI regions were skipped/);
    expect(notes).toMatch(/4 values printed as \*\*\*\*\*/);
    expect(notes).toMatch(/6 values are NaN/);
  });

  it("keeps the overflowed AMBER values as gaps rather than numbers", () => {
    const d = parseFile("amber_overflow.mdout", read("amber_overflow.mdout"));
    expect(d.quantities.find((q) => q.name === "Pressure")!.y).toEqual([-120.4, NaN, 35]);
    expect(d.quantities.find((q) => q.name === "Volume")!.y).toEqual([250683.8125, NaN, 250601.5]);
  });
});

describe("messy example files, once loaded", () => {
  it("cuts the AMBER TI statistics where the run became unstable and says so", () => {
    const f = loadFile("t", "amber_ti_blowup.mdout", parseFile("amber_ti_blowup.mdout", read("amber_ti_blowup.mdout")), "#000");
    expect(f.unstableFrom).toBe(13);
    expect(f.notes.join("\n")).toMatch(/Temperature becomes NaN at 13 ps and stays that way \(2 of 4 frames\)/);
    const i = f.dataset.quantities.findIndex((q) => q.name === "dV/dλ");
    expect(f.summaries[i].n).toBe(2);
    expect(f.summaries[i].mean).toBeCloseTo((3.7314 + 4.0021) / 2);
  });

  it("does not call a truncated last line an instability", () => {
    const f = loadFile("n", "namd_tail.log", parseFile("namd_tail.log", read("namd_tail.log")), "#000");
    expect(f.unstableFrom).toBeNull();
  });
});
