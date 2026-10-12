// Runs readFiles off the main thread so large logs do not freeze the page.
import { readFiles, type FileInput } from "./readFiles";

self.onmessage = (event: MessageEvent<{ id: number; files: FileInput[] }>) => {
  const { id, files } = event.data;
  self.postMessage({ id, results: readFiles(files) });
};
