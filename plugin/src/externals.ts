/**
 * Host modules every page plugin must externalize at build time.
 *
 * The host loader injects the same bare specifiers. Keep this list identical
 * in both directions:
 * - externalized but not injected → bare specifier fails at runtime
 * - injected but not externalized → second copy of react/molrs/WASM
 *
 * Import via `@molcrafts/molvis/plugin` (or `@molcrafts/molvis-plugin`).
 */
export const PLUGIN_HOST_MODULE_IDS = [
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@molcrafts/molvis-core/molrs",
  "@molcrafts/molvis-core/keys",
  "@molcrafts/molvis-core/elements",
  "@molcrafts/molplot",
  "@molvis/stage",
  "@molcrafts/molvis-stage",
] as const;

export type PluginHostModuleId = (typeof PLUGIN_HOST_MODULE_IDS)[number];

/** rspack/rsbuild `externals` map (specifier → specifier). */
export const pluginExternals: Record<PluginHostModuleId, string> =
  Object.fromEntries(PLUGIN_HOST_MODULE_IDS.map((id) => [id, id])) as Record<
    PluginHostModuleId,
    string
  >;
