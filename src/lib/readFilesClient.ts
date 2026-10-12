import { readFiles, type FileInput, type FileResult } from "./readFiles";

let worker: Worker | null | undefined;
let nextRequest = 0;
const pending = new Map<number, (results: FileResult[]) => void>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === "undefined") return (worker = null);
  try {
    worker = new Worker(new URL("./readFiles.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; results: FileResult[] }>) => {
      pending.get(event.data.id)?.(event.data.results);
      pending.delete(event.data.id);
    };
    worker.onerror = (event) => {
      // A broken worker would leave requests hanging; fail them over to the main thread.
      console.error("File reader worker failed; reading on the main thread instead.", event.message);
      worker?.terminate();
      worker = null;
      for (const [id, resolve] of pending) {
        const request = inFlight.get(id);
        if (request) resolve(readFiles(request));
        pending.delete(id);
      }
    };
  } catch (err) {
    console.error("Could not start the file reader worker; reading on the main thread instead.", err);
    worker = null;
  }
  return worker;
}

const inFlight = new Map<number, FileInput[]>();

/** Reads files in a Web Worker when available, otherwise on the main thread. */
export function readFilesAsync(files: FileInput[]): Promise<FileResult[]> {
  const w = getWorker();
  if (!w) return Promise.resolve(readFiles(files));
  const id = nextRequest++;
  inFlight.set(id, files);
  return new Promise((resolve) => {
    pending.set(id, (results) => {
      inFlight.delete(id);
      resolve(results);
    });
    w.postMessage({ id, files });
  });
}
