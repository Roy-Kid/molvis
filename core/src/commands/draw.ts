import * as BABYLON from "@babylonjs/core";
import { Vector3, MeshBuilder, Color3, Mesh, type Scene } from "@babylonjs/core";
import type { MolvisApp } from "../core/app";
import { Command, command } from "./base";
import { Frame, Block } from "molrs-wasm";
import "../shaders/impostor"; // Register shaders

// Reusable scratch variables to avoid GC in tight loops
const TMP_VEC_1 = new Vector3();
const TMP_VEC_2 = new Vector3();
const TMP_VEC_CENTER = new Vector3();
const TMP_VEC_DIR = new Vector3();

export interface DrawAtomsOption {
    radii?: number[];
    color?: string[];
    impostor?: boolean;
}

export interface DrawBondsOption {
    radii?: number;
    impostor?: boolean;
    bicolor?: boolean;
}

export interface DrawFrameOption {
    atoms?: DrawAtomsOption;
    bonds?: DrawBondsOption;
}

/**
 * Command to draw a simulation box (wireframe)
 */
@command("draw_box")
export class DrawBoxCommand extends Command<void> {
    private boxMesh: BABYLON.Mesh | null = null;
    private box: any;

    constructor(
        app: MolvisApp,
        args: { box: any; options?: any }
    ) {
        super(app);
        this.box = args.box;
    }

    do(): void {
        const scene = this.app.world.scene;

        // Clear existing box
        const existingBox = scene.getMeshByName("sim_box");
        if (existingBox) {
            this.app.world.sceneIndex.unregister(existingBox.uniqueId);
            existingBox.dispose();
        }

        // Parse box dimensions
        let lx = 10, ly = 10, lz = 10;
        let ox = 0, oy = 0, oz = 0;
        if (Array.isArray(this.box)) {
            if (this.box.length === 3) {
                [lx, ly, lz] = this.box;
            } else if (this.box.length === 9) {
                lx = this.box[0];
                ly = this.box[4];
                lz = this.box[8];
            }
        } else if (this.box && typeof this.box === "object") {
            const maybeBox = this.box as { origin?: number[]; lengths?: number[] };
            if (Array.isArray(maybeBox.lengths) && maybeBox.lengths.length >= 3) {
                [lx, ly, lz] = maybeBox.lengths;
            }
            if (Array.isArray(maybeBox.origin) && maybeBox.origin.length >= 3) {
                [ox, oy, oz] = maybeBox.origin;
            }
        }

        // Create box mesh
        this.boxMesh = BABYLON.MeshBuilder.CreateBox(
            "sim_box",
            { width: lx, height: ly, depth: lz },
            scene
        );

        this.boxMesh.position = new BABYLON.Vector3(ox + lx / 2, oy + ly / 2, oz + lz / 2);

        // Create wireframe material
        const wireframeMaterial = this.app.styleManager.getBoxMaterial();
        this.boxMesh.material = wireframeMaterial;
        this.boxMesh.isVisible = true;

        this.boxMesh.isPickable = false;

        this.app.world.sceneIndex.registerBox({
            mesh: this.boxMesh,
            meta: {
                dimensions: [lx, ly, lz],
                origin: [ox, oy, oz]
            }
        });
    }

    undo(): Command {
        if (this.boxMesh) {
            this.app.world.sceneIndex.unregister(this.boxMesh.uniqueId);
            this.boxMesh.dispose();
            this.boxMesh = null;
        }
        return new NoOpCommand(this.app);
    }
}

/**
 * Command to draw atoms and bonds using Thin Instances
 */
@command("draw_frame")
export class DrawFrameCommand extends Command<void> {
    private createdMeshes: BABYLON.AbstractMesh[] = [];
    private boxMesh: BABYLON.Mesh | null = null;
    private frame: Frame;
    private options?: DrawFrameOption;

