/* tslint:disable */
/* eslint-disable */

/**
 * Column-oriented data store with typed arrays.
 *
 * Each column is identified by a string key and has a fixed data type
 * (`F`, `i32`, `u32`, `string`). All columns in a block must have
 * the same number of rows.
 *
 * # Supported column types
 *
 * | JS type | Rust type | dtype string | Setter | Getter (copy) | Getter (view) |
 * |---------|-----------|-------------|--------|---------------|---------------|
 * | `Float32Array` / `Float64Array` | `F` | `"f32"` / `"f64"` | `setColF` | `copyColF` | `viewColF` |
 * | `Int32Array` | `i32` | `"i32"` | `setColI32` | `copyColI32` | `viewColI32` |
 * | `Uint32Array` | `u32` | `"u32"` | `setColU32` | `copyColU32` | `viewColU32` |
 * | `string[]` | `String` | `"string"` | `setColStr` | `copyColStr` | -- |
 *
 * # Example (JavaScript)
 *
 * ```js
 * const block = new Block();
 * block.setColF("x", coordsX);
 * block.setColF("y", coordsY);
 * console.log(block.nrows()); // 3
 * console.log(block.keys());  // ["x", "y"]
 *
 * const x = block.copyColF("x"); // owned copy, safe to keep
 * ```
 */
export class Block {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Owned JS float typed-array copy of a column.
     *
     * Returns a new JS float typed array that is an independent copy of
     * the column data. Safe to store and use across allocations.
     *
     * # Arguments
     *
     * * `key` - Column name
     *
     * # Returns
     *
     * An owned JS float typed-array copy of the column.
     *
     * # Errors
     *
     * Throws if the column does not exist or is not of the active float type.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const x = block.copyColF("x");
     * console.log(x[0]); // 1.0
     * ```
     */
    copyColF(key: string): Float64Array;
    /**
     * Owned `Int32Array` copy of a column.
     *
     * # Arguments
     *
     * * `key` - Column name
     *
     * # Errors
     *
     * Throws if the column does not exist or is not of type `i32`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const types = block.copyColI32("type_id");
     * ```
     */
    copyColI32(key: string): Int32Array;
    /**
     * Owned `string[]` copy of a string column.
     *
     * # Arguments
     *
     * * `key` - Column name
     *
     * # Returns
     *
     * A JS `Array` of strings.
     *
     * # Errors
     *
     * Throws if the column does not exist or is not of type `string`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const symbols = block.copyColStr("symbol"); // ["C", "C", "O"]
     * ```
     */
    copyColStr(key: string): Array<any>;
    /**
     * Owned `Uint32Array` copy of a column.
     *
     * # Arguments
     *
     * * `key` - Column name
     *
     * # Errors
     *
     * Throws if the column does not exist or is not of type `u32`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const bondI = block.copyColU32("i");
     * const bondJ = block.copyColU32("j");
     * ```
     */
    copyColU32(key: string): Uint32Array;
    /**
     * Return the data type string for a column.
     *
     * Possible return values: `"f32"` or `"f64"` for float columns,
     * plus `"i32"`, `"u32"`, `"bool"`,
     * `"string"`, `"u8"`. Returns `undefined` if the column does
     * not exist.
     *
     * # Arguments
     *
     * * `key` - Column name
     *
     * # Returns
     *
     * The dtype string, or `undefined` if the column is not found.
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(block.dtype("x"));      // "f32" or "f64"
     * console.log(block.dtype("symbol")); // "string"
     * ```
     */
    dtype(key: string): string | undefined;
    /**
     * Check whether this block has zero columns.
     *
     * # Errors
     *
     * Throws if the block handle has been invalidated.
     *
     * # Example (JavaScript)
     *
     * ```js
     * if (block.isEmpty()) { // no columns yet }
     * ```
     */
    isEmpty(): boolean;
    /**
     * Return all column names as a JS `string[]`.
     *
     * # Errors
     *
     * Throws if the block handle has been invalidated.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const names = block.keys(); // ["x", "y", "z", "symbol"]
     * ```
     */
    keys(): Array<any>;
    /**
     * Return the number of columns in this block.
     *
     * # Errors
     *
     * Throws if the block handle has been invalidated.
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(block.len()); // e.g., 3
     * ```
     */
    len(): number;
    /**
     * Create a new, standalone empty `Block`.
     *
     * The block is backed by its own temporary store. Prefer
     * [`Frame.createBlock()`](crate::Frame::create_block) to create
     * blocks that are immediately attached to a frame.
     *
     * # Errors
     *
     * Throws a `JsValue` string if the internal store allocation fails.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const block = new Block();
     * block.setColF("values", values);
     * ```
     */
    constructor();
    /**
     * Return the number of rows (shared across all columns).
     *
     * Returns `0` if the block has no columns.
     *
     * # Errors
     *
     * Throws if the block handle has been invalidated.
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(block.nrows()); // e.g., 100
     * ```
     */
    nrows(): number;
    /**
     * Rename a column from `old_key` to `new_key`.
     *
     * # Arguments
     *
     * * `old_key` - Current column name
     * * `new_key` - New column name
     *
     * # Returns
     *
     * `true` if the column was found and renamed, `false` otherwise.
     *
     * # Errors
     *
     * Throws if the block handle has been invalidated.
     *
     * # Example (JavaScript)
     *
     * ```js
     * block.renameColumn("element", "symbol"); // true
     * ```
     */
    renameColumn(old_key: string, new_key: string): boolean;
    /**
     * Set a float column from a JS float typed array.
     *
     * # Arguments
     *
     * * `key` - Column name (e.g., `"x"`, `"mass"`, `"charge"`)
     * * `data` - JS float typed array with the column values
     * * `shape` - Optional shape array for multi-dimensional data
     *   (e.g., `[N, 3]` for an Nx3 matrix stored flat). If omitted,
     *   the data is stored as a 1D column.
     *
     * # Errors
     *
     * Throws if `shape` product does not match `data.length`, or if
     * the resulting row count is inconsistent with existing columns.
     *
     * # Example (JavaScript)
     *
     * ```js
     * block.setColF("x", xCoords);
     * // Multi-dimensional: 2 rows x 3 columns
     * block.setColF("pos", positions, [2, 3]);
     * ```
     */
    setColF(key: string, data: Float64Array, shape?: Uint32Array | null): void;
    /**
     * Set a signed integer column from an `Int32Array`.
     *
     * # Arguments
     *
     * * `key` - Column name
     * * `data` - `Int32Array` with the column values
     *
     * # Errors
     *
     * Throws if the row count is inconsistent with existing columns.
     *
     * # Example (JavaScript)
     *
     * ```js
     * block.setColI32("charge_sign", new Int32Array([1, -1, 0]));
     * ```
     */
    setColI32(key: string, data: Int32Array): void;
    /**
     * Set a string column from a JS `string[]`.
     *
     * # Arguments
     *
     * * `key` - Column name (e.g., `"symbol"`, `"name"`)
     * * `data` - JS `Array` where every element must be a string
     *
     * # Errors
     *
     * Throws if any element is not a string, or if the row count is
     * inconsistent with existing columns.
     *
     * # Example (JavaScript)
     *
     * ```js
     * atoms.setColStr("symbol", ["C", "C", "O"]);
     * ```
     */
    setColStr(key: string, data: Array<any>): void;
    /**
     * Set an unsigned integer column from a `Uint32Array`.
     *
     * # Arguments
     *
     * * `key` - Column name (e.g., `"i"`, `"j"` for bond indices)
     * * `data` - `Uint32Array` with the column values
     *
     * # Errors
     *
     * Throws if the row count is inconsistent with existing columns.
     *
     * # Example (JavaScript)
     *
     * ```js
     * // Bond topology: atom indices
     * bonds.setColU32("i", new Uint32Array([0, 1]));
     * bonds.setColU32("j", new Uint32Array([1, 2]));
     * ```
     */
    setColU32(key: string, data: Uint32Array): void;
    /**
     * Zero-copy JS float typed-array view into WASM linear memory.
     *
     * Returns a view backed directly by the block's storage in WASM
     * memory. This avoids copying but the view becomes **invalid**
     * if WASM linear memory grows (due to any allocation).
     *
     * Use [`copyColF`](Block::copy_col_f) for a safe, long-lived copy.
     *
     * # Arguments
     *
     * * `key` - Column name
     *
     * # Returns
     *
     * A JS float typed-array view into WASM memory.
     *
     * # Errors
     *
     * Throws if the column does not exist or is not of the active float type.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const view = block.viewColF("x"); // zero-copy, use immediately
     * const copy = block.copyColF("x"); // safe to keep
     * ```
     */
    viewColF(key: string): Float64Array;
    /**
     * Zero-copy `Int32Array` view into WASM linear memory.
     *
     * **Warning**: invalidated if WASM linear memory grows.
     * Use [`copyColI32`](Block::copy_col_i32) for a safe copy.
     *
     * # Arguments
     *
     * * `key` - Column name
     *
     * # Errors
     *
     * Throws if the column does not exist or is not of type `i32`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const view = block.viewColI32("type_id");
     * ```
     */
    viewColI32(key: string): Int32Array;
    /**
     * Zero-copy `Uint32Array` view into WASM linear memory.
     *
     * **Warning**: invalidated if WASM linear memory grows.
     * Use [`copyColU32`](Block::copy_col_u32) for a safe copy.
     *
     * # Arguments
     *
     * * `key` - Column name
     *
     * # Errors
     *
     * Throws if the column does not exist or is not of type `u32`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const view = block.viewColU32("i");
     * ```
     */
    viewColU32(key: string): Uint32Array;
}

/**
 * Simulation box defining periodic boundary conditions and coordinate
 * transformations.
 *
 * Represents a parallelepiped defined by a 3x3 matrix `h` and an
 * origin point. Supports periodic boundary conditions (PBC)
 * independently in x, y, z directions.
 *
 * Exported as `Box` in JavaScript.
 *
 * # Example (JavaScript)
 *
 * ```js
 * const h = floatArrayH;
 * const origin = floatArrayOrigin;
 * const box = new Box(h, origin, true, true, true);
 * console.log(box.volume()); // 1000.0
 * console.log(box.lengths().toCopy()); // [10, 10, 10]
 * ```
 */
