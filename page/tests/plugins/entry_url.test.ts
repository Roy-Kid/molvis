import { describe, expect, it } from "@rstest/core";
import { resolvePluginEntryUrl } from "../../src/plugins/resolve";

const BASE = "https://cdn.jsdelivr.net/gh/owner/repo@v1.0.0/";

describe("resolvePluginEntryUrl", () => {
  it("resolves a relative entry against the package base", () => {
    expect(resolvePluginEntryUrl("dist/plugin.js", BASE)).toBe(
      `${BASE}dist/plugin.js`,
    );
    expect(resolvePluginEntryUrl("./dist/plugin.js", BASE)).toBe(
      `${BASE}dist/plugin.js`,
    );
  });

  it("rejects an absolute entry URL", () => {
    // `new URL(entry, base)` drops the base entirely for an absolute entry,
    // so an unchecked manifest could run code from any origin.
    expect(() =>
      resolvePluginEntryUrl("https://attacker.example/payload.js", BASE),
    ).toThrow(/relative path/);
    expect(() =>
      resolvePluginEntryUrl("//attacker.example/x.js", BASE),
    ).toThrow(/relative path/);
  });

  it("rejects traversal out of the package root", () => {
    expect(() =>
      resolvePluginEntryUrl("../../other-repo/plugin.js", BASE),
    ).toThrow(/escapes its package root/);
  });

  it("rejects an empty entry", () => {
    expect(() => resolvePluginEntryUrl("   ", BASE)).toThrow(/empty/);
  });
});
