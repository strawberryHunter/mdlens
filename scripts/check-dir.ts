// Parses every MD output file under a directory and reports what was recognised.
// Usage: npm run check-dir -- ~/simulations
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseFile } from "../src/lib/formats/detect";

const root = process.argv[2] ?? ".";
const MAX_BYTES = 200 * 1024 * 1024;
const CANDIDATE = /\.(xvg|log|out|mdout|csv|dat|colvar)$|^log\.lammps|^COLVAR|^mdout/i;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && !entry.name.startsWith(".")) yield* walk(path);
    } else if (CANDIDATE.test(entry.name)) yield path;
  }
}

const byEngine = new Map<string, number>();
const examples = new Map<string, string[]>();
const empty: string[] = [];
const notes: string[] = [];
const failed: string[] = [];
let longest = 0;

for (const path of walk(root)) {
  const rel = relative(root, path);
  if (statSync(path).size > MAX_BYTES) continue;
  try {
    const d = parseFile(path, readFileSync(path, "utf8"));
    // Generic tables found in arbitrary .log/.out files are noise, not MD output.
    if (d.engine === "Table" && !/\.(csv|dat)$/i.test(path)) continue;
    if (!d.quantities.length) {
      if (d.engine !== "Table") empty.push(`${rel} (${d.engine})`);
      continue;
    }
    byEngine.set(d.engine, (byEngine.get(d.engine) ?? 0) + 1);
    if ((examples.get(d.engine)?.length ?? 0) < 2) examples.set(d.engine, [...(examples.get(d.engine) ?? []), rel]);
    for (const q of d.quantities) longest = Math.max(longest, q.x.length);
    for (const n of d.notes) notes.push(`${rel}: ${n}`);
  } catch (err) {
    failed.push(`${rel}: ${(err as Error).message}`);
  }
}

const list = (title: string, items: string[]) => {
  if (!items.length) return;
  console.log(`\n${title} (${items.length}):`);
  for (const i of items.slice(0, 12)) console.log(`  ${i}`);
  if (items.length > 12) console.log(`  … ${items.length - 12} more`);
};

console.log("Files with data by engine:");
for (const [engine, n] of byEngine) console.log(`  ${engine.padEnd(8)} ${String(n).padStart(6)}   e.g. ${examples.get(engine)?.join(", ")}`);
console.log(`Longest series: ${longest} points`);
list("Recognised but no data", empty);
list("Notes", notes);
list("Errors", failed);
