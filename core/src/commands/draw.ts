import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  Mesh,
  Quaternion,
  Matrix,
  CreateSphereVertexData,
  CreateCylinderVertexData,
} from "@babylonjs/core";
import type { MolvisApp as Molvis } from "../core/app";
import { Box, Frame, AtomBlock, BondBlock } from "../structure";
import type {
  DrawAtomInput,
  DrawBondInput,
  DrawBoxOption,
  DrawFrameOption,
} from "./types";
import { command } from "./decorator";
import { DefaultPalette } from "./palette";
import { DrawAtomsOp } from "./renderOps/draw_atoms";
import { DrawBondsOp } from "./renderOps/draw_bonds";
import { DrawBoxOp, type DrawBoxOpOptions } from "./renderOps/draw_box";
import { SingleFrameSource } from "./sources";

const palette = new DefaultPalette();
const DEFAULT_ATOM_RADIUS = palette.getDefaultRadius();
const DEFAULT_ATOM_COLOR = Color3.FromHexString(palette.getDefaultAtomColor());
const DEFAULT_BOND_RADIUS = palette.getDefaultBondRadius();
const DEFAULT_BOND_COLOR = Color3.FromHexString(palette.getDefaultBondColor());

class DrawCommands {
  @command("draw_atom")
  static draw_atom(
    app: Molvis,
    position: DrawAtomInput["position"],
    options?: DrawAtomInput["options"]
  ) {
    if (!position) {
      throw new Error("draw_atom requires a position.");
    }

    const scene = app.scene;
    const id = (options as any)?.id;
    const name = (options as any)?.name;
    const element = (options as any)?.element || "C"; // Default to Carbon

    // Get color and radius from palette based on element
    const colorHex = options?.color
      ? (typeof options.color === 'string' ? Color3.FromHexString(options.color) : options.color)
      : Color3.FromHexString(palette.getAtomColor(element));
    const radius = options?.radius ?? palette.getAtomRadius(element);

    console.log(`[draw_atom] Creating atom: element=${element}, color=${colorHex.toHexString()}, radius=${radius}`);

    const sphere = MeshBuilder.CreateSphere(
      name ?? `atom:${id}`,
      { diameter: radius * 2 },
      scene,
    );
    sphere.position = position;

    const material = new StandardMaterial(`atom_material:${sphere.name}`, scene);
    material.diffuseColor = colorHex;
    sphere.material = material;

    const atomId = id ?? sphere.uniqueId;
    sphere.metadata = {
      meshType: "atom",
      atomId: atomId,
      element,
    };

    // Register atom in topology
    app.world.topology.addAtom(atomId);

    return {
      success: true,
      data: { meshName: sphere.name, count: 1 },
      meshes: [sphere],
      entities: [],
    };
  }

  @command("delete_atom")
  static delete_atom(app: Molvis, atomId: number) {
    if (typeof atomId !== "number") {
      throw new Error("delete_atom requires an atomId number.");
    }

    // First, try to find the atom mesh
    let atomMesh = app.scene.getMeshByUniqueId(atomId);

    // If not found by uniqueId, search by metadata
    if (!atomMesh) {
      for (const mesh of app.scene.meshes) {
        const metadata = (mesh as any).metadata;
        if (metadata?.meshType === "atom" && metadata?.atomId === atomId) {
          atomMesh = mesh;
          break;
        }
      }
    }

    // Check if this is a thin instance atom (from draw_frame)
    // Thin instance atoms have a matrices array in metadata
    if (atomMesh?.metadata?.matrices) {
      // This is a thin instance - we can't delete individual atoms
      // Clear the entire scene instead
      console.log("[delete_atom] Detected thin instance atom - clearing entire scene");
      app.world.clear();
      app.world.topology.clear();

      return {
        success: true,
        data: { atomId, message: "Cleared entire scene (thin instance)" },
        meshes: [],
        entities: [],
      };
    }

    // Regular atom deletion logic
    // Get all connected bond IDs from topology
    const bondIds = app.world.topology.getBondsForAtom(atomId);

    // Delete all connected bonds
    const deletedBondMeshes: Mesh[] = [];
    for (const bondId of bondIds) {
      // Find all meshes that belong to this bond
      for (const mesh of app.scene.meshes) {
        const metadata = (mesh as any).metadata;
        if (metadata?.bondId === bondId || mesh.uniqueId === bondId) {
          mesh.dispose();
          deletedBondMeshes.push(mesh as Mesh);
        }
      }
      // Remove bond from topology
      app.world.topology.removeBond(bondId);
    }

    // Delete the atom
    if (!atomMesh) {
      return {
        success: false,
        data: { atomId },
        meshes: [],
        entities: [],
      };
    }

    atomMesh.dispose();
    app.world.topology.removeAtom(atomId);

    return {
      success: true,
      data: { atomId, deletedBonds: bondIds.length },
      meshes: deletedBondMeshes,
      entities: [],
    };
  }