    constructor(
        app: MolvisApp,
        args: {
            frame: Frame;
            options?: DrawFrameOption;
        }
    ) {
        super(app);
        this.frame = args.frame;
        this.options = args.options;
    }

    do(): void {
        const scene = this.app.world.scene;
        const drawOptions = this.options ?? {};

        // Render Atoms (Thin Instances)
        const atomsBlock = this.frame.getBlock("atoms");
        let atomMesh: BABYLON.Mesh | undefined;
        if (atomsBlock && atomsBlock.len()! > 0) {
            atomMesh = this.createAtomMesh(scene, drawOptions, atomsBlock);
            this.createdMeshes.push(atomMesh);
        }

        // Render Bonds (Thin Instances)
        const bondsBlock = this.frame.getBlock("bonds");
        let bondMesh: BABYLON.Mesh | undefined;
        if (bondsBlock && bondsBlock.len()! > 0) {
            if (!atomsBlock || atomsBlock.len() === 0) {
                console.warn("[DrawFrame] Bonds present without atoms; skipping bond rendering.");
            } else {
                bondMesh = this.createBondMesh(scene, drawOptions, atomsBlock, bondsBlock);
                this.createdMeshes.push(bondMesh);
            }
        }

        // Register frame with SceneIndex (single call for all thin instances)
        if (atomMesh && atomsBlock) {
            this.app.world.sceneIndex.registerFrame({
                atomMesh,
                bondMesh: bondMesh ?? undefined,
                atomBlock: atomsBlock,
                bondBlock: bondsBlock || undefined
            });
        }

        // Draw Box if explicitly defined in frame metadata
        const boxData = this.getBoxData(this.frame);
        if (boxData) {
            const existingBox = scene.getMeshByName("sim_box");
            if (existingBox) {
                this.app.world.sceneIndex.unregister(existingBox.uniqueId);
                existingBox.dispose();
            }

            const [lx, ly, lz] = boxData.lengths;
            const [ox, oy, oz] = boxData.origin;

            const boxMesh = BABYLON.MeshBuilder.CreateBox(
                "sim_box",
                { width: lx, height: ly, depth: lz },
                scene
            );
            boxMesh.position = new BABYLON.Vector3(ox + lx / 2, oy + ly / 2, oz + lz / 2);

            const wireframeMaterial = this.app.styleManager.getBoxMaterial();
            boxMesh.material = wireframeMaterial;
            boxMesh.isVisible = true;
            boxMesh.isPickable = false;

            this.app.world.sceneIndex.registerBoxFromFrame(boxMesh, {
                dimensions: [lx, ly, lz],
                origin: [ox, oy, oz]
            });
            this.boxMesh = boxMesh;
        }
    }

