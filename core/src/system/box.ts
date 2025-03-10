import { Matrix, Vector3 } from "@babylonjs/core";

/**
 * Box class for molecular dynamics simulations
 * Supports both orthogonal and triclinic boxes
 */
export class Box {
    // Box vectors stored as array of Vector3
    private _box_vectors: Vector3[];
    private _box_matrix: Matrix | null;
    private _inv_matrix: Matrix | null;
    private _is_orthogonal: boolean;
    private _box_lengths: Vector3;
    private _box_angles: Vector3;

    /**
     * Create a new simulation box
     * 
     * @param boxInput - Either a matrix, array of vectors, or dimensions for orthogonal box
     * @param angles - For orthogonal box, optional angles in degrees (alpha, beta, gamma)
     */
    constructor(boxInput: Matrix | Vector3[] | Vector3, angles?: Vector3) {
        // Initialize with default values
        this._box_vectors = [];
        this._box_matrix = null;
        this._inv_matrix = null;
        
        if (boxInput instanceof Matrix) {
            // Convert matrix to vectors
            this._box_vectors = this.extract_vectors_from_matrix(boxInput);
            this._box_matrix = boxInput.clone();
        } 
        else if (Array.isArray(boxInput) && boxInput.length === 3 && boxInput[0] instanceof Vector3) {
            // Copy vectors directly
            this._box_vectors = boxInput.map(v => v.clone());
            this._box_matrix = this.create_matrix_from_vectors(this._box_vectors);
        } 
        else if (boxInput instanceof Vector3) {
            // Orthogonal box from dimensions
            if (angles) {
                // Non-orthogonal box with specified angles
                this._box_vectors = this.create_vectors_from_lengths_angles(boxInput, angles);
                this._box_matrix = this.create_matrix_from_vectors(this._box_vectors);
            } else {
                // Simple orthogonal box
                this._box_vectors = [
                    new Vector3(boxInput.x, 0, 0),
                    new Vector3(0, boxInput.y, 0),
                    new Vector3(0, 0, boxInput.z)
                ];
                this._box_matrix = this.create_matrix_from_vectors(this._box_vectors);
            }
        } 
        else {
            throw new Error("Invalid box input - must be Matrix, array of 3 Vector3, or Vector3 dimensions");
        }
        
        // Calculate derived properties
        this._is_orthogonal = this.check_if_orthogonal();
        if (this._box_matrix) {
            this._inv_matrix = Matrix.Invert(this._box_matrix);
        }
        this._box_lengths = this.calculate_box_lengths();
        this._box_angles = this.calculate_box_angles();
    }

    /**
     * Extract box vectors from a 4x4 matrix
     */
    private extract_vectors_from_matrix(matrix: Matrix): Vector3[] {
        const result: Vector3[] = [];
        
        // Create temporary matrix to safely extract the vectors
        const m = matrix.clone().m;
        
        // Extract the three column vectors
        result.push(new Vector3(
            m[0],
            m[4],
            m[8]
        ));
        
        result.push(new Vector3(
            m[1],
            m[5],
            m[9]
        ));
        
        result.push(new Vector3(
            m[2],
            m[6],
            m[10]
        ));
        
        return result;
    }

    /**
     * Create a 4x4 matrix from box vectors
     */
    private create_matrix_from_vectors(vectors: Vector3[]): Matrix {
        const matrix = new Matrix();
        
        // Create a matrix with the vectors as columns
        Matrix.FromValuesToRef(
            vectors[0].x, vectors[1].x, vectors[2].x, 0,
            vectors[0].y, vectors[1].y, vectors[2].y, 0,
            vectors[0].z, vectors[1].z, vectors[2].z, 0,
            0, 0, 0, 1,
            matrix
        );
        
        return matrix;
    }

    /**
     * Create box vectors from lengths and angles
     */
    private create_vectors_from_lengths_angles(lengths: Vector3, angles: Vector3): Vector3[] {
        // Convert angles from degrees to radians
        const alpha = angles.x * Math.PI / 180;
        const beta = angles.y * Math.PI / 180;
        const gamma = angles.z * Math.PI / 180;

        // First vector along x-axis
        const v1 = new Vector3(lengths.x, 0, 0);

        // Second vector in xy-plane
        const v2 = new Vector3(
            lengths.y * Math.cos(gamma),
            lengths.y * Math.sin(gamma),
            0
        );

        // Third vector with components in all dimensions
        const v3_x = lengths.z * Math.cos(beta);
        const v3_y = lengths.z * (Math.cos(alpha) - Math.cos(beta) * Math.cos(gamma)) / Math.sin(gamma);
        const v3_z_squared = lengths.z * lengths.z - v3_x * v3_x - v3_y * v3_y;
        // Avoid numerical errors that might make v3_z_squared slightly negative
        const v3_z = Math.sqrt(Math.max(0, v3_z_squared));
        
        const v3 = new Vector3(v3_x, v3_y, v3_z);

        return [v1, v2, v3];
    }

