import { Mesh, MeshBuilder, ShaderMaterial, Vector3, Engine, Scene, Color3 } from "@babylonjs/core";
import { type MolvisApp } from "./app";
import { Frame, Box } from "molrs-wasm";
import { encodePickingColor } from "./picker";
import "./shaders/impostor";

/**
 * Artist options for initialization
 */
export interface ArtistOptions {
    app: MolvisApp;
}

/**
 * Options for drawing a single atom
 */
export interface DrawAtomOptions {
    element: string;
    radius?: number;
    color?: string; // Hex color
    atomId?: number;
}

/**
 * Options for drawing a single bond
 */
export interface DrawBondOptions {
    order?: number;
    radius?: number;
    atomId1?: number;
    atomId2?: number;
    bondId?: number;
}

/**
 * Artist class - Unified Graphics Engine
 *
 * Responsibilities:
 * - Owns rendering meshes (atom_base_renderer, bond_base_renderer).
 * - Manages SceneIndex and Impostor Pools.
 * - Provides high-level drawing API (drawAtom, drawBond, renderFrame).
 * - Stateless regarding interaction history.
 */
export class Artist {
    private app: MolvisApp;

    // The singleton meshes (View Mode / Base)
    public atomMesh: Mesh;
    public bondMesh: Mesh;

    constructor(options: ArtistOptions) {
        this.app = options.app;
        const scene = this.app.world.scene;

        // 1. Create Base Meshes (Hidden planes for thin instances)
        this.atomMesh = this.createBaseMesh("atom_base_renderer", "atomMat_impostor", scene);
        this.bondMesh = this.createBaseMesh("bond_base_renderer", "bondMat_impostor", scene);

        // Note: Pools are now managed by SceneIndex. We just provide the Meshes.
    }

    /**
     * Clear all rendered data.
     */
    public clear(): void {
        this.app.world.sceneIndex.clear();

        // Dispose proper meshes
        if (this.atomMesh) this.atomMesh.dispose();
        if (this.bondMesh) this.bondMesh.dispose();

        // Recreate base meshes
        const scene = this.app.world.scene;
        this.atomMesh = this.createBaseMesh("atom_base_renderer", "atomMat_impostor", scene);
        this.bondMesh = this.createBaseMesh("bond_base_renderer", "bondMat_impostor", scene);
    }

    // ============ Frame Rendering (Bulk) ============

