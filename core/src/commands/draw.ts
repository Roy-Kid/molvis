import * as BABYLON from "@babylonjs/core";
import { Vector3, MeshBuilder, StandardMaterial, Color3, Mesh, type Scene } from "@babylonjs/core";
import type { MolvisApp } from "../core/app";
import { Command, command } from "./base";
import type { Frame } from "../core/system/frame";
import type { DrawFrameOption } from "./types";
import type { AtomBlock, BondBlock } from "../core/system/frame";
import type { Palette, ColorHex } from "./palette";
import type { AtomMetadata, BondMetadata, MolvisMeshMetadata } from "../types/metadata";

/**
 * Metadata structure for meshes in MolVis.
 * Colocated with mesh creation code for better discoverability.
 * All fields are optional and present based on meshType.
 */
export interface MeshMetadata {
    meshType: "atom" | "bond" | "box" | "frame";

    // Common fields
    matrices?: Float32Array;

    // Atom-specific fields
    atomBlock?: AtomBlock;
    atomCount?: number;
    atomId?: number;
    element?: string;
    names?: string[];
    name?: string;
    colorBuffer?: Float32Array;  // Per-instance colors for highlighting

    // Bond-specific fields
    bondBlock?: BondBlock;
    bondId?: number;
    order?: number;
    i?: Uint32Array;  // atom indices for thin instances
    j?: Uint32Array;  // atom indices for thin instances
    atomId1?: number;
    atomId2?: number;

