import { MolvisWidget } from "./widget";
import { AnyModel } from "@anywidget/types";

export default () => {
  return {
    initialize({ model }: { model: AnyModel; }) {
      const session_id = model.get("session_id");
      if (!MolvisWidget.getInstance(session_id)) {
        const widget = new MolvisWidget(model);
        widget.initialize();
      }
    },
    
    render({ model, el }: { model: AnyModel; el: HTMLElement }) {
      const session_id = model.get("session_id");
      const widget = MolvisWidget.getInstance(session_id);
      if (!widget) {
        return () => {};
      }
      
      widget.attach(el);
      
      return () => {
        if (widget) {
          widget.detach(el);
        }
      };
    },
  };
};