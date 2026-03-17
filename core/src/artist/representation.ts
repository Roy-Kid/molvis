/**
 * Molecular representation presets.
 *
 * A representation controls how atoms, bonds, and ribbon are rendered
 * by setting radius scales and visibility flags.
 */

export interface RepresentationStyle {
  readonly name: string;
  readonly atomRadiusScale: number;
  readonly bondRadiusScale: number;
  readonly showAtoms: boolean;
  readonly showBonds: boolean;
  readonly showRibbon: boolean;
}

export const BALL_AND_STICK: RepresentationStyle = {
  name: "Ball and Stick",
  atomRadiusScale: 0.6,
  bondRadiusScale: 0.6,
  showAtoms: true,
  showBonds: true,
  showRibbon: false,
} as const;

export const SPACEFILL: RepresentationStyle = {
  name: "Spacefill",
  atomRadiusScale: 1.0,
  bondRadiusScale: 0.0,
  showAtoms: true,
  showBonds: false,
  showRibbon: false,
} as const;

export const STICK: RepresentationStyle = {
  name: "Stick",
  atomRadiusScale: 0.25,
  bondRadiusScale: 0.8,
  showAtoms: true,
  showBonds: true,
  showRibbon: false,
} as const;

export const WIREFRAME: RepresentationStyle = {
  name: "Wireframe",
  atomRadiusScale: 0.0,
  bondRadiusScale: 0.15,
  showAtoms: false,
  showBonds: true,
  showRibbon: false,
} as const;

export const RIBBON: RepresentationStyle = {
  name: "Ribbon",
  atomRadiusScale: 0.0,
  bondRadiusScale: 0.0,
  showAtoms: false,
  showBonds: false,
  showRibbon: true,
} as const;

export const RIBBON_AND_STICK: RepresentationStyle = {
  name: "Ribbon + Stick",
  atomRadiusScale: 0.15,
  bondRadiusScale: 0.4,
  showAtoms: true,
  showBonds: true,
  showRibbon: true,
} as const;

export const REPRESENTATIONS: readonly RepresentationStyle[] = [
  BALL_AND_STICK,
  SPACEFILL,
  STICK,
  WIREFRAME,
  RIBBON,
  RIBBON_AND_STICK,
] as const;

export function findRepresentation(
  name: string,
): RepresentationStyle | undefined {
  return REPRESENTATIONS.find((r) => r.name === name);
}
