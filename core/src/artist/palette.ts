import chroma from "chroma-js";

// Extended element data including isotopes and superheavy elements
const ELEMENT_DATABASE = {
  // Standard elements (1-118) with complete data
  H: { radius: 0.38, color: "#FFFFFF", name: "Hydrogen" },
  He: { radius: 0.32, color: "#D9FFFF", name: "Helium" },
  Li: { radius: 1.34, color: "#CC80FF", name: "Lithium" },
  Be: { radius: 0.9, color: "#C2FF00", name: "Beryllium" },
  B: { radius: 0.82, color: "#FFB5B5", name: "Boron" },
  C: { radius: 0.77, color: "#909090", name: "Carbon" },
  N: { radius: 0.75, color: "#3050F8", name: "Nitrogen" },
  O: { radius: 0.73, color: "#FF0D0D", name: "Oxygen" },
  F: { radius: 0.71, color: "#90E050", name: "Fluorine" },
  Ne: { radius: 0.69, color: "#B3E3F5", name: "Neon" },
  Na: { radius: 1.54, color: "#AB5CF2", name: "Sodium" },
  Mg: { radius: 1.3, color: "#8AFF00", name: "Magnesium" },
  Al: { radius: 1.18, color: "#BFA6A6", name: "Aluminum" },
  Si: { radius: 1.11, color: "#F0C8A0", name: "Silicon" },
  P: { radius: 1.06, color: "#FF8000", name: "Phosphorus" },
  S: { radius: 1.02, color: "#FFFF30", name: "Sulfur" },
  Cl: { radius: 0.99, color: "#1FF01F", name: "Chlorine" },
  Ar: { radius: 0.97, color: "#80D1E3", name: "Argon" },
  K: { radius: 1.96, color: "#8F40D4", name: "Potassium" },
  Ca: { radius: 1.74, color: "#3DFF00", name: "Calcium" },
  Sc: { radius: 1.44, color: "#E6E6E6", name: "Scandium" },
  Ti: { radius: 1.32, color: "#BFC2C7", name: "Titanium" },
  V: { radius: 1.22, color: "#A6A6AB", name: "Vanadium" },
  Cr: { radius: 1.18, color: "#8A99C7", name: "Chromium" },
  Mn: { radius: 1.17, color: "#9C7AC7", name: "Manganese" },
  Fe: { radius: 1.17, color: "#E06633", name: "Iron" },
  Co: { radius: 1.16, color: "#F090A0", name: "Cobalt" },
  Ni: { radius: 1.15, color: "#50D050", name: "Nickel" },
  Cu: { radius: 1.17, color: "#C88033", name: "Copper" },
  Zn: { radius: 1.25, color: "#7D80B0", name: "Zinc" },
  Ga: { radius: 1.26, color: "#C28F8F", name: "Gallium" },
  Ge: { radius: 1.22, color: "#668F8F", name: "Germanium" },
  As: { radius: 1.19, color: "#BD80E3", name: "Arsenic" },
  Se: { radius: 1.2, color: "#FFA100", name: "Selenium" },
  Br: { radius: 1.2, color: "#A62929", name: "Bromine" },
  Kr: { radius: 1.16, color: "#5CB8D1", name: "Krypton" },
  Rb: { radius: 2.1, color: "#702EB0", name: "Rubidium" },
  Sr: { radius: 1.85, color: "#00FF00", name: "Strontium" },
  Y: { radius: 1.63, color: "#94FFFF", name: "Yttrium" },
  Zr: { radius: 1.54, color: "#94E0E0", name: "Zirconium" },
  Nb: { radius: 1.47, color: "#73C2C9", name: "Niobium" },
  Mo: { radius: 1.38, color: "#54B5B5", name: "Molybdenum" },
  Tc: { radius: 1.28, color: "#3B9E9E", name: "Technetium" },
  Ru: { radius: 1.25, color: "#248F8F", name: "Ruthenium" },
  Rh: { radius: 1.25, color: "#0A7D8C", name: "Rhodium" },
  Pd: { radius: 1.2, color: "#006985", name: "Palladium" },
  Ag: { radius: 1.28, color: "#C0C0C0", name: "Silver" },
  Cd: { radius: 1.36, color: "#FFD98F", name: "Cadmium" },
  In: { radius: 1.42, color: "#A67573", name: "Indium" },
  Sn: { radius: 1.4, color: "#668080", name: "Tin" },
  Sb: { radius: 1.4, color: "#9E63B5", name: "Antimony" },
  Te: { radius: 1.36, color: "#D47A00", name: "Tellurium" },
  I: { radius: 1.33, color: "#940094", name: "Iodine" },
  Xe: { radius: 1.31, color: "#429EB0", name: "Xenon" },
  Cs: { radius: 2.25, color: "#57178F", name: "Cesium" },
  Ba: { radius: 1.98, color: "#00C900", name: "Barium" },
  La: { radius: 1.69, color: "#70D4FF", name: "Lanthanum" },
  Ce: { radius: 1.65, color: "#FFFFC7", name: "Cerium" },
  Pr: { radius: 1.65, color: "#D9FFC7", name: "Praseodymium" },
  Nd: { radius: 1.64, color: "#C7FFC7", name: "Neodymium" },
  Pm: { radius: 1.63, color: "#A3FFC7", name: "Promethium" },
  Sm: { radius: 1.62, color: "#8FFFC7", name: "Samarium" },
  Eu: { radius: 1.61, color: "#61FFC7", name: "Europium" },
  Gd: { radius: 1.6, color: "#45FFC7", name: "Gadolinium" },
  Tb: { radius: 1.59, color: "#30FFC7", name: "Terbium" },
  Dy: { radius: 1.58, color: "#1FFFC7", name: "Dysprosium" },
  Ho: { radius: 1.57, color: "#00FF9C", name: "Holmium" },
  Er: { radius: 1.56, color: "#00E675", name: "Erbium" },
  Tm: { radius: 1.55, color: "#00D452", name: "Thulium" },
  Yb: { radius: 1.54, color: "#00BF38", name: "Ytterbium" },
  Lu: { radius: 1.53, color: "#00AB24", name: "Lutetium" },
  Hf: { radius: 1.52, color: "#4DC2FF", name: "Hafnium" },
  Ta: { radius: 1.51, color: "#4DA6FF", name: "Tantalum" },
  W: { radius: 1.5, color: "#2194D6", name: "Tungsten" },
  Re: { radius: 1.49, color: "#267DAB", name: "Rhenium" },
  Os: { radius: 1.48, color: "#266696", name: "Osmium" },
  Ir: { radius: 1.47, color: "#175487", name: "Iridium" },
  Pt: { radius: 1.46, color: "#D0D0E0", name: "Platinum" },
  Au: { radius: 1.45, color: "#FFD123", name: "Gold" },
  Hg: { radius: 1.44, color: "#B8B8D0", name: "Mercury" },
  Tl: { radius: 1.43, color: "#A6544D", name: "Thallium" },
  Pb: { radius: 1.42, color: "#575961", name: "Lead" },
  Bi: { radius: 1.41, color: "#9E4FB5", name: "Bismuth" },
  Po: { radius: 1.4, color: "#AB5C00", name: "Polonium" },
  At: { radius: 1.39, color: "#754F45", name: "Astatine" },
  Rn: { radius: 1.38, color: "#428296", name: "Radon" },
  Fr: { radius: 1.37, color: "#420066", name: "Francium" },
  Ra: { radius: 1.36, color: "#007D00", name: "Radium" },
  Ac: { radius: 1.35, color: "#70ABFA", name: "Actinium" },
  Th: { radius: 1.34, color: "#00BAFF", name: "Thorium" },
  Pa: { radius: 1.33, color: "#00A1FF", name: "Protactinium" },
  U: { radius: 1.32, color: "#008FFF", name: "Uranium" },
  Np: { radius: 1.31, color: "#0080FF", name: "Neptunium" },
  Pu: { radius: 1.3, color: "#006BFF", name: "Plutonium" },
  Am: { radius: 1.29, color: "#545CF2", name: "Americium" },
  Cm: { radius: 1.28, color: "#785CE3", name: "Curium" },
  Bk: { radius: 1.27, color: "#8A4FE3", name: "Berkelium" },
  Cf: { radius: 1.26, color: "#A136D4", name: "Californium" },
  Es: { radius: 1.25, color: "#B31FD4", name: "Einsteinium" },
  Fm: { radius: 1.24, color: "#B31FBA", name: "Fermium" },
  Md: { radius: 1.23, color: "#B30DA6", name: "Mendelevium" },
  No: { radius: 1.22, color: "#BD0D87", name: "Nobelium" },
  Lr: { radius: 1.21, color: "#C70066", name: "Lawrencium" },
  Rf: { radius: 1.2, color: "#CC0059", name: "Rutherfordium" },
  Db: { radius: 1.19, color: "#D1004F", name: "Dubnium" },
  Sg: { radius: 1.18, color: "#D90045", name: "Seaborgium" },
  Bh: { radius: 1.17, color: "#E00038", name: "Bohrium" },
  Hs: { radius: 1.16, color: "#E6002E", name: "Hassium" },
  Mt: { radius: 1.15, color: "#EB0026", name: "Meitnerium" },
  Ds: { radius: 1.14, color: "#FF1493", name: "Darmstadtium" },
  Rg: { radius: 1.13, color: "#FF1493", name: "Roentgenium" },
  Cn: { radius: 1.12, color: "#FF1493", name: "Copernicium" },
  Nh: { radius: 1.11, color: "#FF1493", name: "Nihonium" },
  Fl: { radius: 1.1, color: "#FF1493", name: "Flerovium" },
  Mc: { radius: 1.09, color: "#FF1493", name: "Moscovium" },
  Lv: { radius: 1.08, color: "#FF1493", name: "Livermorium" },
  Ts: { radius: 1.07, color: "#FF1493", name: "Tennessine" },
  Og: { radius: 1.06, color: "#FF1493", name: "Oganesson" },
  
  // Superheavy elements (119-126)
  Uue: { radius: 1.05, color: "#FF1493", name: "Ununennium" },
  Ubn: { radius: 1.04, color: "#FF1493", name: "Unbinilium" },
  Ubu: { radius: 1.03, color: "#FF1493", name: "Unbiunium" },
  Ubb: { radius: 1.02, color: "#FF1493", name: "Unbibium" },
  Ubt: { radius: 1.01, color: "#FF1493", name: "Unbitrium" },
  Ubq: { radius: 1.0, color: "#FF1493", name: "Unbiquadium" },
  Ubp: { radius: 0.99, color: "#FF1493", name: "Unbipentium" },
  Ubh: { radius: 0.98, color: "#FF1493", name: "Unbihexium" },
  
  // Common isotopes and special cases
  "D": { radius: 0.38, color: "#87CEEB", name: "Deuterium" },
  "T": { radius: 0.38, color: "#4682B4", name: "Tritium" },
  "13C": { radius: 0.77, color: "#708090", name: "Carbon-13" },
  "14C": { radius: 0.77, color: "#556B2F", name: "Carbon-14" },
  "15N": { radius: 0.75, color: "#191970", name: "Nitrogen-15" },
  "18O": { radius: 0.73, color: "#8B0000", name: "Oxygen-18" },
  
  // Special atoms and groups
  "X": { radius: 1.0, color: "#FFD700", name: "Unknown" },
  "R": { radius: 1.0, color: "#32CD32", name: "Generic" },
  "Me": { radius: 1.0, color: "#FF6347", name: "Methyl" },
  "Et": { radius: 1.0, color: "#FF4500", name: "Ethyl" },
  "Ph": { radius: 1.0, color: "#FF69B4", name: "Phenyl" },
  "Bu": { radius: 1.0, color: "#FF8C00", name: "Butyl" },
  
  // Default fallback
  undefined: { radius: 1.0, color: "#CCCCCC", name: "Unknown" }
};