    private createAtomMesh(scene: BABYLON.Scene, drawOptions: DrawFrameOption, atomsBlock: Block): BABYLON.Mesh {
        const atomCount = atomsBlock.nrows()!;
        const xCoords = atomsBlock.getColumnF32("x")!;
        const yCoords = atomsBlock.getColumnF32("y")!;
        const zCoords = atomsBlock.getColumnF32("z")!;
        const elements = atomsBlock.getColumnStrings("element");
        if (!elements) {
            console.warn("[DrawFrame] Missing element column; defaulting to C for all atoms.");
        }

        // Force Impostor for Atoms
        let atomMaterial = scene.getMaterialByName("atomMat_impostor") as BABYLON.ShaderMaterial;
        if (!atomMaterial) {
            atomMaterial = new BABYLON.ShaderMaterial(
                "atomMat_impostor",
                scene,
                { vertex: "sphereImpostor", fragment: "sphereImpostor" },
                {
                    attributes: ["position", "uv", "instanceData", "instanceColor"],
                    uniforms: ["view", "projection", "lightDir", "lightAmbient", "lightDiffuse", "lightSpecular", "lightSpecularPower"]
                }
            );
            atomMaterial.backFaceCulling = false;
            atomMaterial.alphaMode = BABYLON.Engine.ALPHA_DISABLE;
            atomMaterial.disableDepthWrite = false;
            atomMaterial.onBindObservable.add(() => {
                atomMaterial.setMatrix("view", scene.getViewMatrix());
                atomMaterial.setMatrix("projection", scene.getProjectionMatrix());

                const lighting = this.app.settings.getLighting();
                atomMaterial.setVector3("lightDir", new BABYLON.Vector3(lighting.lightDir[0], lighting.lightDir[1], lighting.lightDir[2]));

                atomMaterial.setFloat("lightAmbient", lighting.ambient);
                atomMaterial.setFloat("lightDiffuse", lighting.diffuse);
                atomMaterial.setFloat("lightSpecular", lighting.specular);
                atomMaterial.setFloat("lightSpecularPower", lighting.specularPower);
            });
        }

        const sphereBase = BABYLON.MeshBuilder.CreatePlane("atom_base", { size: 1.0 }, scene);
        sphereBase.material = atomMaterial;

        // Optimization flags
        // sphereBase.isPickable = true;
        // sphereBase.doNotSyncBoundingInfo = true;
        sphereBase.freezeWorldMatrix();

        // Buffers
        const matrixBuffer = new Float32Array(atomCount * 16);
        const colorBuffer = new Float32Array(atomCount * 4);
        const instanceDataBuffer = new Float32Array(atomCount * 4);

        const styleManager = this.app.styleManager;
        const styleCache = new Map<string, { r: number, g: number, b: number, a: number, radius: number }>();
        const customRadii = drawOptions.atoms?.radii;

        for (let i = 0; i < atomCount; i++) {
            const element = elements ? elements[i] : "C";

            let style = styleCache.get(element);
            if (!style) {
                const s = styleManager.getAtomStyle(element);
                const c = BABYLON.Color3.FromHexString(s.color);
                const color = c.toLinearSpace();
                style = { r: color.r, g: color.g, b: color.b, a: s.alpha ?? 1.0, radius: s.radius };
                styleCache.set(element, style);
            }

            const radius = customRadii?.[i] ?? style.radius * 0.6;
            const scale = radius * 2;

            const matOffset = i * 16;

            // Build Matrix (Scale + Translation)
            matrixBuffer[matOffset + 0] = scale;
            matrixBuffer[matOffset + 1] = 0;
            matrixBuffer[matOffset + 2] = 0;
            matrixBuffer[matOffset + 3] = 0;

            matrixBuffer[matOffset + 4] = 0;
            matrixBuffer[matOffset + 5] = scale;
            matrixBuffer[matOffset + 6] = 0;
            matrixBuffer[matOffset + 7] = 0;

            matrixBuffer[matOffset + 8] = 0;
            matrixBuffer[matOffset + 9] = 0;
            matrixBuffer[matOffset + 10] = scale;
            matrixBuffer[matOffset + 11] = 0;

            matrixBuffer[matOffset + 12] = xCoords[i];
            matrixBuffer[matOffset + 13] = yCoords[i];
            matrixBuffer[matOffset + 14] = zCoords[i];
            matrixBuffer[matOffset + 15] = 1;

            const idx4 = i * 4;
            colorBuffer[idx4 + 0] = style.r;
            colorBuffer[idx4 + 1] = style.g;
            colorBuffer[idx4 + 2] = style.b;
            colorBuffer[idx4 + 3] = style.a;

            instanceDataBuffer[idx4 + 0] = xCoords[i];
            instanceDataBuffer[idx4 + 1] = yCoords[i];
            instanceDataBuffer[idx4 + 2] = zCoords[i];
            instanceDataBuffer[idx4 + 3] = radius;
        }

        sphereBase.thinInstanceSetBuffer("matrix", matrixBuffer, 16, true);
        sphereBase.thinInstanceSetBuffer("matrix", matrixBuffer, 16, true);
        sphereBase.thinInstanceSetBuffer("instanceData", instanceDataBuffer, 4, true);
        sphereBase.thinInstanceSetBuffer("instanceColor", colorBuffer, 4, true);
        sphereBase.thinInstanceEnablePicking = true;
        sphereBase.thinInstanceRefreshBoundingInfo(true);

        return sphereBase;
    }

