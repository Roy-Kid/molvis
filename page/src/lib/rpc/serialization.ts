/**
 * Binary payload decoding and Frame/Box construction for the standalone
 * WebSocket bridge.
 *
 * This is an adapted copy of `python/src/ts/serialization.ts` that
 * works without anywidget dependencies.
 */

import { Box, Frame } from "@molcrafts/molrs";
import type {
  BinaryBufferRef,
  SerializedBoxData,
  SerializedFrameData,
} from "./types";

type BinaryTypedArray = (
  | Float32Array
  | Float64Array
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | BigInt64Array
  | BigUint64Array
) & {
  __molvisShape?: number[];
  __molvisDtype?: string;
};

const BUFFER_REF_MARKER = "__molvis_buffer__";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBinaryBufferRef(value: unknown): value is BinaryBufferRef {
  return isPlainObject(value) && value[BUFFER_REF_MARKER] === true;
}

function product(shape: number[]): number {
  return shape.reduce((acc, dim) => acc * dim, 1);
}

function normalizeDtype(dtype: string): string {
  return dtype.replace(/^([<>=|])/, "");
}

function attachArrayMetadata<T extends BinaryTypedArray>(
  array: T,
  dtype: string,
  shape: number[],
): T {
  array.__molvisDtype = dtype;
  array.__molvisShape = [...shape];
  return array;
}

function toArrayBuffer(view: DataView, itemSize: number): ArrayBuffer {
  if (view.byteOffset % itemSize === 0) {
    return view.buffer as ArrayBuffer;
  }
  return (view.buffer as ArrayBuffer).slice(
    view.byteOffset,
    view.byteOffset + view.byteLength,
  );
}

function createTypedArray(
  ref: BinaryBufferRef,
  buffer: DataView,
): BinaryTypedArray {
  const normalized = normalizeDtype(ref.dtype);
  const shape = ref.shape ?? [];

  const factories: Record<
    string,
    {
      itemSize: number;
      build: (
        source: ArrayBufferLike,
        offset: number,
        length: number,
      ) => BinaryTypedArray;
    }
  > = {
    f4: {
      itemSize: 4,
      build: (source, offset, length) =>
        new Float32Array(source, offset, length) as BinaryTypedArray,
    },
    f8: {
      itemSize: 8,
      build: (source, offset, length) =>
        new Float64Array(source, offset, length) as BinaryTypedArray,
    },
    i1: {
      itemSize: 1,
      build: (source, offset, length) =>
        new Int8Array(source, offset, length) as BinaryTypedArray,
    },
    u1: {
      itemSize: 1,
      build: (source, offset, length) =>
        new Uint8Array(source, offset, length) as BinaryTypedArray,
    },
    b1: {
      itemSize: 1,
      build: (source, offset, length) =>
        new Uint8Array(source, offset, length) as BinaryTypedArray,
    },
    i2: {
      itemSize: 2,
      build: (source, offset, length) =>
        new Int16Array(source, offset, length) as BinaryTypedArray,
    },
    u2: {
      itemSize: 2,
      build: (source, offset, length) =>
        new Uint16Array(source, offset, length) as BinaryTypedArray,
    },
    i4: {
      itemSize: 4,
      build: (source, offset, length) =>
        new Int32Array(source, offset, length) as BinaryTypedArray,
    },
    u4: {
      itemSize: 4,
      build: (source, offset, length) =>
        new Uint32Array(source, offset, length) as BinaryTypedArray,
    },
    i8: {
      itemSize: 8,
      build: (source, offset, length) =>
        new BigInt64Array(source, offset, length) as BinaryTypedArray,
    },
    u8: {
      itemSize: 8,
      build: (source, offset, length) =>
        new BigUint64Array(source, offset, length) as BinaryTypedArray,
    },
  };

  const factory = factories[normalized];
  if (!factory) {
    throw new Error(`Unsupported numpy dtype '${ref.dtype}'`);
  }

  const totalItems =
    shape.length > 0 ? product(shape) : buffer.byteLength / factory.itemSize;
  const source = toArrayBuffer(buffer, factory.itemSize);
  const offset = source === buffer.buffer ? buffer.byteOffset : 0;
  return attachArrayMetadata(
    factory.build(source, offset, totalItems),
    ref.dtype,
    shape,
  );
}

export function decodeBinaryPayload(
  value: unknown,
  buffers: DataView[] = [],
): unknown {
  if (isBinaryBufferRef(value)) {
    const index = Number(value.index);
    if (!Number.isInteger(index) || index < 0 || index >= buffers.length) {
      throw new Error(`Invalid binary buffer reference index '${value.index}'`);
    }
    return createTypedArray(value, buffers[index]);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => decodeBinaryPayload(entry, buffers));
  }

  if (isPlainObject(value)) {
    const decoded: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      decoded[key] = decodeBinaryPayload(entry, buffers);
    }
    return decoded;
  }

  return value;
}

function isStringArray(value: unknown[]): value is string[] {
  return value.every((item) => typeof item === "string");
}

function isBooleanArray(value: unknown[]): value is boolean[] {
  return value.every((item) => typeof item === "boolean");
}

function isNumberArray(value: unknown[]): value is number[] {
  return value.every(
    (item) => typeof item === "number" && Number.isFinite(item),
  );
}

function isIntegerArray(value: number[]): boolean {
  return value.every((item) => Number.isInteger(item));
}

