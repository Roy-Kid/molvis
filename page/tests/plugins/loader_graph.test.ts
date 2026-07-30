import { describe, expect, it } from "@rstest/core";
import { rewriteModuleGraph } from "../../src/plugins/loader";

describe("plugin multi-chunk loader", () => {
  it("rewriteModuleGraph rewrites relative imports and caches entry", async () => {
    const sources = new Map<string, string>([
      [
        "https://cdn.example.com/pkg/dist/plugin.js",
        `import { helper } from "./helper.js";
export default { id: "t", activate() { return helper(); } };`,
      ],
      [
        "https://cdn.example.com/pkg/dist/helper.js",
        `export function helper() { return 42; }`,
      ],
    ]);
    const fetched: string[] = [];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      fetched.push(url);
      const body = sources.get(url);
      if (!body) {
        return new Response(`missing ${url}`, { status: 404 });
      }
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/javascript" },
      });
    }) as typeof fetch;

    try {
      const blobUrl = await rewriteModuleGraph(
        "https://cdn.example.com/pkg/dist/plugin.js",
      );
      expect(blobUrl.startsWith("blob:")).toBe(true);
      // Entry + one relative chunk.
      expect(fetched).toContain("https://cdn.example.com/pkg/dist/plugin.js");
      expect(fetched).toContain("https://cdn.example.com/pkg/dist/helper.js");

      // Second call is cache-hit (no extra network for entry).
      const n = fetched.length;
      const again = await rewriteModuleGraph(
        "https://cdn.example.com/pkg/dist/plugin.js",
      );
      expect(again).toBe(blobUrl);
      expect(fetched.length).toBe(n);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