    /**
     * Check if the box is orthogonal
     */
    private check_if_orthogonal(): boolean {
        const eps = 1e-10;
        
        // Check if all vectors are aligned with the coordinate axes
        return (
            Math.abs(this._box_vectors[0].y) < eps && Math.abs(this._box_vectors[0].z) < eps &&
            Math.abs(this._box_vectors[1].x) < eps && Math.abs(this._box_vectors[1].z) < eps &&
            Math.abs(this._box_vectors[2].x) < eps && Math.abs(this._box_vectors[2].y) < eps
        );
    }

    /**
     * Calculate box lengths from box vectors
     */
    private calculate_box_lengths(): Vector3 {
        return new Vector3(
            this._box_vectors[0].length(),
            this._box_vectors[1].length(),
            this._box_vectors[2].length()
        );
    }

    /**
     * Calculate box angles from box vectors
     */
    private calculate_box_angles(): Vector3 {
        // Create normalized vectors
        const v1_norm = Vector3.Normalize(this._box_vectors[0]);
        const v2_norm = Vector3.Normalize(this._box_vectors[1]);
        const v3_norm = Vector3.Normalize(this._box_vectors[2]);

        // Calculate angles in degrees
        const alpha = Math.acos(Vector3.Dot(v2_norm, v3_norm)) * 180 / Math.PI;
        const beta = Math.acos(Vector3.Dot(v1_norm, v3_norm)) * 180 / Math.PI;
        const gamma = Math.acos(Vector3.Dot(v1_norm, v2_norm)) * 180 / Math.PI;
        
        return new Vector3(alpha, beta, gamma);
    }

    /**
     * Get the volume of the box
     */
    public get_volume(): number {
        // Volume is the triple product: v1 · (v2 × v3)
        const crossProduct = Vector3.Cross(this._box_vectors[1], this._box_vectors[2]);
        return Math.abs(Vector3.Dot(this._box_vectors[0], crossProduct));
    }

    /**
     * Get the dimensions (lengths) of the box
     */
    public get_dimensions(): Vector3 {
        return this._box_lengths.clone();
    }

    /**
     * Get the angles of the box in degrees
     */
    public get_angles(): Vector3 {
        return this._box_angles.clone();
    }

    /**
     * Wrap a position into the box
     * 
     * @param position - Position to wrap
     * @returns Wrapped position
     */
    public wrap_position(position: Vector3): Vector3 {
        // Convert to fractional coordinates
        const fractional = this.cartesian_to_fractional(position);
        
        // Apply periodic boundary conditions
        fractional.x -= Math.floor(fractional.x);
        fractional.y -= Math.floor(fractional.y);
        fractional.z -= Math.floor(fractional.z);
        
        // Convert back to Cartesian
        return this.fractional_to_cartesian(fractional);
    }

    /**
     * Convert Cartesian coordinates to fractional coordinates
     */
    public cartesian_to_fractional(position: Vector3): Vector3 {
        if (this._is_orthogonal) {
            // Orthogonal case is simpler
            return new Vector3(
                position.x / this._box_lengths.x,
                position.y / this._box_lengths.y,
                position.z / this._box_lengths.z
            );
        }
        
        // For triclinic box, use the inverse matrix
        if (!this._inv_matrix) {
            this._inv_matrix = Matrix.Invert(this._box_matrix!);
        }
        return Vector3.TransformCoordinates(position, this._inv_matrix);
    }

    /**
     * Convert fractional coordinates to Cartesian coordinates
     */
    public fractional_to_cartesian(fractional: Vector3): Vector3 {
        if (this._is_orthogonal) {
            // Orthogonal case is simpler
            return new Vector3(
                fractional.x * this._box_lengths.x,
                fractional.y * this._box_lengths.y,
                fractional.z * this._box_lengths.z
            );
        }
        
        // For triclinic box, linear combination of basis vectors
        const result = new Vector3(0, 0, 0);
        result.addInPlace(this._box_vectors[0].scale(fractional.x));
        result.addInPlace(this._box_vectors[1].scale(fractional.y));
        result.addInPlace(this._box_vectors[2].scale(fractional.z));
        return result;
    }