export class Box {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Create a cubic box with equal side lengths.
     *
     * # Arguments
     *
     * * `a` - Side length of the cube in angstrom (A)
     * * `origin` - 3D origin vector as a float typed array with 3 elements
     *   `[x, y, z]` in angstrom
     * * `pbc_x` - Enable periodic boundary in x direction
     * * `pbc_y` - Enable periodic boundary in y direction
     * * `pbc_z` - Enable periodic boundary in z direction
     *
     * # Returns
     *
     * A new cubic `Box` with side length `a`.
     *
     * # Errors
     *
     * Throws if `origin` does not have 3 elements.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const origin = originVec;
     * const box = Box.cube(10.0, origin, true, true, true);
     * console.log(box.volume()); // 1000.0
     * ```
     */
    static cube(a: number, origin: Float64Array, pbc_x: boolean, pbc_y: boolean, pbc_z: boolean): Box;
    /**
     * Calculate displacement vectors between two sets of coordinates.
     *
     * Computes `delta = b - a` for each pair of points. When
     * `minimum_image` is `true`, the minimum-image convention is
     * applied so that the displacement uses the shortest vector
     * under periodic boundary conditions.
     *
     * # Arguments
     *
     * * `a` - `WasmArray` with shape `[N, 3]` (reference positions in A)
     * * `b` - `WasmArray` with shape `[N, 3]` (target positions in A)
     * * `minimum_image` - If `true`, apply minimum image convention
     *   for PBC-enabled axes
     *
     * # Returns
     *
     * `WasmArray` with shape `[N, 3]` containing displacement vectors
     * `(b - a)` in angstrom (A).
     *
     * # Errors
     *
     * Throws if `a` or `b` does not have shape `[N, 3]`, or if the
     * two arrays have different numbers of rows.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const a = WasmArray.from(aCoords, [1, 3]);
     * const b = WasmArray.from(bCoords, [1, 3]);
     * const d = box.delta(a, b, true); // minimum-image displacement
     * ```
     */
    delta(a: WasmArray, b: WasmArray, minimum_image: boolean): WasmArray;
    /**
     * Calculate displacement vectors and write the result directly into
     * a [`Block`] column.
     *
     * This is an allocation-efficient alternative to [`delta`](Box::delta).
     *
     * # Arguments
     *
     * * `a` - `WasmArray` with shape `[N, 3]` (reference positions in A)
     * * `b` - `WasmArray` with shape `[N, 3]` (target positions in A)
     * * `minimum_image` - If `true`, apply minimum image convention
     * * `out_block` - Target [`Block`] to write the result into
     * * `out_key` - Column name for the result (float, shape `[N, 3]`)
     *
     * # Errors
     *
     * Throws if shapes are invalid or if the block write fails.
     *
     * # Example (JavaScript)
     *
     * ```js
     * box.deltaToBlock(a, b, true, outBlock, "displacements");
     * ```
     */
    deltaToBlock(a: WasmArray, b: WasmArray, minimum_image: boolean, out_block: Block, out_key: string): void;
    /**
     * Return the 8 corner vertices of the parallelepiped.
     *
     * # Returns
     *
     * `WasmArray` with shape `[8, 3]` containing the corner
     * coordinates in angstrom (A). The flat array has 24 elements.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const corners = box.getCorners();
     * console.log(corners.len()); // 24 (8 corners x 3 coords)
     * ```
     */
    get_corners(): WasmArray;
    /**
     * Return the box edge lengths as a `WasmArray` with shape `[3]`.
     *
     * For orthorhombic boxes these are `[lx, ly, lz]`. For triclinic
     * boxes these are the lengths of the three cell vectors.
     *
     * # Returns
     *
     * `WasmArray` containing `[lx, ly, lz]` in angstrom (A).
     *
     * # Example (JavaScript)
     *
     * ```js
     * const L = box.lengths().toCopy(); // Float32Array or Float64Array [10, 10, 10]
     * ```
     */
    lengths(): WasmArray;
    /**
     * Create a new box from a 3x3 cell matrix and origin.
     *
     * # Arguments
     *
     * * `h` - 3x3 cell matrix as a float typed array with 9 elements in
     *   row-major order: `[h00, h01, h02, h10, h11, h12, h20, h21, h22]`.
     *   All values in angstrom (A).
     * * `origin` - 3D origin vector as a float typed array with 3 elements
     *   `[x, y, z]` in angstrom.
     * * `pbc_x` - Enable periodic boundary in x direction
     * * `pbc_y` - Enable periodic boundary in y direction
     * * `pbc_z` - Enable periodic boundary in z direction
     *
     * # Returns
     *
     * A new `Box` instance.
     *
     * # Errors
     *
     * Throws if `h` does not have 9 elements or `origin` does not have
     * 3 elements, or if the matrix is singular.
     *
     * # Example (JavaScript)
     *
     * ```js
     * // Triclinic box
     * const h = hMatrix;
     * const origin = originVec;
     * const box = new Box(h, origin, true, true, true);
     * ```
     */
    constructor(h: Float64Array, origin: Float64Array, pbc_x: boolean, pbc_y: boolean, pbc_z: boolean);
    /**
     * Return the box origin as a `WasmArray` with shape `[3]`.
     *
     * The origin is the lower-left corner of the box in angstrom (A).
     *
     * # Returns
     *
     * `WasmArray` containing `[ox, oy, oz]` in angstrom.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const o = box.origin().toCopy(); // Float32Array or Float64Array [0, 0, 0]
     * ```
     */
    origin(): WasmArray;
    /**
     * Create an orthorhombic (rectangular) box with axis-aligned edges.
     *
     * # Arguments
     *
     * * `lengths` - Box dimensions as a float typed array with 3 elements
     *   `[lx, ly, lz]` in angstrom (A)
     * * `origin` - 3D origin vector as a float typed array with 3 elements
     *   `[x, y, z]` in angstrom
     * * `pbc_x` - Enable periodic boundary in x direction
     * * `pbc_y` - Enable periodic boundary in y direction
     * * `pbc_z` - Enable periodic boundary in z direction
     *
     * # Returns
     *
     * A new orthorhombic `Box`.
     *
     * # Errors
     *
     * Throws if `lengths` or `origin` does not have 3 elements.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const origin = originVec;
     * const box = Box.ortho(lengthsVec, origin, true, true, true);
     * console.log(box.volume()); // 6000.0
     * ```
     */
    static ortho(lengths: Float64Array, origin: Float64Array, pbc_x: boolean, pbc_y: boolean, pbc_z: boolean): Box;
    /**
     * Return the box tilt factors as a `WasmArray` with shape `[3]`.
     *
     * Tilt factors `[xy, xz, yz]` define the off-diagonal elements
     * of the cell matrix (LAMMPS convention). For orthorhombic boxes
     * all tilts are zero.
     *
     * # Returns
     *
     * `WasmArray` containing `[xy, xz, yz]` (dimensionless ratios
     * multiplied by the corresponding box length, so effectively in A).
     *
     * # Example (JavaScript)
     *
     * ```js
     * const t = box.tilts().toCopy(); // Float32Array or Float64Array [0, 0, 0]
     * ```
     */
    tilts(): WasmArray;
    /**
     * Convert fractional to Cartesian coordinates and write the result
     * directly into a [`Block`] column.
     *
     * # Arguments
     *
     * * `coords` - `WasmArray` with shape `[N, 3]` (fractional, dimensionless)
     * * `out_block` - Target [`Block`]
     * * `out_key` - Column name for the result (float, shape `[N, 3]`)
     *
     * # Errors
     *
     * Throws if `coords` does not have shape `[N, 3]`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * box.toCartToBlock(fracCoords, outBlock, "cart_coords");
     * ```
     */
    toCartToBlock(coords: WasmArray, out_block: Block, out_key: string): void;
    /**
     * Convert Cartesian to fractional coordinates and write the result
     * directly into a [`Block`] column.
     *
     * # Arguments
     *
     * * `coords` - `WasmArray` with shape `[N, 3]` (Cartesian, A)
     * * `out_block` - Target [`Block`]
     * * `out_key` - Column name for the result (float, shape `[N, 3]`)
     *
     * # Errors
     *
     * Throws if `coords` does not have shape `[N, 3]`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * box.toFracToBlock(cartCoords, outBlock, "frac_coords");
     * ```
     */
    toFracToBlock(coords: WasmArray, out_block: Block, out_key: string): void;
    /**
     * Convert fractional coordinates to Cartesian coordinates.
     *
     * # Arguments
     *
     * * `coords` - `WasmArray` with shape `[N, 3]` containing
     *   fractional coordinates (dimensionless)
     *
     * # Returns
     *
     * `WasmArray` with shape `[N, 3]` containing Cartesian coordinates
     * in angstrom (A).
     *
     * # Errors
     *
     * Throws if `coords` does not have shape `[N, 3]`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const frac = WasmArray.from(fracCoords, [1, 3]);
     * const cart = box.toCart(frac);
     * console.log(cart.toCopy()); // [5, 5, 5] for a 10x10x10 box
     * ```
     */
    to_cart(coords: WasmArray): WasmArray;
    /**
     * Convert Cartesian coordinates to fractional coordinates.
     *
     * Fractional coordinates are in the range [0, 1) for atoms
     * inside the primary image of the box.
     *
     * # Arguments
     *
     * * `coords` - `WasmArray` with shape `[N, 3]` containing
     *   Cartesian coordinates in angstrom (A)
     *
     * # Returns
     *
     * `WasmArray` with shape `[N, 3]` containing fractional coordinates
     * (dimensionless).
     *
     * # Errors
     *
     * Throws if `coords` does not have shape `[N, 3]`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const cart = WasmArray.from(coords, [1, 3]);
     * const frac = box.toFrac(cart);
     * console.log(frac.toCopy()); // [0.5, 0.5, 0.5] for a 10x10x10 box
     * ```
     */
    to_frac(coords: WasmArray): WasmArray;
    /**
     * Return the box volume in cubic angstrom (A^3).
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(box.volume()); // e.g., 1000.0
     * ```
     */
    volume(): number;
    /**
     * Wrap Cartesian coordinates into the primary image of the box.
     *
     * Atoms outside the box are translated back into the primary image
     * using the periodic boundary conditions. Only axes with PBC
     * enabled are wrapped.
     *
     * # Arguments
     *
     * * `coords` - `WasmArray` with shape `[N, 3]` containing
     *   Cartesian coordinates in angstrom (A)
     *
     * # Returns
     *
     * `WasmArray` with shape `[N, 3]` containing wrapped coordinates
     * in angstrom (A).
     *
     * # Errors
     *
     * Throws if `coords` does not have shape `[N, 3]`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const pos = WasmArray.from(positions, [1, 3]);
     * const wrapped = box.wrap(pos); // wraps into [0, lx) x [0, ly) x [0, lz)
     * ```
     */
    wrap(coords: WasmArray): WasmArray;
    /**
     * Wrap coordinates and write the result directly into a [`Block`] column.
     *
     * This is an allocation-efficient alternative to [`wrap`](Box::wrap)
     * that avoids creating an intermediate `WasmArray`.
     *
     * # Arguments
     *
     * * `coords` - `WasmArray` with shape `[N, 3]` containing
     *   Cartesian coordinates in angstrom (A)
     * * `out_block` - Target [`Block`] to write the result into
     * * `out_key` - Column name for the result (float, shape `[N, 3]`)
     *
     * # Errors
     *
     * Throws if `coords` does not have shape `[N, 3]` or if the
     * block write fails.
     *
     * # Example (JavaScript)
     *
     * ```js
     * box.wrapToBlock(coords, outBlock, "wrapped_pos");
     * ```
     */
    wrapToBlock(coords: WasmArray, out_block: Block, out_key: string): void;
}

