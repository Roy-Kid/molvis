import { type BracketVariant, bracketCommands } from "../annotations";

const SVG_NS = "http://www.w3.org/2000/svg";

export function svgIcon(paths: string, viewBox = "0 0 24 24"): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.75");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = paths;
  return svg;
}

export function bondOrderIcon(order: 1 | 2 | 3): SVGSVGElement {
  const lines = order === 1 ? [12] : order === 2 ? [9, 15] : [7.5, 12, 16.5];
  return svgIcon(lines.map((y) => `<path d="M4 ${y}h16"/>`).join(""));
}

export function ringSizeIcon(size: number, aromatic = false): SVGSVGElement {
  const points = Array.from({ length: size }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / size;
    return `${12 + Math.cos(angle) * 8},${12 + Math.sin(angle) * 8}`;
  }).join(" ");
  return svgIcon(
    `<polygon points="${points}"/>${aromatic ? '<circle cx="12" cy="12" r="4.3"/>' : ""}`,
  );
}

export function chargeDeltaIcon(delta: 1 | -1): SVGSVGElement {
  return svgIcon(
    `<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>${delta > 0 ? '<path d="M12 8v8"/>' : ""}`,
  );
}

export function stereoModeIcon(mode: "none" | "up" | "down"): SVGSVGElement {
  if (mode === "up") {
    return svgIcon(
      `<polygon points="4,19 20,5 9,17" fill="currentColor" stroke="none"/>`,
    );
  }
  if (mode === "down") {
    return svgIcon(`<path d="M4 19l3-1M7 16l4-1M10 13l5-2M14 9l5-3"/>`);
  }
  return svgIcon(`<path d="M4 18L20 6"/>`);
}

function bracketIcon(variant: BracketVariant): SVGSVGElement {
  const path = bracketCommands(
    { kind: "bracket", x: 0, y: 0, width: 14, height: 16, variant },
    12,
    12,
    1,
  )
    .map((command) => command.join(" "))
    .join(" ");
  return svgIcon(`<path d="${path}"/>`);
}