  @command("draw_bond")
  static draw_bond(
    app: Molvis,
    start: DrawBondInput["start"],
    end: DrawBondInput["end"],
    options?: DrawBondInput["options"]
  ) {
    if (!start || !end) {
      throw new Error("draw_bond requires start and end positions.");
    }

    const scene = app.scene;
    const bondOptions = options ?? {};
    const order = Math.max(1, bondOptions.order ?? 1);
    const radius = bondOptions.radius ?? DEFAULT_BOND_RADIUS;

    // Find atom IDs by position if not provided
    let atomId1 = bondOptions.i;
    let atomId2 = bondOptions.j;

    if (atomId1 === undefined || atomId2 === undefined) {
      // Find atoms by position (within a small tolerance)
      const tolerance = 0.01;
      for (const mesh of scene.meshes) {
        if (mesh.metadata?.meshType === "atom") {
          const pos = mesh.position;
          const dist1 = Vector3.Distance(pos, start);
          const dist2 = Vector3.Distance(pos, end);
          if (dist1 < tolerance && atomId1 === undefined) {
            atomId1 = mesh.metadata.atomId ?? mesh.uniqueId;
          }
          if (dist2 < tolerance && atomId2 === undefined) {
            atomId2 = mesh.metadata.atomId ?? mesh.uniqueId;
          }
        }
      }
    }

    const createTube = (name: string, path: Vector3[], instance?: Mesh) => {
      const tube =
        bondOptions.update && instance
          ? MeshBuilder.CreateTube(name, { path, radius, instance })
          : MeshBuilder.CreateTube(name, { path, radius, updatable: true }, scene);

      if (!tube.material || bondOptions.update) {
        const material = new StandardMaterial("bond", scene);
        material.diffuseColor = new Color3(0.8, 0.8, 0.8);
        tube.material = material;
      }

      tube.metadata = {
        meshType: "bond",
        order,
        i: atomId1 ?? bondOptions.i,
        j: atomId2 ?? bondOptions.j,
      };

      return tube;
    };

    const axis = end.subtract(start);
    const axisNorm = axis.normalize();
    let perp = Vector3.Cross(axisNorm, Vector3.Up());
    if (perp.lengthSquared() < 1e-6) {
      perp = Vector3.Cross(axisNorm, Vector3.Right());
    }
    perp = perp.normalize().scale(radius * 2);

    const tubes: Mesh[] = [];
    if (order === 1) {
      tubes.push(createTube(`bond:${atomId1 ?? "?"}-${atomId2 ?? "?"}:0`, [start, end]));
    } else if (order === 2) {
      tubes.push(
        createTube(`bond:${atomId1 ?? "?"}-${atomId2 ?? "?"}:0`, [start.add(perp), end.add(perp)]),
      );
      tubes.push(
        createTube(`bond:${atomId1 ?? "?"}-${atomId2 ?? "?"}:1`, [
          start.add(perp.scale(-1)),
          end.add(perp.scale(-1)),
        ]),
      );
    } else {
      tubes.push(
        createTube(`bond:${atomId1 ?? "?"}-${atomId2 ?? "?"}:0`, [start.add(perp), end.add(perp)]),
      );
      tubes.push(createTube(`bond:${atomId1 ?? "?"}-${atomId2 ?? "?"}:1`, [start, end]));
      tubes.push(
        createTube(`bond:${atomId1 ?? "?"}-${atomId2 ?? "?"}:2`, [
          start.add(perp.scale(-1)),
          end.add(perp.scale(-1)),
        ]),
      );
    }

    // Register bond in topology if we have both atom IDs
    if (atomId1 !== undefined && atomId2 !== undefined) {
      // Use the first tube's uniqueId as the bond ID
      const mainBondId = tubes[0].uniqueId;
      app.world.topology.addBond(mainBondId, atomId1, atomId2);

      // Store bond info in metadata for all tubes
      for (const tube of tubes) {
        if (!tube.metadata) {
          tube.metadata = {};
        }
        (tube.metadata as any).bondId = mainBondId;
        (tube.metadata as any).atomId1 = atomId1;
        (tube.metadata as any).atomId2 = atomId2;
      }
    }

    return {
      success: true,
      data: { count: tubes.length },
      meshes: tubes,
      entities: [],
    };
  }

