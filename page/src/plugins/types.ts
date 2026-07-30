/**
 * Stable contracts for MolVis page plugins.
 *
 * Contribution surface is **domain-oriented**: modifiers, modes, analysis,
 * commands, overlays, settings, rpc. UI for a domain lives *on that domain*
 * (modifier property panel, mode tools panel, analysis form/result, command
 * toolbar button) — there is no free-floating `api.ui` bag.
 */

import type {
  Modifier,
  Molvis,
  Overlay,
  PluginModeFactory,
} from "@molvis/stage";
import type React from "react";

/** Mirrors core CommandFn without requiring a deep export. */
export type PluginCommandFn<A = unknown, R = unknown> = (
  app: Molvis,
  args: A,
) => R | Promise<R>;

/** Required repo-root manifest (`molvis.plugin.json`). */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  /** Semver range of host molvis; advisory only. */
  molvis?: string;
  /** ESM entry relative to the package root, e.g. `dist/plugin.js`. */
  entry: string;
  description?: string;
}

/** Default export shape of a plugin entry module. */
export interface MolvisPluginModule {
  id: string;
  name?: string;
  version?: string;
  activate(api: PluginAPI): void | Promise<void>;
  deactivate?(api: PluginAPI): void | Promise<void>;
}

export type Disposer = () => void;

export interface PluginLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface PluginStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Property panel for a pipeline modifier (lives under `api.modifiers`). */
/**
 * Which surface of a split analysis/visual modifier panel to render.
 *
 * - `full` — entire form (simple modifiers; also default for plugins).
 * - `compute` — left advanced panel: algorithm params + run compute.
 * - `draw` — pipeline bottom: drawing / appearance params only.
 *
 * Analysis-nature pipeline modifiers (`usesLeftConfig`) open the left panel
 * for `compute`; the right properties pane shows `draw`.
 */
export type ModifierPanelSurface = "full" | "compute" | "draw";

export type ModifierPanelComponent = React.FC<{
  modifier: Modifier;
  app: Molvis | null;
  onUpdate: () => void;
  /** Default `full`. Split left-config panels pass `compute` / `draw`. */
  surface?: ModifierPanelSurface;
}>;

/** Optional toolbar chrome for a command (lives under `api.commands`). */
export interface CommandToolbarOptions {
  /** Defaults to the command name suffix. */
  id?: string;
  label: string;
  icon?: React.ReactNode;
  order?: number;
  isVisible?: (app: Molvis) => boolean;
  /** Args passed when the toolbar button is clicked (default `{}`). */
  args?: unknown;
}

/** Tools pane body when a mode is active (lives under `api.modes`). */
export interface ModePanelSpec {
  id: string;
  title?: string;
  order?: number;
  render: React.FC<{ app: Molvis | null }>;
}

/** Plugin-owned Settings section (lives under `api.settings`, not a free UI bag). */
export interface SettingsSectionSpec {
  id: string;
  title: string;
  order?: number;
  render: React.FC<{ app: Molvis | null }>;
}

/**
 * @deprecated Prefer domain-scoped APIs. Kept only so internal contribution
 * stores stay typed; do not re-export as a top-level plugin surface.
 */
export interface SidebarPanelSpec {
  id: string;
  title: string;
  order?: number;
  icon?: React.ReactNode;
  render: React.FC<{ app: Molvis | null }>;
}

/**
 * @deprecated Prefer `commands.register(..., { toolbar })`.
 */
export interface ToolbarActionSpec {
  id: string;
  label: string;
  icon?: React.ReactNode;
  order?: number;
  onClick: (app: Molvis) => void;
  isVisible?: (app: Molvis) => boolean;
}

export type PluginAnalysisParamKind =
  | "int"
  | "float"
  | "bool"
  | "select"
  | "text";

export interface PluginAnalysisParamSpec {
  name: string;
  label: string;
  kind: PluginAnalysisParamKind;
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
}

export interface PluginAnalysisContext {
  app: Molvis;
  params: Record<string, unknown>;
}

export interface PluginAnalysisResult {
  /** Free-form payload; pair with resultKind / renderResult. */
  data: unknown;
}

/**
 * Analysis contribution — params form + run + result view are all part of
 * this domain (merged into the left Analysis picker under "Plugins").
 */
