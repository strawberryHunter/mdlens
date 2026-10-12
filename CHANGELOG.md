# Changelog

## v0.3.0 — 2026-10-12

First tagged release.

### Added
- Blocking standard error (Flyvbjerg–Petersen, Wolff/Lee block size) next to the autocorrelation-corrected SE; flagged when the two disagree by more than 2×.
- Distribution view: histogram (numpy `bins="auto"`) and Gaussian KDE (Scott's rule) of the production region, each panel with its own x axis. CSV export of the distributions.
- Guide page (`#guide`) and a demo GIF in the README.
- Exported SVG (`<desc>`) and PNG (`tEXt` Software) record the MDLens version that made them.
- Contributing guide, issue templates and a pull-request checklist.

### Changed
- Files are parsed and analysed in a Web Worker, so large logs no longer freeze the page.
- Equilibration detection tries every frame as a start for runs of up to 2000 frames and reproduces pymbar's `detect_equilibration`.

### Fixed
- Figures with mixed x axes (time and steps) now keep only one kind, with a warning.
- Runs whose temperature turns NaN are flagged as unstable; later frames are left out of the statistics.
- AMBER: `DV/DL` is read as dV/dλ; TI output is read once per step.
- Long y labels no longer overlap panel letters; unit selectors have correct accessible names.

## v0.2 — 2026-10-12

Multi-engine dashboard: GROMACS, NAMD, OpenMM, CHARMM, LAMMPS, AMBER and PLUMED detection, unit conversion across engines, equilibration detection (Chodera 2016), autocorrelation-corrected errors, stacked figures, validation against pymbar.

## v0.1 — 2026-10-12

GROMACS `.xvg` plotter with replica mean ± SD, unit conversion and publication export.
