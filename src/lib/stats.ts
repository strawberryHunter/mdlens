/** Centered moving average over `window` points; the window shrinks at the edges. NaNs are skipped. */
export function movingAverage(y: ArrayLike<number>, window: number): number[] {
  const n = y.length;
  const w = Math.max(1, Math.round(window));
  if (w <= 1) return Array.from(y);

  const sum = new Float64Array(n + 1);
  const count = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const ok = Number.isFinite(y[i]);
    sum[i + 1] = sum[i] + (ok ? y[i] : 0);
    count[i + 1] = count[i] + (ok ? 1 : 0);
  }

  const half = Math.floor(w / 2);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n, i - half + w);
    const c = count[hi] - count[lo];
    out[i] = c ? (sum[hi] - sum[lo]) / c : NaN;
  }
  return out;
}

export interface RangeStats {
  n: number;
  mean: number;
  /** Sample standard deviation (n − 1). */
  sd: number;
  min: number;
  max: number;
}

/** Statistics of the finite y values whose x lies in [from, to]. */
export function rangeStats(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  from = -Infinity,
  to = Infinity,
): RangeStats {
  let n = 0;
  let mean = 0;
  let m2 = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < x.length; i++) {
    const v = y[i];
    if (x[i] < from || x[i] > to || !Number.isFinite(v)) continue;
    n++;
    const d = v - mean;
    mean += d / n;
    m2 += d * (v - mean);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return {
    n,
    mean: n ? mean : NaN,
    sd: n > 1 ? Math.sqrt(m2 / (n - 1)) : NaN,
    min: n ? min : NaN,
    max: n ? max : NaN,
  };
}

/** Mean and sample SD of a list of numbers, ignoring non-finite values. */
export function meanSd(values: number[]): { n: number; mean: number; sd: number } {
  const s = rangeStats(values, values);
  return { n: s.n, mean: s.mean, sd: s.sd };
}

/**
 * Largest-Triangle-Three-Buckets downsampling. Returns the indices of `threshold` points
 * that keep the visual shape of the line (peaks and dips survive, unlike striding).
 */
export function lttb(x: ArrayLike<number>, y: ArrayLike<number>, threshold: number): number[] {
  const n = x.length;
  if (threshold >= n || threshold < 3) return Array.from({ length: n }, (_, i) => i);

  const out = [0];
  const every = (n - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const avgStart = Math.floor((i + 1) * every) + 1;
    const avgEnd = Math.min(Math.floor((i + 2) * every) + 1, n);
    let avgX = 0;
    let avgY = 0;
    for (let j = avgStart; j < avgEnd; j++) {
      avgX += x[j];
      avgY += y[j];
    }
    avgX /= avgEnd - avgStart;
    avgY /= avgEnd - avgStart;

    const start = Math.floor(i * every) + 1;
    const end = Math.floor((i + 1) * every) + 1;
    let maxArea = -1;
    let next = start;
    for (let j = start; j < end; j++) {
      const area = Math.abs((x[a] - avgX) * (y[j] - y[a]) - (x[a] - x[j]) * (avgY - y[a]));
      if (area > maxArea) {
        maxArea = area;
        next = j;
      }
    }
    out.push(next);
    a = next;
  }
  out.push(n - 1);
  return out;
}

export interface Aggregate {
  x: number[];
  mean: number[];
  sd: number[];
}

/**
 * Point-by-point mean ± SD across series (e.g. replica simulations).
 * Returns null unless every series has the same x values.
 */
export function aggregate(list: { x: ArrayLike<number>; y: ArrayLike<number> }[]): Aggregate | null {
  if (list.length < 2) return null;
  const x0 = list[0].x;
  const n = x0.length;
  for (const s of list) {
    if (s.x.length !== n || s.y.length !== n) return null;
    for (let i = 0; i < n; i++) {
      if (Math.abs(s.x[i] - x0[i]) > 1e-6 * Math.max(1, Math.abs(x0[i]))) return null;
    }
  }

  const mean = new Array<number>(n);
  const sd = new Array<number>(n);
  const column = new Array<number>(list.length);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < list.length; k++) column[k] = list[k].y[i];
    const s = meanSd(column);
    mean[i] = s.mean;
    sd[i] = s.sd;
  }
  return { x: Array.from(x0), mean, sd };
}