    /**
     * Render a Frame into SceneIndex.
     * Computes render buffers and registers everything.
     */
    public renderFrame(
        frame: Frame,
        _box?: Box,
        options?: { atoms?: { radii?: number[], impostor?: boolean }, bonds?: { radii?: number, impostor?: boolean } }
    ): void {
        const sceneIndex = this.app.world.sceneIndex;
        // Optionally clear before rendering if this is a replacement (usually DrawFrame does clear)
        // But renderFrame logic itself is "load data".

        const atomsBlock = frame.getBlock("atoms");
        const bondsBlock = frame.getBlock("bonds");

        // --- ATOMS ---
        if (!atomsBlock || atomsBlock.nrows() === 0) return;

        const atomCount = atomsBlock.nrows();
        const xCoords = atomsBlock.getColumnF32("x");
        const yCoords = atomsBlock.getColumnF32("y");
        const zCoords = atomsBlock.getColumnF32("z");
        const elements = atomsBlock.getColumnStrings("element");

        if (!xCoords || !yCoords || !zCoords) return;

        // Buffers for Atom Pool
        const atomMatrix = new Float32Array(atomCount * 16);
        const atomData = new Float32Array(atomCount * 4);
        const atomColor = new Float32Array(atomCount * 4);
        const atomPick = new Float32Array(atomCount * 4);

        const styleManager = this.app.styleManager;
        const styleCache = new Map<string, { r: number, g: number, b: number, a: number, radius: number }>();
        const customRadii = options?.atoms?.radii;

        for (let i = 0; i < atomCount; i++) {
            const element = elements ? elements[i] : "C";
            let style = styleCache.get(element);
            if (!style) {
                const s = styleManager.getAtomStyle(element);
                const c = Color3.FromHexString(s.color).toLinearSpace();
                style = { r: c.r, g: c.g, b: c.b, a: s.alpha ?? 1.0, radius: s.radius };
                styleCache.set(element, style);
            }

            const radius = customRadii?.[i] ?? style.radius;
            const scale = radius * 2;
            const matOffset = i * 16;
            const idx4 = i * 4;

            // Matrix
            atomMatrix[matOffset + 0] = scale;
            atomMatrix[matOffset + 5] = scale;
            atomMatrix[matOffset + 10] = scale;
            atomMatrix[matOffset + 15] = 1;
            atomMatrix[matOffset + 12] = xCoords[i];
            atomMatrix[matOffset + 13] = yCoords[i];
            atomMatrix[matOffset + 14] = zCoords[i];

            // Data
            atomData[idx4 + 0] = xCoords[i];
            atomData[idx4 + 1] = yCoords[i];
            atomData[idx4 + 2] = zCoords[i];
            atomData[idx4 + 3] = radius;

            // Color
            atomColor[idx4 + 0] = style.r;
            atomColor[idx4 + 1] = style.g;
            atomColor[idx4 + 2] = style.b;
            atomColor[idx4 + 3] = style.a;

            // Picking
            const pCol = encodePickingColor(this.atomMesh.uniqueId, i);
            atomPick[idx4 + 0] = pCol[0];
            atomPick[idx4 + 1] = pCol[1];
            atomPick[idx4 + 2] = pCol[2];
            atomPick[idx4 + 3] = pCol[3];
        }

        const atomBuffers = new Map<string, Float32Array>();
        atomBuffers.set("matrix", atomMatrix);
        atomBuffers.set("instanceData", atomData);
        atomBuffers.set("instanceColor", atomColor);
        atomBuffers.set("instancePickingColor", atomPick);


        // --- BONDS ---
        let bondBuffers: Map<string, Float32Array> | undefined;
        let bondBlockObj: any = undefined;

        if (bondsBlock && bondsBlock.nrows() > 0) {
            bondBlockObj = bondsBlock;
            const bondCount = bondsBlock.nrows();
            const iAtoms = bondsBlock.getColumnU32("i");
            const jAtoms = bondsBlock.getColumnU32("j");

            if (iAtoms && jAtoms) {
                const bondMatrix = new Float32Array(bondCount * 16);
                const bondData0 = new Float32Array(bondCount * 4);
                const bondData1 = new Float32Array(bondCount * 4);
                const bondCol0 = new Float32Array(bondCount * 4);
                const bondCol1 = new Float32Array(bondCount * 4);
                const bondSplit = new Float32Array(bondCount * 4);
                const bondPick = new Float32Array(bondCount * 4);

                const bondRadius = options?.bonds?.radii ?? 0.1;
                const bondStyle = styleManager.getBondStyle(1);
                const defBondCol = Color3.FromHexString(bondStyle.color).toLinearSpace();
                const defBondAlpha = bondStyle.alpha ?? 1.0;

                // Caches for Bond Colors derived from Atoms
                const elemColors = new Map<string, Float32Array>();
                // Helper to get element color
                const getElemColor = (e: string) => {
                    let ec = elemColors.get(e);
                    if (!ec) {
                        const s = styleManager.getAtomStyle(e);
                        const c = Color3.FromHexString(s.color).toLinearSpace();
                        ec = new Float32Array([c.r, c.g, c.b, s.alpha ?? 1.0]);
                        elemColors.set(e, ec);
                    }
                    return ec;
                };

                const TMP_VEC_1 = new Vector3();
                const TMP_VEC_2 = new Vector3();
                const TMP_CENTER = new Vector3();
                const TMP_DIR = new Vector3();

                for (let b = 0; b < bondCount; b++) {
                    const i = iAtoms[b];
                    const j = jAtoms[b];

                    TMP_VEC_1.set(xCoords[i], yCoords[i], zCoords[i]);
                    TMP_VEC_2.set(xCoords[j], yCoords[j], zCoords[j]);

                    // center = (p1 + p2) * 0.5
                    TMP_CENTER.copyFrom(TMP_VEC_1).addInPlace(TMP_VEC_2).scaleInPlace(0.5);

                    // direction
                    TMP_DIR.copyFrom(TMP_VEC_2).subtractInPlace(TMP_VEC_1);
                    const dist = TMP_DIR.length();
                    if (dist > 1e-8) TMP_DIR.scaleInPlace(1 / dist);
                    else TMP_DIR.set(0, 1, 0);

                    const scale = dist + bondRadius * 2;
                    const matOffset = b * 16;
                    const idx4 = b * 4;

                    // Matrix
                    bondMatrix[matOffset + 0] = scale;
                    bondMatrix[matOffset + 5] = scale;
                    bondMatrix[matOffset + 10] = scale;
                    bondMatrix[matOffset + 15] = 1;
                    bondMatrix[matOffset + 12] = TMP_CENTER.x;
                    bondMatrix[matOffset + 13] = TMP_CENTER.y;
                    bondMatrix[matOffset + 14] = TMP_CENTER.z;

                    // Data0 (center, radius)
                    bondData0[idx4 + 0] = TMP_CENTER.x;
                    bondData0[idx4 + 1] = TMP_CENTER.y;
                    bondData0[idx4 + 2] = TMP_CENTER.z;
                    bondData0[idx4 + 3] = bondRadius;

                    // Data1 (dir, length)
                    bondData1[idx4 + 0] = TMP_DIR.x;
                    bondData1[idx4 + 1] = TMP_DIR.y;
                    bondData1[idx4 + 2] = TMP_DIR.z;
                    bondData1[idx4 + 3] = dist;

                    // Split (simplified)
                    bondSplit[idx4 + 0] = 0;

                    // Colors
                    let c0: Float32Array, c1: Float32Array;
                    if (elements) {
                        const e0 = elements[i] ?? "C";
                        const e1 = elements[j] ?? "C";
                        c0 = getElemColor(e0);
                        c1 = getElemColor(e1);
                    } else {
                        c0 = new Float32Array([defBondCol.r, defBondCol.g, defBondCol.b, defBondAlpha]);
                        c1 = c0;
                    }

                    bondCol0[idx4 + 0] = c0[0]; bondCol0[idx4 + 1] = c0[1]; bondCol0[idx4 + 2] = c0[2]; bondCol0[idx4 + 3] = c0[3];
                    bondCol1[idx4 + 0] = c1[0]; bondCol1[idx4 + 1] = c1[1]; bondCol1[idx4 + 2] = c1[2]; bondCol1[idx4 + 3] = c1[3];

                    // Picking
                    const p = encodePickingColor(this.bondMesh.uniqueId, b);
                    bondPick[idx4 + 0] = p[0]; bondPick[idx4 + 1] = p[1]; bondPick[idx4 + 2] = p[2]; bondPick[idx4 + 3] = p[3];
                }

                bondBuffers = new Map<string, Float32Array>();
                bondBuffers.set("matrix", bondMatrix);
                bondBuffers.set("instanceData0", bondData0);
                bondBuffers.set("instanceData1", bondData1);
                bondBuffers.set("instanceColor0", bondCol0);
                bondBuffers.set("instanceColor1", bondCol1);
                bondBuffers.set("instanceSplit", bondSplit);
                bondBuffers.set("instancePickingColor", bondPick);
            }
        }

        // DELEGATE TO SCENE INDEX
        sceneIndex.registerFrame({
            atomMesh: this.atomMesh,
            bondMesh: this.bondMesh,
            atomBlock: atomsBlock as any,
            bondBlock: bondBlockObj as any,
            atomBuffers,
            bondBuffers
        });

        // Box rendering logic (if box passed)
        // Usually box is handled by separate command or app logic, but Artist could own it.
        // For now, let's keep box logic outside or just allow calling drawBox here.
        // The original DrawFrameCommand handled box separately.
    }


