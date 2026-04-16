/**
 * Column dtype constants matching WASM `Block.dtype()` return values.
 * Use everywhere we compare against dtype strings so a typo becomes a
 * type error instead of a silent no-op.
 */
export const DType = {
  F64: "f64",
  I32: "i32",
  U32: "u32",
  String: "string",
} as const;

export type ColumnDType = (typeof DType)[keyof typeof DType];
