import { describe, expect, it } from "@rstest/core";
import { StatusPanel } from "../../../src/ui/panels/status_panel";

function mounted(): { panel: StatusPanel; host: HTMLElement } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const panel = new StatusPanel();
  panel.mount(host);
  return { panel, host };
}

describe("StatusPanel", () => {
  it("renders a message and stays hidden until there is one", () => {
    const { panel, host } = mounted();
    expect(panel.element.classList.contains("visible")).toBe(false);

    panel.update({ text: "Reading big.data (74.3 MB)…", type: "info" });

    expect(panel.element.classList.contains("visible")).toBe(true);
    expect(panel.element.textContent).toContain("Reading big.data");
    panel.unmount();
    host.remove();
  });

  it("shows a progress track only while a run reports progress", () => {
    const { panel, host } = mounted();

    panel.update({ text: "Minimizing…", type: "info", progress: 42 });
    const bar = panel.element.querySelector<HTMLElement>(
      ".molvis-status-panel__bar",
    );
    expect(panel.element.classList.contains("has-progress")).toBe(true);
    expect(bar?.style.width).toBe("42%");

    // A terminal beat drops the track rather than freezing it at 42%.
    panel.update({ text: "Done", type: "success" });
    expect(panel.element.classList.contains("has-progress")).toBe(false);
    panel.unmount();
    host.remove();
  });

  it("clamps progress to the 0-100 track", () => {
    const { panel, host } = mounted();
    const bar = () =>
      panel.element.querySelector<HTMLElement>(".molvis-status-panel__bar")
        ?.style.width;

    panel.update({ text: "over", type: "info", progress: 180 });
    expect(bar()).toBe("100%");
    panel.update({ text: "under", type: "info", progress: -20 });
    expect(bar()).toBe("0%");
    panel.unmount();
    host.remove();
  });

  it("marks the severity so an error does not read as normal progress", () => {
    const { panel, host } = mounted();
    panel.update({ text: "Failed to load", type: "error" });
    expect(panel.element.dataset.type).toBe("error");
    panel.unmount();
    host.remove();
  });

  it("hides on an empty message instead of leaving a blank line up", () => {
    const { panel, host } = mounted();
    panel.update({ text: "something", type: "info" });
    panel.update({ text: "   ", type: "info" });
    expect(panel.element.classList.contains("visible")).toBe(false);
    panel.unmount();
    host.remove();
  });
});