function finiteSlice(x: ArrayLike<number>, y: ArrayLike<number>, maxPoints: number) {
  const stride = Math.max(1, Math.ceil(y.length / maxPoints));
  const xs: number[] = [];
  const ys: number[] = [];
  const index: number[] = [];
  for (let i = 0; i < y.length; i += stride) {
    if (Number.isFinite(y[i]) && Number.isFinite(x[i])) {
      xs.push(x[i]);
      ys.push(y[i]);
      index.push(i);
    }
  }
  return { xs, ys, index };
}

/**
 * Statistical inefficiency g = 1 + 2 Σ (1 − t/N) C(t), the number of correlated samples per
 * independent one. Follows pymbar's statisticalInefficiency(fast=True): the sum stops once the
 * autocorrelation C(t) drops to zero, and the lag grows in increasing steps.
 */
export function statisticalInefficiency(y: ArrayLike<number>, start = 0, end = y.length): number {
  const n = end - start;
  if (n < 3) return 1;
  let mean = 0;
  for (let i = start; i < end; i++) mean += y[i];
  mean /= n;
  let variance = 0;
  for (let i = start; i < end; i++) variance += (y[i] - mean) ** 2;
  variance /= n;
  if (!(variance > 0)) return 1;

  let g = 1;
  let t = 1;
  let increment = 1;
  while (t < n - 1) {
    let c = 0;
    for (let i = start; i < end - t; i++) c += (y[i] - mean) * (y[i + t] - mean);
    c /= (n - t) * variance;
    if (c <= 0 && t > 3) break;
    g += 2 * c * (1 - t / n) * increment;
    t += increment;
    increment++;
  }
  return Math.max(1, g);
}

export interface Equilibration {
  /** Index into the original arrays where production starts. */
  start: number;
  /** Effective number of uncorrelated samples after `start`. */
  neff: number;
}

/**
 * Automated equilibration detection (Chodera, J. Chem. Theory Comput. 2016, 12, 1799):
 * choose the start of production that maximises the number of uncorrelated samples left.
 * Every frame is a candidate start, as in pymbar's detect_equilibration, so runs of up to
 * `maxPoints` frames give the same answer as pymbar. Longer runs are evenly strided down to
 * `maxPoints` frames to keep the search fast (about 30 ms for 2000 frames).
 */
export function detectEquilibration(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  maxPoints = 2000,
  candidates = Infinity,
): Equilibration {
  const { ys, index } = finiteSlice(x, y, maxPoints);
  const m = ys.length;
  if (m < 10) return { start: 0, neff: m };
  const minProduction = Math.max(5, Math.floor(m * 0.1));
  const step = Math.max(1, Math.floor(m / candidates));
  let best: Equilibration = { start: 0, neff: -1 };
  for (let k = 0; m - k >= minProduction; k += step) {
    const neff = (m - k) / statisticalInefficiency(ys, k, m);
    if (neff > best.neff) best = { start: index[k], neff };
  }
  return best;
}

export interface Summary extends RangeStats {
  /** First x value of the production region. */
  from: number;
  /** Fraction of the run before production (0 when a manual range starts at the beginning). */
  equilibrationFraction: number;
  /** Standard error of the mean, corrected for autocorrelation. */
  se: number;
  /** Linear trend over the production region, in y units per x unit. */
  slope: number;
  /** Standard error from blocking (cross-check of `se`); NaN when the region is too short. */
  blockSe: number;
}

/**
 * Production-region statistics. Without a range the region starts at the automatically
 * detected end of equilibration. `until` drops frames at or after that x before anything is
 * computed (used to cut a run where it became unstable); it is ignored with a manual range.
 */