export const ICONS: Record<string, () => SVGSVGElement> = {
  select: () => svgIcon(`<path d="M4 4l7.5 16 2-7 7-2L4 4z"/>`),
  pan: () =>
    svgIcon(
      `<path d="M7 12.5V7a1.5 1.5 0 0 1 3 0v3-6a1.5 1.5 0 0 1 3 0v6-4a1.5 1.5 0 0 1 3 0v5-2a1.5 1.5 0 0 1 3 0v5c0 4-2 7-6 7h-1c-2 0-3.5-1-5-3l-3-4a1.5 1.5 0 0 1 2.2-2z"/>`,
    ),
  zoomIn: () =>
    svgIcon(
      `<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5M8 10.5h5m-2.5-2.5v5"/>`,
    ),
  zoomOut: () =>
    svgIcon(
      `<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5M8 10.5h5"/>`,
    ),
  erase: () =>
    svgIcon(
      `<path d="M7 21h10"/><path d="M5.5 13.5l7-7a1.5 1.5 0 0 1 2.1 0l3.9 3.9a1.5 1.5 0 0 1 0 2.1l-7 7H5.5v-6z"/>`,
    ),
  view: () =>
    svgIcon(
      `<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.4"/>`,
    ),
  molecule: () =>
    svgIcon(
      `<path d="m8 14 7-6m-7 8 7 2"/><circle cx="6" cy="15" r="2.5"/><circle cx="17" cy="6.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/>`,
    ),
  figure: () =>
    svgIcon(
      `<rect x="3" y="3" width="8" height="8" rx="1"/><circle cx="17" cy="7" r="4"/><path d="M12 13.4l4.6 7.6H7.4L12 13.4z"/>`,
    ),
  text: () => svgIcon(`<path d="M5 8V5h14v3M12 5v14m-4 0h8"/>`),
  fontSize: () =>
    svgIcon(
      `<path d="m3 18 4-10 4 10m-6.7-3h5.4M12 18l4.5-13L21 18m-7.4-4h5.8"/>`,
    ),
  fontSans: () => svgIcon(`<path d="m5 19 7-14 7 14M8 14h8"/>`),
  fontSerif: () => svgIcon(`<path d="m5 19 7-14 7 14M8 14h8M3 19h5m8 0h5"/>`),
  fontMono: () => svgIcon(`<path d="M8 5 3 12l5 7m8-14 5 7-5 7m-2-15-4 16"/>`),
  textColor: () => svgIcon(`<path d="m6 16 6-12 6 12m-10-4h8M4 20h16" />`),
  textBold: () =>
    svgIcon(
      `<path stroke-width="2.5" d="M7 19V5h6a3.5 3.5 0 0 1 0 7H7m6 0a3.5 3.5 0 0 1 0 7H7"/>`,
    ),
  textItalic: () => svgIcon(`<path d="M11 5h8M5 19h8m2-14L9 19"/>`),
  alignLeft: () => svgIcon(`<path d="M4 5h16M4 10h10M4 15h16M4 20h10"/>`),
  alignCenter: () => svgIcon(`<path d="M4 5h16M7 10h10M4 15h16M7 20h10"/>`),
  alignRight: () => svgIcon(`<path d="M4 5h16m-10 5h10M4 15h16m-10 5h10"/>`),
  positionX: () => svgIcon(`<path d="M4 20V4m0 16h16m-4-4 4 4-4 4"/>`),
  positionY: () => svgIcon(`<path d="M4 20h16M4 20V4m-3 3 3-3 3 3"/>`),
  width: () =>
    svgIcon(`<path d="M4 7v10M20 7v10M7 12h10m-7-3-3 3 3 3m4-6 3 3-3 3"/>`),
  height: () =>
    svgIcon(`<path d="M7 4h10M7 20h10M12 7v10m-3-7 3-3 3 3m-6 4 3 3 3-3"/>`),
  rotate: () => svgIcon(`<path d="M20 5v6h-6M20 11a8 8 0 1 0-2 7"/>`),
  cornerRadius: () =>
    svgIcon(
      `<path d="M5 20V12a7 7 0 0 1 7-7h8m-2 3-7 7"/><circle cx="11" cy="15" r="1"/>`,
    ),
  strokeColor: () =>
    svgIcon(`<path d="m5 13 9-9 4 4-9 9H5zm7-7 4 4M4 21h16"/>`),
  strokeWidth: () =>
    svgIcon(
      `<path d="M4 6h16M4 12h16" /><path d="M4 18h16" stroke-width="4"/>`,
    ),
  rectangle: () => svgIcon(`<rect x="4" y="6" width="16" height="12" rx="3"/>`),
  rectanglePlain: () => svgIcon(`<rect x="4" y="6" width="16" height="12"/>`),
  ellipse: () => svgIcon(`<ellipse cx="12" cy="12" rx="8" ry="5.5"/>`),
  circle: () => svgIcon(`<circle cx="12" cy="12" r="8"/>`),
  bracket: () => bracketIcon("square"),
  bracketRound: () => bracketIcon("round"),
  bracketCurly: () => bracketIcon("curly"),
  bracketNone: () => svgIcon(`<path d="M7 4H4v16h3m10-16h3v16h-3M4 20 20 4"/>`),
  fill: () =>
    svgIcon(
      `<path d="m5 13 7-7 7 7-6.2 6.2a1.1 1.1 0 0 1-1.6 0L5 13Zm0 0h14M9 3l5 5m5 8 1.6 2.2a1.5 1.5 0 0 1-2.5 1.7 1.6 1.6 0 0 1 .1-1.7L19 16Z"/>`,
    ),
  fillColor: () =>
    svgIcon(
      `<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="currentColor"/>`,
    ),
  lock: () =>
    svgIcon(
      `<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>`,
    ),
  settings: () =>
    svgIcon(`<path d="M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-5 2v4"/>`),
  duplicate: () =>
    svgIcon(
      `<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 4H5a1 1 0 0 0-1 1v11"/>`,
    ),
  lower: () => svgIcon(`<path d="M12 3v12m-4-4 4 4 4-4M5 20h14"/>`),
  file: () => svgIcon(`<path d="M5 3h9l5 5v13H5zM14 3v5h5M8 13h8m-8 4h8"/>`),
  folder: () => svgIcon(`<path d="M3 6h7l2 2h9v11H3z"/>`),
  save: () => svgIcon(`<path d="M4 4h12l4 4v12H4zm4 0v5h8V4M8 20v-6h8v6"/>`),
  bond: () =>
    svgIcon(
      `<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none"/>`,
    ),
  // Solid nucleus + ring — reads as “place atom”, not Bohr orbits.
  atom: () =>
    svgIcon(
      `<circle cx="12" cy="12" r="5.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9"/>`,
    ),
  ring: () =>
    svgIcon(`<path d="M12 3.2l7.5 4.3v8.6L12 20.4l-7.5-4.3V7.5L12 3.2z"/>`),
  fragment: () =>
    svgIcon(
      // Scaffold + substituent hint
      `<path d="M8 4l4-2 4 2v4l-4 2-4-2V4z"/><path d="M12 10v4"/><path d="M9 16h6"/><path d="M10 18h4"/>`,
    ),
  chain: () => svgIcon(`<path d="M4 16l4-8 4 8 4-8 4 8"/>`),
  charge: () =>
    svgIcon(`<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>`),
  stereo: () =>
    svgIcon(
      `<path d="M5 19L19 5" stroke-width="1.25"/><path d="M5 19L14 8L16 10z" fill="currentColor" stroke="none"/>`,
    ),
  color: () =>
    svgIcon(
      `<path d="M12 3a9 9 0 1 0 0 18h1.5a1.5 1.5 0 0 0 0-3H12a1.5 1.5 0 0 1 0-3h2a7 7 0 0 0-2-12z"/><circle cx="7.5" cy="10" r=".8" fill="currentColor"/><circle cx="10" cy="6.8" r=".8" fill="currentColor"/><circle cx="14" cy="6.8" r=".8" fill="currentColor"/>`,
    ),
  undo: () =>
    svgIcon(`<path d="M9 14L4 9l5-5"/><path d="M4 9h10a5 5 0 0 1 0 10h-3"/>`),
  redo: () =>
    svgIcon(`<path d="M15 14l5-5-5-5"/><path d="M20 9H10a5 5 0 0 0 0 10h3"/>`),
  clear: () =>
    svgIcon(
      `<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M7 7l1 13h8l1-13"/>`,
    ),
  fit: () => svgIcon(`<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`),
  export: () => svgIcon(`<path d="M12 3v12m-5-5 5 5 5-5M5 20h14"/>`),
  /** Overflow / more actions (horizontal ellipsis). */
  more: () =>
    svgIcon(
      `<circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none"/>`,
    ),
  chevron: () => svgIcon(`<path d="M9 6l6 6-6 6"/>`),
  close: () => svgIcon(`<path d="m6 6 12 12M18 6 6 18"/>`),
  check: () => svgIcon(`<path d="m5 12 4 4L19 6"/>`),
};

export const BRACKET_CHOICES = [
  { id: "square", name: "Square brackets", icon: "bracket" },
  { id: "round", name: "Parentheses", icon: "bracketRound" },
  { id: "curly", name: "Curly braces", icon: "bracketCurly" },
  { id: "none", name: "No brackets", icon: "bracketNone" },
] as const satisfies ReadonlyArray<{
  id: BracketVariant;
  name: string;
  icon: string;
}>;

export function parseSvgMarkup(markup: string): SVGSVGElement {
  const parser = new DOMParser();
  const doc = parser.parseFromString(markup, "image/svg+xml");
  const svg = doc.documentElement;
  if (!(svg instanceof SVGSVGElement) || svg.querySelector("parsererror")) {
    // Fallback empty box when exporter markup is unexpected.
    return svgIcon("");
  }
  // Adopt into current document.
  return document.importNode(svg, true);
}
