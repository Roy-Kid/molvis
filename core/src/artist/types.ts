import type { Color3, Vector3 } from "@babylonjs/core";
import type { Box, Frame } from "../structure";

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
  radius?: number[];
  color?: string[];
}

export interface DrawBondsOption {
  radius?: number;
}

export interface DrawFrameOption {
  atoms?: DrawAtomOption;
  bonds?: DrawBondOption;
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
