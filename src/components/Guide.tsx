import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { REPO_URL } from "./TopBar";
import { Button, Card } from "./ui";

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-20 text-[19px] font-semibold tracking-tight text-ink">
      {children}
    </h2>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{children}</p>;
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-[13.5px]">
        <thead className="bg-raised/60 text-[12px] uppercase tracking-[0.05em] text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line align-top">
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? "px-4 py-2.5 font-medium text-ink" : "px-4 py-2.5 text-muted"}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[12.5px] text-ink">{children}</code>
);

const SECTIONS = [
  ["start", "Quick start"],
  ["files", "Supported files"],
  ["cards", "Reading the dashboard"],
  ["stats", "How the statistics work"],
  ["figures", "Figures and export"],
  ["trouble", "Troubleshooting"],
];

/** How to use MDLens; opened with #guide. */
export function Guide({ onBack }: { onBack: () => void }) {
  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav className="hidden lg:block">
        <div className="sticky top-20 space-y-1 text-[13px]">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-3.5" />} onClick={onBack} className="-ml-2 mb-3">
            Back to the app
          </Button>
          {SECTIONS.map(([id, title]) => (
            <a key={id} href={`#guide-${id}`} className="block rounded-md px-2 py-1 text-muted hover:bg-raised hover:text-ink">
              {title}
            </a>
          ))}
        </div>
      </nav>

      <article className="min-w-0">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-3.5" />} onClick={onBack} className="-ml-2 lg:hidden">
          Back to the app
        </Button>
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">Guide</h1>
        <P>
          MDLens reads the log and analysis files your simulation engine already writes, finds where each run equilibrated, and turns the
          production region into statistics and figures. Everything happens in your browser; files are never uploaded.
        </P>

        <H2 id="guide-start">Quick start</H2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14.5px] leading-relaxed text-muted">
          <li>Drop one or more files anywhere on the page, or press <b className="text-ink">Open files</b>. Several replicas or engines at once is fine.</li>
          <li>The most informative quantity (usually temperature) is plotted straight away. Click other cards to add panels.</li>
          <li>Read the production statistics under the figure; copy a value as <Code>300.0 ± 0.4 K</Code> with the copy button.</li>
          <li>Pick a size preset and press <b className="text-ink">Copy</b> (300 dpi PNG for slides) or <b className="text-ink">SVG</b> (for the manuscript).</li>
        </ol>

        <H2 id="guide-files">Supported files</H2>
        <P>The engine is recognised from the contents, so file names do not matter.</P>
        <Table
          head={["Engine", "What to drop", "Notes"]}
          rows={[
            ["GROMACS", <>.xvg from <Code>gmx energy</Code>, <Code>rms</Code>, <Code>gyrate</Code>, <Code>sasa</Code>, …</>, "Grace labels such as nm\\S2\\N are shown as nm²."],
            ["NAMD", "standard output (the .log with ETITLE / ENERGY lines)", "Time comes from TIMESTEP; without it the x axis is the step."],
            ["OpenMM", "StateDataReporter CSV, or CHARMM-GUI's tab-separated .out", ""],
            ["CHARMM", "dynamics output (.out with DYNA> lines)", "Several runs in one file are joined end to end."],
            ["LAMMPS", "log.lammps (thermo_style one or custom)", "Units follow the units command; runs are merged."],
            ["AMBER", "mdout (sander / pmemd), including TI output", "TI: region 1 is read; DV/DL appears as dV/dλ."],
            ["PLUMED", "COLVAR, HILLS", ""],
            ["Anything else", "CSV, TSV or whitespace tables, cpptraj .dat", "Column names come from the header or the last comment line."],
          ]}
        />

        <H2 id="guide-cards">Reading the dashboard</H2>
        <P>
          Every quantity found in your files gets a card with its production mean ± standard error and a sparkline. The same quantity from
          different engines (TEMP, Temp, TEMPerature, TEMP(K)) shares one card, in one unit.
        </P>
        <Table
          head={["Card status", "Meaning"]}
          rows={[
            ["Equilibrated at 0.19 ns", "Production starts there; earlier frames are left out of the statistics."],
            ["Stationary from start", "No equilibration period was needed."],
            ["Still relaxing at > 50% of run", "More than half the run was spent equilibrating. Consider running longer."],
            ["Unstable from 1.08 ns", "The temperature turned NaN and stayed that way. Statistics stop before that point."],
            ["Constant", "The value never changes (hidden by default)."],
          ]}
        />
        <P>Orange notes under a file in the left panel say what the reader skipped or noticed: warnings, crashed or truncated runs, overflowed fields.</P>

        <H2 id="guide-stats">How the statistics work</H2>
        <P>
          <b className="text-ink">Production region.</b> For each series MDLens tries every frame as the start of production and keeps the one
          that leaves the most statistically independent samples (Chodera, <i>J. Chem. Theory Comput.</i> 2016, 12, 1799). Runs longer than
          2000 frames are evenly strided to 2000 frames for this search.
        </P>
        <P>
          <b className="text-ink">SE.</b> The standard error of the mean, corrected for autocorrelation: SD × √(g / N), with g the statistical
          inefficiency. It reflects independent samples, not frames.
        </P>
        <P>
          <b className="text-ink">SE (block).</b> The same error estimated a second way, by block averaging (Flyvbjerg–Petersen, block size by
          the Wolff / Lee criterion). When the two disagree by more than 2× the cell turns orange: the run is probably not converged. A dash
          means no block size gives a stable error, which happens for short or drifting data.
        </P>
        <P>
          <b className="text-ink">Manual range.</b> In the inspector, switch Production region to Manual to set the range yourself; it then
          applies to every series.
        </P>
        <P>
          <b className="text-ink">Validation.</b> The statistics are checked against pymbar 4.2, pyblock 0.6, numpy and scipy on reference data
          and agree to numerical precision; see the <a className="text-accent" href={`${REPO_URL}#validation`}>README</a>.
        </P>

        <H2 id="guide-figures">Figures and export</H2>
        <Table
          head={["Control", "What it does"]}
          rows={[
            ["Over time / Distribution", "Values against time, or the histogram and density of the production region (each panel then has its own x axis)."],
            ["Size presets", "1-column (3.3 in), 2-column (7 in), square, 16:9 slide; fonts in points."],
            ["Units", "Time, length, energy and pressure; every file is converted, labels follow."],
            ["Combine files as mean ± SD", "Point-by-point average of replicas with identical time points."],
            ["Same unit → one panel", "Overlay several quantities that share a unit instead of stacking them."],
            ["Copy / PNG", "PNG with DPI metadata, so it pastes into PowerPoint or Keynote at the right size."],
            ["SVG", "Vector file sized in inches, editable in Illustrator or Inkscape."],
            ["CSV", "The plotted series, in display units."],
          ]}
        />
        <P>A figure uses one kind of x axis. Files measured in steps are left out of a time figure, with a note saying so.</P>

        <H2 id="guide-trouble">Troubleshooting</H2>
        <Table
          head={["Message", "What to do"]}
          rows={[
            ["No data recognised", "The file has no numeric table MDLens understands. Check it is the log or analysis output, not the input file."],
            ["Per-atom output", "Files with more than 200 columns (e.g. gmx traj -of) are not plotted."],
            ["Not drawn: … (x axis: Step)", "That file has no time axis. For NAMD, keep the log header that contains TIMESTEP."],
            ["Run stopped before finishing", "The engine reported an error (for example lost atoms). Values up to that point are shown."],
          ]}
        />
        <P>
          Something read wrongly? Open an issue at <a className="text-accent" href={`${REPO_URL}/issues`}>github.com/strawberryHunter/mdlens</a>{" "}
          and, if you can, attach the file. Files that break MDLens are the most useful bug reports.
        </P>

        <Card className="mt-10 p-5">
          <p className="text-[13.5px] text-muted">
            MDLens is open source under the MIT licence. It runs entirely in your browser: nothing you open is sent anywhere.
          </p>
        </Card>
      </article>
    </main>
  );
}
