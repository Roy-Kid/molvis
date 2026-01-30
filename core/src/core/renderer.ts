import { Mesh, MeshBuilder, ShaderMaterial, Vector3, Engine, Scene, Color3 } from "@babylonjs/core";
import { type MolvisApp } from "./app";
import { encodePickingColor } from "./picker";
import "../shaders/impostor";

/**
 * Unified Renderer for Molecular Visualization.
 * 
 * Responsibilities:
 * - Owns rendering meshes (atom_base_renderer, bond_base_renderer).
 * - Computes render buffers from Frame Data.
 * - Delegates registration and resource management to SceneIndex.
 */
export class MolvisRenderer {
    private app: MolvisApp;

    // The singleton meshes (View Mode / Base)
    public atomMesh: Mesh;
    public bondMesh: Mesh;

    constructor(app: MolvisApp, scene: Scene) {
        this.app = app;

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
        // Meshes remain, but SceneIndex clears the instances via MeshRegistry/ImpostorState
    }

    /**
     * Load a Frame into SceneIndex.
     * Computes render buffers and registers everything.
     */
    public loadFrame(
        atomsBlock?: { nrows: () => number, getColumnF32: (n: string) => Float32Array | null, getColumnStrings: (n: string) => string[] | null },
        bondsBlock?: { nrows: () => number, getColumnU32: (n: string) => Uint32Array | null, getColumnU8: (n: string) => Uint8Array | null },
        options?: { atoms?: { radii?: number[], impostor?: boolean }, bonds?: { radii?: number, impostor?: boolean } }
    ): void {
        const sceneIndex = this.app.world.sceneIndex;

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

            const radius = customRadii?.[i] ?? style.radius * 0.6;
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
        let bondBlockObj: any = undefined; // For RegisterFrameOptions

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
            atomBlock: atomsBlock as any, // Cast to Block (Assuming compatible structural type)
            bondBlock: bondBlockObj as any,
            atomBuffers,
            bondBuffers
        });
    }

    /**
     * Helper to create base mesh with correct material
     */
    private createBaseMesh(name: string, materialName: string, scene: Scene): Mesh {
        let material = scene.getMaterialByName(materialName) as ShaderMaterial | null;
        if (!material) {
            // Material creation logic (duplicated from before, but centralized here now)
            material = this.createMaterial(materialName, scene);
        }

        const mesh = MeshBuilder.CreatePlane(name, { size: 1.0 }, scene);
        mesh.material = material;
        mesh.freezeWorldMatrix(); // Optimization
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
            material.setVector3("lightDir", new Vector3(lighting.lightDir[0], lighting.lightDir[1], lighting.lightDir[2]));
            material.setFloat("lightAmbient", lighting.ambient);
            material.setFloat("lightDiffuse", lighting.diffuse);
            material.setFloat("lightSpecular", lighting.specular);
            material.setFloat("lightSpecularPower", lighting.specularPower);
        });

        return material;
    }
}
