import type { Frame } from "@molcrafts/molvis-core/molrs";
import { BaseModifier, ModifierCapability } from "../pipeline/modifier";
import type { PipelineContext } from "../pipeline/types";
import { SelectionMask } from "../pipeline/types";
import { DType } from "../utils/dtype";

/**
 * OVITO-style **Select Type**: select atoms by `element` and/or `type`
 * column membership. Empty `elements` and `types` selects nothing
 * (does not select-all). Matching is case-sensitive for element strings;
 * type values are stringified for comparison across str/i32/u32 columns.
 *
 * Does not reimplement the expression evaluator — a dedicated multi-select
 * API for hard-coded unit tests and a future property panel.
 */
export class SelectTypeModifier extends BaseModifier {
  static readonly NAME = "Select Type";

  private _elements: string[] = [];
  private _types: string[] = [];

  constructor(id = "select-type-default") {
    super(
      id,
      SelectTypeModifier.NAME,
      new Set([ModifierCapability.ProducesSelection]),
    );
  }

  get elements(): readonly string[] {
    return this._elements;
  }

  set elements(value: readonly string[]) {
    this._elements = [...value];
  }

  get types(): readonly string[] {
    return this._types;
  }

  set types(value: readonly string[]) {
    this._types = [...value];
  }

  getCacheKey(): string {
    return `${super.getCacheKey()}:${this._elements.join(",")}:${this._types.join(",")}`;
  }

  apply(input: Frame, context: PipelineContext): Frame {
    const atoms = input.getBlock("atoms");
    if (!atoms) {
      context.currentSelection = SelectionMask.none(0);
      context.selectionSet.set(this.id, context.currentSelection);
      return input;
    }

    const n = atoms.nrows();
    if (this._elements.length === 0 && this._types.length === 0) {
      const empty = SelectionMask.none(n);
      context.currentSelection = empty;
      context.selectionSet.set(this.id, empty);
      return input;
    }

    const elementSet =
      this._elements.length > 0 ? new Set(this._elements) : null;
    const typeSet = this._types.length > 0 ? new Set(this._types) : null;

    const elements =
      elementSet && atoms.dtype("element")
        ? (atoms.copyColStr("element") as string[])
        : null;
    const typeStrings = typeSet ? readTypeColumnAsStrings(atoms, n) : null;

    const indices: number[] = [];
    for (let i = 0; i < n; i++) {
      let hit = false;
      if (elementSet && elements && elementSet.has(elements[i])) hit = true;
      if (!hit && typeSet && typeStrings && typeSet.has(typeStrings[i])) {
        hit = true;
      }
      if (hit) indices.push(i);
    }

    const mask = SelectionMask.fromIndices(n, indices);
    context.currentSelection = mask;
    context.selectionSet.set(this.id, mask);
    return input;
  }
}

/** Stringify `atoms.type` whether stored as str / i32 / u32. Missing → "". */
function readTypeColumnAsStrings(
  atoms: {
    dtype: (name: string) => string | undefined;
    copyColStr: (name: string) => string[] | undefined;
    viewColI32: (name: string) => Int32Array | undefined;
    viewColU32: (name: string) => Uint32Array | undefined;
  },
  n: number,
): string[] {
  const dtype = atoms.dtype("type");
  if (!dtype) return Array.from({ length: n }, () => "");
  if (dtype === DType.String) {
    const src = atoms.copyColStr("type") as string[] | undefined;
    if (!src) return Array.from({ length: n }, () => "");
    return src.map((v) => String(v));
  }
  if (dtype === DType.I32) {
    const src = atoms.viewColI32("type");
    if (!src) return Array.from({ length: n }, () => "");
    return Array.from(src, (v) => String(v));
  }
  if (dtype === DType.U32) {
    const src = atoms.viewColU32("type");
    if (!src) return Array.from({ length: n }, () => "");
    return Array.from(src, (v) => String(v));
  }
  return Array.from({ length: n }, () => "");
}