function assignColumn(
  block: ReturnType<Frame["createBlock"]>,
  key: string,
  value: unknown,
): void {
  if (value == null) {
    return;
  }

  if (ArrayBuffer.isView(value)) {
    if (value instanceof Float32Array) {
      block.setColF(key, Float64Array.from(value));
      return;
    }
    if (value instanceof Float64Array) {
      block.setColF(key, value);
      return;
    }
    if (value instanceof Uint32Array) {
      block.setColU32(key, value);
      return;
    }
    if (
      value instanceof Int8Array ||
      value instanceof Uint8Array ||
      value instanceof Int16Array ||
      value instanceof Uint16Array ||
      value instanceof Int32Array
    ) {
      block.setColU32(key, Uint32Array.from(value, Number));
      return;
    }
    if (value instanceof BigInt64Array || value instanceof BigUint64Array) {
      block.setColU32(key, Uint32Array.from(Array.from(value, Number)));
      return;
    }

    throw new Error(`Column '${key}' uses an unsupported typed-array payload`);
  }

  if (!Array.isArray(value)) {
    throw new Error(`Column '${key}' must be an array or typed array`);
  }

  if (value.length === 0) {
    block.setColF(key, new Float64Array());
    return;
  }

  if (isStringArray(value)) {
    block.setColStr(key, value);
    return;
  }

  if (isBooleanArray(value)) {
    block.setColU32(
      key,
      Uint32Array.from(value, (item) => (item ? 1 : 0)),
    );
    return;
  }

  if (isNumberArray(value)) {
    if (isIntegerArray(value) && value.every((item) => item >= 0)) {
      block.setColU32(key, Uint32Array.from(value));
      return;
    }
    block.setColF(key, Float64Array.from(value));
    return;
  }

  throw new Error(`Column '${key}' contains unsupported values`);
}

function getColumnLength(key: string, value: unknown): number {
  if (value == null) {
    return 0;
  }
  if (ArrayBuffer.isView(value)) {
    return (value as unknown as { length: number }).length;
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  throw new Error(`Column '${key}' must be an array or typed array`);
}

function validateBlock(
  blockName: string,
  columns: Record<string, unknown>,
): void {
  const lengths = new Set<number>();
  for (const [columnName, value] of Object.entries(columns)) {
    if (value == null) {
      continue;
    }
    lengths.add(getColumnLength(columnName, value));
  }

  if (lengths.size > 1) {
    throw new Error(`Block '${blockName}' has inconsistent column lengths`);
  }

  if (blockName === "atoms") {
    for (const columnName of ["x", "y", "z"]) {
      if (!(columnName in columns)) {
        throw new Error(
          `Atoms block is missing required '${columnName}' column`,
        );
      }
    }
    for (const alias of ["symbol", "species"]) {
      if (alias in columns && !("element" in columns)) {
        columns.element = columns[alias];
        delete columns[alias];
        break;
      }
    }
    if (!("element" in columns) && !("type" in columns)) {
      throw new Error("Atoms block must include either 'element' or 'type'");
    }
  }

  if (blockName === "bonds" && Object.keys(columns).length > 0) {
    // Accept both short ("i"/"j") and canonical ("atomi"/"atomj") names.
    // Normalize short names to canonical form for the core renderer.
    const bondAliases: Record<string, string> = { i: "atomi", j: "atomj" };
    for (const [alias, canonical] of Object.entries(bondAliases)) {
      if (alias in columns && !(canonical in columns)) {
        columns[canonical] = columns[alias];
        delete columns[alias];
      }
    }
    for (const columnName of ["atomi", "atomj"]) {
      if (!(columnName in columns)) {
        throw new Error(
          `Bonds block is missing required '${columnName}' column`,
        );
      }
    }
  }
}

export function buildFrame(frameData: SerializedFrameData): Frame {
  if (!frameData || typeof frameData !== "object") {
    throw new Error("Frame payload must be an object");
  }
  if (!frameData.blocks || typeof frameData.blocks !== "object") {
    throw new Error("Frame payload must include a 'blocks' object");
  }

  const frame = new Frame();
  for (const [blockName, columns] of Object.entries(frameData.blocks ?? {})) {
    if (!isPlainObject(columns)) {
      throw new Error(`Block '${blockName}' must be an object`);
    }
    validateBlock(blockName, columns);
    const block = frame.createBlock(blockName);
    for (const [columnName, value] of Object.entries(columns ?? {})) {
      assignColumn(block, columnName, value);
    }
  }
  return frame;
}

function flattenNumbers(value: unknown): number[] {
  if (ArrayBuffer.isView(value)) {
    return Array.from(value as unknown as ArrayLike<number>, Number);
  }
  if (!Array.isArray(value)) {
    throw new Error("Expected a numeric array");
  }

  const flattened: number[] = [];
  for (const item of value) {
    if (Array.isArray(item)) {
      flattened.push(...flattenNumbers(item));
      continue;
    }
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new Error("Expected finite numeric values");
    }
    flattened.push(item);
  }
  return flattened;
}

export function buildBox(boxData: SerializedBoxData): Box {
  if (!boxData || typeof boxData !== "object") {
    throw new Error("Box payload must be an object");
  }

  const matrix = Float64Array.from(flattenNumbers(boxData.matrix));
  const origin = Float64Array.from(flattenNumbers(boxData.origin));
  const pbc = Array.isArray(boxData.pbc) ? boxData.pbc : [true, true, true];

  if (matrix.length !== 9) {
    throw new Error(
      `Expected a 3x3 box matrix, received ${matrix.length} values`,
    );
  }
  if (origin.length !== 3) {
    throw new Error(
      `Expected a box origin with 3 values, received ${origin.length}`,
    );
  }
  if (pbc.length !== 3) {
    throw new Error(
      `Expected box pbc to contain 3 booleans, received ${pbc.length}`,
    );
  }

  return new Box(
    matrix,
    origin,
    Boolean(pbc[0]),
    Boolean(pbc[1]),
    Boolean(pbc[2]),
  );
}
