import { Frame } from "@molcrafts/molrs";
import type { ColormapName } from "../artist/colormaps";
import { sampleColormap } from "../artist/colormaps";
import { hexToLinearRgb, hslColorFromString } from "../artist/palette";
import { BaseModifier, ModifierCategory } from "../pipeline/modifier";
import type { PipelineContext } from "../pipeline/types";

// Columns injected into the atoms Block to override default element coloring.
// buildAtomBuffers detects these and uses them for per-atom colors.
export const COLOR_OVERRIDE_R = "__color_r";
export const COLOR_OVERRIDE_G = "__color_g";
export const COLOR_OVERRIDE_B = "__color_b";

export interface ColorByPropertyConfig {
  /** Column name in atoms Block. Empty string = disabled. */
  columnName: string;
  /** Colormap for numeric columns. Ignored for string columns. */
  colormap: ColormapName;
  /** Manual range override. null = auto-detect. */
  range: { min: number; max: number } | null;
  /** Clamp out-of-range values (true) or fade to gray (false). */
  clampOutOfRange: boolean;
}

/**
 * ColorByPropertyModifier — colors atoms by any per-atom column.
 *
 * Numeric columns → continuous colormap (viridis, plasma, etc.)
 * String columns → categorical coloring via hslColorFromString
 *
 * Injects __color_r/g/b Float32Array columns into the output Frame.
 */
export class ColorByPropertyModifier extends BaseModifier {
  private _config: ColorByPropertyConfig = {
    columnName: "",
    colormap: "viridis",
    range: null,
    clampOutOfRange: true,
  };

  /** Detected min/max — populated by inspect(), exposed for UI display. */
  public detectedRange: { min: number; max: number } | null = null;

  /** Available colorable columns — populated by inspect(), exposed for UI dropdown. */
  public availableColumns: { name: string; dtype: string }[] = [];

  constructor(id = `color-by-property-${Date.now()}`) {
    super(id, "Color by Property", ModifierCategory.SelectionInsensitive);
  }

  get columnName(): string {
    return this._config.columnName;
  }
  set columnName(v: string) {
    this._config.columnName = v;
  }

  get colormap(): ColormapName {
    return this._config.colormap;
  }
  set colormap(v: ColormapName) {
    this._config.colormap = v;
  }

  get range(): { min: number; max: number } | null {
    return this._config.range;
  }
  set range(v: { min: number; max: number } | null) {
    this._config.range = v;
  }

  get clampOutOfRange(): boolean {
    return this._config.clampOutOfRange;
  }
  set clampOutOfRange(v: boolean) {
    this._config.clampOutOfRange = v;
  }

  getCacheKey(): string {
    const r = this._config.range;
    const rangeStr = r ? `${r.min}:${r.max}` : "auto";
    return `${super.getCacheKey()}:${this._config.columnName}:${this._config.colormap}:${rangeStr}:${this._config.clampOutOfRange}`;
  }

  /**
   * Inspect a frame to populate UI-facing metadata (availableColumns, detectedRange).
   * Call this from the UI layer before rendering the modifier panel.
   * Keeps apply() free of side effects.
   */
  inspect(frame: Frame): void {
    const atoms = frame.getBlock("atoms");
    if (!atoms) {
      this.availableColumns = [];
      this.detectedRange = null;
      return;
    }
    this.availableColumns = discoverColorableColumns(atoms);

    if (!this._config.columnName) {
      this.detectedRange = null;
      return;
    }

    const dtype = atoms.getDtype(this._config.columnName);
    if (dtype === "f32" || dtype === "f64") {
      const data = atoms.getColumnF32(this._config.columnName);
      if (data) {
        this.detectedRange = detectRange(data, atoms.nrows());
        return;
      }
    }
    // Try numeric for u32/u8
    if (dtype) {
      const data = atoms.getColumnF32(this._config.columnName);
      if (data) {
        this.detectedRange = detectRange(data, atoms.nrows());
        return;
      }
    }
    this.detectedRange = null;
  }

