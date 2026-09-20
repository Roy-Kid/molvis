/**
 * How the VS Code host should open a molecular file.
 *
 * Streamable trajectories use `open-uri` so the webview can `readRange`
 * instead of copying the whole file through postMessage.
 */

import {
  decideIngest,
  type FileFormat,
  TRAJECTORY_WHOLE_FILE_CAP_BYTES,
} from "@molcrafts/molvis-stage/io/formats";

export type MolecularLoadIntent =
  | { action: "open-uri" }
  | { action: "read-bytes" }
  | { action: "refuse"; reason: string };

/**
 * Route a VS Code open. `hostCanRange` is always true for `file:` after
 * this module exists — callers still pass size in **bytes**.
 */
export function decideMolecularLoadIntent(
  format: FileFormat | undefined,
  byteLength: number,
): MolecularLoadIntent {
  if (!format) {
    if (byteLength >= TRAJECTORY_WHOLE_FILE_CAP_BYTES) {
      return {
        action: "refuse",
        reason: `Cannot load ${(byteLength / (1024 * 1024)).toFixed(0)} MB without a format: the host would copy the whole file into memory.`,
      };
    }
    return { action: "read-bytes" };
  }
  const decision = decideIngest(format, byteLength, { hostCanRange: true });
  if (decision.path === "refuse") {
    return { action: "refuse", reason: decision.reason };
  }
  if (decision.path === "stream") {
    return { action: "open-uri" };
  }
  return { action: "read-bytes" };
}
