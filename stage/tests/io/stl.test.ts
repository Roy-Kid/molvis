/**
 * STL → render geometry.
 *
 * molrs owns the parse (and has its own unit tests for the format); what this
 * covers is the seam and the expansion on this side of it: the two shapes an
 * STL arrives in reach the same corner triples, the normals that come back are
 * the winding's and not the file's (molpack writes `facet normal 0 0 0` into
 * every facet it emits, so a reader that trusted the record would light the
 * mesh black), and a file molrs refuses surfaces as a `StlParseError` rather
 * than as a raw wasm string.
 */

import { describe, expect, it } from "@rstest/core";
import { parseStl, StlParseError } from "../../src/io/stl";

/** One triangle in the z = 0 plane, wound so its normal is +z. */
const ASCII_TRIANGLE = `solid one
  facet normal 0 0 0
    outer loop
      vertex 0 0 0
      vertex 2 0 0
      vertex 0 2 0
    endloop
  endfacet
endsolid one
`;

/** Same triangle, as a length-matched binary STL (84 + 50 bytes). */
function binaryTriangle(header = "solid binary made by molpack"): Uint8Array {
  const bytes = new Uint8Array(84 + 50);
  bytes.set(new TextEncoder().encode(header).subarray(0, 80), 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(80, 1, true);
  // Recorded normal: deliberately wrong, to prove it is ignored.
  const recorded = [0, 0, -1];
  const vertices = [0, 0, 0, 2, 0, 0, 0, 2, 0];
  [...recorded, ...vertices].forEach((value, index) => {
    view.setFloat32(84 + index * 4, value, true);
  });
  return bytes;
}

describe("parseStl", () => {
  it("reads an ASCII facet as three corners", () => {
    const mesh = parseStl(new TextEncoder().encode(ASCII_TRIANGLE));
    expect(Array.from(mesh.positions)).toEqual([0, 0, 0, 2, 0, 0, 0, 2, 0]);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2]);
  });

  it("reads a binary facet as the same three corners", () => {
    const mesh = parseStl(binaryTriangle());
    expect(Array.from(mesh.positions)).toEqual([0, 0, 0, 2, 0, 0, 0, 2, 0]);
  });

  it("computes normals from the winding, not from the file", () => {
    // The binary fixture records (0, 0, -1); the winding says (0, 0, +1).
    const mesh = parseStl(binaryTriangle());
    expect(Array.from(mesh.normals)).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  });

  it("normalises the computed normal to unit length", () => {
    const mesh = parseStl(new TextEncoder().encode(ASCII_TRIANGLE));
    const [nx, ny, nz] = mesh.normals;
    expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 6);
  });

  it("reads a binary file whose header starts with 'solid'", () => {
    // The length formula, not the keyword, is what tells the two apart: a
    // binary header is free text and routinely starts with `solid`.
    const mesh = parseStl(binaryTriangle("solid cube"));
    expect(mesh.indices.length).toBe(3);
  });

  it("leaves a degenerate facet in place with a zero normal", () => {
    // A sliver is invisible; refusing the file over one would keep a
    // perfectly viewable mesh off the screen.
    const collinear = `solid flat
  facet normal 0 0 0
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 2 0 0
    endloop
  endfacet
endsolid flat
`;
    const mesh = parseStl(new TextEncoder().encode(collinear));
    expect(mesh.indices.length).toBe(3);
    expect(Array.from(mesh.normals)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("refuses text that is not an STL", () => {
    expect(() =>
      parseStl(new TextEncoder().encode("ITEM: TIMESTEP\n0\n")),
    ).toThrow(StlParseError);
  });

  it("refuses a vertex count that is not a multiple of three", () => {
    const truncated = `solid partial
  facet normal 0 0 0
    outer loop
      vertex 0 0 0
      vertex 1 0 0
    endloop
  endfacet
endsolid partial
`;
    expect(() => parseStl(new TextEncoder().encode(truncated))).toThrow(
      StlParseError,
    );
  });

  it("refuses a non-numeric coordinate rather than reading NaN geometry", () => {
    const bad = ASCII_TRIANGLE.replace("vertex 2 0 0", "vertex two 0 0");
    expect(() => parseStl(new TextEncoder().encode(bad))).toThrow(
      StlParseError,
    );
  });

  it("refuses an ASCII solid with no facets", () => {
    expect(() =>
      parseStl(new TextEncoder().encode("solid empty\nendsolid empty\n")),
    ).toThrow(StlParseError);
  });

  it("refuses bytes that are neither UTF-8 nor length-matched binary", () => {
    const junk = new Uint8Array([0xff, 0xfe, 0x00, 0x80, 0x81]);
    expect(() => parseStl(junk)).toThrow(StlParseError);
  });
});