export function summarize(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  range?: { from: number; to: number },
  until = Infinity,
): Summary {
  if (!range && Number.isFinite(until)) {
    const keep: number[] = [];
    for (let i = 0; i < x.length; i++) if (x[i] < until) keep.push(i);
    return summarize(
      keep.map((i) => x[i]),
      keep.map((i) => y[i]),
    );
  }
  let from: number;
  let to = Infinity;
  if (range) {
    from = range.from;
    to = range.to;
  } else {
    const eq = detectEquilibration(x, y);
    from = x[eq.start] ?? -Infinity;
  }
  const stats = rangeStats(x, y, from, to);

  const prodX: number[] = [];
  const prodY: number[] = [];
  for (let i = 0; i < y.length; i++) {
    if (x[i] >= from && x[i] <= to && Number.isFinite(y[i])) {
      prodX.push(x[i]);
      prodY.push(y[i]);
    }
  }
  const sample = finiteSlice(prodX, prodY, 5000);
  const g = statisticalInefficiency(sample.ys);
  const se = stats.n > 1 ? stats.sd * Math.sqrt(g / sample.ys.length) : NaN;

  let sx = 0;
  let sy = 0;
  for (let i = 0; i < sample.xs.length; i++) {
    sx += sample.xs[i];
    sy += sample.ys[i];
  }
  const k = sample.xs.length;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < k; i++) {
    sxy += (sample.xs[i] - sx / k) * (sample.ys[i] - sy / k);
    sxx += (sample.xs[i] - sx / k) ** 2;
  }

  let x0 = Infinity;
  let x1 = -Infinity;
  for (let i = 0; i < x.length; i++) {
    if (x[i] < x0) x0 = x[i];
    if (x[i] > x1) x1 = x[i];
  }
  const start = Number.isFinite(from) ? Math.max(from, x0) : x0;
  return {
    ...stats,
    from: start,
    equilibrationFraction: x1 > x0 ? (start - x0) / (x1 - x0) : 0,
    se,
    slope: sxx > 0 ? sxy / sxx : NaN,
    blockSe: blockingSE(prodY).se,
  };
}

export interface BlockLevel {
  /** Frames averaged into each block (2^level). */
  blockSize: number;
  blocks: number;
  /** Standard error of the mean estimated at this block size. */
  se: number;
}

/**
 * Flyvbjerg–Petersen blocking: repeatedly average neighbouring pairs and estimate the
 * standard error at each block size. Mirrors pyblock's reblock (sample variance, odd last
 * value dropped at each level).
 */
export function reblock(values: ArrayLike<number>): BlockLevel[] {
  let data: number[] = [];
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i])) data.push(values[i]);
  const levels: BlockLevel[] = [];
  for (let level = 0; data.length >= 2; level++) {
    const n = data.length;
    let mean = 0;
    for (const v of data) mean += v;
    mean /= n;
    let ss = 0;
    for (const v of data) ss += (v - mean) ** 2;
    levels.push({ blockSize: 2 ** level, blocks: n, se: Math.sqrt(ss / (n - 1) / n) });
    const next: number[] = [];
    for (let i = 0; i + 1 < n; i += 2) next.push((data[i] + data[i + 1]) / 2);
    data = next;
  }
  return levels;
}

/**
 * Standard error from blocking, at the block size chosen by the criterion of Wolff (2004) and
 * Lee et al. (2011), B³ > 2 n (SE_B / SE_1)⁴, with pyblock's choice of the smallest block size
 * that satisfies it. NaN when no block size does: the run is too short to estimate the error.
 */
export function blockingSE(values: ArrayLike<number>): { se: number; blockSize: number } {
  const levels = reblock(values);
  if (!levels.length) return { se: NaN, blockSize: NaN };
  const n = levels[0].blocks;
  const se0 = levels[0].se;
  let best = -1;
  for (let level = levels.length - 1; level >= 0; level--) {
    if (2 ** (3 * level) > 2 * n * (levels[level].se / se0) ** 4) best = level;
  }
  return best < 0 ? { se: NaN, blockSize: NaN } : { se: levels[best].se, blockSize: levels[best].blockSize };
}

