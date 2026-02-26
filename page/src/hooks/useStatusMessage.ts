import type { Molvis } from "@molvis/core";
import { useEffect, useRef, useState } from "react";

const DEFAULT_STATUS_MESSAGE = "Ready";
type StatusType = "info" | "error";

/**
 * Manages status bar text/type from both app events and global browser errors.
 */
export function useStatusMessage(app: Molvis | null): {
  statusMessage: string;
  statusType: StatusType;
} {
  const [statusMessage, setStatusMessage] = useState<string>(
    DEFAULT_STATUS_MESSAGE,
  );
  const [statusType, setStatusType] = useState<StatusType>("info");
  const statusResetTimer = useRef<number | null>(null);

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      setStatusMessage(`Error: ${event.message}`);
      setStatusType("error");
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      let msg = "Unknown error";
      if (event.reason instanceof Error) {
        msg = event.reason.message;
      } else if (typeof event.reason === "string") {
        msg = event.reason;
      }
      setStatusMessage(`Async Error: ${msg}`);
      setStatusType("error");
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  useEffect(() => {
    if (!app) {
      return;
    }

    const handleStatus = (event: { text: string; type: StatusType }) => {
      setStatusMessage(event.text);
      setStatusType(event.type);

      if (statusResetTimer.current) {
        window.clearTimeout(statusResetTimer.current);
        statusResetTimer.current = null;
      }

      if (event.type === "info") {
        statusResetTimer.current = window.setTimeout(() => {
          setStatusMessage(DEFAULT_STATUS_MESSAGE);
          statusResetTimer.current = null;
        }, 5000);
      }
    };

    app.events.on("status-message", handleStatus);

    return () => {
      app.events.off("status-message", handleStatus);
      if (statusResetTimer.current) {
        window.clearTimeout(statusResetTimer.current);
        statusResetTimer.current = null;
      }
    };
  }, [app]);

  return { statusMessage, statusType };
}
