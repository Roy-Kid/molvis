import { describe, expect, it } from "@rstest/core";
import { toDomainUint } from "../src/domain_uint";
import * as molrs from "../src/molrs";
import {
  Block,
  DCDReader,
  Frame,
  generate3D,
  parseSMILES,
  WasmDcdStream,
  writeFrameBytes,
} from "../src/molrs";

describe("molrs gateway", () => {
  it("constructs Frame and Block", () => {
    const frame = new Frame();
    const block = new Block();
    block.setColStr("element", ["C", "O"]);
    frame.insertBlock("atoms", block);
    expect(frame.getBlock("atoms")?.nrows()).toBe(2);
    frame.free();
  });

  it("parseSMILES + generate3D water path", () => {
    const ir = parseSMILES("O");
    const f2 = ir.toFrame();
    const f3 = generate3D(f2, "fast", 1);
    const atoms = f3.getBlock("atoms");
    expect(atoms).toBeDefined();
    expect((atoms?.nrows() ?? 0) > 0).toBe(true);
    f2.free();
    f3.free();
    ir.free();
  });

  it("UFFTypifier + LBFGS(pots, nlist).run composition on ethanol", async () => {
    const { LBFGS, LinkedCell, UFFTypifier } = await import("../src/molrs");
    const ir = parseSMILES("CCO");
    const f2 = ir.toFrame();
    const f3 = generate3D(f2, "fast", 1);
    f2.free();
    ir.free();

    const typifier = new UFFTypifier();
    const typed = typifier.typify(f3);
    const pots = typifier.toPotentials(typed);
    // Always pass a spatial NL (UFF nonbonded shell ~12.5 Å). Never omit —
    // omitted NL uses O(N²) internal pairs and panics on mid-size systems.
    const cell = new LinkedCell(12.5, true, false);
    const nlist = cell.build(typed);
    const opt = new LBFGS(pots, nlist, 0.1);
    const report = opt.run(typed, 50);

    expect(report.steps).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(report.energy)).toBe(true);
    expect(typeof report.converged).toBe("boolean");

    report.free();
    opt.free();
    pots.free();
    typed.free();
    typifier.free();
    cell.free();
    f3.free();
  });
});

describe("mrec gateway", () => {
  it("re-exports every TrajectoryReader door", async () => {
    const { TrajectoryReader, openMrecStore } = await import("../src/molrs");
    expect(typeof TrajectoryReader).toBe("function");
    expect(typeof TrajectoryReader.fromZip).toBe("function");
    expect(typeof TrajectoryReader.fromStore).toBe("function");
    expect(typeof TrajectoryReader.prototype.readColumns).toBe("function");
    expect(typeof TrajectoryReader.prototype.blockUpdateAt).toBe("function");
    expect(typeof openMrecStore).toBe("function");
  });

  it("openMrecStore names a host missing a required method", async () => {
    const { openMrecStore } = await import("../src/molrs");
    const partial = {
      get: () => null,
      size: () => null,
    } as unknown as import("../src/molrs").MrecStoreHost;
    expect(() => openMrecStore(partial)).toThrow(/lacks list/);
  });

  it("openMrecStore reads keys through the host, not a copy", async () => {
    const { openMrecStore } = await import("../src/molrs");
    const seen: string[] = [];
    const host = {
      get: (key: string) => {
        seen.push(`get:${key}`);
        return null;
      },
      size: () => null,
      list: (prefix: string) => {
        seen.push(`list:${prefix}`);
        return [];
      },
    };
    // An empty store is not a sequence; the open must fail through the
    // host's own answers rather than by never consulting it.
    expect(() => openMrecStore(host)).toThrow();
    expect(seen.length).toBeGreaterThan(0);
  });
});

/** Byte offset of NSET in a DCD header. MolRS has no multi-frame writer. */
const DCD_NSET_OFFSET = 8;

function makeCoordFrame(n: number, seed: number): Frame {
  const block = new Block();
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = seed + i * 0.1;
    y[i] = seed + i * 0.2;
    z[i] = seed + i * 0.3;
  }
  const id = new Uint32Array(n);
  for (let i = 0; i < n; i++) id[i] = i + 1;
  block.setColU32("id", toDomainUint(id));
  block.setColF("x", x);
  block.setColF("y", y);
  block.setColF("z", z);
  const frame = new Frame();
  frame.insertBlock("atoms", block);
  return frame;
}