export interface Histogram {
  edges: number[];
  counts: number[];
  /** Probability density: counts / (total × bin width). */
  density: number[];
}

// numpy's linear-interpolation percentile, including its choice of lerp formula.
function percentile(sorted: number[], q: number): number {
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, sorted.length - 1);
  const t = pos - lo;
  const a = sorted[lo];
  const b = sorted[hi];
  return t >= 0.5 ? b - (b - a) * (1 - t) : a + (b - a) * t;
}

/** Evenly spaced points from start to stop inclusive, computed like numpy.linspace. */
export function linspace(start: number, stop: number, num: number): number[] {
  if (num === 1) return [start];
  const step = (stop - start) / (num - 1);
  const out = Array.from({ length: num }, (_, i) => i * step + start);
  out[num - 1] = stop;
  return out;
}

/**
 * Histogram with numpy's bins="auto" rule (numpy ≥ 2.1: the smaller of the Sturges width and
 * the Freedman–Diaconis width, the latter kept at least half the sqrt-rule width).
 */
export function histogram(values: ArrayLike<number>): Histogram {
  const a: number[] = [];
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i])) a.push(values[i]);
  const n = a.length;
  if (!n) return { edges: [0, 1], counts: [0], density: [0] };
  const sorted = [...a].sort((p, q) => p - q);
  const min = sorted[0];
  const max = sorted[n - 1];
  const ptp = max - min;
  const fd = 2 * (percentile(sorted, 0.75) - percentile(sorted, 0.25)) * n ** (-1 / 3);
  const sturges = ptp / (Math.log2(n) + 1);
  const width = Math.min(Math.max(fd, ptp / Math.sqrt(n) / 2), sturges);
  const first = ptp === 0 ? min - 0.5 : min;
  const last = ptp === 0 ? max + 0.5 : max;
  const bins = width ? Math.ceil((last - first) / width) : 1;
  const edges = linspace(first, last, bins + 1);

  const counts = new Array<number>(bins).fill(0);
  for (const v of a) {
    let i = Math.trunc(((v - first) / (last - first)) * bins);
    if (i === bins) i--;
    // Same ±1 corrections numpy applies near bin edges.
    if (v < edges[i]) i--;
    else if (v >= edges[i + 1] && i !== bins - 1) i++;
    counts[i]++;
  }
  const density = counts.map((c, i) => c / (edges[i + 1] - edges[i]) / n);
  return { edges, counts, density };
}

export interface Kde {
  x: number[];
  density: number[];
  /** Gaussian kernel width (Scott's rule), in data units. */
  bandwidth: number;
}

/**
 * Gaussian kernel density estimate with Scott's bandwidth, as scipy.stats.gaussian_kde,
 * evaluated on `points` evenly spaced values spanning the data ± 3 bandwidths.
 * Returns null when the data have no spread.
 */
export function kde(values: ArrayLike<number>, points = 200): Kde | null {
  const a: number[] = [];
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i])) a.push(values[i]);
  const n = a.length;
  if (n < 2) return null;
  const { sd } = meanSd(a);
  if (!(sd > 0)) return null;
  const bandwidth = sd * n ** (-1 / 5);
  let min = Infinity;
  let max = -Infinity;
  for (const v of a) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const x = linspace(min - 3 * bandwidth, max + 3 * bandwidth, points);
  const norm = 1 / (n * bandwidth * Math.sqrt(2 * Math.PI));
  const density = x.map((g) => {
    let s = 0;
    for (const v of a) {
      const z = (g - v) / bandwidth;
      s += Math.exp(-0.5 * z * z);
    }
    return s * norm;
  });
  return { x, density, bandwidth };
}
