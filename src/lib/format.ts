/** Compact number for tables and copying: 4 significant digits, exponent for extremes. */
export function fmt(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a >= 1e6 || (a < 1e-3 && v !== 0)) return v.toExponential(2);
  return String(Number(v.toPrecision(digits)));
}

/**
 * Mean and uncertainty rounded the way papers report them: the uncertainty to one
 * significant digit (two when it starts with 1), the mean to the same decimal place.
 */
export function roundPM(mean: number, err: number): [string, string] {
  if (!Number.isFinite(mean) || !Number.isFinite(err) || err <= 0) return [fmt(mean), fmt(err)];
  const exp = Math.floor(Math.log10(err));
  const decimals = Math.max(0, (err / 10 ** exp < 2 ? 1 : 0) - exp);
  if (decimals > 8 || exp > 6) return [fmt(mean), fmt(err)];
  // toFixed keeps the sign of values that round to zero ("-0"); papers write "0".
  const m = mean.toFixed(decimals).replace(/^-(0(\.0+)?)$/, "$1");
  return [m, err.toFixed(decimals)];
}

export function pm(mean: number, err: number, unit = ""): string {
  const [m, e] = roundPM(mean, err);
  return `${m} ± ${e}${unit ? ` ${unit}` : ""}`;
}
