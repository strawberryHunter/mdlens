import { Search, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { FigureStudio } from "./components/FigureStudio";
import { FileRail } from "./components/FileRail";
import { Inspector } from "./components/Inspector";
import { Landing } from "./components/Landing";
import { QuantityCard } from "./components/QuantityCard";
import { StatsTable, type StatsGroup } from "./components/StatsTable";
import { TopBar } from "./components/TopBar";
import { Segmented, Switch, cx, inputClass } from "./components/ui";
import type { FigureSpec } from "./lib/figure";
import { panelToFigure } from "./lib/figureData";
import { ACCEPT, parseFile } from "./lib/formats/detect";
import { summarize, type Summary } from "./lib/stats";
import { dimensionOf } from "./lib/units";
import { buildCatalog, buildPanels, loadFile, PALETTE, type Category, type LoadedFile } from "./lib/workspace";
import { PRESETS, useSettings, useTheme } from "./settings";

// Per-atom output (e.g. gmx traj -of) can have millions of columns; that is not a plot.
const MAX_QUANTITIES = 200;

let nextId = 0;

export default function App() {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [settings, set] = useSettings();
  const [theme, setTheme] = useTheme();
  const [category, setCategory] = useState<"all" | Category>("all");
  const [query, setQuery] = useState("");
  const [showConstant, setShowConstant] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const catalog = useMemo(() => buildCatalog(files), [files]);
  const units = settings.units;

  function load(incoming: { name: string; text: string }[]) {
    const added: LoadedFile[] = [];
    const rejected: string[] = [];
    for (const { name, text } of incoming) {
      const dataset = parseFile(name, text);
      if (!dataset.quantities.length) rejected.push(`${name}: no data recognised`);
      else if (dataset.quantities.length > MAX_QUANTITIES) rejected.push(`${name}: ${dataset.quantities.length.toLocaleString()} columns (per-atom output)`);
      else added.push(loadFile(`f${nextId++}`, name, dataset, PALETTE[(files.length + added.length) % PALETTE.length]));
    }
    if (rejected.length) setNotice(`Skipped ${rejected.join("; ")}`);
    if (!added.length) return;
    const next = [...files, ...added];
    setFiles(next);
    // Start with the most informative quantity plotted, so there is a figure right away.
    if (!selected.length) {
      const first = buildCatalog(next).find((e) => !e.constant);
      if (first) setSelected([first.key]);
    }
  }

  async function loadFileList(list: FileList | null) {
    if (!list?.length) return;
    load(await Promise.all([...list].map(async (f) => ({ name: f.name, text: await f.text() }))));
  }

  async function loadSamples(names: string[]) {
    const base = import.meta.env.BASE_URL;
    try {
      load(await Promise.all(names.map(async (name) => ({ name, text: await (await fetch(`${base}samples/${name}`)).text() }))));
    } catch {
      setNotice("Could not load the sample files.");
    }
  }

  function reset() {
    setFiles([]);
    setSelected([]);
  }

  function toggle(key: string) {
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    loadFileList(e.dataTransfer.files);
  }

  // Panels for the figure, in display units.
  const liveSelected = selected.filter((k) => catalog.some((e) => e.key === k));
  const { panels, xLabel: autoXLabel } = useMemo(
    () => buildPanels(liveSelected, catalog, files, units, settings.merge),
    // liveSelected is derived from selected and catalog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, catalog, files, units, settings.merge],
  );
  const firstVisible = files.find((f) => f.visible);
  const timeUnit = firstVisible && dimensionOf(firstVisible.dataset.xUnit) === "time" ? units.time : null;

  const xExtent = useMemo((): [number, number] | null => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of panels) {
      for (const s of p.series) {
        for (const v of s.x) {
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
    }
    return lo <= hi ? [lo, hi] : null;
  }, [panels]);

  const manual = settings.region === "manual";
  const from = settings.from === "" ? -Infinity : Number(settings.from);
  const to = settings.to === "" ? Infinity : Number(settings.to);

  const summaries = useMemo(() => {
    const map = new Map<string, Summary>();
    for (const p of panels) {
      for (const s of p.series) map.set(s.id, manual ? summarize(s.x, s.y, { from, to }) : s.summary);
    }
    return map;
  }, [panels, manual, from, to]);

  const { spec, aggregateFailed } = useMemo(() => {
    let failed = false;
    const figurePanels = panels.map((p) => {
      const { figure, aggregateFailed } = panelToFigure(p, settings.yLabels[p.id] || p.yLabel, {
        smooth: settings.smooth,
        showRaw: settings.showRaw,
        aggregate: settings.aggregate,
        fullRes: settings.fullRes,
        markEquilibration: !manual && settings.markEquilibration,
        summaries,
      });
      failed ||= aggregateFailed;
      return figure;
    });
    const spec: FigureSpec = {
      widthIn: settings.widthIn,
      heightIn: settings.heightIn,
      fontPt: settings.fontPt,
      lineWidthPt: settings.lineWidthPt,
      xLabel: settings.xLabel || autoXLabel,
      title: settings.title,
      panels: figurePanels,
      highlight: manual && settings.shade && xExtent ? [Math.max(from, xExtent[0]), Math.min(to, xExtent[1])] : null,
      yFromZero: settings.yFromZero,
      frame: settings.frame,
      grid: settings.grid,
      legend: settings.legend,
      panelLabels: settings.panelLabels,
    };
    return { spec, aggregateFailed: failed };
  }, [panels, settings, summaries, autoXLabel, manual, xExtent, from, to]);

  const statsGroups: StatsGroup[] = panels.map((p) => ({
    id: p.id,
    label: settings.yLabels[p.id] || p.yLabel,
    unit: p.unit,
    rows: p.series.map((s) => ({ id: s.id, name: s.name, color: s.color, summary: summaries.get(s.id) ?? s.summary })),
  }));

  // Overview cards, each with its own single-quantity panel.
  const cards = useMemo(
    () =>
      catalog.map((entry) => ({
        entry,
        panel: buildPanels([entry.key], catalog, files, units, false).panels[0],
      })),
    [catalog, files, units],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, thermo: 0, energy: 0, structure: 0, other: 0 };
    for (const e of catalog) {
      if (e.constant && !showConstant) continue;
      c.all++;
      c[e.category]++;
    }
    return c;
  }, [catalog, showConstant]);
  const constantCount = catalog.filter((e) => e.constant).length;
  const visibleCards = cards.filter(
    ({ entry }) =>
      (showConstant || !entry.constant) &&
      (category === "all" || entry.category === category) &&
      entry.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const presetId = PRESETS.find((p) => p.widthIn === settings.widthIn && p.heightIn === settings.heightIn && p.fontPt === settings.fontPt)?.id ?? "custom";
  const baseName = (firstVisible?.label ?? "figure").replace(/[^\w.-]+/g, "_");

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(
      () => setNotice(`Copied “${text}”`),
      () => setNotice("Clipboard is not available."),
    );
  }

  return (
    <div
      className="min-h-screen"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <TopBar theme={theme} onTheme={setTheme} onOpen={() => inputRef.current?.click()} onHome={reset} />
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          loadFileList(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length === 0 ? (
        <Landing onBrowse={() => inputRef.current?.click()} onSample={loadSamples} />
      ) : (
        <div
          className={cx(
            "mx-auto grid max-w-[1800px] items-start gap-4 p-4",
            panels.length ? "lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]" : "lg:grid-cols-[260px_minmax(0,1fr)]",
          )}
        >
          <FileRail
            className="lg:sticky lg:top-[72px]"
            files={files}
            prefs={units}
            onUpdate={(id, patch) => setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)))}
            onRemove={(id) => setFiles((fs) => fs.filter((f) => f.id !== id))}
            onAdd={() => inputRef.current?.click()}
            onClear={reset}
          />

          <main className="min-w-0 space-y-4">
            {panels.length > 0 && (
              <>
                <FigureStudio
                  spec={spec}
                  panels={panels}
                  presetId={presetId}
                  onPreset={(id) => {
                    const p = PRESETS.find((x) => x.id === id);
                    if (p) set({ widthIn: p.widthIn, heightIn: p.heightIn, fontPt: p.fontPt, lineWidthPt: p.lineWidthPt });
                  }}
                  onRemovePanel={(id) => setSelected((s) => s.filter((k) => !id.split("+").includes(k)))}
                  baseName={baseName}
                  aggregateFailed={aggregateFailed}
                  notify={setNotice}
                />
                <StatsTable groups={statsGroups} timeUnit={timeUnit} manual={manual} onCopy={copyText} />
              </>
            )}

            <section>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="mr-auto">
                  <h2 className="text-[15px] font-semibold tracking-tight text-ink">Quantities</h2>
                  <p className="text-[12px] text-muted">Click a card to add it to the figure. Cards show the production mean ± SE.</p>
                </div>
                <div className="relative w-full sm:w-52">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                  <input className={cx(inputClass, "pl-8")} placeholder="Filter" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <Segmented
                  value={category}
                  onChange={setCategory}
                  className="w-full sm:w-auto"
                  options={(["all", "thermo", "energy", "structure", "other"] as const)
                    .filter((c) => c === "all" || counts[c] > 0)
                    .map((c) => ({ value: c, label: `${c[0].toUpperCase()}${c.slice(1)} ${counts[c]}` }))}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4 min-[1400px]:grid-cols-3">
                {visibleCards.map(({ entry, panel }) => (
                  <QuantityCard
                    key={entry.key}
                    entry={entry}
                    panel={panel}
                    order={liveSelected.indexOf(entry.key) + 1}
                    timeUnit={panel.series[0] && files.find((f) => f.id === panel.series[0].fileId && dimensionOf(f.dataset.xUnit) === "time") ? units.time : null}
                    onToggle={() => toggle(entry.key)}
                  />
                ))}
              </div>
              {constantCount > 0 && (
                <div className="mt-3 max-w-xs">
                  <Switch label={`Show ${constantCount} constant ${constantCount === 1 ? "quantity" : "quantities"}`} checked={showConstant} onChange={setShowConstant} />
                </div>
              )}
            </section>
          </main>

          {panels.length > 0 && (
            <Inspector
              className="lg:col-span-2 xl:sticky xl:top-[72px] xl:col-span-1 xl:max-h-[calc(100vh-88px)] xl:overflow-y-auto"
              settings={settings}
              set={set}
              panels={panels}
              autoXLabel={autoXLabel}
              xExtent={xExtent}
              timeUnit={timeUnit}
            />
          )}
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-bg/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-accent bg-surface px-16 py-12 shadow-lift">
            <Upload className="size-6 text-accent" />
            <span className="text-lg font-semibold text-ink">Drop to add files</span>
            <span className="text-[13px] text-muted">GROMACS · NAMD · OpenMM · CHARMM · LAMMPS · AMBER</span>
          </div>
        </div>
      )}
      {notice && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 max-w-[calc(100vw-32px)] -translate-x-1/2 animate-fade-up rounded-xl bg-ink px-4 py-2.5 text-[13px] text-bg shadow-lift">
          {notice}
        </div>
      )}
    </div>
  );
}
