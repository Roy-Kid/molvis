import { afterEach, beforeAll, describe, expect, it } from "@rstest/core";
import { MolvisTrajectoryPanel } from "../../src/ui/panels/trajectory_panel";

describe("MolvisTrajectoryPanel scanning HUD", () => {
  beforeAll(() => {
    if (!customElements.get("molvis-trajectory-panel")) {
      customElements.define("molvis-trajectory-panel", MolvisTrajectoryPanel);
    }
  });

  afterEach(() => {
    for (const node of document.querySelectorAll("molvis-trajectory-panel")) {
      node.remove();
    }
  });

  function mount(): MolvisTrajectoryPanel {
    const el = document.createElement(
      "molvis-trajectory-panel",
    ) as MolvisTrajectoryPanel;
    document.body.append(el);
    return el;
  }

  function readout(el: MolvisTrajectoryPanel): {
    current: string;
    total: string;
    hidden: boolean;
  } {
    return {
      current: el.shadowRoot?.getElementById("current")?.textContent ?? "",
      total: el.shadowRoot?.getElementById("total")?.textContent ?? "",
      hidden: el.hasAttribute("hidden") || el.style.display === "none",
    };
  }

  it("shows 0/0… while scanning before any frame is indexed", () => {
    const el = mount();
    el.scanning = true;
    el.length = 0;
    expect(readout(el)).toEqual({ current: "0", total: "0…", hidden: false });
  });

  it("stays visible at 1 indexed frame while scanning", () => {
    const el = mount();
    el.scanning = true;
    el.length = 1;
    expect(readout(el)).toEqual({ current: "1", total: "1…", hidden: false });
  });

  it("unhides when scanning starts after the empty 1-frame boot", () => {
    const el = mount();
    el.length = 1;
    expect(readout(el).hidden).toBe(true);
    el.scanning = true;
    el.length = 0;
    expect(readout(el)).toEqual({ current: "0", total: "0…", hidden: false });
  });

  it("hides a complete 1-frame trajectory", () => {
    const el = mount();
    el.scanning = false;
    el.length = 1;
    expect(readout(el).hidden).toBe(true);
  });

  it("shows complete multi-frame as current/total without ellipsis", () => {
    const el = mount();
    el.scanning = false;
    el.length = 40;
    el.current = 2;
    expect(readout(el)).toEqual({ current: "3", total: "40", hidden: false });
  });

  it("grows the total with an ellipsis while scanning", () => {
    const el = mount();
    el.scanning = true;
    el.length = 12;
    el.current = 0;
    expect(readout(el)).toEqual({ current: "1", total: "12…", hidden: false });
  });

  it("sits above the bottom-left hover info readout", () => {
    const el = mount();
    el.setViewportSize(800, 900);
    expect(el.style.getPropertyValue("--traj-bottom")).toBe("45px");
  });

  it("never drops below the info-readout clearance floor", () => {
    const el = mount();
    el.setViewportSize(800, 400);
    expect(el.style.getPropertyValue("--traj-bottom")).toBe("44px");
  });
});
