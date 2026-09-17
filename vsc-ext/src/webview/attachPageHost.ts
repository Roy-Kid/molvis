/**
 * Host bridge for the page surface.
 *
 * Thin wrapper over {@link attachStageHost}, the way {@link attachQuickViewHost}
 * is — the shared bridge keeps ownership of window delivery, filtering and the
 * load/settings/save path. All this adds is reading the surface the host
 * declares and handing it to the page shell.
 *
 * Not merged with `attachQuickViewHost` into one `attachHost(kind, opts)`: the
 * merged options object would have to carry `onSurface` (page only) beside
 * `onExtraMessage` (Stage editor only), leaving every caller to ignore half the
 * fields — the god data structure the design rules forbid. Two entry points,
 * two option types, each describing its own caller exactly.
 */

import type { Molvis } from "@molcrafts/molvis-stage";
import type { MolvisSurface } from "@/lib/mount-opts";
import { hostSurfaceOf, type PageSurface } from "../protocol";
import {
  type AttachStageHostOptions,
  attachStageHost,
  postStageReady,
  type StageHostHandle,
} from "./attachStageHost";

/**
 * The protocol's surface union and the page's must stay equal. The protocol
 * cannot import the page's, so this is where the two meet — adding a member to
 * one side alone fails `typecheck:vsc-ext`.
 */
type AssertEq<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : never
  : never;
const _SurfaceLockstep: AssertEq<PageSurface, MolvisSurface> = true;
void _SurfaceLockstep;

export interface AttachPageHostOptions
  extends Omit<AttachStageHostOptions, "onMessageSeen"> {
  /** Called when the host declares a surface — today, on `init`. */
  onSurface: (surface: PageSurface) => void;
}

export type PageHostHandle = StageHostHandle;

export function attachPageHost(
  app: Molvis,
  options: AttachPageHostOptions,
): PageHostHandle {
  const { onSurface, ...rest } = options;
  // No `isHostMessage` override: `init` is already in the default allow-list,
  // and the surface rides `init` rather than a message of its own.
  return attachStageHost(app, {
    ...rest,
    onMessageSeen: (message) => {
      const surface = hostSurfaceOf(message);
      if (surface) onSurface(surface);
    },
  });
}

export { postStageReady as postPageReady };
