import { PeriodicTable } from "../../system/elements";
import { hslColorFromString } from "../palette";
import type { AtomStyle, BondStyle, Theme } from "../theme";

const MODERN_COLORS: Record<string, string> = {
  H: "#FFFFFF",
  C: "#333333",
  N: "#2980B9",
  O: "#C0392B",
  S: "#F39C12",
  P: "#E67E22",
  F: "#27AE60",
  Cl: "#16A085",
  Br: "#8E44AD",
  I: "#8E44AD",
};

export class ModernTheme implements Theme {
  public readonly name = "Modern";

  public readonly backgroundColor = "#1E1E1E";
  public readonly selectionColor = "#E74C3C";
  public readonly boxColor = "#FFFFFF";
  public readonly defaultSpecular = "#888888";

  public getAtomStyle(element: string): AtomStyle {
    const color = MODERN_COLORS[element] || "#95A5A6";
    const radius = (PeriodicTable[element]?.radius || 0.3) * 0.8;
    return {
      color,
      radius,
      specularColor: "#FFFFFF",
      emissiveColor: "#000000",
    };
  }

  public getTypeStyle(type: string): AtomStyle {
    return {
      color: hslColorFromString(type),
      radius: 0.4,
      specularColor: "#FFFFFF",
      emissiveColor: "#000000",
    };
  }

  public getBondStyle(_order: number, _type?: string): BondStyle {
    return { color: "#BDC3C7", radius: 0.12, specularColor: "#FFFFFF" };
  }
}
