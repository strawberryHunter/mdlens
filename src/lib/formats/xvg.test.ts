import { describe, expect, it } from "vitest";
import { parseXvg } from "./xvg";

const GYRATE = `# This file was created Mon Jan  1 00:00:00 2024
# Created by:
#   :-) GROMACS - gmx gyrate, 2023.3 (-:
@    title "Radius of gyration (total and around axes)"
@    xaxis  label "Time (ps)"
@    yaxis  label "Radius (nm)"
@TYPE xy
@ view 0.15, 0.15, 0.75, 0.85
@ legend on
@ s0 legend "Rg"
@ s1 legend "Rg\\sX\\N"
@ s2 legend "Rg\\sY\\N"
@ s3 legend "Rg\\sZ\\N"
      0.000 6.713502 5.621195 5.361460 5.458886
   3000.000 6.656046 5.613112 5.197114 5.485305
`;

describe("parseXvg", () => {
  it("reads labels, legends and one series per column", () => {
    const d = parseXvg(GYRATE);
    expect(d.title).toBe("Radius of gyration (total and around axes)");
    expect(d.xLabel).toBe("Time (ps)");
    expect(d.yLabel).toBe("Radius (nm)");
    expect(d.series.map((s) => s.name)).toEqual(["Rg", "RgX", "RgY", "RgZ"]);
    expect(d.series[0].x).toEqual([0, 3000]);
    expect(d.series[3].y).toEqual([5.458886, 5.485305]);
    expect(d.skippedLines).toBe(0);
  });

  it("converts Grace escapes in labels", () => {
    const d = parseXvg('@    yaxis  label "Area (nm\\S2\\N)"\n0 1\n');
    expect(d.yLabel).toBe("Area (nm²)");
  });

  it("splits & separated blocks into separate series with running legend numbers", () => {
    const d = parseXvg(`@ s0 legend "chain A"\n@ s1 legend "chain B"\n1 0.1\n2 0.2\n&\n1 0.3\n2 0.4\n3 0.5\n&\n`);
    expect(d.series).toHaveLength(2);
    expect(d.series[1]).toMatchObject({ name: "chain B", x: [1, 2, 3], y: [0.3, 0.4, 0.5] });
  });

  it("reads the error column of xydy files", () => {
    const d = parseXvg("@TYPE xydy\n0 1.0 0.1\n1 2.0 0.2\n");
    expect(d.series).toHaveLength(1);
    expect(d.series[0].dy).toEqual([0.1, 0.2]);
  });

  it("accepts the old `legend string` syntax and tabs", () => {
    const d = parseXvg('@ legend string 0 "COM"\n0.0\t0.36\n0.2\t0.37\n');
    expect(d.series[0].name).toBe("COM");
    expect(d.series[0].y).toEqual([0.36, 0.37]);
  });

  it("keeps nan/inf as gaps instead of dropping the line", () => {
    const d = parseXvg("0 1\n1 nan\n2 -inf\n3 4\n");
    expect(d.series[0].y).toEqual([1, NaN, -Infinity, 4]);
    expect(d.skippedLines).toBe(0);
  });

  it("pads ragged rows with NaN", () => {
    const d = parseXvg("0 1 2\n1 3\n");
    expect(d.series[1].y).toEqual([2, NaN]);
  });

  it("reads CSV with a header row", () => {
    const d = parseXvg("time,rmsd_a,rmsd_b\n0,0.1,0.2\n10,0.15,0.25\n");
    expect(d.xLabel).toBe("time");
    expect(d.series.map((s) => s.name)).toEqual(["rmsd_a", "rmsd_b"]);
    expect(d.series[1].y).toEqual([0.2, 0.25]);
  });

  it("uses the row index as x for single-column files", () => {
    expect(parseXvg("5\n6\n7\n").series[0]).toMatchObject({ x: [0, 1, 2], y: [5, 6, 7] });
  });

  it("counts garbage lines after data starts", () => {
    const d = parseXvg("0 1\nSegmentation fault\n1 2\n");
    expect(d.series[0].y).toEqual([1, 2]);
    expect(d.skippedLines).toBe(1);
  });

  it("returns no series for an empty file", () => {
    expect(parseXvg("").series).toEqual([]);
    expect(parseXvg("# only comments\n@ title \"x\"\n").series).toEqual([]);
  });
});
