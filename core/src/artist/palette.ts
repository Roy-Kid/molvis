import { logger } from "../utils/logger";

/**
 * Public palettes are intentionally minimal:
 * - element lookups (`cpk`, `ovito`)
 * - one categorical palette for arbitrary string types (`glasbey-vivid`)
 *
 * Numeric property coloring uses a single internal continuous ramp
 * (`viridis`), registered separately in colormaps.ts.
 */

export type LinearRGB = [number, number, number];
export type ColorMapKind = "continuous" | "categorical" | "lookup";
export type PaletteKind = "element" | "categorical";

export interface PaletteEntry {
  label: string;
  color: string;
}

export interface PaletteSummary {
  name: string;
  kind: PaletteKind;
  size: number;
}

export interface PaletteDefinition extends PaletteSummary {
  entries: PaletteEntry[];
}

export const DEFAULT_CATEGORICAL_COLOR_MAP = "glasbey-vivid";
const INTERNAL_NUMERIC_COLOR_MAP = "viridis";

// ============================================================================
// Inline palette data
// ============================================================================

const CPK_RECORD = {
  Ac: "#70ABFA",
  Ag: "#C0C0C0",
  Al: "#BFA6A6",
  Am: "#545CF2",
  Ar: "#80D1E3",
  As: "#BD80E3",
  At: "#754F45",
  Au: "#FFD123",
  B: "#FFB5B5",
  Ba: "#00C900",
  Be: "#C2FF00",
  Bh: "#E00038",
  Bi: "#9E4FB5",
  Bk: "#8A4FE3",
  Br: "#A62929",
  C: "#909090",
  Ca: "#3DFF00",
  Cd: "#FFD98F",
  Ce: "#FFFFC7",
  Cf: "#A136D4",
  Cl: "#1FF01F",
  Cm: "#785CE3",
  Cn: "#FF1493",
  Co: "#F090A0",
  Cr: "#8A99C7",
  Cs: "#57178F",
  Cu: "#C88033",
  Db: "#D1004F",
  Ds: "#FF1493",
  Dy: "#1FFFC7",
  Er: "#00E675",
  Es: "#B31FD4",
  Eu: "#61FFC7",
  F: "#90E050",
  Fe: "#E06633",
  Fl: "#FF1493",
  Fm: "#B31FBA",
  Fr: "#420066",
  Ga: "#C28F8F",
  Gd: "#45FFC7",
  Ge: "#668F8F",
  H: "#FFFFFF",
  He: "#D9FFFF",
  Hf: "#4DC2FF",
  Hg: "#B8B8D0",
  Ho: "#00FF9C",
  Hs: "#E6002E",
  I: "#940094",
  In: "#A67573",
  Ir: "#175487",
  K: "#8F40D4",
  Kr: "#5CB8D1",
  La: "#70D4FF",
  Li: "#CC80FF",
  Lr: "#C70066",
  Lu: "#00AB24",
  Lv: "#FF1493",
  Mc: "#FF1493",
  Md: "#B30DA6",
  Mg: "#8AFF00",
  Mn: "#9C7AC7",
  Mo: "#54B5B5",
  Mt: "#EB0026",
  N: "#3050F8",
  Na: "#AB5CF2",
  Nb: "#73C2C9",
  Nd: "#C7FFC7",
  Ne: "#B3E3F5",
  Nh: "#FF1493",
  Ni: "#50D050",
  No: "#BD0D87",
  Np: "#0080FF",
  O: "#FF0D0D",
  Og: "#FF1493",
  Os: "#266696",
  P: "#FF8000",
  Pa: "#00A1FF",
  Pb: "#575961",
  Pd: "#006985",
  Pm: "#A3FFC7",
  Po: "#AB5C00",
  Pr: "#D9FFC7",
  Pt: "#D0D0E0",
  Pu: "#006BFF",
  Ra: "#007D00",
  Rb: "#702EB0",
  Re: "#267DAB",
  Rf: "#CC0059",
  Rg: "#FF1493",
  Rh: "#0A7D8C",
  Rn: "#428296",
  Ru: "#248F8F",
  S: "#FFFF30",
  Sb: "#9E63B5",
  Sc: "#E6E6E6",
  Se: "#FFA100",
  Sg: "#D90045",
  Si: "#F0C8A0",
  Sm: "#8FFFC7",
  Sn: "#668080",
  Sr: "#00FF00",
  Ta: "#4DA6FF",
  Tb: "#30FFC7",
  Tc: "#3B9E9E",
  Te: "#D47A00",
  Th: "#00BAFF",
  Ti: "#BFC2C7",
  Tl: "#A6544D",
  Tm: "#00D452",
  Ts: "#FF1493",
  U: "#008FFF",
  V: "#A6A6AB",
  W: "#2194D6",
  Xe: "#429EB0",
  Y: "#94FFFF",
  Yb: "#00BF38",
  Zn: "#7D80B0",
  Zr: "#94E0E0",
} as const;

