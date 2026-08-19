import { describe, expect, it } from "@rstest/core";
import { HostRangeSource } from "../../../src/io/sources/host_range_source";

describe("HostRangeSource", () => {
  it("forwards size and readRange and reports kind host", async () => {
    const src = new HostRangeSource({
      size: async () => 10,
      readRange: async (start, end) =>
        new Uint8Array([start, end] as unknown as number[]),
    });
    expect(src.kind).toBe("host");
    expect(await src.size()).toBe(10);
    expect(Array.from(await src.readRange(2, 6))).toEqual([2, 6]);
  });
});