    private createBondMesh(scene: BABYLON.Scene, drawOptions: DrawFrameOption, atomsBlock: Block, bondsBlock: Block): BABYLON.Mesh {
        const bondCount = bondsBlock.nrows();
        const bondRadius = drawOptions.bonds?.radii ?? 0.1;
        // Force Impostor for Bonds to match Atoms depth logic
        let bondMaterial = scene.getMaterialByName("bondMat_impostor") as BABYLON.ShaderMaterial;
        if (!bondMaterial) {
            bondMaterial = new BABYLON.ShaderMaterial(
                "bondMat_impostor",
                scene,
                { vertex: "bondImpostor", fragment: "bondImpostor" },
                {
                    attributes: ["position", "uv", "instanceData0", "instanceData1", "instanceColor0", "instanceColor1", "instanceSplit"],
                    uniforms: ["view", "projection", "lightDir", "lightAmbient", "lightDiffuse", "lightSpecular", "lightSpecularPower"]
                }
            );
            bondMaterial.backFaceCulling = false;
            bondMaterial.alphaMode = BABYLON.Engine.ALPHA_DISABLE;
            bondMaterial.disableDepthWrite = false;
            bondMaterial.onBindObservable.add(() => {
                bondMaterial.setMatrix("view", scene.getViewMatrix());
                bondMaterial.setMatrix("projection", scene.getProjectionMatrix());

                const lighting = this.app.settings.getLighting();
                bondMaterial.setVector3("lightDir", new BABYLON.Vector3(lighting.lightDir[0], lighting.lightDir[1], lighting.lightDir[2]));
                bondMaterial.setFloat("lightAmbient", lighting.ambient);
                bondMaterial.setFloat("lightDiffuse", lighting.diffuse);
                bondMaterial.setFloat("lightSpecular", lighting.specular);
                bondMaterial.setFloat("lightSpecularPower", lighting.specularPower);
            });
        }

        const cylinderBase = BABYLON.MeshBuilder.CreatePlane("bond_base", { size: 1.0 }, scene);
        cylinderBase.material = bondMaterial;
        cylinderBase.freezeWorldMatrix();

        // Buffers
        // Buffers
        const matrixBuffer = new Float32Array(bondCount * 16);
        const instanceData0 = new Float32Array(bondCount * 4);
        const instanceData1 = new Float32Array(bondCount * 4);
        const instanceColor0 = new Float32Array(bondCount * 4);
        const instanceColor1 = new Float32Array(bondCount * 4);
        const instanceSplit = new Float32Array(bondCount * 4);

        const xCoords = atomsBlock.getColumnF32("x")!;
        const yCoords = atomsBlock.getColumnF32("y")!;
        const zCoords = atomsBlock.getColumnF32("z")!;
        const i_atoms = bondsBlock.getColumnU32("i")!;
        const j_atoms = bondsBlock.getColumnU32("j")!;

        // Cache for bond style / atom colors
        const styleManager = this.app.styleManager;
        let cachedBondColor: Float32Array | null = null;
        const elementColors = new Map<string, Float32Array>();
        const elementRadii = new Map<string, number>();
        const elements = atomsBlock.getColumnStrings("element");
        const customAtomRadii = drawOptions.atoms?.radii;

        for (let b = 0; b < bondCount; b++) {
            const i = i_atoms[b];
            const j = j_atoms[b];

            // Reusing static vectors
            TMP_VEC_1.set(xCoords[i], yCoords[i], zCoords[i]); // p1
            TMP_VEC_2.set(xCoords[j], yCoords[j], zCoords[j]); // p2

            // center = (p1 + p2) * 0.5
            TMP_VEC_CENTER.copyFrom(TMP_VEC_1).addInPlace(TMP_VEC_2).scaleInPlace(0.5);

            // direction = (p2 - p1).normalize()
            TMP_VEC_DIR.copyFrom(TMP_VEC_2).subtractInPlace(TMP_VEC_1);
            const distance = TMP_VEC_DIR.length();
            if (distance > 1e-8) {
                TMP_VEC_DIR.scaleInPlace(1 / distance);
            } else {
                TMP_VEC_DIR.set(0, 1, 0);
            }

            const idx4 = b * 4;
            instanceData0[idx4 + 0] = TMP_VEC_CENTER.x;
            instanceData0[idx4 + 1] = TMP_VEC_CENTER.y;
            instanceData0[idx4 + 2] = TMP_VEC_CENTER.z;
            instanceData0[idx4 + 3] = bondRadius;

            instanceData1[idx4 + 0] = TMP_VEC_DIR.x;
            instanceData1[idx4 + 1] = TMP_VEC_DIR.y;
            instanceData1[idx4 + 2] = TMP_VEC_DIR.z;
            instanceData1[idx4 + 3] = distance;

            const matOffset = b * 16;
            const scale = distance + bondRadius * 2;
            matrixBuffer[matOffset + 0] = scale;
            matrixBuffer[matOffset + 5] = scale;
            matrixBuffer[matOffset + 10] = scale;
            matrixBuffer[matOffset + 15] = 1;
            matrixBuffer[matOffset + 12] = TMP_VEC_CENTER.x;
            matrixBuffer[matOffset + 13] = TMP_VEC_CENTER.y;
            matrixBuffer[matOffset + 14] = TMP_VEC_CENTER.z;

            // Split calculation
            let r0 = 0;
            let r1 = 0;
            if (elements) {
                const e0 = elements[i] ?? "C";
                const e1 = elements[j] ?? "C";
                let cachedR0 = elementRadii.get(e0);
                if (cachedR0 === undefined) {
                    const s0 = styleManager.getAtomStyle(e0);
                    cachedR0 = s0.radius;
                    elementRadii.set(e0, cachedR0);
                }
                let cachedR1 = elementRadii.get(e1);
                if (cachedR1 === undefined) {
                    const s1 = styleManager.getAtomStyle(e1);
                    cachedR1 = s1.radius;
                    elementRadii.set(e1, cachedR1);
                }
                r0 = cachedR0;
                r1 = cachedR1;
            }
            if (customAtomRadii) {
                r0 = customAtomRadii[i] ?? r0;
                r1 = customAtomRadii[j] ?? r1;
            }
            const splitOffset = (r0 - r1) * 0.4;
            instanceSplit[idx4 + 0] = splitOffset;
            instanceSplit[idx4 + 1] = 0;
            instanceSplit[idx4 + 2] = 0;
            instanceSplit[idx4 + 3] = 0;

            if (!cachedBondColor) {
                const style = styleManager.getBondStyle(1);
                const color = BABYLON.Color3.FromHexString(style.color);
                cachedBondColor = new Float32Array([color.r, color.g, color.b, style.alpha ?? 1.0]);
            }

            const colOffset = b * 4;
            let c0 = cachedBondColor;
            let c1 = cachedBondColor;

            if (elements) {
                const e0 = elements[i] ?? "C";
                const e1 = elements[j] ?? "C";
                let cached0 = elementColors.get(e0);
                if (!cached0) {
                    const s0 = styleManager.getAtomStyle(e0);
                    const col0 = BABYLON.Color3.FromHexString(s0.color);
                    const c = col0.toLinearSpace();
                    cached0 = new Float32Array([c.r, c.g, c.b, s0.alpha ?? 1.0]);
                    elementColors.set(e0, cached0);
                }
                let cached1 = elementColors.get(e1);
                if (!cached1) {
                    const s1 = styleManager.getAtomStyle(e1);
                    const col1 = BABYLON.Color3.FromHexString(s1.color);
                    const c = col1.toLinearSpace();
                    cached1 = new Float32Array([c.r, c.g, c.b, s1.alpha ?? 1.0]);
                    elementColors.set(e1, cached1);
                }
                c0 = cached0;
                c1 = cached1;
            }

            instanceColor0[colOffset + 0] = c0[0];
            instanceColor0[colOffset + 1] = c0[1];
            instanceColor0[colOffset + 2] = c0[2];
            instanceColor0[colOffset + 3] = c0[3];

            instanceColor1[colOffset + 0] = c1[0];
            instanceColor1[colOffset + 1] = c1[1];
            instanceColor1[colOffset + 2] = c1[2];
            instanceColor1[colOffset + 3] = c1[3];
        }

        cylinderBase.thinInstanceSetBuffer("matrix", matrixBuffer, 16, true);
        cylinderBase.thinInstanceSetBuffer("instanceData0", instanceData0, 4, true);
        cylinderBase.thinInstanceSetBuffer("instanceData1", instanceData1, 4, true);
        cylinderBase.thinInstanceSetBuffer("instanceColor0", instanceColor0, 4, true);
        cylinderBase.thinInstanceSetBuffer("instanceColor1", instanceColor1, 4, true);
        cylinderBase.thinInstanceSetBuffer("instanceSplit", instanceSplit, 4, true);
        cylinderBase.thinInstanceEnablePicking = true;
        // cylinderBase.thinInstanceRefreshBoundingInfo(true);

        return cylinderBase;
    }

