import * as assert from "assert";
import { InMemoryPanelRegistry } from "../../../extension/panels/panelRegistry";

interface MockPanel {
  visible: boolean;
  webview: { html: string };
}

suite("panelRegistry", () => {
  test("forEachVisible only visits visible panels", async () => {
    const registry = new InMemoryPanelRegistry();

    const visiblePanel = {
      visible: true,
      webview: { html: "" },
    } as unknown as MockPanel;

    const hiddenPanel = {
      visible: false,
      webview: { html: "" },
    } as unknown as MockPanel;

    registry.register(visiblePanel as never, { getHtml: () => "visible" });
    registry.register(hiddenPanel as never, { getHtml: () => "hidden" });

    const htmlValues: string[] = [];
    await registry.forEachVisible((_panel, meta) => {
      htmlValues.push(meta.getHtml());
    });

    assert.deepStrictEqual(htmlValues, ["visible"]);
  });

  test("unregister removes panel from traversal", async () => {
    const registry = new InMemoryPanelRegistry();
    const panel = {
      visible: true,
      webview: { html: "" },
    } as unknown as MockPanel;

    registry.register(panel as never, { getHtml: () => "x" });
    registry.unregister(panel as never);

    let calls = 0;
    await registry.forEachVisible(() => {
      calls += 1;
    });

    assert.strictEqual(calls, 0);
  });
});
