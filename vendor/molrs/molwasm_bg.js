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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Block.prototype);
        obj.__wbg_ptr = ptr;
        BlockFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BlockFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_block_free(ptr, 0);
    }
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
     * @param {string} key
     * @returns {Float64Array}
     */
    copyColF(key) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.block_copyColF(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
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
     * @param {string} key
     * @returns {Int32Array}
     */
    copyColI32(key) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.block_copyColI32(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
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
     * @param {string} key
     * @returns {Array<any>}
     */
    copyColStr(key) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.block_copyColStr(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
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
     * @param {string} key
     * @returns {Uint32Array}
     */
    copyColU32(key) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.block_copyColU32(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
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
     * @param {string} key
     * @returns {string | undefined}
     */
    dtype(key) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.block_dtype(this.__wbg_ptr, ptr0, len0);
        let v2;
        if (ret[0] !== 0) {
            v2 = getStringFromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free_command_export(ret[0], ret[1] * 1, 1);
        }
        return v2;
    }
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
     * @returns {boolean}
     */
    isEmpty() {
        const ret = wasm.block_isEmpty(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
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
     * @returns {Array<any>}
     */
    keys() {
        const ret = wasm.block_keys(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
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
     * @returns {number}
     */
    len() {
        const ret = wasm.block_len(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
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
    constructor() {
        const ret = wasm.block_new();
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        BlockFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
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
     * @returns {number}
     */
    nrows() {
        const ret = wasm.block_nrows(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
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
     * @param {string} old_key
     * @param {string} new_key
     * @returns {boolean}
     */
    renameColumn(old_key, new_key) {
        const ptr0 = passStringToWasm0(old_key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(new_key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.block_renameColumn(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
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
     * @param {string} key
     * @param {Float64Array} data
     * @param {Uint32Array | null} [shape]
     */
    setColF(key, data, shape) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(shape) ? 0 : passArray32ToWasm0(shape, wasm.__wbindgen_malloc_command_export);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.block_setColF(this.__wbg_ptr, ptr0, len0, data, ptr1, len1);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @param {string} key
     * @param {Int32Array} data
     */
    setColI32(key, data) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.block_setColI32(this.__wbg_ptr, ptr0, len0, data);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @param {string} key
     * @param {Array<any>} data
     */
    setColStr(key, data) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.block_setColStr(this.__wbg_ptr, ptr0, len0, data);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @param {string} key
     * @param {Uint32Array} data
     */
    setColU32(key, data) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.block_setColU32(this.__wbg_ptr, ptr0, len0, data);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @param {string} key
     * @returns {Float64Array}
     */
    viewColF(key) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.block_viewColF(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
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
     * @param {string} key
     * @returns {Int32Array}
     */
    viewColI32(key) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.block_viewColI32(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
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
     * @param {string} key
     * @returns {Uint32Array}
     */
    viewColU32(key) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.block_viewColU32(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
}
if (Symbol.dispose) Block.prototype[Symbol.dispose] = Block.prototype.free;

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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Box.prototype);
        obj.__wbg_ptr = ptr;
        BoxFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BoxFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_box_free(ptr, 0);
    }
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
     * @param {number} a
     * @param {Float64Array} origin
     * @param {boolean} pbc_x
     * @param {boolean} pbc_y
     * @param {boolean} pbc_z
     * @returns {Box}
     */
    static cube(a, origin, pbc_x, pbc_y, pbc_z) {
        const ret = wasm.box_cube(a, origin, pbc_x, pbc_y, pbc_z);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Box.__wrap(ret[0]);
    }
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
     * @param {WasmArray} a
     * @param {WasmArray} b
     * @param {boolean} minimum_image
     * @returns {WasmArray}
     */
    delta(a, b, minimum_image) {
        _assertClass(a, WasmArray);
        _assertClass(b, WasmArray);
        const ret = wasm.box_delta(this.__wbg_ptr, a.__wbg_ptr, b.__wbg_ptr, minimum_image);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmArray.__wrap(ret[0]);
    }
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
     * @param {WasmArray} a
     * @param {WasmArray} b
     * @param {boolean} minimum_image
     * @param {Block} out_block
     * @param {string} out_key
     */
    deltaToBlock(a, b, minimum_image, out_block, out_key) {
        _assertClass(a, WasmArray);
        _assertClass(b, WasmArray);
        _assertClass(out_block, Block);
        const ptr0 = passStringToWasm0(out_key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.box_deltaToBlock(this.__wbg_ptr, a.__wbg_ptr, b.__wbg_ptr, minimum_image, out_block.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @returns {WasmArray}
     */
    get_corners() {
        const ret = wasm.box_get_corners(this.__wbg_ptr);
        return WasmArray.__wrap(ret);
    }
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
     * @returns {WasmArray}
     */
    lengths() {
        const ret = wasm.box_lengths(this.__wbg_ptr);
        return WasmArray.__wrap(ret);
    }
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
     * @param {Float64Array} h
     * @param {Float64Array} origin
     * @param {boolean} pbc_x
     * @param {boolean} pbc_y
     * @param {boolean} pbc_z
     */
    constructor(h, origin, pbc_x, pbc_y, pbc_z) {
        const ret = wasm.box_new(h, origin, pbc_x, pbc_y, pbc_z);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        BoxFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
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
     * @returns {WasmArray}
     */
    origin() {
        const ret = wasm.box_origin(this.__wbg_ptr);
        return WasmArray.__wrap(ret);
    }
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
     * @param {Float64Array} lengths
     * @param {Float64Array} origin
     * @param {boolean} pbc_x
     * @param {boolean} pbc_y
     * @param {boolean} pbc_z
     * @returns {Box}
     */
    static ortho(lengths, origin, pbc_x, pbc_y, pbc_z) {
        const ret = wasm.box_ortho(lengths, origin, pbc_x, pbc_y, pbc_z);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Box.__wrap(ret[0]);
    }
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
     * @returns {WasmArray}
     */
    tilts() {
        const ret = wasm.box_tilts(this.__wbg_ptr);
        return WasmArray.__wrap(ret);
    }
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
     * @param {WasmArray} coords
     * @param {Block} out_block
     * @param {string} out_key
     */
    toCartToBlock(coords, out_block, out_key) {
        _assertClass(coords, WasmArray);
        _assertClass(out_block, Block);
        const ptr0 = passStringToWasm0(out_key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.box_toCartToBlock(this.__wbg_ptr, coords.__wbg_ptr, out_block.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @param {WasmArray} coords
     * @param {Block} out_block
     * @param {string} out_key
     */
    toFracToBlock(coords, out_block, out_key) {
        _assertClass(coords, WasmArray);
        _assertClass(out_block, Block);
        const ptr0 = passStringToWasm0(out_key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.box_toFracToBlock(this.__wbg_ptr, coords.__wbg_ptr, out_block.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @param {WasmArray} coords
     * @returns {WasmArray}
     */
    to_cart(coords) {
        _assertClass(coords, WasmArray);
        const ret = wasm.box_to_cart(this.__wbg_ptr, coords.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmArray.__wrap(ret[0]);
    }
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
     * @param {WasmArray} coords
     * @returns {WasmArray}
     */
    to_frac(coords) {
        _assertClass(coords, WasmArray);
        const ret = wasm.box_to_frac(this.__wbg_ptr, coords.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmArray.__wrap(ret[0]);
    }
    /**
     * Return the box volume in cubic angstrom (A^3).
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(box.volume()); // e.g., 1000.0
     * ```
     * @returns {number}
     */
    volume() {
        const ret = wasm.box_volume(this.__wbg_ptr);
        return ret;
    }
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
     * @param {WasmArray} coords
     * @returns {WasmArray}
     */
    wrap(coords) {
        _assertClass(coords, WasmArray);
        const ret = wasm.box_wrap(this.__wbg_ptr, coords.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmArray.__wrap(ret[0]);
    }
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
     * @param {WasmArray} coords
     * @param {Block} out_block
     * @param {string} out_key
     */
    wrapToBlock(coords, out_block, out_key) {
        _assertClass(coords, WasmArray);
        _assertClass(out_block, Block);
        const ptr0 = passStringToWasm0(out_key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.box_wrapToBlock(this.__wbg_ptr, coords.__wbg_ptr, out_block.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
}
if (Symbol.dispose) Box.prototype[Symbol.dispose] = Box.prototype.free;

/**
 * Mass-weighted cluster center calculator.
 */
export class CenterOfMass {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CenterOfMassFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_centerofmass_free(ptr, 0);
    }
    /**
     * Compute centers of mass.
     * @param {Frame} frame
     * @param {ClusterResult} cluster_result
     * @returns {CenterOfMassResult}
     */
    compute(frame, cluster_result) {
        _assertClass(frame, Frame);
        _assertClass(cluster_result, ClusterResult);
        const ret = wasm.centerofmass_compute(this.__wbg_ptr, frame.__wbg_ptr, cluster_result.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return CenterOfMassResult.__wrap(ret[0]);
    }
    /**
     * Create a center-of-mass calculator.
     *
     * Pass `null` for uniform masses, or a float typed array of per-particle masses.
     * @param {Float64Array | null} [masses]
     */
    constructor(masses) {
        var ptr0 = isLikeNone(masses) ? 0 : passArrayF64ToWasm0(masses, wasm.__wbindgen_malloc_command_export);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.centerofmass_new(ptr0, len0);
        this.__wbg_ptr = ret >>> 0;
        CenterOfMassFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) CenterOfMass.prototype[Symbol.dispose] = CenterOfMass.prototype.free;

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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(CenterOfMassResult.prototype);
        obj.__wbg_ptr = ptr;
        CenterOfMassResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CenterOfMassResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_centerofmassresult_free(ptr, 0);
    }
    /**
     * Zero-copy `Float64Array` view of mass-weighted centers, flat
     * `[x0,y0,z0, x1,y1,z1, ...]`. **Invalidated** on WASM memory growth.
     * @returns {Float64Array}
     */
    centersOfMass() {
        const ret = wasm.centerofmassresult_centersOfMass(this.__wbg_ptr);
        return ret;
    }
    /**
     * Zero-copy `Float64Array` view of total mass per cluster.
     * **Invalidated** on WASM memory growth.
     * @returns {Float64Array}
     */
    clusterMasses() {
        const ret = wasm.centerofmassresult_clusterMasses(this.__wbg_ptr);
        return ret;
    }
    /**
     * Number of clusters.
     * @returns {number}
     */
    get numClusters() {
        const ret = wasm.centerofmassresult_numClusters(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) CenterOfMassResult.prototype[Symbol.dispose] = CenterOfMassResult.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ClusterFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_cluster_free(ptr, 0);
    }
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
     * @param {Frame} frame
     * @param {NeighborList} neighbors
     * @returns {ClusterResult}
     */
    compute(frame, neighbors) {
        _assertClass(frame, Frame);
        _assertClass(neighbors, NeighborList);
        const ret = wasm.cluster_compute(this.__wbg_ptr, frame.__wbg_ptr, neighbors.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ClusterResult.__wrap(ret[0]);
    }
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
     * @param {number} min_cluster_size
     */
    constructor(min_cluster_size) {
        const ret = wasm.cluster_new(min_cluster_size);
        this.__wbg_ptr = ret >>> 0;
        ClusterFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) Cluster.prototype[Symbol.dispose] = Cluster.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ClusterCentersFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_clustercenters_free(ptr, 0);
    }
    /**
     * Compute geometric centers. Returns a flat float typed array `[x0,y0,z0, ...]`.
     * @param {Frame} frame
     * @param {ClusterResult} cluster_result
     * @returns {Float64Array}
     */
    compute(frame, cluster_result) {
        _assertClass(frame, Frame);
        _assertClass(cluster_result, ClusterResult);
        const ret = wasm.clustercenters_compute(this.__wbg_ptr, frame.__wbg_ptr, cluster_result.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 8, 8);
        return v1;
    }
    constructor() {
        const ret = wasm.clustercenters_new();
        this.__wbg_ptr = ret >>> 0;
        ClusterCentersFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) ClusterCenters.prototype[Symbol.dispose] = ClusterCenters.prototype.free;

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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(ClusterResult.prototype);
        obj.__wbg_ptr = ptr;
        ClusterResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ClusterResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_clusterresult_free(ptr, 0);
    }
    /**
     * Per-particle cluster ID assignment as `Int32Array`.
     *
     * `clusterIdx()[i]` is the cluster ID for particle `i`.
     * Particles in clusters smaller than `minClusterSize` are
     * assigned ID = -1 (filtered out).
     *
     * Cluster IDs are zero-based and contiguous: `0, 1, ..., numClusters-1`.
     * @returns {Int32Array}
     */
    clusterIdx() {
        const ret = wasm.clusterresult_clusterIdx(this.__wbg_ptr);
        var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Size (particle count) of each valid cluster as `Uint32Array`.
     *
     * `clusterSizes()[c]` is the number of particles in cluster `c`.
     * Length equals `numClusters`.
     * @returns {Uint32Array}
     */
    clusterSizes() {
        const ret = wasm.clusterresult_clusterSizes(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Number of valid clusters found (after min-size filtering).
     * @returns {number}
     */
    get numClusters() {
        const ret = wasm.clusterresult_numClusters(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) ClusterResult.prototype[Symbol.dispose] = ClusterResult.prototype.free;

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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Frame.prototype);
        obj.__wbg_ptr = ptr;
        FrameFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FrameFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_frame_free(ptr, 0);
    }
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
    clear() {
        const ret = wasm.frame_clear(this.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @param {string} key
     * @returns {Block}
     */
    createBlock(key) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.frame_createBlock(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Block.__wrap(ret[0]);
    }
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
    drop() {
        const ret = wasm.frame_drop(this.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @param {string} key
     * @returns {Block | undefined}
     */
    getBlock(key) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.frame_getBlock(this.__wbg_ptr, ptr0, len0);
        return ret === 0 ? undefined : Block.__wrap(ret);
    }
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
     * @param {string} name
     * @returns {Grid | undefined}
     */
    getGrid(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.frame_getGrid(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] === 0 ? undefined : Grid.__wrap(ret[0]);
    }
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
     * @param {string} name
     * @returns {number | undefined}
     */
    getMetaScalar(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.frame_getMetaScalar(this.__wbg_ptr, ptr0, len0);
        return ret[0] === 0 ? undefined : ret[1];
    }
    /**
     * Return the names of all grids attached to this frame.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const names = frame.gridNames(); // e.g. ["chgcar", "spin"]
     * ```
     * @returns {Array<any>}
     */
    gridNames() {
        const ret = wasm.frame_gridNames(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
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
     * @param {string} name
     * @returns {boolean}
     */
    hasGrid(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.frame_hasGrid(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
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
     * @param {string} key
     * @param {Block} block
     */
    insertBlock(key, block) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        _assertClass(block, Block);
        var ptr1 = block.__destroy_into_raw();
        const ret = wasm.frame_insertBlock(this.__wbg_ptr, ptr0, len0, ptr1);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @param {string} name
     * @param {Grid} grid
     */
    insertGrid(name, grid) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        _assertClass(grid, Grid);
        var ptr1 = grid.__destroy_into_raw();
        const ret = wasm.frame_insertGrid(this.__wbg_ptr, ptr0, len0, ptr1);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @returns {string[]}
     */
    metaNames() {
        const ret = wasm.frame_metaNames(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Create a new, empty `Frame` with no blocks and no simulation box.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const frame = new Frame();
     * ```
     */
    constructor() {
        const ret = wasm.frame_new();
        this.__wbg_ptr = ret >>> 0;
        FrameFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
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
     * @param {string} key
     */
    removeBlock(key) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.frame_removeBlock(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @param {string} name
     */
    removeGrid(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.frame_removeGrid(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @param {string} old_key
     * @param {string} new_key
     * @returns {boolean}
     */
    renameBlock(old_key, new_key) {
        const ptr0 = passStringToWasm0(old_key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(new_key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.frame_renameBlock(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
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
     * @param {string} block_key
     * @param {string} old_col
     * @param {string} new_col
     * @returns {boolean}
     */
    renameColumn(block_key, old_col, new_col) {
        const ptr0 = passStringToWasm0(block_key, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(old_col, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(new_col, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.frame_renameColumn(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
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
     * @param {string} name
     * @param {string} value
     */
    setMeta(name, value) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(value, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.frame_setMeta(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @param {Box | null} [simbox]
     */
    set simbox(simbox) {
        let ptr0 = 0;
        if (!isLikeNone(simbox)) {
            _assertClass(simbox, Box);
            ptr0 = simbox.__destroy_into_raw();
        }
        const ret = wasm.frame_set_simbox(this.__wbg_ptr, ptr0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @returns {Box | undefined}
     */
    get simbox() {
        const ret = wasm.frame_simbox(this.__wbg_ptr);
        return ret === 0 ? undefined : Box.__wrap(ret);
    }
}
if (Symbol.dispose) Frame.prototype[Symbol.dispose] = Frame.prototype.free;

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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Grid.prototype);
        obj.__wbg_ptr = ptr;
        GridFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        GridFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_grid_free(ptr, 0);
    }
    /**
     * Names of all scalar arrays stored in this grid.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const names = grid.arrayNames(); // e.g. ["rho", "spin"]
     * ```
     * @returns {Array<any>}
     */
    arrayNames() {
        const ret = wasm.grid_arrayNames(this.__wbg_ptr);
        return ret;
    }
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
     * @returns {WasmArray}
     */
    cell() {
        const ret = wasm.grid_cell(this.__wbg_ptr);
        return WasmArray.__wrap(ret);
    }
    /**
     * Grid dimensions `[nx, ny, nz]`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(grid.dim()); // [10, 10, 10]
     * ```
     * @returns {Uint32Array}
     */
    dim() {
        const ret = wasm.grid_dim(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 4, 4);
        return v1;
    }
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
     * @param {string} name
     * @returns {Float64Array | undefined}
     */
    getArray(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.grid_getArray(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
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
     * @param {string} name
     * @returns {boolean}
     */
    hasArray(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.grid_hasArray(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
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
     * @param {string} name
     * @param {Float64Array} data
     */
    insertArray(name, data) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF64ToWasm0(data, wasm.__wbindgen_malloc_command_export);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.grid_insertArray(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Returns `true` if no arrays are stored.
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(grid.isEmpty()); // true for a freshly created grid
     * ```
     * @returns {boolean}
     */
    isEmpty() {
        const ret = wasm.grid_isEmpty(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Number of named arrays stored in this grid.
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(grid.len()); // e.g. 2
     * ```
     * @returns {number}
     */
    len() {
        const ret = wasm.grid_len(this.__wbg_ptr);
        return ret >>> 0;
    }
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
     * @param {number} dim_x
     * @param {number} dim_y
     * @param {number} dim_z
     * @param {Float64Array} origin
     * @param {Float64Array} cell
     * @param {boolean} pbc_x
     * @param {boolean} pbc_y
     * @param {boolean} pbc_z
     */
    constructor(dim_x, dim_y, dim_z, origin, cell, pbc_x, pbc_y, pbc_z) {
        const ptr0 = passArrayF64ToWasm0(origin, wasm.__wbindgen_malloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF64ToWasm0(cell, wasm.__wbindgen_malloc_command_export);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.grid_new(dim_x, dim_y, dim_z, ptr0, len0, ptr1, len1, pbc_x, pbc_y, pbc_z);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        GridFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Cartesian origin in Ångström as a 1-D array of length 3.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const o = grid.origin();
     * const arr = o.toCopy(); // Float32Array [ox, oy, oz]
     * ```
     * @returns {WasmArray}
     */
    origin() {
        const ret = wasm.grid_origin(this.__wbg_ptr);
        return WasmArray.__wrap(ret);
    }
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
     * @returns {Uint8Array}
     */
    pbc() {
        const ret = wasm.grid_pbc(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Total number of voxels: `nx * ny * nz`.
     *
     * # Example (JavaScript)
     *
     * ```js
     * console.log(grid.total()); // 1000 for a 10×10×10 grid
     * ```
     * @returns {number}
     */
    total() {
        const ret = wasm.grid_total(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) Grid.prototype[Symbol.dispose] = Grid.prototype.free;

/**
 * Gyration tensor per cluster.
 *
 * Returns flat array: `[g00,g01,g02, g10,g11,g12, g20,g21,g22, ...]` per cluster.
 */
export class GyrationTensor {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        GyrationTensorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_gyrationtensor_free(ptr, 0);
    }
    /**
     * Compute gyration tensors. Returns a flat float typed array (9 values per cluster).
     *
     * Internally computes the cluster geometric centers (via
     * [`RsClusterCenters`]) since the new compute trait exposes them as a
     * required upstream — the old single-frame wasm API hides this detail.
     * @param {Frame} frame
     * @param {ClusterResult} cluster_result
     * @returns {Float64Array}
     */
    compute(frame, cluster_result) {
        _assertClass(frame, Frame);
        _assertClass(cluster_result, ClusterResult);
        const ret = wasm.gyrationtensor_compute(this.__wbg_ptr, frame.__wbg_ptr, cluster_result.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 8, 8);
        return v1;
    }
    constructor() {
        const ret = wasm.gyrationtensor_new();
        this.__wbg_ptr = ret >>> 0;
        GyrationTensorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) GyrationTensor.prototype[Symbol.dispose] = GyrationTensor.prototype.free;

/**
 * Moment of inertia tensor per cluster.
 */
export class InertiaTensor {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        InertiaTensorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_inertiatensor_free(ptr, 0);
    }
    /**
     * Compute inertia tensors. Returns a flat float typed array (9 values per cluster).
     *
     * Internally computes the cluster centers of mass (via
     * [`RsCenterOfMass`]) since the new compute trait consumes them as a
     * required upstream — the old single-frame wasm API hides this detail.
     * @param {Frame} frame
     * @param {ClusterResult} cluster_result
     * @returns {Float64Array}
     */
    compute(frame, cluster_result) {
        _assertClass(frame, Frame);
        _assertClass(cluster_result, ClusterResult);
        const ret = wasm.inertiatensor_compute(this.__wbg_ptr, frame.__wbg_ptr, cluster_result.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * @param {Float64Array | null} [masses]
     */
    constructor(masses) {
        var ptr0 = isLikeNone(masses) ? 0 : passArrayF64ToWasm0(masses, wasm.__wbindgen_malloc_command_export);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.inertiatensor_new(ptr0, len0);
        this.__wbg_ptr = ret >>> 0;
        InertiaTensorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) InertiaTensor.prototype[Symbol.dispose] = InertiaTensor.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        LAMMPSDumpReaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_lammpsdumpreader_free(ptr, 0);
    }
    /**
     * Check whether the file contains no frames.
     * @returns {boolean}
     */
    isEmpty() {
        const ret = wasm.lammpsdumpreader_isEmpty(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Return the number of frames in the dump file.
     * @returns {number}
     */
    len() {
        const ret = wasm.lammpsdumpreader_len(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
    /**
     * Create a new LAMMPS dump reader from string content.
     * @param {string} content
     */
    constructor(content) {
        const ptr0 = passStringToWasm0(content, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.lammpsdumpreader_new(ptr0, len0);
        this.__wbg_ptr = ret >>> 0;
        LAMMPSDumpReaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Read a frame at the given step index.
     * @param {number} step
     * @returns {Frame | undefined}
     */
    read(step) {
        const ret = wasm.lammpsdumpreader_read(this.__wbg_ptr, step);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] === 0 ? undefined : Frame.__wrap(ret[0]);
    }
}
if (Symbol.dispose) LAMMPSDumpReader.prototype[Symbol.dispose] = LAMMPSDumpReader.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        LAMMPSReaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_lammpsreader_free(ptr, 0);
    }
    /**
     * Check whether the file contains no valid frames.
     *
     * # Errors
     *
     * Throws a `JsValue` string on parse errors.
     * @returns {boolean}
     */
    isEmpty() {
        const ret = wasm.lammpsreader_isEmpty(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Return the number of frames (always 0 or 1 for LAMMPS data files).
     *
     * # Errors
     *
     * Throws a `JsValue` string on parse errors.
     * @returns {number}
     */
    len() {
        const ret = wasm.lammpsreader_len(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
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
     * @param {string} content
     */
    constructor(content) {
        const ptr0 = passStringToWasm0(content, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.lammpsreader_new(ptr0, len0);
        this.__wbg_ptr = ret >>> 0;
        LAMMPSReaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
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
     * @param {number} step
     * @returns {Frame | undefined}
     */
    read(step) {
        const ret = wasm.lammpsreader_read(this.__wbg_ptr, step);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] === 0 ? undefined : Frame.__wrap(ret[0]);
    }
}
if (Symbol.dispose) LAMMPSReader.prototype[Symbol.dispose] = LAMMPSReader.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        LinkedCellFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_linkedcell_free(ptr, 0);
    }
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
     * @param {Frame} frame
     * @returns {NeighborList}
     */
    build(frame) {
        _assertClass(frame, Frame);
        const ret = wasm.linkedcell_build(this.__wbg_ptr, frame.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return NeighborList.__wrap(ret[0]);
    }
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
     * @param {number} cutoff
     */
    constructor(cutoff) {
        const ret = wasm.linkedcell_new(cutoff);
        this.__wbg_ptr = ret >>> 0;
        LinkedCellFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
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
     * @param {Frame} ref_frame
     * @param {Frame} query_frame
     * @returns {NeighborList}
     */
    query(ref_frame, query_frame) {
        _assertClass(ref_frame, Frame);
        _assertClass(query_frame, Frame);
        const ret = wasm.linkedcell_query(this.__wbg_ptr, ref_frame.__wbg_ptr, query_frame.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return NeighborList.__wrap(ret[0]);
    }
}
if (Symbol.dispose) LinkedCell.prototype[Symbol.dispose] = LinkedCell.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MSDFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_msd_free(ptr, 0);
    }
    /**
     * Number of frames accumulated.
     * @returns {number}
     */
    get count() {
        const ret = wasm.msd_count(this.__wbg_ptr);
        return ret >>> 0;
    }
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
     * @param {Frame} frame
     */
    feed(frame) {
        _assertClass(frame, Frame);
        const ret = wasm.msd_feed(this.__wbg_ptr, frame.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
    constructor() {
        const ret = wasm.msd_new();
        this.__wbg_ptr = ret >>> 0;
        MSDFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Reset the analysis, clearing the trajectory buffer.
     */
    reset() {
        wasm.msd_reset(this.__wbg_ptr);
    }
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
     * @returns {MSDResult[]}
     */
    results() {
        const ret = wasm.msd_results(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 4, 4);
        return v1;
    }
}
if (Symbol.dispose) MSD.prototype[Symbol.dispose] = MSD.prototype.free;

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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(MSDResult.prototype);
        obj.__wbg_ptr = ptr;
        MSDResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MSDResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_msdresult_free(ptr, 0);
    }
    /**
     * System-average mean squared displacement in A^2.
     *
     * This is the arithmetic mean of all per-particle squared
     * displacements: `mean = sum(|r_i(t) - r_i(0)|^2) / N`.
     * @returns {number}
     */
    get mean() {
        const ret = wasm.msdresult_mean(this.__wbg_ptr);
        return ret;
    }
    /**
     * Zero-copy `Float64Array` view of per-particle squared displacements
     * in A². `perParticle()[i]` is `|r_i(t) - r_i(0)|²` for particle `i`.
     * **Invalidated** on WASM memory growth; copy in JS if needed.
     * @returns {Float64Array}
     */
    perParticle() {
        const ret = wasm.msdresult_perParticle(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) MSDResult.prototype[Symbol.dispose] = MSDResult.prototype.free;

/**
 * Reader for MolRec Zarr v3 archives.
 */
export class MolRecReader {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MolRecReaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_molrecreader_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    countAtoms() {
        const ret = wasm.molrecreader_countAtoms(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    countFrames() {
        const ret = wasm.molrecreader_countFrames(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
    free() {
        wasm.molrecreader_free(this.__wbg_ptr);
    }
    /**
     * @param {Map<any, any>} files
     */
    constructor(files) {
        const ret = wasm.molrecreader_new(files);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        MolRecReaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} t
     * @returns {Frame | undefined}
     */
    readFrame(t) {
        const ret = wasm.molrecreader_readFrame(this.__wbg_ptr, t);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] === 0 ? undefined : Frame.__wrap(ret[0]);
    }
}
if (Symbol.dispose) MolRecReader.prototype[Symbol.dispose] = MolRecReader.prototype.free;

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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(NeighborList.prototype);
        obj.__wbg_ptr = ptr;
        NeighborListFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        NeighborListFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_neighborlist_free(ptr, 0);
    }
    /**
     * Zero-copy `Float64Array` view of squared pairwise distances in A^2.
     * Same invalidation caveat as [`queryPointIndices`](Self::query_point_indices).
     * @returns {Float64Array}
     */
    distSq() {
        const ret = wasm.neighborlist_distSq(this.__wbg_ptr);
        return ret;
    }
    /**
     * Pairwise distances in angstrom (A). Computed lazily from `distSq`.
     *
     * Returns an owned copy because distances are derived on the fly
     * (`sqrt` per pair) rather than stored.
     * @returns {Float64Array}
     */
    distances() {
        const ret = wasm.neighborlist_distances(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Whether this result came from a self-query (`build()`).
     *
     * In self-queries, only unique pairs `(i < j)` are reported.
     * @returns {boolean}
     */
    get isSelfQuery() {
        const ret = wasm.neighborlist_isSelfQuery(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Total number of neighbor pairs found.
     * @returns {number}
     */
    get numPairs() {
        const ret = wasm.neighborlist_numPairs(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Number of reference (target) points in the search.
     * @returns {number}
     */
    get numPoints() {
        const ret = wasm.neighborlist_numPoints(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Number of query points in the search.
     *
     * For self-queries, this equals `numPoints`.
     * @returns {number}
     */
    get numQueryPoints() {
        const ret = wasm.neighborlist_numQueryPoints(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Zero-copy `Uint32Array` view of reference point indices (`j`).
     * Same invalidation caveat as [`queryPointIndices`](Self::query_point_indices).
     * @returns {Uint32Array}
     */
    pointIndices() {
        const ret = wasm.neighborlist_pointIndices(this.__wbg_ptr);
        return ret;
    }
    /**
     * Zero-copy `Uint32Array` view of query point indices (`i`) over
     * WASM memory. **Invalidated** on any WASM memory growth — copy
     * in JS (`new Uint32Array(view)`) if it needs to outlive later calls.
     * @returns {Uint32Array}
     */
    queryPointIndices() {
        const ret = wasm.neighborlist_queryPointIndices(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) NeighborList.prototype[Symbol.dispose] = NeighborList.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PDBReaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_pdbreader_free(ptr, 0);
    }
    /**
     * Check whether the file contains no valid frames.
     *
     * # Errors
     *
     * Throws a `JsValue` string on parse errors.
     * @returns {boolean}
     */
    isEmpty() {
        const ret = wasm.pdbreader_isEmpty(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Return the number of frames (always 0 or 1 for PDB files).
     *
     * # Errors
     *
     * Throws a `JsValue` string on parse errors.
     * @returns {number}
     */
    len() {
        const ret = wasm.pdbreader_len(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
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
     * @param {string} content
     */
    constructor(content) {
        const ptr0 = passStringToWasm0(content, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.pdbreader_new(ptr0, len0);
        this.__wbg_ptr = ret >>> 0;
        PDBReaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
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
     * @param {number} step
     * @returns {Frame | undefined}
     */
    read(step) {
        const ret = wasm.pdbreader_read(this.__wbg_ptr, step);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] === 0 ? undefined : Frame.__wrap(ret[0]);
    }
}
if (Symbol.dispose) PDBReader.prototype[Symbol.dispose] = PDBReader.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RDFFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_rdf_free(ptr, 0);
    }
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
     * @param {Frame} frame
     * @param {NeighborList} neighbors
     * @returns {RDFResult}
     */
    compute(frame, neighbors) {
        _assertClass(frame, Frame);
        _assertClass(neighbors, NeighborList);
        const ret = wasm.rdf_compute(this.__wbg_ptr, frame.__wbg_ptr, neighbors.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return RDFResult.__wrap(ret[0]);
    }
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
     * @param {NeighborList} neighbors
     * @param {number} volume
     * @returns {RDFResult}
     */
    computeWithVolume(neighbors, volume) {
        _assertClass(neighbors, NeighborList);
        const ret = wasm.rdf_computeWithVolume(this.__wbg_ptr, neighbors.__wbg_ptr, volume);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return RDFResult.__wrap(ret[0]);
    }
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
     * @param {number} n_bins
     * @param {number} r_max
     * @param {number | null} [r_min]
     */
    constructor(n_bins, r_max, r_min) {
        const ret = wasm.rdf_new(n_bins, r_max, !isLikeNone(r_min), isLikeNone(r_min) ? 0 : r_min);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        RDFFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) RDF.prototype[Symbol.dispose] = RDF.prototype.free;

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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(RDFResult.prototype);
        obj.__wbg_ptr = ptr;
        RDFResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RDFResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_rdfresult_free(ptr, 0);
    }
    /**
     * Zero-copy `Float64Array` view of bin center positions in A.
     * Length equals `n_bins`. **Invalidated** on WASM memory growth;
     * copy in JS if it needs to outlive later calls.
     * @returns {Float64Array}
     */
    binCenters() {
        const ret = wasm.rdfresult_binCenters(this.__wbg_ptr);
        return ret;
    }
    /**
     * Zero-copy `Float64Array` view of bin edge positions in A.
     * Length is `n_bins + 1`. Same invalidation caveat.
     * @returns {Float64Array}
     */
    binEdges() {
        const ret = wasm.rdfresult_binEdges(this.__wbg_ptr);
        return ret;
    }
    /**
     * Number of reference points used in the normalization.
     * @returns {number}
     */
    get numPoints() {
        const ret = wasm.rdfresult_numPoints(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Zero-copy `Float64Array` view of raw (un-normalized) pair counts
     * per bin. Same invalidation caveat.
     * @returns {Float64Array}
     */
    pairCounts() {
        const ret = wasm.rdfresult_pairCounts(this.__wbg_ptr);
        return ret;
    }
    /**
     * Inner cutoff in A (lower edge of bin 0).
     * @returns {number}
     */
    get rMin() {
        const ret = wasm.rdfresult_rMin(this.__wbg_ptr);
        return ret;
    }
    /**
     * Zero-copy `Float64Array` view of normalized g(r). Same invalidation
     * caveat.
     * @returns {Float64Array}
     */
    rdf() {
        const ret = wasm.rdfresult_rdf(this.__wbg_ptr);
        return ret;
    }
    /**
     * Normalization volume in A^3 (from the SimBox or the explicit caller value).
     * @returns {number}
     */
    get volume() {
        const ret = wasm.rdfresult_volume(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) RDFResult.prototype[Symbol.dispose] = RDFResult.prototype.free;

/**
 * Radius of gyration per cluster.
 */
export class RadiusOfGyration {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RadiusOfGyrationFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_radiusofgyration_free(ptr, 0);
    }
    /**
     * Compute radii of gyration. Returns a float typed array of length `numClusters`.
     *
     * Internally computes the cluster centers of mass so the single-frame
     * wasm signature `(frame, cluster)` stays stable despite the new
     * compute trait needing explicit COM upstream.
     * @param {Frame} frame
     * @param {ClusterResult} cluster_result
     * @returns {Float64Array}
     */
    compute(frame, cluster_result) {
        _assertClass(frame, Frame);
        _assertClass(cluster_result, ClusterResult);
        const ret = wasm.radiusofgyration_compute(this.__wbg_ptr, frame.__wbg_ptr, cluster_result.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * @param {Float64Array | null} [masses]
     */
    constructor(masses) {
        var ptr0 = isLikeNone(masses) ? 0 : passArrayF64ToWasm0(masses, wasm.__wbindgen_malloc_command_export);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.radiusofgyration_new(ptr0, len0);
        this.__wbg_ptr = ret >>> 0;
        RadiusOfGyrationFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) RadiusOfGyration.prototype[Symbol.dispose] = RadiusOfGyration.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SDFReaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_sdfreader_free(ptr, 0);
    }
    /**
     * Check whether the file contains no records.
     * @returns {boolean}
     */
    isEmpty() {
        const ret = wasm.sdfreader_isEmpty(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Return the total number of records in the SDF file.
     * @returns {number}
     */
    len() {
        const ret = wasm.sdfreader_len(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
    /**
     * Create a new SDF reader from a string containing the file content.
     * @param {string} content
     */
    constructor(content) {
        const ptr0 = passStringToWasm0(content, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.sdfreader_new(ptr0, len0);
        this.__wbg_ptr = ret >>> 0;
        SDFReaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Read the frame (SDF record) at the given step index.
     * @param {number} step
     * @returns {Frame | undefined}
     */
    read(step) {
        const ret = wasm.sdfreader_read(this.__wbg_ptr, step);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] === 0 ? undefined : Frame.__wrap(ret[0]);
    }
}
if (Symbol.dispose) SDFReader.prototype[Symbol.dispose] = SDFReader.prototype.free;

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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(SmilesIR.prototype);
        obj.__wbg_ptr = ptr;
        SmilesIRFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SmilesIRFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_smilesir_free(ptr, 0);
    }
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
     * @returns {number}
     */
    get nComponents() {
        const ret = wasm.smilesir_nComponents(this.__wbg_ptr);
        return ret >>> 0;
    }
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
     * @returns {Frame}
     */
    toFrame() {
        const ret = wasm.smilesir_toFrame(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Frame.__wrap(ret[0]);
    }
}
if (Symbol.dispose) SmilesIR.prototype[Symbol.dispose] = SmilesIR.prototype.free;

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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Topology.prototype);
        obj.__wbg_ptr = ptr;
        TopologyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        TopologyFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_topology_free(ptr, 0);
    }
    /**
     * Add a single atom.
     */
    addAtom() {
        wasm.topology_addAtom(this.__wbg_ptr);
    }
    /**
     * Add a bond between atoms `i` and `j`.
     * @param {number} i
     * @param {number} j
     */
    addBond(i, j) {
        wasm.topology_addBond(this.__wbg_ptr, i, j);
    }
    /**
     * All angle triplets as flat `Uint32Array` `[i,j,k, ...]`.
     * @returns {Uint32Array}
     */
    angles() {
        const ret = wasm.topology_angles(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Whether atoms `i` and `j` are directly bonded.
     * @param {number} i
     * @param {number} j
     * @returns {boolean}
     */
    areBonded(i, j) {
        const ret = wasm.topology_areBonded(this.__wbg_ptr, i, j);
        return ret !== 0;
    }
    /**
     * All bond pairs as flat `Uint32Array` `[i0,j0, i1,j1, ...]`.
     * @returns {Uint32Array}
     */
    bonds() {
        const ret = wasm.topology_bonds(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Per-atom connected component labels as `Int32Array`.
     *
     * Labels are 0-based and contiguous. Each atom gets a component ID.
     * Atoms in the same connected subgraph share the same label.
     * @returns {Int32Array}
     */
    connectedComponents() {
        const ret = wasm.topology_connectedComponents(this.__wbg_ptr);
        var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Degree (number of bonds) of atom `idx`.
     * @param {number} idx
     * @returns {number}
     */
    degree(idx) {
        const ret = wasm.topology_degree(this.__wbg_ptr, idx);
        return ret >>> 0;
    }
    /**
     * Delete an atom by index.
     * @param {number} idx
     */
    deleteAtom(idx) {
        wasm.topology_deleteAtom(this.__wbg_ptr, idx);
    }
    /**
     * Delete a bond by edge index.
     * @param {number} idx
     */
    deleteBond(idx) {
        wasm.topology_deleteBond(this.__wbg_ptr, idx);
    }
    /**
     * All proper dihedral quartets as flat `Uint32Array` `[i,j,k,l, ...]`.
     * @returns {Uint32Array}
     */
    dihedrals() {
        const ret = wasm.topology_dihedrals(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Compute the Smallest Set of Smallest Rings (SSSR).
     * @returns {TopologyRingInfo}
     */
    findRings() {
        const ret = wasm.topology_findRings(this.__wbg_ptr);
        return TopologyRingInfo.__wrap(ret);
    }
    /**
     * Build a topology from a Frame's `bonds` block.
     *
     * Reads the `atoms` block for atom count and `bonds` block for
     * `i`, `j` columns (Uint32).
     * @param {Frame} frame
     * @returns {Topology}
     */
    static fromFrame(frame) {
        _assertClass(frame, Frame);
        const ret = wasm.topology_fromFrame(frame.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Topology.__wrap(ret[0]);
    }
    /**
     * All improper dihedral quartets as flat `Uint32Array` `[center,i,j,k, ...]`.
     * @returns {Uint32Array}
     */
    impropers() {
        const ret = wasm.topology_impropers(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Number of unique angles.
     * @returns {number}
     */
    get nAngles() {
        const ret = wasm.topology_nAngles(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Number of atoms (vertices).
     * @returns {number}
     */
    get nAtoms() {
        const ret = wasm.topology_nAtoms(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Number of bonds (edges).
     * @returns {number}
     */
    get nBonds() {
        const ret = wasm.topology_nBonds(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Number of connected components.
     * @returns {number}
     */
    get nComponents() {
        const ret = wasm.topology_nComponents(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Number of unique proper dihedrals.
     * @returns {number}
     */
    get nDihedrals() {
        const ret = wasm.topology_nDihedrals(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Neighbor atom indices of atom `idx` as `Uint32Array`.
     * @param {number} idx
     * @returns {Uint32Array}
     */
    neighbors(idx) {
        const ret = wasm.topology_neighbors(this.__wbg_ptr, idx);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Create a topology with `n` atoms and no bonds.
     * @param {number} n_atoms
     */
    constructor(n_atoms) {
        const ret = wasm.topology_new(n_atoms);
        this.__wbg_ptr = ret >>> 0;
        TopologyFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) Topology.prototype[Symbol.dispose] = Topology.prototype.free;

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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(TopologyRingInfo.prototype);
        obj.__wbg_ptr = ptr;
        TopologyRingInfoFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        TopologyRingInfoFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_topologyringinfo_free(ptr, 0);
    }
    /**
     * Per-atom boolean mask as `Uint8Array` (0 or 1). 1 if atom is in any ring.
     * @param {number} n_atoms
     * @returns {Uint8Array}
     */
    atomRingMask(n_atoms) {
        const ret = wasm.topologyringinfo_atomRingMask(this.__wbg_ptr, n_atoms);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Whether atom `idx` belongs to any ring.
     * @param {number} idx
     * @returns {boolean}
     */
    isAtomInRing(idx) {
        const ret = wasm.topologyringinfo_isAtomInRing(this.__wbg_ptr, idx);
        return ret !== 0;
    }
    /**
     * Number of rings containing atom `idx`.
     * @param {number} idx
     * @returns {number}
     */
    numAtomRings(idx) {
        const ret = wasm.topologyringinfo_numAtomRings(this.__wbg_ptr, idx);
        return ret >>> 0;
    }
    /**
     * Total number of rings detected.
     * @returns {number}
     */
    get numRings() {
        const ret = wasm.topologyringinfo_numRings(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Size of each ring as `Uint32Array`.
     * @returns {Uint32Array}
     */
    ringSizes() {
        const ret = wasm.topologyringinfo_ringSizes(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * All rings as flat `Uint32Array` with length-prefixed encoding:
     * `[size0, atom0, atom1, ..., size1, atom0, atom1, ...]`.
     * @returns {Uint32Array}
     */
    rings() {
        const ret = wasm.topologyringinfo_rings(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 4, 4);
        return v1;
    }
}
if (Symbol.dispose) TopologyRingInfo.prototype[Symbol.dispose] = TopologyRingInfo.prototype.free;

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
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmArray.prototype);
        obj.__wbg_ptr = ptr;
        WasmArrayFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmArrayFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmarray_free(ptr, 0);
    }
    /**
     * Return the concrete float dtype string for this build.
     * @returns {string}
     */
    dtype() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.wasmarray_dtype(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free_command_export(deferred1_0, deferred1_1, 1);
        }
    }
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
     * @param {Float64Array} data
     * @param {Uint32Array | null} [shape]
     * @returns {WasmArray}
     */
    static from(data, shape) {
        var ptr0 = isLikeNone(shape) ? 0 : passArray32ToWasm0(shape, wasm.__wbindgen_malloc_command_export);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmarray_from(data, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmArray.__wrap(ret[0]);
    }
    /**
     * Check whether the array contains no elements.
     * @returns {boolean}
     */
    is_empty() {
        const ret = wasm.wasmarray_is_empty(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Return the total number of elements (product of all shape dimensions).
     *
     * # Example (JavaScript)
     *
     * ```js
     * const arr = new WasmArray([10, 3]);
     * console.log(arr.len()); // 30
     * ```
     * @returns {number}
     */
    len() {
        const ret = wasm.wasmarray_len(this.__wbg_ptr);
        return ret >>> 0;
    }
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
     * @param {Uint32Array} shape
     */
    constructor(shape) {
        const ptr0 = passArray32ToWasm0(shape, wasm.__wbindgen_malloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmarray_new(ptr0, len0);
        this.__wbg_ptr = ret >>> 0;
        WasmArrayFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Return a raw pointer to the underlying data buffer.
     *
     * This is intended for advanced interop with other WASM modules
     * that need direct memory access. The pointer is only valid as
     * long as this `WasmArray` is alive and no WASM memory growth
     * has occurred.
     * @returns {number}
     */
    ptr() {
        const ret = wasm.wasmarray_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Return a copy of the shape metadata as a JS array.
     *
     * # Example (JavaScript)
     *
     * ```js
     * const s = arr.shape(); // e.g., [10, 3]
     * ```
     * @returns {Uint32Array}
     */
    shape() {
        const ret = wasm.wasmarray_shape(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free_command_export(ret[0], ret[1] * 4, 4);
        return v1;
    }
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
     * @returns {number}
     */
    sum() {
        const ret = wasm.wasmarray_sum(this.__wbg_ptr);
        return ret;
    }
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
     * @returns {Float64Array}
     */
    toCopy() {
        const ret = wasm.wasmarray_toCopy(this.__wbg_ptr);
        return ret;
    }
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
     * @returns {Float64Array}
     */
    toTypedArray() {
        const ret = wasm.wasmarray_toTypedArray(this.__wbg_ptr);
        return ret;
    }
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
     * @param {Float64Array} arr
     */
    write_from(arr) {
        const ret = wasm.wasmarray_write_from(this.__wbg_ptr, arr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
}
if (Symbol.dispose) WasmArray.prototype[Symbol.dispose] = WasmArray.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmKMeansFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmkmeans_free(ptr, 0);
    }
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
     * @param {Float64Array} coords
     * @param {number} n_rows
     * @param {number} n_dims
     * @returns {Int32Array}
     */
    fit(coords, n_rows, n_dims) {
        const ptr0 = passArrayF64ToWasm0(coords, wasm.__wbindgen_malloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmkmeans_fit(this.__wbg_ptr, ptr0, len0, n_rows, n_dims);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
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
     * @param {number} k
     * @param {number} max_iter
     * @param {number} seed
     */
    constructor(k, max_iter, seed) {
        const ret = wasm.wasmkmeans_new(k, max_iter, seed);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        WasmKMeansFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WasmKMeans.prototype[Symbol.dispose] = WasmKMeans.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmPca2Finalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmpca2_free(ptr, 0);
    }
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
     * @param {Float64Array} matrix
     * @param {number} n_rows
     * @param {number} n_cols
     * @returns {WasmPcaResult}
     */
    fitTransform(matrix, n_rows, n_cols) {
        const ptr0 = passArrayF64ToWasm0(matrix, wasm.__wbindgen_malloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmpca2_fitTransform(this.__wbg_ptr, ptr0, len0, n_rows, n_cols);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmPcaResult.__wrap(ret[0]);
    }
    /**
     * Create a new PCA calculator. The struct carries no state — all
     * parameters are supplied on [`fitTransform`](Self::fit_transform).
     */
    constructor() {
        const ret = wasm.wasmpca2_new();
        this.__wbg_ptr = ret >>> 0;
        WasmPca2Finalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WasmPca2.prototype[Symbol.dispose] = WasmPca2.prototype.free;

/**
 * Result of a [`WasmPca2::fit_transform`] call.
 *
 * Each accessor returns an **owned** `Float64Array` (copy of the underlying
 * `Vec`) so JS is free to let this wrapper be GC'd without dangling views.
 */
export class WasmPcaResult {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmPcaResult.prototype);
        obj.__wbg_ptr = ptr;
        WasmPcaResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmPcaResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmpcaresult_free(ptr, 0);
    }
    /**
     * Projected 2D coordinates as a row-major `Float64Array` of length
     * `2 * n_rows`. `coords[2 * i + 0]` is the PC1 score for row `i`,
     * `coords[2 * i + 1]` is PC2.
     * @returns {Float64Array}
     */
    coords() {
        const ret = wasm.wasmpcaresult_coords(this.__wbg_ptr);
        return ret;
    }
    /**
     * Explained variance per component as `Float64Array` of length 2.
     * `variance[0] >= variance[1]` by construction.
     * @returns {Float64Array}
     */
    variance() {
        const ret = wasm.wasmpcaresult_variance(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) WasmPcaResult.prototype[Symbol.dispose] = WasmPcaResult.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        XYZReaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_xyzreader_free(ptr, 0);
    }
    /**
     * Check whether the file contains no frames.
     *
     * # Errors
     *
     * Throws a `JsValue` string if the file cannot be scanned.
     * @returns {boolean}
     */
    isEmpty() {
        const ret = wasm.xyzreader_isEmpty(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
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
     * @returns {number}
     */
    len() {
        const ret = wasm.xyzreader_len(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
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
     * @param {string} content
     */
    constructor(content) {
        const ptr0 = passStringToWasm0(content, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.xyzreader_new(ptr0, len0);
        this.__wbg_ptr = ret >>> 0;
        XYZReaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
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
     * @param {number} step
     * @returns {Frame | undefined}
     */
    read(step) {
        const ret = wasm.xyzreader_read(this.__wbg_ptr, step);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] === 0 ? undefined : Frame.__wrap(ret[0]);
    }
}
if (Symbol.dispose) XYZReader.prototype[Symbol.dispose] = XYZReader.prototype.free;

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
 * @param {Frame} frame
 * @param {string | null} [speed]
 * @param {number | null} [seed]
 * @returns {Frame}
 */
export function generate3D(frame, speed, seed) {
    _assertClass(frame, Frame);
    var ptr0 = isLikeNone(speed) ? 0 : passStringToWasm0(speed, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
    var len0 = WASM_VECTOR_LEN;
    const ret = wasm.generate3D(frame.__wbg_ptr, ptr0, len0, isLikeNone(seed) ? 0x100000001 : (seed) >>> 0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return Frame.__wrap(ret[0]);
}

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
 * @param {string} smiles
 * @returns {SmilesIR}
 */
export function parseSMILES(smiles) {
    const ptr0 = passStringToWasm0(smiles, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.parseSMILES(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return SmilesIR.__wrap(ret[0]);
}

/**
 * WASM module entry point. Installs the panic hook so that Rust panics
 * are forwarded to the browser console as readable stack traces.
 */
export function start() {
    wasm.start();
}

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
 * @returns {WebAssembly.Memory}
 */
export function wasmMemory() {
    const ret = wasm.wasmMemory();
    return ret;
}

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
 * @param {Frame} frame
 * @param {string} format
 * @returns {string}
 */
export function writeFrame(frame, format) {
    let deferred3_0;
    let deferred3_1;
    try {
        _assertClass(frame, Frame);
        const ptr0 = passStringToWasm0(format, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.writeFrame(frame.__wbg_ptr, ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free_command_export(deferred3_0, deferred3_1, 1);
    }
}
export function __wbg___wbindgen_debug_string_5398f5bb970e0daa(arg0, arg1) {
    const ret = debugString(arg1);
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg___wbindgen_memory_edb3f01e3930bbf6() {
    const ret = wasm.memory;
    return ret;
}
export function __wbg___wbindgen_string_get_395e606bd0ee4427(arg0, arg1) {
    const obj = arg1;
    const ret = typeof(obj) === 'string' ? obj : undefined;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
    var len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg___wbindgen_throw_6ddd609b62940d55(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
}
export function __wbg_done_08ce71ee07e3bd17(arg0) {
    const ret = arg0.done;
    return ret;
}
export function __wbg_error_a6fa202b58aa1cd3(arg0, arg1) {
    let deferred0_0;
    let deferred0_1;
    try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm0(arg0, arg1));
    } finally {
        wasm.__wbindgen_free_command_export(deferred0_0, deferred0_1, 1);
    }
}
export function __wbg_getRandomValues_3f44b700395062e5() { return handleError(function (arg0, arg1) {
    globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
}, arguments); }
export function __wbg_get_10ee87d86a58fb49(arg0, arg1) {
    const ret = arg0.get(arg1);
    return ret;
}
export function __wbg_get_unchecked_329cfe50afab7352(arg0, arg1) {
    const ret = arg0[arg1 >>> 0];
    return ret;
}
export function __wbg_keys_3fff7686656d707e(arg0) {
    const ret = arg0.keys();
    return ret;
}
export function __wbg_length_27280eca2d70010e(arg0) {
    const ret = arg0.length;
    return ret;
}
export function __wbg_length_550d8a396009cd38(arg0) {
    const ret = arg0.length;
    return ret;
}
export function __wbg_length_76eefdd571f24b00(arg0) {
    const ret = arg0.length;
    return ret;
}
export function __wbg_length_b3416cf66a5452c8(arg0) {
    const ret = arg0.length;
    return ret;
}
export function __wbg_length_ea16607d7b61445b(arg0) {
    const ret = arg0.length;
    return ret;
}
export function __wbg_msdresult_new(arg0) {
    const ret = MSDResult.__wrap(arg0);
    return ret;
}
export function __wbg_new_227d7c05414eb861() {
    const ret = new Error();
    return ret;
}
export function __wbg_new_5f486cdf45a04d78(arg0) {
    const ret = new Uint8Array(arg0);
    return ret;
}
export function __wbg_new_a70fbab9066b301f() {
    const ret = new Array();
    return ret;
}
export function __wbg_new_from_slice_898ac63cbd46f332(arg0, arg1) {
    const ret = new Uint32Array(getArrayU32FromWasm0(arg0, arg1));
    return ret;
}
export function __wbg_new_from_slice_c62f8165d6102476(arg0, arg1) {
    const ret = new Int32Array(getArrayI32FromWasm0(arg0, arg1));
    return ret;
}
export function __wbg_new_from_slice_ff94ab4827a1a00b(arg0, arg1) {
    const ret = new Float64Array(getArrayF64FromWasm0(arg0, arg1));
    return ret;
}
export function __wbg_new_with_length_a6dc736798f9d14e(arg0) {
    const ret = new Int32Array(arg0 >>> 0);
    return ret;
}
export function __wbg_new_with_length_eae667475c36c4e4(arg0) {
    const ret = new Float64Array(arg0 >>> 0);
    return ret;
}
export function __wbg_next_11b99ee6237339e3() { return handleError(function (arg0) {
    const ret = arg0.next();
    return ret;
}, arguments); }
export function __wbg_prototypesetcall_52ca14fb142bc37b(arg0, arg1, arg2) {
    Int32Array.prototype.set.call(getArrayI32FromWasm0(arg0, arg1), arg2);
}
export function __wbg_prototypesetcall_79daf97fb14c7a19(arg0, arg1, arg2) {
    Float64Array.prototype.set.call(getArrayF64FromWasm0(arg0, arg1), arg2);
}
export function __wbg_prototypesetcall_d62e5099504357e6(arg0, arg1, arg2) {
    Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
}
export function __wbg_prototypesetcall_f04613188bde902d(arg0, arg1, arg2) {
    Uint32Array.prototype.set.call(getArrayU32FromWasm0(arg0, arg1), arg2);
}
export function __wbg_push_e87b0e732085a946(arg0, arg1) {
    const ret = arg0.push(arg1);
    return ret;
}
export function __wbg_set_636d1e3e4286e068(arg0, arg1, arg2) {
    arg0.set(getArrayF64FromWasm0(arg1, arg2));
}
export function __wbg_set_79587606a1f70bf0(arg0, arg1, arg2) {
    arg0.set(getArrayI32FromWasm0(arg1, arg2));
}
export function __wbg_stack_3b0d974bbf31e44f(arg0, arg1) {
    const ret = arg1.stack;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg_value_21fc78aab0322612(arg0) {
    const ret = arg0.value;
    return ret;
}
export function __wbindgen_cast_0000000000000001(arg0, arg1) {
    // Cast intrinsic for `Ref(Slice(F64)) -> NamedExternref("Float64Array")`.
    const ret = getArrayF64FromWasm0(arg0, arg1);
    return ret;
}
export function __wbindgen_cast_0000000000000002(arg0, arg1) {
    // Cast intrinsic for `Ref(Slice(I32)) -> NamedExternref("Int32Array")`.
    const ret = getArrayI32FromWasm0(arg0, arg1);
    return ret;
}
export function __wbindgen_cast_0000000000000003(arg0, arg1) {
    // Cast intrinsic for `Ref(Slice(U32)) -> NamedExternref("Uint32Array")`.
    const ret = getArrayU32FromWasm0(arg0, arg1);
    return ret;
}
export function __wbindgen_cast_0000000000000004(arg0, arg1) {
    // Cast intrinsic for `Ref(String) -> Externref`.
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
}
export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_externrefs;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
}
const BlockFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_block_free(ptr >>> 0, 1));
const BoxFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_box_free(ptr >>> 0, 1));
const CenterOfMassFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_centerofmass_free(ptr >>> 0, 1));
const CenterOfMassResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_centerofmassresult_free(ptr >>> 0, 1));
const ClusterFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_cluster_free(ptr >>> 0, 1));
const ClusterCentersFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_clustercenters_free(ptr >>> 0, 1));
const ClusterResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_clusterresult_free(ptr >>> 0, 1));
const FrameFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_frame_free(ptr >>> 0, 1));
const GridFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_grid_free(ptr >>> 0, 1));
const GyrationTensorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_gyrationtensor_free(ptr >>> 0, 1));
const InertiaTensorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_inertiatensor_free(ptr >>> 0, 1));
const LAMMPSDumpReaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_lammpsdumpreader_free(ptr >>> 0, 1));
const LAMMPSReaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_lammpsreader_free(ptr >>> 0, 1));
const LinkedCellFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_linkedcell_free(ptr >>> 0, 1));
const MSDFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_msd_free(ptr >>> 0, 1));
const MSDResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_msdresult_free(ptr >>> 0, 1));
const MolRecReaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_molrecreader_free(ptr >>> 0, 1));
const NeighborListFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_neighborlist_free(ptr >>> 0, 1));
const PDBReaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_pdbreader_free(ptr >>> 0, 1));
const RDFFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_rdf_free(ptr >>> 0, 1));
const RDFResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_rdfresult_free(ptr >>> 0, 1));
const RadiusOfGyrationFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_radiusofgyration_free(ptr >>> 0, 1));
const SDFReaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_sdfreader_free(ptr >>> 0, 1));
const TopologyRingInfoFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_topologyringinfo_free(ptr >>> 0, 1));
const WasmArrayFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmarray_free(ptr >>> 0, 1));
const WasmKMeansFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmkmeans_free(ptr >>> 0, 1));
const WasmPca2Finalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmpca2_free(ptr >>> 0, 1));
const WasmPcaResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmpcaresult_free(ptr >>> 0, 1));
const SmilesIRFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_smilesir_free(ptr >>> 0, 1));
const TopologyFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_topology_free(ptr >>> 0, 1));
const XYZReaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_xyzreader_free(ptr >>> 0, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc_command_export();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayI32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice_command_export(ptr, len);
    return result;
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

let cachedInt32ArrayMemory0 = null;
function getInt32ArrayMemory0() {
    if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
        cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store_command_export(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc_command_export(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;


let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}
