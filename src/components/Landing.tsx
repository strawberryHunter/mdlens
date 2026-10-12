import { Activity, Cpu, FileImage, ShieldCheck, Sparkles, Upload } from "lucide-react";
import type { Engine } from "../lib/dataset";
import { ENGINE_COLORS } from "./ui";

export const SAMPLES: { engine: Engine | "Compare"; label: string; files: string[] }[] = [
  { engine: "GROMACS", label: "3 RMSD replicas", files: ["rmsd_rep1.xvg", "rmsd_rep2.xvg", "rmsd_rep3.xvg"] },
  { engine: "NAMD", label: "equilibration log", files: ["namd_equil.log"] },
  { engine: "OpenMM", label: "state data CSV", files: ["openmm_prod.csv"] },
  { engine: "CHARMM", label: "dynamics output", files: ["charmm_dyn.out"] },
  { engine: "LAMMPS", label: "log.lammps", files: ["log.lammps"] },
  { engine: "AMBER", label: "mdout", files: ["prod.mdout"] },
];

const COMPARE = ["namd_equil.log", "openmm_prod.csv", "gmx_energy.xvg", "prod.mdout"];

const FEATURES = [
  { icon: Cpu, title: "Any engine", text: "GROMACS, NAMD, OpenMM, CHARMM, LAMMPS, AMBER and PLUMED, recognised from the contents. Units unified." },
  { icon: Activity, title: "Equilibration, detected", text: "Finds where each run settles (Chodera 2016) and reports production mean ± autocorrelation-corrected error." },
  { icon: FileImage, title: "Paper-ready figures", text: "Journal column widths, stacked panels, SVG and 300 dpi PNG that paste at the right size." },
  { icon: ShieldCheck, title: "Private by design", text: "Files are read in your browser. Nothing is uploaded, so unpublished data stays yours." },
];

export function Landing({ onBrowse, onSample }: { onBrowse: () => void; onSample: (files: string[]) => void }) {
  return (
    <main className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 h-[520px]">
        <div className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute left-[62%] top-24 h-[260px] w-[420px] rounded-full bg-accent2/20 blur-[100px]" />
      </div>

      <section className="relative mx-auto max-w-4xl px-4 pb-10 pt-16 text-center sm:pt-24">
        <span className="inline-flex animate-fade-up items-center gap-1.5 rounded-full border border-line bg-surface/70 px-3 py-1 text-[12px] font-medium text-muted backdrop-blur">
          <Sparkles className="size-3.5 text-accent" /> Automatic equilibration detection
        </span>
        <h1 className="mt-6 animate-fade-up text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-6xl" style={{ animationDelay: "60ms" }}>
          Every MD log.
          <br />
          <span className="text-gradient">One clear answer.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl animate-fade-up text-[15px] leading-relaxed text-muted sm:text-lg" style={{ animationDelay: "120ms" }}>
          Drop output from any simulation engine. MDLens finds where your system equilibrated, gives you production averages with honest
          error bars, and exports figures ready for the paper.
        </p>

        <button
          type="button"
          onClick={onBrowse}
          className="group mx-auto mt-10 flex w-full max-w-2xl animate-fade-up flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-line bg-surface/80 px-6 py-12 shadow-soft backdrop-blur transition-all hover:border-accent hover:shadow-lift"
          style={{ animationDelay: "180ms" }}
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent transition-transform group-hover:-translate-y-1">
            <Upload className="size-5" />
          </span>
          <span className="text-lg font-semibold text-ink">Drop files anywhere</span>
          <span className="text-[13px] text-muted">
            or <span className="font-medium text-accent">browse</span> · .xvg · .log · .out · .mdout · .csv · .dat · COLVAR
          </span>
        </button>

        <div className="mt-8 animate-fade-up" style={{ animationDelay: "240ms" }}>
          <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Or try a sample</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => onSample(COMPARE)}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-bg transition hover:opacity-90"
            >
              <span className="flex -space-x-1">
                {(["NAMD", "OpenMM", "GROMACS", "AMBER"] as Engine[]).map((e) => (
                  <span key={e} className="size-2.5 rounded-full ring-2 ring-ink" style={{ background: ENGINE_COLORS[e] }} />
                ))}
              </span>
              Compare 4 engines
            </button>
            {SAMPLES.map((s) => (
              <button
                key={s.engine}
                type="button"
                onClick={() => onSample(s.files)}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-ink transition hover:border-muted/50 hover:bg-raised"
              >
                <span className="size-2 rounded-full" style={{ background: ENGINE_COLORS[s.engine as Engine] }} />
                <span className="font-medium">{s.engine}</span>
                <span className="text-muted">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto grid max-w-5xl gap-3 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, text }, i) => (
          <div
            key={title}
            className="animate-fade-up rounded-2xl border border-line bg-surface/80 p-5 shadow-soft backdrop-blur"
            style={{ animationDelay: `${300 + i * 60}ms` }}
          >
            <span className="grid size-9 place-items-center rounded-xl bg-raised text-ink">
              <Icon className="size-4" />
            </span>
            <h3 className="mt-4 text-[14px] font-semibold text-ink">{title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
