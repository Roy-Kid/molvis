import { defineConfig } from "@rstest/core";

// Opt-in benchmark config. Run with `npm run bench` (NOT part of `npm test`).
// Benchmarks are plain rstest tests that time hot paths with performance.now()
// — rstest 0.9.x has no native `bench` API, so we measure manually and assert
// generous sanity bounds. Use them to compare before/after an optimization.
export default defineConfig({
  browser: {
    enabled: true,
    name: "chromium",
    headless: true,
  },
  include: ["**/*.bench.?(c|m)[jt]s?(x)"],
});
