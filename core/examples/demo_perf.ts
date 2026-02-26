import { Molvis, Trajectory } from "../src/index";
import { Block, Frame } from "@molcrafts/molrs";

/**
 * Performance Testing Demo
 * 
 * This demo generates a configurable number of water molecules randomly placed
 * in a cubic box at a specified density to test molvis rendering performance.
 * 
 * Modify the constants below to adjust the test parameters:
 * - NUM_WATER_MOLECULES: Number of water molecules to generate
 * - DENSITY: Density in g/cm³ (typical water density is ~1.0)
 */

// ============================================================================
// USER CONFIGURABLE PARAMETERS
// ============================================================================

/** Number of water molecules to generate */
const NUM_WATER_MOLECULES = 10000;

/** Density in g/cm³ (water is typically ~1.0 g/cm³) */
const DENSITY = 1.0;

// ============================================================================
// CONSTANTS
// ============================================================================

/** Molecular weight of water (H2O) in g/mol */
const WATER_MW = 18.015;

/** Avogadro's number */
const AVOGADRO = 6.022e23;

/** Water molecule geometry (in Angstroms) */
const WATER_GEOMETRY = {
    // O-H bond length
    OH_BOND_LENGTH: 0.9572,
    // H-O-H angle in radians
    HOH_ANGLE: 104.45 * Math.PI / 180,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate box size from number of molecules and density
 * @param numMolecules Number of water molecules
 * @param density Density in g/cm³
 * @returns Box side length in Angstroms
 */
function calculateBoxSize(numMolecules: number, density: number): number {
    // Mass of all molecules in grams
    const totalMass = (numMolecules * WATER_MW) / AVOGADRO;

    // Volume in cm³
    const volume = totalMass / density;

    // Convert to Angstroms³ (1 cm = 1e8 Angstroms)
    const volumeAngstroms = volume * 1e24;

    // Cubic box side length
    const boxSize = Math.pow(volumeAngstroms, 1 / 3);

    return boxSize;
}

/**
 * Generate a single water molecule at a given position and orientation
 * @param centerX X coordinate of oxygen atom
 * @param centerY Y coordinate of oxygen atom
 * @param centerZ Z coordinate of oxygen atom
 * @param rotX Rotation around X axis (radians)
 * @param rotY Rotation around Y axis (radians)
 * @param rotZ Rotation around Z axis (radians)
 * @returns Object containing positions for O, H1, H2
 */
function generateWaterMolecule(
    centerX: number,
    centerY: number,
    centerZ: number,
    rotX: number,
    rotY: number,
    rotZ: number
): { o: [number, number, number], h1: [number, number, number], h2: [number, number, number] } {
    const { OH_BOND_LENGTH, HOH_ANGLE } = WATER_GEOMETRY;

    // Initial positions (before rotation)
    // O at origin, H atoms positioned symmetrically
    const halfAngle = HOH_ANGLE / 2;
    const h1_local: [number, number, number] = [
        OH_BOND_LENGTH * Math.sin(halfAngle),
        OH_BOND_LENGTH * Math.cos(halfAngle),
        0
    ];
    const h2_local: [number, number, number] = [
        -OH_BOND_LENGTH * Math.sin(halfAngle),
        OH_BOND_LENGTH * Math.cos(halfAngle),
        0
    ];

    // Apply rotations (simplified rotation - just random orientation)
    // For simplicity, we'll use a rotation matrix approach
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);

    // Rotation matrix (Z * Y * X)
    const rotate = (p: [number, number, number]): [number, number, number] => {
        let [x, y, z] = p;

        // Rotate around X
        let y1 = y * cosX - z * sinX;
        let z1 = y * sinX + z * cosX;
        y = y1; z = z1;

        // Rotate around Y
        let x1 = x * cosY + z * sinY;
        z1 = -x * sinY + z * cosY;
        x = x1; z = z1;

        // Rotate around Z
        x1 = x * cosZ - y * sinZ;
        y1 = x * sinZ + y * cosZ;

        return [x1 + centerX, y1 + centerY, z1 + centerZ];
    };

    return {
        o: [centerX, centerY, centerZ],
        h1: rotate(h1_local),
        h2: rotate(h2_local)
    };
}

/**
 * Generate random positions for water molecules in a cubic box
 * @param numMolecules Number of water molecules
 * @param boxSize Box side length in Angstroms
 * @returns Frame containing all atoms and bonds
 */
