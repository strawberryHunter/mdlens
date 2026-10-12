"""Reference values from pymbar for MDLens's statistics tests.

Generates seeded test series, runs pymbar's timeseries functions on them, and writes
src/lib/__fixtures__/pymbar_reference.json. The JSON is committed, so the JavaScript
tests do not need Python.

    conda env create -f validation/environment.yml
    conda run -n mdlens-ref python validation/make_reference.py
"""

import json
import math
from pathlib import Path

import numpy as np
import pyblock
import pymbar
import scipy
from pymbar import timeseries
from scipy.stats import gaussian_kde

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "lib" / "__fixtures__" / "pymbar_reference.json"
NAMD_SAMPLE = ROOT / "public" / "samples" / "namd_equil.log"

rng = np.random.default_rng(20261012)


def ar1(n: int, phi: float) -> np.ndarray:
    """Unit-variance AR(1) noise; its statistical inefficiency is (1 + phi) / (1 - phi)."""
    e = np.empty(n)
    prev = 0.0
    for i, z in enumerate(rng.normal(size=n)):
        prev = phi * prev + math.sqrt(1 - phi * phi) * z
        e[i] = prev
    return e


def namd_temperature(path: Path) -> np.ndarray:
    """TEMP column of a NAMD log, read independently of the app's parser."""
    titles = None
    rows = []
    for line in path.read_text().splitlines():
        if line.startswith("ETITLE:") and titles is None:
            titles = line.split()[1:]
        elif line.startswith("ENERGY:") and titles is not None:
            rows.append([float(v) for v in line.split()[1:]])
    if titles is None:
        raise ValueError(f"No ETITLE line in {path}")
    column = titles.index("TEMP")
    return np.array([r[column] for r in rows])


n = 2000
steps = np.arange(n)
cases = {
    "white_noise": rng.normal(size=n),
    "ar1_phi_0.9": ar1(n, 0.9),
    "fast_relaxation": 10 * np.exp(-steps / 100) + 0.5 * ar1(n, 0.5),
    "slow_relaxation": 5 * np.exp(-steps / 400) + ar1(n, 0.8),
    "namd_sample_temperature": namd_temperature(NAMD_SAMPLE),
}

result = {
    "generator": "validation/make_reference.py",
    "pymbar": pymbar.__version__,
    "numpy": np.__version__,
    "scipy": scipy.__version__,
    "pyblock": getattr(pyblock, "__version__", "0.6"),
    "cases": {},
}

for name, series in cases.items():
    # Round first so JavaScript reads exactly the numbers pymbar saw.
    y = np.round(series, 10)
    t0, g_t0, neff = timeseries.detect_equilibration(y, fast=True, nskip=1)
    production = y[t0:]
    g_production = timeseries.statistical_inefficiency(production, fast=True)
    result["cases"][name] = {
        "y": y.tolist(),
        "g_fast": timeseries.statistical_inefficiency(y, fast=True),
        "g_exact": timeseries.statistical_inefficiency(y, fast=False),
        "t0": int(t0),
        "g_t0": float(g_t0),
        "neff": float(neff),
        "production_mean": float(production.mean()),
        # Same definition MDLens uses: sample SD times sqrt(g / N).
        "production_se": float(production.std(ddof=1) * math.sqrt(g_production / production.size)),
    }

    # Blocking analysis of the production region (pyblock).
    stats = pyblock.blocking.reblock(production)
    optimal = pyblock.blocking.find_optimal_block(production.size, stats)[0]
    result["cases"][name]["block_levels_se"] = [float(st.std_err) for st in stats]
    result["cases"][name]["block_optimal"] = None if math.isnan(optimal) else int(optimal)
    result["cases"][name]["block_se"] = None if math.isnan(optimal) else float(stats[optimal].std_err)

    # Distribution of the production region.
    density, edges = np.histogram(production, bins="auto", density=True)
    result["cases"][name]["hist_edges"] = edges.tolist()
    result["cases"][name]["hist_density"] = density.tolist()
    kernel = gaussian_kde(production)  # Scott's rule
    bandwidth = float(kernel.factor * production.std(ddof=1))
    grid = np.linspace(production.min() - 3 * bandwidth, production.max() + 3 * bandwidth, 200)
    result["cases"][name]["kde_bandwidth"] = bandwidth
    result["cases"][name]["kde_x"] = grid.tolist()
    result["cases"][name]["kde_density"] = kernel(grid).tolist()
    c = result["cases"][name]
    print(f"{name:26s} n={y.size:5d}  g_fast={c['g_fast']:8.3f}  t0={t0:5d}  Neff={neff:8.1f}  block={c['block_optimal']}  bins={len(c['hist_density'])}")

OUT.write_text(json.dumps(result, indent=1) + "\n")
print(f"Wrote {OUT.relative_to(ROOT)}")