const OVITO_RECORD = {
  Ac: "#70ABFA",
  Ag: "#E0E0FF",
  Al: "#BFA6A6",
  Am: "#545CF2",
  Ar: "#80D1E3",
  As: "#BD80E3",
  At: "#754F45",
  Au: "#FFD123",
  B: "#FFB5B5",
  Ba: "#00C900",
  Be: "#C2FF00",
  Bh: "#E07A33",
  Bi: "#9E4FB5",
  Bk: "#E3AB35",
  Br: "#A62929",
  C: "#909090",
  Ca: "#3DFF00",
  Cd: "#FFD98F",
  Ce: "#FFFFC7",
  Cf: "#EB3333",
  Cl: "#1FF01F",
  Cm: "#F24D4D",
  Cn: "#BF7878",
  Co: "#F090A0",
  Cr: "#8A99C7",
  Cs: "#57178F",
  Cu: "#C88033",
  Db: "#D1824F",
  Ds: "#E04538",
  Dy: "#1FFFC7",
  Er: "#00E675",
  Es: "#EB4F59",
  Eu: "#61FFC7",
  F: "#80B3FF",
  Fe: "#E06633",
  Fl: "#A38594",
  Fm: "#E64D4D",
  Fr: "#420066",
  Ga: "#C28F8F",
  Gd: "#45FFC7",
  Ge: "#668F8F",
  H: "#FFFFFF",
  He: "#D9FFFF",
  Hf: "#4DC2FF",
  Hg: "#B5B5C2",
  Ho: "#00FF9C",
  Hs: "#E64D4D",
  I: "#940094",
  In: "#A67573",
  Ir: "#175487",
  K: "#8F40D4",
  Kr: "#5CB8D1",
  La: "#70D4FF",
  Li: "#CC80FF",
  Lr: "#C27D69",
  Lu: "#00AB24",
  Lv: "#878CAB",
  Mc: "#998CAB",
  Md: "#D17D33",
  Mg: "#8AFF00",
  Mn: "#9C7AC7",
  Mo: "#54B5B5",
  Mt: "#EB4A33",
  N: "#3050F8",
  Na: "#AB5CF2",
  Nb: "#4DB376",
  Nd: "#C7FFC7",
  Ne: "#B3E3F5",
  Nh: "#B37D82",
  Ni: "#50D050",
  No: "#C78033",
  Np: "#D49EEB",
  O: "#FF0D0D",
  Og: "#666666",
  Os: "#266696",
  P: "#FF8000",
  Pa: "#CCE0FA",
  Pb: "#575961",
  Pd: "#006985",
  Pm: "#A3FFC7",
  Po: "#AB5C00",
  Pr: "#D9FFC7",
  Pt: "#E6D9AD",
  Pu: "#D1ADC7",
  Ra: "#007DAB",
  Rb: "#702EB0",
  Re: "#267DAB",
  Rf: "#CC9933",
  Rg: "#D14D52",
  Rh: "#0A7D8C",
  Rn: "#428296",
  Ru: "#248F8F",
  S: "#B3B300",
  Sb: "#9E63B5",
  Sc: "#E6E6E6",
  Se: "#FFA100",
  Sg: "#D9784F",
  Si: "#F0C8A0",
  Sm: "#8FFFC7",
  Sn: "#668080",
  Sr: "#00FF27",
  Ta: "#4DA6FF",
  Tb: "#30FFC7",
  Tc: "#3B9E9E",
  Te: "#D47A00",
  Th: "#BAC7DE",
  Ti: "#BFC2C7",
  Tl: "#A6544D",
  Tm: "#00D452",
  Ts: "#758FAB",
  U: "#1F94D4",
  V: "#A6A6AB",
  W: "#2194D6",
  Xe: "#429EB0",
  Y: "#67998F",
  Yb: "#00BF38",
  Zn: "#7D80B0",
  Zr: "#00FF00",
} as const;

