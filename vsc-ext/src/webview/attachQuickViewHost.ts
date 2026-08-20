/**
 * Normative host bridge for Quick look (stage-only surface).
 * Thin wrapper over {@link attachStageHost} for stage-only surfaces.
 */

import type { Molvis } from "@molcrafts/molvis-stage";
import {
  type AttachStageHostOptions,
  attachStageHost,
  postStageReady,
  type StageHostHandle,
} from "./attachStageHost";

export type AttachQuickViewHostOptions = Omit<
  AttachStageHostOptions,
  "isHostMessage" | "onExtraMessage"
>;

export type QuickViewHostHandle = StageHostHandle;

export function attachQuickViewHost(
  app: Molvis,
  options: AttachQuickViewHostOptions,
): QuickViewHostHandle {
  return attachStageHost(app, options);
}

export { postStageReady as postQuickViewReady };