    // For manually created bonds
    x1?: number;
    y1?: number;
    z1?: number;
    x2?: number;
    y2?: number;
    z2?: number;
}

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
            existingBox.dispose();
        }

        // Parse box dimensions
        let lx = 10, ly = 10, lz = 10;
        if (Array.isArray(this.box)) {
            if (this.box.length === 3) {
                [lx, ly, lz] = this.box;
            } else if (this.box.length === 9) {
                lx = this.box[0];
                ly = this.box[4];
                lz = this.box[8];
            }
        }

        // Create box mesh
        this.boxMesh = BABYLON.MeshBuilder.CreateBox(
            "sim_box",
            { width: lx, height: ly, depth: lz },
            scene
        );

        this.boxMesh.position = new BABYLON.Vector3(lx / 2, ly / 2, lz / 2);

        // Create wireframe material
        const wireframeMaterial = new BABYLON.StandardMaterial("boxMat", scene);
        wireframeMaterial.wireframe = true;
        wireframeMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        this.boxMesh.material = wireframeMaterial;
        this.boxMesh.isVisible = true;

        this.boxMesh.metadata = { meshType: "box" } as MeshMetadata;
        this.boxMesh.isPickable = false;
    }

    undo(): Command {
        if (this.boxMesh) {
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
        args: { frame: Frame; options?: DrawFrameOption }
    ) {
        super(app);
        this.frame = args.frame;
        this.options = args.options;
    }

    do(): void {
        if (!this.frame) {
            throw new Error("draw_frame requires a frame");
        }

        const scene = this.app.world.scene;
        const drawOptions = this.options ?? {};

        // Clear existing atom/bond meshes
        const meshesToDispose: BABYLON.AbstractMesh[] = [];
        scene.meshes.forEach((mesh) => {
            const metadata = mesh.metadata as MeshMetadata;
            if (metadata?.meshType === "atom" || metadata?.meshType === "bond" || metadata?.meshType === "box") {
                meshesToDispose.push(mesh);
            }
            if (mesh.name === "atom_base" || mesh.name === "bond_base") {
                meshesToDispose.push(mesh);
            }
        });

        meshesToDispose.forEach((m) => m.dispose());

        // Render Atoms (Thin Instances)
        const atomCount = this.frame.getAtomCount();
        if (atomCount > 0) {
            const atomMesh = this.createAtomMesh(scene, drawOptions);
            this.createdMeshes.push(atomMesh);
        }

        // Render Bonds (Thin Instances)
        if (this.frame.bondBlock && this.frame.bondBlock.n_bonds > 0) {
            const bondMesh = this.createBondMesh(scene, drawOptions);
            this.createdMeshes.push(bondMesh);
        }

        // Draw Box if present
        if (this.frame.box) {
            const boxCmd = new DrawBoxCommand(this.app, { box: this.frame.box });
            boxCmd.do();
        }
    }

    private createAtomMesh(scene: BABYLON.Scene, drawOptions: DrawFrameOption): BABYLON.Mesh {
        const atomCount = this.frame.getAtomCount();
        const xCoords = this.frame.atomBlock.x;
        const yCoords = this.frame.atomBlock.y;
        const zCoords = this.frame.atomBlock.z;
        const elements = this.frame.atomBlock.element;

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

        sphereBase.metadata = {
            meshType: "atom",
            matrices: buffer,
            colorBuffer: colorBuffer,
            atomCount,
            atomBlock: this.frame.atomBlock
        } as MeshMetadata;

        // Register with SceneIndex
        this.app.world.sceneIndex.registerThinInstances(sphereBase, 'atom');

        return sphereBase;
    }

    private createBondMesh(scene: BABYLON.Scene, drawOptions: DrawFrameOption): BABYLON.Mesh {
        const bondCount = this.frame.bondBlock.n_bonds;
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

        const xCoords = this.frame.atomBlock.x;
        const yCoords = this.frame.atomBlock.y;
        const zCoords = this.frame.atomBlock.z;
        const i_atoms = this.frame.bondBlock.i;
        const j_atoms = this.frame.bondBlock.j;

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

        cylinderBase.metadata = {
            meshType: "bond",
            matrices: buffer,
            colorBuffer: colorBuffer,
            i: i_atoms,
            j: j_atoms,
            bondBlock: this.frame.bondBlock,
            atomBlock: this.frame.atomBlock
        } as MeshMetadata;

        return cylinderBase;
    }

    undo(): Command {
        this.createdMeshes.forEach((mesh) => mesh.dispose());
        this.createdMeshes = [];
        return new NoOpCommand(this.app);
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

        const metadata: AtomMetadata = {
            meshType: "atom",
            atomId: 0,
            element,
            name,
        };
        this.mesh.metadata = metadata;

        // Register with SceneIndex
        this.app.world.sceneIndex.registerMesh(this.mesh, 'atom');

        return this.mesh;
    }

    undo(): Command {
        if (!this.mesh) {
            throw new Error("Cannot undo DrawAtomCommand: mesh not created");
        }
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
            const metadata = m.metadata as MolvisMeshMetadata;
            if (metadata?.meshType === "bond") {
                const bondMeta = metadata as BondMetadata;
                if (bondMeta.x1 !== undefined) {
                    const start = new Vector3(bondMeta.x1, bondMeta.y1!, bondMeta.z1!);
                    const end = new Vector3(bondMeta.x2!, bondMeta.y2!, bondMeta.z2!);
                    if (
                        Vector3.Distance(start, atomPos) < 0.01 ||
                        Vector3.Distance(end, atomPos) < 0.01
                    ) {
                        this.deletedBonds.push(m as Mesh);
                    }
                }
            }
        });

        // Dispose bonds and unregister from SceneIndex
        this.deletedBonds.forEach((b) => {
            this.app.world.sceneIndex.unregister(b);
            b.dispose();
        });

        // Unregister and dispose atom
        this.app.world.sceneIndex.unregister(this.mesh);
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

        const metadata: BondMetadata = {
            meshType: "bond",
            x1: this.start.x,
            y1: this.start.y,
            z1: this.start.z,
            x2: this.end.x,
            y2: this.end.y,
            z2: this.end.z,
            order,
        };
        this.mesh.metadata = metadata;

        // Register with SceneIndex
        this.app.world.sceneIndex.registerMesh(this.mesh, 'bond');

        return this.mesh;
    }

    undo(): Command {
        if (!this.mesh) {
            throw new Error("Cannot undo DrawBondCommand: mesh not created");
        }
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
        this.app.world.sceneIndex.unregister(this.mesh);
        this.mesh.dispose();
    }

    undo(): Command {
        return new NoOpCommand(this.app);
    }
}