  @command("draw_box")
  static draw_box(
    app: Molvis,
    box: Box,
    options?: DrawBoxOption
  ) {
    if (!box) {
      throw new Error("draw_box requires box data.");
    }

    // Create or update DrawBoxOp in render pipeline
    const existingBoxOp = app.renderPipeline.ops.find(
      (op) => op.id.startsWith("DrawBoxOp_")
    ) as DrawBoxOp | undefined;

    const boxOpOptions: DrawBoxOpOptions = {
      visible: options?.visible ?? true,
      color: options?.color,
      lineWidth: options?.lineWidth,
    };

    if (existingBoxOp) {
      // Replace existing box op
      const newBoxOp = new DrawBoxOp(boxOpOptions, existingBoxOp.id);
      app.renderPipeline.replaceOp(existingBoxOp.id, newBoxOp);
    } else {
      // Add new box op
      const boxOp = new DrawBoxOp(boxOpOptions);
      app.renderPipeline.appendOp(boxOp);
    }

    // Store box in current frame metadata if available
    // This allows DrawBoxOp to read it during render
    if (app.dataPipeline.source) {
      // Try to get current frame and update its metadata
      // For now, we'll just add the op - it will read from frame.meta during render
    }

    return {
      success: true,
      data: { count: 1 },
      meshes: [],
      entities: [],
    };
  }

  @command("draw_frame")
  static async draw_frame(
    app: Molvis,
    frame: Frame | { blocks: Record<string, unknown>; metadata?: unknown },
    options?: DrawFrameOption
  ) {
    // Handle frameData from Python (dict with blocks) or Frame object
    let frameObj: Frame;
    if (frame instanceof Frame) {
      frameObj = frame;
    } else {
      // Convert frameData dict to Frame object
      const frameData = frame as { blocks: Record<string, unknown>; metadata?: unknown };

      // Extract atoms block
      const atomsBlock = frameData.blocks?.atoms as Record<string, unknown> | undefined;
      if (!atomsBlock) {
        throw new Error("Frame must contain 'atoms' block");
      }

      // Extract xyz coordinates
      const xyz = atomsBlock.xyz as { x?: number[]; y?: number[]; z?: number[] } | number[][] | undefined;
      if (!xyz) {
        throw new Error("Atoms block must contain 'xyz' variable");
      }

      let x: number[], y: number[], z: number[];
      if (Array.isArray(xyz) && xyz.length === 3 && Array.isArray(xyz[0])) {
        // Format: [[x1, x2, ...], [y1, y2, ...], [z1, z2, ...]]
        x = xyz[0] as number[];
        y = xyz[1] as number[];
        z = xyz[2] as number[];
      } else if (typeof xyz === "object" && "x" in xyz && "y" in xyz && "z" in xyz) {
        // Format: { x: [...], y: [...], z: [...] }
        x = (xyz as { x: number[] }).x;
        y = (xyz as { y: number[] }).y;
        z = (xyz as { z: number[] }).z;
      } else {
        throw new Error("Invalid xyz format in atoms block");
      }

      const element = atomsBlock.element as string[] | undefined;
      const atomBlock = new AtomBlock(x, y, z, element);

      // Extract bonds block if present
      const bondsBlock = frameData.blocks?.bonds as Record<string, unknown> | undefined;
      let bondBlock: BondBlock | undefined;
      if (bondsBlock) {
        const i = bondsBlock.i as number[] | undefined;
        const j = bondsBlock.j as number[] | undefined;
        const order = bondsBlock.order as number[] | undefined;
        bondBlock = new BondBlock(i, j, order);
      }

      frameObj = new Frame(atomBlock, bondBlock);
    }

    if (!frameObj) {
      throw new Error("draw_frame requires { frame }.");
    }

    const drawOptions = options ?? {};

    // Clear existing render ops for this frame
    // In a real implementation, you might want to track ops by frame or use a different strategy
    app.renderPipeline.clear();

    // Add render ops based on options
    if (drawOptions.atoms !== undefined || drawOptions.atoms === undefined) {
      // Always draw atoms by default
      const atomsOp = new DrawAtomsOp({
        radii: drawOptions.atoms?.radii,
        color: drawOptions.atoms?.color,
      });
      app.renderPipeline.appendOp(atomsOp);
    }

    if (drawOptions.bonds !== undefined && frameObj.bondBlock) {
      const bondsOp = new DrawBondsOp({
        radius: drawOptions.bonds?.radii,
      });
      app.renderPipeline.appendOp(bondsOp);
    }

    if (drawOptions.box !== undefined) {
      const boxOp = new DrawBoxOp({
        visible: drawOptions.box.visible,
        color: drawOptions.box.color,
        lineWidth: drawOptions.box.lineWidth,
      });
      app.renderPipeline.appendOp(boxOp);
    }

    // Set frame source and render
    app.dataPipeline.source = new SingleFrameSource(frameObj);
    const computedFrame = await app.computeFrame(0);
    app.renderFrame(computedFrame);

    return {
      success: true,
      data: { count: app.renderPipeline.ops.length },
      meshes: [],
      entities: [],
    };
  }

