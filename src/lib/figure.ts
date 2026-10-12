import * as Plot from "@observablehq/plot";
import { scaleLinear } from "d3";

const SVG_NS = "http://www.w3.org/2000/svg";
export const PX_PER_IN = 96;
const PX_PER_PT = 96 / 72;
export const FONT_FAMILY = "Arial, Helvetica, sans-serif";
/** Panels never get shorter than this, so stacking many quantities stays legible. */
const MIN_PANEL_IN = 1.2;

export type LegendPosition = "auto" | "top-right" | "top-left" | "bottom-right" | "bottom-left" | "none";
type Corner = Exclude<LegendPosition, "auto" | "none">;
const CORNERS: Corner[] = ["top-right", "top-left", "bottom-right", "bottom-left"];

export interface FigureLine {
  name: string;
  color: string;
  x: number[];
  y: number[];
  opacity?: number;
  dash?: string;
  /** Set false to keep the line out of the legend. */
  legend?: boolean;
}

export interface FigureBand {
  color: string;
  x: number[];
  lo: number[];
  hi: number[];
}

/** A vertical marker, e.g. where equilibration ends. */
export interface FigureRule {
  x: number;
  color: string;
}

export interface FigurePanel {
  yLabel: string;
  lines: FigureLine[];
  bands: FigureBand[];
  rules: FigureRule[];
}

export interface FigureSpec {
  widthIn: number;
  heightIn: number;
  fontPt: number;
  lineWidthPt: number;
  xLabel: string;
  title: string;
  panels: FigurePanel[];
  /** x interval to shade in every panel. */
  highlight: [number, number] | null;
  yFromZero: boolean;
  frame: boolean;
  grid: boolean;
  legend: LegendPosition;
  /** Bold a, b, c… next to each panel when there are several. */
  panelLabels: boolean;
  /** Render outside a browser (jsdom in tests and scripts). Text is then measured approximately. */
  document?: Document;
}

/** The height the figure is actually drawn at: panels are kept at least MIN_PANEL_IN tall. */
export function figureHeightIn(spec: Pick<FigureSpec, "heightIn" | "panels">): number {
  const n = Math.max(1, spec.panels.length);
  return n === 1 ? spec.heightIn : Math.max(spec.heightIn, n * MIN_PANEL_IN + 0.5);
}

