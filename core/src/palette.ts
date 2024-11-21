import chroma from "chroma-js";
import { Atom } from "./system";

const stringToHash = (str: string | undefined): number => {
  if (str === undefined) {
    return 0;
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

class RealAtomPalette {
  style: string;
  color: string[];
  element_radius: { [key: string]: number };

  constructor(style: string = "Set1") {
    this.style = style;
    this.color = chroma.scale("Set1").mode("lch").colors(40);

    this.element_radius = {
      undefined: 1.0,
      H: 0.38,
      He: 0.32,
      Li: 1.34,
      Be: 0.9,
      B: 0.82,
      C: 0.77,
      N: 0.75,
      O: 0.73,
      F: 0.71,
      Ne: 0.69,
      Na: 1.54,
      Mg: 1.3,
      Al: 1.18,
      Si: 1.11,
      P: 1.06,
      S: 1.02,
      Cl: 0.99,
      Ar: 0.97,
      K: 1.96,
      Ca: 1.74,
      Sc: 1.44,
      Ti: 1.32,
      V: 1.22,
      Cr: 1.18,
      Mn: 1.17,
      Fe: 1.17,
      Co: 1.16,
      Ni: 1.15,
      Cu: 1.17,
      Zn: 1.25,
      Ga: 1.26,
      Ge: 1.22,
      As: 1.19,
      Se: 1.2,
      Br: 1.2,
      Kr: 1.16,
      Rb: 2.1,
      Sr: 1.85,
      Y: 1.63,
      Zr: 1.54,
      Nb: 1.47,
      Mo: 1.38,
      Tc: 1.28,
      Ru: 1.25,
      Rh: 1.25,
      Pd: 1.2,
      Ag: 1.28,
      Cd: 1.36,
      In: 1.42,
      Sn: 1.4,
      Sb: 1.4,
      Te: 1.36,
      I: 1.33,
      Xe: 1.31,
      Cs: 2.25,
      Ba: 1.98,
      La: 1.69,
      Ce: 1.65,
      Pr: 1.65,
      Nd: 1.64,
      Pm: 1.63,
    };
  }
  public get_color(elem_or_type: string) {
    const hash = stringToHash(elem_or_type);
    return this.color[hash % this.color.length];
  }

  public get_radius(elem_or_type: string) {
    return this.element_radius[elem_or_type]*1.2 || 1.0;
  }
} // RealAtomPalette

const real_atom_palette = new RealAtomPalette();

export { real_atom_palette, };