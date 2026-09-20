import { describe, expect, it } from "@rstest/core";
import { cn } from "../src/utils";

describe("cn", () => {
  it("keeps constitution font-size tokens from colliding with colour tokens", () => {
    expect(cn("text-body", "text-muted-foreground")).toContain("text-body");
    expect(cn("text-body", "text-muted-foreground")).toContain(
      "text-muted-foreground",
    );
  });

  it("lets a later radius win over rounded-control", () => {
    expect(cn("rounded-control", "rounded-lg")).toBe("rounded-lg");
  });
});
