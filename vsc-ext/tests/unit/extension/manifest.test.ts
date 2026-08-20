/**
 * Contribution-manifest checks.
 *
 * These assert on `package.json` `contributes` only, so they need no
 * extension host. They previously lived in the extension-host suite and paid
 * a full VS Code download and boot to read a JSON file.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as assert from "assert";

type ViewContribution = { id: string; type?: string };

/**
 * Walk up to the extension root rather than counting `..` segments — the
 * compiled tests live under `out-test/`, so a fixed depth silently breaks
 * whenever the emit layout changes.
 */
function extensionManifestPath(): string {
  let dir = __dirname;
  while (dir !== dirname(dir)) {
    const candidate = join(dir, "package.json");
    if (existsSync(candidate) && dir.endsWith("vsc-ext")) return candidate;
    dir = dirname(dir);
  }
  throw new Error(`could not locate vsc-ext/package.json from ${__dirname}`);
}

const pkg = JSON.parse(readFileSync(extensionManifestPath(), "utf8")) as {
  description?: string;
  contributes?: {
    commands?: Array<{ command: string }>;
    views?: Record<string, Array<ViewContribution & { when?: string }>>;
    viewsContainers?: { activitybar?: Array<{ id: string }> };
    viewsWelcome?: Array<{ view: string }>;
    menus?: Record<string, Array<{ command: string; when?: string }>>;
    customEditors?: Array<{
      viewType: string;
      displayName: string;
      selector: Array<{ filenamePattern: string }>;
      priority?: string;
    }>;
    configurationDefaults?: {
      "workbench.editorAssociations"?: Record<string, string>;
    };
  };
};

const contributes = pkg.contributes ?? {};

function extensionBundlePath(): string {
  return join(dirname(extensionManifestPath()), "out", "extension.js");
}
const views = contributes.views ?? {};
const commandIds = new Set((contributes.commands ?? []).map((c) => c.command));

