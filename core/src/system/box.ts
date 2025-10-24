import {
    Matrix,
    Vector3,
    MeshBuilder,
    type Scene,
    type LinesMesh,
    Color3,
} from "@babylonjs/core";

import { MrBox } from "molrs-wasm";

/**
 * Box class for molecular dynamics simulations
 * Supports both orthogonal and triclinic boxes
 */
export class Box {

    private box: MrBox;

    constructor(matrix: Vector3[], origin?: Vector3, pbc?: boolean[]) {
        const _origin = new Float32Array([origin?.x ?? 0, origin?.y ?? 0, origin?.z ?? 0]);
        const h = Box.hFromVectors(matrix);
        const _pbc = pbc
            ? new Uint8Array([pbc[0] ? 1 : 0, pbc[1] ? 1 : 0, pbc[2] ? 1 : 0])
            : new Uint8Array([1, 1, 1]);
        this.box = new MrBox(h, _origin, _pbc);
    }

    static box(length: Vector3) : Box {
        return new Box(
            [
                new Vector3(length.x, 0, 0),
                new Vector3(0, length.y, 0),
                new Vector3(0, 0, length.z),
            ]
        );
    }

    public getPBC(): boolean[] {
        const pbc = this.box.pbc();
        return [pbc[0] === 1, pbc[1] === 1, pbc[2] === 1];
    }

    // Return Babylon Matrix built from row-major 3x3 H
    public getMatrix(): Vector3[] {
        const m = this.box.matrix() as Float32Array | number[];
        return [
            new Vector3(m[0], m[3], m[6]),
            new Vector3(m[1], m[4], m[7]),
            new Vector3(m[2], m[5], m[8]),
        ];
    }

    public isOrtho(): boolean { return (this.box as any).is_ortho(); }

    /**
     * Calculate box angles from box vectors
     */
    public getAngles(): Vector3 {
    const a = (this.box as any).get_angles() as Float32Array | number[];
        return new Vector3(a[0], a[1], a[2]);
    }

    /**
     * Get the volume of the box
     */
    public getVolume(): number { return this.box.volume(); }

    /**
     * Get the dimensions (lengths) of the box
     */
    public getBounds(): Vector3 {
        const l = this.box.lengths();
        return new Vector3(l[0], l[1], l[2]);
    }

    /**
     * Get the angles of the box in degrees
     */
    // Wrap a single position into the primary image
    public wrapSingle(position: Vector3): Vector3 {
    const w = (this.box as any).wrap_single(new Float32Array([position.x, position.y, position.z])) as Float32Array | number[];
        return new Vector3(w[0], w[1], w[2]);
    }

    /**
     * Convert Cartesian coordinates to fractional coordinates
     */
    public toFrac(position: Vector3): Vector3 {
    const f = (this.box as any).cartesian_to_fractional_single(new Float32Array([position.x, position.y, position.z])) as Float32Array | number[];
        return new Vector3(f[0], f[1], f[2]);
    }

    /**
     * Convert fractional coordinates to Cartesian coordinates
     */
    public toCart(fractional: Vector3): Vector3 {
    const c = (this.box as any).fractional_to_cartesian_single(new Float32Array([fractional.x, fractional.y, fractional.z])) as Float32Array | number[];
        return new Vector3(c[0], c[1], c[2]);
    }

    /**
     * Calculate the distance between two box faces along a specific direction
     * 
     * @param direction - Direction index (0=x, 1=y, 2=z)
     * @returns Distance between faces
     */
    public distBetweenFaces(direction: number): number {
        if (direction < 0 || direction > 2) throw new Error("Direction must be 0, 1, or 2 (for x, y, z)");
    return (this.box as any).dist_between_faces(direction) as number;
    }

    /**
     * Calculate the center of the box
     */
    public getCenter(): Vector3 { return this.toCart(new Vector3(0.5, 0.5, 0.5)); }

    /**
     * Get the box vectors
     */
    public getLattice(i: number): Vector3 {
        const m = this.box.matrix() as Float32Array | number[]; // row-major
        return new Vector3(m[i], m[i + 3], m[i + 6]);
    }

    /**
     * Check if a position is inside the box
     */
    public isin(position: Vector3): boolean {
        const f = this.toFrac(position);
        return f.x >= 0 && f.x < 1 && f.y >= 0 && f.y < 1 && f.z >= 0 && f.z < 1;
    }
    
    /**
     * Get the corners of the box (8 vertices)
     * Useful for visualization
     */
    public get_corners(): Vector3[] {
        // Compute corners from H and origin: cart = origin + H * frac
        const m = this.box.matrix() as Float32Array | number[];
        const o = this.box.origin() as Float32Array | number[];
        const H = [
            [m[0], m[1], m[2]],
            [m[3], m[4], m[5]],
            [m[6], m[7], m[8]],
        ];
        const fracs = [
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
            [1, 1, 0],
            [0, 0, 1],
            [1, 0, 1],
            [0, 1, 1],
            [1, 1, 1],
        ];
        return fracs.map(([fx, fy, fz]) => {
            const x = o[0] + H[0][0] * fx + H[0][1] * fy + H[0][2] * fz;
            const y = o[1] + H[1][0] * fx + H[1][1] * fy + H[1][2] * fz;
            const z = o[2] + H[2][0] * fx + H[2][1] * fy + H[2][2] * fz;
            return new Vector3(x, y, z);
        });
    }

    private static hFromVectors(vectors: Vector3[]): Float32Array {
        // Row-major 3x3 from column vectors
        return new Float32Array([
            vectors[0].x, vectors[1].x, vectors[2].x,
            vectors[0].y, vectors[1].y, vectors[2].y,
            vectors[0].z, vectors[1].z, vectors[2].z,
        ]);
    }

    /**
     * Create a Babylon.js LinesMesh representation of the box for visualization
     *
     * @param scene - Scene where the mesh will be created
     * @param name - Mesh name
     * @param color - Line color
     */
    public toLinesMesh(
        scene: Scene,
        name = "simulationBox",
        color: Color3 = Color3.White(),
    ): LinesMesh {
        const c = this.get_corners();
        const lines = [
            [c[0], c[1], c[3], c[2], c[0]],
            [c[4], c[5], c[7], c[6], c[4]],
            [c[0], c[4]],
            [c[1], c[5]],
            [c[2], c[6]],
            [c[3], c[7]],
        ];
        const mesh = MeshBuilder.CreateLineSystem(name, { lines }, scene);
        mesh.color = color;
        return mesh;
    }
}
