# MDLens

Browser app that reads MD engine output (GROMACS, NAMD, OpenMM, CHARMM, LAMMPS, AMBER, PLUMED), detects equilibration, reports production statistics, and exports publication figures. Static site, no server. React + TypeScript + Vite + Tailwind; figures drawn with Observable Plot.

## Commands

- `npm test`: unit tests (Vitest). Run before saying "done" and show the output.
- `npx tsc`: typecheck. `npm run build`: production build into `dist/`.
- `npm run check-dir -- <folder>`: parse every MD file under a folder and report counts, notes and errors. Run on real data after any parser change.
- `npm run samples`: regenerate `public/samples` (deterministic, seeded).
- `npm run validate`: compare the statistics with the pymbar reference values. Regenerate them with `conda run -n mdlens-ref python validation/make_reference.py` (environment in `validation/environment.yml`).
- `validation/messy/`: damaged real-world files; any parser change must keep `src/lib/formats/messy.test.ts` passing.

## Layout

- `src/lib/`: parsers (`formats/`), units, statistics, workspace model, figure building. No DOM dependency except `figure.ts` and `export.ts`, which accept an injected `document`. Every function here needs a test.
- `src/components/`, `src/App.tsx`, `src/settings.ts`: UI.

## Rules

- Before writing code, state your plan in 3–5 bullets and list the files you will touch.
- For non-trivial work, first reply with (1) your understanding of the requirement, (2) the implementation plan, (3) expected edge cases and failure modes, (4) what you will NOT change, (5) anything you are unsure about. Wait for approval before writing code.
- Do not change public APIs, function signatures, or file formats unless asked. Here that means the `Dataset`/`Quantity` shapes, exported signatures in `src/lib`, and exported file formats (SVG, PNG, CSV).
- Never silently swallow errors. No empty `catch {}`; fail loudly with context, or surface the problem to the user (`Dataset.notes`, a toast). The one exception is optional browser storage (`localStorage`), which can be unavailable; catch it with a comment explaining the fallback.
- Do not invent library functions or parameters. Check the installed version's types or source in `node_modules` (or the Python package source) first.
- Keep diffs minimal. No drive-by refactoring or reformatting of unrelated code.
- Every new function gets at least one test. Run tests before saying "done".
- If a requirement is ambiguous, ask instead of guessing.
- When you say something works, show the command you ran and its output.

## Scientific rules

- State units explicitly for every physical quantity. Parsers record the engine's own unit in `Quantity.unit`; conversion happens only for display, in `units.ts`. Never convert inside a parser.
- Engine conventions: GROMACS nm, ps, kJ/mol, bar. NAMD Å, fs timestep, kcal/mol, bar. CHARMM Å, ps, kcal/mol, atm. AMBER Å, ps, kcal/mol, bar. OpenMM nm, ps, kJ/mol. LAMMPS depends on the `units` style.
- Validate any analysis on a reference case with a known answer before trusting it on real data (for example AR(1) noise, whose statistical inefficiency is (1+φ)/(1−φ), or the pymbar reference implementation for equilibration detection).
- When a parser drops lines or values, report it in `Dataset.notes` with counts. Print counts (files, rows, quantities) when checking real data.
- Flag in the summary any change to how values are computed (statistics, unit factors, equilibration detection, downsampling of exported data).
