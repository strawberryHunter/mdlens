import { ClipboardCopy, FileCode2, ImageDown, Table2, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { copyPng, downloadBlob, svgToPng, svgToString, toCsv } from "../lib/export";
import { buildFigure, figureHeightIn, type FigureSpec } from "../lib/figure";
import type { ExcludedFile, Panel } from "../lib/workspace";
import { PRESETS } from "../settings";
import { Button, Card, Segmented } from "./ui";

export function FigureStudio({
  spec,
  panels,
  presetId,
  onPreset,
  view,
  onView,
  onRemovePanel,
  baseName,
  aggregateFailed,
  excluded,
  software,
  distributionCsv,
  notify,
}: {
  spec: FigureSpec;
  panels: Panel[];
  presetId: string;
  onPreset: (id: string) => void;
  view: "time" | "distribution";
  onView: (view: "time" | "distribution") => void;
  onRemovePanel: (id: string) => void;
  baseName: string;
  aggregateFailed: boolean;
  excluded: ExcludedFile[];
  /** Recorded in exported PNGs (tEXt "Software"). */
  software: string;
  distributionCsv: () => string;
  notify: (message: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const heightIn = figureHeightIn(spec);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const svg = buildFigure(spec);
    host.replaceChildren(svg);
    svgRef.current = svg;
  }, [spec]);

  async function png(dpi: number) {
    if (!svgRef.current) return;
    try {
      downloadBlob(await svgToPng(svgRef.current, spec.widthIn, heightIn, dpi, software), `${baseName}_${dpi}dpi.png`);
    } catch (err) {
      notify(`PNG export failed: ${(err as Error).message}`);
    }
  }

  function svg() {
    if (!svgRef.current) return;
    downloadBlob(new Blob([svgToString(svgRef.current, `${spec.widthIn}in`, `${heightIn}in`)], { type: "image/svg+xml" }), `${baseName}.svg`);
  }

  async function copy() {
    if (!svgRef.current) return;
    try {
      await copyPng(svgRef.current, spec.widthIn, heightIn, 300, software);
      notify("Copied a 300 dpi PNG. Paste it into PowerPoint, Keynote or Docs.");
    } catch (err) {
      notify(`Copy failed: ${(err as Error).message}`);
    }
  }

  function csv() {
    if (view === "distribution") {
      downloadBlob(new Blob([distributionCsv()], { type: "text/csv" }), `${baseName}_distribution.csv`);
      return;
    }
    const series = panels.flatMap((p) => p.series.map((s) => ({ ...s, name: panels.length > 1 ? `${s.name} · ${p.yLabel}` : s.name })));
    downloadBlob(new Blob([toCsv(series, spec.xLabel, panels.length === 1 ? panels[0].yLabel : "value")], { type: "text/csv" }), `${baseName}.csv`);
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="mr-1 text-[13px] font-semibold text-ink">Figure</h2>
        <Segmented
          value={view}
          onChange={onView}
          options={[
            { value: "time", label: "Over time", title: "Values against time" },
            { value: "distribution", label: "Distribution", title: "Histogram and density of the production region" },
          ]}
        />
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {panels.map((p, i) => (
            <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-raised py-0.5 pl-2 pr-1 text-[12px] text-ink">
              {panels.length > 1 && <span className="font-semibold text-muted">{String.fromCharCode(97 + i)}</span>}
              {p.yLabel}
              <button
                type="button"
                aria-label={`Remove ${p.yLabel}`}
                onClick={() => onRemovePanel(p.id)}
                className="grid size-4 place-items-center rounded-full text-muted hover:bg-line hover:text-ink"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <Segmented
          value={presetId}
          onChange={onPreset}
          options={[...PRESETS.map((p) => ({ value: p.id, label: p.label, title: p.title })), ...(presetId === "custom" ? [{ value: "custom", label: "Custom" }] : [])]}
          className="w-full sm:w-auto"
        />
      </div>

      <div className="dots flex justify-center bg-raised/40 px-4 py-8 sm:px-10 sm:py-12">
        <div
          ref={hostRef}
          className="figure-host w-full overflow-hidden rounded-[3px] bg-white shadow-lift ring-1 ring-black/5"
          style={{ maxWidth: Math.max(440, Math.min(980, spec.widthIn * 165)) }}
        />
      </div>

      {excluded.length > 0 && (
        <p className="flex items-start gap-2 border-t border-line bg-warn/10 px-4 py-2 text-[12.5px] text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Not drawn: {excluded.map((e) => `${e.label} (x axis: ${e.axis})`).join(", ")}. A figure needs one kind of x axis; files with a
            time axis are shown.
          </span>
        </p>
      )}
      {aggregateFailed && (
        <p className="flex items-center gap-2 border-t border-line bg-warn/10 px-4 py-2 text-[12.5px] text-warn">
          <TriangleAlert className="size-4" /> Mean ± SD needs series with identical time points. Hide the files that differ.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
        <span className="text-[12px] text-muted tabular-nums">
          {spec.widthIn} × {Number(heightIn.toFixed(2))} in · {spec.fontPt} pt Arial
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="primary" size="sm" icon={<ClipboardCopy className="size-3.5" />} onClick={copy}>
            Copy
          </Button>
          <Button size="sm" icon={<ImageDown className="size-3.5" />} onClick={() => png(300)}>
            PNG 300
          </Button>
          <Button size="sm" onClick={() => png(600)}>
            600 dpi
          </Button>
          <Button size="sm" icon={<FileCode2 className="size-3.5" />} onClick={svg}>
            SVG
          </Button>
          <Button size="sm" icon={<Table2 className="size-3.5" />} onClick={csv}>
            CSV
          </Button>
        </div>
      </div>
    </Card>
  );
}
