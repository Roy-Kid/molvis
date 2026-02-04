import { PeriodicTable } from "../../system/elements";
import type { AtomStyle, BondStyle, Theme } from "../theme";

const MODERN_COLORS: Record<string, string> = {
  H: "#FFFFFF",
  C: "#333333", // Dark gray carbon
  N: "#2980B9", // Flat blue
  O: "#C0392B", // Flat red
  S: "#F39C12", // Flat yellow
  P: "#E67E22", // Flat orange
  F: "#27AE60", // Flat green
  Cl: "#16A085", // Teal
  Br: "#8E44AD", // Purple
  I: "#8E44AD", // Purple
};

export class ModernTheme implements Theme {
  public readonly name = "Modern";

  public readonly backgroundColor = "#1E1E1E"; // Dark gray background
  public readonly selectionColor = "#E74C3C"; // Bright red selection
  public readonly boxColor = "#FFFFFF"; // White box
  public readonly defaultSpecular = "#888888"; // More reflective

  public getAtomStyle(element: string): AtomStyle {
    const color = MODERN_COLORS[element] || "#95A5A6"; // Concrete gray fallback
    const radius = (PeriodicTable[element]?.radius || 0.3) * 0.8; // Slightly smaller atoms

    return {
      color,
      radius,
      specularColor: "#FFFFFF", // High specular for plastic look
      emissiveColor: "#000000",
    };
  }

  public getBondStyle(_order: number, _type?: string): BondStyle {
    return {
      color: "#BDC3C7", // Light gray bond
      radius: 0.12, // Thicker bonds
      specularColor: "#FFFFFF",
    };
  }
}