/**
 * Mass-weighted cluster center calculator.
 */
export class CenterOfMass {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Compute centers of mass.
     */
    compute(frame: Frame, cluster_result: ClusterResult): CenterOfMassResult;
    /**
     * Create a center-of-mass calculator.
     *
     * Pass `null` for uniform masses, or a float typed array of per-particle masses.
     */
    constructor(masses?: Float64Array | null);
}

/**
 * Result of center-of-mass computation.
 *
 * # Example (JavaScript)
 *
 * ```js
 * const com = new CenterOfMass().compute(frame, clusterResult);
 * com.centersOfMass();   // Float32Array or Float64Array [x0,y0,z0, ...]
 * com.clusterMasses();   // Float32Array or Float64Array
 * ```
 */
export class CenterOfMassResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Zero-copy `Float64Array` view of mass-weighted centers, flat
     * `[x0,y0,z0, x1,y1,z1, ...]`. **Invalidated** on WASM memory growth.
     */
    centersOfMass(): Float64Array;
    /**
     * Zero-copy `Float64Array` view of total mass per cluster.
     * **Invalidated** on WASM memory growth.
     */
    clusterMasses(): Float64Array;
    /**
     * Number of clusters.
     */
    readonly numClusters: number;
}

/**
 * Distance-based cluster analysis using BFS on the neighbor graph.
 *
 * Particles that are connected (directly or transitively) through
 * neighbor-list pairs are grouped into clusters. Clusters smaller
 * than `minClusterSize` are filtered out (their particles get
 * cluster ID = -1).
 *
 * # Example (JavaScript)
 *
 * ```js
 * const lc = new LinkedCell(2.0);
 * const nlist = lc.build(frame);
 *
 * const cluster = new Cluster(5); // min 5 particles per cluster
 * const result = cluster.compute(frame, nlist);
 *
 * console.log(result.numClusters);     // number of valid clusters
 * console.log(result.clusterIdx());    // Int32Array, per-particle IDs
 * console.log(result.clusterSizes());  // Uint32Array, size of each cluster
 * ```
 */
export class Cluster {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Run cluster analysis on a frame with pre-built neighbor pairs.
     *
     * # Arguments
     *
     * * `frame` - Frame with atom positions
     * * `neighbors` - Pre-built [`NeighborList`] defining connectivity
     *
     * # Returns
     *
     * A [`ClusterResult`] with per-particle cluster IDs and cluster sizes.
     *
     * # Errors
     *
     * Throws if the frame cannot be cloned or the analysis fails.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const result = cluster.compute(frame, nlist);
     * ```
     */
    compute(frame: Frame, neighbors: NeighborList): ClusterResult;
    /**
     * Create a cluster analysis with a minimum cluster size filter.
     *
     * # Arguments
     *
     * * `min_cluster_size` - Minimum number of particles for a cluster
     *   to be considered valid. Clusters with fewer particles are
     *   discarded (their particles get cluster ID = -1).
     *
     * # Example (JavaScript)
     *
     * ```js
     * const cluster = new Cluster(5); // ignore clusters < 5 particles
     * ```
     */
    constructor(min_cluster_size: number);
}

/**
 * Geometric cluster centers with minimum image convention.
 *
 * # Example (JavaScript)
 *
 * ```js
 * const centers = new ClusterCenters().compute(frame, clusterResult);
 * // Float32Array or Float64Array [x0,y0,z0, x1,y1,z1, ...]
 * ```
 */
export class ClusterCenters {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Compute geometric centers. Returns a flat float typed array `[x0,y0,z0, ...]`.
     */
    compute(frame: Frame, cluster_result: ClusterResult): Float64Array;
    constructor();
}

/**
 * Result of a distance-based cluster analysis.
 *
 * # Example (JavaScript)
 *
 * ```js
 * const result = cluster.compute(frame, nlist);
 * console.log(result.numClusters);       // number
 *
 * const ids   = result.clusterIdx();     // Int32Array (per-particle)
 * const sizes = result.clusterSizes();   // Uint32Array (per-cluster)
 *
 * // Particles in filtered-out clusters have id = -1
 * for (let i = 0; i < ids.length; i++) {
 *   if (ids[i] === -1) console.log(`Particle ${i} not in any valid cluster`);
 * }
 * ```
 */
export class ClusterResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Per-particle cluster ID assignment as `Int32Array`.
     *
     * `clusterIdx()[i]` is the cluster ID for particle `i`.
     * Particles in clusters smaller than `minClusterSize` are
     * assigned ID = -1 (filtered out).
     *
     * Cluster IDs are zero-based and contiguous: `0, 1, ..., numClusters-1`.
     */
    clusterIdx(): Int32Array;
    /**
     * Size (particle count) of each valid cluster as `Uint32Array`.
     *
     * `clusterSizes()[c]` is the number of particles in cluster `c`.
     * Length equals `numClusters`.
     */
    clusterSizes(): Uint32Array;
    /**
     * Number of valid clusters found (after min-size filtering).
     */
    readonly numClusters: number;
}

/**
 * Hierarchical data container mapping string keys to typed [`Block`]s.
 *
 * A `Frame` owns a set of named blocks (column stores) and an optional
 * simulation box ([`Box`](super::region::simbox::Box)). This is the
 * primary interchange type for molecular data in the WASM API.
 *
 * # Conventions
 *
 * - The `"atoms"` block should contain per-atom properties: `symbol`
 *   (string), `x`/`y`/`z` (F, coordinates in angstrom), and optionally
 *   `mass` (F, atomic mass units) and `charge` (F, elementary charges).
 * - The `"bonds"` block should contain bond topology: `i`/`j` (u32,
 *   zero-based atom indices) and `order` (F, bond order: 1.0 = single,
 *   1.5 = aromatic, 2.0 = double, 3.0 = triple).
 *
 * # Example (JavaScript)
 *
 * ```js
 * const frame = new Frame();
 * const atoms = frame.createBlock("atoms");
 * atoms.setColF("x", xCoords);
 * ```
 */
export class Frame {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Remove all blocks from this frame (but keep the frame alive).
     *
     * # Errors
     *
     * Throws a `JsValue` string if the frame has already been dropped.
     *
     * # Example (JavaScript)
     *
     * ```js
     * frame.clear();
     * ```
     */
    clear(): void;
    /**
     * Create a new empty [`Block`] and register it under `key`.
     *
     * If a block with the same key already exists it is replaced.
     *
     * # Arguments
     *
     * * `key` - Block name (e.g., `"atoms"`, `"bonds"`)
     *
     * # Returns
     *
     * A mutable [`Block`] handle that can be used to add columns.
     *
     * # Errors
     *
     * Throws a `JsValue` string if the underlying store operation fails
     * (e.g., the frame has been dropped).
     *
     * # Example (JavaScript)
     *
     * ```js
     * const atoms = frame.createBlock("atoms");
     * atoms.setColF("x", xCoords);
     * ```
     */
    createBlock(key: string): Block;
    /**
     * Explicitly release this frame and all its blocks from the store.
     *
     * After calling `drop()`, any subsequent operations on this frame
     * or its blocks will throw. This is optional -- the frame will also
     * be released when garbage-collected by the JS engine.
     *
     * # Errors
     *
     * Throws a `JsValue` string if the frame was already dropped.
     *
     * # Example (JavaScript)
     *
     * ```js
     * frame.drop();
     * // frame.clear() would now throw
     * ```
     */
    drop(): void;
    /**
     * Retrieve an existing [`Block`] by name.
     *
     * # Arguments
     *
     * * `key` - Block name to look up
     *
     * # Returns
     *
     * The [`Block`] if found, or `undefined` if no block with that key
     * exists in this frame.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const atoms = frame.getBlock("atoms");
     * if (atoms) {
     *   const x = atoms.copyColF("x");
     * }
     * ```
     */
    getBlock(key: string): Block | undefined;
    /**
     * Retrieve a named grid attached to this frame.
     *
     * Returns a cloned [`Grid`] wrapper, or `undefined` if the grid does
     * not exist. The returned object is independent of the frame — mutations
     * to it are not reflected in the frame without a subsequent
     * [`insertGrid`](Frame::insert_grid) call.
     *
     * # Arguments
     *
     * * `name` — Grid name to retrieve.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const g = frame.getGrid("chgcar");
     * if (g) {
     *   const arr = g.getArray("rho");
     * }
     * ```
     */
    getGrid(name: string): Grid | undefined;
    /**
     * Read a per-frame metadata value as a numeric scalar.
     *
     * Returns `Some(v)` if the meta key exists AND its string value parses
     * as an `f64`. Returns `None` if the key is missing or the value is
     * non-numeric (e.g., `config="trans"`).
     *
     * `frame.meta` is a `HashMap<String, String>`; the ExtXYZ parser stores
     * all comment-line values as strings. This accessor reads numeric ones
     * via `str::parse::<f64>`.
     *
     * # Arguments
     *
     * * `name` — Meta key to look up (e.g., `"energy"`, `"temp"`).
     *
     * # Example (JavaScript)
     *
     * ```js
     * const energy = frame.getMetaScalar("energy");
     * if (energy !== undefined) {
     *   console.log("Energy:", energy);
     * }
     * ```
     */
    getMetaScalar(name: string): number | undefined;
    /**
     * Return the names of all grids attached to this frame.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const names = frame.gridNames(); // e.g. ["chgcar", "spin"]
     * ```
     */
    gridNames(): Array<any>;
    /**
     * Returns `true` if a named grid is attached to this frame.
     *
     * # Arguments
     *
     * * `name` — Grid name to look up.
     *
     * # Example (JavaScript)
     *
     * ```js
     * frame.hasGrid("chgcar"); // true or false
     * ```
     */
    hasGrid(name: string): boolean;
    /**
     * Insert a block by deep-copying its data into this frame's store.
     *
     * This is useful for transferring a block from one frame to another.
     * The source block's data is cloned; subsequent modifications to the
     * source will not affect this frame.
     *
     * # Arguments
     *
     * * `key` - Name under which to store the block
     * * `block` - The source [`Block`] whose data will be copied
     *
     * # Errors
     *
     * Throws a `JsValue` string if either the source block or the
     * destination frame handle is invalid.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const otherFrame = new Frame();
     * const atoms = otherFrame.createBlock("atoms");
     * // ... populate atoms ...
     * frame.insertBlock("atoms", atoms);
     * ```
     */
    insertBlock(key: string, block: Block): void;
    /**
     * Attach a grid to this frame under the given name.
     *
     * If a grid with the same name already exists it is replaced. The grid
     * data is moved into the frame; the JS `Grid` object becomes empty after
     * this call and should not be reused.
     *
     * # Arguments
     *
     * * `name` — Name to store the grid under (e.g., `"chgcar"`).
     * * `grid` — The [`Grid`] to attach.
     *
     * # Errors
     *
     * Throws a `JsValue` string if the frame has been dropped.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const grid = new Grid(10, 10, 10, origin, cell, true, true, true);
     * grid.insertArray("rho", rhoData);
     * frame.insertGrid("chgcar", grid);
     * ```
     */
    insertGrid(name: string, grid: Grid): void;
    /**
     * Return the names of all metadata keys on this frame.
     *
     * Includes all keys regardless of whether their values are numeric
     * or categorical. To filter to numeric keys, iterate and call
     * [`getMetaScalar`](Self::get_meta_scalar) on each.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const names = frame.metaNames(); // e.g. ["energy", "config", "temp"]
     * ```
     */
    metaNames(): string[];
    /**
     * Create a new, empty `Frame` with no blocks and no simulation box.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const frame = new Frame();
     * ```
     */
    constructor();
    /**
     * Remove a block by name.
     *
     * # Arguments
     *
     * * `key` - Block name to remove
     *
     * # Errors
     *
     * Throws a `JsValue` string if the frame has been dropped or the
     * key does not exist.
     *
     * # Example (JavaScript)
     *
     * ```js
     * frame.removeBlock("bonds");
     * ```
     */
    removeBlock(key: string): void;
    /**
     * Remove a named grid from this frame.
     *
     * # Arguments
     *
     * * `name` — Grid name to remove.
     *
     * # Errors
     *
     * Throws a `JsValue` string if the frame has been dropped.
     *
     * # Example (JavaScript)
     *
     * ```js
     * frame.removeGrid("chgcar");
     * ```
     */
    removeGrid(name: string): void;
    /**
     * Rename a block from `old_key` to `new_key`.
     *
     * # Arguments
     *
     * * `old_key` - Current block name
     * * `new_key` - New block name
     *
     * # Returns
     *
     * `true` if the block was found and renamed, `false` if `old_key`
     * did not exist.
     *
     * # Errors
     *
     * Throws a `JsValue` string if the frame has been dropped.
     *
     * # Example (JavaScript)
     *
     * ```js
     * frame.renameBlock("atoms", "particles");
     * ```
     */
    renameBlock(old_key: string, new_key: string): boolean;
    /**
     * Rename a column within a specific block.
     *
     * # Arguments
     *
     * * `block_key` - Name of the block containing the column
     * * `old_col` - Current column name
     * * `new_col` - New column name
     *
     * # Returns
     *
     * `true` if the column was found and renamed, `false` if
     * `old_col` did not exist in the block.
     *
     * # Errors
     *
     * Throws a `JsValue` string if the frame or block does not exist.
     *
     * # Example (JavaScript)
     *
     * ```js
     * frame.renameColumn("atoms", "element", "symbol");
     * ```
     */
    renameColumn(block_key: string, old_col: string, new_col: string): boolean;
    /**
     * Set a per-frame metadata value.
     *
     * Stores `value` as the string backing for `name` on `frame.meta`.
     * Numeric values are read back via
     * [`getMetaScalar`](Self::get_meta_scalar) by parsing the string
     * form. `frame.meta` is the single source of truth for per-frame
     * scalars — no separate aggregation layer is needed on the JS side.
     *
     * # Arguments
     *
     * * `name` — Meta key (e.g., `"energy"`, `"temp"`).
     * * `value` — String value. For numeric labels, the caller is
     *   responsible for converting (e.g., `num.toString()`).
     *
     * # Errors
     *
     * Throws a `JsValue` string if the frame has been dropped.
     *
     * # Example (JavaScript)
     *
     * ```js
     * frame.setMeta("energy", "-3.14");
     * frame.setMeta("note", "run-42");
     * ```
     */
    setMeta(name: string, value: string): void;
    /**
     * Get the simulation box attached to this frame (if any).
     *
     * # Returns
     *
     * The [`Box`](super::region::simbox::Box) if one has been set,
     * or `undefined` otherwise.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const box = frame.simbox;
     * if (box) {
     *   console.log("Volume:", box.volume());
     * }
     * ```
     */
    get simbox(): Box | undefined;
    /**
     * Attach or detach a simulation box.
     *
     * Pass a [`Box`](super::region::simbox::Box) to attach, or
     * `undefined`/`null` to detach.
     *
     * # Arguments
     *
     * * `simbox` - The simulation box, or `undefined`/`null` to remove it
     *
     * # Errors
     *
     * Throws a `JsValue` string if the frame has been dropped.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const origin = originVec;
     * frame.simbox = Box.cube(10.0, origin, true, true, true);
     * ```
     */
    set simbox(value: Box | null | undefined);
}