const GLASBEY_VIVID_COLORS = [
  "#d70000",
  "#8a3dff",
  "#008a00",
  "#00aeca",
  "#eba600",
  "#ff7dd2",
  "#04ff35",
  "#75045d",
  "#004971",
  "#714900",
  "#b6aeff",
  "#0cf7d2",
  "#c208c6",
  "#86ba71",
  "#d27969",
  "#005120",
  "#0079e7",
  "#7d0808",
  "#ef007d",
  "#008a71",
  "#552d86",
  "#928200",
  "#3900fb",
  "#96d7ff",
  "#d2df00",
  "#9e495d",
  "#b282ca",
  "#b25508",
  "#14758e",
  "#ff5d00",
  "#00c200",
  "#00be9e",
  "#61a6ff",
  "#595d9e",
  "#ffaa79",
  "#55650c",
  "#864d8e",
  "#f3b6ff",
  "#e755ff",
  "#8aef9a",
  "#c26d92",
  "#8e82fb",
  "#aaae00",
  "#ae0079",
  "#ff4d59",
  "#ff00ce",
  "#ff9aaa",
  "#c28639",
  "#ae0035",
  "#efd265",
  "#14a65d",
  "#8a00c6",
  "#8a4128",
  "#ba35ff",
  "#00d7df",
  "#08753d",
  "#6d9e28",
  "#558eba",
  "#8ad745",
  "#ca5549",
  "#6504df",
  "#752839",
  "#00d27d",
  "#ce8eff",
  "#5551ff",
  "#0059b6",
  "#710086",
  "#353992",
  "#ff5d9a",
  "#b21c00",
  "#ff8a35",
  "#926510",
  "#7965aa",
  "#45c6ff",
  "#ce399e",
  "#9a009a",
  "#9ac2ff",
  "#df0045",
  "#00868a",
  "#b6d77d",
  "#bea64d",
  "#598641",
  "#6979c2",
  "#d28ece",
  "#75d7ae",
  "#ae59a6",
  "#6d2d00",
  "#ff7d59",
  "#92004d",
  "#863969",
  "#ae71f3",
  "#c20c59",
  "#ffca00",
  "#186500",
  "#d76d2d",
  "#6d499e",
  "#db61c2",
  "#8e9adb",
  "#f786ff",
  "#394d00",
  "#ffa6db",
  "#fb3118",
  "#4171a6",
  "#eb5175",
  "#d74904",
  "#5d86ff",
  "#9e45ba",
  "#929a45",
  "#00a620",
  "#82e7e3",
  "#ff7582",
  "#d2c218",
  "#00e355",
  "#e7b261",
  "#a2ef00",
  "#df86ae",
  "#6daad2",
  "#39a282",
  "#693979",
  "#00618e",
  "#7db600",
  "#aa92db",
  "#4149ba",
  "#b66549",
  "#14aeae",
  "#00efa6",
  "#49ba55",
  "#a64582",
  "#be5dd7",
  "#df8e5d",
  "#697d00",
  "#e708e7",
  "#a63935",
  "#b68e04",
  "#0096eb",
  "#59b682",
  "#eb5939",
  "#6d5dce",
  "#8e4d04",
  "#715d00",
  "#ba6169",
  "#39518a",
  "#008e55",
  "#0049ff",
  "#aaba59",
  "#6da25d",
  "#ff59eb",
  "#b66d00",
  "#9e14f3",
  "#20d7be",
  "#8e1c2d",
  "#4900ca",
  "#65bed2",
  "#82f369",
  "#ff1461",
  "#4565c6",
  "#6d18ba",
  "#00aef3",
  "#8e86ce",
  "#b6e75d",
  "#00fb86",
  "#d2aaf7",
  "#51458e",
  "#00f3ff",
  "#ef8e82",
  "#ef41a2",
  "#652461",
  "#9265f3",
  "#7169ff",
  "#417500",
  "#75d775",
  "#c2242d",
  "#aeca00",
  "#0039b6",
  "#a27d2d",
  "#db758a",
  "#be75b2",
  "#8a2d00",
  "#db8e04",
  "#9e5531",
  "#752d20",
  "#8210e7",
  "#9661aa",
  "#a22d5d",
  "#188aaa",
  "#ce79e3",
  "#ba411c",
  "#28dbff",
  "#59c2be",
  "#ba5179",
  "#d720ff",
  "#59e300",
  "#920075",
  "#a6399e",
  "#823da2",
  "#c6a600",
  "#d20082",
  "#a25dd2",
  "#929a00",
  "#e33939",
  "#6992db",
  "#ffbe45",
  "#591cff",
  "#9e0014",
  "#ffa63d",
  "#797520",
  "#3d963d",
  "#8aae45",
  "#8a393d",
  "#be089e",
  "#8649c2",
  "#ff59c2",
  "#7d2d79",
  "#0082c2",
  "#ff82aa",
  "#457131",
  "#286128",
  "#009ece",
  "#96aeff",
  "#a696ff",
  "#d2db61",
  "#ca65ff",
  "#aa514d",
  "#d79a4d",
  "#7d96ff",
  "#798a35",
  "#79ca8e",
  "#00d29e",
  "#ba10e3",
  "#ca45be",
  "#6d3def",
  "#558e00",
  "#79c24d",
  "#ba7139",
  "#d74182",
  "#f79eef",
  "#5510ae",
  "#496dff",
  "#7defbe",
  "#82bee7",
  "#e779db",
  "#2d8231",
  "#df7900",
  "#e36565",
  "#9e00be",
  "#1c9a8e",
  "#6145b6",
  "#7d2451",
  "#79d7e7",
  "#d2be61",
  "#a23d00",
  "#e369aa",
  "#7d0431",
  "#9a75ca",
  "#ce3d55",
  "#6d2496",
] as const;

