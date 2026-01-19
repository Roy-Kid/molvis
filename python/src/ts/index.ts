import type { AnyModel } from "@anywidget/types";
import { MolvisWidget } from "./widget";

/**
 * anywidget entry point.
 * Exports the required initialize and render functions.
 */
export default {
  initialize({ model }: { model: AnyModel }) {
    // Determine widget name (prefer name, fallback to session_id)
    const name = model.get("name") as string | undefined;
    const sessionId = model.get("session_id") as number;
    const widgetName = name || `scene_${sessionId}`;

    // Check if widget already exists
    const existingWidget = MolvisWidget.getInstance(widgetName);
    if (existingWidget) {
      if (!existingWidget.isInitialized) {
        existingWidget.initialize();
      }
      return;
    }

    // Create new widget instance
    const widget = new MolvisWidget(model);
    widget.initialize();
  },

  render({ model, el }: { model: AnyModel; el: HTMLElement }) {
    const name = model.get("name") as string | undefined;
    const sessionId = model.get("session_id") as number;
    const widgetName = name || `scene_${sessionId}`;

    let widget = MolvisWidget.getInstance(widgetName);

    // Create if doesn't exist (shouldn't happen, but handle gracefully)
    if (!widget) {
      widget = new MolvisWidget(model);
      widget.initialize();
    }

    widget.attach(el);

    // Cleanup function when widget is removed from DOM
    return () => {
      if (widget) {
        widget.detach(el);
      }
    };
  },
};
