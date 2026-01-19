import { MrBlock, PtrInfo, type InitOutput } from "molrs-wasm";

let wasmInstance: InitOutput | undefined;

export function setSystemWasm(w: InitOutput) {
  wasmInstance = w;
}

function getSystemWasm(): InitOutput {
  if (!wasmInstance) throw new Error("WASM not initialized");
  return wasmInstance;
}

export type NumKind =
  | 'float64' | 'float32'
  | 'int32' | 'uint32' | 'int16' | 'uint16' | 'int8' | 'uint8' | 'uint8c';

export type NumArray =
  | { kind: 'float64'; data: Float64Array }
  | { kind: 'float32'; data: Float32Array }
  | { kind: 'int32'; data: Int32Array }
  | { kind: 'uint32'; data: Uint32Array }
  | { kind: 'int16'; data: Int16Array }
  | { kind: 'uint16'; data: Uint16Array }
  | { kind: 'int8'; data: Int8Array }
  | { kind: 'uint8'; data: Uint8Array }
  | { kind: 'uint8c'; data: Uint8ClampedArray };

export type BoolArray = { kind: 'bool'; data: Uint8Array };
export type StrArray = { kind: 'utf8'; data: string[] };
export type BlockData = NumArray | BoolArray | StrArray;

export type DType = BlockData['kind'];
export type TypedArray = BlockData['data'];

const ctorToDtype = new Map<Function, DType>([
  [Float64Array, 'float64'],
  [Float32Array, 'float32'],
  [Int32Array, 'int32'],
  [Uint32Array, 'uint32'],
  [Int16Array, 'int16'],
  [Uint16Array, 'uint16'],
  [Int8Array, 'int8'],
  [Uint8Array, 'uint8'],
  [Uint8ClampedArray, 'uint8c'],
  [Uint8Array, 'bool'],
  [Array, 'utf8'],
]);

const isNum = (c: BlockData): c is NumArray =>
  c.kind !== 'bool' && c.kind !== 'utf8';

const lengthOf = (c: BlockData): number =>
  isNum(c) ? c.data.length : (c.kind === 'bool' ? c.data.length : c.data.length);


export class BlockError extends Error {
  static RankZero(key: string) { return new BlockError(`column '${key}' has rank 0`); }
  static Ragged(key: string, exp: number, got: number) {
    return new BlockError(`column '${key}' nrows ${got} != block nrows ${exp}`);
  }
  static NotFound(key: string) { return new BlockError(`column '${key}' not found`); }
  static TypeMismatch(key: string, exp: DType, got: DType) {
    return new BlockError(`column '${key}' type mismatch: expected ${exp}, found ${got}`);
  }
}


export class Block {
  // Backed by WASM MrBlock
  protected wasm: MrBlock;

  constructor() {
    this.wasm = new MrBlock();
  }

  static empty(): Block { return new Block(); }

  static FromCols(cols: Record<string, BlockData>): Block {
    const b = new Block();
    for (const [k, c] of Object.entries(cols)) b.set(k, c);
    return b;
  }

  static FromBlock(block: Block): Block {
    const b = new Block();
    b.adaptBlock(block);
    return b;
  }

  get nrows(): number {
    return this.wasm.nrows();
  }

  public set(key: string, col: BlockData): void;
  public set<T extends TypedArray>(key: string, col: T): void;

  public set(key: string, col: TypedArray | BlockData, dtype?: DType): void {
    let colData: BlockData;
    if ('kind' in col && 'data' in col) {
      colData = col as BlockData;
    } else {
      if (dtype) {
        colData = { kind: dtype, data: col as any };
      } else {
        const kind = ctorToDtype.get(col.constructor as Function);
        if (!kind) throw new Error(`Unsupported array type for column '${key}'`);
        colData = { kind, data: col as any };
      }
    }

    const nrows = this.nrows;
    const colLen = lengthOf(colData);
    if (nrows !== 0 && colLen !== nrows) {
      throw BlockError.Ragged(key, nrows, colLen);
    }

    // Dispatch to WASM
    switch (colData.kind) {
      case 'float32':
        this.wasm.set_col_f32(key, colData.data as Float32Array);
        break;
      case 'uint32':
        this.wasm.set_col_u32(key, colData.data as Uint32Array);
        break;
      case 'uint8':
        this.wasm.set_col_u8(key, colData.data as Uint8Array);
        break;
      case 'bool':
        // Map Bool to U8 if MrBlock doesn't support bool explicitly
        // (Assuming MrBlock uses u8)
        this.wasm.set_col_u8(key, colData.data as Uint8Array);
        break;
      case 'utf8':
        this.wasm.set_col_strings(key, colData.data as string[]);
        break;
      case 'int32':
      case 'float64':
      case 'int16':
      case 'uint16':
      case 'int8':
      case 'uint8c':
        // Not supported by current backend
        throw new Error(`Backend does not support dtype '${colData.kind}' for column '${key}'`);
      default:
        throw new Error(`Unknown dtype for column '${key}'`);
    }
  }

  public get<T extends TypedArray>(key: string, defaultValue?: T): T {
    // Try f32
    try {
      const f32Info = this.wasm.col_f32(key);
      if (f32Info) {
        const mem = getSystemWasm().memory.buffer;
        return new Float32Array(mem, f32Info.ptr, f32Info.len) as unknown as T;
      }
    } catch (e) { }

    // Try u32
    try {
      const u32Info = this.wasm.col_u32(key);
      if (u32Info) {
        const mem = getSystemWasm().memory.buffer;
        return new Uint32Array(mem, u32Info.ptr, u32Info.len) as unknown as T;
      }
    } catch (e) { }

    // Try u8
    try {
      const u8Info = this.wasm.col_u8(key);
      if (u8Info) {
        const mem = getSystemWasm().memory.buffer;
        return new Uint8Array(mem, u8Info.ptr, u8Info.len) as unknown as T;
      }
    } catch (e) { }

    // Try strings
    try {
      const strings = this.wasm.col_strings(key);
      if (strings) {
        return strings as unknown as T;
      }
    } catch (e) { }

    if (defaultValue !== undefined) return defaultValue;
    throw BlockError.NotFound(key);
  }

  public setCols(cols: Record<string, BlockData>): void {
    for (const [k, c] of Object.entries(cols)) this.set(k, c);
  }

  protected adaptBlock(other: Block): void {
    // iterate other keys and copy
    const keys = other.keys();
    for (const k of keys) {
      const val = other.get(k);
      // Infer type or just try set?
      // simple infer: constructor check
      this.set(k, val);
    }
  }

  public keys(): string[] {
    return this.wasm.keys();
  }
}
