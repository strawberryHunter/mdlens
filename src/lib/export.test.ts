import { describe, expect, it } from "vitest";
import { crc32, setPngDpi, toCsv } from "./export";

function chunk(type: string, data: number[]): number[] {
  const body = [...type].map((c) => c.charCodeAt(0)).concat(data);
  const len = data.length;
  const crc = crc32(new Uint8Array(body));
  return [len >>> 24, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...body, crc >>> 24, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255];
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const IHDR = chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
const IEND = chunk("IEND", []);

function chunkTypes(png: Uint8Array): string[] {
  const types: string[] = [];
  const view = new DataView(png.buffer);
  for (let o = 8; o < png.length; o += 12 + view.getUint32(o)) {
    types.push(String.fromCharCode(...png.subarray(o + 4, o + 8)));
  }
  return types;
}

describe("crc32", () => {
  it("matches the known CRC of IEND", () => {
    expect(crc32(new TextEncoder().encode("IEND"))).toBe(0xae426082);
  });
});

describe("setPngDpi", () => {
  it("inserts pHYs right after IHDR", () => {
    const out = setPngDpi(new Uint8Array([...SIGNATURE, ...IHDR, ...IEND]), 300);
    expect(chunkTypes(out)).toEqual(["IHDR", "pHYs", "IEND"]);
    const view = new DataView(out.buffer);
    const physData = 8 + IHDR.length + 8;
    expect(view.getUint32(physData)).toBe(11811); // 300 dpi in pixels per metre
    expect(out[physData + 8]).toBe(1);
  });

  it("replaces an existing pHYs", () => {
    const old = chunk("pHYs", [0, 0, 11, 19, 0, 0, 11, 19, 1]);
    const out = setPngDpi(new Uint8Array([...SIGNATURE, ...IHDR, ...old, ...IEND]), 600);
    expect(chunkTypes(out)).toEqual(["IHDR", "pHYs", "IEND"]);
    expect(new DataView(out.buffer).getUint32(8 + IHDR.length + 8)).toBe(23622);
  });
});

describe("toCsv", () => {
  it("writes long-format rows and quotes names when needed", () => {
    expect(toCsv([{ name: "rep, 1", x: [0, 1], y: [2, 3] }], "Time (ns)", "RMSD (nm)")).toBe(
      'series,Time (ns),RMSD (nm)\n"rep, 1",0,2\n"rep, 1",1,3',
    );
  });
});