    undo(): Command {
        this.createdMeshes.forEach((mesh) => mesh.dispose());
        this.createdMeshes = [];
        if (this.boxMesh) {
            this.app.world.sceneIndex.unregister(this.boxMesh.uniqueId);
            this.boxMesh.dispose();
            this.boxMesh = null;
        }
        return new NoOpCommand(this.app);
    }

    private getBoxData(
        frame: Frame
    ): { origin: [number, number, number]; lengths: [number, number, number] } | null {
        // Strict: Only look for standard 'box' metadata
        const boxMeta = frame.getMeta("box");
        if (!boxMeta) return null;

        return this.parseBoxMeta(boxMeta);
    }

    /**
     * Parse box metadata.
     * STRICT MODE: Expects valid valid JSON object with 'dimensions' (or 'lengths') and optional 'origin'.
     * No fallbacks for array strings or raw number lists.
     */
    private parseBoxMeta(
        boxMeta: string
    ): { origin: [number, number, number]; lengths: [number, number, number] } | null {
        const parsed = JSON.parse(boxMeta) as unknown;

        if (!parsed || typeof parsed !== 'object') {
            throw new Error("[DrawBox] Invalid box metadata: expected JSON object");
        }

        // Duck typing check for Box interface
        const maybeBox = parsed as {
            dimensions?: number[];
            origin?: number[]
        };

        // Strict: only support 'dimensions'
        const dims = maybeBox.dimensions;
        if (!Array.isArray(dims) || dims.length < 3) {
            throw new Error("[DrawBox] Invalid box metadata: missing valid dimensions array");
        }

        const lengths: [number, number, number] = [dims[0], dims[1], dims[2]];

        // Optional origin
        let origin: [number, number, number] = [0, 0, 0];
        if (Array.isArray(maybeBox.origin) && maybeBox.origin.length >= 3) {
            origin = [maybeBox.origin[0], maybeBox.origin[1], maybeBox.origin[2]];
        }

        return { origin, lengths };
    }
}