/**
 * A uniform spatial grid storing multiple named scalar arrays.
 *
 * All arrays in a `Grid` share the same spatial definition: dimensions
 * (`[nx, ny, nz]`), Cartesian origin, cell matrix (columns are lattice
 * vectors, matching VASP/molrs convention), and periodic boundary flags.
 *
 * # Example (JavaScript)
 *
 * ```js
 * // Create a 10×10×10 cubic grid
 * const origin = new Float32Array([0, 0, 0]);
 * const cell = new Float32Array([
 *   10, 0, 0,   // first column (a vector)
 *    0,10, 0,   // second column (b vector)
 *    0, 0,10,   // third column (c vector)
 * ]);
 * const grid = new Grid(10, 10, 10, origin, cell, true, true, true);
 *
 * // Insert a density array (must have length = 10*10*10 = 1000)
 * const rho = new Float32Array(1000).fill(1.0);
 * grid.insertArray("rho", rho);
 *
 * // Retrieve it
 * const arr = grid.getArray("rho");
 * console.log(arr.toCopy());
 * ```
 */
export class Grid {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Names of all scalar arrays stored in this grid.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const names = grid.arrayNames(); // e.g. ["rho", "spin"]
     * ```
     */
    arrayNames(): Array<any>;
    /**
     * Cell matrix in Ångström as a flat array of length 9 in column-major
     * order (columns are lattice vectors, matching VASP/molrs convention).
     *
     * Layout: `[col0_x, col0_y, col0_z, col1_x, col1_y, col1_z, col2_x, col2_y, col2_z]`
     *
     * # Example (JavaScript)
     *
     * ```js
     * const c = grid.cell();
     * const flat = c.toCopy(); // Float32Array of length 9
     * ```
     */
    cell(): WasmArray;
    /**
     * Grid dimensions `[nx, ny, nz]`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(grid.dim()); // [10, 10, 10]
     * ```
     */
    dim(): Uint32Array;
    /**
     * Retrieve a named scalar array as a zero-copy `Float64Array` view
     * over the underlying WASM memory. Flat row-major order, length
     * `nx * ny * nz`. Use [`Grid::dim`] for shape.
     *
     * **Warning**: the view is invalidated on any WASM memory growth.
     * Copy it in JS (`new Float64Array(view)`) if it needs to outlive
     * subsequent allocations.
     *
     * Returns `undefined` if the named array does not exist.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const view = grid.getArray("rho");          // zero-copy
     * const copy = new Float64Array(view);        // owned copy if needed
     * ```
     */
    getArray(name: string): Float64Array | undefined;
    /**
     * Returns `true` if a named array is present in this grid.
     *
     * # Arguments
     *
     * * `name` — Array name to look up.
     *
     * # Example (JavaScript)
     *
     * ```js
     * grid.hasArray("rho"); // true or false
     * ```
     */
    hasArray(name: string): boolean;
    /**
     * Insert (or replace) a named scalar array.
     *
     * The provided `data` must have exactly `nx * ny * nz` elements in
     * row-major `(ix, iy, iz)` order.
     *
     * # Arguments
     *
     * * `name` — Array name.
     * * `data` — Float32Array with length equal to `grid.total()`.
     *
     * # Errors
     *
     * Throws if `data.length != nx * ny * nz`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const rho = new Float32Array(grid.total()).fill(0.5);
     * grid.insertArray("rho", rho);
     * ```
     */
    insertArray(name: string, data: Float64Array): void;
    /**
     * Returns `true` if no arrays are stored.
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(grid.isEmpty()); // true for a freshly created grid
     * ```
     */
    isEmpty(): boolean;
    /**
     * Number of named arrays stored in this grid.
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(grid.len()); // e.g. 2
     * ```
     */
    len(): number;
    /**
     * Create a new empty grid with the given spatial definition.
     *
     * # Arguments
     *
     * * `dim_x`, `dim_y`, `dim_z` — Number of grid points along each axis.
     * * `origin` — Float32Array of length 3: Cartesian origin in Ångström.
     * * `cell` — Float32Array of length 9: cell matrix in column-major order.
     *   `cell[0..3]` is the first lattice vector (a), `cell[3..6]` is b,
     *   `cell[6..9]` is c (matching VASP/molrs convention where columns are
     *   lattice vectors).
     * * `pbc_x`, `pbc_y`, `pbc_z` — Periodic boundary flags for each axis.
     *
     * # Errors
     *
     * Throws if `origin` does not have length 3, or `cell` does not have
     * length 9.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const origin = new Float32Array([0, 0, 0]);
     * const cell = new Float32Array([10,0,0, 0,10,0, 0,0,10]);
     * const grid = new Grid(10, 10, 10, origin, cell, true, true, true);
     * ```
     */
    constructor(dim_x: number, dim_y: number, dim_z: number, origin: Float64Array, cell: Float64Array, pbc_x: boolean, pbc_y: boolean, pbc_z: boolean);
    /**
     * Cartesian origin in Ångström as a 1-D array of length 3.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const o = grid.origin();
     * const arr = o.toCopy(); // Float32Array [ox, oy, oz]
     * ```
     */
    origin(): WasmArray;
    /**
     * Periodic boundary flags as a `Uint8Array`-compatible slice.
     *
     * Each element is `1` (periodic) or `0` (not periodic).
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(grid.pbc()); // [1, 1, 1]
     * ```
     */
    pbc(): Uint8Array;
    /**
     * Total number of voxels: `nx * ny * nz`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(grid.total()); // 1000 for a 10×10×10 grid
     * ```
     */
    total(): number;
}