// Color themes for different visualization styles
const COLOR_THEMES: { [key: string]: ColorTheme } = {
  "jmol": {
    name: "Jmol Style",
    description: "Classic molecular visualization colors",
    colors: {
      H: "#FFFFFF", C: "#909090", N: "#3050F8", O: "#FF0D0D",
      F: "#90E050", P: "#FF8000", S: "#FFFF30", Cl: "#1FF01F",
      Br: "#A62929", I: "#940094", Na: "#AB5CF2", Mg: "#8AFF00",
      Ca: "#3DFF00", Fe: "#E06633", Cu: "#C88033", Zn: "#7D80B0"
    }
  },
  "rasmol": {
    name: "RasMol Style", 
    description: "Traditional RasMol color scheme",
    colors: {
      H: "#FFFFFF", C: "#C8C8C8", N: "#8F8FFF", O: "#FF0000",
      F: "#90E050", P: "#FFA500", S: "#FFFF00", Cl: "#00FF00",
      Br: "#A52A2A", I: "#800080", Na: "#0000FF", Mg: "#00FF00",
      Ca: "#8080FF", Fe: "#FFA500", Cu: "#808080", Zn: "#808080"
    }
  },
  "modern": {
    name: "Modern Minimal",
    description: "Clean, modern color scheme",
    colors: {
      H: "#F8F9FA", C: "#6C757D", N: "#007BFF", O: "#DC3545",
      F: "#28A745", P: "#FFC107", S: "#FFC107", Cl: "#20C997",
      Br: "#6F42C1", I: "#E83E8C", Na: "#6610F2", Mg: "#28A745",
      Ca: "#17A2B8", Fe: "#FD7E14", Cu: "#6F42C1", Zn: "#6C757D"
    }
  },
  "vivid": {
    name: "Vivid Bright",
    description: "High contrast, vibrant colors",
    colors: {
      H: "#FFFFFF", C: "#000000", N: "#0000FF", O: "#FF0000",
      F: "#00FF00", P: "#FF00FF", S: "#FFFF00", Cl: "#00FFFF",
      Br: "#FF8000", I: "#8000FF", Na: "#FF0080", Mg: "#80FF00",
      Ca: "#0080FF", Fe: "#FF4000", Cu: "#804000", Zn: "#408000"
    }
  },
  "pastel": {
    name: "Soft Pastel",
    description: "Gentle, pastel color scheme",
    colors: {
      H: "#F8F9FA", C: "#E9ECEF", N: "#D1ECF1", O: "#F8D7DA",
      F: "#D4EDDA", P: "#FFF3CD", S: "#FFF3CD", Cl: "#D1ECF1",
      Br: "#E2D9F3", I: "#F8D7DA", Na: "#E2D9F3", Mg: "#D4EDDA",
      Ca: "#D1ECF1", Fe: "#F8D7DA", Cu: "#E2D9F3", Zn: "#E9ECEF"
    }
  }
};

