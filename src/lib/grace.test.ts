import { describe, expect, it } from "vitest";
import { graceToUnicode } from "./grace";

describe("graceToUnicode", () => {
  it("leaves plain text alone", () => {
    expect(graceToUnicode("Time (ps)")).toBe("Time (ps)");
  });

  it("converts superscripts", () => {
    expect(graceToUnicode("Area (nm\\S2\\N)")).toBe("Area (nm²)");
    expect(graceToUnicode("kJ mol\\S-1\\N")).toBe("kJ mol⁻¹");
  });

  it("converts subscripts when Unicode has them", () => {
    expect(graceToUnicode("T\\s0\\N")).toBe("T₀");
    expect(graceToUnicode("E\\spot\\N")).toBe("Eₚₒₜ");
  });

  it("keeps a run plain rather than half-converting it", () => {
    expect(graceToUnicode("R\\sg\\N (nm)")).toBe("Rg (nm)");
    expect(graceToUnicode("Rg\\sX\\N")).toBe("RgX");
  });

  it("maps Symbol font letters to Greek", () => {
    expect(graceToUnicode("\\xD\\f{}G (kJ mol\\S-1\\N)")).toBe("ΔG (kJ mol⁻¹)");
    expect(graceToUnicode("\\xq\\f{} (degrees)")).toBe("θ (degrees)");
    expect(graceToUnicode("\\f{Symbol}a\\f{}-helix")).toBe("α-helix");
  });

  it("handles escaped backslashes and unknown escapes", () => {
    expect(graceToUnicode("a\\\\b")).toBe("a\\b");
    expect(graceToUnicode("\\+big\\-")).toBe("big");
  });
});