  apply(input: Frame, _context: PipelineContext): Frame {
    const atoms = input.getBlock("atoms");
    if (!atoms) return input;

    // If no column selected, pass through (no color override)
    if (!this._config.columnName) return input;

    const atomCount = atoms.nrows();
    if (atomCount === 0) return input;

    const dtype = atoms.getDtype(this._config.columnName);
    if (!dtype) return input;

    const colorR = new Float32Array(atomCount);
    const colorG = new Float32Array(atomCount);
    const colorB = new Float32Array(atomCount);

    if (dtype === "f32" || dtype === "f64") {
      this.applyNumeric(atoms, atomCount, colorR, colorG, colorB);
    } else if (dtype === "str" || dtype === "string") {
      this.applyCategorical(atoms, atomCount, colorR, colorG, colorB);
    } else {
      // Try numeric first (u32, u8 can still be colored as numeric)
      const f32 = atoms.getColumnF32(this._config.columnName);
      if (f32) {
        this.applyNumericFromArray(f32, atomCount, colorR, colorG, colorB);
      } else {
        const strs = atoms.getColumnStrings(this._config.columnName);
        if (strs) {
          this.applyCategoricalFromArray(
            strs,
            atomCount,
            colorR,
            colorG,
            colorB,
          );
        } else {
          return input;
        }
      }
    }

    // Create new Frame with color override columns
    const result = new Frame();
    result.insertBlock("atoms", atoms);
    const resultAtoms = result.getBlock("atoms");
    if (!resultAtoms) return input;

    resultAtoms.setColumnF32(COLOR_OVERRIDE_R, colorR);
    resultAtoms.setColumnF32(COLOR_OVERRIDE_G, colorG);
    resultAtoms.setColumnF32(COLOR_OVERRIDE_B, colorB);

    // Copy bonds block if present
    const bonds = input.getBlock("bonds");
    if (bonds) {
      result.insertBlock("bonds", bonds);
    }

    // Preserve box
    const box = input.simbox;
    if (box) {
      result.simbox = box;
    }

    return result;
  }

  private applyNumeric(
    atoms: { getColumnF32(key: string): Float32Array | undefined },
    count: number,
    r: Float32Array,
    g: Float32Array,
    b: Float32Array,
  ): void {
    const data = atoms.getColumnF32(this._config.columnName);
    if (!data) return;
    this.applyNumericFromArray(data, count, r, g, b);
  }

  private applyNumericFromArray(
    data: Float32Array,
    count: number,
    r: Float32Array,
    g: Float32Array,
    b: Float32Array,
  ): void {
    const { min, max } = detectRange(data, count);

    const userRange = this._config.range;
    const rMin = userRange ? userRange.min : min;
    const rMax = userRange ? userRange.max : max;
    const span = rMax - rMin;
    const invSpan = span > 1e-12 ? 1 / span : 0;

    for (let i = 0; i < count; i++) {
      let t = (data[i] - rMin) * invSpan;
      if (this._config.clampOutOfRange) {
        t = Math.max(0, Math.min(1, t));
      }
      const [cr, cg, cb] = sampleColormap(this._config.colormap, t);
      r[i] = cr;
      g[i] = cg;
      b[i] = cb;
    }
  }

  private applyCategorical(
    atoms: { getColumnStrings(key: string): string[] | undefined },
    count: number,
    r: Float32Array,
    g: Float32Array,
    b: Float32Array,
  ): void {
    const data = atoms.getColumnStrings(this._config.columnName);
    if (!data) return;
    this.applyCategoricalFromArray(data, count, r, g, b);
  }

  private applyCategoricalFromArray(
    data: string[],
    count: number,
    r: Float32Array,
    g: Float32Array,
    b: Float32Array,
  ): void {
    const colorCache = new Map<string, [number, number, number]>();

    for (let i = 0; i < count; i++) {
      const label = data[i] ?? "UNK";
      let rgb = colorCache.get(label);
      if (!rgb) {
        const hex = hslColorFromString(label);
        rgb = hexToLinearRgb(hex);
        colorCache.set(label, rgb);
      }
      r[i] = rgb[0];
      g[i] = rgb[1];
      b[i] = rgb[2];
    }
  }
}

function detectRange(
  data: Float32Array,
  count: number,
): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < count; i++) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

// Non-colorable column names (structural indices, coordinates handled separately)
const SKIP_COLUMNS = new Set(["i", "j"]);

function discoverColorableColumns(block: {
  keys(): string[];
  getDtype(key: string): string | undefined;
}): { name: string; dtype: string }[] {
  const result: { name: string; dtype: string }[] = [];
  for (const key of block.keys()) {
    if (SKIP_COLUMNS.has(key)) continue;
    if (key.startsWith("__")) continue; // skip internal columns
    const dtype = block.getDtype(key);
    if (dtype) {
      result.push({ name: key, dtype });
    }
  }
  return result;
}