// Molecular classification patterns
const MOLECULE_CLASSIFICATIONS: { [key: string]: MoleculeType } = {
  "organic": {
    name: "Organic Molecules",
    description: "Carbon-based compounds",
    elements: ["C", "H", "N", "O", "P", "S", "F", "Cl", "Br", "I"],
    preferredTheme: "jmol",
    colorMapping: {
      "C": "#909090", "H": "#FFFFFF", "N": "#3050F8", "O": "#FF0D0D",
      "P": "#FF8000", "S": "#FFFF30", "F": "#90E050", "Cl": "#1FF01F"
    }
  },
  "protein": {
    name: "Proteins",
    description: "Amino acid chains",
    elements: ["C", "H", "N", "O", "S"],
    preferredTheme: "rasmol",
    colorMapping: {
      "C": "#C8C8C8", "H": "#FFFFFF", "N": "#8F8FFF", "O": "#FF0000", "S": "#FFFF00"
    }
  },
  "nucleic": {
    name: "Nucleic Acids",
    description: "DNA/RNA structures",
    elements: ["C", "H", "N", "O", "P"],
    preferredTheme: "modern",
    colorMapping: {
      "C": "#6C757D", "H": "#F8F9FA", "N": "#007BFF", "O": "#DC3545", "P": "#FFC107"
    }
  },
  "inorganic": {
    name: "Inorganic Compounds",
    description: "Metal complexes and salts",
    elements: ["Fe", "Cu", "Zn", "Na", "K", "Ca", "Mg", "Cl", "O"],
    preferredTheme: "vivid",
    colorMapping: {
      "Fe": "#FF4000", "Cu": "#804000", "Zn": "#408000", "Na": "#FF0080",
      "K": "#8000FF", "Ca": "#0080FF", "Mg": "#80FF00", "Cl": "#00FFFF", "O": "#FF0000"
    }
  },
  "crystal": {
    name: "Crystalline Solids",
    description: "Periodic structures",
    elements: ["Si", "Al", "Ti", "O", "Fe", "Cu", "Ag", "Au"],
    preferredTheme: "pastel",
    colorMapping: {
      "Si": "#F0C8A0", "Al": "#BFA6A6", "Ti": "#BFC2C7", "O": "#F8D7DA",
      "Fe": "#F8D7DA", "Cu": "#E2D9F3", "Ag": "#E9ECEF", "Au": "#FFF3CD"
    }
  }
};

