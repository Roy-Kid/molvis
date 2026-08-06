/**
 * `@molcrafts/molvis-plugin` — authoring SDK for MolVis page plugins.
 *
 * Prefer the umbrella re-export so consumers never see monorepo layout:
 *
 *   import { MolvisPlugin, pluginExternals, token } from "@molcrafts/molvis/plugin";
 *   import { Button } from "@molcrafts/molvis/plugin/ui";
 *   import "@molcrafts/molvis/plugin/css";
 */

export type * from "./contract";
export {
  FONT,
  resolveToken,
  type StatusName,
  statusToken,
  type TokenName,
  token,
  tokenVar,
  Z,
} from "./contract_tokens";
export {
  PLUGIN_HOST_MODULE_IDS,
  type PluginHostModuleId,
  pluginExternals,
} from "./externals";
export { MolvisPlugin } from "./MolvisPlugin";
export { cn } from "./utils";