export interface PluginAnalysisSpec {
  id: string;
  label: string;
  description?: string;
  params: PluginAnalysisParamSpec[];
  run: (
    ctx: PluginAnalysisContext,
  ) => Promise<PluginAnalysisResult> | PluginAnalysisResult;
  resultKind?: "table" | "scalar" | "custom";
  renderResult?: React.FC<{ result: PluginAnalysisResult }>;
}

export type PluginRpcHandler = (
  params: Record<string, unknown>,
  ctx: { app: Molvis },
) => unknown | Promise<unknown>;

/**
 * Facade handed to every plugin. All `register*` calls are reversed on
 * deactivate / disable / unload.
 *
 * ## Domains (each owns its UI)
 *
 * | Domain | Logic | UI |
 * |--------|-------|-----|
 * | `modifiers` | pipeline factory | property panel |
 * | `modes` | interaction mode | tools panel |
 * | `analysis` | compute | picker entry + params + result |
 * | `commands` | do/undo-style action | optional toolbar button |
 * | `overlays` | scene decoration | — |
 * | `settings` | plugin prefs | Settings section |
 * | `rpc` | JSON-RPC | — |
 */
export interface PluginAPI {
  readonly app: Molvis;
  readonly pluginId: string;
  readonly log: PluginLogger;
  readonly storage: PluginStorage;

  modifiers: {
    /**
     * Register a pipeline modifier. Optionally attach its property panel
     * in the same call — UI belongs to the modifier, not a global UI bag.
     */
    register(
      kind: string,
      category: string,
      factory: () => Modifier,
      options?: { panel?: ModifierPanelComponent },
    ): void;
  };

  modes: {
    /**
     * Register a plugin interaction mode + optional tools panel shown
     * while that mode is active.
     */
    register(
      id: string,
      factory: PluginModeFactory,
      options?: { panel?: ModePanelSpec },
    ): void;
    /**
     * Attach a tools panel under an existing mode id (`view`, `select`, …
     * or a previously registered plugin mode).
     */
    registerToolsPanel(mode: string, spec: ModePanelSpec): void;
  };

  analysis: {
    /** Register an analysis that appears in the left Analysis picker. */
    register(spec: PluginAnalysisSpec): void;
  };

  commands: {
    /**
     * Register a named command. Optional `toolbar` places a button that
     * runs this command (command owns its chrome).
     */
    register<A = unknown, R = unknown>(
      name: string,
      fn: PluginCommandFn<A, R>,
      options?: { toolbar?: CommandToolbarOptions },
    ): void;
  };

  overlays: {
    /** Add a scene overlay instance; removed on dispose. */
    add(overlay: Overlay): void;
  };

  settings: {
    /** Plugin-owned section in Settings (not free-form host chrome). */
    registerSection(spec: SettingsSectionSpec): void;
  };

  rpc: {
    /**
     * Register a JSON-RPC method. Host prefixes with
     * `plugin.<pluginId>.` when needed.
     */
    registerMethod(name: string, handler: PluginRpcHandler): void;
  };
}

/** Persisted install record. */
export interface PluginInstallRecord {
  source: string;
  enabled: boolean;
  id?: string;
  installedAt: string;
}

export interface PluginStoreV1 {
  version: 1;
  entries: PluginInstallRecord[];
}

export type PluginRuntimeStatus =
  | "idle"
  | "loading"
  | "active"
  | "disabled"
  | "error";

export interface PluginRuntimeState {
  source: string;
  enabled: boolean;
  id?: string;
  name?: string;
  version?: string;
  status: PluginRuntimeStatus;
  error?: string;
  installedAt: string;
}

/** Resolved URLs for loading a plugin package. */
export interface ResolvedPluginSource {
  /** Canonical key stored in localStorage (user input, trimmed). */
  sourceKey: string;
  /** Base URL ending with `/` for resolving relative entry paths. */
  baseUrl: string;
  manifestUrl: string;
  /**
   * Git ref actually used for CDN (tag/branch/sha). Set when the user
   * omitted `@ref` and we pinned to the latest GitHub release, or when
   * they supplied one. Absent for unpinned default-branch / direct URLs.
   */
  resolvedRef?: string;
}