/**
 * Gyration tensor per cluster.
 *
 * Returns flat array: `[g00,g01,g02, g10,g11,g12, g20,g21,g22, ...]` per cluster.
 */
export class GyrationTensor {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Compute gyration tensors. Returns a flat float typed array (9 values per cluster).
     *
     * Internally computes the cluster geometric centers (via
     * [`RsClusterCenters`]) since the new compute trait exposes them as a
     * required upstream — the old single-frame wasm API hides this detail.
     */
    compute(frame: Frame, cluster_result: ClusterResult): Float64Array;
    constructor();
}

/**
 * Moment of inertia tensor per cluster.
 */
export class InertiaTensor {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Compute inertia tensors. Returns a flat float typed array (9 values per cluster).
     *
     * Internally computes the cluster centers of mass (via
     * [`RsCenterOfMass`]) since the new compute trait consumes them as a
     * required upstream — the old single-frame wasm API hides this detail.
     */
    compute(frame: Frame, cluster_result: ClusterResult): Float64Array;
    constructor(masses?: Float64Array | null);
}

/**
 * LAMMPS dump trajectory file reader.
 *
 * Reads multi-frame LAMMPS dump files (the format produced by the
 * `dump` command). Each frame produces a [`Frame`] containing an
 * `"atoms"` block with columns matching the dump header (e.g.
 * `id`, `type`, `x`, `y`, `z`, `vx`, `vy`, `vz`).
 *
 * # Example (JavaScript)
 *
 * ```js
 * const reader = new LAMMPSDumpReader(dumpContent);
 * console.log(reader.len()); // number of timesteps
 * const frame = reader.read(0);
 * const atoms = frame.getBlock("atoms");
 * ```
 */
export class LAMMPSDumpReader {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Check whether the file contains no frames.
     */
    isEmpty(): boolean;
    /**
     * Return the number of frames in the dump file.
     */
    len(): number;
    /**
     * Create a new LAMMPS dump reader from string content.
     */
    constructor(content: string);
    /**
     * Read a frame at the given step index.
     */
    read(step: number): Frame | undefined;
}

/**
 * LAMMPS data file reader.
 *
 * Reads LAMMPS data files (the format written by `write_data`). The
 * reader produces a [`Frame`] containing:
 *
 * - `"atoms"` block: `type` (i32), `x`, `y`, `z` (F, angstrom),
 *   and optionally `charge` (F)
 * - `"bonds"` block (if present): `i`, `j` (u32), `type` (i32)
 * - Simulation box (`simbox`) with PBC
 *
 * Only a single frame is supported (`step = 0`).
 *
 * # Example (JavaScript)
 *
 * ```js
 * const reader = new LAMMPSReader(dataFileContent);
 * const frame = reader.read(0);
 * const atoms = frame.getBlock("atoms");
 * const bonds = frame.getBlock("bonds");
 * const box   = frame.simbox;
 * ```
 */
export class LAMMPSReader {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Check whether the file contains no valid frames.
     *
     * # Errors
     *
     * Throws a `JsValue` string on parse errors.
     */
    isEmpty(): boolean;
    /**
     * Return the number of frames (always 0 or 1 for LAMMPS data files).
     *
     * # Errors
     *
     * Throws a `JsValue` string on parse errors.
     */
    len(): number;
    /**
     * Create a new LAMMPS data file reader from string content.
     *
     * # Arguments
     *
     * * `content` - The full text content of a LAMMPS data file
     *
     * # Example (JavaScript)
     *
     * ```js
     * const reader = new LAMMPSReader(dataFileString);
     * ```
     */
    constructor(content: string);
    /**
     * Read the frame at the given step index.
     *
     * LAMMPS data files contain a single configuration, so only
     * `step = 0` is valid. Passing any other step returns `undefined`.
     *
     * # Arguments
     *
     * * `step` - Frame index (must be `0`)
     *
     * # Returns
     *
     * A [`Frame`] with atoms, optional bonds, and simbox, or `undefined`.
     *
     * # Errors
     *
     * Throws a `JsValue` string on parse errors.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const frame = reader.read(0);
     * ```
     */
    read(step: number): Frame | undefined;
}

/**
 * Cell-list (linked-cell) based neighbor search.
 *
 * Creates a spatial index from a [`Frame`]'s atom positions and
 * simulation box, then finds all neighbor pairs within the cutoff
 * distance.
 *
 * All distances are in angstrom (A).
 *
 * # Example (JavaScript)
 *
 * ```js
 * const lc = new LinkedCell(3.0);       // cutoff = 3.0 A
 * const nlist = lc.build(frame);         // self-query (unique pairs i < j)
 * const cross = lc.query(ref, other);    // cross-query
 *
 * console.log(nlist.numPairs);
 * ```
 */
export class LinkedCell {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Build a neighbor list from a [`Frame`] (self-query).
     *
     * Finds all unique pairs `(i < j)` of atoms within the cutoff
     * distance using the cell-list algorithm.
     *
     * The frame must have an `"atoms"` block with `x`, `y`, `z` (F) columns.
     * If the frame has a `simbox`, periodic boundary conditions are used.
     * Otherwise, a free-boundary bounding box is auto-generated.
     *
     * # Arguments
     *
     * * `frame` - Frame with atom positions
     *
     * # Returns
     *
     * A [`NeighborList`] containing all unique pairs within the cutoff.
     *
     * # Errors
     *
     * Throws if the frame is missing required data.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const lc = new LinkedCell(3.0);
     * const nlist = lc.build(frame);
     * const dists = nlist.distances(); // Float32Array or Float64Array
     * ```
     */
    build(frame: Frame): NeighborList;
    /**
     * Create a linked-cell neighbor search with the given distance cutoff.
     *
     * # Arguments
     *
     * * `cutoff` - Maximum neighbor distance in angstrom (A)
     *
     * # Example (JavaScript)
     *
     * ```js
     * const lc = new LinkedCell(5.0);
     * ```
     */
    constructor(cutoff: number);
    /**
     * Cross-query: find all pairs where `i` indexes query points and
     * `j` indexes the reference points.
     *
     * # Arguments
     *
     * * `ref_frame` - Frame with reference atom positions
     * * `query_frame` - Frame with query atom positions (must have
     *   `"atoms"` block with `x`, `y`, `z` columns)
     *
     * # Returns
     *
     * A [`NeighborList`] containing all `(i, j, distance)` pairs
     * within the cutoff.
     *
     * # Errors
     *
     * Throws if either frame is missing required columns.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const lc = new LinkedCell(3.0);
     * const crossPairs = lc.query(refFrame, otherFrame);
     * console.log(crossPairs.numPairs);
     * ```
     */
    query(ref_frame: Frame, query_frame: Frame): NeighborList;
}

/**
 * Mean squared displacement (MSD) analysis.
 *
 * Computes MSD = |r(t) - r(0)|^2 for each particle and the system
 * average. The first frame fed is automatically used as the reference.
 * Useful for measuring diffusion coefficients via D = MSD / (6t).
 *
 * All distances are in angstrom (A), so MSD is in A^2.
 *
 * # Example (JavaScript)
 *
 * ```js
 * const msd = new MSD();
 * for (const frame of trajectory) {
 *   msd.feed(frame);         // first frame = reference
 * }
 * const results = msd.results();  // MSDResult[] per frame
 * console.log(results[10].mean);  // MSD at frame 10 in A^2
 * ```
 *
 * # References
 *
 * - Einstein, A. (1905). *Annalen der Physik*, 322(8), 549-560.
 */
export class MSD {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Feed a frame into the MSD analysis.
     *
     * Internally clones the frame's core data so subsequent mutations on
     * the JS side (e.g. trajectory playback overwriting buffers) do not
     * race against pending [`results`](Self::results) calls. The first
     * frame sets the reference configuration.
     *
     * # Arguments
     *
     * * `frame` - Frame with `"atoms"` block containing
     *   `x`, `y`, `z` (F) columns
     *
     * # Example (JavaScript)
     *
     * ```js
     * const msd = new MSD();
     * msd.feed(frame0);  // sets reference
     * msd.feed(frame1);  // added to trajectory
     * const series = msd.results();
     * ```
     */
    feed(frame: Frame): void;
    /**
     * Create an empty MSD analysis.
     *
     * The first frame passed to [`feed`] becomes the reference
     * configuration (t=0).
     *
     * # Example (JavaScript)
     *
     * ```js
     * const msd = new MSD();
     * ```
     */
    constructor();
    /**
     * Reset the analysis, clearing the trajectory buffer.
     */
    reset(): void;
    /**
     * Run the stateless [`molrs_compute::MSD`] over every fed frame and
     * return the per-frame time series.
     *
     * The first frame is always the reference, so `results()[0].mean ≈ 0`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const results = msd.results();
     * results.forEach((r, t) => console.log(`t=${t}: MSD=${r.mean}`));
     * ```
     */
    results(): MSDResult[];
    /**
     * Number of frames accumulated.
     */
    readonly count: number;
}

/**
 * Result of a mean squared displacement computation.
 *
 * # Example (JavaScript)
 *
 * ```js
 * const result = msd.compute(frame);
 * console.log(result.mean);              // number (A^2)
 * console.log(result.perParticle());     // Float32Array or Float64Array (A^2)
 * ```
 */
export class MSDResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Zero-copy `Float64Array` view of per-particle squared displacements
     * in A². `perParticle()[i]` is `|r_i(t) - r_i(0)|²` for particle `i`.
     * **Invalidated** on WASM memory growth; copy in JS if needed.
     */
    perParticle(): Float64Array;
    /**
     * System-average mean squared displacement in A^2.
     *
     * This is the arithmetic mean of all per-particle squared
     * displacements: `mean = sum(|r_i(t) - r_i(0)|^2) / N`.
     */
    readonly mean: number;
}

/**
 * Reader for MolRec Zarr v3 archives.
 */
export class MolRecReader {
    free(): void;
    [Symbol.dispose](): void;
    countAtoms(): number;
    countFrames(): number;
    free(): void;
    constructor(files: Map<any, any>);
    readFrame(t: number): Frame | undefined;
}

