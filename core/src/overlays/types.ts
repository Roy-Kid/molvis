/**
 * Core types for the Overlay system.
 *
 * Overlays are independent visual decorations rendered directly via BabylonJS.
 * They live outside the modifier pipeline and ImpostorState buffers, and are
 * managed by OverlayManager on MolvisApp.
 */

export type Vec3 = [number, number, number];

/**
 * Base interface for all overlay types.
 */
export interface Overlay {
  readonly id: string;
  readonly type: string;
  visible: boolean;
  /** Release BabylonJS resources held by this overlay. */
  dispose(): void;
  /**
   * Called once per render frame to sync screen-space positions.
   * Only implement for overlays that need per-frame projection (text labels,
   * world-anchored 2D elements). Omit for pure 3D world-space overlays.
   */
  updateScreenPositions?(): void;
}

/** Event map for OverlayManager. */
export interface OverlayEventMap {
  "overlay-added": { overlay: Overlay };
  "overlay-removed": { id: string };
  "overlay-changed": { overlay: Overlay };
}

// ── Arrow3D ──────────────────────────────────────────────────────────────────

export interface Arrow3DProps {
  /** World-space start position. */
  from: Vec3;
  /** World-space end position. */
  to: Vec3;
  /** CSS hex color string. Default: "#ff4444". */
  color?: string;
  /** Opacity 0–1. Default: 1. */
  opacity?: number;
  /** Shaft radius in world units. Default: 0.05. */
  shaftRadius?: number;
  /** Fraction of total length used for the arrowhead. Default: 0.25. */
  headRatio?: number;
  /** Cone base radius. Default: shaftRadius × 3. */
  headRadius?: number;
  /** Optional display name. */
  name?: string;
}

// ── Arrow2D ───────────────────────────────────────────────────────────────────

export interface Arrow2DProps {
  /** World-space start position. */
  from: Vec3;
  /** World-space end position. */
  to: Vec3;
  /** CSS hex color string. Default: "#44aaff". */
  color?: string;
  /** Line width in world units. Default: 0.03. */
  strokeWidth?: number;
  /** Arrowhead size factor relative to strokeWidth. Default: 4. */
  headSize?: number;
  /** Render as dashed line. Default: false. */
  dashed?: boolean;
  /**
   * Billboard mode — arrow always faces the camera.
   * Useful for 2D-style diagram annotations. Default: false.
   */
  billboard?: boolean;
  /** Optional display name. */
  name?: string;
}

// ── TextLabel ─────────────────────────────────────────────────────────────────

export interface TextLabelProps {
  /** World-space anchor position. */
  position: Vec3;
  /** Label text content. */
  text: string;
  /** CSS color. Default: "white". */
  color?: string;
  /** Font size in pixels. Default: 14. */
  fontSize?: number;
  /** Background color, or null for transparent. Default: null. */
  background?: string | null;
  /**
   * Always face camera (billboard). Default: true.
   */
  billboard?: boolean;
  /**
   * Atom ID to pin this label to. The label will follow the atom position
   * across frame updates via the "frame-rendered" event.
   */
  anchorAtomId?: number;
  /** Offset from anchor position in world units. Default: [0, 0, 0]. */
  offset?: Vec3;
  /** Optional display name. */
  name?: string;
}

// ── VectorField ───────────────────────────────────────────────────────────────

export interface VectorFieldProps {
  /** Flat Nx3 array of arrow origin positions (world space). */
  positions: Float32Array;
  /** Flat Nx3 array of direction+magnitude vectors. */
  vectors: Float32Array;
  /** Length scale multiplier. Default: 1. */
  scale?: number;
  /** Color mode for arrows. Default: "magnitude". */
  colorMode?: "uniform" | "magnitude" | "direction";
  /** CSS hex color used in "uniform" mode. Default: "#4488ff". */
  color?: string;
  /** Maximum arrows rendered (excess culled). Default: 5000. */
  maxArrows?: number;
  /** Shaft radius. Default: 0.03. */
  shaftRadius?: number;
  /** Fraction of arrow length used for the cone. Default: 0.25. */
  headRatio?: number;
  /** Optional display name. */
  name?: string;
}
