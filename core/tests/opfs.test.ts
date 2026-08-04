import { afterEach, describe, expect, it } from "@rstest/core";
import {
  clearOpfsCache,
  fingerprintFile,
  getOpfsBucket,
  isNotFound,
  OPFS_BUCKETS,
  OpfsBlobCache,
  readOpfsCacheUsage,
  safeKey,
} from "../src/opfs";

describe("safeKey", () => {
  it("keeps characters that round-trip on every platform", () => {
    expect(safeKey("run-01.lammpstrj%20a_b.")).toBe("run-01.lammpstrj%20a_b.");
  });

  it("replaces separators that would escape the bucket", () => {
    expect(safeKey("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(safeKey("a b/c")).toBe("a_b_c");
  });
});

describe("fingerprintFile", () => {
  const file = () =>
    new File(["xyz"], "traj file.lammpstrj", { lastModified: 1700000000000 });

  it("keys on name, size, mtime and kind", () => {
    const fp = fingerprintFile(file(), "lammpstrj");
    expect(fp).toContain("traj%20file.lammpstrj");
    expect(fp).toContain("-3-");
    expect(fp).toContain("1700000000000");
    expect(fp.endsWith("-lammpstrj")).toBe(true);
  });

  it("separates the same bytes read as different kinds", () => {
    // Without `kind`, a sketch document and a trajectory of identical
    // name/size/mtime would collide on one cache entry.
    expect(fingerprintFile(file(), "lammpstrj")).not.toBe(
      fingerprintFile(file(), "sketch"),
    );
  });
});

describe("isNotFound", () => {
  it("recognises the OPFS missing-entry error only", () => {
    expect(
      isNotFound(Object.assign(new Error("x"), { name: "NotFoundError" })),
    ).toBe(true);
    expect(isNotFound(new Error("boom"))).toBe(false);
    expect(isNotFound(null)).toBe(false);
  });
});

describe("cache sweep", () => {
  afterEach(async () => {
    await clearOpfsCache();
  });

  it("enumerates every bucket the sweep must visit", () => {
    expect([...OPFS_BUCKETS].sort()).toEqual(["blob", "idx"]);
  });

  it("measures what is stored and frees all of it", async () => {
    await clearOpfsCache();
    expect(await readOpfsCacheUsage()).toEqual({ files: 0, bytes: 0 });

    await OpfsBlobCache.set("fp-a", new Blob(["0123456789"]));
    await OpfsBlobCache.set("fp-b", new Blob(["abc"]));
    expect(await OpfsBlobCache.has("fp-a")).toBe(true);

    const before = await readOpfsCacheUsage();
    expect(before.files).toBe(2);
    expect(before.bytes).toBe(13);

    // Reports what it freed, measured before deletion.
    expect(await clearOpfsCache()).toEqual(before);
    expect(await readOpfsCacheUsage()).toEqual({ files: 0, bytes: 0 });
    expect(await OpfsBlobCache.has("fp-a")).toBe(false);
  });

  it("is idempotent on an already-empty namespace", async () => {
    await clearOpfsCache();
    expect(await clearOpfsCache()).toEqual({ files: 0, bytes: 0 });
  });

  it("recreates the namespace after a clear", async () => {
    await clearOpfsCache();
    // The root is created on demand, so a cleared cache is immediately
    // usable again rather than staying broken until reload.
    expect(await getOpfsBucket("blob")).not.toBeNull();
    await OpfsBlobCache.set("fp-c", new Blob(["z"]));
    expect(await OpfsBlobCache.has("fp-c")).toBe(true);
  });

  it("evicts a single entry without touching the rest", async () => {
    await clearOpfsCache();
    await OpfsBlobCache.set("keep", new Blob(["keep"]));
    await OpfsBlobCache.set("drop", new Blob(["drop"]));
    await OpfsBlobCache.evict("drop");
    expect(await OpfsBlobCache.has("drop")).toBe(false);
    expect(await OpfsBlobCache.has("keep")).toBe(true);
  });
});
