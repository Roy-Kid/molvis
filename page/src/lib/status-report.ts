/**
 * Lightweight status bus for UI tips that should land in the bottom status bar
 * without requiring an app reference (e.g. pipeline toasts outside the engine).
 *
 * Prefer `app.events.emit("status-message", …)` when a Molvis instance is
 * available so host bridges still see the event. This bus is the dual path for
 * React-only surfaces; {@link useStatusMessage} listens to both.
 */

export type StatusReportType = "info" | "error" | "success";

export interface StatusReport {
  text: string;
  type: StatusReportType;
}

type StatusListener = (report: StatusReport) => void;

const listeners = new Set<StatusListener>();

/** Publish a one-line tip for the bottom status bar. */
export function reportStatus(
  text: string,
  type: StatusReportType = "info",
): void {
  const report: StatusReport = { text, type };
  for (const listener of listeners) {
    listener(report);
  }
}

/** Subscribe to status reports. Returns an unsubscribe function. */
export function subscribeStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Map a viewer-operation phase to a status-bar tone. */
export function statusTypeFromPhase(
  phase: "running" | "success" | "error",
): StatusReportType {
  if (phase === "error") return "error";
  if (phase === "success") return "success";
  return "info";
}

/** Format operation feedback as a single status-bar line. */
export function formatStatusLine(message: string, detail?: string): string {
  if (detail?.trim()) return `${message} — ${detail}`;
  return message;
}