// Color mapping schemes for continuous properties
const COLOR_SCHEMES: { [key: string]: ColorScheme } = {
  "charge": {
    name: "Charge Distribution",
    description: "Red (negative) to Blue (positive)",
    colors: ["#FF0000", "#FFFFFF", "#0000FF"],
    domain: [-1, 0, 1]
  },
  "temperature": {
    name: "Temperature",
    description: "Blue (cold) to Red (hot)",
    colors: ["#0000FF", "#00FFFF", "#FFFF00", "#FF0000"],
    domain: [0, 0.33, 0.67, 1]
  },
  "pressure": {
    name: "Pressure",
    description: "Green (low) to Red (high)",
    colors: ["#00FF00", "#FFFF00", "#FF0000"],
    domain: [0, 0.5, 1]
  },
  "density": {
    name: "Density",
    description: "Transparent to Opaque",
    colors: ["rgba(0,0,0,0)", "rgba(0,0,0,0.5)", "rgba(0,0,0,1)"],
    domain: [0, 0.5, 1]
  },
  "energy": {
    name: "Energy",
    description: "Green (stable) to Red (unstable)",
    colors: ["#00FF00", "#FFFF00", "#FF0000"],
    domain: [0, 0.5, 1]
  },
  "custom": {
    name: "Custom",
    description: "User-defined gradient",
    colors: ["#FF0000", "#00FF00", "#0000FF"],
    domain: [0, 0.5, 1]
  }
};

