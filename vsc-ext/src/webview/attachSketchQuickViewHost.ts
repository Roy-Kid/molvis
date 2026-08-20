/**
 * Host bridge for the Sketch editor tab and Sketch Quick look.
 *
 * Parallel to {@link attachQuickViewHost} for stage — no `page/` imports.
 * Handles init / loadFile / selectAtoms and publishes the sidebar outline.
 */

import type { SketchComposer } from "@molcrafts/molvis-sketch";
import type { HostToWebviewMessage, WebviewToHostMessage } from "../protocol";
import { tryParseMolV2000 } from "./mol_v2000";
import { buildSketchOutline } from "./sketchOutline";

export type SketchHost = {
  postMessage: (message: WebviewToHostMessage) => void;
};

export type SketchQuickViewHostHandle = {
  dispose: () => void;
};

/** Host → sketch messages the Sketch surfaces understand. */
export const SKETCH_QUICK_VIEW_HOST_MESSAGE_TYPES = [
  "init",
  "applySettings",
  "loadFile",
  "triggerSave",
  "selectAtoms",
  "error",
] as const;

export { tryParseMolV2000 } from "./mol_v2000";

function payloadToText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (content instanceof Uint8Array) {
    try {
      return new TextDecoder("utf-8", { fatal: false }).decode(content);
    } catch {
      return null;
    }
  }
  return null;
}

function publishOutline(composer: SketchComposer, host: SketchHost): void {
  host.postMessage({
    type: "structureOutline",
    outline: buildSketchOutline(composer.board.getMoleculeData()),
  });
}

export function attachSketchQuickViewHost(
  composer: SketchComposer,
  options: { host: SketchHost },
): SketchQuickViewHostHandle {
  const { host } = options;
  const unsubscribe = composer.board.subscribe(() => {
    publishOutline(composer, host);
  });

  const onMessage = (event: MessageEvent): void => {
    const msg = event.data as HostToWebviewMessage | undefined;
    if (!msg || typeof msg !== "object" || !("type" in msg)) return;

    switch (msg.type) {
      case "init":
      case "applySettings":
        break;
      case "loadFile": {
        const text = payloadToText(msg.content);
        if (!text) break;
        const data = tryParseMolV2000(text);
        if (data) {
          composer.board.loadMoleculeData(data);
        }
        break;
      }
      case "selectAtoms":
        composer.board.replaceSelectedAtoms(msg.indices);
        break;
      case "triggerSave":
        break;
      case "error":
        break;
      default:
        break;
    }
  };

  window.addEventListener("message", onMessage);

  return {
    dispose() {
      unsubscribe();
      window.removeEventListener("message", onMessage);
    },
  };
}

export function postSketchQuickViewReady(host: SketchHost): void {
  host.postMessage({ type: "ready" });
}