/**
 * Result of a neighbor search: all atom pairs within a distance cutoff.
 *
 * Contains pair indices, distances, and squared distances for every
 * neighbor pair found. This object is produced by [`LinkedCell`]
 * and consumed by analysis classes like [`RDF`] and [`Cluster`].
 *
 * # Properties
 *
 * | Property | Type | Description |
 * |----------|------|-------------|
 * | `numPairs` | `number` | Total number of neighbor pairs |
 * | `numPoints` | `number` | Number of reference points |
 * | `numQueryPoints` | `number` | Number of query points |
 * | `isSelfQuery` | `boolean` | Whether this is a self-query result |
 *
 * # Example (JavaScript)
 *
 * ```js
 * const nlist = lc.build(frame);
 * console.log(nlist.numPairs);
 *
 * const i = nlist.queryPointIndices(); // Uint32Array
 * const j = nlist.pointIndices();      // Uint32Array
 * const d = nlist.distances();         // Float32Array or Float64Array (in A)
 * ```
 */
export class NeighborList {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Zero-copy `Float64Array` view of squared pairwise distances in A^2.
     * Same invalidation caveat as [`queryPointIndices`](Self::query_point_indices).
     */
    distSq(): Float64Array;
    /**
     * Pairwise distances in angstrom (A). Computed lazily from `distSq`.
     *
     * Returns an owned copy because distances are derived on the fly
     * (`sqrt` per pair) rather than stored.
     */
    distances(): Float64Array;
    /**
     * Zero-copy `Uint32Array` view of reference point indices (`j`).
     * Same invalidation caveat as [`queryPointIndices`](Self::query_point_indices).
     */
    pointIndices(): Uint32Array;
    /**
     * Zero-copy `Uint32Array` view of query point indices (`i`) over
     * WASM memory. **Invalidated** on any WASM memory growth — copy
     * in JS (`new Uint32Array(view)`) if it needs to outlive later calls.
     */
    queryPointIndices(): Uint32Array;
    /**
     * Whether this result came from a self-query (`build()`).
     *
     * In self-queries, only unique pairs `(i < j)` are reported.
     */
    readonly isSelfQuery: boolean;
    /**
     * Total number of neighbor pairs found.
     */
    readonly numPairs: number;
    /**
     * Number of reference (target) points in the search.
     */
    readonly numPoints: number;
    /**
     * Number of query points in the search.
     *
     * For self-queries, this equals `numPoints`.
     */
    readonly numQueryPoints: number;
}

/**
 * Protein Data Bank (PDB) file reader.
 *
 * PDB files contain a single molecular structure. The reader produces
 * a [`Frame`] with an `"atoms"` block containing columns such as
 * `name` (string), `resname` (string), `x`, `y`, `z` (F, angstrom),
 * and optionally `occupancy` and `bfactor` (F).
 *
 * # Example (JavaScript)
 *
 * ```js
 * const reader = new PDBReader(pdbContent);
 * const frame = reader.read(0);
 * const atoms = frame.getBlock("atoms");
 * const names = atoms.copyColStr("name"); // ["CA", "CB", ...]
 * const x = atoms.copyColF("x");
 * ```
 */
export class PDBReader {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Check whether the file contains no valid frames.
     *
     * # Errors
     *
     * Throws a `JsValue` string on parse errors.
     */
    isEmpty(): boolean;
    /**
     * Return the number of frames (always 0 or 1 for PDB files).
     *
     * # Errors
     *
     * Throws a `JsValue` string on parse errors.
     */
    len(): number;
    /**
     * Create a new PDB reader from a string containing the file content.
     *
     * # Arguments
     *
     * * `content` - The full text content of a PDB file
     *
     * # Example (JavaScript)
     *
     * ```js
     * const reader = new PDBReader(pdbString);
     * ```
     */
    constructor(content: string);
    /**
     * Read the frame at the given step index.
     *
     * PDB files contain a single structure, so only `step = 0` is
     * valid. Passing any other step returns `undefined`.
     *
     * # Arguments
     *
     * * `step` - Frame index (must be `0` for PDB files)
     *
     * # Returns
     *
     * A [`Frame`] if `step == 0` and the file is valid, or `undefined`.
     *
     * # Errors
     *
     * Throws a `JsValue` string on parse errors.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const frame = reader.read(0);
     * ```
     */
    read(step: number): Frame | undefined;
}

/**
 * Radial distribution function g(r) analysis.
 *
 * Bins neighbor-pair distances in `[rMin, rMax]` and normalizes by the
 * ideal-gas pair density. Defaults follow freud (`rMin = 0`). Periodic
 * systems take their normalization volume from `frame.simbox`; non-periodic
 * systems must supply it explicitly via [`computeWithVolume`].
 *
 * # Algorithm
 *
 * g(r) = n(r) / (rho * V_shell(r) * N_ref)
 *
 * where `n(r)` is the pair count in bin `r`, `rho = N/V` is the number
 * density, and `V_shell(r)` is the shell volume for that bin.
 *
 * # Example (JavaScript)
 *
 * ```js
 * const lc = new LinkedCell(5.0);
 * const nlist = lc.build(frame);
 *
 * const rdf = new RDF(100, 5.0);          // rMin defaults to 0
 * const result = rdf.compute(frame, nlist);
 *
 * // Non-periodic frame: supply the normalization volume.
 * const resultFree = rdf.computeWithVolume(nlist, volumeA3);
 *
 * const r  = result.binCenters();
 * const gr = result.rdf();
 * ```
 */
export class RDF {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Compute g(r) using the simulation-box volume from `frame.simbox`.
     *
     * # Arguments
     *
     * * `frame` - Frame with a `simbox` set (used only for volume)
     * * `neighbors` - Pre-built [`NeighborList`] from [`LinkedCell`]
     *
     * # Errors
     *
     * Throws if the frame has no `simbox` — use
     * [`computeWithVolume`](Self::compute_with_volume) for non-periodic frames.
     */
    compute(frame: Frame, neighbors: NeighborList): RDFResult;
    /**
     * Compute g(r) using an explicit normalization volume (A^3).
     *
     * Use this for non-periodic systems or to override the box volume.
     * Internally wraps the supplied volume as a cubic SimBox since the
     * underlying [`molrs_compute::RDF`] pulls its normalization volume from
     * `frame.simbox`.
     *
     * # Arguments
     *
     * * `neighbors` - Pre-built [`NeighborList`]
     * * `volume` - Normalization volume in A^3 (must be finite and > 0)
     *
     * # Example (JavaScript)
     *
     * ```js
     * const result = rdf.computeWithVolume(nlist, 1000.0);
     * ```
     */
    computeWithVolume(neighbors: NeighborList, volume: number): RDFResult;
    /**
     * Create a new RDF analysis.
     *
     * # Arguments
     *
     * * `n_bins` - Number of histogram bins
     * * `r_max` - Upper radial cutoff in angstrom (A). Should be ≤ the
     *   neighbor-search cutoff.
     * * `r_min` - Lower radial cutoff in angstrom (A). Optional, defaults
     *   to 0 (freud convention). Pairs with `d < rMin` or `d == 0` are
     *   excluded from the histogram.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const rdf = new RDF(100, 5.0);       // rMin = 0
     * const rdf2 = new RDF(100, 5.0, 0.5); // exclude d < 0.5 A
     * ```
     */
    constructor(n_bins: number, r_max: number, r_min?: number | null);
}

/**
 * Result of a radial distribution function computation.
 *
 * Contains the binned g(r) values, bin geometry, raw pair counts,
 * and normalization metadata.
 *
 * # Example (JavaScript)
 *
 * ```js
 * const result = rdf.compute(frame, nlist);
 * const r  = result.binCenters();  // Float32Array or Float64Array [0.025, 0.075, ...]
 * const gr = result.rdf();         // Float32Array or Float64Array, normalized g(r)
 * const nr = result.pairCounts();  // Float32Array or Float64Array, raw counts
 * console.log("Volume:", result.volume, "A^3");
 * console.log("N_ref:", result.numPoints);
 * ```
 */
export class RDFResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Zero-copy `Float64Array` view of bin center positions in A.
     * Length equals `n_bins`. **Invalidated** on WASM memory growth;
     * copy in JS if it needs to outlive later calls.
     */
    binCenters(): Float64Array;
    /**
     * Zero-copy `Float64Array` view of bin edge positions in A.
     * Length is `n_bins + 1`. Same invalidation caveat.
     */
    binEdges(): Float64Array;
    /**
     * Zero-copy `Float64Array` view of raw (un-normalized) pair counts
     * per bin. Same invalidation caveat.
     */
    pairCounts(): Float64Array;
    /**
     * Zero-copy `Float64Array` view of normalized g(r). Same invalidation
     * caveat.
     */
    rdf(): Float64Array;
    /**
     * Number of reference points used in the normalization.
     */
    readonly numPoints: number;
    /**
     * Inner cutoff in A (lower edge of bin 0).
     */
    readonly rMin: number;
    /**
     * Normalization volume in A^3 (from the SimBox or the explicit caller value).
     */
    readonly volume: number;
}

/**
 * Radius of gyration per cluster.
 */
export class RadiusOfGyration {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Compute radii of gyration. Returns a float typed array of length `numClusters`.
     *
     * Internally computes the cluster centers of mass so the single-frame
     * wasm signature `(frame, cluster)` stays stable despite the new
     * compute trait needing explicit COM upstream.
     */
    compute(frame: Frame, cluster_result: ClusterResult): Float64Array;
    constructor(masses?: Float64Array | null);
}

/**
 * MDL molfile / SDF (V2000 CTAB) reader.
 *
 * Parses the connection table found in `.mol` files and the record
 * blocks of `.sdf` files. Coordinates come directly from the file —
 * no 3D generation is performed. Only V2000 is supported; V3000
 * records throw on read.
 *
 * Produces a [`Frame`] with:
 * - `"atoms"` block: `element` (string), `id` (u32, 1-based),
 *   `x`, `y`, `z` (F, angstrom)
 * - `"bonds"` block (if present): `atomi`, `atomj` (u32, 0-based),
 *   `order` (u32)
 *
 * Multi-record SDF files expose each record as a separate frame via
 * `read(step)`.
 *
 * # Example (JavaScript)
 *
 * ```js
 * const reader = new SDFReader(sdfContent);
 * const frame = reader.read(0);
 * const atoms = frame.getBlock("atoms");
 * const x = atoms.copyColF("x");
 * ```
 */