  @command("clear")
  static clear(app: Molvis) {
    // Clear topology
    app.world.topology.clear();
    app.world.clear();
    return { success: true, meshes: [], entities: [] };
  }

  @command("set_style")
  static set_style(
    _app: Molvis,
    _style?: string,
    _atomRadius?: number | number[],
    _bondRadius?: number
  ) {
    // TODO: Implement style setting
    return { success: true, meshes: [], entities: [] };
  }

  /**
   * Delete a bond by its ID.
   * Removes all mesh tubes associated with the bond and updates topology.
   */
  @command("delete_bond")
  static delete_bond(app: Molvis, bondId: number) {
    if (typeof bondId !== "number") {
      throw new Error("delete_bond requires a bondId number.");
    }

    const deletedMeshes: Mesh[] = [];

    // Find all meshes that belong to this bond (multiple tubes for double/triple bonds)
    for (const mesh of [...app.scene.meshes]) {
      const metadata = (mesh as any).metadata;
      if (metadata?.bondId === bondId || mesh.uniqueId === bondId) {
        deletedMeshes.push(mesh as Mesh);
        mesh.dispose();
      }
    }

    // Remove bond from topology
    app.world.topology.removeBond(bondId);

    return {
      success: deletedMeshes.length > 0,
      data: { bondId, deletedCount: deletedMeshes.length },
      meshes: deletedMeshes,
      entities: [],
    };
  }

  /**
   * Change an atom's element type.
   * Updates the atom's metadata and optionally changes its color.
   */
  @command("change_atom_element")
  static change_atom_element(app: Molvis, atomId: number, newElement: string) {
    if (typeof atomId !== "number" || typeof newElement !== "string") {
      throw new Error("change_atom_element requires atomId (number) and newElement (string).");
    }

    // Find atom mesh by ID
    let atomMesh: Mesh | null = null;
    for (const mesh of app.scene.meshes) {
      const metadata = (mesh as any).metadata;
      if (metadata?.meshType === "atom" && (metadata?.atomId === atomId || mesh.uniqueId === atomId)) {
        atomMesh = mesh as Mesh;
        break;
      }
    }

    if (!atomMesh) {
      return {
        success: false,
        data: { atomId, error: "Atom not found" },
        meshes: [],
        entities: [],
      };
    }

    // Update metadata
    const oldElement = atomMesh.metadata?.element;
    atomMesh.metadata = {
      ...atomMesh.metadata,
      element: newElement,
    };

    // Update color based on new element
    const newColor = Color3.FromHexString(palette.getAtomColor(newElement));
    const material = atomMesh.material as StandardMaterial;
    if (material) {
      material.diffuseColor = newColor;
    }

    return {
      success: true,
      data: { atomId, oldElement, newElement },
      meshes: [atomMesh],
      entities: [],
    };
  }