/**
 * No-op command for cases where undo is not applicable
 */
class NoOpCommand extends Command<void> {
    do(): void {
        // Do nothing
    }

    undo(): Command {
        return this;
    }
}

/**
 * Command to draw an atom
 */
export interface DrawAtomOptions {
    element: string;
    name?: string;
    radius?: number;
    color?: string;
    atomId?: number;
}

/**
 * Options for drawing a bond
 */
export interface DrawBondOptions {
    order?: number;
    radius?: number;
    color?: string;
    atomId1?: number;
    atomId2?: number;
    bondId?: number;
}

/**
 * Command to draw an atom in Edit mode
 */
export class DrawAtomCommand extends Command<Mesh> {
    private mesh: Mesh | null = null;

    constructor(
        app: MolvisApp,
        private position: Vector3,
        private options: DrawAtomOptions,
        private scene: Scene
    ) {
        super(app);
    }

    do(): Mesh {
        const { element, name, radius, color } = this.options;

        const style = this.app.styleManager.getAtomStyle(element);
        const atomRadius = radius || style.radius;

        this.mesh = MeshBuilder.CreateSphere(
            name || `atom_${element}_${Date.now()}`,
            { diameter: atomRadius * 2, segments: 16 },
            this.scene
        );

        this.mesh.position = this.position.clone();

        const material = this.app.styleManager.getAtomMaterial(element);
        // If custom color is provided, we clone and set it (rare case in Edit mode)
        if (color) {
            const customMat = material.clone(`${material.name}_custom_${Date.now()}`);
            customMat.diffuseColor = Color3.FromHexString(color);
            this.mesh.material = customMat;
        } else {
            this.mesh.material = material;
        }

        // Register with SceneIndex using new chemistry-semantic API
        this.app.world.sceneIndex.registerAtom({
            mesh: this.mesh,
            meta: {
                atomId: this.options.atomId ?? this.mesh.uniqueId,
                element,
                position: { x: this.position.x, y: this.position.y, z: this.position.z }
            }
        });

        return this.mesh;
    }

