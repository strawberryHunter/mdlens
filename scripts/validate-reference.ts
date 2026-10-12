// Compares MDLens's statistics with the pymbar reference values in
// src/lib/__fixtures__/pymbar_reference.json and prints a table.
// Usage: npm run validate
import { readFileSync } from "node:fs";
import { detectEquilibration, statisticalInefficiency, summarize } from "../src/lib/stats";

interface Case {
  y: number[];
  g_fast: number;
  t0: number;
  neff: number;
  production_mean: number;
  production_se: number;
}

const reference = JSON.parse(readFileSync(new URL("../src/lib/__fixtures__/pymbar_reference.json", import.meta.url), "utf8")) as {
  pymbar: string;
  cases: Record<string, Case>;
};

console.log(`pymbar ${reference.pymbar} vs MDLens\n`);
console.log(
  ["case".padEnd(24), "g rel.diff", "t0 pymbar", "t0 ours", "t0 exhaustive", "mean pymbar", "mean ours", "Δmean/SE", "SE rel.diff"].join("  "),
);
for (const [name, c] of Object.entries(reference.cases)) {
  const x = c.y.map((_, i) => i);
  const g = statisticalInefficiency(c.y);
  const ours = summarize(x, c.y);
  const full = detectEquilibration(x, c.y, c.y.length, c.y.length).start;
  const atReference = summarize(x, c.y, { from: c.t0, to: Infinity });
  console.log(
    [
      name.padEnd(24),
      ((g - c.g_fast) / c.g_fast).toExponential(1).padStart(10),
      String(c.t0).padStart(9),
      String(ours.from).padStart(7),
      String(full).padStart(12),
      c.production_mean.toPrecision(6).padStart(11),
      ours.mean.toPrecision(6).padStart(9),
      ((ours.mean - c.production_mean) / c.production_se).toFixed(2).padStart(8),
      ((atReference.se - c.production_se) / c.production_se).toExponential(1).padStart(11),
    ].join("  "),
  );
}
