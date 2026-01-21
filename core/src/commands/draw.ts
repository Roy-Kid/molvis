import * as BABYLON from "@babylonjs/core";
import { Vector3, MeshBuilder, StandardMaterial, Color3, Mesh, type Scene } from "@babylonjs/core";
import type { MolvisApp } from "../core/app";
import { Command, command } from "./base";
import { Frame, Block, type Box } from "molrs-wasm";

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
import type { Palette, ColorHex } from "./palette";


/**
 * Command to draw a simulation box (wireframe)
 */
@command("draw_box")
export class DrawBoxCommand extends Command<void> {
    private boxMesh: BABYLON.Mesh | null = null;
    private box: any;
    private options?: any;

    constructor(
        app: MolvisApp,
        args: { box: any; options?: any }
    ) {
        super(app);
        this.box = args.box;
        this.options = args.options;
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
        const wireframeMaterial = new BABYLON.StandardMaterial("boxMat", scene);
        wireframeMaterial.wireframe = true;
        wireframeMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        this.boxMesh.material = wireframeMaterial;
        this.boxMesh.isVisible = true;

        this.boxMesh.isPickable = false;

        this.app.world.sceneIndex.registerBox({
            mesh: { uniqueId: this.boxMesh.uniqueId },
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
    private frame?: Frame;
    private frameData?: {
        blocks: {
            atoms: {
                x: number[] | Float32Array;
                y: number[] | Float32Array;
                z: number[] | Float32Array;
                element: string[];
            };
            bonds?: {
                i: number[] | Uint32Array;
                j: number[] | Uint32Array;
                order?: number[] | Uint8Array;
            };
        };
        metadata?: Record<string, unknown>;
        box?: unknown;
    };
    private options?: DrawFrameOption;

    constructor(
        app: MolvisApp,
        args: {
            frame?: Frame;
            frameData?: {
                blocks: {
                    atoms: {
                        x: number[] | Float32Array;
                        y: number[] | Float32Array;
                        z: number[] | Float32Array;
                        element: string[];
                    };
                    bonds?: {
                        i: number[] | Uint32Array;
                        j: number[] | Uint32Array;
                        order?: number[] | Uint8Array;
                    };
                };
                metadata?: Record<string, unknown>;
                box?: unknown;
            };
            options?: DrawFrameOption;
        }
    ) {
        super(app);
        this.frame = args.frame;
        this.frameData = args.frameData;
        this.options = args.options;
    }

    do(): void {
        if (!this.frame && this.frameData) {
            const atomsData = this.frameData.blocks.atoms;

            // Create atoms block using WASM Block directly
            const atomsBlock = new Block();
            atomsBlock.set_col_f32("x", new Float32Array(atomsData.x), undefined);
            atomsBlock.set_col_f32("y", new Float32Array(atomsData.y), undefined);
            atomsBlock.set_col_f32("z", new Float32Array(atomsData.z), undefined);
            atomsBlock.set_col_strings("element", atomsData.element, undefined);

            // Create Frame and insert atoms block
            this.frame = new Frame();
            this.frame.insert_block("atoms", atomsBlock);

            // Create bonds block if present
            const bondsData = this.frameData.blocks.bonds;
            if (bondsData) {
                const bondsBlock = new Block();
                bondsBlock.set_col_u32("i", new Uint32Array(bondsData.i), undefined);
                bondsBlock.set_col_u32("j", new Uint32Array(bondsData.j), undefined);
                if (bondsData.order) {
                    bondsBlock.set_col_u8("order", new Uint8Array(bondsData.order), undefined);
                }
                this.frame.insert_block("bonds", bondsBlock);
            }

            if (this.frameData.box !== undefined) {
                // Note: Frame doesn't have a box property in WASM, store in metadata
                this.frame.set_meta("box", JSON.stringify(this.frameData.box));
            }
            if (this.frameData.metadata) {
                Object.entries(this.frameData.metadata).forEach(([key, value]) => {
                    this.frame!.set_meta(key, String(value));
                });
            }
        }

        if (!this.frame) {
            throw new Error("draw_frame requires a frame");
        }

        const scene = this.app.world.scene;
        const drawOptions = this.options ?? {};

        // Clear existing atom/bond meshes
        const meshesToDispose: BABYLON.AbstractMesh[] = [];
        scene.meshes.forEach((mesh) => {
            // Check if mesh is registered (atom, bond, or box meshes have names)
            if (mesh.name === "atom_base" || mesh.name === "bond_base" || mesh.name.startsWith("box_")) {
                meshesToDispose.push(mesh);
            }
        });

        meshesToDispose.forEach((m) => {
            this.app.world.sceneIndex.unregister(m.uniqueId);
            m.dispose();
        });

        // Render Atoms (Thin Instances)
        const atomsBlock = this.frame.get_block("atoms");
        let atomMesh: BABYLON.Mesh | undefined;
        if (atomsBlock && atomsBlock.len() > 0) {
            atomMesh = this.createAtomMesh(scene, drawOptions, atomsBlock);
            this.createdMeshes.push(atomMesh);
        }

        // Render Bonds (Thin Instances)
        const bondsBlock = this.frame.get_block("bonds");
        let bondMesh: BABYLON.Mesh | undefined;
        if (bondsBlock && bondsBlock.len() > 0) {
            bondMesh = this.createBondMesh(scene, drawOptions, atomsBlock!, bondsBlock);
            this.createdMeshes.push(bondMesh);
        }

        // Register frame with SceneIndex (single call for all thin instances)
        if (atomMesh && atomsBlock) {
            this.app.world.sceneIndex.registerFrame({
                atomMesh: { uniqueId: atomMesh.uniqueId },
                bondMesh: bondMesh ? { uniqueId: bondMesh.uniqueId } : undefined,
                atomBlock: atomsBlock,
                bondBlock: bondsBlock || undefined
            });
        }

        // Draw Box if present or compute AABB fallback
        if (atomsBlock) {
            const boxData = this.getBoxData(this.frame, atomsBlock);
            if (boxData) {
                const boxCmd = new DrawBoxCommand(this.app, { box: boxData });
                boxCmd.do();
            }
        }
    }

    private createAtomMesh(scene: BABYLON.Scene, drawOptions: DrawFrameOption, atomsBlock: Block): BABYLON.Mesh {
        const atomCount = atomsBlock.nrows();
        const xCoords = atomsBlock.col_f32("x")!;
        const yCoords = atomsBlock.col_f32("y")!;
        const zCoords = atomsBlock.col_f32("z")!;
        const elements = atomsBlock.col_strings("element")! as string[];

        // Create material
        let atomMaterial = scene.getMaterialByName("atomMat") as BABYLON.StandardMaterial;
        if (!atomMaterial) {
            atomMaterial = new BABYLON.StandardMaterial("atomMat", scene);
            atomMaterial.diffuseColor = new BABYLON.Color3(1.0, 1.0, 1.0); // White base for instance colors
            atomMaterial.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        }

        // Create base mesh
        const sphereBase = BABYLON.MeshBuilder.CreateSphere(
            "atom_base",
            { diameter: 1.0, segments: 16 },
            scene
        );
        sphereBase.material = atomMaterial;
        sphereBase.isPickable = true;

        // Create transformation matrices
        const buffer = new Float32Array(atomCount * 16);

        for (let i = 0; i < atomCount; i++) {
            const x = xCoords[i];
            const y = yCoords[i];
            const z = zCoords[i];
            const element = elements[i];

            // Use Palette to get radius for this element
            const radius = drawOptions.atoms?.radii?.[i] ?? this.app.palette.getAtomRadius(element);
            const scale = radius * 2;

            const offset = i * 16;

            // Identity matrix with scaling
            buffer[offset + 0] = scale;
            buffer[offset + 5] = scale;
            buffer[offset + 10] = scale;
            buffer[offset + 15] = 1;

            // Translation
            buffer[offset + 12] = x;
            buffer[offset + 13] = y;
            buffer[offset + 14] = z;
        }

        // Create color buffer for per-instance coloring
        const colorBuffer = new Float32Array(atomCount * 4);
        for (let i = 0; i < atomCount; i++) {
            const element = elements[i];
            const offset = i * 4;

            // Use Palette to get color for this element
            const colorHex = this.app.palette.getAtomColor(element);
            const color = BABYLON.Color3.FromHexString(colorHex);

            colorBuffer[offset] = color.r;
            colorBuffer[offset + 1] = color.g;
            colorBuffer[offset + 2] = color.b;
            colorBuffer[offset + 3] = 1.0; // Alpha
        }

        sphereBase.thinInstanceSetBuffer("matrix", buffer, 16, true);
        sphereBase.thinInstanceSetBuffer("color", colorBuffer, 4, true);
        sphereBase.thinInstanceEnablePicking = true;  // CRITICAL: Enable picking of individual thin instances
        sphereBase.thinInstanceRefreshBoundingInfo(true);

        // Enable thin instance picking
        sphereBase.alwaysSelectAsActiveMesh = true;  // Always consider for picking

        // Note: Registration happens in do() via registerFrame()
        return sphereBase;
    }

    private createBondMesh(scene: BABYLON.Scene, drawOptions: DrawFrameOption, atomsBlock: Block, bondsBlock: Block): BABYLON.Mesh {
        const bondCount = bondsBlock.nrows();
        const bondRadius = drawOptions.bonds?.radii ?? 0.1;

        // Create material
        let bondMaterial = scene.getMaterialByName("bondMat") as BABYLON.StandardMaterial;
        if (!bondMaterial) {
            bondMaterial = new BABYLON.StandardMaterial("bondMat", scene);
            bondMaterial.diffuseColor = new BABYLON.Color3(1.0, 1.0, 1.0); // White base for instance colors
        }

        // Create base mesh
        const cylinderBase = BABYLON.MeshBuilder.CreateCylinder(
            "bond_base",
            { height: 1.0, diameter: 1.0 },
            scene
        );
        cylinderBase.material = bondMaterial;

        // Create transformation matrices
        const buffer = new Float32Array(bondCount * 16);

        const xCoords = atomsBlock.col_f32("x")!;
        const yCoords = atomsBlock.col_f32("y")!;
        const zCoords = atomsBlock.col_f32("z")!;
        const i_atoms = bondsBlock.col_u32("i")!;
        const j_atoms = bondsBlock.col_u32("j")!;

        const tempMatrix = BABYLON.Matrix.Identity();
        const up = new BABYLON.Vector3(0, 1, 0);

        for (let b = 0; b < bondCount; b++) {
            const i = i_atoms[b];
            const j = j_atoms[b];

            const p1 = new BABYLON.Vector3(xCoords[i], yCoords[i], zCoords[i]);
            const p2 = new BABYLON.Vector3(xCoords[j], yCoords[j], zCoords[j]);

            const distance = BABYLON.Vector3.Distance(p1, p2);
            const center = p1.add(p2).scale(0.5);
            const direction = p2.subtract(p1).normalize();

            // Calculate rotation
            const axis = BABYLON.Vector3.Cross(up, direction);
            const angle = Math.acos(BABYLON.Vector3.Dot(up, direction));

            let rotation = BABYLON.Quaternion.Identity();

            if (Math.abs(angle) < 0.0001) {
                // Parallel, no rotation
            } else if (Math.abs(angle - Math.PI) < 0.0001) {
                // Anti-parallel, flip
                rotation = BABYLON.Quaternion.FromEulerAngles(Math.PI, 0, 0);
            } else {
                rotation = BABYLON.Quaternion.RotationAxis(axis, angle);
            }

            // Compose matrix
            BABYLON.Matrix.ComposeToRef(
                new BABYLON.Vector3(bondRadius * 2, distance, bondRadius * 2),
                rotation,
                center,
                tempMatrix
            );

            tempMatrix.copyToArray(buffer, b * 16);
        }

        // Create color buffer for bonds
        const colorBuffer = new Float32Array(bondCount * 4);
        for (let b = 0; b < bondCount; b++) {
            const offset = b * 4;
            // Default gray color for bonds
            colorBuffer[offset] = 0.6;
            colorBuffer[offset + 1] = 0.6;
            colorBuffer[offset + 2] = 0.6;
            colorBuffer[offset + 3] = 1.0;
        }

        cylinderBase.thinInstanceSetBuffer("matrix", buffer, 16, true);
        cylinderBase.thinInstanceSetBuffer("color", colorBuffer, 4, true);
        cylinderBase.thinInstanceEnablePicking = true;  // CRITICAL: Enable picking of individual thin instances
        cylinderBase.thinInstanceRefreshBoundingInfo(true);

        // Enable thin instance picking
        cylinderBase.alwaysSelectAsActiveMesh = true;  // Always consider for picking

        // Note: Registration happens in do() via registerFrame()
        return cylinderBase;
    }

    undo(): Command {
        this.createdMeshes.forEach((mesh) => mesh.dispose());
        this.createdMeshes = [];
        return new NoOpCommand(this.app);
    }

    private getBoxData(
        frame: Frame,
        atomsBlock: Block
    ): { origin: [number, number, number]; lengths: [number, number, number] } | null {
        const boxMeta = frame.get_meta("box");
        const originMeta = frame.get_meta("box_origin");

        if (boxMeta) {
            const parsed = this.parseBoxMeta(boxMeta, originMeta);
            if (parsed) {
                return parsed;
            }
        }

        return this.computeAabbBox(atomsBlock);
    }

    private parseBoxMeta(
        boxMeta: string,
        originMeta?: string | null
    ): { origin: [number, number, number]; lengths: [number, number, number] } | null {
        let origin: [number, number, number] = [0, 0, 0];
        if (originMeta) {
            const originNums = this.parseNumberList(originMeta);
            if (originNums.length >= 3) {
                origin = [originNums[0], originNums[1], originNums[2]];
            }
        }

        try {
            const parsed = JSON.parse(boxMeta) as unknown;
            if (Array.isArray(parsed)) {
                const lengths = this.lengthsFromArray(parsed);
                if (lengths) {
                    return { origin, lengths };
                }
            } else if (parsed && typeof parsed === "object") {
                const lengthsValue = (parsed as { lengths?: number[] }).lengths;
                const originValue = (parsed as { origin?: number[] }).origin;
                const lengths = lengthsValue ? this.lengthsFromArray(lengthsValue) : null;
                if (originValue && originValue.length >= 3) {
                    origin = [originValue[0], originValue[1], originValue[2]];
                }
                if (lengths) {
                    return { origin, lengths };
                }
            }
        } catch {
            const nums = this.parseNumberList(boxMeta);
            const lengths = this.lengthsFromArray(nums);
            if (lengths) {
                return { origin, lengths };
            }
        }

        return null;
    }

    private lengthsFromArray(values: number[]): [number, number, number] | null {
        if (values.length >= 3 && values.length !== 9) {
            return [values[0], values[1], values[2]];
        }
        if (values.length >= 9) {
            return [values[0], values[4], values[8]];
        }
        return null;
    }

    private parseNumberList(value: string): number[] {
        return value
            .trim()
            .split(/\s+/)
            .map((token) => Number(token))
            .filter((num) => Number.isFinite(num));
    }

    private computeAabbBox(
        atomsBlock: Block
    ): { origin: [number, number, number]; lengths: [number, number, number] } | null {
        if (atomsBlock.nrows() === 0) {
            return null;
        }

        const xCoords = atomsBlock.col_f32("x");
        const yCoords = atomsBlock.col_f32("y");
        const zCoords = atomsBlock.col_f32("z");
        if (!xCoords || !yCoords || !zCoords) {
            return null;
        }

        let minX = xCoords[0];
        let maxX = xCoords[0];
        let minY = yCoords[0];
        let maxY = yCoords[0];
        let minZ = zCoords[0];
        let maxZ = zCoords[0];

        for (let i = 1; i < atomsBlock.nrows(); i++) {
            const x = xCoords[i];
            const y = yCoords[i];
            const z = zCoords[i];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
        }

        return {
            origin: [minX, minY, minZ],
            lengths: [maxX - minX, maxY - minY, maxZ - minZ]
        };
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
 * Options for drawing an atom
 */
export interface DrawAtomOptions {
    element: string;
    name?: string;
    radius?: number;
    color?: ColorHex;
}

/**
 * Options for drawing a bond
 */
export interface DrawBondOptions {
    order?: number;
    radius?: number;
    color?: ColorHex;
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
        private palette: Palette,
        private scene: Scene,
        private materialCache: Map<string, StandardMaterial>
    ) {
        super(app);
    }

    do(): Mesh {
        const { element, name, radius, color } = this.options;

        const atomColor = color || this.palette.getAtomColor(element);
        const atomRadius = radius || this.palette.getAtomRadius(element);

        this.mesh = MeshBuilder.CreateSphere(
            name || `atom_${element}_${Date.now()}`,
            { diameter: atomRadius * 2, segments: 16 },
            this.scene
        );

        this.mesh.position = this.position.clone();

        const material = this.getOrCreateMaterial(element, atomColor);
        this.mesh.material = material;

        // Register with SceneIndex using new chemistry-semantic API
        this.app.world.sceneIndex.registerAtom({
            mesh: { uniqueId: this.mesh.uniqueId },
            meta: {
                atomId: this.mesh.uniqueId,
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
        return new NoOpCommand(this.app);
    }

    private getOrCreateMaterial(key: string, color: ColorHex): StandardMaterial {
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key)!;
        }

        const mat = new StandardMaterial(`${key}_mat`, this.scene);
        mat.diffuseColor = Color3.FromHexString(color);
        mat.specularColor = new Color3(0.3, 0.3, 0.3);

        this.materialCache.set(key, mat);
        return mat;
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
        private palette: Palette,
        private scene: Scene,
        private materialCache: Map<string, StandardMaterial>
    ) {
        super(app);
    }

    do(): Mesh {
        const { order = 1, radius, color } = this.options;

        console.log('[DrawBondCommand] Drawing bond with order:', order);

        const bondColor = color || this.palette.getDefaultBondColor();
        const bondRadius = radius || this.palette.getDefaultBondRadius();

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
        const material = this.getOrCreateMaterial("bond", bondColor);

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
            mesh: { uniqueId: this.mesh.uniqueId },
            meta: {
                bondId: this.mesh.uniqueId,
                atomId1: 0,  // Will be properly set when linking to atoms
                atomId2: 0,
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

    private getOrCreateMaterial(key: string, color: ColorHex): StandardMaterial {
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key)!;
        }

        const mat = new StandardMaterial(`${key}_mat`, this.scene);
        mat.diffuseColor = Color3.FromHexString(color);
        mat.specularColor = new Color3(0.3, 0.3, 0.3);

        this.materialCache.set(key, mat);
        return mat;
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
    }

    undo(): Command {
        return new NoOpCommand(this.app);
    }
}
