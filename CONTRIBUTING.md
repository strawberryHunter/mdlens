# Contributing to MDLens

Thanks for helping. The most valuable contributions are **files MDLens reads wrongly**: every one becomes a test, so the same mistake never comes back.

## Reporting a problem

- **A file is read wrongly or not recognised:** open an issue with the [file template](https://github.com/strawberryHunter/mdlens/issues/new?template=file-read-wrongly.yml) and attach the file, or a cut-down copy. Remove anything confidential first.
- **Anything else:** use the [bug or idea template](https://github.com/strawberryHunter/mdlens/issues/new?template=bug-or-idea.yml).
- **Questions about the statistics:** the [Guide](https://strawberryhunter.github.io/mdlens/#guide) explains how the production region and errors are computed.

## Development

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npx tsc            # typecheck
npm run build      # static site in dist/
```

Parsing, units and statistics live in `src/lib/` and have no DOM dependency; the UI is in `src/components/`. Files are parsed in a Web Worker (`src/lib/readFiles.worker.ts`).

## Rules for changes

- Keep diffs small and focused; no unrelated refactoring.
- Every new function gets a test. Run `npm test` before opening a pull request.
- Never swallow errors silently: show them to the user (`Dataset.notes`, a message) or fail with context.
- State units explicitly. Parsers record the engine's own unit; conversion happens only for display (`src/lib/units.ts`).
- MDLens must never send user data anywhere. Do not add analytics or network requests.

## Adding or fixing a parser

1. Put a realistic example in a test (`src/lib/formats/formats.test.ts`), or a damaged real-world file in `validation/messy/` with an entry in `messy.test.ts`.
2. Change the parser in `src/lib/formats/` (detection is in `detect.ts`). When lines or values are dropped, say so in `Dataset.notes`, with counts.
3. Run `npm run check-dir -- <folder of real outputs>` and check the counts and notes look right.

## Changing the statistics

The statistics are validated against pymbar, pyblock, numpy and scipy (`src/lib/reference.test.ts`, `npm run validate`). If you change them, regenerate the reference values and explain any difference:

```bash
conda env create -f validation/environment.yml
conda run -n mdlens-ref python validation/make_reference.py
```

## Conduct

Be kind and assume good faith. Criticise code and results, not people.
