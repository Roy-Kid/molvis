import type { AnyModel } from "@anywidget/types";
import { MolvisWidget } from "./widget";

// 直接导出对象，符合 anywidget 的要求
export default {
  initialize({ model }: { model: AnyModel }) {
    const session_id = model.get("session_id");
    
    // Check if widget already exists for this session
    const existingWidget = MolvisWidget.getInstance(session_id);
    console.log('[molvis] existingWidget =', existingWidget);
    if (existingWidget) {
      // Widget already exists, just ensure it's initialized
      if (!existingWidget.isInitialized) {
        existingWidget.initialize();
      }
      return;
    }
    
    // Create new widget instance
    const widget = new MolvisWidget(model);
    widget.initialize();
    // console.log('[molvis] initialize');
  },

  render({ model, el }: { model: AnyModel; el: HTMLElement }) {
    const session_id = model.get("session_id");
    let widget = MolvisWidget.getInstance(session_id);
    
    // If widget doesn't exist, create it (shouldn't happen, but handle gracefully)
    if (!widget) {
      widget = new MolvisWidget(model);
      widget.initialize();
    }

    widget.attach(el);

    return () => {
      if (widget) {
        widget.detach(el);
      }
    };
  },
};
