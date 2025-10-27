import {
  Color3,
  Mesh,
  Quaternion,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexData,
  Matrix,
  type Scene,
  CreateCylinderVertexData,
  CreateSphereVertexData,
} from "@babylonjs/core";
import { ArtistBase, ArtistCommand } from "./base";
import { type DrawFrameInput, type DrawFrameOption } from "./types";
import { DefaultPalette } from "./palette";
import { Frame } from "../structure";

const palette = new DefaultPalette();
const DEFAULT_ATOM_RADIUS = palette.getDefaultRadius();
const DEFAULT_ATOM_COLOR = Color3.FromHexString(palette.getDefaultAtomColor());
const DEFAULT_BOND_RADIUS = palette.getDefaultBondRadius();
const DEFAULT_BOND_COLOR = Color3.FromHexString(palette.getDefaultBondColor());

export class InstancedArtist extends ArtistBase {
  private frameRoot: TransformNode | null = null;
  private atomBatch: Mesh | null = null;
  private bondBatch: Mesh | null = null;

  constructor(scene: Scene, id?: string) {
    super(scene, id);
  }

  override async clear(): Promise<void> {
    this.disposeCurrentFrame();
  }

  private disposeCurrentFrame(): void {
    this.atomBatch?.dispose();
    this.bondBatch?.dispose();
    this.frameRoot?.dispose();
    this.atomBatch = null;
    this.bondBatch = null;
    this.frameRoot = null;
  }

  @ArtistCommand<DrawFrameInput>({
    name: "draw_frame",
    validate: (input) => {
      if (!input?.frame) throw new Error("draw_frame requires { frame }.");
    },
  })
  drawFrame({ frame, options = {} }: DrawFrameInput): Mesh[] {
    this.disposeCurrentFrame();
    this.frameRoot = new TransformNode(`frame-root:${this.id}:${(Math.random()*1e9|0).toString(36)}`, this.scene);

    const atomMesh = this.createAtomBatch(frame, options);
    const bondMesh = this.createBondBatch(frame, options);

    const meshes: Mesh[] = [];
    if (atomMesh) { atomMesh.parent = this.frameRoot; meshes.push(atomMesh); this.atomBatch = atomMesh; }
    if (bondMesh) { bondMesh.parent = this.frameRoot; meshes.push(bondMesh); this.bondBatch = bondMesh; }
    return meshes;
  }

  private createAtomBatch(frame: Frame, options: DrawFrameOption): Mesh | null {
    const { atomBlock } = frame;
    const count = atomBlock.n_atoms;
    if (count <= 0) return null;

    const geometryKey = "atom:sphere:16";
    const mesh = this.createInstancedMesh("atoms", geometryKey, () =>
      CreateSphereVertexData({ diameter: 1, segments: 16 })
    );

    const materialKey = "atom:standard";
    const material = this.acquireMaterial(materialKey, () => {
      const m = new StandardMaterial(`atom_mat:${this.id}`, this.scene);
      (m as any).useVertexColor = true;
      m.specularColor = new Color3(0.1, 0.1, 0.1);
      return m;
    });
    mesh.material = material;
    this.attachResourceTracking(mesh, { materialKey, geometryKey });

    const matrices = new Float32Array(count * 16);
    const colors = new Float32Array(count * 4);

    const pos = new Vector3();
    const scale = new Vector3();
    const qIdentity = Quaternion.Identity();
    const tmpMat = new Matrix();
    

    const elements = atomBlock.get<string[]>("element") ?? [];
    const name = atomBlock.get<string[]>("name") ?? [];

    const atom_radii  = new Float32Array(count);
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

      const r = atom_radii[i]
      scale.set(r, r, r);
      const c = atom_colors.subarray(i * 4, i * 4 + 4);

      Matrix.ComposeToRef(scale, qIdentity, pos, tmpMat);
      tmpMat.copyToArray(matrices, i * 16);

      const off = i * 4;
      colors[off] = c[0]; colors[off + 1] = c[1]; colors[off + 2] = c[2]; colors[off + 3] = 1;
    }

    mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
    mesh.thinInstanceSetBuffer("color", colors, 4);
    mesh.thinInstanceEnablePicking = true;
    mesh.metadata = { type: "atom", artistId: this.id, matrices: matrices, names: name };
    return mesh;
  }

  private createBondBatch(frame: Frame, options: DrawFrameOption): Mesh | null {
    const { atomBlock, bondBlock } = frame;
    if (!bondBlock) return null;

    const total = bondBlock.n_bonds;
    if (total <= 0) return null;

    const geometryKey = "bond:cylinder:16";
    const mesh = this.createInstancedMesh("bonds", geometryKey, () =>
      CreateCylinderVertexData({ height: 1, tessellation: 16, diameter: 1 })
    );

    const materialKey = "bond:standard";
    const material = this.acquireMaterial(materialKey, () => {
      const m = new StandardMaterial(`bond_mat:${this.id}`, this.scene);
      (m as any).useVertexColor = true;
      m.specularColor = new Color3(0.1, 0.1, 0.1);
      return m;
    });
    mesh.material = material;
    this.attachResourceTracking(mesh, { materialKey, geometryKey });

    const r =
      options.bonds?.radii ?? DEFAULT_BOND_RADIUS;
    const bondColor = DEFAULT_BOND_COLOR;

    const matrices = new Float32Array(total * 16);
    const colors = new Float32Array(total * 4);

    const A = new Vector3(), B = new Vector3(), mid = new Vector3();
    const dir = new Vector3(), scale = new Vector3();
    const rot = new Quaternion();
    const mat = new Matrix();

    let write = 0;

    for (let k = 0; k < total; k++) {
      const ia = bondBlock.i[k], ib = bondBlock.j[k];
      A.set(atomBlock.x[ia], atomBlock.y[ia], atomBlock.z[ia]);
      B.set(atomBlock.x[ib], atomBlock.y[ib], atomBlock.z[ib]);

      dir.copyFrom(B).subtractInPlace(A);
      const len = dir.length();
      if (len <= 1e-6) continue;               // 跳过零长度键

      mid.copyFrom(A).addInPlace(B).scaleInPlace(0.5);
      dir.scaleInPlace(1 / len);

      Quaternion.FromUnitVectorsToRef(Vector3.UpReadOnly, dir, rot);

      scale.set(r, len, r);

      Matrix.ComposeToRef(scale, rot, mid, mat);
      mat.copyToArray(matrices, write * 16);

      const off = write * 4;
      colors[off] = (bondColor as Color3).r;
      colors[off + 1] = (bondColor as Color3).g;
      colors[off + 2] = (bondColor as Color3).b;
      colors[off + 3] = 1;

      write++;
    }

    if (write === 0) { mesh.dispose(); return null; }

    const mtx = write === total ? matrices : matrices.subarray(0, write * 16);
    const col = write === total ? colors   : colors.subarray(0, write * 4);

    mesh.thinInstanceSetBuffer("matrix", mtx, 16, true);
    mesh.thinInstanceSetBuffer("color", col, 4);
    mesh.thinInstanceEnablePicking = true;
    mesh.metadata = { type: "bond", artistId: this.id, i: bondBlock.i, j: bondBlock.j };

    for (let k = 0; k < total; k++) {
      const ia = bondBlock.i[k], ib = bondBlock.j[k];
      A.set(atomBlock.x[ia], atomBlock.y[ia], atomBlock.z[ia]);
      B.set(atomBlock.x[ib], atomBlock.y[ib], atomBlock.z[ib]);
      if (A.equalsWithEpsilon(B, 1e-6)) continue;
      mid.copyFrom(A).addInPlace(B).scaleInPlace(0.5);
    }
    return mesh;
  }

  private createInstancedMesh(name: string, geometryKey: string, factory: () => VertexData): Mesh {
    const mesh = new Mesh(`${name}:${this.id}`, this.scene);
    const geometry = this.acquireGeometry(geometryKey, factory);
    geometry.applyToMesh(mesh, true);
    return mesh;
  }
}
