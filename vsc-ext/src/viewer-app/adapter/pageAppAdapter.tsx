import type React from "react";
import App from "../../../../page/src/App";

/**
 * Adapter boundary for reusing page App inside VS Code viewer.
 * Keep cross-package coupling contained to this module.
 */
export function PageAppAdapter(): React.JSX.Element {
  return <App />;
}
