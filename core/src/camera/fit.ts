import { Vector3 } from "@babylonjs/core";

/** An axis-aligned bounding box, structurally compatible with `SceneIndex.getBounds()`. */
export interface Bounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

/** The camera framing for a bounding box: where to look and how far back to sit. */
export interface ViewFit {
  center: Vector3;
  /** Distance from center needed to frame the box, in Å. */
  radius: number;
}

/** Padding factor applied so the scene does not touch the viewport edges. */
export const FIT_PADDING = 1.2;
/** Floor on the framing distance, so tiny/degenerate scenes stay viewable. */
export const FIT_MIN_DISTANCE = 5.0;

/**
 * Compute the camera framing ({@link ViewFit}) for an axis-aligned box.
 *
 * Extracted verbatim from `World.resetCamera` so the turntable orbit and the
 * reset view share one definition and cannot drift. Fits the box's largest
 * dimension to the vertical FOV, widens for narrow (portrait) aspect ratios,
 * applies {@link FIT_PADDING}, and clamps to {@link FIT_MIN_DISTANCE}.
 *
 * @param fov Vertical field of view, in radians.
 * @param aspectRatio Viewport width / height.
 */
export function fitBoundsToView(
  bounds: Bounds,
  fov: number,
  aspectRatio: number,
): ViewFit {
  const center = new Vector3(
    (bounds.min.x + bounds.max.x) * 0.5,
    (bounds.min.y + bounds.max.y) * 0.5,
    (bounds.min.z + bounds.max.z) * 0.5,
  );

  const sizeX = bounds.max.x - bounds.min.x;
  const sizeY = bounds.max.y - bounds.min.y;
  const sizeZ = bounds.max.z - bounds.min.z;
  const maxDim = Math.max(sizeX, sizeY, sizeZ);

  // Distance needed to fit the largest dimension to the vertical FOV.
  let distance = maxDim / (2 * Math.tan(fov / 2));

  // Portrait viewports see less horizontally — back off to fit width.
  if (aspectRatio < 1.0) {
    distance = distance / aspectRatio;
  }

  distance *= FIT_PADDING;
  distance = Math.max(distance, FIT_MIN_DISTANCE);

  return { center, radius: distance };
}
