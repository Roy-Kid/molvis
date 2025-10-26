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

export type BoolArray = { kind: 'bool'; data: Uint8Array };         // 0/1
export type StrArray = { kind: 'utf8'; data: string[] };           // 简版：用 string[]（需要零拷贝可换成 offsets+bytes）
export type BlockData = NumArray | BoolArray | StrArray;

export type DType = BlockData['kind'];
export type DArray = BlockData['data'];

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

  public set(key: string, col: BlockData): void {
    const nrows = this.nrows;
    const colLen = lengthOf(col);
    if (nrows !== 0 && colLen !== nrows) {
      throw BlockError.Ragged(key, nrows, colLen);
    }
    this.data.set(key, col);
  }

  public get<T extends DArray>(key: string, defaultValue?: T): T {
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