  /**
   * Cycle a bond's order: 1 → 2 → 3 → 1.
   * Recreates the bond meshes with the new order.
   */
  @command("cycle_bond_order")
  static cycle_bond_order(app: Molvis, bondMesh: Mesh) {
    if (!bondMesh?.metadata) {
      throw new Error("cycle_bond_order requires a valid bond mesh.");
    }

    const metadata = bondMesh.metadata;
    const currentOrder = metadata.order ?? 1;
    const newOrder = currentOrder >= 3 ? 1 : currentOrder + 1;

    // Get bond endpoints from metadata or find connected atoms
    const bondId = metadata.bondId ?? bondMesh.uniqueId;
    const bondInfo = app.world.topology.getAtomsForBond(bondId);

    if (!bondInfo) {
      // Try to get start/end from mesh name or find by position
      return {
        success: false,
        data: { error: "Cannot find bond endpoints" },
        meshes: [],
        entities: [],
      };
    }

    // Find atom positions
    let startPos: Vector3 | null = null;
    let endPos: Vector3 | null = null;

    for (const mesh of app.scene.meshes) {
      const md = (mesh as any).metadata;
      if (md?.meshType === "atom") {
        const atomId = md.atomId ?? mesh.uniqueId;
        if (atomId === bondInfo.atom1) {
          startPos = mesh.position.clone();
        } else if (atomId === bondInfo.atom2) {
          endPos = mesh.position.clone();
        }
      }
    }

    if (!startPos || !endPos) {
      return {
        success: false,
        data: { error: "Cannot find atom positions for bond" },
        meshes: [],
        entities: [],
      };
    }

    // Delete old bond meshes
    const deletedMeshes: Mesh[] = [];
    for (const mesh of [...app.scene.meshes]) {
      const md = (mesh as any).metadata;
      if (md?.bondId === bondId || mesh.uniqueId === bondId) {
        deletedMeshes.push(mesh as Mesh);
        mesh.dispose();
      }
    }

    // Remove from topology temporarily
    app.world.topology.removeBond(bondId);

    // Create new bond with updated order
    const result = DrawCommands.draw_bond(app, startPos, endPos, {
      order: newOrder,
      i: bondInfo.atom1,
      j: bondInfo.atom2,
    });

    return {
      success: true,
      data: { oldOrder: currentOrder, newOrder, bondId },
      meshes: result.meshes,
      entities: [],
    };
  }
}

function createAtomBatch(scene: any, frame: Frame, options: DrawFrameOption): Mesh | null {
  const { atomBlock } = frame;
  const count = atomBlock.n_atoms;
  if (count <= 0) return null;

  const geometry = CreateSphereVertexData({ diameter: 1, segments: 16 });

  const mesh = new Mesh("atoms", scene);
  geometry.applyToMesh(mesh);

  const material = new StandardMaterial(`atom_mat`, scene);
  (material as any).useVertexColor = true;
  material.specularColor = new Color3(0.1, 0.1, 0.1);
  mesh.material = material;

  const matrices = new Float32Array(count * 16);
  const colors = new Float32Array(count * 4);

  const pos = new Vector3();
  const scale = new Vector3();
  const qIdentity = Quaternion.Identity();
  const tmpMat = new Matrix();

  const elements = atomBlock.get<string[]>("element") ?? [];
  const name = atomBlock.get<string[]>("name") ?? [];

  const atom_radii = new Float32Array(count);
  const atom_colors = new Float32Array(count * 4);

  const haveElements = !!elements && elements.length === count;
  for (let i = 0; i < count; i++) {
    const el = haveElements ? elements![i] : undefined;

    atom_radii[i] = el ? palette.getAtomRadius(el) : DEFAULT_ATOM_RADIUS;

    const c = el ? Color3.FromHexString(palette.getAtomColor(el)) : DEFAULT_ATOM_COLOR;
    const off = i * 4;
    atom_colors[off] = c.r;
    atom_colors[off + 1] = c.g;
    atom_colors[off + 2] = c.b;
    atom_colors[off + 3] = 1;
  }

  const userR = options.atoms?.radii;
  if (Array.isArray(userR) && userR.length === count) {
    atom_radii.set(userR);
  }

  const userC = options.atoms?.color;
  if (Array.isArray(userC)) {
    for (let i = 0; i < count; i++) {
      const c = Color3.FromHexString(userC[i]);
      const off = i * 4;
      atom_colors[off] = c.r;
      atom_colors[off + 1] = c.g;
      atom_colors[off + 2] = c.b;
      atom_colors[off + 3] = 1;
    }
  }

  for (let i = 0; i < count; i++) {
    pos.set(atomBlock.x[i], atomBlock.y[i], atomBlock.z[i]);

    const r = atom_radii[i];
    scale.set(r, r, r);
    const c = atom_colors.subarray(i * 4, i * 4 + 4);

    Matrix.ComposeToRef(scale, qIdentity, pos, tmpMat);
    tmpMat.copyToArray(matrices, i * 16);

    const off = i * 4;
    colors[off] = c[0];
    colors[off + 1] = c[1];
    colors[off + 2] = c[2];
    colors[off + 3] = 1;
  }

  mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
  mesh.thinInstanceSetBuffer("color", colors, 4);
  mesh.thinInstanceEnablePicking = true;
  mesh.metadata = { meshType: "atom", matrices: matrices, names: name };
  return mesh;
}