export interface ElementInfo {
  radius: number;
  color: string;
  name: string;
}

export interface ColorTheme {
  name: string;
  description: string;
  colors: { [key: string]: string };
}

export interface MoleculeType {
  name: string;
  description: string;
  elements: string[];
  preferredTheme: string;
  colorMapping: { [key: string]: string };
}

export interface ColorScheme {
  name: string;
  description: string;
  colors: string[];
  domain: number[];
}

export interface PaletteConfig {
  theme?: string;
  customColors?: { [key: string]: string };
  gradientProperty?: string;
  gradientScheme?: string;
  gradientRange?: [number, number];
}

class MolecularPalette {
  private currentTheme: string = "jmol";
  private customColors: { [key: string]: string } = {};
  private gradientProperty: string | null = null;
  private gradientScheme: string = "charge";
  private gradientRange: [number, number] = [0, 1];
  private detectedMoleculeType: string | null = null;

  constructor(config: PaletteConfig = {}) {
    this.configure(config);
  }

  public configure(config: PaletteConfig): void {
    if (config.theme) this.currentTheme = config.theme;
    if (config.customColors) this.customColors = { ...this.customColors, ...config.customColors };
    if (config.gradientProperty) this.gradientProperty = config.gradientProperty;
    if (config.gradientScheme) this.gradientScheme = config.gradientScheme;
    if (config.gradientRange) this.gradientRange = config.gradientRange;
  }

