import type { Scene } from "@babylonjs/core";
import type { Color3, Vector3 } from "@babylonjs/core";
import type { World } from "../core/world";
import type { Frame } from "../structure/frame";
import type { Box } from "../structure";
import type { SelectionManager } from "../core/selection_manager";

/**
 * Interface for sources that provide Frame objects.
 */
export interface FrameSource {
  getFrame(index: number): Promise<Frame>;
  getFrameCount(): number | null;
}

/**
 * Context passed to DataOp.apply() method.
 */
export interface DataOpContext {
  frameIndex: number;
  source: FrameSource;
}

/**
 * Context passed to DataPipeline.compute() method.
 */
export interface DataPipelineContext {
  source: FrameSource;
}

/**
 * Interface for data operations that transform Frame objects.
 */
export interface DataOp {
  id: string;
  enabled: boolean;
  apply(frame: Frame, ctx: DataOpContext): Frame;
}

/**
 * Context passed to RenderOp.render() method.
 */
export interface RenderOpContext {
  scene: Scene;
  world: World;
  selectionManager?: SelectionManager; // Shared selection state
}

/**
 * Context passed to RenderPipeline.render() method.
 */
export interface RenderPipelineContext {
  scene: Scene;
  world: World;
}

/**
 * Interface for render operations that render Frame objects to the scene.
 */
export interface RenderOp {
  id: string;
  enabled: boolean;
  render(scene: Scene, frame: Frame, ctx: RenderOpContext): void;
}

// Artist types (from artist/types.ts)
export interface DrawAtomOption {
  radius?: number;
  color?: Color3;
}

export interface DrawAtomInput {
  id?: number;
  name?: string;
  element?: string;
  position: Vector3;
  options?: DrawAtomOption;
}

export interface DrawBondOption {
  radius?: number;
  update?: boolean;
  order?: number;
  i?: number;
  j?: number;
}

export interface DrawBondInput {
  start: Vector3;
  end: Vector3;
  options?: DrawBondOption;
}

export interface DrawBoxOption {
  visible?: boolean;
  color?: Color3;
  lineWidth?: number;
}

export interface DrawBoxInput {
  box: Box;
  options?: DrawBoxOption;
}

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
  box?: DrawBoxOption;
}

export interface DrawFrameInput {
  frame: Frame;
  options?: DrawFrameOption;
}

export type DrawGridInput = {
  size?: number;
  step?: number;
  color?: [number, number, number];
  alpha?: number;
  name?: string;
};

export type DeleteAtomInput = {
  atomId: number;
};
