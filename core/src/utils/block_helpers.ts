import type { Block } from "molrs-wasm";

/**
 * Probe the dtype of a column using the native Block.dtype() API.
 * Normalises "string" → "str" for backward compatibility.
 */
export function probeColumnDtype(
  block: Block,
  key: string,
): "f32" | "i32" | "u32" | "str" | undefined {
  const raw = block.dtype(key);
  if (raw === undefined) return undefined;
  if (raw === "string") return "str";
  if (raw === "f32" || raw === "i32" || raw === "u32") return raw;
  return undefined;
}
