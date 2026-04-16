/**
 * Roundtrip tests for page's WASM-facing serialization helpers.
 *
 * `buildFrame` and `buildBox` are the only direct WASM call sites in page;
 * every other React/UI layer goes through them. These tests check that
 * JSON payloads (the shape the RPC receives from Python/WebSocket peers)
 * land in molrs 0.0.8 with the expected column values and dtypes.
 *
 * Runs under chromium headless (page/rstest.config.ts).
 */

import "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import { buildBox, buildFrame } from "../src/lib/rpc/serialization";
import type {
  SerializedBoxData,
  SerializedFrameData,
} from "../src/lib/rpc/types";

// ── buildFrame ─────────────────────────────────────────────────────────────

describe("buildFrame", () => {
  it("round-trips an atoms block from plain fractional number arrays", () => {
    const payload: SerializedFrameData = {
      blocks: {
        atoms: {
          x: [0.0, 1.5, 0.5],
          y: [0.0, 0.0, 1.25],
          z: [0.0, 0.0, 0.0],
          element: ["O", "H", "H"],
        },
      },
    };

    const frame = buildFrame(payload);
    const atoms = frame.getBlock("atoms");
    expect(atoms).toBeDefined();
    expect(atoms?.nrows()).toBe(3);
    expect(atoms?.dtype("x")).toBe("f64");
    expect(Array.from(atoms?.copyColF("x") ?? [])).toEqual([0.0, 1.5, 0.5]);
    expect(Array.from(atoms?.copyColF("y") ?? [])).toEqual([0.0, 0.0, 1.25]);
    expect(atoms?.copyColStr("element")).toEqual(["O", "H", "H"]);
  });

  it("keeps Float64Array coordinates as f64 (no auto-u32 promotion)", () => {
    // Integer-valued coordinates wrapped in a Float64Array must stay float;
    // only plain number[] arrays auto-promote to u32.
    const payload: SerializedFrameData = {
      blocks: {
        atoms: {
          x: new Float64Array([0, 1, 0]),
          y: new Float64Array([0, 0, 1]),
          z: new Float64Array([0, 0, 0]),
          element: ["O", "H", "H"],
        },
      },
    };

    const frame = buildFrame(payload);
    const atoms = frame.getBlock("atoms");
    expect(atoms?.dtype("x")).toBe("f64");
    expect(Array.from(atoms?.copyColF("x") ?? [])).toEqual([0, 1, 0]);
  });

  it("promotes Float32Array coordinates to Float64 (precision guard)", () => {
    const payload: SerializedFrameData = {
      blocks: {
        atoms: {
          x: new Float32Array([0.5, 1.5]),
          y: new Float32Array([0, 0]),
          z: new Float32Array([0, 0]),
          element: ["C", "C"],
        },
      },
    };

    const frame = buildFrame(payload);
    const atoms = frame.getBlock("atoms");
    expect(atoms?.dtype("x")).toBe("f64");
    // Float32 → Float64 round-trip preserves the exact f32 value.
    expect(Array.from(atoms?.copyColF("x") ?? [])).toEqual([0.5, 1.5]);
  });

  it("routes Uint32Array bond indices to setColU32", () => {
    const payload: SerializedFrameData = {
      blocks: {
        atoms: {
          x: [0, 1, 0],
          y: [0, 0, 1],
          z: [0, 0, 0],
          element: ["O", "H", "H"],
        },
        bonds: {
          i: new Uint32Array([0, 0]),
          j: new Uint32Array([1, 2]),
        },
      },
    };

    const frame = buildFrame(payload);
    const bonds = frame.getBlock("bonds");
    expect(bonds).toBeDefined();
    expect(bonds?.dtype("atomi")).toBe("u32");
    expect(Array.from(bonds?.copyColU32("atomi") ?? [])).toEqual([0, 0]);
    expect(Array.from(bonds?.copyColU32("atomj") ?? [])).toEqual([1, 2]);
  });

  it("upcasts small-integer arrays to Uint32Array for WASM", () => {
    const payload: SerializedFrameData = {
      blocks: {
        atoms: {
          x: [0, 1],
          y: [0, 0],
          z: [0, 0],
          element: ["C", "C"],
          flag: new Uint8Array([1, 0]),
        },
      },
    };

    const frame = buildFrame(payload);
    const atoms = frame.getBlock("atoms");
    expect(atoms?.dtype("flag")).toBe("u32");
    expect(Array.from(atoms?.copyColU32("flag") ?? [])).toEqual([1, 0]);
  });

  it("rejects a missing required coordinate column", () => {
    const payload: SerializedFrameData = {
      blocks: {
        atoms: {
          x: [0],
          y: [0],
          // z missing
          element: ["C"],
        },
      },
    };
    expect(() => buildFrame(payload)).toThrow(/'z' column/);
  });

  it("rejects inconsistent column lengths in a block", () => {
    const payload: SerializedFrameData = {
      blocks: {
        atoms: {
          x: [0, 1],
          y: [0, 0, 0],
          z: [0, 0],
          element: ["C", "C"],
        },
      },
    };
    expect(() => buildFrame(payload)).toThrow(/inconsistent/);
  });
});

// ── buildBox ───────────────────────────────────────────────────────────────

describe("buildBox", () => {
  it("builds an orthorhombic box from number[][]", () => {
    const payload: SerializedBoxData = {
      matrix: [
        [5, 0, 0],
        [0, 7, 0],
        [0, 0, 11],
      ],
      origin: [0, 0, 0],
      pbc: [true, true, true],
    };
    const box = buildBox(payload);
    expect(box.volume()).toBeCloseTo(5 * 7 * 11, 6);
    expect(Array.from(box.origin().toCopy())).toEqual([0, 0, 0]);
    box.free();
  });

  it("builds a triclinic box from a 9-vector matrix", () => {
    const payload: SerializedBoxData = {
      matrix: [10, 0, 0, 1, 10, 0, 2, 3, 10],
      origin: [1, 2, 3],
      pbc: [true, true, false],
    };
    const box = buildBox(payload);
    expect(box.volume()).toBeCloseTo(1000, 4);
    expect(Array.from(box.origin().toCopy())).toEqual([1, 2, 3]);
    box.free();
  });

  it("accepts Float32Array inputs (promoted to Float64)", () => {
    const payload: SerializedBoxData = {
      matrix: new Float32Array([2, 0, 0, 0, 2, 0, 0, 0, 2]),
      origin: new Float32Array([0, 0, 0]),
    };
    const box = buildBox(payload);
    expect(box.volume()).toBeCloseTo(8, 6);
    box.free();
  });

  it("rejects a matrix with wrong length", () => {
    const payload: SerializedBoxData = {
      matrix: [1, 2, 3, 4],
      origin: [0, 0, 0],
    };
    expect(() => buildBox(payload)).toThrow(/3x3 box matrix/);
  });

  it("rejects an origin with wrong length", () => {
    const payload: SerializedBoxData = {
      matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [0, 0],
    };
    expect(() => buildBox(payload)).toThrow(/origin with 3 values/);
  });
});
