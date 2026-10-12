import { Github, Lock, Monitor, Moon, Sun, Upload } from "lucide-react";
import type { ThemeMode } from "../settings";
import { Button, IconButton } from "./ui";

export const REPO_URL = "https://github.com/strawberryHunter/mdlens";

const NEXT: Record<ThemeMode, ThemeMode> = { system: "light", light: "dark", dark: "system" };

export function Logo() {
  return (
    <span className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-accent to-accent2 shadow-sm shadow-accent/30">
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="white" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17c2.5 0 3-10 6-10s3 7 5.5 7S17 9 21 9" />
      </svg>
    </span>
  );
}

export function TopBar({ theme, onTheme, onOpen, onHome }: { theme: ThemeMode; onTheme: (m: ThemeMode) => void; onOpen: () => void; onHome: () => void }) {
  const ThemeIcon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-3 px-4">
        <button type="button" onClick={onHome} className="flex items-center gap-2.5" aria-label="MDLens home">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight text-ink">MDLens</span>
          <span className="rounded-full border border-line px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-muted">beta</span>
        </button>
        <div className="flex-1" />
        <span className="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] text-muted md:inline-flex" title="Files are read by your browser. Nothing is uploaded.">
          <Lock className="size-3" /> Runs locally · nothing uploaded
        </span>
        <IconButton label={`Theme: ${theme}`} onClick={() => onTheme(NEXT[theme])}>
          <ThemeIcon className="size-4" />
        </IconButton>
        <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Source on GitHub" title="Source on GitHub" className="inline-grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink">
          <Github className="size-4" />
        </a>
        <Button variant="primary" size="sm" icon={<Upload className="size-3.5" />} onClick={onOpen}>
          Open files
        </Button>
      </div>
    </header>
  );
}
