import type { LegendPosition } from "../lib/figure";
import type { UnitPrefs } from "../lib/units";
import type { Panel } from "../lib/workspace";
import type { Settings } from "../settings";
import { Card, Field, NumberInput, Section, Segmented, Switch, cx, inputClass } from "./ui";

const round6 = (v: number) => String(Number(v.toPrecision(6)));

export function Inspector({
  settings: s,
  set,
  panels,
  autoXLabel,
  xExtent,
  timeUnit,
  className,
}: {
  settings: Settings;
  set: (patch: Partial<Settings>) => void;
  panels: Panel[];
  autoXLabel: string;
  xExtent: [number, number] | null;
  timeUnit: string | null;
  className?: string;
}) {
  const units = (patch: Partial<UnitPrefs>) => set({ units: { ...s.units, ...patch }, from: "", to: "" });
  const lastFraction = (f: number) => {
    if (!xExtent) return;
    set({ region: "manual", from: round6(xExtent[1] - (xExtent[1] - xExtent[0]) * f), to: "" });
  };

  return (
    <Card className={cx("overflow-hidden", className)}>
      <Section title="Size">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width (in)">
            <NumberInput value={s.widthIn} onChange={(v) => set({ widthIn: v })} min={1.5} max={20} step={0.1} />
          </Field>
          <Field label="Height (in)">
            <NumberInput value={s.heightIn} onChange={(v) => set({ heightIn: v })} min={1} max={20} step={0.1} />
          </Field>
          <Field label="Font (pt)">
            <NumberInput value={s.fontPt} onChange={(v) => set({ fontPt: v })} min={5} max={36} step={0.5} />
          </Field>
          <Field label="Line (pt)">
            <NumberInput value={s.lineWidthPt} onChange={(v) => set({ lineWidthPt: v })} min={0.25} max={6} step={0.25} />
          </Field>
        </div>
      </Section>

      <Section title="Units">
        <Field label="Time">
          <Segmented
            value={s.units.time}
            onChange={(time) => units({ time })}
            options={(["fs", "ps", "ns", "µs"] as const).map((v) => ({ value: v, label: v }))}
          />
        </Field>
        <Field label="Length">
          <Segmented
            value={s.units.length}
            onChange={(length) => units({ length })}
            options={[
              { value: "auto", label: "As recorded" },
              { value: "nm", label: "nm" },
              { value: "Å", label: "Å" },
            ]}
          />
        </Field>
        <Field label="Energy">
          <Segmented
            value={s.units.energy}
            onChange={(energy) => units({ energy })}
            options={[
              { value: "auto", label: "Auto" },
              { value: "kJ/mol", label: "kJ" },
              { value: "kcal/mol", label: "kcal" },
              { value: "eV", label: "eV" },
            ]}
          />
        </Field>
        <Field label="Pressure">
          <Segmented
            value={s.units.pressure}
            onChange={(pressure) => units({ pressure })}
            options={[
              { value: "auto", label: "Auto" },
              { value: "bar", label: "bar" },
              { value: "atm", label: "atm" },
            ]}
          />
        </Field>
      </Section>

      <Section title="Data">
        <Field label={`Running average${s.smooth > 1 ? ` · ${s.smooth} points` : " · off"}`}>
          <input
            type="range"
            min={0}
            max={200}
            value={s.smooth}
            onChange={(e) => set({ smooth: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
        <Switch label="Show raw data faintly" checked={s.showRaw} onChange={(showRaw) => set({ showRaw })} />
        <Switch label="Combine files as mean ± SD" checked={s.aggregate} onChange={(aggregate) => set({ aggregate })} />
        <Switch label="Full resolution" checked={s.fullRes} onChange={(fullRes) => set({ fullRes })} />
      </Section>

      <Section title="Production region">
        <Segmented
          value={s.region}
          onChange={(region) => set({ region })}
          options={[
            { value: "auto", label: "Auto-detect" },
            { value: "manual", label: "Manual" },
          ]}
        />
        {s.region === "manual" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label={`From${timeUnit ? ` (${timeUnit})` : ""}`}>
                <input
                  type="number"
                  className={inputClass}
                  value={s.from}
                  placeholder={xExtent ? round6(xExtent[0]) : ""}
                  onChange={(e) => set({ from: e.target.value })}
                />
              </Field>
              <Field label={`To${timeUnit ? ` (${timeUnit})` : ""}`}>
                <input
                  type="number"
                  className={inputClass}
                  value={s.to}
                  placeholder={xExtent ? round6(xExtent[1]) : ""}
                  onChange={(e) => set({ to: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex gap-1.5">
              {[
                ["Last 50%", 0.5],
                ["Last 20%", 0.2],
              ].map(([label, f]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => lastFraction(f as number)}
                  className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted transition hover:bg-raised hover:text-ink"
                >
                  {label}
                </button>
              ))}
            </div>
            <Switch label="Shade on figure" checked={s.shade} onChange={(shade) => set({ shade })} />
          </>
        )}
        {s.region === "auto" && (
          <Switch label="Mark equilibration on figure" checked={s.markEquilibration} onChange={(markEquilibration) => set({ markEquilibration })} />
        )}
      </Section>

      <Section title="Labels">
        <Field label="Title">
          <input className={inputClass} value={s.title} placeholder="None" onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="X axis">
          <input className={inputClass} value={s.xLabel} placeholder={autoXLabel} onChange={(e) => set({ xLabel: e.target.value })} />
        </Field>
        {panels.map((p, i) => (
          <Field key={p.id} label={panels.length > 1 ? `Y axis (${String.fromCharCode(97 + i)})` : "Y axis"}>
            <input
              className={inputClass}
              value={s.yLabels[p.id] ?? ""}
              placeholder={p.yLabel}
              onChange={(e) => set({ yLabels: { ...s.yLabels, [p.id]: e.target.value } })}
            />
          </Field>
        ))}
      </Section>

      <Section title="Style">
        <Field label="Legend">
          <select className={inputClass} value={s.legend} onChange={(e) => set({ legend: e.target.value as LegendPosition })}>
            <option value="auto">Auto (avoid data)</option>
            <option value="top-right">Top right</option>
            <option value="top-left">Top left</option>
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
            <option value="none">Hidden</option>
          </select>
        </Field>
        <Switch label="Box around plot" checked={s.frame} onChange={(frame) => set({ frame })} />
        <Switch label="Grid lines" checked={s.grid} onChange={(grid) => set({ grid })} />
        <Switch label="Y axis from zero" checked={s.yFromZero} onChange={(yFromZero) => set({ yFromZero })} />
        <Switch label="Panel letters (a, b, c)" checked={s.panelLabels} onChange={(panelLabels) => set({ panelLabels })} />
        <Switch label="Same unit → one panel" checked={s.merge} onChange={(merge) => set({ merge })} />
      </Section>
    </Card>
  );
}