    undo(): Command {
        if (!this.mesh) {
            throw new Error("Cannot undo DrawAtomCommand: mesh not created");
        }
        this.app.world.sceneIndex.unregister(this.mesh.uniqueId);
        this.mesh.dispose();
        // Mark as unsaved when undoing an addition
        this.app.world.sceneIndex.markAllUnsaved();
        return new NoOpCommand(this.app);
    }
}

/**
 * Command to delete an atom and connected bonds
 */
export class DeleteAtomCommand extends Command<void> {
    private deletedBonds: Mesh[] = [];

    constructor(
        app: MolvisApp,
        private mesh: Mesh,
        private scene: Scene
    ) {
        super(app);
    }

    do(): void {
        // Find and delete connected bonds
        this.deletedBonds = [];
        const atomPos = this.mesh.position;

        this.scene.meshes.forEach((m) => {
            const bondMeta = this.app.world.sceneIndex.getMeta(m.uniqueId);
            if (bondMeta && bondMeta.type === 'bond') {
                const start = new Vector3(bondMeta.start.x, bondMeta.start.y, bondMeta.start.z);
                const end = new Vector3(bondMeta.end.x, bondMeta.end.y, bondMeta.end.z);
                if (
                    Vector3.Distance(start, atomPos) < 0.01 ||
                    Vector3.Distance(end, atomPos) < 0.01
                ) {
                    this.deletedBonds.push(m as Mesh);
                }
            }
        });

        // Dispose bonds and unregister from SceneIndex
        this.deletedBonds.forEach((b) => {
            this.app.world.sceneIndex.unregister(b.uniqueId);
            b.dispose();
        });

        // Unregister and dispose atom
        this.app.world.sceneIndex.unregister(this.mesh.uniqueId);
        this.mesh.dispose();
        this.app.world.sceneIndex.markAllUnsaved();
    }

    undo(): Command {
        return new NoOpCommand(this.app);
    }
}

/**
 * Command to draw a bond in Edit mode
 */
export class DrawBondCommand extends Command<Mesh> {
    private mesh: Mesh | null = null;

    constructor(
        app: MolvisApp,
        private start: Vector3,
        private end: Vector3,
        private options: DrawBondOptions,
        private scene: Scene
    ) {
        super(app);
    }

