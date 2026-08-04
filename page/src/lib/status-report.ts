/**
 * Lightweight status bus for UI tips that should land in the bottom status bar
 * without requiring an app reference (e.g. pipeline feedback outside the engine).
 *
 * Prefer `app.events.emit("status-message", …)` when a Molvis instance is
 * available so host bridges still see the event. This bus is the dual path for
 * React-only surfaces; {@link useStatusMessage} listens to both.
 */

export type StatusReportType = "info" | "error" | "success" | "warning";

export interface StatusReport {
  text: string;
  type: StatusReportType;
  /** Optional 0–100 progress for long-running work. */
  progress?: number;
}

type StatusListener = (report: StatusReport) => void;

const listeners = new Set<StatusListener>();

/** Publish a one-line tip for the bottom status bar activity region. */
export function reportStatus(
  text: string,
  type: StatusReportType = "info",
  progress?: number,
): void {
  const report: StatusReport = { text, type };
  if (progress !== undefined && Number.isFinite(progress)) {
    report.progress = Math.max(0, Math.min(100, progress));
  }
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

/** Format optional progress as a compact suffix, e.g. ` 42%`. */
export function formatProgressSuffix(progress?: number): string {
  if (progress === undefined || !Number.isFinite(progress)) return "";
  return ` ${Math.round(Math.max(0, Math.min(100, progress)))}%`;
}
