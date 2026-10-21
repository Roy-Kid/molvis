import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

/** Build-only pin; never part of the published molrs runtime API. */
interface MolrsPin {
  repository: string;
  revision: string;
  toolchain: string;
  wasmPackVersion: string;
}

/** Materialize the pinned development WASM package before compiling its consumers. */
export class MolrsBuild {
  constructor(private readonly root: string) {}

  ensure(): void {
    const pin: MolrsPin = JSON.parse(
      readFileSync(join(this.root, "core/package.json"), "utf8"),
    ).molrsDevelopment;
    if (!pin || !/^[0-9a-f]{40}$/.test(pin.revision)) {
      throw new Error("molrsDevelopment must pin a full Git commit SHA");
    }
    const installed = join(this.root, "node_modules/@molcrafts/molrs");
    const marker = join(installed, ".molvis-development-build.json");
    const fingerprint = JSON.stringify({ ...pin, profile: "release-no-opt" });
    const artifacts = [
      "package.json",
      "molrs.js",
      "molrs_bg.js",
      "molrs.d.ts",
      "molrs_bg.wasm",
    ];
    if (
      existsSync(marker) &&
      readFileSync(marker, "utf8") === fingerprint &&
      artifacts.every((name) => existsSync(join(installed, name)))
    )
      return;

    const cache = join(this.root, ".cache/molrs");
    mkdirSync(cache, { recursive: true });
    const lock = join(cache, "building");
    // A second build must not replace package files while the first writes them.
    try {
      mkdirSync(lock);
    } catch (error) {
      throw new Error(
        `MolRS build is already running, or left a stale lock: ${lock}`,
        { cause: error },
      );
    }
    try {
      const source = join(cache, pin.revision);
      if (!existsSync(source)) {
        const checkout = join(lock, "source");
        execFileSync("git", ["init", "--quiet", checkout]);
        execFileSync(
          "git",
          [
            "-C",
            checkout,
            "fetch",
            "--depth",
            "1",
            pin.repository,
            pin.revision,
          ],
          { stdio: "inherit" },
        );
        execFileSync("git", [
          "-C",
          checkout,
          "checkout",
          "--quiet",
          "--detach",
          pin.revision,
        ]);
        // Copy only after a complete checkout; failed fetches leave no cached source.
        renameSync(checkout, source);
      }
      const head = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim();
      const dirty = execFileSync(
        "git",
        ["-C", source, "status", "--porcelain"],
        { encoding: "utf8" },
      ).trim();
      if (head !== pin.revision || dirty) {
        throw new Error(`Pinned MolRS source cache was modified: ${source}`);
      }

      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) =>
            !/^(RUSTFLAGS|CARGO_ENCODED_RUSTFLAGS|CARGO_BUILD_TARGET|CARGO_TARGET_.*_RUSTFLAGS|CARGO_PROFILE_.*)$/.test(
              key,
            ),
        ),
      );
      env.RUSTUP_TOOLCHAIN = pin.toolchain;
      env.CARGO_TARGET_DIR = join(cache, "target");
      const options = { cwd: source, env, stdio: "inherit" as const };
      execFileSync(
        "rustup",
        [
          "toolchain",
          "install",
          pin.toolchain,
          "--profile",
          "minimal",
          "--target",
          "wasm32-unknown-unknown",
          "--no-self-update",
        ],
        options,
      );

      let wasmPack = "wasm-pack";
      let version = "";
      try {
        version = execFileSync(wasmPack, ["--version"], {
          encoding: "utf8",
        }).trim();
      } catch {
        // Install the pinned tool below when no global wasm-pack is available.
      }
      if (version !== `wasm-pack ${pin.wasmPackVersion}`) {
        const tools = join(cache, "tools", pin.wasmPackVersion);
        wasmPack = join(
          tools,
          "bin",
          process.platform === "win32" ? "wasm-pack.exe" : "wasm-pack",
        );
        if (!existsSync(wasmPack)) {
          execFileSync(
            "cargo",
            [
              "install",
              "wasm-pack",
              "--version",
              pin.wasmPackVersion,
              "--locked",
              "--root",
              tools,
            ],
            options,
          );
        }
        const installedVersion = execFileSync(wasmPack, ["--version"], {
          encoding: "utf8",
        }).trim();
        if (installedVersion !== `wasm-pack ${pin.wasmPackVersion}`) {
          throw new Error(
            `Expected wasm-pack ${pin.wasmPackVersion}, got ${installedVersion}`,
          );
        }
      }
      const output = join(lock, "package");
      execFileSync(
        wasmPack,
        [
          "build",
          "molrs-wasm",
          "--release",
          "--no-opt",
          "--target",
          "bundler",
          "--scope",
          "molcrafts",
          "--out-name",
          "molrs",
          "--out-dir",
          output,
          "--locked",
        ],
        options,
      );
      if (!artifacts.every((name) => existsSync(join(output, name)))) {
        throw new Error(
          "Pinned MolRS build did not produce a complete npm package",
        );
      }
      const previous = join(lock, "previous");
      if (existsSync(installed)) renameSync(installed, previous);
      try {
        renameSync(output, installed);
      } catch (error) {
        if (existsSync(previous)) renameSync(previous, installed);
        throw error;
      }
      writeFileSync(marker, fingerprint);
    } finally {
      rmSync(lock, { recursive: true, force: true });
    }
  }
}
