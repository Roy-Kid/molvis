import type { MolvisModel } from "./types";
import { initializeModel, renderModel } from "./widget";

/**
 * anywidget entry point.
 * Exports the required initialize and render functions.
 */
export default {
  initialize({ model }: { model: MolvisModel }) {
    return initializeModel(model);
  },

  render({ model, el }: { model: MolvisModel; el: HTMLElement }) {
    return renderModel(model, el);
  },
};