export class SDFReader {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Check whether the file contains no records.
     */
    isEmpty(): boolean;
    /**
     * Return the total number of records in the SDF file.
     */
    len(): number;
    /**
     * Create a new SDF reader from a string containing the file content.
     */
    constructor(content: string);
    /**
     * Read the frame (SDF record) at the given step index.
     */
    read(step: number): Frame | undefined;
}

/**
 * Intermediate representation of a parsed SMILES string.
 *
 * Holds the molecular graph(s) parsed from a SMILES string. A single
 * SMILES string can encode multiple disconnected molecules separated
 * by `.` (e.g., `"[Na+].[Cl-]"`).
 *
 * Call [`toFrame()`](WasmSmilesIR::to_frame) to convert to a [`Frame`]
 * with `"atoms"` and `"bonds"` blocks.
 *
 * # Example (JavaScript)
 *
 * ```js
 * const ir = parseSMILES("CCO");
 * console.log(ir.nComponents); // 1
 *
 * const frame = ir.toFrame();
 * const atoms = frame.getBlock("atoms");
 * console.log(atoms.copyColStr("element")); // ["C", "C", "O", "H", ...]
 * ```
 */
export class SmilesIR {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Convert the intermediate representation to a [`Frame`].
     *
     * The resulting frame contains:
     *
     * - `"atoms"` block: `symbol` (string), and implicit hydrogens
     *   are added. No 3D coordinates are present -- use
     *   [`generate3D`](crate::generate_3d_wasm) to embed coordinates.
     * - `"bonds"` block: `i`, `j` (u32, zero-based atom indices),
     *   `order` (F, bond order: 1.0 = single, 1.5 = aromatic,
     *   2.0 = double, 3.0 = triple).
     *
     * # Returns
     *
     * A new [`Frame`] with atoms and bonds.
     *
     * # Errors
     *
     * Throws a `JsValue` string if the conversion fails (e.g.,
     * invalid valence).
     *
     * # Example (JavaScript)
     *
     * ```js
     * const frame = ir.toFrame();
     * const bonds = frame.getBlock("bonds");
     * const order = bonds.copyColF("order");
     * ```
     */
    toFrame(): Frame;
    /**
     * Return the number of disconnected components in the SMILES.
     *
     * Components are separated by `.` in the SMILES string. For
     * example, `"[Na+].[Cl-]"` has 2 components.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const ir = parseSMILES("[Na+].[Cl-]");
     * console.log(ir.nComponents); // 2
     * ```
     */
    readonly nComponents: number;
}

/**
 * Graph-based molecular topology with automated detection of angles,
 * dihedrals, impropers, connected components, and rings (SSSR).
 *
 * API mirrors igraph / molpy conventions.
 *
 * # Example (JavaScript)
 *
 * ```js
 * const topo = Topology.fromFrame(frame);
 * console.log(topo.nAtoms, topo.nBonds);
 *
 * const angles = topo.angles();       // Uint32Array [i,j,k, ...]
 * const dihedrals = topo.dihedrals(); // Uint32Array [i,j,k,l, ...]
 * const cc = topo.connectedComponents(); // Int32Array per-atom labels
 *
 * const rings = topo.findRings();
 * console.log(rings.numRings);
 * ```
 */
export class Topology {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Add a single atom.
     */
    addAtom(): void;
    /**
     * Add a bond between atoms `i` and `j`.
     */
    addBond(i: number, j: number): void;
    /**
     * All angle triplets as flat `Uint32Array` `[i,j,k, ...]`.
     */
    angles(): Uint32Array;
    /**
     * Whether atoms `i` and `j` are directly bonded.
     */
    areBonded(i: number, j: number): boolean;
    /**
     * All bond pairs as flat `Uint32Array` `[i0,j0, i1,j1, ...]`.
     */
    bonds(): Uint32Array;
    /**
     * Per-atom connected component labels as `Int32Array`.
     *
     * Labels are 0-based and contiguous. Each atom gets a component ID.
     * Atoms in the same connected subgraph share the same label.
     */
    connectedComponents(): Int32Array;
    /**
     * Degree (number of bonds) of atom `idx`.
     */
    degree(idx: number): number;
    /**
     * Delete an atom by index.
     */
    deleteAtom(idx: number): void;
    /**
     * Delete a bond by edge index.
     */
    deleteBond(idx: number): void;
    /**
     * All proper dihedral quartets as flat `Uint32Array` `[i,j,k,l, ...]`.
     */
    dihedrals(): Uint32Array;
    /**
     * Compute the Smallest Set of Smallest Rings (SSSR).
     */
    findRings(): TopologyRingInfo;
    /**
     * Build a topology from a Frame's `bonds` block.
     *
     * Reads the `atoms` block for atom count and `bonds` block for
     * `i`, `j` columns (Uint32).
     */
    static fromFrame(frame: Frame): Topology;
    /**
     * All improper dihedral quartets as flat `Uint32Array` `[center,i,j,k, ...]`.
     */
    impropers(): Uint32Array;
    /**
     * Neighbor atom indices of atom `idx` as `Uint32Array`.
     */
    neighbors(idx: number): Uint32Array;
    /**
     * Create a topology with `n` atoms and no bonds.
     */
    constructor(n_atoms: number);
    /**
     * Number of unique angles.
     */
    readonly nAngles: number;
    /**
     * Number of atoms (vertices).
     */
    readonly nAtoms: number;
    /**
     * Number of bonds (edges).
     */
    readonly nBonds: number;
    /**
     * Number of connected components.
     */
    readonly nComponents: number;
    /**
     * Number of unique proper dihedrals.
     */
    readonly nDihedrals: number;
}

/**
 * Result of ring detection (SSSR) on a topology graph.
 *
 * # Example (JavaScript)
 *
 * ```js
 * const rings = topo.findRings();
 * console.log(rings.numRings);
 * console.log(rings.ringSizes());   // Uint32Array
 * console.log(rings.isAtomInRing(0));
 *
 * // Get all rings as flat array [size0, idx0_0, idx0_1, ..., size1, ...]
 * const data = rings.rings();
 * ```
 */
export class TopologyRingInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Per-atom boolean mask as `Uint8Array` (0 or 1). 1 if atom is in any ring.
     */
    atomRingMask(n_atoms: number): Uint8Array;
    /**
     * Whether atom `idx` belongs to any ring.
     */
    isAtomInRing(idx: number): boolean;
    /**
     * Number of rings containing atom `idx`.
     */
    numAtomRings(idx: number): number;
    /**
     * Size of each ring as `Uint32Array`.
     */
    ringSizes(): Uint32Array;
    /**
     * All rings as flat `Uint32Array` with length-prefixed encoding:
     * `[size0, atom0, atom1, ..., size1, atom0, atom1, ...]`.
     */
    rings(): Uint32Array;
    /**
     * Total number of rings detected.
     */
    readonly numRings: number;
}

/**
 * Owned float array with ndarray-compatible shape metadata.
 *
 * Stores a flat `Vec<F>` together with a shape descriptor (e.g.,
 * `[N, 3]` for an Nx3 coordinate matrix). Used for passing
 * multi-dimensional numeric data across the WASM boundary.
 *
 * # Memory layout
 *
 * Data is stored in row-major (C) order, matching ndarray's default
 * and JavaScript's float typed-array convention.
 *
 * # Example (JavaScript)
 *
 * ```js
 * // Create a 2x3 zero array
 * const arr = new WasmArray([2, 3]);
 * arr.writeFrom(floatArray);
 *
 * // Or from existing data
 * const arr2 = WasmArray.from(floatArray, [1, 3]);
 *
 * // Get data back
 * const copy = arr.toCopy();       // safe owned copy
 * const view = arr.toTypedArray(); // zero-copy (invalidated on alloc)
 * ```
 */
export class WasmArray {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Return the concrete float dtype string for this build.
     */
    dtype(): string;
    /**
     * Create a `WasmArray` from an existing JS float typed array.
     *
     * # Arguments
     *
     * * `data` - Source float typed array (`Float32Array` or `Float64Array`)
     * * `shape` - Optional shape. If omitted, defaults to `[data.length]` (1D).
     *
     * # Returns
     *
     * A new `WasmArray` owning a copy of the data.
     *
     * # Errors
     *
     * Throws if `shape` product does not equal `data.length`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const arr = WasmArray.from(floatArray, [2, 3]);
     * console.log(arr.shape()); // [2, 3]
     * ```
     */
    static from(data: Float64Array, shape?: Uint32Array | null): WasmArray;
    /**
     * Check whether the array contains no elements.
     */
    is_empty(): boolean;
    /**
     * Return the total number of elements (product of all shape dimensions).
     *
     * # Example (JavaScript)
     *
     * ```js
     * const arr = new WasmArray([10, 3]);
     * console.log(arr.len()); // 30
     * ```
     */
    len(): number;
    /**
     * Create a zero-initialized array with the given shape.
     *
     * The total number of elements is the product of all dimensions.
     *
     * # Arguments
     *
     * * `shape` - Array of dimension sizes (e.g., `[10, 3]` for 10 rows x 3 columns)
     *
     * # Example (JavaScript)
     *
     * ```js
     * const coords = new WasmArray([100, 3]); // 100 atoms, 3D
     * console.log(coords.len()); // 300
     * ```
     */
    constructor(shape: Uint32Array);
    /**
     * Return a raw pointer to the underlying data buffer.
     *
     * This is intended for advanced interop with other WASM modules
     * that need direct memory access. The pointer is only valid as
     * long as this `WasmArray` is alive and no WASM memory growth
     * has occurred.
     */
    ptr(): number;
    /**
     * Return a copy of the shape metadata as a JS array.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const s = arr.shape(); // e.g., [10, 3]
     * ```
     */
    shape(): Uint32Array;
    /**
     * Compute the sum of all elements.
     *
     * Primarily useful for quick sanity checks and testing.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const arr = WasmArray.from(floatArray);
     * console.log(arr.sum()); // 6.0
     * ```
     */
    sum(): number;
    /**
     * Create an owned JS float typed-array copy of the data.
     *
     * The returned array is an independent copy that is safe to store
     * and use regardless of subsequent WASM memory operations.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const copy = arr.toCopy(); // safe to keep indefinitely
     * ```
     */
    toCopy(): Float64Array;
    /**
     * Zero-copy float typed-array view over this array's backing storage.
     *
     * **Warning**: The returned view becomes **invalid** if WASM linear
     * memory grows (due to any allocation). Use [`toCopy`](WasmArray::to_copy)
     * if you need to keep the data.
     *
     * # Safety (internal)
     *
     * Uses the corresponding JS float typed-array `view` constructor,
     * which creates an unowned view into
     * WASM memory. The view must not outlive the `WasmArray` and must
     * not be used after any allocation that could trigger memory growth.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const view = arr.toTypedArray(); // use immediately
     * // Do NOT allocate between view creation and use
     * ```
     */
    toTypedArray(): Float64Array;
    /**
     * Overwrite the array contents from a JS float typed array.
     *
     * The source array must have exactly the same number of elements
     * as this `WasmArray` (i.e., the shape is preserved).
     *
     * # Arguments
     *
     * * `arr` - Source float typed array with matching length
     *
     * # Errors
     *
     * Throws if `arr.length` does not match this array's element count.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const wa = new WasmArray([3]);
     * wa.writeFrom(floatArray);
     * ```
     */
    write_from(arr: Float64Array): void;
}

