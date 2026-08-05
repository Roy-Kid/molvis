import type { Molvis } from "@molcrafts/molvis-stage";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatProgressSuffix,
  type StatusReportType,
  subscribeStatus,
} from "@/lib/status-report";

/** How long info/success activity stays before the left region goes blank. */
const AUTO_CLEAR_MS = 5000;

export interface StatusActivity {
  /** Empty when idle — no "Ready" placeholder. */
  text: string;
  type: StatusReportType;
  /** Optional 0–100 for long-running work. */
  progress?: number;
  /** Monotonic key so the bar can re-pulse on repeated identical messages. */
  pulse: number;
}

/**
 * Left-region activity for the bottom status bar.
 *
 * Sources: page status bus, `status-message` events, frame-load / analysis
 * progress, and global browser errors. Idle is blank (never "Ready").
 * Warnings and errors stay until {@link dismissActivity} (or a new report).
 */
export function useStatusMessage(app: Molvis | null): {
  activity: StatusActivity;
  dismissActivity: () => void;
} {
  const [text, setText] = useState("");
  const [type, setType] = useState<StatusReportType>("info");
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [pulse, setPulse] = useState(0);
  const statusResetTimer = useRef<number | null>(null);
  /** Active analysis run id while progress events are streaming. */
  const analysisRunRef = useRef<string | null>(null);

  const clearTimer = useCallback(() => {
    if (statusResetTimer.current) {
      window.clearTimeout(statusResetTimer.current);
      statusResetTimer.current = null;
    }
  }, []);

  const clearActivity = useCallback(() => {
    clearTimer();
    setText("");
    setType("info");
    setProgress(undefined);
  }, [clearTimer]);

  const applyStatus = useCallback(
    (nextText: string, nextType: StatusReportType, nextProgress?: number) => {
      const trimmed = nextText.trim();
      if (!trimmed) {
        clearActivity();
        return;
      }

      setText(trimmed);
      setType(nextType);
      setProgress(nextProgress);
      setPulse((n) => n + 1);
      clearTimer();

      // Transient tips: success / info (without active progress) auto-clear.
      // Warnings and errors persist until dismissed or replaced.
      if (
        (nextType === "info" || nextType === "success") &&
        nextProgress === undefined
      ) {
        statusResetTimer.current = window.setTimeout(() => {
          setText("");
          setType("info");
          setProgress(undefined);
          statusResetTimer.current = null;
        }, AUTO_CLEAR_MS);
      }
    },
    [clearActivity, clearTimer],
  );

  const dismissActivity = useCallback(() => {
    clearActivity();
  }, [clearActivity]);

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      applyStatus(`Error: ${event.message}`, "error");
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      let msg = "Unknown error";
      if (event.reason instanceof Error) {
        msg = event.reason.message;
      } else if (typeof event.reason === "string") {
        msg = event.reason;
      }
      applyStatus(`Async Error: ${msg}`, "error");
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [applyStatus]);

  useEffect(() => {
    return subscribeStatus(({ text: next, type: nextType, progress: p }) => {
      applyStatus(next, nextType, p);
    });
  }, [applyStatus]);

  useEffect(() => {
    if (!app) {
      clearActivity();
      return;
    }

    const handleStatus = (event: {
      text: string;
      type: "info" | "error" | "success" | "warning";
    }) => {
      applyStatus(event.text, event.type);
    };

    const handleFrameLoadStart = (payload: {
      frameId: number;
      requestId: number;
    }) => {
      applyStatus(`Loading frame ${payload.frameId + 1}…`, "info");
    };

    const handleFrameLoadEnd = (payload: {
      frameId: number;
      requestId: number;
      success: boolean;
    }) => {
      if (payload.success) {
        // Don't spam the bar on every scrub; only clear a prior load line.
        setText((current) =>
          current.startsWith("Loading frame") ? "" : current,
        );
        setProgress(undefined);
      } else {
        applyStatus(`Failed to load frame ${payload.frameId + 1}`, "error");
      }
    };

    const handleAnalysisProgress = (payload: {
      runId: string;
      completed: number;
      total: number;
      frameIndex: number;
    }) => {
      analysisRunRef.current = payload.runId;
      const pct =
        payload.total > 0
          ? Math.round((payload.completed / payload.total) * 100)
          : undefined;
      const base =
        payload.total > 0
          ? `Analyzing frame ${payload.frameIndex + 1} (${payload.completed}/${payload.total})`
          : `Analyzing frame ${payload.frameIndex + 1}…`;
      applyStatus(base, "info", pct);
    };

    const handleAnalysisComplete = (payload: { runId: string }) => {
      if (
        analysisRunRef.current !== null &&
        analysisRunRef.current !== payload.runId
      ) {
        return;
      }
      analysisRunRef.current = null;
      applyStatus("Analysis complete", "success");
    };

    const handleAnalysisError = (payload: {
      runId: string;
      error: Error;
      frameIndex?: number;
    }) => {
      if (
        analysisRunRef.current !== null &&
        analysisRunRef.current !== payload.runId
      ) {
        return;
      }
      analysisRunRef.current = null;
      applyStatus(
        `Analysis failed${payload.frameIndex !== undefined ? ` at frame ${payload.frameIndex + 1}` : ""}: ${payload.error.message}`,
        "error",
      );
    };

    app.events.on("status-message", handleStatus);
    app.events.on("frame-load-start", handleFrameLoadStart);
    app.events.on("frame-load-end", handleFrameLoadEnd);
    app.events.on("analysis-progress", handleAnalysisProgress);
    app.events.on("analysis-complete", handleAnalysisComplete);
    app.events.on("analysis-error", handleAnalysisError);

    return () => {
      app.events.off("status-message", handleStatus);
      app.events.off("frame-load-start", handleFrameLoadStart);
      app.events.off("frame-load-end", handleFrameLoadEnd);
      app.events.off("analysis-progress", handleAnalysisProgress);
      app.events.off("analysis-complete", handleAnalysisComplete);
      app.events.off("analysis-error", handleAnalysisError);
      clearTimer();
    };
  }, [app, applyStatus, clearActivity, clearTimer]);

  return {
    activity: {
      text: text ? `${text}${formatProgressSuffix(progress)}` : "",
      type,
      progress,
      pulse,
    },
    dismissActivity,
  };
}
