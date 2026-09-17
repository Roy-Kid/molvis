/**
 * Mesh — an imported triangle mesh that stands still while the data moves.
 *
 * The producer/draw split that {@link ./isosurface Isosurface} uses applies
 * here for a different reason. An isosurface recomputes because the field
 * changed; this one never recomputes at all. Its triangles come from a file
 * (`io/stl.ts`), not from the frame, so every pipeline pass republishes the
 * same geometry and the mesh simply stays on screen — a packing container the
 * trajectory plays inside, drawn once and unaffected by seeking or playback.
 *
 * That is also why it is a modifier rather than a `DataSource`: it
 * contributes no atoms, no box and no frames, so it must not enter source
 * composition, where it would have to agree with everyone else's atom count
 * and trajectory length.
 *
 * Geometry is not written to a project file — a mesh is file bytes, not
 * parameters. A restored project keeps the row and the name of the file it
 * came from, and paints nothing until that file is opened again.
 */

import type { Frame } from "@molcrafts/molvis-core/molrs";
import type { SurfaceMesh, SurfacePart } from "../algo/surface_mesh";
import type { ProjectParams } from "../project/params";
import { DrawSurfaceModifier } from "./draw_surface";
import {
  BaseModifier,
  type GeometryProducer,
  ModifierCapability,
} from "./modifier";
import type { PipelineContext } from "./types";

/**
 * Imported triangle mesh (STL). View geometry, not a {@link DataSource}:
 * no atoms, no box, no frames, so it never enters source composition.
 *
 * `setMesh` stores a stable `SurfacePart[]` that every pipeline pass
 * republishes; `Draw surface` keys skip-rebuild on that array identity.
 * Project restore keeps the row and `sourceName` but paints nothing until
 * the file is opened again (`hasMesh === false`).
 *
 * Not user-addable — hosts attach it through `loadMeshOverlay`.
 */
export class MeshOverlayModifier
  extends BaseModifier
  implements GeometryProducer
{
  static readonly NAME = "Mesh";

  /**
   * Rebuilt only by {@link setMesh}, so the array reference is stable across
   * pipeline passes. `Draw surface` keys its skip-rebuild check on exactly
   * that identity — without it, a mesh would be re-uploaded to the GPU on
   * every trajectory step.
   */
  private _parts: SurfacePart[] = [];
  private _sourceName = "";

  constructor(id = "mesh-overlay") {
    super(
      id,
      MeshOverlayModifier.NAME,
      new Set([ModifierCapability.ProducesGeometry]),
    );
  }

  createDraw(): DrawSurfaceModifier {
    return new DrawSurfaceModifier("draw-surface", this.id);
  }

  /** File this mesh was read from, for the properties pane. */
  get sourceName(): string {
    return this._sourceName;
  }

  get triangleCount(): number {
    return this._parts.length === 0
      ? 0
      : this._parts[0].mesh.indices.length / 3;
  }

  /** Whether geometry is loaded. False after a project restore. */
  get hasMesh(): boolean {
    return this._parts.length > 0;
  }

  setMesh(mesh: SurfaceMesh, sourceName: string): void {
    this._parts =
      mesh.indices.length > 0 ? [{ mesh, role: "primary" as const }] : [];
    this._sourceName = sourceName;
  }

  getCacheKey(): string {
    return `${super.getCacheKey()}:src=${this._sourceName}:tri=${this.triangleCount}`;
  }

  toProjectParams(): ProjectParams {
    return { sourceName: this._sourceName };
  }

  fromProjectParams(params: ProjectParams): void {
    if (typeof params.sourceName === "string") {
      this._sourceName = params.sourceName;
    }
  }

  apply(input: Frame, ctx: PipelineContext): Frame {
    if (this._parts.length > 0) ctx.surfaces.set(this.id, this._parts);
    return input;
  }
}
