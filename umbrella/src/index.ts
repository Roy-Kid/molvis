/**
 * `@molcrafts/molvis` — convenience umbrella re-exporting 2D + 3D engines.
 * Prefer explicit `@molcrafts/molvis-sketch` / `@molcrafts/molvis-stage` when
 * you only need one surface (smaller graphs, clearer intent).
 *
 * Both engines are star-exported with no name arbitration here, and that is
 * a property of their vocabulary rather than luck: a pointer hit is named
 * for the surface it happened on (`BoardHit`, `SceneHit`), so the two never
 * collide and neither has to lose its unqualified name.
 */

export * from "@molcrafts/molvis-sketch";
export * from "@molcrafts/molvis-stage";
