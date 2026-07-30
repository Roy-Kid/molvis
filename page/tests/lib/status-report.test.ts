import { describe, expect, it } from "@rstest/core";
import {
  formatStatusLine,
  reportStatus,
  type StatusReport,
  statusTypeFromPhase,
  subscribeStatus,
} from "../../src/lib/status-report";

describe("status-report", () => {
  it("maps operation phases to status bar tones", () => {
    expect(statusTypeFromPhase("running")).toBe("info");
    expect(statusTypeFromPhase("success")).toBe("success");
    expect(statusTypeFromPhase("error")).toBe("error");
  });

  it("formats a single status line with optional detail", () => {
    expect(formatStatusLine("Ready")).toBe("Ready");
    expect(formatStatusLine("3D structure ready", "Click the canvas.")).toBe(
      "3D structure ready — Click the canvas.",
    );
  });

  it("notifies subscribers and unsubscribes cleanly", () => {
    const received: StatusReport[] = [];
    const unsub = subscribeStatus((report) => {
      received.push(report);
    });
    reportStatus("Hello", "success");
    expect(received).toEqual([{ text: "Hello", type: "success" }]);
    unsub();
    reportStatus("Again", "info");
    expect(received).toHaveLength(1);
  });
});
