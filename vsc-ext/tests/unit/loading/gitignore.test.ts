import * as assert from "assert";
import {
  IgnoreStack,
  parseGitignore,
} from "../../../src/extension/loading/gitignore";

function stack(text: string, base = ""): IgnoreStack {
  return IgnoreStack.empty().extend(base, text);
}

suite("gitignore / parsing", () => {
  test("skips comments and blank lines", () => {
    assert.strictEqual(parseGitignore("# a comment\n\n   \n").length, 0);
  });

  test("reads the three modifiers off a pattern", () => {
    const [rule] = parseGitignore("!build/");
    assert.strictEqual(rule.negated, true);
    assert.strictEqual(rule.dirOnly, true);
    assert.strictEqual(rule.source, "!build/");
  });

  test("an escaped bang is a literal name, not a negation", () => {
    const [rule] = parseGitignore("\\!important.xyz");
    assert.strictEqual(rule.negated, false);
    assert.strictEqual(
      stack("\\!important.xyz").ignores("!important.xyz", false),
      true,
    );
  });
});

suite("gitignore / matching", () => {
  test("a bare name matches at any depth", () => {
    const rules = stack("target");
    assert.strictEqual(rules.ignores("target", true), true);
    assert.strictEqual(rules.ignores("molrs/target", true), true);
    assert.strictEqual(rules.ignores("a/b/target", true), true);
    assert.strictEqual(rules.ignores("targeted", true), false);
  });

  test("everything under an ignored directory is ignored too", () => {
    const rules = stack("target");
    assert.strictEqual(rules.ignores("molrs/target/debug/x.xyz", false), true);
  });

  test("a leading slash anchors to the declaring directory", () => {
    const rules = stack("/build");
    assert.strictEqual(rules.ignores("build", true), true);
    assert.strictEqual(rules.ignores("sub/build", true), false);
  });

  test("a trailing slash restricts the rule to directories", () => {
    const rules = stack("out/");
    assert.strictEqual(rules.ignores("out", true), true);
    assert.strictEqual(rules.ignores("out", false), false);
  });

  test("* stops at a separator, ** crosses it", () => {
    assert.strictEqual(stack("*.vsix").ignores("a/b/molvis.vsix", false), true);
    assert.strictEqual(stack("src/*.xyz").ignores("src/a.xyz", false), true);
    assert.strictEqual(
      stack("src/*.xyz").ignores("src/deep/a.xyz", false),
      false,
    );
    assert.strictEqual(
      stack("src/**/*.xyz").ignores("src/deep/a.xyz", false),
      true,
    );
  });

  test("? matches one character but not a separator", () => {
    assert.strictEqual(stack("frame?.xyz").ignores("frame1.xyz", false), true);
    assert.strictEqual(
      stack("frame?.xyz").ignores("frame12.xyz", false),
      false,
    );
  });

  test("a character class matches and negates", () => {
    assert.strictEqual(
      stack("frame[0-9].xyz").ignores("frame7.xyz", false),
      true,
    );
    assert.strictEqual(
      stack("frame[0-9].xyz").ignores("frameX.xyz", false),
      false,
    );
    assert.strictEqual(
      stack("frame[!0-9].xyz").ignores("frameX.xyz", false),
      true,
    );
  });

  test("the last matching rule wins, so a negation can un-ignore", () => {
    const rules = stack("*.xyz\n!keep.xyz\n");
    assert.strictEqual(rules.ignores("drop.xyz", false), true);
    assert.strictEqual(rules.ignores("keep.xyz", false), false);
  });

  test("order matters: a re-ignore after a negation wins again", () => {
    const rules = stack("*.xyz\n!keep.xyz\nkeep.xyz\n");
    assert.strictEqual(rules.ignores("keep.xyz", false), true);
  });

  test("nothing is ignored without rules", () => {
    assert.strictEqual(
      IgnoreStack.empty().ignores("anything.xyz", false),
      false,
    );
    assert.strictEqual(IgnoreStack.empty().size, 0);
  });
});

suite("gitignore / nesting", () => {
  test("a nested .gitignore only governs its own subtree", () => {
    const rules = IgnoreStack.empty().extend("pkg", "*.xyz");
    assert.strictEqual(rules.ignores("pkg/a.xyz", false), true);
    assert.strictEqual(rules.ignores("other/a.xyz", false), false);
    assert.strictEqual(rules.ignores("a.xyz", false), false);
  });

  test("a nested negation overrides an inherited ignore", () => {
    // Root hides every .xyz; the package below keeps its own.
    const rules = IgnoreStack.empty()
      .extend("", "*.xyz")
      .extend("pkg", "!golden.xyz");
    assert.strictEqual(rules.ignores("pkg/golden.xyz", false), false);
    assert.strictEqual(rules.ignores("pkg/other.xyz", false), true);
    assert.strictEqual(rules.ignores("golden.xyz", false), true);
  });

  test("extending with an empty file reuses the stack", () => {
    const base = stack("target");
    assert.strictEqual(base.extend("pkg", "# nothing\n"), base);
  });
});
