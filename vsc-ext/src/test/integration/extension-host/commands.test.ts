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
    assert.ok(commands.includes("molvis.quickView"));
    assert.ok(commands.includes("molvis.openEditor"));
    assert.ok(commands.includes("molvis.reload"));
  });

  test("openEditor creates molvis editor webview", async () => {
    await vscode.commands.executeCommand("molvis.openEditor");
    assert.ok(hasWebviewTab("molvis.workspace"));
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("quickView accepts URI argument", async () => {
    const filePath = path.join(os.tmpdir(), `molvis-quickview-${Date.now()}.xyz`);
    const fileUri = vscode.Uri.file(filePath);

    await vscode.workspace.fs.writeFile(
      fileUri,
      Buffer.from("1\nframe\nH 0 0 0\n"),
    );

    await vscode.commands.executeCommand("molvis.quickView", fileUri);
    assert.ok(hasWebviewTab("molvis.quickView"));

    await vscode.commands.executeCommand("molvis.reload");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await vscode.workspace.fs.delete(fileUri);
  });
});
