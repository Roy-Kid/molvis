import type { Block, Frame } from "@molcrafts/molrs";

/**
 * LAMMPS dump files may declare coordinates under several column names
 * depending on the `dump` command options. We map them all back to the
 * canonical `x/y/z` that the rest of MolVis expects.
 *
 * Priority order per axis (first match wins):
 *   1. canonical real cartesian      (`x`, `y`, `z`)
 *   2. unwrapped real cartesian      (`xu`, `yu`, `zu`)
 *   3. scaled (fractional)           (`xs`, `ys`, `zs`)
 *   4. scaled + unwrapped            (`xsu`, `ysu`, `zsu`)
 */
const AXIS_PRIORITY = {
  x: ["x", "xu", "xs", "xsu"],
  y: ["y", "yu", "ys", "ysu"],
  z: ["z", "zu", "zs", "zsu"],
} as const;

const SCALED_SOURCES: ReadonlySet<string> = new Set([
  "xs",
  "xsu",
  "ys",
  "ysu",
  "zs",
  "zsu",
]);

type Axis = keyof typeof AXIS_PRIORITY;

function pickSource(block: Block, axis: Axis): string | undefined {
  for (const key of AXIS_PRIORITY[axis]) {
    if (block.dtype(key) !== undefined) return key;
  }
  return undefined;
}

/**
 * Ensure the frame's `atoms` block exposes `x/y/z` real-cartesian columns.
 *
 * No-op when the canonical columns are already present. When they're not
 * (as happens for LAMMPS dumps emitted with `dump ... xu yu zu` or
 * `xs ys zs`), the first available fallback is read and — if the source is
 * a scaled variant — un-scaled through the simulation box (triclinic tilts
 * included) before being written back as `x/y/z`.
 *
 * Throws when coordinates are absent entirely, when scaled coords are
 * present without a simbox, or when a partially-scaled/partially-real mix
 * is encountered (that combination has no unambiguous interpretation).
 */
export function normalizeAtomCoords(frame: Frame): void {
  const atoms = frame.getBlock("atoms");
  if (!atoms) return;

  if (
    atoms.dtype("x") !== undefined &&
    atoms.dtype("y") !== undefined &&
    atoms.dtype("z") !== undefined
  ) {
    return;
  }

  const source: Record<Axis, string | undefined> = {
    x: pickSource(atoms, "x"),
    y: pickSource(atoms, "y"),
    z: pickSource(atoms, "z"),
  };

  if (!source.x || !source.y || !source.z) {
    const keys = atoms.keys().join(", ");
    throw new Error(
      `atoms block is missing coordinate columns. Got [${keys}]; expected x/y/z, xu/yu/zu, xs/ys/zs, or xsu/ysu/zsu.`,
    );
  }

  const scaledFlags = [
    SCALED_SOURCES.has(source.x),
    SCALED_SOURCES.has(source.y),
    SCALED_SOURCES.has(source.z),
  ];
  const allScaled = scaledFlags.every((flag) => flag);
  const anyScaled = scaledFlags.some((flag) => flag);

  if (anyScaled && !allScaled) {
    throw new Error(
      `mixed scaled/real coordinate sources are not supported (${source.x}/${source.y}/${source.z})`,
    );
  }

  const rawX = atoms.copyColF(source.x);
  const rawY = atoms.copyColF(source.y);
  const rawZ = atoms.copyColF(source.z);
  const n = rawX.length;
  const outX = new Float64Array(n);
  const outY = new Float64Array(n);
  const outZ = new Float64Array(n);

  if (allScaled) {
    const box = frame.simbox;
    if (!box) {
      throw new Error(
        `atoms use scaled coords (${source.x}/${source.y}/${source.z}) but the frame has no simulation box to un-scale with`,
      );
    }
    const origin = box.origin().toCopy();
    const lengths = box.lengths().toCopy();
    const tilts = box.tilts().toCopy();
    const ox = origin[0];
    const oy = origin[1];
    const oz = origin[2];
    const lx = lengths[0];
    const ly = lengths[1];
    const lz = lengths[2];
    const xy = tilts[0];
    const xz = tilts[1];
    const yz = tilts[2];
    for (let i = 0; i < n; i++) {
      const sx = rawX[i];
      const sy = rawY[i];
      const sz = rawZ[i];
      outX[i] = ox + sx * lx + sy * xy + sz * xz;
      outY[i] = oy + sy * ly + sz * yz;
      outZ[i] = oz + sz * lz;
    }
  } else {
    outX.set(rawX);
    outY.set(rawY);
    outZ.set(rawZ);
  }

  if (source.x !== "x") atoms.setColF("x", outX);
  if (source.y !== "y") atoms.setColF("y", outY);
  if (source.z !== "z") atoms.setColF("z", outZ);
}