const warnedCategoricalWrapPalettes = new Set<string>();

function stableStringHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function compareTextTokens(a: string, b: string): number {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA < lowerB) return -1;
  if (lowerA > lowerB) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function normalizeNumericToken(token: string): string {
  const normalized = token.replace(/^0+/, "");
  return normalized.length > 0 ? normalized : "0";
}

function compareNaturalKeys(a: string, b: string): number {
  const partsA = a.match(/\d+|\D+/g) ?? [a];
  const partsB = b.match(/\d+|\D+/g) ?? [b];
  const limit = Math.min(partsA.length, partsB.length);

  for (let i = 0; i < limit; i++) {
    const partA = partsA[i];
    const partB = partsB[i];
    const digitsA = /^\d+$/.test(partA);
    const digitsB = /^\d+$/.test(partB);

    if (digitsA && digitsB) {
      const normA = normalizeNumericToken(partA);
      const normB = normalizeNumericToken(partB);
      if (normA.length !== normB.length) {
        return normA.length - normB.length;
      }
      if (normA !== normB) {
        return normA < normB ? -1 : 1;
      }
      if (partA.length !== partB.length) {
        return partA.length - partB.length;
      }
      continue;
    }

    if (digitsA !== digitsB) {
      return digitsA ? -1 : 1;
    }

    const textCmp = compareTextTokens(partA, partB);
    if (textCmp !== 0) return textCmp;
  }

  if (partsA.length !== partsB.length) {
    return partsA.length - partsB.length;
  }
  return compareTextTokens(a, b);
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function hexToLinearRgb(hex: string): LinearRGB {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = Number.parseInt(h.slice(0, 2), 16) / 255;
  const g = Number.parseInt(h.slice(2, 4), 16) / 255;
  const b = Number.parseInt(h.slice(4, 6), 16) / 255;
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function linearRgbToHex(rgb: LinearRGB): string {
  const [r, g, b] = rgb;
  const toHex = (v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    const srgb = linearToSrgb(clamped);
    const byte = Math.round(srgb * 255);
    return byte.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export class ColorMap {
  readonly name: string;
  readonly kind: ColorMapKind;

  private readonly _palette: LinearRGB[];
  private readonly _lookup: Map<string, LinearRGB>;
  private readonly _fallback: LinearRGB | null;

  private constructor(
    name: string,
    palette: LinearRGB[],
    kind: ColorMapKind,
    lookup?: Map<string, LinearRGB>,
    fallback?: LinearRGB | null,
  ) {
    this.name = name;
    this._palette = palette;
    this.kind = kind;
    this._lookup = lookup ?? new Map();
    this._fallback = fallback ?? null;
  }

  get colors(): readonly LinearRGB[] {
    return this._palette;
  }

  sample(t: number): LinearRGB {
    if (this.kind !== "continuous") {
      throw new Error(`Colormap '${this.name}' does not support sampling`);
    }

    const n = this._palette.length;
    if (n === 0) return [0, 0, 0];
    if (n === 1) return this._palette[0];

    const clamped = Math.max(0, Math.min(1, t));
    const scaled = clamped * (n - 1);
    const i = Math.floor(scaled);
    const frac = scaled - i;

    if (i >= n - 1) return this._palette[n - 1];

    const a = this._palette[i];
    const b = this._palette[i + 1];
    return [
      a[0] + (b[0] - a[0]) * frac,
      a[1] + (b[1] - a[1]) * frac,
      a[2] + (b[2] - a[2]) * frac,
    ];
  }

  colorForKey(key: string): LinearRGB {
    const looked = this._lookup.get(key);
    if (looked) return looked;

    if (this.kind === "lookup") {
      return this._fallback ?? [1, 0, 1];
    }

    if (this._palette.length === 0) {
      return [0, 0, 0];
    }

    if (this.kind === "categorical") {
      const idx = stableStringHash(key) % this._palette.length;
      return this._palette[idx % this._palette.length];
    }

    const raw = stableStringHash(key) / 0xffffffff;
    const t = 0.1 + raw * 0.8;
    return this.sample(t);
  }

  resetKeys(): void {
    // Compatibility no-op. Dataset-level categorical assignment now happens
    // before rendering rather than incrementally at lookup time.
  }

  static fromLookup(
    name: string,
    record: Record<string, string>,
    fallback = "#FF00FF",
  ): ColorMap {
    const lookup = new Map<string, LinearRGB>();
    const palette: LinearRGB[] = [];
    for (const [key, hex] of Object.entries(record)) {
      const rgb = hexToLinearRgb(hex);
      lookup.set(key, rgb);
      palette.push(rgb);
    }
    return new ColorMap(
      name,
      palette,
      "lookup",
      lookup,
      hexToLinearRgb(fallback),
    );
  }

  static fromPalette(name: string, hexColors: readonly string[]): ColorMap {
    const palette = hexColors.map(hexToLinearRgb);
    return new ColorMap(name, palette, "categorical");
  }

  static fromLUT(name: string, lut: Float32Array): ColorMap {
    const n = lut.length / 3;
    const palette: LinearRGB[] = new Array(n);
    for (let i = 0; i < n; i++) {
      palette[i] = [lut[i * 3], lut[i * 3 + 1], lut[i * 3 + 2]];
    }
    return new ColorMap(name, palette, "continuous");
  }
}

const REGISTRY = new Map<string, ColorMap>();
const PUBLIC_COLOR_MAPS = new Set<string>();
const PUBLIC_PALETTE_DEFINITIONS = new Map<string, PaletteDefinition>();

function register(cm: ColorMap, options?: { public?: boolean }): void {
  REGISTRY.set(cm.name, cm);
  if (options?.public ?? cm.kind !== "continuous") {
    PUBLIC_COLOR_MAPS.add(cm.name);
  }

  // Rebuild palette definition from ColorMap
  if (cm.kind === "lookup") {
    // For lookup ColorMaps, we need the original record to get labels and preserve order
    // This is handled separately when registering cpk and ovito
  } else if (cm.kind === "categorical") {
    // For categorical ColorMaps, labels are "1"…"N"
    const entries: PaletteEntry[] = cm.colors.map((rgb, i) => ({
      label: String(i + 1),
      color: linearRgbToHex(rgb),
    }));
    PUBLIC_PALETTE_DEFINITIONS.set(cm.name, {
      name: cm.name,
      kind: "categorical",
      size: entries.length,
      entries,
    });
  }
}

export function getColorMap(name: string): ColorMap {
  const cm = REGISTRY.get(name);
  if (!cm) {
    const available = Array.from(REGISTRY.keys()).sort().join(", ");
    throw new Error(`Unknown colormap '${name}'. Available: ${available}`);
  }
  return cm;
}

export function listColorMaps(): string[] {
  return Array.from(PUBLIC_COLOR_MAPS).sort();
}

export function listPaletteDefinitions(): PaletteSummary[] {
  return Array.from(PUBLIC_PALETTE_DEFINITIONS.values())
    .map(({ entries, ...summary }) => ({
      ...summary,
      size: entries.length,
    }))
    .sort((a, b) => compareTextTokens(a.name, b.name));
}

export function getPaletteDefinition(name: string): PaletteDefinition {
  const definition = PUBLIC_PALETTE_DEFINITIONS.get(name);
  if (!definition) {
    const available = Array.from(PUBLIC_PALETTE_DEFINITIONS.keys())
      .sort()
      .join(", ");
    throw new Error(`Unknown palette '${name}'. Available: ${available}`);
  }
  return {
    ...definition,
    entries: definition.entries.map((entry) => ({ ...entry })),
  };
}

export function listContinuousColorMaps(): string[] {
  const names: string[] = [];
  for (const cm of REGISTRY.values()) {
    if (cm.kind === "continuous") names.push(cm.name);
  }
  return names.sort();
}

export function getCategoricalPalette(
  name = DEFAULT_CATEGORICAL_COLOR_MAP,
): readonly LinearRGB[] {
  const cm = getColorMap(name);
  if (cm.kind !== "categorical") {
    throw new Error(`Colormap '${name}' is not categorical`);
  }
  return cm.colors;
}

export function buildCategoricalColorLookup(
  keys: Iterable<string>,
  paletteName = DEFAULT_CATEGORICAL_COLOR_MAP,
): Map<string, LinearRGB> {
  const uniqueKeys = Array.from(new Set(keys));
  uniqueKeys.sort(compareNaturalKeys);

  const palette = getCategoricalPalette(paletteName);
  if (uniqueKeys.length > palette.length) {
    const warnKey = `${paletteName}:${palette.length}`;
    if (!warnedCategoricalWrapPalettes.has(warnKey)) {
      logger.warn(
        `[palette] categorical palette '${paletteName}' has ${palette.length} colors, but received ${uniqueKeys.length} unique categories; colors will wrap.`,
      );
      warnedCategoricalWrapPalettes.add(warnKey);
    }
  }

  const lookup = new Map<string, LinearRGB>();
  for (let i = 0; i < uniqueKeys.length; i++) {
    lookup.set(uniqueKeys[i], palette[i % palette.length]);
  }
  return lookup;
}

function lut(data: number[]): Float32Array {
  return Float32Array.from(data);
}

function registerLookup(
  name: string,
  record: Record<string, string>,
  fallback?: string,
  orderedKeys?: string[],
): void {
  const cm = ColorMap.fromLookup(name, record, fallback);
  register(cm, { public: true });

  // Store palette definition for public lookup
  // Use provided order or fall back to alphabetical (Object.entries preserves insertion order in modern JS)
  const keys = orderedKeys ?? Object.keys(record).sort();
  const entries: PaletteEntry[] = keys.map((label) => ({
    label,
    color: record[label],
  }));
  PUBLIC_PALETTE_DEFINITIONS.set(name, {
    name,
    kind: "element",
    size: entries.length,
    entries,
  });
}

// ============================================================================
// Initialization: register all palettes
// ============================================================================

// Ordered element symbols (H first, then periodic table order)
const ELEMENT_ORDER = [
  "H",
  "He",
  "Li",
  "Be",
  "B",
  "C",
  "N",
  "O",
  "F",
  "Ne",
  "Na",
  "Mg",
  "Al",
  "Si",
  "P",
  "S",
  "Cl",
  "Ar",
  "K",
  "Ca",
  "Sc",
  "Ti",
  "V",
  "Cr",
  "Mn",
  "Fe",
  "Co",
  "Ni",
  "Cu",
  "Zn",
  "Ga",
  "Ge",
  "As",
  "Se",
  "Br",
  "Kr",
  "Rb",
  "Sr",
  "Y",
  "Zr",
  "Nb",
  "Mo",
  "Tc",
  "Ru",
  "Rh",
  "Pd",
  "Ag",
  "Cd",
  "In",
  "Sn",
  "Sb",
  "Te",
  "I",
  "Xe",
  "Cs",
  "Ba",
  "La",
  "Ce",
  "Pr",
  "Nd",
  "Pm",
  "Sm",
  "Eu",
  "Gd",
  "Tb",
  "Dy",
  "Ho",
  "Er",
  "Tm",
  "Yb",
  "Lu",
  "Hf",
  "Ta",
  "W",
  "Re",
  "Os",
  "Ir",
  "Pt",
  "Au",
  "Hg",
  "Tl",
  "Pb",
  "Bi",
  "Po",
  "At",
  "Rn",
  "Fr",
  "Ra",
  "Ac",
  "Th",
  "Pa",
  "U",
  "Np",
  "Pu",
  "Am",
  "Cm",
  "Bk",
  "Cf",
  "Es",
  "Fm",
  "Md",
  "No",
  "Lr",
  "Rf",
  "Db",
  "Sg",
  "Bh",
  "Hs",
  "Mt",
  "Ds",
  "Rg",
  "Cn",
  "Nh",
  "Fl",
  "Mc",
  "Lv",
  "Ts",
  "Og",
];

// Register cpk (118 elements)
registerLookup("cpk", CPK_RECORD, undefined, ELEMENT_ORDER);

// Register ovito (118 elements)
registerLookup("ovito", OVITO_RECORD, "#CCCCCC", ELEMENT_ORDER);

// Register glasbey-vivid (256 categorical colors)
register(
  ColorMap.fromPalette(
    DEFAULT_CATEGORICAL_COLOR_MAP,
    Array.from(GLASBEY_VIVID_COLORS),
  ),
);

// Register viridis (internal, continuous, not public)
register(
  ColorMap.fromLUT(
    INTERNAL_NUMERIC_COLOR_MAP,
    lut([
      0.058, 0.0, 0.089, 0.062, 0.004, 0.116, 0.065, 0.009, 0.145, 0.065, 0.017,
      0.173, 0.063, 0.027, 0.202, 0.059, 0.039, 0.223, 0.054, 0.053, 0.239,
      0.048, 0.069, 0.251, 0.042, 0.089, 0.26, 0.036, 0.109, 0.266, 0.032, 0.13,
      0.269, 0.028, 0.152, 0.271, 0.024, 0.179, 0.272, 0.021, 0.205, 0.272,
      0.018, 0.232, 0.27, 0.016, 0.262, 0.267, 0.014, 0.298, 0.261, 0.013,
      0.332, 0.252, 0.014, 0.368, 0.24, 0.018, 0.406, 0.225, 0.027, 0.45, 0.203,
      0.042, 0.49, 0.181, 0.064, 0.531, 0.157, 0.097, 0.571, 0.131, 0.149,
      0.614, 0.102, 0.211, 0.65, 0.076, 0.291, 0.682, 0.053, 0.39, 0.711, 0.034,
      0.525, 0.739, 0.018, 0.665, 0.76, 0.01, 0.82, 0.78, 0.01, 0.985, 0.8,
      0.018,
    ]),
  ),
  { public: false },
);
