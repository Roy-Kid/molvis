import type { ViewportCoords } from "./coords";

/**
 * Pan/zoom helpers operating on ViewportCoords.
 */
export class ViewportController {
  constructor(private readonly coords: ViewportCoords) {}

  panByScreen(dxCss: number, dyCss: number): void {
    const scale = this.coords.getScale();
    const pan = this.coords.getPan();
    // screen +x → doc -?  doc x increases to the right on screen via scale
    this.coords.setPan(pan.x - dxCss / scale, pan.y + dyCss / scale);
  }

  /**
   * Zoom about a screen (CSS) point so that world point under cursor stays fixed.
   */
  zoomAtScreen(sx: number, sy: number, factor: number): void {
    const before = this.coords.screenToDoc(sx, sy);
    this.coords.setScale(this.coords.getScale() * factor);
    const after = this.coords.screenToDoc(sx, sy);
    const pan = this.coords.getPan();
    this.coords.setPan(
      pan.x + (before.x - after.x),
      pan.y + (before.y - after.y),
    );
  }

  fitToAtoms(
    atoms: Array<{ x: number; y: number }>,
    paddingCss = 40,
  ): void {
    if (atoms.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const a of atoms) {
      minX = Math.min(minX, a.x);
      minY = Math.min(minY, a.y);
      maxX = Math.max(maxX, a.x);
      maxY = Math.max(maxY, a.y);
    }
    const { width, height } = this.coords.getCssSize();
    const dx = Math.max(maxX - minX, 0.5);
    const dy = Math.max(maxY - minY, 0.5);
    const sx = (width - 2 * paddingCss) / dx;
    const sy = (height - 2 * paddingCss) / dy;
    this.coords.setScale(Math.max(10, Math.min(sx, sy)));
    this.coords.setPan((minX + maxX) / 2, (minY + maxY) / 2);
  }
}
