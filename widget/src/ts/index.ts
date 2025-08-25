import { Logger } from "tslog";
import { MolvisWidget } from "./widget";
import { AnyModel } from "@anywidget/types";

const logger = new Logger({ name: "molvis-widget" });

export default () => {
  return {
    initialize({ model }: { model: AnyModel; }) {
      const session_id = model.get("session_id");
      if (!MolvisWidget.getInstance(session_id)) {
        const widget = new MolvisWidget(model);
        widget.initialize();
        model.set("ready", true);
        model.save_changes();
        console.log("model.get('ready')m savecgabgeds", model.get("ready"));
        console.log("MolvisWidget instance created and initialized", { session_id });
      } else {
        logger.debug("MolvisWidget instance already exists", { session_id });
      }
    },
    
    render({ model, el }: { model: AnyModel; el: HTMLElement }) {
      const session_id = model.get("session_id");
      const widget = MolvisWidget.getInstance(session_id);
      if (!widget) {
        logger.error("Widget instance not found for session_id", { session_id });
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