function writeInto(stream: WasmDcdStream, bytes: Uint8Array): void {
  const ptr = stream.allocInputBuffer(bytes.byteLength);
  new Uint8Array(molrs.wasmMemory().buffer, ptr, bytes.byteLength).set(bytes);
}

function indexFrames(bytes: Uint8Array): {
  stream: WasmDcdStream;
  entries: ReturnType<WasmDcdStream["feedIndexChunk"]>;
} {
  const stream = new WasmDcdStream();
  stream.hintTotalBytes?.(bytes.byteLength);
  writeInto(stream, bytes);
  const entries = stream.feedIndexChunk(0, bytes.byteLength);
  stream.finishIndex();
  return { stream, entries };
}

function buildMultiDcd(seeds: number[], patchNset = true): Uint8Array {
  const parts = seeds.map((seed) => {
    const bytes = writeFrameBytes(makeCoordFrame(4, seed), "dcd");
    const { entries } = indexFrames(bytes);
    const pos = entries[0];
    return {
      header: bytes.slice(0, pos.byteOffset),
      frameBlock: bytes.slice(pos.byteOffset, pos.byteOffset + pos.byteLen),
    };
  });
  const header = parts[0].header.slice();
  if (patchNset) {
    new DataView(header.buffer, header.byteOffset, header.byteLength).setInt32(
      DCD_NSET_OFFSET,
      seeds.length,
      true,
    );
  }
  const total =
    header.length + parts.reduce((sum, p) => sum + p.frameBlock.length, 0);
  const out = new Uint8Array(total);
  out.set(header, 0);
  let offset = header.length;
  for (const part of parts) {
    out.set(part.frameBlock, offset);
    offset += part.frameBlock.length;
  }
  return out;
}

function xCol(stream: WasmDcdStream): Float64Array | null {
  for (let ci = 0; ci < stream.columnCount(0); ci++) {
    if (stream.columnName(0, ci) === "x") {
      return new Float64Array(
        molrs.wasmMemory().buffer,
        stream.columnPtrF64(0, ci),
        stream.columnLen(0, ci),
      );
    }
  }
  return null;
}

describe("DCDReader", () => {
  it("counts every frame even when the DCD NSET header says 1", () => {
    const bytes = buildMultiDcd([0, 1, 2], false);
    const nset = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    ).getInt32(DCD_NSET_OFFSET, true);
    expect(nset).toBe(1);

    const reader = new DCDReader(bytes);
    expect(reader.len()).toBe(3);
    reader.free();
  });

  it("reads every frame of a multi-frame DCD", () => {
    const bytes = buildMultiDcd([0, 1, 2]);
    const reader = new DCDReader(bytes);
    expect(reader.len()).toBe(3);
    for (let i = 0; i < reader.len(); i++) {
      const x = reader.read(i)?.getBlock("atoms")?.viewColF("x");
      expect(x?.[0]).toBeCloseTo(i, 5);
    }
    reader.free();
  });
});

describe("WasmDcdStream", () => {
  it("decodes every frame range without setDecoderContext", () => {
    const seeds = [0, 1, 2];
    const bytes = buildMultiDcd(seeds);
    const { entries } = indexFrames(bytes);
    expect(entries.length).toBe(seeds.length);

    for (let i = 0; i < entries.length; i++) {
      const pos = entries[i];
      const range = bytes.slice(pos.byteOffset, pos.byteOffset + pos.byteLen);
      const parseStream = new WasmDcdStream();
      writeInto(parseStream, range);
      parseStream.parseRangeInInput(0, range.byteLength);
      expect(xCol(parseStream)?.[0]).toBeCloseTo(seeds[i], 5);
    }
  });

  it("reuses one parseStream across frames", () => {
    const seeds = [0, 1, 2];
    const bytes = buildMultiDcd(seeds);
    const { stream: indexStream, entries } = indexFrames(bytes);
    const parseStream = new WasmDcdStream();
    const ctx = indexStream.decoderContext();
    if (ctx && ctx.length > 0) parseStream.setDecoderContext(ctx);

    for (let i = 0; i < entries.length; i++) {
      const pos = entries[i];
      const range = bytes.slice(pos.byteOffset, pos.byteOffset + pos.byteLen);
      writeInto(parseStream, range);
      parseStream.parseRangeInInput(0, range.byteLength);
      expect(xCol(parseStream)?.[0]).toBeCloseTo(seeds[i], 5);
      parseStream.releaseFrame();
    }
  });
});