    // ============ Single Drawing Methods ============

    /**
     * Draw an atom at the specified position
     */
    public drawAtom(position: Vector3, options: DrawAtomOptions): { atomId: number, meshId: number } {
        const atomId = options.atomId ?? this.app.world.sceneIndex.getNextAtomId();
        const element = options.element;
        const style = this.app.styleManager.getAtomStyle(element);
        const radius = options.radius || style.radius * 0.6;
        const scale = radius * 2;

        // Compute colors
        const c = Color3.FromHexString(style.color).toLinearSpace();

        // Build buffer values
        const values = new Map<string, Float32Array>();

        // Matrix (Scale + Translation)
        const matrix = new Float32Array(16);
        matrix[0] = scale; matrix[5] = scale; matrix[10] = scale; matrix[15] = 1;
        matrix[12] = position.x; matrix[13] = position.y; matrix[14] = position.z;
        values.set("matrix", matrix);

        // instanceData (x, y, z, radius)
        values.set("instanceData", new Float32Array([
            position.x, position.y, position.z, radius
        ]));

        // instanceColor (r, g, b, a)
        values.set("instanceColor", new Float32Array([c.r, c.g, c.b, style.alpha ?? 1.0]));

        // instancePickingColor will be set by the pool itself
        values.set("instancePickingColor", new Float32Array(4));

        // Create Atom in SceneIndex
        this.app.world.sceneIndex.createAtom(
            {
                atomId: atomId,
                element,
                position: { x: position.x, y: position.y, z: position.z }
            },
            values
        );

        // Get meshID for reference
        const atomState = this.app.world.sceneIndex.meshRegistry.getAtomState();
        const meshId = atomState ? atomState.mesh.uniqueId : 0;

        return { atomId, meshId };
    }