    /**
     * Calculate the minimum image distance between two points
     * 
     * @param pos1 - First position
     * @param pos2 - Second position
     * @returns Minimum image vector from pos1 to pos2
     */
    public minimum_image_distance(pos1: Vector3, pos2: Vector3): Vector3 {
        // Convert to fractional coordinates
        const frac1 = this.cartesian_to_fractional(pos1);
        const frac2 = this.cartesian_to_fractional(pos2);
        
        // Calculate fractional displacement
        const fracDiff = frac2.subtract(frac1);
        
        // Apply minimum image convention
        fracDiff.x -= Math.round(fracDiff.x);
        fracDiff.y -= Math.round(fracDiff.y);
        fracDiff.z -= Math.round(fracDiff.z);
        
        // Convert back to Cartesian
        return this.fractional_to_cartesian(fracDiff);
    }

    /**
     * Calculate the distance between two points with periodic boundary conditions
     */
    public minimum_image_distance_scalar(pos1: Vector3, pos2: Vector3): number {
        return this.minimum_image_distance(pos1, pos2).length();
    }

    /**
     * Calculate the distance between two box faces along a specific direction
     * 
     * @param direction - Direction index (0=x, 1=y, 2=z)
     * @returns Distance between faces
     */
    public distance_between_faces(direction: number): number {
        if (direction < 0 || direction > 2) {
            throw new Error("Direction must be 0, 1, or 2 (for x, y, z)");
        }
        
        if (this._is_orthogonal) {
            // For orthogonal box, it's just the length in that dimension
            return this._box_lengths.asArray()[direction];
        }
        
        // For triclinic box, calculate the distance between planes
        // We need the reciprocal basis vector for this direction
        // The reciprocal vectors are the rows of the inverse matrix
        if (!this._inv_matrix) {
            this._inv_matrix = Matrix.Invert(this._box_matrix!);
        }
        
        // Extract the correct row from the inverse matrix
        const row = this._inv_matrix.getRow(direction)!;
        const recipVector = new Vector3(row.x, row.y, row.z);
        
        // Distance between planes is 1 / |reciprocal vector|
        return 1.0 / recipVector.length();
    }

    /**
     * Calculate the center of the box
     */
    public get_center(): Vector3 {
        // Center is at fractional coordinates (0.5, 0.5, 0.5)
        return this.fractional_to_cartesian(new Vector3(0.5, 0.5, 0.5));
    }

    /**
     * Get the box vectors
     */
    public get_box_vectors(): Vector3[] {
        return this._box_vectors.map(v => v.clone());
    }

    /**
     * Get the box matrix (recreated from vectors if needed)
     */
    public get_box_matrix(): Matrix {
        if (!this._box_matrix) {
            this._box_matrix = this.create_matrix_from_vectors(this._box_vectors);
        }
        return this._box_matrix.clone();
    }

    /**
     * Check if a position is inside the box
     */
    public is_position_inside(position: Vector3): boolean {
        const fractional = this.cartesian_to_fractional(position);
        return (
            fractional.x >= 0 && fractional.x < 1 &&
            fractional.y >= 0 && fractional.y < 1 &&
            fractional.z >= 0 && fractional.z < 1
        );
    }
    
    /**
     * Get the corners of the box (8 vertices)
     * Useful for visualization
     */
    public get_corners(): Vector3[] {
        const corners: Vector3[] = [];
        
        // All combinations of 0 and 1 for fractional coordinates
        for (let i = 0; i <= 1; i++) {
            for (let j = 0; j <= 1; j++) {
                for (let k = 0; k <= 1; k++) {
                    corners.push(this.fractional_to_cartesian(new Vector3(i, j, k)));
                }
            }
        }
        
        return corners;
    }

    /**
     * Expand the box by a factor in each dimension
     */
    public expand(factors: Vector3): Box {
        if (this._is_orthogonal) {
            // Simple scaling for orthogonal box
            const newLengths = new Vector3(
                this._box_lengths.x * factors.x,
                this._box_lengths.y * factors.y,
                this._box_lengths.z * factors.z
            );
            return new Box(newLengths);
        } else {
            // Scale each vector for triclinic box
            const newVectors = [
                this._box_vectors[0].scale(factors.x),
                this._box_vectors[1].scale(factors.y),
                this._box_vectors[2].scale(factors.z)
            ];
            
            return new Box(newVectors);
        }
    }
}
