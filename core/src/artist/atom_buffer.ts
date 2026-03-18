import { Color3 } from "@babylonjs/core";
import type { Block } from "@molcrafts/molrs";
import {
  COLOR_OVERRIDE_B,
  COLOR_OVERRIDE_G,
  COLOR_OVERRIDE_R,
} from "../modifiers/ColorByPropertyModifier";
import { encodePickingColorInto } from "../picker";
import type { StyleManager } from "./style_manager";

export interface AtomBufferOptions {
  radii?: number[];
  visible?: boolean[];
}

interface CachedAtomStyle {
  r: number;
  g: number;
  b: number;
  a: number;
  radius: number;
}

/**
 * Build GPU buffers for all atoms in a frame block.
 * Pure computation — no BabylonJS mesh interaction.
 *
 * When __color_r/g/b override columns are present (injected by
 * ColorByPropertyModifier), uses them instead of element/type colors.
 * Radius is always resolved from the style system.
 */
export function buildAtomBuffers(
  atomsBlock: Block,
  styleManager: StyleManager,
  atomMeshUniqueId: number,
  options?: AtomBufferOptions,
): Map<string, Float32Array> {
  const atomCount = atomsBlock.nrows();
  const xCoords = atomsBlock.getColumnF32("x");
  const yCoords = atomsBlock.getColumnF32("y");
  const zCoords = atomsBlock.getColumnF32("z");
  const elementsColumn = atomsBlock.getColumnStrings("element");
  const typesColumn = atomsBlock.getColumnStrings("type");

  if (!elementsColumn && !typesColumn)
    throw new Error("No elements or types column found");
  if (!xCoords || !yCoords || !zCoords)
    throw new Error("No coordinates column");

  // Check for color override columns from ColorByPropertyModifier
  const overrideR = atomsBlock.getColumnF32(COLOR_OVERRIDE_R);
  const overrideG = atomsBlock.getColumnF32(COLOR_OVERRIDE_G);
  const overrideB = atomsBlock.getColumnF32(COLOR_OVERRIDE_B);
  const hasColorOverride = overrideR && overrideG && overrideB;

  const atomMatrix = new Float32Array(atomCount * 16);
  const atomData = new Float32Array(atomCount * 4);
  const atomColor = new Float32Array(atomCount * 4);
  const atomPick = new Float32Array(atomCount * 4);

  const styleCache = new Map<string, CachedAtomStyle>();
  const customRadii = options?.radii;
  const visibleArr = options?.visible;

  for (let i = 0; i < atomCount; i++) {
    // Always resolve style for radius (and fallback color)
    const style = resolveAtomStyle(
      i,
      elementsColumn,
      typesColumn,
      styleManager,
      styleCache,
    );

    const radius = customRadii?.[i] ?? style.radius;
    const scale = radius * 2;
    const matOffset = i * 16;
    const idx4 = i * 4;

    // Matrix (scale + translation)
    atomMatrix[matOffset + 0] = scale;
    atomMatrix[matOffset + 5] = scale;
    atomMatrix[matOffset + 10] = scale;
    atomMatrix[matOffset + 15] = 1;
    atomMatrix[matOffset + 12] = xCoords[i];
    atomMatrix[matOffset + 13] = yCoords[i];
    atomMatrix[matOffset + 14] = zCoords[i];

    // Instance data (position + radius)
    atomData[idx4 + 0] = xCoords[i];
    atomData[idx4 + 1] = yCoords[i];
    atomData[idx4 + 2] = zCoords[i];
    atomData[idx4 + 3] = radius;

    // Color: use override if present, otherwise fall back to style
    const visible = visibleArr ? visibleArr[i] : true;
    if (hasColorOverride) {
      atomColor[idx4 + 0] = overrideR[i];
      atomColor[idx4 + 1] = overrideG[i];
      atomColor[idx4 + 2] = overrideB[i];
      atomColor[idx4 + 3] = visible ? 1.0 : 0.2;
    } else {
      atomColor[idx4 + 0] = style.r;
      atomColor[idx4 + 1] = style.g;
      atomColor[idx4 + 2] = style.b;
      atomColor[idx4 + 3] = visible ? style.a : 0.2;
    }

    // Picking color (zero-allocation write)
    encodePickingColorInto(atomMeshUniqueId, i, atomPick, idx4);
  }

  const buffers = new Map<string, Float32Array>();
  buffers.set("matrix", atomMatrix);
  buffers.set("instanceData", atomData);
  buffers.set("instanceColor", atomColor);
  buffers.set("instancePickingColor", atomPick);
  return buffers;
}

function resolveAtomStyle(
  index: number,
  elementsColumn: string[] | undefined,
  typesColumn: string[] | undefined,
  styleManager: StyleManager,
  cache: Map<string, CachedAtomStyle>,
): CachedAtomStyle {
  if (elementsColumn) {
    const element = elementsColumn[index];
    let cached = cache.get(element);
    if (!cached) {
      const s = styleManager.getAtomStyle(element);
      const c = Color3.FromHexString(s.color).toLinearSpace();
      cached = { r: c.r, g: c.g, b: c.b, a: s.alpha ?? 1.0, radius: s.radius };
      cache.set(element, cached);
    }
    return cached;
  }

  const type = typesColumn ? typesColumn[index] : "UNK";
  const key = `TYPE:${type}`;
  let cached = cache.get(key);
  if (!cached) {
    const s = styleManager.getTypeStyle(type);
    const c = Color3.FromHexString(s.color).toLinearSpace();
    cached = { r: c.r, g: c.g, b: c.b, a: 1.0, radius: s.radius };
    cache.set(key, cached);
  }
  return cached;
}
