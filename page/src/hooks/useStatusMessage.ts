import type { Molvis } from "@molvis/stage";
import { useCallback, useEffect, useRef, useState } from "react";
import { type StatusReportType, subscribeStatus } from "@/lib/status-report";

const DEFAULT_STATUS_MESSAGE = "Ready";

/** How long info/success messages stay before returning to Ready. */
const AUTO_CLEAR_MS = 5000;

/**
 * Manages status bar text/type from app events, the page status bus, and
 * global browser errors. Success flashes green in the bar; no toast cards.
 */
export function useStatusMessage(app: Molvis | null): {
  statusMessage: string;
  statusType: StatusReportType;
  /** Monotonic key so the bar can re-flash on repeated identical messages. */
  statusPulse: number;
} {
  const [statusMessage, setStatusMessage] = useState<string>(
    DEFAULT_STATUS_MESSAGE,
  );
  const [statusType, setStatusType] = useState<StatusReportType>("info");
  const [statusPulse, setStatusPulse] = useState(0);
  const statusResetTimer = useRef<number | null>(null);

  const applyStatus = useCallback((text: string, type: StatusReportType) => {
    setStatusMessage(text);
    setStatusType(type);
    setStatusPulse((n) => n + 1);

    if (statusResetTimer.current) {
      window.clearTimeout(statusResetTimer.current);
      statusResetTimer.current = null;
    }

    if (type === "info" || type === "success") {
      statusResetTimer.current = window.setTimeout(() => {
        setStatusMessage(DEFAULT_STATUS_MESSAGE);
        setStatusType("info");
        statusResetTimer.current = null;
      }, AUTO_CLEAR_MS);
    }
  }, []);

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
    return subscribeStatus(({ text, type }) => {
      applyStatus(text, type);
    });
  }, [applyStatus]);

  useEffect(() => {
    if (!app) {
      return;
    }

    const handleStatus = (event: {
      text: string;
      type: "info" | "error" | "success";
    }) => {
      applyStatus(event.text, event.type);
    };

    app.events.on("status-message", handleStatus);

    return () => {
      app.events.off("status-message", handleStatus);
      if (statusResetTimer.current) {
        window.clearTimeout(statusResetTimer.current);
        statusResetTimer.current = null;
      }
    };
  }, [app, applyStatus]);

  return { statusMessage, statusType, statusPulse };
}
