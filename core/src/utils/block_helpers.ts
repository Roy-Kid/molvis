import type { Block } from "@molcrafts/molrs";

/**
 * Probe the dtype of a column using the native Block.dtype() API.
 * Normalises `"string"` → `"str"` (rest of the keywords pass through).
 */
export function probeColumnDtype(
  block: Block,
  key: string,
): "f64" | "i32" | "u32" | "str" | undefined {
  const raw = block.dtype(key);
  if (raw === undefined) return undefined;
  if (raw === "string") return "str";
  if (raw === "f64" || raw === "i32" || raw === "u32") return raw;
  return undefined;
}
