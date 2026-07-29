/**
 * Screen (CSS px relative to canvas) ↔ document (Å-like) coordinates.
 */
export class ViewportCoords {
  private cssWidth = 1;
  private cssHeight = 1;
  private dpr = 1;
  /** Pan in document units. */
  private panX = 0;
  private panY = 0;
  /** Zoom scale (document units per CSS px inverse). */
  private scale = 40;

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.cssWidth = Math.max(1, cssWidth);
    this.cssHeight = Math.max(1, cssHeight);
    this.dpr = Math.max(1e-6, dpr);
  }

  getCssSize(): { width: number; height: number } {
    return { width: this.cssWidth, height: this.cssHeight };
  }

  getDpr(): number {
    return this.dpr;
  }

  getBackingStoreSize(): { width: number; height: number } {
    return {
      width: Math.round(this.cssWidth * this.dpr),
      height: Math.round(this.cssHeight * this.dpr),
    };
  }

  setPan(x: number, y: number): void {
    this.panX = x;
    this.panY = y;
  }

  getPan(): { x: number; y: number } {
    return { x: this.panX, y: this.panY };
  }

  setScale(scale: number): void {
    this.scale = Math.max(1e-6, scale);
  }

  getScale(): number {
    return this.scale;
  }

  /**
   * CSS-pixel point relative to canvas top-left → document coordinates.
   * Origin of document maps to canvas center + pan.
   */
  screenToDoc(sx: number, sy: number): { x: number; y: number } {
    const cx = this.cssWidth / 2;
    const cy = this.cssHeight / 2;
    return {
      x: (sx - cx) / this.scale + this.panX,
      y: (cy - sy) / this.scale + this.panY,
    };
  }

  docToScreen(x: number, y: number): { x: number; y: number } {
    const cx = this.cssWidth / 2;
    const cy = this.cssHeight / 2;
    return {
      x: (x - this.panX) * this.scale + cx,
      y: cy - (y - this.panY) * this.scale,
    };
  }
}
