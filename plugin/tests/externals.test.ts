import { describe, expect, it } from "@rstest/core";
import { PLUGIN_HOST_MODULE_IDS, pluginExternals } from "../src/externals";

describe("PLUGIN_HOST_MODULE_IDS", () => {
  it("externalizes the host inject surface", () => {
    expect(PLUGIN_HOST_MODULE_IDS).toContain("react");
    expect(PLUGIN_HOST_MODULE_IDS).toContain("react-dom");
    expect(PLUGIN_HOST_MODULE_IDS).toContain("@molcrafts/molvis-core/molrs");
    expect(PLUGIN_HOST_MODULE_IDS).toContain("@molcrafts/molvis-stage");
    expect(PLUGIN_HOST_MODULE_IDS).toContain("@molcrafts/molvis-plugin");
    expect(PLUGIN_HOST_MODULE_IDS).toContain("@molcrafts/molvis-plugin/ui");
  });

  it("maps every id to itself for rspack externals", () => {
    for (const id of PLUGIN_HOST_MODULE_IDS) {
      expect(pluginExternals[id]).toBe(id);
    }
  });
});
