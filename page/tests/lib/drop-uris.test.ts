import { describe, expect, it } from "@rstest/core";
import { readDropUris } from "../../src/lib/drop-uris";

function transfer(uriList: string | undefined): DataTransfer {
  return {
    getData: (type: string) =>
      type === "text/uri-list" ? (uriList ?? "") : "",
  } as unknown as DataTransfer;
}

describe("readDropUris", () => {
  it("reads one workspace uri from a host explorer drag", () => {
    expect(readDropUris(transfer("file:///w/a.pdb"))).toEqual([
      "file:///w/a.pdb",
    ]);
  });

  it("reads every uri in a multi-file drag", () => {
    expect(
      readDropUris(transfer("file:///w/a.pdb\r\nfile:///w/b.xyz")),
    ).toEqual(["file:///w/a.pdb", "file:///w/b.xyz"]);
  });

  it("skips the comment lines text/uri-list allows", () => {
    expect(readDropUris(transfer("# a comment\nfile:///w/a.pdb"))).toEqual([
      "file:///w/a.pdb",
    ]);
  });

  it("is empty for a plain file drag, so the shell keeps its own path", () => {
    expect(readDropUris(transfer(undefined))).toEqual([]);
    expect(readDropUris(transfer(""))).toEqual([]);
    expect(readDropUris(null)).toEqual([]);
  });
});