    /**
     * Draw a bond between two positions
     */
    public drawBond(start: Vector3, end: Vector3, options: DrawBondOptions = {}): { bondId: number, meshId: number } {
        const bondId = options.bondId ?? this.app.world.sceneIndex.getNextBondId();
        const order = options.order ?? 1;
        const bondRadius = options.radius || this.app.styleManager.getBondStyle(order).radius;

        // Compute center, direction, distance
        const center = start.add(end).scaleInPlace(0.5);
        const dir = end.subtract(start);
        const distance = dir.length();
        if (distance > 1e-8) {
            dir.scaleInPlace(1 / distance);
        } else {
            dir.set(0, 1, 0);
        }

        const scale = distance + bondRadius * 2;

        // Matrix
        const matrix = new Float32Array(16);
        matrix[0] = scale; matrix[5] = scale; matrix[10] = scale; matrix[15] = 1;
        matrix[12] = center.x; matrix[13] = center.y; matrix[14] = center.z;

        // instanceData0 (center.xyz, bondRadius)
        const data0 = new Float32Array([center.x, center.y, center.z, bondRadius]);

        // instanceData1 (dir.xyz, distance)
        const data1 = new Float32Array([dir.x, dir.y, dir.z, distance]);

        // Colors
        let c0: Float32Array, c1: Float32Array;
        const atomId1 = options.atomId1 ?? 0;
        const atomId2 = options.atomId2 ?? 0;

        c0 = this.getAtomColor(atomId1);
        c1 = this.getAtomColor(atomId2);

        // Split offset
        const r0 = this.getAtomRadius(atomId1);
        const r1 = this.getAtomRadius(atomId2);
        const splitOffset = (r0 - r1) * 0.5;

        const values = new Map<string, Float32Array>();
        values.set("matrix", matrix);
        values.set("instanceData0", data0);
        values.set("instanceData1", data1);
        values.set("instanceColor0", c0);
        values.set("instanceColor1", c1);
        values.set("instanceSplit", new Float32Array([splitOffset, 0, 0, 0]));
        values.set("instancePickingColor", new Float32Array(4));

        // Create Bond
        this.app.world.sceneIndex.createBond(
            {
                bondId: bondId,
                atomId1,
                atomId2,
                order,
                start: { x: start.x, y: start.y, z: start.z },
                end: { x: end.x, y: end.y, z: end.z }
            },
            values
        );

        const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();
        const meshId = bondState ? bondState.mesh.uniqueId : 0;

        return { bondId, meshId };
    }