  public classifyMolecule(atoms: string[]): string {
    const elementCounts: { [key: string]: number } = {};
    
    // Count elements
    for (const element of atoms) {
      elementCounts[element] = (elementCounts[element] || 0) + 1;
    }
    
    // Calculate scores for each molecule type
    const scores: { [key: string]: number } = {};
    
    for (const [type, pattern] of Object.entries(MOLECULE_CLASSIFICATIONS)) {
      let score = 0;
      for (const element of pattern.elements) {
        if (elementCounts[element]) {
          score += elementCounts[element];
        }
      }
      scores[type] = score / atoms.length;
    }
    
    // Find best match
    let bestType = "organic";
    let bestScore = 0;
    
    for (const [type, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }
    
    this.detectedMoleculeType = bestType;
    return bestType;
  }

  public getColor(element: string, propertyValue?: number): string {
    // Check for custom colors first
    if (this.customColors[element]) {
      return this.customColors[element];
    }
    
    // Check for gradient color mapping
    if (this.gradientProperty && propertyValue !== undefined) {
      return this.getGradientColor(propertyValue);
    }
    
    // Check for molecule-specific colors
    if (this.detectedMoleculeType && MOLECULE_CLASSIFICATIONS[this.detectedMoleculeType]) {
      const pattern = MOLECULE_CLASSIFICATIONS[this.detectedMoleculeType];
      if (pattern.colorMapping[element]) {
        return pattern.colorMapping[element];
      }
    }
    
    // Check for theme colors
    if (COLOR_THEMES[this.currentTheme]) {
      const theme = COLOR_THEMES[this.currentTheme];
      if (theme.colors[element]) {
        return theme.colors[element];
      }
    }
    
    // Fall back to element database
    if (ELEMENT_DATABASE[element]) {
      return ELEMENT_DATABASE[element].color;
    }
    
    // Final fallback
    return ELEMENT_DATABASE.undefined.color;
  }

  public getRadius(element: string): number {
    if (ELEMENT_DATABASE[element]) {
      return ELEMENT_DATABASE[element].radius * 0.8;
    }
    return ELEMENT_DATABASE.undefined.radius;
  }

  public getGradientColor(value: number): string {
    const scheme = COLOR_SCHEMES[this.gradientScheme];
    if (!scheme) return "#CCCCCC";
    
    // Normalize value to [0, 1] range
    const normalizedValue = Math.max(0, Math.min(1, 
      (value - this.gradientRange[0]) / (this.gradientRange[1] - this.gradientRange[0])
    ));
    
    // Find the appropriate color segment
    let colorIndex = 0;
    for (let i = 0; i < scheme.domain.length - 1; i++) {
      if (normalizedValue >= scheme.domain[i] && normalizedValue <= scheme.domain[i + 1]) {
        const segmentStart = scheme.domain[i];
        const segmentEnd = scheme.domain[i + 1];
        const segmentRatio = (normalizedValue - segmentStart) / (segmentEnd - segmentStart);
        
        const color1 = chroma(scheme.colors[i]);
        const color2 = chroma(scheme.colors[i + 1]);
        
        return chroma.mix(color1, color2, segmentRatio, 'rgb').hex();
      }
    }
    
    return scheme.colors[scheme.colors.length - 1];
  }

  public getThemes(): string[] {
    return Object.keys(COLOR_THEMES);
  }

  public getColorSchemes(): string[] {
    return Object.keys(COLOR_SCHEMES);
  }

  public getMoleculeTypes(): string[] {
    return Object.keys(MOLECULE_CLASSIFICATIONS);
  }

  public getThemeInfo(themeName: string): ColorTheme | null {
    return COLOR_THEMES[themeName] || null;
  }

  public getColorSchemeInfo(schemeName: string): ColorScheme | null {
    return COLOR_SCHEMES[schemeName] || null;
  }

  public getMoleculeTypeInfo(typeName: string): MoleculeType | null {
    return MOLECULE_CLASSIFICATIONS[typeName] || null;
  }

  public getElementDatabase(): { [key: string]: ElementInfo } {
    return { ...ELEMENT_DATABASE };
  }
}

// Create and export the molecular palette instance
const molecularPalette = new MolecularPalette();

export { molecularPalette, MolecularPalette, COLOR_THEMES, COLOR_SCHEMES, MOLECULE_CLASSIFICATIONS, ELEMENT_DATABASE };

// For backward compatibility, export the old palette as well
class RealAtomPalette extends MolecularPalette {
  constructor() {
    super({ theme: "jmol" });
  }
}

const realAtomPalette = new RealAtomPalette();
export { realAtomPalette };
