import * as BABYLON from "@babylonjs/core"; // Used for mesh types
import { Vector3 } from "@babylonjs/core";
import { Command, command } from "./base";
import { Frame } from "molrs-wasm";
import { MolvisApp } from "../core/app";
import "../shaders/impostor"; // Register shaders
// Note: ImpostorPool removed.

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
    private frame: Frame;
    private options?: DrawFrameOption;
    private boxMesh: BABYLON.Mesh | null = null;

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
        const renderer = this.app.world.renderer;
        // const sceneIndex = this.app.world.sceneIndex; // Unused
        const scene = this.app.world.scene;

        // 1. Clear Renderer & Registry
        renderer.clear();
        // sceneIndex.clear() is called by renderer.clear()

        const atomsBlock = this.frame.getBlock("atoms");
        const bondsBlock = this.frame.getBlock("bonds");

        if (!atomsBlock || atomsBlock.nrows() === 0) {
            return;
        }

        // 2. Load Frame Data into SceneIndex (Delegated by Renderer)
        renderer.loadFrame(
            atomsBlock as any,
            bondsBlock as any,
            this.options
        );

        // 3. Draw Box
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

    undo(): Command {
        // Clearing logic matching existing patterns
        this.app.world.renderer.clear();
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
 * Command to draw an atom in Edit mode.
 */
export class DrawAtomCommand extends Command<{ atomId: number }> {
    private atomId: number;
    private executed = false;
    private meshId: number = 0; // Store mesh ID for undo

    constructor(
        app: MolvisApp,
        private position: Vector3,
        private options: DrawAtomOptions
        // Pool removal: no ImpostorPool arg
    ) {
        super(app);
        this.atomId = options.atomId ?? app.world.sceneIndex.getNextAtomId();
    }

    do(): { atomId: number } {
        const { element } = this.options;
        const style = this.app.styleManager.getAtomStyle(element);
        const radius = this.options.radius || style.radius * 0.6;
        const scale = radius * 2;

        // Compute colors
        const c = BABYLON.Color3.FromHexString(style.color).toLinearSpace();

        // Build buffer values
        const values = new Map<string, Float32Array>();

        // Matrix (Scale + Translation)
        const matrix = new Float32Array(16);
        matrix[0] = scale; matrix[5] = scale; matrix[10] = scale; matrix[15] = 1;
        matrix[12] = this.position.x; matrix[13] = this.position.y; matrix[14] = this.position.z;
        values.set("matrix", matrix);

        // instanceData (x, y, z, radius)
        values.set("instanceData", new Float32Array([
            this.position.x, this.position.y, this.position.z, radius
        ]));

        // instanceColor (r, g, b, a)
        values.set("instanceColor", new Float32Array([c.r, c.g, c.b, style.alpha ?? 1.0]));

        // instancePickingColor will be set by the pool itself
        values.set("instancePickingColor", new Float32Array(4)); // placeholder

        // Create Atom in SceneIndex
        this.app.world.sceneIndex.createAtom(
            {
                atomId: this.atomId,
                element,
                position: { x: this.position.x, y: this.position.y, z: this.position.z }
            },
            values
        );

        // Capture meshID for undo from MeshRegistry?
        // SceneIndex.createAtom uses meshRegistry.getAtomState().mesh
        // We can retrieve it.
        const atomState = this.app.world.sceneIndex.meshRegistry.getAtomState();
        if (atomState) this.meshId = atomState.mesh.uniqueId;

        this.executed = true;
        return { atomId: this.atomId };
    }

    undo(): Command {
        if (!this.executed) {
            throw new Error("Cannot undo DrawAtomCommand: not executed");
        }
        if (this.meshId) {
            this.app.world.sceneIndex.unregisterEditAtom(this.meshId, this.atomId);
        }
        this.executed = false;
        return new NoOpCommand(this.app);
    }
}

/**
 * Command to delete an edit-mode atom and connected bonds.
 */
export class DeleteAtomCommand extends Command<void> {
    private savedAtomData: Map<string, Float32Array> | null = null;
    private deletedBonds: Array<{
        bondId: number;
        data: Map<string, Float32Array>;
    }> = [];

    constructor(
        app: MolvisApp,
        private atomId: number
        // No pools
    ) {
        super(app);
    }

    do(): void {
        const atomState = this.app.world.sceneIndex.meshRegistry.getAtomState();
        if (!atomState) return;
        const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();

        // Save atom data for undo
        this.savedAtomData = new Map();
        for (const bufName of ["matrix", "instanceData", "instanceColor", "instancePickingColor"]) {
            const data = atomState.read(this.atomId, bufName);
            if (data) this.savedAtomData.set(bufName, new Float32Array(data)); // Copy
        }

        // Find and remove connected bonds via topology
        const connectedBonds = this.app.world.sceneIndex.topology.getBondsForAtom(this.atomId);
        this.deletedBonds = [];

        for (const bondId of connectedBonds) {
            // Retrieve bond data if bondState exists
            if (bondState) {
                const bondData = new Map<string, Float32Array>();
                for (const bufName of ["matrix", "instanceData0", "instanceData1", "instanceColor0", "instanceColor1", "instanceSplit", "instancePickingColor"]) {
                    const data = bondState.read(bondId, bufName);
                    if (data) bondData.set(bufName, new Float32Array(data)); // Copy
                }
                this.deletedBonds.push({ bondId, data: bondData });
                this.app.world.sceneIndex.unregisterEditBond(bondState.mesh.uniqueId, bondId);
            }
        }

        // Remove atom
        this.app.world.sceneIndex.unregisterEditAtom(atomState.mesh.uniqueId, this.atomId);
    }

    undo(): Command {
        // Restore atoms and bonds
        // Not fully implemented for re-insertion, but we have data.
        // For now NoOp as per previous implementation (it returned NoOpCommand).
        // If strict undo is required, we'd need CreateAtom/CreateBond calls here.
        return new NoOpCommand(this.app);
    }
}

/**
 * Command to draw a bond in Edit mode.
 */
export class DrawBondCommand extends Command<{ bondId: number }> {
    private bondId: number;
    private executed = false;
    private meshId: number = 0;

    constructor(
        app: MolvisApp,
        private startPos: Vector3,
        private endPos: Vector3,
        private options: DrawBondOptions
    ) {
        super(app);
        this.bondId = options.bondId ?? app.world.sceneIndex.getNextBondId();
    }

    do(): { bondId: number } {
        const { order = 1 } = this.options;
        const bondRadius = this.options.radius || this.app.styleManager.getBondStyle(order).radius;

        // Compute center, direction, distance
        const center = this.startPos.add(this.endPos).scaleInPlace(0.5);
        const dir = this.endPos.subtract(this.startPos);
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

        // Colors - use element colors for bicolor bonds
        const atomId1 = this.options.atomId1 ?? 0;
        const atomId2 = this.options.atomId2 ?? 0;

        // Try to get element colors from sceneIndex metadata
        let c0 = this.getAtomColor(atomId1);
        let c1 = this.getAtomColor(atomId2);

        // Split offset
        const r0 = this.getAtomRadius(atomId1);
        const r1 = this.getAtomRadius(atomId2);
        const splitOffset = (r0 - r1) * 0.4;

        const values = new Map<string, Float32Array>();
        values.set("matrix", matrix);
        values.set("instanceData0", data0);
        values.set("instanceData1", data1);
        values.set("instanceColor0", c0);
        values.set("instanceColor1", c1);
        values.set("instanceSplit", new Float32Array([splitOffset, 0, 0, 0]));
        values.set("instancePickingColor", new Float32Array(4)); // placeholder

        // Create Bond
        this.app.world.sceneIndex.createBond(
            {
                bondId: this.bondId,
                atomId1,
                atomId2,
                order,
                start: { x: this.startPos.x, y: this.startPos.y, z: this.startPos.z },
                end: { x: this.endPos.x, y: this.endPos.y, z: this.endPos.z }
            },
            values
        );

        const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();
        if (bondState) this.meshId = bondState.mesh.uniqueId;

        this.executed = true;
        return { bondId: this.bondId };
    }

    undo(): Command {
        if (!this.executed) {
            throw new Error("Cannot undo DrawBondCommand: not executed");
        }
        if (this.meshId) {
            this.app.world.sceneIndex.unregisterEditBond(this.meshId, this.bondId);
        }
        this.executed = false;
        return new NoOpCommand(this.app);
    }

    private getAtomColor(atomId: number): Float32Array {
        const meta = this.app.world.sceneIndex.metaRegistry.atoms.getMeta(atomId);
        if (meta) {
            const s = this.app.styleManager.getAtomStyle(meta.element);
            const c = BABYLON.Color3.FromHexString(s.color).toLinearSpace();
            return new Float32Array([c.r, c.g, c.b, s.alpha ?? 1.0]);
        }
        // Fallback to carbon
        const s = this.app.styleManager.getAtomStyle('C');
        const c = BABYLON.Color3.FromHexString(s.color).toLinearSpace();
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

/**
 * Command to delete an edit-mode bond via ImpostorPool.
 */
export class DeleteBondCommand extends Command<void> {
    constructor(
        app: MolvisApp,
        private bondId: number
    ) {
        super(app);
    }

    do(): void {
        const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();
        if (!bondState) return;
        this.app.world.sceneIndex.unregisterEditBond(bondState.mesh.uniqueId, this.bondId);
    }

    undo(): Command {
        return new NoOpCommand(this.app);
    }
}