function generateWaterBox(numMolecules: number, boxSize: number): Frame {
    const atomsBlock = new Block();
    const bondsBlock = new Block();

    const totalAtoms = numMolecules * 3; // Each water has 3 atoms (O, H, H)
    const totalBonds = numMolecules * 2; // Each water has 2 bonds (O-H, O-H)

    const x = new Float32Array(totalAtoms);
    const y = new Float32Array(totalAtoms);
    const z = new Float32Array(totalAtoms);
    const elements: string[] = new Array(totalAtoms);

    const bond_i = new Uint32Array(totalBonds);
    const bond_j = new Uint32Array(totalBonds);
    const bond_order = new Uint8Array(totalBonds);

    // Generate water molecules
    for (let i = 0; i < numMolecules; i++) {
        // Random position in box
        const centerX = Math.random() * boxSize - boxSize / 2;
        const centerY = Math.random() * boxSize - boxSize / 2;
        const centerZ = Math.random() * boxSize - boxSize / 2;

        // Random orientation
        const rotX = Math.random() * 2 * Math.PI;
        const rotY = Math.random() * 2 * Math.PI;
        const rotZ = Math.random() * 2 * Math.PI;

        const water = generateWaterMolecule(centerX, centerY, centerZ, rotX, rotY, rotZ);

        // Atom indices
        const oIdx = i * 3;
        const h1Idx = i * 3 + 1;
        const h2Idx = i * 3 + 2;

        // Set atom positions
        [x[oIdx], y[oIdx], z[oIdx]] = water.o;
        [x[h1Idx], y[h1Idx], z[h1Idx]] = water.h1;
        [x[h2Idx], y[h2Idx], z[h2Idx]] = water.h2;

        // Set elements
        elements[oIdx] = "O";
        elements[h1Idx] = "H";
        elements[h2Idx] = "H";

        // Set bonds
        const bondIdx = i * 2;
        bond_i[bondIdx] = oIdx;
        bond_j[bondIdx] = h1Idx;
        bond_order[bondIdx] = 1;

        bond_i[bondIdx + 1] = oIdx;
        bond_j[bondIdx + 1] = h2Idx;
        bond_order[bondIdx + 1] = 1;
    }

    // Set block columns
    atomsBlock.setColumnF32("x", x);
    atomsBlock.setColumnF32("y", y);
    atomsBlock.setColumnF32("z", z);
    atomsBlock.setColumnStrings("element", elements);

    bondsBlock.setColumnU32("i", bond_i);
    bondsBlock.setColumnU32("j", bond_j);
    bondsBlock.setColumnU8("order", bond_order);

    // Create frame
    const frame = new Frame();
    frame.insertBlock("atoms", atomsBlock);
    frame.insertBlock("bonds", bondsBlock);

    return frame;
}

// ============================================================================
// MAIN DEMO
// ============================================================================

async function main() {
    console.log("=".repeat(80));
    console.log("MOLVIS PERFORMANCE TEST");
    console.log("=".repeat(80));
    console.log();

    // Calculate box size
    const boxSize = calculateBoxSize(NUM_WATER_MOLECULES, DENSITY);

    console.log("Configuration:");
    console.log(`  - Number of water molecules: ${NUM_WATER_MOLECULES.toLocaleString()}`);
    console.log(`  - Density: ${DENSITY} g/cm³`);
    console.log(`  - Box size: ${boxSize.toFixed(2)} Å (${(boxSize / 10).toFixed(2)} nm)`);
    console.log(`  - Total atoms: ${(NUM_WATER_MOLECULES * 3).toLocaleString()}`);
    console.log(`  - Total bonds: ${(NUM_WATER_MOLECULES * 2).toLocaleString()}`);
    console.log();

    // Find canvas
    const canvas = document.getElementById("molvis-app") as HTMLCanvasElement;
    if (!canvas) {
        console.error("❌ Canvas element 'molvis-app' not found!");
        return;
    }

    // Initialize Molvis
    console.log("Initializing Molvis...");
    const startInit = performance.now();
    const app = new Molvis(canvas, {
        canvas: {
            antialias: false,
            preserveDrawingBuffer: true,
            stencil: false
        },
        graphics: {
            shadows: false,
            postProcessing: false,
            ssao: false,
            bloom: false,
            ssr: false,
            dof: false,
            fxaa: true,
            hardwareScaling: 1.0
        }
    });
    const endInit = performance.now();
    console.log(`✅ Molvis initialized in ${(endInit - startInit).toFixed(2)} ms`);
    console.log();

    // Generate water box
    const frame = generateWaterBox(NUM_WATER_MOLECULES, boxSize);

    // Create trajectory (single frame for now)
    const trajectory = new Trajectory([frame]);

    // Load trajectory
    app.setTrajectory(trajectory);
    app.start();

}

main().catch(console.error);
