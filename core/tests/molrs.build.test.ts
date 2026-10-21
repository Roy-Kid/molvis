import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import { MolrsBuild } from "../molrs.build";

rs.mock("node:child_process", () => ({ execFileSync: rs.fn() }));

const pin = {
  repository: "https://example.invalid/molrs.git",
  revision: "a".repeat(40),
  toolchain: "1.99.1",
  wasmPackVersion: "0.15.0",
};
const artifacts = [
  "package.json",
  "molrs.js",
  "molrs_bg.js",
  "molrs.d.ts",
  "molrs_bg.wasm",
];

describe("MolrsBuild", () => {
  let root: string;
  let installed: string;
  let marker: string;
  let failBuild: boolean;
  let dirty: boolean;
  let toolVersion: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "molvis-molrs-build-"));
    installed = join(root, "node_modules/@molcrafts/molrs");
    marker = join(installed, ".molvis-development-build.json");
    mkdirSync(join(root, "core"));
    mkdirSync(installed, { recursive: true });
    writeFileSync(
      join(root, "core/package.json"),
      JSON.stringify({ molrsDevelopment: pin }),
    );
    for (const name of artifacts)
      writeFileSync(join(installed, name), "registry");
    failBuild = false;
    dirty = false;
    toolVersion = "wasm-pack 0.15.0";
    rs.mocked(execFileSync).mockReset();
    rs.mocked(execFileSync).mockImplementation((file, args) => {
      const command = Array.isArray(args) ? args : [];
      if (file === "git" && command[0] === "init")
        mkdirSync(String(command[2]));
      if (command.includes("rev-parse")) return pin.revision as never;
      if (command.includes("status"))
        return (dirty ? " M Cargo.lock" : "") as never;
      if (command[0] === "--version")
        return (
          file === "wasm-pack" ? toolVersion : "wasm-pack 0.15.0"
        ) as never;
      if (command[0] === "build") {
        if (failBuild) throw new Error("compilation failed");
        const output = String(command[command.indexOf("--out-dir") + 1]);
        mkdirSync(output);
        for (const name of artifacts)
          writeFileSync(join(output, name), "pinned");
      }
      return "" as never;
    });
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("requires an immutable full SHA instead of a moving branch", () => {
    writeFileSync(
      join(root, "core/package.json"),
      JSON.stringify({ molrsDevelopment: { ...pin, revision: "dev" } }),
    );
    expect(() => new MolrsBuild(root).ensure()).toThrow(/full Git commit/);
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("builds an isolated pinned source with locked tools and caches the result", () => {
    writeFileSync(join(installed, "stale.js"), "old package file");
    new MolrsBuild(root).ensure();
    expect(execFileSync).toHaveBeenCalledWith(
      "git",
      [
        "-C",
        join(root, ".cache/molrs/building/source"),
        "fetch",
        "--depth",
        "1",
        pin.repository,
        pin.revision,
      ],
      { stdio: "inherit" },
    );
    expect(execFileSync).toHaveBeenCalledWith(
      "wasm-pack",
      expect.arrayContaining(["--release", "--no-opt", "--locked"]),
      expect.objectContaining({
        cwd: join(root, ".cache/molrs", pin.revision),
        env: expect.objectContaining({ RUSTUP_TOOLCHAIN: pin.toolchain }),
      }),
    );
    expect(readFileSync(join(installed, "molrs.d.ts"), "utf8")).toBe("pinned");
    expect(existsSync(join(installed, "stale.js"))).toBe(false);
    expect(JSON.parse(readFileSync(marker, "utf8"))).toEqual({
      ...pin,
      profile: "release-no-opt",
    });
    expect(existsSync(join(root, ".cache/molrs/building"))).toBe(false);
    rs.mocked(execFileSync).mockClear();
    new MolrsBuild(root).ensure();
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("rebuilds after npm ci removes the provenance marker", () => {
    new MolrsBuild(root).ensure();
    rmSync(marker);
    writeFileSync(join(installed, "molrs.d.ts"), "registry");
    rs.mocked(execFileSync).mockClear();
    new MolrsBuild(root).ensure();
    expect(execFileSync).toHaveBeenCalledWith(
      "wasm-pack",
      expect.arrayContaining(["build"]),
      expect.anything(),
    );
    expect(readFileSync(join(installed, "molrs.d.ts"), "utf8")).toBe("pinned");
  });

  it("repairs a cached package missing its WASM binary", () => {
    new MolrsBuild(root).ensure();
    rmSync(join(installed, "molrs_bg.wasm"));
    new MolrsBuild(root).ensure();
    expect(readFileSync(join(installed, "molrs_bg.wasm"), "utf8")).toBe(
      "pinned",
    );
  });

  it("keeps the installed package intact and releases its lock on build failure", () => {
    failBuild = true;
    expect(() => new MolrsBuild(root).ensure()).toThrow(/compilation failed/);
    expect(readFileSync(join(installed, "molrs.d.ts"), "utf8")).toBe(
      "registry",
    );
    expect(existsSync(marker)).toBe(false);
    expect(existsSync(join(root, ".cache/molrs/building"))).toBe(false);
  });

  it("refuses a simultaneous build without deleting the other build's lock", () => {
    const lock = join(root, ".cache/molrs/building");
    mkdirSync(lock, { recursive: true });
    expect(() => new MolrsBuild(root).ensure()).toThrow(/already running/);
    expect(existsSync(lock)).toBe(true);
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("refuses modified cached source rather than compiling unpinned changes", () => {
    new MolrsBuild(root).ensure();
    rmSync(marker);
    dirty = true;
    expect(() => new MolrsBuild(root).ensure()).toThrow(
      /source cache was modified/,
    );
    expect(existsSync(marker)).toBe(false);
  });

  it("installs the exact wasm-pack version when the global version differs", () => {
    toolVersion = "wasm-pack 0.14.0";
    new MolrsBuild(root).ensure();
    expect(execFileSync).toHaveBeenCalledWith(
      "cargo",
      [
        "install",
        "wasm-pack",
        "--version",
        pin.wasmPackVersion,
        "--locked",
        "--root",
        join(root, ".cache/molrs/tools", pin.wasmPackVersion),
      ],
      expect.anything(),
    );
  });
});
