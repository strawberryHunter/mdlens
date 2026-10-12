import { describe, expect, it } from "vitest";
import { crc32, distributionCsv, setPngDpi, setPngText, toCsv } from "./export";

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

describe("setPngText", () => {
  const png = () => new Uint8Array([...SIGNATURE, ...IHDR, ...IEND]);
  const textChunks = (out: Uint8Array) => {
    const found: string[] = [];
    const view = new DataView(out.buffer);
    for (let o = 8; o < out.length; o += 12 + view.getUint32(o)) {
      if (String.fromCharCode(...out.subarray(o + 4, o + 8)) === "tEXt") {
        found.push(String.fromCharCode(...out.subarray(o + 8, o + 8 + view.getUint32(o))));
      }
    }
    return found;
  };

  it("adds a keyword/text entry after IHDR with a valid CRC", () => {
    const out = setPngText(png(), "Software", "MDLens v0.3.0");
    expect(chunkTypes(out)).toEqual(["IHDR", "tEXt", "IEND"]);
    expect(textChunks(out)).toEqual(["Software\0MDLens v0.3.0"]);
    const view = new DataView(out.buffer);
    const len = view.getUint32(8 + IHDR.length);
    const body = out.subarray(8 + IHDR.length + 4, 8 + IHDR.length + 8 + len);
    expect(view.getUint32(8 + IHDR.length + 8 + len)).toBe(crc32(body));
  });

  it("replaces an entry with the same keyword and keeps other chunks", () => {
    const out = setPngText(setPngDpi(setPngText(png(), "Software", "old"), 300), "Software", "new");
    expect(textChunks(out)).toEqual(["Software\0new"]);
    expect(chunkTypes(out)).toContain("pHYs");
  });
});

describe("distributionCsv", () => {
  it("writes one row per histogram bin and per density point", () => {
    const csv = distributionCsv([
      {
        quantity: "Temperature (K)",
        series: [{ name: "run, 1", histogram: { edges: [299, 300, 301], counts: [3, 1], density: [0.75, 0.25] }, kde: { x: [298, 302], density: [0.1, 0.2], bandwidth: 1 } }],
      },
    ]).split("\n");
    expect(csv).toEqual([
      "quantity,series,kind,x,density,bin_left,bin_right,count",
      'Temperature (K),"run, 1",histogram,299.5,0.75,299,300,3',
      'Temperature (K),"run, 1",histogram,300.5,0.25,300,301,1',
      'Temperature (K),"run, 1",kde,298,0.1,,,',
      'Temperature (K),"run, 1",kde,302,0.2,,,',
    ]);
  });
});