/**
 * Wrapper for [`molrs_compute::kmeans::KMeans`].
 *
 * # Example (JavaScript)
 *
 * ```js
 * const km = new WasmKMeans(3, 100, 42);
 * const labels = km.fit(coords, nRows, 2);   // Int32Array
 * ```
 */
export class WasmKMeans {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Cluster a row-major `n_rows × n_dims` coordinate matrix.
     *
     * # Returns
     *
     * Cluster labels in `0..k` as an owned `Int32Array`, one per row.
     *
     * # Errors
     *
     * Throws if `k > n_rows`, `n_dims == 0`, the length does not match
     * `n_rows * n_dims`, or any element is non-finite.
     */
    fit(coords: Float64Array, n_rows: number, n_dims: number): Int32Array;
    /**
     * Create a new k-means configuration.
     *
     * # Arguments
     *
     * * `k` — number of clusters (>= 1).
     * * `max_iter` — maximum Lloyd iterations (>= 1).
     * * `seed` — RNG seed for k-means++ initialization. Cast to `u64`
     *   internally (JS numbers are `f64`; integers up to 2^53 pass
     *   through losslessly).
     *
     * # Errors
     *
     * Throws if `k == 0` or `max_iter == 0`.
     */
    constructor(k: number, max_iter: number, seed: number);
}

/**
 * Stateless wrapper for [`molrs_compute::pca::Pca2`].
 *
 * All configuration lives on [`fitTransform`](Self::fit_transform).
 *
 * # Example (JavaScript)
 *
 * ```js
 * const pca = new WasmPca2();
 * const result = pca.fitTransform(matrix, nRows, nCols);
 * const coords   = result.coords();    // Float64Array, length 2 * nRows
 * const variance = result.variance();  // Float64Array, length 2
 * ```
 */
export class WasmPca2 {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Fit 2-component PCA on a row-major observation matrix and return the
     * projected coordinates + per-component variance.
     *
     * # Arguments
     *
     * * `matrix` — row-major `n_rows × n_cols` observation matrix.
     * * `n_rows` — number of observations.
     * * `n_cols` — number of features.
     *
     * # Errors
     *
     * Throws if `n_rows < 3`, `n_cols < 2`, the length does not match
     * `n_rows * n_cols`, any element is non-finite, or any column has
     * zero variance.
     */
    fitTransform(matrix: Float64Array, n_rows: number, n_cols: number): WasmPcaResult;
    /**
     * Create a new PCA calculator. The struct carries no state — all
     * parameters are supplied on [`fitTransform`](Self::fit_transform).
     */
    constructor();
}

/**
 * Result of a [`WasmPca2::fit_transform`] call.
 *
 * Each accessor returns an **owned** `Float64Array` (copy of the underlying
 * `Vec`) so JS is free to let this wrapper be GC'd without dangling views.
 */
export class WasmPcaResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Projected 2D coordinates as a row-major `Float64Array` of length
     * `2 * n_rows`. `coords[2 * i + 0]` is the PC1 score for row `i`,
     * `coords[2 * i + 1]` is PC2.
     */
    coords(): Float64Array;
    /**
     * Explained variance per component as `Float64Array` of length 2.
     * `variance[0] >= variance[1]` by construction.
     */
    variance(): Float64Array;
}

/**
 * XYZ / Extended XYZ file reader.
 *
 * Supports multi-frame trajectory files. Each frame produces a
 * [`Frame`] with an `"atoms"` block containing `element` (string)
 * and `x`, `y`, `z` (F, coordinates in angstrom) columns.
 *
 * # Example (JavaScript)
 *
 * ```js
 * const content = await file.text(); // read file in browser
 * const reader = new XYZReader(content);
 * console.log(reader.len()); // number of frames
 *
 * const frame = reader.read(0); // first frame
 * const atoms = frame.getBlock("atoms");
 * const x = atoms.copyColF("x");
 * ```
 */
export class XYZReader {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Check whether the file contains no frames.
     *
     * # Errors
     *
     * Throws a `JsValue` string if the file cannot be scanned.
     */
    isEmpty(): boolean;
    /**
     * Return the number of frames in the file.
     *
     * # Returns
     *
     * The total frame count.
     *
     * # Errors
     *
     * Throws a `JsValue` string if the file cannot be scanned.
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(reader.len()); // e.g., 100
     * ```
     */
    len(): number;
    /**
     * Create a new XYZ reader from a string containing the file content.
     *
     * # Arguments
     *
     * * `content` - The full text content of an XYZ or Extended XYZ file
     *
     * # Example (JavaScript)
     *
     * ```js
     * const reader = new XYZReader(fileContent);
     * ```
     */
    constructor(content: string);
    /**
     * Read a frame at the given step index.
     *
     * # Arguments
     *
     * * `step` - Zero-based frame index
     *
     * # Returns
     *
     * A [`Frame`] if the step exists, or `undefined` if `step` is
     * out of range.
     *
     * # Errors
     *
     * Throws a `JsValue` string on parse errors.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const frame = reader.read(0);
     * if (frame) {
     *   const atoms = frame.getBlock("atoms");
     * }
     * ```
     */
    read(step: number): Frame | undefined;
}

/**
 * Generate 3D coordinates for a molecular [`Frame`].
 *
 * The input frame must have an `"atoms"` block with a `"element"`
 * string column (element symbols like `"C"`, `"N"`, `"O"`). A
 * `"bonds"` block with `i`, `j` (u32) and `order` (F) columns
 * is required for correct geometry.
 *
 * Returns a **new** [`Frame`] with 3D coordinates added as `x`, `y`,
 * `z` (F, angstrom) columns in the `"atoms"` block.
 *
 * # Arguments
 *
 * * `frame` - Input molecular frame with atoms and bonds (from
 *   [`parseSMILES`](crate::parse_smiles) or file readers)
 * * `speed` - Quality/speed preset:
 *   - `"fast"` -- minimal refinement, suitable for visualization
 *   - `"medium"` (default) -- balanced quality/speed
 *   - `"better"` -- thorough conformer search, best geometry
 * * `seed` - Optional RNG seed (`u32`) for reproducibility. If
 *   omitted, a random seed is used.
 *
 * # Returns
 *
 * A new [`Frame`] with 3D coordinates. The original frame is
 * not modified.
 *
 * # Errors
 *
 * Throws a `JsValue` string if:
 * - The frame has no `"atoms"` block or is missing required columns
 * - The molecular graph has invalid valences or topology
 * - The 3D embedding fails to converge
 *
 * # Example (JavaScript)
 *
 * ```js
 * const ir = parseSMILES("c1ccccc1"); // benzene
 * const frame2d = ir.toFrame();
 * const frame3d = generate3D(frame2d, "fast", 42);
 *
 * const atoms = frame3d.getBlock("atoms");
 * const x = atoms.copyColF("x"); // Float32Array or Float64Array with 3D x-coords
 * const y = atoms.copyColF("y");
 * const z = atoms.copyColF("z");
 * ```
 */
export function generate3D(frame: Frame, speed?: string | null, seed?: number | null): Frame;

/**
 * Parse a SMILES notation string into an intermediate representation.
 *
 * Supports standard SMILES features including ring closures,
 * branching, stereochemistry markers, and aromatic atoms.
 *
 * # Arguments
 *
 * * `smiles` - SMILES notation string (e.g., `"CCO"` for ethanol,
 *   `"c1ccccc1"` for benzene, `"[Na+].[Cl-]"` for NaCl)
 *
 * # Returns
 *
 * A [`SmilesIR`](WasmSmilesIR) object. Call `.toFrame()` to convert
 * to a [`Frame`] with atoms and bonds blocks.
 *
 * # Errors
 *
 * Throws a `JsValue` string if the SMILES string is malformed
 * (e.g., unmatched ring closure digits, invalid atom symbols).
 *
 * # Example (JavaScript)
 *
 * ```js
 * const ir = parseSMILES("CCO");
 * const frame = ir.toFrame();
 * const mol3d = generate3D(frame, "fast");
 * ```
 */
export function parseSMILES(smiles: string): SmilesIR;

/**
 * WASM module entry point. Installs the panic hook so that Rust panics
 * are forwarded to the browser console as readable stack traces.
 */
export function start(): void;

/**
 * Return a handle to the WASM linear memory.
 *
 * Useful for advanced interop where JS code needs direct access to the
 * WASM memory buffer (e.g., for zero-copy typed-array views).
 *
 * # Example (JavaScript)
 *
 * ```js
 * const mem = wasmMemory();
 * const buf = new Float64Array(mem.buffer, ptr, len); // or Float32Array in default builds
 * ```
 */
export function wasmMemory(): WebAssembly.Memory;

/**
 * Serialize a [`Frame`] to a string in the specified format.
 *
 * The frame must have an `"atoms"` block with at least an element/name
 * string column and `x`, `y`, `z` float columns (coordinates in
 * angstrom).
 *
 * # Arguments
 *
 * * `frame` - The [`Frame`] to write
 * * `format` - Output format string: `"xyz"` or `"pdb"`
 *   (case-insensitive)
 *
 * # Returns
 *
 * The formatted file content as a string.
 *
 * # Errors
 *
 * Throws a `JsValue` string if:
 * - The format is not recognized
 * - The frame is missing required columns
 * - The writer encounters an error
 *
 * # Example (JavaScript)
 *
 * ```js
 * const xyzStr = writeFrame(frame, "xyz");
 * console.log(xyzStr);
 * // 2
 * //
 * // H  0.000000  0.000000  0.000000
 * // O  1.000000  0.000000  0.500000
 *
 * const pdbStr = writeFrame(frame, "pdb");
 * // download or display the PDB string
 * ```
 */
export function writeFrame(frame: Frame, format: string): string;
