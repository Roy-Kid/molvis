/**
 * Engine types the plugin contract refers to — **host binding**.
 *
 * `contract.ts` is vendored byte-for-byte into the plugin template and every
 * plugin repo, so it cannot name a package that only the host can resolve.
 * It imports these four names from `./engine` instead, and each repo supplies
 * its own one-line binding:
 *
 * - host (this file)  → `@molcrafts/molvis-stage`, the real engine
 * - template / plugins → `@molcrafts/molvis-core`, the published surface
 *
 * When `@molcrafts/molvis-plugin-api` is published, only this file changes.
 */
export type {
  Modifier,
  Molvis,
  Overlay,
  PluginModeFactory,
} from "@molcrafts/molvis-stage";
