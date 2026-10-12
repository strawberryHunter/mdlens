import { useEffect, useState } from "react";
import type { LegendPosition } from "./lib/figure";
import { DEFAULT_UNITS, type UnitPrefs } from "./lib/units";

export const PRESETS = [
  { id: "paper-1", label: "1-col", title: "Journal single column (3.3 in)", widthIn: 3.3, heightIn: 2.5, fontPt: 8, lineWidthPt: 1 },
  { id: "paper-2", label: "2-col", title: "Journal double column (7 in)", widthIn: 7, heightIn: 3, fontPt: 8, lineWidthPt: 1 },
  { id: "square", label: "Square", title: "Square (3.3 in)", widthIn: 3.3, heightIn: 3.3, fontPt: 8, lineWidthPt: 1 },
  { id: "slide", label: "Slide", title: "16:9 slide (8 in)", widthIn: 8, heightIn: 4.5, fontPt: 16, lineWidthPt: 2 },
];

export interface Settings {
  /** Values over time, or their distribution over the production region. */
  view: "time" | "distribution";
  units: UnitPrefs;
  widthIn: number;
  heightIn: number;
  fontPt: number;
  lineWidthPt: number;
  smooth: number;
  showRaw: boolean;
  aggregate: boolean;
  fullRes: boolean;
  region: "auto" | "manual";
  from: string;
  to: string;
  markEquilibration: boolean;
  shade: boolean;
  title: string;
  xLabel: string;
  yLabels: Record<string, string>;
  legend: LegendPosition;
  frame: boolean;
  grid: boolean;
  yFromZero: boolean;
  panelLabels: boolean;
  merge: boolean;
}

const { id: _id, label: _label, title: _title, ...firstPreset } = PRESETS[0];

export const DEFAULT_SETTINGS: Settings = {
  view: "time",
  units: DEFAULT_UNITS,
  ...firstPreset,
  smooth: 0,
  showRaw: true,
  aggregate: false,
  fullRes: false,
  region: "auto",
  from: "",
  to: "",
  markEquilibration: true,
  shade: false,
  title: "",
  xLabel: "",
  yLabels: {},
  legend: "auto",
  frame: true,
  grid: false,
  yFromZero: false,
  panelLabels: true,
  merge: false,
};

// Labels and ranges belong to one figure; everything else is a preference worth remembering.
const TRANSIENT: (keyof Settings)[] = ["title", "xLabel", "yLabels", "from", "to", "region"];
const KEY = "mdlens:settings";

function load(): Settings {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage can be unavailable (private mode); start from the defaults.
    return DEFAULT_SETTINGS;
  }
  try {
    return parseSavedSettings(raw);
  } catch (err) {
    console.warn("Ignoring unreadable saved settings", err);
    return DEFAULT_SETTINGS;
  }
}

/** Saved preferences merged over the defaults. Throws if the stored text is not JSON. */
export function parseSavedSettings(raw: string | null): Settings {
  const saved = JSON.parse(raw ?? "{}");
  return { ...DEFAULT_SETTINGS, ...saved, units: { ...DEFAULT_UNITS, ...saved.units } };
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState(load);
  useEffect(() => {
    try {
      const keep = Object.fromEntries(Object.entries(settings).filter(([k]) => !TRANSIENT.includes(k as keyof Settings)));
      localStorage.setItem(KEY, JSON.stringify(keep));
    } catch {
      // Storage can be unavailable (private mode); preferences then last for the session.
    }
  }, [settings]);
  return [settings, (patch) => setSettings((s) => ({ ...s, ...patch }))];
}

export type ThemeMode = "system" | "light" | "dark";

export function useTheme(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem("mdlens:theme") as ThemeMode) || "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", mode === "dark" || (mode === "system" && mq.matches));
    apply();
    mq.addEventListener("change", apply);
    try {
      localStorage.setItem("mdlens:theme", mode);
    } catch {
      // Not critical.
    }
    return () => mq.removeEventListener("change", apply);
  }, [mode]);
  return [mode, setMode];
}
