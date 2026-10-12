import type { Histogram, Kde } from "./stats";

/**
 * Serializes the figure with its physical size in inches, so Illustrator, Inkscape and
 * PowerPoint place it at the intended size. Pass pixel dimensions to rasterize instead.
 */
export function svgToString(svg: SVGSVGElement, width: string, height: string): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

export async function svgToPng(svg: SVGSVGElement, widthIn: number, heightIn: number, dpi: number, software?: string): Promise<Blob> {
  const w = Math.round(widthIn * dpi);
  const h = Math.round(heightIn * dpi);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgToString(svg, String(w), String(h)))}`;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not encode PNG.");
  let bytes = setPngDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
  if (software) bytes = setPngText(bytes, "Software", software);
  return new Blob([bytes], { type: "image/png" });
}

/** Copies a 300 dpi PNG to the clipboard (paste straight into PowerPoint or Keynote). */
export async function copyPng(svg: SVGSVGElement, widthIn: number, heightIn: number, dpi = 300, software?: string): Promise<void> {
  // Safari only allows clipboard writes started synchronously in the click handler, so pass a promise.
  await navigator.clipboard.write([new ClipboardItem({ "image/png": svgToPng(svg, widthIn, heightIn, dpi, software) })]);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(series: { name: string; x: number[]; y: number[] }[], xLabel: string, yLabel: string): string {
  const quote = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [["series", xLabel || "x", yLabel || "y"].map(quote).join(",")];
  for (const s of series) {
    for (let i = 0; i < s.x.length; i++) lines.push(`${quote(s.name)},${s.x[i]},${s.y[i]}`);
  }
  return lines.join("\n");
}

/**
 * Long-format CSV of distributions: one row per histogram bin (with its edges and count) and
 * one row per kernel-density point.
 */
export function distributionCsv(
  groups: { quantity: string; series: { name: string; histogram: Histogram; kde: Kde | null }[] }[],
): string {
  const quote = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = ["quantity,series,kind,x,density,bin_left,bin_right,count"];
  for (const g of groups) {
    for (const s of g.series) {
      const head = `${quote(g.quantity)},${quote(s.name)}`;
      const h = s.histogram;
      h.density.forEach((d, i) => {
        const left = h.edges[i];
        const right = h.edges[i + 1];
        lines.push(`${head},histogram,${(left + right) / 2},${d},${left},${right},${h.counts[i]}`);
      });
      s.kde?.x.forEach((x, i) => lines.push(`${head},kde,${x},${s.kde!.density[i]},,,`));
    }
  }
  return lines.join("\n");
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Rebuilds a PNG, dropping chunks `drop` rejects and inserting `insert` right after IHDR. */
function rewritePng(png: Uint8Array, drop: (type: string, data: Uint8Array) => boolean, insert: Uint8Array): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const parts: Uint8Array[] = [png.subarray(0, 8)];
  let offset = 8;
  while (offset + 8 <= png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (!drop(type, png.subarray(offset + 8, offset + 8 + length))) parts.push(png.subarray(offset, end));
    if (type === "IHDR") parts.push(insert);
    offset = end;
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * Writes a pHYs chunk so the PNG carries its resolution. Without it, Office and Keynote
 * assume 72/96 dpi and a 300 dpi figure is pasted three to four times too large.
 */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const data = new Uint8Array(9);
  const view = new DataView(data.buffer);
  view.setUint32(0, ppm);
  view.setUint32(4, ppm);
  data[8] = 1; // unit: metre
  return rewritePng(png, (type) => type === "pHYs", chunk("pHYs", data));
}

/** Sets a tEXt entry (Latin-1 keyword and text), replacing an existing one with the same keyword. */
export function setPngText(png: Uint8Array, keyword: string, text: string): Uint8Array {
  const latin1 = (s: string) => Uint8Array.from(s, (c) => (c.charCodeAt(0) < 256 ? c.charCodeAt(0) : 63));
  const data = new Uint8Array([...latin1(keyword), 0, ...latin1(text)]);
  const sameKeyword = (type: string, d: Uint8Array) =>
    type === "tEXt" && String.fromCharCode(...d.subarray(0, d.indexOf(0))) === keyword;
  return rewritePng(png, sameKeyword, chunk("tEXt", data));
}
