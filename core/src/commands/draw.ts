import * as BABYLON from "@babylonjs/core";
import { Vector3, MeshBuilder, Color3, Mesh, type Scene } from "@babylonjs/core";
import type { MolvisApp } from "../core/app";
import { Command, command } from "./base";
import { Frame, Block } from "molrs-wasm";
import "../shaders/impostor"; // Register shaders

// Reusable scratch variables to avoid GC in tight loops
const TMP_VEC_0 = new Vector3();
const TMP_VEC_1 = new Vector3();
const TMP_VEC_2 = new Vector3();
const TMP_VEC_CENTER = new Vector3();
const TMP_VEC_DIR = new Vector3();
const TMP_VEC_AXIS = new Vector3();
const TMP_MAT = BABYLON.Matrix.Identity();
const TMP_QUAT = BABYLON.Quaternion.Identity();
const UP_VECTOR = new Vector3(0, 1, 0);

export interface DrawAtomsOption {
    radii?: number[];
    color?: string[];
}

export interface DrawBondsOption {
    radii?: number;
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
            bondMesh = this.createBondMesh(scene, drawOptions, atomsBlock!, bondsBlock);
            this.createdMeshes.push(bondMesh);
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
        }
    }

    private createAtomMesh(scene: BABYLON.Scene, drawOptions: DrawFrameOption, atomsBlock: Block): BABYLON.Mesh {
        const atomCount = atomsBlock.nrows()!;
        const xCoords = atomsBlock.getColumnF32("x")!;
        const yCoords = atomsBlock.getColumnF32("y")!;
        const zCoords = atomsBlock.getColumnF32("z")!;
        let elements = atomsBlock.getColumnStrings("element");

        // Create material
        let atomMaterial = scene.getMaterialByName("atomMat_instanced") as BABYLON.StandardMaterial;
        if (!atomMaterial) {
            atomMaterial = new BABYLON.StandardMaterial("atomMat_instanced", scene);
            atomMaterial.diffuseColor = new BABYLON.Color3(1.0, 1.0, 1.0);
            const theme = this.app.styleManager.getTheme();
            atomMaterial.specularColor = BABYLON.Color3.FromHexString(theme.defaultSpecular);
            atomMaterial.freeze();
        }

        // Fallback to Geometry-based rendering (Safe Mode)
        // segments = 8 is a good balance between perf and shape for 10k+ atoms
        const sphereBase = BABYLON.MeshBuilder.CreateSphere(
            "atom_base",
            { diameter: 1.0, segments: 8 },
            scene
        );
        sphereBase.material = atomMaterial;

        // Optimization flags
        sphereBase.isPickable = true;
        sphereBase.doNotSyncBoundingInfo = true;
        sphereBase.alwaysSelectAsActiveMesh = true;
        sphereBase.freezeWorldMatrix();

        // Buffers
        const matrixBuffer = new Float32Array(atomCount * 16);
        const colorBuffer = new Float32Array(atomCount * 4);

        const styleManager = this.app.styleManager;
        const styleCache = new Map<string, { r: number, g: number, b: number, a: number, radius: number }>();
        const customRadii = drawOptions.atoms?.radii;

        for (let i = 0; i < atomCount; i++) {
            const element = elements[i];

            let style = styleCache.get(element);
            if (!style) {
                const s = styleManager.getAtomStyle(element);
                const c = BABYLON.Color3.FromHexString(s.color);
                style = { r: c.r, g: c.g, b: c.b, a: s.alpha ?? 1.0, radius: s.radius };
                styleCache.set(element, style);
            }

            const radius = customRadii?.[i] ?? style.radius;
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
        }

        sphereBase.thinInstanceSetBuffer("matrix", matrixBuffer, 16, true);
        sphereBase.thinInstanceSetBuffer("color", colorBuffer, 4, true);
        sphereBase.thinInstanceEnablePicking = true;
        // sphereBase.thinInstanceRefreshBoundingInfo(true);

        return sphereBase;
    }

    private createBondMesh(scene: BABYLON.Scene, drawOptions: DrawFrameOption, atomsBlock: Block, bondsBlock: Block): BABYLON.Mesh {
        const bondCount = bondsBlock.nrows();
        const bondRadius = drawOptions.bonds?.radii ?? 0.1;

        // Create material
        let bondMaterial = scene.getMaterialByName("bondMat_instanced") as BABYLON.StandardMaterial;
        if (!bondMaterial) {
            bondMaterial = new BABYLON.StandardMaterial("bondMat_instanced", scene);
            bondMaterial.diffuseColor = new BABYLON.Color3(1.0, 1.0, 1.0);
            const theme = this.app.styleManager.getTheme();
            bondMaterial.specularColor = BABYLON.Color3.FromHexString(theme.defaultSpecular);
            bondMaterial.freeze();
        }

        let tessellation = 8;
        // Create base mesh
        const cylinderBase = BABYLON.MeshBuilder.CreateCylinder(
            "bond_base",
            { height: 1.0, diameter: 1.0, tessellation },
            scene
        );
        cylinderBase.material = bondMaterial;
        cylinderBase.doNotSyncBoundingInfo = true;
        cylinderBase.alwaysSelectAsActiveMesh = true;
        cylinderBase.freezeWorldMatrix();

        // Buffers
        const matrixBuffer = new Float32Array(bondCount * 16);
        const colorBuffer = new Float32Array(bondCount * 4);

        const xCoords = atomsBlock.getColumnF32("x")!;
        const yCoords = atomsBlock.getColumnF32("y")!;
        const zCoords = atomsBlock.getColumnF32("z")!;
        const i_atoms = bondsBlock.getColumnU32("i")!;
        const j_atoms = bondsBlock.getColumnU32("j")!;

        // Cache for bond style
        const styleManager = this.app.styleManager;
        // Optimization: For single bond order (1), cache the color
        // If we support multiple orders mixed, we'd cache by order.
        let cachedBondColor: Float32Array | null = null;


        for (let b = 0; b < bondCount; b++) {
            const i = i_atoms[b];
            const j = j_atoms[b];

            // 1. Math Optimization: Reusing static vectors
            TMP_VEC_1.set(xCoords[i], yCoords[i], zCoords[i]); // p1
            TMP_VEC_2.set(xCoords[j], yCoords[j], zCoords[j]); // p2

            const distance = BABYLON.Vector3.Distance(TMP_VEC_1, TMP_VEC_2);

            // center = (p1 + p2) * 0.5
            TMP_VEC_CENTER.copyFrom(TMP_VEC_1).addInPlace(TMP_VEC_2).scaleInPlace(0.5);

            // direction = (p2 - p1).normalize()
            TMP_VEC_DIR.copyFrom(TMP_VEC_2).subtractInPlace(TMP_VEC_1).normalize();

            // Calculate rotation
            // axis = cross(up, direction)
            BABYLON.Vector3.CrossToRef(UP_VECTOR, TMP_VEC_DIR, TMP_VEC_AXIS);
            const angle = Math.acos(BABYLON.Vector3.Dot(UP_VECTOR, TMP_VEC_DIR));

            if (Math.abs(angle) < 0.0001) {
                TMP_QUAT.copyFrom(BABYLON.Quaternion.Identity());
            } else if (Math.abs(angle - Math.PI) < 0.0001) {
                // Anti-parallel, flip 180 deg around X
                BABYLON.Quaternion.FromEulerAnglesToRef(Math.PI, 0, 0, TMP_QUAT);
            } else {
                BABYLON.Quaternion.RotationAxisToRef(TMP_VEC_AXIS, angle, TMP_QUAT);
            }

            // Compose matrix directly to buffer would be hard, so use ComposeToRef
            // Scale: (bondRadius*2, distance, bondRadius*2)
            TMP_VEC_0.set(bondRadius * 2, distance, bondRadius * 2);

            BABYLON.Matrix.ComposeToRef(
                TMP_VEC_0,
                TMP_QUAT,
                TMP_VEC_CENTER,
                TMP_MAT
            );


            // Copy to buffer
            TMP_MAT.copyToArray(matrixBuffer, b * 16);

            // 2. Color Optimization
            // For now assuming all bonds are order 1 or we need to look it up?
            // The original code passed 'order' from frame but didn't actually read it inside the loop correctly?
            // Ah, the original code used default order 1.
            // "const style = this.app.styleManager.getBondStyle(1);" inside the loop.
            // If we want to support order from block we should read it.
            // But let's stick to the previous logic but cached.

            if (!cachedBondColor) {
                const style = styleManager.getBondStyle(1);
                const color = BABYLON.Color3.FromHexString(style.color);
                cachedBondColor = new Float32Array([color.r, color.g, color.b, style.alpha ?? 1.0]);
            }

            const colOffset = b * 4;
            colorBuffer[colOffset + 0] = cachedBondColor[0];
            colorBuffer[colOffset + 1] = cachedBondColor[1];
            colorBuffer[colOffset + 2] = cachedBondColor[2];
            colorBuffer[colOffset + 3] = cachedBondColor[3];
        }

        cylinderBase.thinInstanceSetBuffer("matrix", matrixBuffer, 16, true);
        cylinderBase.thinInstanceSetBuffer("color", colorBuffer, 4, true);
        cylinderBase.thinInstanceEnablePicking = true;
        // cylinderBase.thinInstanceRefreshBoundingInfo(true);

        return cylinderBase;
    }

    undo(): Command {
        this.createdMeshes.forEach((mesh) => mesh.dispose());
        this.createdMeshes = [];
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