function extent(arrays: ArrayLike<number>[]): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const a of arrays) {
    for (let i = 0; i < a.length; i++) {
      const v = a[i];
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (lo > hi) return null;
  return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
}

/** Whether the segment a→b passes through the box (Liang–Barsky clipping). */
function segmentHitsBox(a: [number, number], b: [number, number], left: number, top: number, right: number, bottom: number): boolean {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const p = [-dx, dx, -dy, dy];
  const q = [a[0] - left, right - a[0], a[1] - top, bottom - a[1]];
  let t0 = 0;
  let t1 = 1;
  for (let k = 0; k < 4; k++) {
    if (p[k] === 0) {
      if (q[k] < 0) return false;
      continue;
    }
    const u = q[k] / p[k];
    if (p[k] < 0) {
      if (u > t1) return false;
      t0 = Math.max(t0, u);
    } else {
      if (u < t0) return false;
      t1 = Math.min(t1, u);
    }
  }
  return true;
}

function textMeasurer(px: number, useCanvas: boolean): (s: string) => number {
  const ctx = useCanvas ? document.createElement("canvas").getContext("2d") : null;
  if (ctx) ctx.font = `${px}px ${FONT_FAMILY}`;
  return (s) => (ctx ? ctx.measureText(s).width : s.length * px * 0.58);
}

/**
 * Renders a static, journal-style SVG figure: one or more panels stacked on a shared x axis.
 * Sizes are physical (inches, points) so the exported file drops into a manuscript or slide
 * at the intended size.
 */
export function buildFigure(spec: FigureSpec): SVGSVGElement {
  const doc = spec.document ?? document;
  const n = spec.panels.length;
  const width = Math.round(spec.widthIn * PX_PER_IN);
  const height = Math.round(figureHeightIn(spec) * PX_PER_IN);
  const fs = spec.fontPt * PX_PER_PT;
  const lw = spec.lineWidthPt * PX_PER_PT;
  const measure = textMeasurer(fs, !spec.document);

  const el = (tag: string, attrs: Record<string, string | number>, text?: string) => {
    const node = doc.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // Vertical layout: title, then panels separated by a gap, then the shared x axis.
  const titleH = spec.title ? fs * 2 : 0;
  const tops = spec.panels.map((_, i) => (i === 0 ? titleH + fs * 0.9 : fs * 0.6));
  const bottoms = spec.panels.map((_, i) => (i === n - 1 ? fs * 3.1 : fs * 0.6));
  const innerH = (height - tops.reduce((a, b) => a + b, 0) - bottoms.reduce((a, b) => a + b, 0)) / n;

  // Ticks are computed here, not by Plot, so margins fit them and panels line up.
  const yAxes = spec.panels.map((p) => {
    let ext = extent([...p.lines.map((l) => l.y), ...p.bands.flatMap((b) => [b.lo, b.hi])]) ?? [0, 1];
    if (spec.yFromZero) ext = [Math.min(0, ext[0]), Math.max(0, ext[1])];
    const count = Math.max(2, Math.round(innerH / (fs * 3.2)));
    const scale = scaleLinear().domain(ext).nice(count);
    const ticks = scale.ticks(count);
    const format = scale.tickFormat(count);
    return { domain: scale.domain(), ticks, format, widest: Math.max(...ticks.map((t) => measure(format(t)))) };
  });
  const marginLeft = Math.ceil(Math.max(...yAxes.map((a) => a.widest)) + fs * 2.6);

  const xDomain = extent(spec.panels.flatMap((p) => p.lines.map((l) => l.x))) ?? [0, 1];
  const xScale = scaleLinear().domain(xDomain);
  let marginRight = fs;
  let xCount = Math.max(2, Math.round((width - marginLeft - marginRight) / (fs * 5)));
  let xTicks = xScale.ticks(xCount);
  let xFormat = xScale.tickFormat(xCount);
  for (;;) {
    const widest = Math.max(...xTicks.map((t) => measure(xFormat(t))));
    marginRight = Math.max(fs * 0.8, widest / 2 + 2);
    if (xCount <= 2 || (widest + fs * 1.2) * xTicks.length <= width - marginLeft - marginRight) break;
    xCount--;
    xTicks = xScale.ticks(xCount);
    xFormat = xScale.tickFormat(xCount);
  }

  const root = el("svg", {
    xmlns: SVG_NS,
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    "font-family": FONT_FAMILY,
    "font-size": fs,
  }) as SVGSVGElement;
  root.append(el("rect", { width, height, fill: "#fff" }));

  if (spec.title) {
    const cx = marginLeft + (width - marginLeft - marginRight) / 2;
    root.append(el("text", { x: cx, y: fs * 1.3, "text-anchor": "middle", "font-weight": "bold", fill: "#000" }, spec.title));
  }

  // Legends: one per panel, but only the first when every panel lists the same lines.
  const legendKey = (p: FigurePanel) =>
    p.lines.filter((l) => l.legend !== false && l.name).map((l) => `${l.name}|${l.color}|${l.dash ?? ""}`).join(";");
  const sameLegends = spec.panels.every((p) => legendKey(p) === legendKey(spec.panels[0]));

  let offset = 0;
  spec.panels.forEach((panel, i) => {
    const last = i === n - 1;
    const panelH = tops[i] + innerH + bottoms[i];
    const axis = { labelAnchor: "center", labelArrow: "none", tickSize: fs * 0.4, grid: spec.grid } as const;
    const marks: Plot.Markish[] = [];

    if (spec.highlight) {
      const x1 = Math.max(spec.highlight[0], xDomain[0]);
      const x2 = Math.min(spec.highlight[1], xDomain[1]);
      if (x2 > x1) marks.push(Plot.rect([{ x1, x2 }], { x1: "x1", x2: "x2", fill: "#000", fillOpacity: 0.07 }));
    }
    for (const b of panel.bands) {
      marks.push(Plot.areaY(b.x, { x: b.x, y1: b.lo, y2: b.hi, fill: b.color, fillOpacity: 0.2 }));
    }
    for (const l of panel.lines) {
      marks.push(
        Plot.lineY(l.x, {
          x: l.x,
          y: l.y,
          stroke: l.color,
          strokeWidth: lw,
          strokeOpacity: l.opacity ?? 1,
          strokeDasharray: l.dash,
        }),
      );
    }
    for (const r of panel.rules) {
      if (r.x > xDomain[0] && r.x < xDomain[1]) {
        marks.push(Plot.ruleX([r.x], { stroke: r.color, strokeWidth: lw * 0.75, strokeDasharray: "3 2.5" }));
      }
    }
    const axisLine = { stroke: "#000", strokeWidth: lw * 0.75 };
    if (spec.frame) marks.push(Plot.frame(axisLine));
    else marks.push(Plot.frame({ ...axisLine, anchor: "bottom" }), Plot.frame({ ...axisLine, anchor: "left" }));

    const svg = Plot.plot({
      document: doc,
      width,
      height: panelH,
      marginTop: tops[i],
      marginRight,
      marginBottom: bottoms[i],
      marginLeft,
      style: { fontFamily: FONT_FAMILY, fontSize: `${fs}px`, color: "#000" },
      x: {
        ...axis,
        domain: xDomain,
        ticks: xTicks,
        tickFormat: last ? xFormat : () => "",
        label: last ? spec.xLabel : null,
      },
      y: { ...axis, domain: yAxes[i].domain, ticks: yAxes[i].ticks, tickFormat: yAxes[i].format, label: panel.yLabel },
      marks,
    }) as SVGSVGElement;

    // Move the panel's contents into a <g>: a nested <svg> would pick up Plot's
    // `height: auto` stylesheet and lay out differently across browsers.
    const g = el("g", { transform: `translate(0,${offset})` });
    for (const attr of ["class", "fill", "font-family", "font-size", "text-anchor", "style"]) {
      const v = svg.getAttribute(attr);
      if (v !== null) g.setAttribute(attr, v);
    }
    g.append(...Array.from(svg.childNodes));
    root.append(g);

    const entries = panel.lines.filter((l) => l.legend !== false && l.name);
    if (spec.legend !== "none" && entries.length && (i === 0 || !sameLegends)) {
      const rowH = fs * 1.3;
      const swatch = fs * 1.6;
      const gap = fs * 0.4;
      const pad = fs * 0.45;
      const boxW = pad * 2 + swatch + gap + Math.max(...entries.map((e) => measure(e.name)));
      const boxH = pad * 2 + rowH * (entries.length - 1) + fs;
      const place = (corner: Corner) => ({
        left: corner.endsWith("left") ? marginLeft + fs * 0.5 : width - marginRight - fs * 0.5 - boxW,
        top: corner.startsWith("top") ? tops[i] + fs * 0.5 : tops[i] + innerH - fs * 0.5 - boxH,
      });

      // "auto": the corner whose legend box would hide the fewest data points.
      let corner: Corner = spec.legend === "auto" ? "top-right" : spec.legend;
      if (spec.legend === "auto") {
        const innerW = width - marginLeft - marginRight;
        const [y0, y1] = yAxes[i].domain;
        let fewest = Infinity;
        for (const c of CORNERS) {
          const { left, top } = place(c);
          let hidden = 0;
          for (const l of panel.lines) {
            const stride = Math.max(1, Math.floor(l.x.length / 400));
            let prev: [number, number] | null = null;
            for (let k = 0; k < l.x.length; k += stride) {
              if (!Number.isFinite(l.y[k])) {
                prev = null;
                continue;
              }
              const p: [number, number] = [
                marginLeft + ((l.x[k] - xDomain[0]) / (xDomain[1] - xDomain[0])) * innerW,
                tops[i] + innerH - ((l.y[k] - y0) / (y1 - y0)) * innerH,
              ];
              if (segmentHitsBox(prev ?? p, p, left, top, left + boxW, top + boxH)) hidden++;
              prev = p;
            }
          }
          if (hidden < fewest) {
            fewest = hidden;
            corner = c;
          }
        }
      }
      const { left } = place(corner);
      const top = offset + place(corner).top;
      // Plot sets text-anchor="middle" on its root; legend text must start at its x.
      const lg = el("g", { transform: `translate(${left},${top})`, "text-anchor": "start" });
      lg.append(el("rect", { width: boxW, height: boxH, fill: "#fff", "fill-opacity": 0.85 }));
      entries.forEach((e, k) => {
        const cy = pad + rowH * k + fs / 2;
        const line: Record<string, string | number> = { x1: pad, x2: pad + swatch, y1: cy, y2: cy, stroke: e.color, "stroke-width": lw };
        if (e.dash) line["stroke-dasharray"] = e.dash;
        lg.append(el("line", line));
        lg.append(el("text", { x: pad + swatch + gap, y: cy, dy: "0.35em", fill: "#000" }, e.name));
      });
      root.append(lg);
    }

    if (spec.panelLabels && n > 1) {
      root.append(
        el("text", { x: fs * 0.2, y: offset + tops[i] + fs * 0.4, "font-weight": "bold", "font-size": fs * 1.15, fill: "#000" }, String.fromCharCode(97 + i)),
      );
    }
    offset += panelH;
  });

  return root;
}
