// Grace (xmgrace) text escapes, as written by GROMACS into .xvg labels, converted to plain Unicode.
//   \S superscript   \s subscript   \N back to normal
//   \x Symbol font (Greek)   \f{} back to the default font   \\ literal backslash
// Unicode only has super/subscripts for some characters, so a run that cannot be fully
// converted is kept as plain text rather than half-converted.

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ",
};

const SUBSCRIPT: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ",
  r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

// Adobe Symbol font layout: Latin letters map to their Greek counterparts.
const SYMBOL: Record<string, string> = {
  a: "α", b: "β", c: "χ", d: "δ", e: "ε", f: "φ", g: "γ", h: "η", i: "ι", j: "ϕ", k: "κ", l: "λ", m: "μ",
  n: "ν", o: "ο", p: "π", q: "θ", r: "ρ", s: "σ", t: "τ", u: "υ", v: "ϖ", w: "ω", x: "ξ", y: "ψ", z: "ζ",
  A: "Α", B: "Β", C: "Χ", D: "Δ", E: "Ε", F: "Φ", G: "Γ", H: "Η", I: "Ι", K: "Κ", L: "Λ", M: "Μ",
  N: "Ν", O: "Ο", P: "Π", Q: "Θ", R: "Ρ", S: "Σ", T: "Τ", U: "Υ", W: "Ω", X: "Ξ", Y: "Ψ", Z: "Ζ",
};

type Mode = "normal" | "sup" | "sub";

export function graceToUnicode(input: string): string {
  if (!input.includes("\\")) return input;

  let out = "";
  let run = "";
  let mode: Mode = "normal";
  let symbol = false;

  const flush = () => {
    const table = mode === "sup" ? SUPERSCRIPT : mode === "sub" ? SUBSCRIPT : null;
    const chars = [...run];
    out += table && chars.every((c) => c in table) ? chars.map((c) => table[c]).join("") : run;
    run = "";
  };

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c !== "\\" || i === input.length - 1) {
      run += symbol ? (SYMBOL[c] ?? c) : c;
      continue;
    }
    const code = input[++i];
    switch (code) {
      case "S":
        flush();
        mode = "sup";
        break;
      case "s":
        flush();
        mode = "sub";
        break;
      case "N":
        flush();
        mode = "normal";
        break;
      case "x":
        symbol = true;
        break;
      case "f": {
        // \f{name} or \f{} (reset). Grace font 12 is Symbol.
        if (input[i + 1] === "{") {
          const end = input.indexOf("}", i);
          const name = end === -1 ? "" : input.slice(i + 2, end);
          symbol = /^symbol$/i.test(name) || name === "12";
          i = end === -1 ? input.length : end;
        } else {
          symbol = false;
        }
        break;
      }
      case "\\":
        run += "\\";
        break;
      default:
        // Size, underline, overline, kerning, etc. have no plain-text equivalent.
        break;
    }
  }
  flush();
  return out;
}
