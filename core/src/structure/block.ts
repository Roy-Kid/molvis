export type NumKind =
  | 'float64' | 'float32'
  | 'int32' | 'uint32' | 'int16' | 'uint16' | 'int8' | 'uint8' | 'uint8c';

export type NumArray =
  | { kind: 'float64'; data: Float64Array }
  | { kind: 'float32'; data: Float32Array }
  | { kind: 'int32';   data: Int32Array }
  | { kind: 'uint32';  data: Uint32Array }
  | { kind: 'int16';   data: Int16Array }
  | { kind: 'uint16';  data: Uint16Array }
  | { kind: 'int8';    data: Int8Array }
  | { kind: 'uint8';   data: Uint8Array }
  | { kind: 'uint8c';  data: Uint8ClampedArray };

export type BoolArray = { kind: 'bool'; data: Uint8Array };
export type StrArray = { kind: 'utf8'; data: string[] };
export type BlockData = NumArray | BoolArray | StrArray;

export type DType = BlockData['kind'];
export type TypedArray = BlockData['data'];

const ctorToDtype = new Map<Function, DType>([
  [Float64Array, 'float64'],
  [Float32Array, 'float32'],
  [Int32Array,   'int32'],
  [Uint32Array,  'uint32'],
  [Int16Array,   'int16'],
  [Uint16Array,  'uint16'],
  [Int8Array,    'int8'],
  [Uint8Array,   'uint8'],
  [Uint8ClampedArray, 'uint8c'],
  [Uint8Array, 'bool'],
  [Array, 'utf8'],
]);


const isNum = (c: BlockData): c is NumArray =>
  c.kind !== 'bool' && c.kind !== 'utf8';

const lengthOf = (c: BlockData): number =>
  isNum(c) ? c.data.length : (c.kind === 'bool' ? c.data.length : c.data.length);


export class BlockError extends Error {
  static RankZero(key: string)     { return new BlockError(`column '${key}' has rank 0`); }
  static Ragged(key: string, exp: number, got: number) {
    return new BlockError(`column '${key}' nrows ${got} != block nrows ${exp}`);
  }
  static NotFound(key: string)     { return new BlockError(`column '${key}' not found`); }
  static TypeMismatch(key: string, exp: DType, got: DType) {
    return new BlockError(`column '${key}' type mismatch: expected ${exp}, found ${got}`);
  }
}


export class Block {
  private data: Map<string, BlockData> = new Map();

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
    if (this.data.size === 0) return 0;
    const firstCol = this.data.values().next().value!;
    return lengthOf(firstCol);
  }

  public set(key: string, col: BlockData): void;
  public set<T extends TypedArray>(key: string, col: T): void;

  public set(key: string, col: TypedArray | BlockData, dtype?: DType): void {
    let colData: BlockData;
    if ('kind' in col) {
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
    this.data.set(key, colData);
  }



  public get<T extends TypedArray>(key: string, defaultValue?: T): T {
    const col = this.data.get(key);
    if (col === undefined) {
      if (defaultValue !== undefined) return defaultValue;
      throw BlockError.NotFound(key);
    }
    return col.data as T;
  }

  public setCols(cols: Record<string, BlockData>): void {
    for (const [k, c] of Object.entries(cols)) this.set(k, c);
  }

  protected adaptBlock(other: Block): void {
    this.data = new Map(other.data);
  }
}
