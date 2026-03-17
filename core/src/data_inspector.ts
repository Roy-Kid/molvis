/**
 * Data extraction utilities for the Data Inspector panel.
 * Pure functions that convert Frame Block data into table-friendly structures.
 */

import type { Block, Frame } from "@molcrafts/molrs";

export interface ColumnDescriptor {
  name: string;
  dtype: string;
}

export interface AtomRow {
  index: number;
  values: Map<string, string>;
}

export interface BondRow {
  index: number;
  i: number;
  j: number;
  order: number;
}

/**
 * Discover all columns in an atoms Block.
 * Returns column descriptors sorted: element first, then x/y/z, then rest alphabetically.
 */
export function discoverAtomColumns(block: Block): ColumnDescriptor[] {
  const keys = block.keys();
  const columns: ColumnDescriptor[] = [];
  for (const key of keys) {
    if (key.startsWith("__")) continue; // skip internal columns
    const dtype = block.getDtype(key);
    if (dtype) columns.push({ name: key, dtype });
  }

  // Sort: element first, then x/y/z, then alphabetical
  const priority: Record<string, number> = {
    element: 0,
    x: 1,
    y: 2,
    z: 3,
  };
  columns.sort((a, b) => {
    const pa = priority[a.name] ?? 100;
    const pb = priority[b.name] ?? 100;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });

  return columns;
}

/**
 * Extract atom rows from a Frame's atoms Block.
 * Returns rows with all column values as formatted strings.
 */
export function extractAtomRows(
  block: Block,
  columns: ColumnDescriptor[],
  startIndex = 0,
  count?: number,
): AtomRow[] {
  const nrows = block.nrows();
  const end = count ? Math.min(startIndex + count, nrows) : nrows;
  const rows: AtomRow[] = [];

  // Pre-fetch all column data
  const columnData = new Map<string, { type: string; f32?: Float32Array; str?: string[] }>();
  for (const col of columns) {
    if (col.dtype === "str" || col.dtype === "string") {
      const data = block.getColumnStrings(col.name);
      if (data) columnData.set(col.name, { type: "str", str: data });
    } else {
      const data = block.getColumnF32(col.name);
      if (data) columnData.set(col.name, { type: "f32", f32: data });
      else {
        const strData = block.getColumnStrings(col.name);
        if (strData) columnData.set(col.name, { type: "str", str: strData });
      }
    }
  }

  for (let i = startIndex; i < end; i++) {
    const values = new Map<string, string>();
    for (const col of columns) {
      const data = columnData.get(col.name);
      if (!data) {
        values.set(col.name, "—");
        continue;
      }
      if (data.type === "f32" && data.f32) {
        values.set(col.name, formatNumber(data.f32[i]));
      } else if (data.type === "str" && data.str) {
        values.set(col.name, data.str[i] ?? "—");
      }
    }
    rows.push({ index: i, values });
  }

  return rows;
}

/**
 * Extract bond rows from a Frame's bonds Block.
 */
export function extractBondRows(frame: Frame): BondRow[] {
  const bonds = frame.getBlock("bonds");
  if (!bonds) return [];

  const iCol = bonds.getColumnU32("i");
  const jCol = bonds.getColumnU32("j");
  if (!iCol || !jCol) return [];

  const orderCol = bonds.getColumnU8("order");
  const rows: BondRow[] = [];

  for (let b = 0; b < bonds.nrows(); b++) {
    rows.push({
      index: b,
      i: iCol[b],
      j: jCol[b],
      order: orderCol ? orderCol[b] : 1,
    });
  }

  return rows;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  // Use fixed 3 for typical coordinate precision
  return Math.abs(value) < 0.001 && value !== 0
    ? value.toExponential(2)
    : value.toFixed(3);
}
