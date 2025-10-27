import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type LinesMesh,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import { ArtistBase, ArtistCommand } from "./base";
import { DefaultPalette } from "./palette";
import {
  DeleteAtomInput,
  type DrawAtomInput,
  type DrawBondInput,
  type DrawBoxInput,
  type DrawGridInput
} from "./types";
import { Box } from "../structure";

const palette = new DefaultPalette();
const DEFAULT_ATOM_RADIUS = palette.getDefaultRadius();
const DEFAULT_ATOM_COLOR = Color3.FromHexString(palette.getDefaultAtomColor());
const DEFAULT_BOND_RADIUS = palette.getDefaultBondRadius();
const DEFAULT_BOX_COLOR = Color3.FromHexString(palette.getDefaultBoxColor());

export class DynamicArtist extends ArtistBase {
  constructor(scene: Scene, id?: string) {
    super(scene, id);
  }

  @ArtistCommand<DrawGridInput>()
  drawGrid(input: DrawGridInput = {}): TransformNode {
    const size = Math.max(input.size ?? 10, 0);
    const stepRaw = input.step ?? 1;
    if (!Number.isFinite(stepRaw) || stepRaw === 0) {
      throw new Error("drawGrid requires a finite non-zero step.");
    }
    const step = Math.abs(stepRaw);
    const colorArray = input.color ?? [0.5, 0.5, 0.5];
    const alpha = input.alpha ?? 0.4;
    const name = input.name ?? `grid-${Date.now().toString(36)}`;

    const gridNode = new TransformNode(name, this.scene);
    const material = new StandardMaterial(`${name}-material`, this.scene);
    material.diffuseColor = Color3.FromArray(colorArray);
    material.alpha = alpha;

    const lines: Vector3[][] = [];
    for (let i = -size; i <= size; i += step) {
      lines.push([new Vector3(i, 0, -size), new Vector3(i, 0, size)]);
      lines.push([new Vector3(-size, 0, i), new Vector3(size, 0, i)]);
    }

    const mesh = MeshBuilder.CreateLineSystem(
      `${name}-lines`,
      {
        lines,
        updatable: true,
      },
      this.scene,
    );

    mesh.material = material;
    mesh.parent = gridNode;

    return gridNode;
  }

  @ArtistCommand<DrawAtomInput>({
    name: "draw_atom",
    validate: (input) => {
      if (!input || !input.position) {
        throw new Error("draw_atom requires a position.");
      }
    },
  })
  drawAtom(input: DrawAtomInput): Mesh {
    const { position, id, name, element, options } = input;
    const radius = options?.radius ?? DEFAULT_ATOM_RADIUS;
    const colorHex =
      options?.color ?? DEFAULT_ATOM_COLOR;
    const sphere = MeshBuilder.CreateSphere(
      name ?? `atom:${id}`,
      { diameter: radius * 2 },
      this.scene,
    );
    sphere.position = position;

    const material = new StandardMaterial(`atom_material:${sphere.name}`, this.scene);
    material.diffuseColor = colorHex;
    sphere.material = material;

    sphere.metadata = {
      meshType: "atom",
      atomId: id ?? sphere.uniqueId,
      element,
    };
    return sphere;
  }

  @ArtistCommand<DrawBondInput>({
    name: "draw_bond",
    validate: (input) => {
      if (!input || !input.start || !input.end) {
        throw new Error("draw_bond requires start and end positions.");
      }
    },
  })
  drawBond(input: DrawBondInput): Mesh[] {
    const start = input.start;
    const end = input.end;
    const options = input.options ?? {};
    const order = Math.max(1, options.order ?? 1);
    const radius = options.radius ?? DEFAULT_BOND_RADIUS;

    const createTube = (name: string, path: Vector3[], instance?: Mesh) => {
      const tube =
        options.update && instance
          ? MeshBuilder.CreateTube(name, { path, radius, instance })
          : MeshBuilder.CreateTube(name, { path, radius, updatable: true }, this.scene);

      if (!tube.material || options.update) {
        const material = new StandardMaterial("bond", this.scene);
        material.diffuseColor = new Color3(0.8, 0.8, 0.8);
        tube.material = material;
      }

      tube.metadata = {
        meshType: "bond",
        order,
        i: options.i,
        j: options.j,
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
      tubes.push(createTube(`bond:${options.i ?? "?"}-${options.j ?? "?"}:0`, [start, end]));
    } else if (order === 2) {
      tubes.push(
        createTube(`bond:${options.i ?? "?"}-${options.j ?? "?"}:0`, [start.add(perp), end.add(perp)]),
      );
      tubes.push(
        createTube(`bond:${options.i ?? "?"}-${options.j ?? "?"}:1`, [
          start.add(perp.scale(-1)),
          end.add(perp.scale(-1)),
        ]),
      );
    } else {
      tubes.push(
        createTube(`bond:${options.i ?? "?"}-${options.j ?? "?"}:0`, [start.add(perp), end.add(perp)]),
      );
      tubes.push(createTube(`bond:${options.i ?? "?"}-${options.j ?? "?"}:1`, [start, end]));
      tubes.push(
        createTube(`bond:${options.i ?? "?"}-${options.j ?? "?"}:2`, [
          start.add(perp.scale(-1)),
          end.add(perp.scale(-1)),
        ]),
      );
    }

    return tubes;
  }

  @ArtistCommand<DrawBoxInput>({
    name: "draw_box",
    validate: (input) => {
      if (!input || !input.box) {
        throw new Error("draw_box requires box data.");
      }
    },
  })
  drawBox(input: DrawBoxInput): LinesMesh[] {
    const { box, options } = input;
    if (!(box instanceof Box)) {
      return [];
    }
    const visible = options?.visible ?? true;
    if (!visible) {
      return [];
    }

    for (const mesh of this.scene.meshes) {
      if (mesh.name.startsWith("box:")) {
        mesh.dispose();
      }
    }

    const color = options?.color ?? DEFAULT_BOX_COLOR;
    const lines: LinesMesh[] = [];

    const edges = [
      [0, 1],
      [1, 3],
      [3, 2],
      [2, 0],
      [4, 5],
      [5, 7],
      [7, 6],
      [6, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];

    const corners = box.get_corners();
    for (let i = 0; i < edges.length; i++) {
      const [start, end] = edges[i];
      const points = [corners[start], corners[end]];
      const line = MeshBuilder.CreateLines(`box:edge:${i}`, { points }, this.scene);
      line.color = color;
      lines.push(line);
    }

    return lines;
  }

  @ArtistCommand<DeleteAtomInput>({
    name: "delete_atom", 
    validate: (input: DeleteAtomInput) => {
      if (!input || typeof input.atomId !== "number") {
        throw new Error("delete_atom requires an atomId number.");
      }
    },
  })
  deleteAtom(input: DeleteAtomInput): void {
    const atomMesh = this.scene.getMeshByUniqueId(input.atomId);
    if (atomMesh) {
      atomMesh.dispose();
    }
  }
}