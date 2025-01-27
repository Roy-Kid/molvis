import { MolvisWidget } from "./widget";
import { preventEventPropagation } from "./utils";
import type { ModelType } from "./types";
import { Logger } from "tslog";

const logger = new Logger({ name: "molvis-widget-ts" });

export default () => {

  let app: MolvisWidget;

  return {
    initialize({ model }: { model: ModelType }) {
      const session_id = model.get("session_id");
      if (session_id) {
        app = new MolvisWidget(model);
        app.start();
      }
      return () => {
        logger.info(`MolvisWidget${session_id} init cleanup`);
      };
    },

    render({ model, el }: { model: ModelType; el: HTMLElement }) {
      preventEventPropagation(el);

      const session_id = model.get("session_id");
      if (app) {
        app.attach(el);
        app.resize();
      }
      else {
        throw new Error(`MolvisWidget${session_id} not found`);
      }
      
      return () => { 
        logger.info(`MolvisWidget${session_id} render cleanup`);
        app.detach();
      };
    },
  };
};