    do(): Mesh {
        const { order = 1, radius, color } = this.options;

        const style = this.app.styleManager.getBondStyle(order);

        const bondRadius = radius || style.radius;

        const direction = this.end.subtract(this.start);
        const length = direction.length();
        const midpoint = this.start.add(direction.scale(0.5));

        // For multiple bonds, create a parent mesh to hold all cylinders
        const parent = new Mesh(`bond_parent_${Date.now()}`, this.scene);
        parent.position = midpoint;

        // Calculate rotation for bond orientation
        const axis = Vector3.Cross(Vector3.Up(), direction.normalize());
        const angle = Math.acos(Vector3.Dot(Vector3.Up(), direction.normalize()));

        if (axis.length() > 0.001) {
            parent.rotationQuaternion = null;
            parent.rotate(axis.normalize(), angle);
        }

        // Create material
        let material = this.app.styleManager.getBondMaterial(order);
        if (color) {
            const customMat = material.clone(`${material.name}_custom_${Date.now()}`);
            customMat.diffuseColor = Color3.FromHexString(color);
            material = customMat;
        }

        // Draw cylinders based on bond order
        if (order === 1) {
            // Single bond - one cylinder in the center
            const cylinder = MeshBuilder.CreateCylinder(
                `bond_single`,
                {
                    height: length,
                    diameter: bondRadius * 2,
                    tessellation: 8,
                },
                this.scene
            );
            cylinder.material = material;
            cylinder.parent = parent;
        } else if (order === 2) {
            // Double bond - two parallel cylinders
            const offset = bondRadius * 2; // Distance between cylinders

            for (let i = 0; i < 2; i++) {
                const cylinder = MeshBuilder.CreateCylinder(
                    `bond_double_${i}`,
                    {
                        height: length,
                        diameter: bondRadius * 1.5, // Slightly thinner for double bonds
                        tessellation: 8,
                    },
                    this.scene
                );
                cylinder.material = material;
                cylinder.parent = parent;
                // Offset perpendicular to bond direction
                cylinder.position.x = (i - 0.5) * offset;
            }
        } else if (order === 3) {
            // Triple bond - three parallel cylinders
            const offset = bondRadius * 2;

            for (let i = 0; i < 3; i++) {
                const cylinder = MeshBuilder.CreateCylinder(
                    `bond_triple_${i}`,
                    {
                        height: length,
                        diameter: bondRadius * 1.2, // Even thinner for triple bonds
                        tessellation: 8,
                    },
                    this.scene
                );
                cylinder.material = material;
                cylinder.parent = parent;
                // Offset perpendicular to bond direction
                cylinder.position.x = (i - 1) * offset;
            }
        }

        this.mesh = parent;

        // Register with SceneIndex using new chemistry-semantic API
        this.app.world.sceneIndex.registerBond({
            mesh: this.mesh,
            meta: {
                bondId: this.options.bondId ?? this.mesh.uniqueId,
                atomId1: this.options.atomId1 ?? 0,
                atomId2: this.options.atomId2 ?? 0,
                order,
                start: { x: this.start.x, y: this.start.y, z: this.start.z },
                end: { x: this.end.x, y: this.end.y, z: this.end.z }
            }
        });

        return this.mesh;
    }

    undo(): Command {
        if (!this.mesh) {
            throw new Error("Cannot undo DrawBondCommand: mesh not created");
        }
        this.app.world.sceneIndex.unregister(this.mesh.uniqueId);
        this.mesh.dispose();
        return new NoOpCommand(this.app);
    }
}

/**
 * Command to delete a bond
 */
export class DeleteBondCommand extends Command<void> {
    constructor(
        app: MolvisApp,
        private mesh: Mesh
    ) {
        super(app);
    }

    do(): void {
        this.app.world.sceneIndex.unregister(this.mesh.uniqueId);
        this.mesh.dispose();
        this.app.world.sceneIndex.markAllUnsaved();
    }

    undo(): Command {
        return new NoOpCommand(this.app);
    }
}
