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

async function getRegisteredPanels(): Promise<readonly string[]> {
  return (
    (await vscode.commands.executeCommand<readonly string[]>(
      "molvis._test.getRegisteredPanelViewTypes",
    )) ?? []
  );
}

async function waitForRegisteredPanel(
  viewType: string,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await getRegisteredPanels()).includes(viewType)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const registered = await getRegisteredPanels();
  assert.fail(
    `Expected panel ${viewType} to appear within ${timeoutMs}ms; registered=${registered.join(",")}`,
  );
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
    await waitForRegisteredPanel("molvis.workspace");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("quickView accepts URI argument", async () => {
    const filePath = path.join(
      os.tmpdir(),
      `molvis-quickview-${Date.now()}.xyz`,
    );
    const fileUri = vscode.Uri.file(filePath);

    await vscode.workspace.fs.writeFile(
      fileUri,
      Buffer.from("1\nframe\nH 0 0 0\n"),
    );

    await vscode.commands.executeCommand("molvis.quickView", fileUri);
    await waitForRegisteredPanel("molvis.quickView");

    await vscode.commands.executeCommand("molvis.reload");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await vscode.workspace.fs.delete(fileUri);
  });
});
