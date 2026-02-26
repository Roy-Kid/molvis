import * as assert from "assert";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

async function activateExtension(): Promise<void> {
  const extension = vscode.extensions.getExtension("molcrafts.molvis");
  assert.ok(extension, "Expected molcrafts.molvis extension to be installed");

  if (!extension.isActive) {
    await extension.activate();
  }
}

function hasWebviewTab(viewType: string): boolean {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .some((tab) => {
      const input = tab.input as unknown as { viewType?: string };
      return input.viewType === viewType;
    });
}

suite("extension host commands", () => {
  suiteSetup(async () => {
    await activateExtension();
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("registers expected commands", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("molvis.openPreview"));
    assert.ok(commands.includes("molvis.openViewer"));
    assert.ok(commands.includes("molvis.reload"));
  });

  test("openViewer creates molvis viewer webview", async () => {
    await vscode.commands.executeCommand("molvis.openViewer");
    assert.ok(hasWebviewTab("molvis.page"));
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("openPreview accepts URI argument", async () => {
    const filePath = path.join(os.tmpdir(), `molvis-preview-${Date.now()}.xyz`);
    const fileUri = vscode.Uri.file(filePath);

    await vscode.workspace.fs.writeFile(
      fileUri,
      Buffer.from("1\nframe\nH 0 0 0\n"),
    );

    await vscode.commands.executeCommand("molvis.openPreview", fileUri);
    assert.ok(hasWebviewTab("molvis.preview"));

    await vscode.commands.executeCommand("molvis.reload");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await vscode.workspace.fs.delete(fileUri);
  });
});
