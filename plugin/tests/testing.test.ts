import { describe, expect, it } from "@rstest/core";
import { fakePluginAPI, mapStorage } from "../src/testing";

describe("mapStorage", () => {
  it("round-trips get/set/remove", () => {
    const backing = new Map<string, string>();
    const storage = mapStorage(backing);
    expect(storage.getItem("k")).toBeNull();
    storage.setItem("k", "v");
    expect(storage.getItem("k")).toBe("v");
    expect(backing.get("k")).toBe("v");
    storage.removeItem("k");
    expect(storage.getItem("k")).toBeNull();
  });
});

describe("fakePluginAPI", () => {
  it("exposes every PluginAPI domain", () => {
    const api = fakePluginAPI();
    for (const key of [
      "app",
      "pluginId",
      "log",
      "storage",
      "modifiers",
      "modes",
      "analysis",
      "commands",
      "dialogs",
      "panels",
      "overlays",
      "settings",
      "caches",
      "rpc",
    ] as const) {
      expect(api[key]).toBeDefined();
    }
  });

  it("keeps other domains when one override is supplied", () => {
    const api = fakePluginAPI({ pluginId: "com.example.over" });
    expect(api.pluginId).toBe("com.example.over");
    expect(typeof api.commands.register).toBe("function");
    expect(typeof api.modifiers.register).toBe("function");
  });
});
