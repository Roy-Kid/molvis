import { describe, expect, test } from "@rstest/core";
import {
  MaskFileSyntaxError,
  parseMaskFile,
  serializeMaskFile,
} from "../../src/selection/mask_file";

describe("parseMaskFile", () => {
  test("parses whitespace, comma, and semicolon separators", () => {
    const result = parseMaskFile("0 1 2\n3,4,5\n7;8;9");
    expect(result.ids).toEqual([0, 1, 2, 3, 4, 5, 7, 8, 9]);
    expect(result.expectedCount).toBeNull();
  });

  test("dedupes and sorts", () => {
    expect(parseMaskFile("5 3 5 1").ids).toEqual([1, 3, 5]);
  });

  test("ignores blank lines, comments, and CRLF", () => {
    const result = parseMaskFile("# header\r\n0 1 # trailing\r\n\r\n2\r\n");
    expect(result.ids).toEqual([0, 1, 2]);
  });

  test("empty file selects nothing", () => {
    expect(parseMaskFile("").ids).toEqual([]);
    expect(parseMaskFile("# only a comment\n").ids).toEqual([]);
  });

  test("parses @atoms directive", () => {
    expect(parseMaskFile("@atoms 10\n0 1").expectedCount).toBe(10);
  });

  test("duplicate @atoms errors", () => {
    expect(() => parseMaskFile("@atoms 10\n@atoms 11\n0")).toThrow(
      MaskFileSyntaxError,
    );
  });

  test("malformed @atoms errors", () => {
    expect(() => parseMaskFile("@atoms ten\n0")).toThrow(MaskFileSyntaxError);
    expect(() => parseMaskFile("@atoms\n0")).toThrow(MaskFileSyntaxError);
  });

  test("negative token errors with line number", () => {
    let caught: MaskFileSyntaxError | null = null;
    try {
      parseMaskFile("0\n-1");
    } catch (error) {
      caught = error as MaskFileSyntaxError;
    }
    expect(caught).toBeInstanceOf(MaskFileSyntaxError);
    expect(caught?.line).toBe(2);
  });

  test("non-integer tokens error", () => {
    expect(() => parseMaskFile("0\n1.5")).toThrow(MaskFileSyntaxError);
    expect(() => parseMaskFile("0\nabc")).toThrow(MaskFileSyntaxError);
  });

  test("leading-zero tokens are rejected", () => {
    expect(() => parseMaskFile("01")).toThrow(MaskFileSyntaxError);
  });
});

describe("serializeMaskFile", () => {
  test("round-trips through parseMaskFile", () => {
    const parsed = parseMaskFile(
      serializeMaskFile([3, 1, 2, 2], { atomCount: 4 }),
    );
    expect(parsed.ids).toEqual([1, 2, 3]);
    expect(parsed.expectedCount).toBe(4);
  });

  test("wraps long id lists but keeps the full set", () => {
    const ids = Array.from({ length: 40 }, (_, i) => i);
    expect(parseMaskFile(serializeMaskFile(ids)).ids).toEqual(ids);
  });
});
