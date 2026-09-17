/**
 * Webview-side shape check for an mrec `loadFile` payload.
 *
 * The host posts store path → packed `Uint8Array`. Depending on the VS Code
 * IPC path a value can arrive as `ArrayBuffer`, a view, or the `Buffer` JSON
 * shape; base64 `string` values from older hosts pass through untouched (the
 * stage loader still decodes them).
 */

import { asHostBytes } from "./hostRangeSource";

export function normalizeMrecPayload(
  content: Record<string, unknown>,
): Record<string, Uint8Array | string> {
  const files: Record<string, Uint8Array | string> = {};
  for (const [path, value] of Object.entries(content)) {
    if (typeof value === "string") {
      files[path] = value;
      continue;
    }
    const bytes = asHostBytes(value);
    if (!bytes) {
      throw new Error(`mrec store entry "${path}" was not binary`);
    }
    files[path] = bytes;
  }
  return files;
}
