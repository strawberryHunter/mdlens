import type { Dataset } from "../dataset";
import { parseAmberMdout } from "./amber";
import { parseCharmmOut } from "./charmm";
import { parseLammpsLog } from "./lammps";
import { parseNamdLog } from "./namd";
import { parseTable } from "./table";
import { xvgDataset } from "./xvg";

/** Recognises the engine from the file contents (the name is only a tie-breaker) and parses it. */
export function parseFile(name: string, text: string): Dataset {
  const head = text.slice(0, 1_000_000);
  if (/^DYNA DYN:/m.test(head)) return parseCharmmOut(text);
  if (/^ETITLE:/m.test(text)) return parseNamdLog(text);
  if (/NSTEP\s*=\s*\d+\s+TIME\(PS\)/.test(head)) return parseAmberMdout(text);
  if (/^LAMMPS \(/m.test(head) || /^Loop time of /m.test(text)) return parseLammpsLog(text);
  if (/^@\s*(title|xaxis|yaxis|TYPE|s\d+\s+legend)/m.test(head) || /\.xvg$/i.test(name)) return xvgDataset(text);
  return parseTable(text);
}

/** File extensions offered in the open dialog. Detection itself does not depend on them. */
export const ACCEPT = ".xvg,.log,.out,.mdout,.csv,.dat,.txt,.lammps,.colvar";
