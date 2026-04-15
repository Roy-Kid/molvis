/**
 * Data extraction utilities for the Data Inspector panel.
 * Pure functions that convert Frame Block data into table-friendly structures.
 */

import type { Block, Frame } from "@molcrafts/molrs";
import { probeColumnDtype } from "./utils/block_helpers";

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
    const dtype = probeColumnDtype(block, key);
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

  // Pre-fetch all column data by dtype
  const columnData = new Map<
    string,
    {
      dtype: string;
      f64?: Float64Array;
      u32?: Uint32Array;
      i32?: Int32Array;
      str?: string[];
    }
  >();
  for (const col of columns) {
    const dt = col.dtype;
    if (dt === "str" || dt === "string") {
      columnData.set(col.name, {
        dtype: "str",
        str: block.copyColStr(col.name) as string[],
      });
    } else if (dt === "f64") {
      columnData.set(col.name, {
        dtype: "f64",
        f64: block.viewColF(col.name),
      });
    } else if (dt === "u32") {
      columnData.set(col.name, {
        dtype: "u32",
        u32: block.viewColU32(col.name),
      });
    } else if (dt === "i32") {
      columnData.set(col.name, {
        dtype: "i32",
        i32: block.viewColI32(col.name),
      });
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
      if (data.dtype === "f64" && data.f64) {
        values.set(col.name, formatNumber(data.f64[i]));
      } else if (data.dtype === "u32" && data.u32) {
        values.set(col.name, String(data.u32[i]));
      } else if (data.dtype === "i32" && data.i32) {
        values.set(col.name, String(data.i32[i]));
      } else if (data.dtype === "str" && data.str) {
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

  const iCol = readBondIndexColumn(bonds, "atomi", "i", "atom_i");
  const jCol = readBondIndexColumn(bonds, "atomj", "j", "atom_j");
  if (!iCol || !jCol) return [];

  const orderCol =
    bonds.dtype("order") === "u32" ? bonds.viewColU32("order") : undefined;
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

function readBondIndexColumn(
  bonds: Block,
  canonical: string,
  shortAlias: string,
  longAlias: string,
): Uint32Array | undefined {
  if (bonds.dtype(canonical) === "u32") {
    return bonds.viewColU32(canonical);
  }
  if (bonds.dtype(shortAlias) === "u32") {
    return bonds.viewColU32(shortAlias);
  }
  if (bonds.dtype(longAlias) === "u32") {
    return bonds.viewColU32(longAlias);
  }
  return undefined;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  // Use fixed 3 for typical coordinate precision
  return Math.abs(value) < 0.001 && value !== 0
    ? value.toExponential(2)
    : value.toFixed(3);
}
