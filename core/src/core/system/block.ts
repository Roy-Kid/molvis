import { MrBlock } from "molrs-wasm";

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

/**
 * Block wraps MrBlock from molrs-wasm
 * Provides a unified interface for working with columnar data
 */
export class Block {
  /** Internal molrs block - exposed for advanced usage */
  public readonly _mrBlock: MrBlock;

  constructor(mrBlock?: MrBlock) {
    this._mrBlock = mrBlock ?? new MrBlock();
  }

  /** Create Block from existing MrBlock */
  static fromMrBlock(mrBlock: MrBlock): Block {
    return new Block(mrBlock);
  }

  /** Create empty block */
  static empty(): Block {
    return new Block();
  }

  /** Create block from column data */
  static fromCols(cols: Record<string, BlockData>): Block {
    const b = new Block();
    for (const [k, c] of Object.entries(cols)) {
      b.set(k, c);
    }
    return b;
  }

  get nrows(): number {
    return this._mrBlock.nrows();
  }

  keys(): string[] {
    return this._mrBlock.keys();
  }

  // Get methods for different types
  get_f32(key: string): Float32Array | undefined {
    return this._mrBlock.col_f32(key) ?? undefined;
  }

  get_u32(key: string): Uint32Array | undefined {
    return this._mrBlock.col_u32(key) ?? undefined;
  }

  get_u8(key: string): Uint8Array | undefined {
    return this._mrBlock.col_u8(key) ?? undefined;
  }

  get_strings(key: string): string[] | undefined {
    return this._mrBlock.col_strings(key) ?? undefined;
  }

  // Generic get that tries all types
  get<T = any>(key: string): T {
    // Try each type in order
    const f32 = this.get_f32(key);
    if (f32) return f32 as T;

    const u32 = this.get_u32(key);
    if (u32) return u32 as T;

    const u8 = this.get_u8(key);
    if (u8) return u8 as T;

    const strings = this.get_strings(key);
    if (strings) return strings as T;

    throw new Error(`Column '${key}' not found or unsupported type`);
  }

  // Set methods
  set_f32(key: string, data: Float32Array | number[]): void {
    const arr = data instanceof Float32Array ? data : new Float32Array(data);
    this._mrBlock.set_col_f32(key, arr, undefined);
  }

  set_u32(key: string, data: Uint32Array | number[]): void {
    const arr = data instanceof Uint32Array ? data : new Uint32Array(data);
    this._mrBlock.set_col_u32(key, arr, undefined);
  }

  set_u8(key: string, data: Uint8Array | number[]): void {
    const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
    this._mrBlock.set_col_u8(key, arr, undefined);
  }

  set_strings(key: string, data: string[]): void {
    this._mrBlock.set_col_strings(key, data, undefined);
  }

  // Unified set method for backward compatibility
  set(key: string, value: BlockData | TypedArray): void {
    if ('kind' in value && 'data' in value) {
      const { kind, data } = value as BlockData;
      switch (kind) {
        case 'float32':
          this.set_f32(key, data as Float32Array);
          break;
        case 'uint32':
          this.set_u32(key, data as Uint32Array);
          break;
        case 'uint8':
        case 'bool':
          this.set_u8(key, data as Uint8Array);
          break;
        case 'utf8':
          this.set_strings(key, data as string[]);
          break;
        default:
          throw new Error(`Unsupported data type: ${kind}`);
      }
    } else {
      // Direct TypedArray
      const arr = value as TypedArray;
      if (arr instanceof Float32Array) {
        this.set_f32(key, arr);
      } else if (arr instanceof Uint32Array) {
        this.set_u32(key, arr);
      } else if (arr instanceof Uint8Array) {
        this.set_u8(key, arr);
      } else if (Array.isArray(arr)) {
        this.set_strings(key, arr as string[]);
      } else {
        throw new Error(`Unsupported array type for column '${key}'`);
      }
    }
  }
}