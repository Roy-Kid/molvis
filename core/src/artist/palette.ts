/**
 * Categorical color palette for arbitrary string labels.
 *
 * Uses FNV-1a + Murmur3 finalization for good avalanche on short strings,
 * then maps different hash bit ranges to H/S/L for maximum visual separation.
 */
export function hslColorFromString(label: string): string {
  // FNV-1a hash
  let h = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Murmur3 finalization mix — critical for short strings (1-3 chars)
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  h >>>= 0;

  // Use different bit ranges for H, S, L to break collisions
  const hue = (h & 0xffff) % 360;
  const sat = 0.55 + (((h >>> 16) & 0xff) / 255) * 0.2; // 55%–75%
  const lit = 0.45 + (((h >>> 24) & 0xff) / 255) * 0.15; // 45%–60%

  // HSL → RGB → hex
  const a = sat * Math.min(lit, 1 - lit);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const c = lit - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/**
 * Convert hex color string to linear RGB [r, g, b] in [0, 1].
 * Applies sRGB → linear conversion.
 */
export function hexToLinearRgb(hex: string): [number, number, number] {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = Number.parseInt(h.slice(0, 2), 16) / 255;
  const g = Number.parseInt(h.slice(2, 4), 16) / 255;
  const b = Number.parseInt(h.slice(4, 6), 16) / 255;
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
