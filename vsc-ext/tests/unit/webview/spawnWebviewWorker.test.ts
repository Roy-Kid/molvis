import * as assert from "assert";
import { webviewWorkerBootstrap } from "../../../src/webview/spawnWebviewWorker";

suite("spawnWebviewWorker", () => {
  test("bootstrap is a module import of the real script href", () => {
    const href = "https://vscode-cdn.net/home/ext/out/chunks/worker.js";
    assert.strictEqual(
      webviewWorkerBootstrap(href),
      `import "https://vscode-cdn.net/home/ext/out/chunks/worker.js";\n`,
    );
  });
});
