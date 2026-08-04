/**
 * Host-side plugin types.
 *
 * The plugin-facing contract lives in `./contract` and is vendored verbatim
 * into the plugin template and every plugin repo — edit it there, not here.
 * This file holds only what the host itself needs: install records, runtime
 * status, source resolution, and host-internal chrome.
 */

import type React from "react";
import type { Molvis } from "./engine";

export * from "./contract";

/**
 * Host-internal command-palette entry. Plugins never construct this — they
 * pass `CommandToolbarOptions` to `commands.register` and the host derives
 * the action from it.
 */
export interface ToolbarActionSpec {
  id: string;
  label: string;
  icon?: React.ReactNode;
  order?: number;
  onClick: (app: Molvis) => void;
  isVisible?: (app: Molvis) => boolean;
  /**
   * When set, the command palette must not also list this dialog —
   * the toolbar entry is the single discovery surface.
   */
  opensDialog?: string;
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
  /**
   * Git ref this install is pinned to, when one was resolved. Absent means
   * the plugin rides the default-branch tip and can change under the user.
   */
  resolvedRef?: string;
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