    /**
     * Delete an atom
     */
    public deleteAtom(meshId: number, atomId: number): void {
        this.app.world.sceneIndex.unregisterEditAtom(meshId, atomId);
    }

    /**
     * Delete a bond
     */
    public deleteBond(meshId: number, bondId: number): void {
        this.app.world.sceneIndex.unregisterEditBond(meshId, bondId);
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.atomMesh.dispose();
        this.bondMesh.dispose();
    }


    // ============ Helpers ============

    private createBaseMesh(name: string, materialName: string, scene: Scene): Mesh {
        let material = scene.getMaterialByName(materialName) as ShaderMaterial | null;
        if (!material) {
            material = this.createMaterial(materialName, scene);
        }

        const mesh = MeshBuilder.CreatePlane(name, { size: 1.0 }, scene);
        mesh.material = material;
        mesh.freezeWorldMatrix(); // Optimization
        mesh.isVisible = false; // Hidden by default, activated by ImpostorState
        return mesh;
    }

    private createMaterial(name: string, scene: Scene): ShaderMaterial {
        const isAtom = name.includes("atom");

        const material = new ShaderMaterial(
            name,
            scene,
            {
                vertex: isAtom ? "sphereImpostor" : "bondImpostor",
                fragment: isAtom ? "sphereImpostor" : "bondImpostor"
            },
            {
                attributes: isAtom
                    ? ["position", "uv", "instanceData", "instanceColor", "instancePickingColor"]
                    : ["position", "uv", "instanceData0", "instanceData1", "instanceColor0", "instanceColor1", "instanceSplit", "instancePickingColor"],
                uniforms: ["view", "projection", "lightDir", "lightAmbient", "lightDiffuse", "lightSpecular", "lightSpecularPower", "uPickingEnabled"]
            }
        );

        material.backFaceCulling = false;
        material.alphaMode = Engine.ALPHA_DISABLE;
        material.disableDepthWrite = false;

        material.onBindObservable.add(() => {
            if (!material) return;
            material.setMatrix("view", scene.getViewMatrix());
            material.setMatrix("projection", scene.getProjectionMatrix());
            material.setFloat("uPickingEnabled", this.app.world.picker?.isPicking ? 1.0 : 0.0);

            const lighting = this.app.settings.getLighting();

            // RHS Correction: Flip Z of lightDir if using Right Handed System
            let zParams = lighting.lightDir[2];
            if (this.app.config.useRightHandedSystem) {
                zParams = -zParams;
            }

            material.setVector3("lightDir", new Vector3(lighting.lightDir[0], lighting.lightDir[1], zParams));
            material.setFloat("lightAmbient", lighting.ambient);
            material.setFloat("lightDiffuse", lighting.diffuse);
            material.setFloat("lightSpecular", lighting.specular);
            material.setFloat("lightSpecularPower", lighting.specularPower);
        });

        return material;
    }

    private getAtomColor(atomId: number): Float32Array {
        const meta = this.app.world.sceneIndex.metaRegistry.atoms.getMeta(atomId);
        if (meta) {
            const s = this.app.styleManager.getAtomStyle(meta.element);
            const c = Color3.FromHexString(s.color).toLinearSpace();
            return new Float32Array([c.r, c.g, c.b, s.alpha ?? 1.0]);
        }
        // Fallback to carbon
        const s = this.app.styleManager.getAtomStyle('C');
        const c = Color3.FromHexString(s.color).toLinearSpace();
        return new Float32Array([c.r, c.g, c.b, s.alpha ?? 1.0]);
    }

    private getAtomRadius(atomId: number): number {
        const meta = this.app.world.sceneIndex.metaRegistry.atoms.getMeta(atomId);
        if (meta) {
            return this.app.styleManager.getAtomStyle(meta.element).radius;
        }
        return this.app.styleManager.getAtomStyle('C').radius;
    }
}
