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

export async function svgToPng(svg: SVGSVGElement, widthIn: number, heightIn: number, dpi: number): Promise<Blob> {
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
  const bytes = setPngDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
  return new Blob([bytes], { type: "image/png" });
}

/** Copies a 300 dpi PNG to the clipboard (paste straight into PowerPoint or Keynote). */
export async function copyPng(svg: SVGSVGElement, widthIn: number, heightIn: number, dpi = 300): Promise<void> {
  // Safari only allows clipboard writes started synchronously in the click handler, so pass a promise.
  await navigator.clipboard.write([new ClipboardItem({ "image/png": svgToPng(svg, widthIn, heightIn, dpi) })]);
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

/**
 * Writes a pHYs chunk so the PNG carries its resolution. Without it, Office and Keynote
 * assume 72/96 dpi and a 300 dpi figure is pasted three to four times too large.
 */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const phys = new Uint8Array(21);
  const pv = new DataView(phys.buffer);
  pv.setUint32(0, 9);
  phys.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  pv.setUint32(8, ppm);
  pv.setUint32(12, ppm);
  phys[16] = 1; // unit: metre
  pv.setUint32(17, crc32(phys.subarray(4, 17)));

  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const parts: Uint8Array[] = [png.subarray(0, 8)];
  let offset = 8;
  while (offset + 8 <= png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (type !== "pHYs") parts.push(png.subarray(offset, end));
    if (type === "IHDR") parts.push(phys);
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