suite("contribution manifest", () => {
  test("marketplace description uses the project tagline", () => {
    const description = pkg.description ?? "";
    assert.match(
      description,
      /visual workspace/i,
      "description must reuse the project tagline, not a format laundry list",
    );
    assert.match(
      description,
      /people and agents/i,
      "description must name the people-and-agents workspace, matching root README / docs hero",
    );
    assert.doesNotMatch(
      description,
      /PDB,\s*XYZ,\s*CIF/,
      "formats belong in the README, not the marketplace one-liner",
    );
  });

  test("declares every command the files view and editors invoke", () => {
    for (const id of [
      "molvis.quickView",
      "molvis.openStage",
      "molvis.openSketch",
      "molvis.openPage",
      "molvis.openStructure",
      "molvis.refreshFiles",
      "molvis.clearRecent",
      "molvis.reload",
    ]) {
      assert.ok(commandIds.has(id), `missing contributed command ${id}`);
    }
  });

  test("extension host bundle does not require workspace packages", () => {
    const bundle = extensionBundlePath();
    assert.ok(existsSync(bundle), `extension host bundle missing: ${bundle}`);
    const src = readFileSync(bundle, "utf8");
    assert.match(
      src,
      /registerCommand\(\s*["']molvis\.quickView["']/,
      "activate must register molvis.quickView in the shipped bundle",
    );
    assert.doesNotMatch(
      src,
      /require\(["']@molcrafts\//,
      "VSIX has no node_modules — require(@molcrafts/…) makes every command not found on Remote-SSH",
    );
  });

  test("does not contribute a Workbench command", () => {
    assert.ok(!commandIds.has("molvis.openWorkbench"));
    assert.ok(!commandIds.has("molvis.loadInWorkbench"));
    assert.ok(!commandIds.has("molvis.openRecentInStage"));
  });

  test("activity bar hosts a native files view, not a webview", () => {
    const files = views.molvis?.find((v) => v.id === "molvis.files");
    assert.ok(files, "Expected molvis.files in views.molvis");
    assert.notStrictEqual(
      files.type,
      "webview",
      "Files must be a native tree view, not a heavyweight webview",
    );
  });

  test("the full page is not hosted inside the sidebar", () => {
    assert.strictEqual(
      views.molvis?.find((v) => v.id === "molvis.pageView"),
      undefined,
      "molvis.pageView (full page in sidebar) must be removed",
    );
  });

  test("files view title only exposes Open Structure and Refresh", () => {
    const titleMenus = contributes.menus?.["view/title"] ?? [];
    const filesActions = titleMenus.filter((m) =>
      m.when?.includes("molvis.files"),
    );
    assert.ok(
      filesActions.some((m) => m.command === "molvis.openStructure"),
      "view/title must expose Open Structure on Files",
    );
    assert.ok(
      filesActions.some((m) => m.command === "molvis.refreshFiles"),
      "view/title must expose Refresh on Files",
    );
    assert.ok(
      !filesActions.some(
        (m) =>
          m.command === "molvis.openStage" || m.command === "molvis.openSketch",
      ),
      "Files title must not host Stage or Sketch — those are other views",
    );
  });

  test("activity bar has a single MolVis container", () => {
    const activitybar = contributes.viewsContainers?.activitybar ?? [];
    assert.strictEqual(activitybar.length, 1);
    assert.strictEqual(activitybar[0]?.id, "molvis");
    assert.strictEqual(views.molvisSketch, undefined);
  });

  test("activity bar Stage and Sketch views are native trees hidden until loaded", () => {
    const stage = views.molvis?.find((v) => v.id === "molvis.stageOutline");
    const sketch = views.molvis?.find((v) => v.id === "molvis.sketchOutline");
    assert.ok(stage);
    assert.ok(sketch);
    assert.notStrictEqual(stage.type, "webview");
    assert.notStrictEqual(sketch.type, "webview");
    assert.ok(stage.when?.includes("molvis.hasStageOutline"));
    assert.ok(sketch.when?.includes("molvis.hasSketchOutline"));
    assert.strictEqual(
      views.molvis?.find(
        (v) => v.id === "molvis.sketch" && v.type === "webview",
      ),
      undefined,
      "Sketch canvas must not live in the activity bar",
    );
  });

  test("outline views do not host Open Stage or Open Sketch", () => {
    const titleMenus = contributes.menus?.["view/title"] ?? [];
    assert.ok(
      !titleMenus.some(
        (m) =>
          (m.command === "molvis.openStage" ||
            m.command === "molvis.openSketch") &&
          (m.when?.includes("stageOutline") ||
            m.when?.includes("sketchOutline")),
      ),
    );
    const welcome = pkg.contributes?.viewsWelcome ?? [];
    assert.ok(!welcome.some((w) => w.view === "molvis.stageOutline"));
    assert.ok(!welcome.some((w) => w.view === "molvis.sketchOutline"));
    assert.ok(welcome.some((w) => w.view === "molvis.files"));
  });

  test("command palette only shows single-purpose commands", () => {
    const palette = contributes.menus?.commandPalette ?? [];
    const hidden = new Set(
      palette.filter((m) => m.when === "false").map((m) => m.command),
    );
    const shown = (contributes.commands ?? [])
      .map((c) => c.command)
      .filter((id) => !hidden.has(id));
    assert.deepStrictEqual(
      shown.sort(),
      [
        "molvis.openPage",
        "molvis.openSketch",
        "molvis.openStage",
        "molvis.openStructure",
        "molvis.quickView",
        "molvis.reload",
      ].sort(),
    );
  });

  test("binary trajectories default to one Quick look editor, not a picker list", () => {
    const editors = contributes.customEditors ?? [];
    const binary = editors.find((e) => e.viewType === "molvis.binaryEditor");
    const text = editors.find((e) => e.viewType === "molvis.editor");
    assert.strictEqual(binary?.displayName, "Quick look");
    assert.strictEqual(text?.displayName, "Quick look");
    assert.deepStrictEqual(binary?.selector, [
      { filenamePattern: "*.{dcd,trr,xtc}" },
    ]);
    assert.strictEqual(binary?.priority, "default");
    const associations =
      contributes.configurationDefaults?.["workbench.editorAssociations"] ?? {};
    assert.strictEqual(associations["*.dcd"], "molvis.binaryEditor");
    assert.strictEqual(associations["*.trr"], "molvis.binaryEditor");
    assert.strictEqual(associations["*.xtc"], "molvis.binaryEditor");
  });
});
