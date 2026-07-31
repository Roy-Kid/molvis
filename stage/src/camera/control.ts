/**
 * Programmatic camera pose control for ArcRotateCamera (Z-up).
 *
 * Shared by the JSON-RPC router (CPython ``mv.Stage.camera``) and the
 * in-page Pyodide bridge. Return shapes match Python ``CameraPose.from_rpc``.
 */

import type { ArcRotateCamera } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core";
import type { MolvisApp } from "../app";

export interface CameraPosePayload {
  alpha: number;
  beta: number;
  radius: number;
  target: [number, number, number];
  position: [number, number, number];
  up: [number, number, number];
}

function vec3Tuple(v: Vector3): [number, number, number] {
  return [v.x, v.y, v.z];
}

export function readCameraPose(camera: ArcRotateCamera): CameraPosePayload {
  const target = camera.getTarget();
  return {
    alpha: camera.alpha,
    beta: camera.beta,
    radius: camera.radius,
    target: vec3Tuple(target),
    position: vec3Tuple(camera.position),
    up: vec3Tuple(camera.upVector),
  };
}

export function setCameraPose(
  camera: ArcRotateCamera,
  params: {
    alpha?: number;
    beta?: number;
    radius?: number;
    target?: number[];
  },
): CameraPosePayload {
  if (typeof params.alpha === "number" && Number.isFinite(params.alpha)) {
    camera.alpha = params.alpha;
  }
  if (typeof params.beta === "number" && Number.isFinite(params.beta)) {
    camera.beta = params.beta;
  }
  if (typeof params.radius === "number" && Number.isFinite(params.radius)) {
    camera.radius = Math.max(0.01, params.radius);
  }
  if (Array.isArray(params.target) && params.target.length >= 3) {
    camera.setTarget(
      new Vector3(
        Number(params.target[0]),
        Number(params.target[1]),
        Number(params.target[2]),
      ),
    );
  }
  camera.rebuildAnglesAndRadius();
  return readCameraPose(camera);
}

export function lookAtCamera(
  camera: ArcRotateCamera,
  params: {
    position: number[];
    target: number[];
    up?: number[];
  },
): CameraPosePayload {
  if (!Array.isArray(params.position) || params.position.length < 3) {
    throw new Error("position must be a length-3 array");
  }
  if (!Array.isArray(params.target) || params.target.length < 3) {
    throw new Error("target must be a length-3 array");
  }
  if (Array.isArray(params.up) && params.up.length >= 3) {
    camera.upVector = new Vector3(
      Number(params.up[0]),
      Number(params.up[1]),
      Number(params.up[2]),
    );
  }
  camera.setTarget(
    new Vector3(
      Number(params.target[0]),
      Number(params.target[1]),
      Number(params.target[2]),
    ),
  );
  camera.setPosition(
    new Vector3(
      Number(params.position[0]),
      Number(params.position[1]),
      Number(params.position[2]),
    ),
  );
  camera.rebuildAnglesAndRadius();
  return readCameraPose(camera);
}

export function fitCameraView(app: MolvisApp): CameraPosePayload {
  app.world.resetCamera({ viewDirection: "iso" });
  return readCameraPose(app.world.camera);
}
