import { PeriodicTable } from "../../system/elements";
import { DEFAULT_CATEGORICAL_COLOR_MAP, getColorMap } from "../palette";
import type { AtomStyle, BondStyle, Theme } from "../theme";

const cpk = getColorMap("cpk");
const categorical = getColorMap(DEFAULT_CATEGORICAL_COLOR_MAP);

export class ClassicTheme implements Theme {
  public readonly name = "Classic";

  public readonly backgroundColor = "#000000";
  public readonly selectionColor = "#89CFF0";
  public readonly defaultSpecular = "#4D4D4D";
  public readonly boxColor = "#FFFFFF";

  public getAtomStyle(element: string): AtomStyle {
    const [r, g, b] = cpk.colorForKey(element);
    const toHex = (v: number) => {
      const s = Math.round(Math.min(1, Math.max(0, v)) ** (1 / 2.2) * 255);
      return s.toString(16).padStart(2, "0");
    };
    const color = `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    const radius = PeriodicTable[element]?.radius || 0.3;
    return { color, radius };
  }

  public getTypeStyle(type: string): AtomStyle {
    const [r, g, b] = categorical.colorForKey(type);
    const toHex = (v: number) => {
      const s = Math.round(Math.min(1, Math.max(0, v)) ** (1 / 2.2) * 255);
      return s.toString(16).padStart(2, "0");
    };
    return {
      color: `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase(),
      radius: 0.5,
    };
  }

  public getBondStyle(_order: number, _type?: string): BondStyle {
    return { color: "#808080", radius: 0.1 };
  }
}
