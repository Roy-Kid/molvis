import { describe, expect, it } from "@rstest/core";
import type { PluginAPI } from "../src/contract";
import { MolvisPlugin } from "../src/MolvisPlugin";
import { fakePluginAPI } from "../src/testing";

class ProbePlugin extends MolvisPlugin {
  readonly id = "com.example.probe";
  readonly name = "Probe";
  readonly version = "0.0.1";
  activated = 0;
  deactivated = 0;

  activate(_api: PluginAPI): void {
    this.activated += 1;
  }

  deactivate(_api: PluginAPI): void {
    this.deactivated += 1;
  }
}

describe("MolvisPlugin", () => {
  it("wires activate and deactivate through the base class", async () => {
    const plugin = new ProbePlugin();
    const api = fakePluginAPI({ pluginId: plugin.id });
    await plugin.activate(api);
    await plugin.deactivate(api);
    expect(plugin.activated).toBe(1);
    expect(plugin.deactivated).toBe(1);
  });

  it("default deactivate is a no-op", async () => {
    class Bare extends MolvisPlugin {
      readonly id = "com.example.bare";
      readonly name = "Bare";
      readonly version = "1";
      activate(_api: PluginAPI): void {}
    }
    const plugin = new Bare();
    expect(plugin.deactivate(fakePluginAPI())).toBeUndefined();
  });
});
