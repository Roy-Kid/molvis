import { describe, expect, it } from "@rstest/core";
import {
  fetchLatestGithubReleaseTag,
  resolvePluginSource,
} from "../../src/plugins/resolve";

function mockFetch(
  impl: (url: string) => Promise<{ ok: boolean; body: unknown }>,
): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const { ok, body } = await impl(url);
    return {
      ok,
      json: async () => body,
    } as Response;
  }) as typeof fetch;
}

describe("resolvePluginSource", () => {
  it("owner/repo without tag pins to latest GitHub release", async () => {
    const r = await resolvePluginSource("alice/hello-plugin", {
      fetchImpl: mockFetch(async () => ({
        ok: true,
        body: { tag_name: "v3.1.0" },
      })),
    });
    expect(r.baseUrl).toBe(
      "https://cdn.jsdelivr.net/gh/alice/hello-plugin@v3.1.0/",
    );
    expect(r.manifestUrl).toBe(
      "https://cdn.jsdelivr.net/gh/alice/hello-plugin@v3.1.0/molvis.plugin.json",
    );
    expect(r.resolvedRef).toBe("v3.1.0");
  });

  it("owner/repo without tag falls back to default-branch tip when no release", async () => {
    const r = await resolvePluginSource("alice/hello-plugin", {
      fetchImpl: mockFetch(async () => ({ ok: false, body: {} })),
    });
    expect(r.baseUrl).toBe("https://cdn.jsdelivr.net/gh/alice/hello-plugin/");
    expect(r.resolvedRef).toBeUndefined();
  });

  it("resolves owner/repo@tag without calling GitHub API", async () => {
    let called = false;
    const r = await resolvePluginSource("alice/hello-plugin@v1.2.3", {
      fetchImpl: mockFetch(async () => {
        called = true;
        return { ok: true, body: { tag_name: "v9.9.9" } };
      }),
    });
    expect(r.baseUrl).toBe(
      "https://cdn.jsdelivr.net/gh/alice/hello-plugin@v1.2.3/",
    );
    expect(r.resolvedRef).toBe("v1.2.3");
    expect(called).toBe(false);
  });

  it("resolves github.com tree URL", async () => {
    const r = await resolvePluginSource(
      "https://github.com/alice/hello-plugin/tree/v2.0.0",
    );
    expect(r.baseUrl).toContain("alice/hello-plugin@v2.0.0");
    expect(r.resolvedRef).toBe("v2.0.0");
  });

  it("resolves direct manifest URL", async () => {
    const r = await resolvePluginSource(
      "https://cdn.example.com/pkg/molvis.plugin.json",
    );
    expect(r.baseUrl).toBe("https://cdn.example.com/pkg/");
    expect(r.manifestUrl).toBe(
      "https://cdn.example.com/pkg/molvis.plugin.json",
    );
  });

  it("rejects empty input", async () => {
    await expect(resolvePluginSource("  ")).rejects.toThrow(/empty/i);
  });

  it("resolves local HTTP base URL for debug serving", async () => {
    const r = await resolvePluginSource("http://127.0.0.1:4173/");
    expect(r.baseUrl).toBe("http://127.0.0.1:4173/");
    expect(r.manifestUrl).toBe("http://127.0.0.1:4173/molvis.plugin.json");
  });

  it("resolves local HTTP entry URL", async () => {
    const r = await resolvePluginSource("http://localhost:4174/dist/plugin.js");
    expect(r.baseUrl).toBe("http://localhost:4174/dist/");
    expect(r.manifestUrl).toBe("http://localhost:4174/dist/molvis.plugin.json");
  });

  it("rejects file:// and bare filesystem paths", async () => {
    await expect(
      resolvePluginSource("file:///Users/me/plugin/dist/plugin.js"),
    ).rejects.toThrow(/filesystem|HTTP/i);
    await expect(resolvePluginSource("/Users/me/plugin")).rejects.toThrow(
      /filesystem|HTTP/i,
    );
  });
});

describe("fetchLatestGithubReleaseTag", () => {
  it("returns tag_name on success", async () => {
    const tag = await fetchLatestGithubReleaseTag(
      "o",
      "r",
      mockFetch(async () => ({
        ok: true,
        body: { tag_name: "v0.2.0" },
      })),
    );
    expect(tag).toBe("v0.2.0");
  });

  it("returns null on network failure", async () => {
    const tag = await fetchLatestGithubReleaseTag("o", "r", (async () => {
      throw new Error("offline");
    }) as typeof fetch);
    expect(tag).toBeNull();
  });
});
