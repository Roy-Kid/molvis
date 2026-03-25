/**
 * Continuous colormaps for numeric property visualization.
 * Each colormap maps t ∈ [0, 1] → [r, g, b] in linear color space.
 */

export type ColormapName =
  | "viridis"
  | "plasma"
  | "coolwarm"
  | "rainbow"
  | "grayscale";

export const COLORMAP_NAMES: readonly ColormapName[] = [
  "viridis",
  "plasma",
  "coolwarm",
  "rainbow",
  "grayscale",
] as const;

/**
 * Sample a colormap at parameter t ∈ [0, 1].
 * Returns [r, g, b] in linear color space.
 */
export function sampleColormap(
  name: ColormapName,
  t: number,
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  switch (name) {
    case "viridis":
      return viridis(clamped);
    case "plasma":
      return plasma(clamped);
    case "coolwarm":
      return coolwarm(clamped);
    case "rainbow":
      return rainbow(clamped);
    case "grayscale":
      return [clamped, clamped, clamped];
  }
}

// Viridis polynomial approximation (perceptually uniform)
function viridis(t: number): [number, number, number] {
  return [
    clamp(-0.0132 + t * (0.0921 + t * (2.7919 + t * (-5.6854 + t * 3.8137)))),
    clamp(0.0026 + t * (1.5812 + t * (-1.8438 + t * (1.8739 + t * -0.6139)))),
    clamp(0.3301 + t * (1.7474 + t * (-5.5575 + t * (7.4802 + t * -3.4985)))),
  ];
}

// Plasma polynomial approximation
function plasma(t: number): [number, number, number] {
  return [
    clamp(0.0504 + t * (2.0211 + t * (-1.7646 + t * (0.8457 + t * -0.1514)))),
    clamp(0.0298 + t * (-0.5765 + t * (2.8835 + t * (-3.4685 + t * 1.6378)))),
    clamp(0.5298 + t * (1.2336 + t * (-5.4725 + t * (8.3939 + t * -4.1825)))),
  ];
}

// Coolwarm diverging (blue → white → red)
function coolwarm(t: number): [number, number, number] {
  return [
    clamp(
      0.2298 +
        t *
          (0.2801 + t * (2.7966 + t * (-4.7532 + t * (2.6474 + t * -0.2004)))),
    ),
    clamp(
      0.2987 +
        t * (1.8593 + t * (-4.6727 + t * (5.564 + t * (-3.1286 + t * 0.5802)))),
    ),
    clamp(
      0.7537 +
        t *
          (-0.1648 + t * (-0.1638 + t * (1.4282 + t * (-1.8913 + t * 0.5379)))),
    ),
  ];
}

// Rainbow (HSL hue sweep 0° → 300°)
function rainbow(t: number): [number, number, number] {
  const hue = t * 300;
  const sat = 0.9;
  const lit = 0.5;
  const a = sat * Math.min(lit, 1 - lit);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    return lit - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [f(0), f(8), f(4)];
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}
