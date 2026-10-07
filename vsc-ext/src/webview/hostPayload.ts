/**
 * Resolve one `loadFile` payload into the shape the reader wants.
 *
 * Text formats cross the host channel as raw **bytes**: the extension host
 * does not build a whole-file JS string for the IPC frame (on Remote-SSH that
 * string is what crosses the network). The decode therefore happens here,
 * once, next to the parser.
 */

import type { MolecularFilePayload } from "../protocol";
import { asHostBytes } from "./hostRangeSource";
import { normalizeMrecPayload } from "./mrecPayload";

/**
 * @param decodeAsText whether the resolved format reads text (the caller owns
 *   the format registry lookup — `isBinaryFormat`).
 */
export function hostPayload(
  content: MolecularFilePayload,
  decodeAsText: boolean,
): MolecularFilePayload {
  if (typeof content === "string") return content;
  if (decodeAsText) {
    const bytes = asHostBytes(content);
    if (bytes) return new TextDecoder("utf-8").decode(bytes);
  }
  if (content instanceof Uint8Array) return content;
  return normalizeMrecPayload(content);
}
