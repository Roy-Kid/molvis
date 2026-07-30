import {
  applyBackendState,
  type BackendStateSync,
  DataSourceModifier,
  type Molvis,
} from "@molvis/stage";
import { useCallback, useEffect, useState } from "react";

/**
 * Track ``backend-state-sync`` events emitted when the Python controller
 * finishes a fresh WS handshake and hands over its mirror of the scene.
 *
 * If the local pipeline is effectively empty (no modifiers, or only the
 * ``sourceType === "empty"`` demo seed the page ships with), we apply
 * the backend snapshot silently. Otherwise we surface the pending
 * snapshot so the UI can prompt the user to keep local or use the
 * backend.
 */
export interface PendingStateSync {
  state: BackendStateSync;
  summary: { nModifiers: number; nFrames: number };
}

export interface BackendStateSyncFeedback {
  phase: "running" | "success" | "error";
  message: string;
  detail?: string;
}

export interface UseBackendStateSyncResult {
  pending: PendingStateSync | null;
  feedback: BackendStateSyncFeedback | null;
  applyBackend(): Promise<void>;
  keepLocal(): void;
  dismissFeedback(): void;
}

function isLocalEffectivelyEmpty(app: Molvis): boolean {
  const modifiers = app.modifierPipeline.getModifiers();
  if (modifiers.length === 0) return true;
  if (modifiers.length === 1) {
    const only = modifiers[0];
    if (only instanceof DataSourceModifier && only.sourceType === "empty") {
      return true;
    }
  }
  return false;
}

function hasIncomingState(state: BackendStateSync): boolean {
  return state.frames.length > 0 || state.pipeline.length > 0;
}

function summarizeState(state: BackendStateSync): PendingStateSync["summary"] {
  return {
    nModifiers: state.pipeline.length,
    nFrames: state.frames.length,
  };
}

export function useBackendStateSync(
  app: Molvis | null,
): UseBackendStateSyncResult {
  const [pending, setPending] = useState<PendingStateSync | null>(null);
  const [feedback, setFeedback] = useState<BackendStateSyncFeedback | null>(
    null,
  );

  useEffect(() => {
    if (!app) {
      setPending(null);
      setFeedback(null);
      return;
    }

    const handle = async (state: BackendStateSync) => {
      if (!hasIncomingState(state)) {
        setPending(null);
        setFeedback(null);
        return;
      }
      if (isLocalEffectivelyEmpty(app)) {
        setFeedback({
          phase: "running",
          message: "Applying backend state…",
        });
        try {
          await applyBackendState(app, state);
          setFeedback({
            phase: "success",
            message: "Backend state applied",
            detail: "The molecular scene now matches the Python controller.",
          });
        } catch (err) {
          console.error("[molvis] auto-apply backend state failed:", err);
          setPending({ state, summary: summarizeState(state) });
          setFeedback({
            phase: "error",
            message: "Backend state could not be applied",
            detail: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }
      setPending({
        state,
        summary: summarizeState(state),
      });
      setFeedback(null);
    };

    const off = app.events.on("backend-state-sync", (state) => {
      void handle(state);
    });
    return off;
  }, [app]);

  const applyBackend = useCallback(async () => {
    if (!app || !pending) return;
    setFeedback({
      phase: "running",
      message: "Applying backend state…",
    });
    try {
      await applyBackendState(app, pending.state);
      setPending(null);
      setFeedback({
        phase: "success",
        message: "Backend state applied",
        detail: "The local scene was replaced by the Python controller state.",
      });
    } catch (err) {
      console.error("[molvis] apply backend state failed:", err);
      setFeedback({
        phase: "error",
        message: "Backend state could not be applied",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }, [app, pending]);

  const keepLocal = useCallback(() => {
    setPending(null);
    setFeedback(null);
  }, []);

  const dismissFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  return {
    pending,
    feedback,
    applyBackend,
    keepLocal,
    dismissFeedback,
  };
}