function createBondBatch(scene: any, frame: Frame, options: DrawFrameOption): Mesh | null {
  const { atomBlock, bondBlock } = frame;
  if (!bondBlock) return null;

  const total = bondBlock.n_bonds;
  if (total <= 0) return null;

  const geometry = CreateCylinderVertexData({ height: 1, diameter: 1, tessellation: 16 });

  const mesh = new Mesh("bonds", scene);
  geometry.applyToMesh(mesh);

  const material = new StandardMaterial(`bond_mat`, scene);
  material.diffuseColor = DEFAULT_BOND_COLOR;
  mesh.material = material;

  const matrices = new Float32Array(total * 16);
  const colors = new Float32Array(total * 4);

  const pos = new Vector3();
  const scale = new Vector3();
  const tmpMat = new Matrix();
  const dir = new Vector3();

  const radius = options.bonds?.radii ?? DEFAULT_BOND_RADIUS;

  for (let i = 0; i < total; i++) {
    const idxI = bondBlock.i[i];
    const idxJ = bondBlock.j[i];

    const start = new Vector3(atomBlock.x[idxI], atomBlock.y[idxI], atomBlock.z[idxI]);
    const end = new Vector3(atomBlock.x[idxJ], atomBlock.y[idxJ], atomBlock.z[idxJ]);

    dir.copyFrom(end).subtractInPlace(start);
    const length = dir.length();
    dir.normalize();

    pos.copyFrom(start).addInPlace(end).scaleInPlace(0.5);
    scale.set(radius, length, radius);

    const q = Quaternion.FromUnitVectorsToRef(Vector3.Up(), dir, Quaternion.Identity());
    Matrix.ComposeToRef(scale, q, pos, tmpMat);
    tmpMat.copyToArray(matrices, i * 16);

    const off = i * 4;
    colors[off] = DEFAULT_BOND_COLOR.r;
    colors[off + 1] = DEFAULT_BOND_COLOR.g;
    colors[off + 2] = DEFAULT_BOND_COLOR.b;
    colors[off + 3] = 1;
  }

  mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
  mesh.thinInstanceSetBuffer("color", colors, 4);
  mesh.metadata = { meshType: "bond" };
  return mesh;
}

// Export all commands
export const draw_atom = DrawCommands.draw_atom;
export const delete_atom = DrawCommands.delete_atom;
export const draw_bond = DrawCommands.draw_bond;
export const draw_box = DrawCommands.draw_box;
export const draw_frame = DrawCommands.draw_frame;
export const clear = DrawCommands.clear;
export const set_style = DrawCommands.set_style;
export const delete_bond = DrawCommands.delete_bond;
export const change_atom_element = DrawCommands.change_atom_element;
export const cycle_bond_order = DrawCommands.cycle_bond_order;
