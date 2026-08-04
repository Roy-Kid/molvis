import type { Molvis } from "@molvis/stage";
import { createPluginAPI } from "./api/create_api";
import { HOST_LOG_TAG } from "./constants";
import { registerBuiltinModifierPanels } from "./contributions/builtins";
import { type ContributionListener, Emitter } from "./contributions/emitter";
import {
  fetchPluginManifest,
  loadPluginModule,
  releasePluginModuleGraph,
} from "./loader";
import { resolvePluginEntryUrl, resolvePluginSource } from "./resolve";
import {
  loadPluginStore,
  removeInstallRecord,
  setInstallEnabled,
  upsertInstallRecord,
} from "./storage";
import type {
  Disposer,
  MolvisPluginModule,
  PluginAPI,
  PluginRuntimeState,
} from "./types";

interface ActivePlugin {
  state: PluginRuntimeState;
  module?: MolvisPluginModule;
  api?: PluginAPI;
  disposeApi?: Disposer;
  /** Entry the module graph was loaded from; needed to free its blobs. */
  entryUrl?: string;
}

/**
 * Owns plugin install / load / activate lifecycle for one mounted app.
 */
export class PluginManager {
  private app: Molvis | null = null;
  private plugins = new Map<string, ActivePlugin>();
  private events = new Emitter("plugin manager");
  private restorePromise: Promise<void> | null = null;
  /** Stable list snapshot for useSyncExternalStore. */
  private listSnapshot: PluginRuntimeState[] = [];

  bindApp(app: Molvis): void {
    this.app = app;
    registerBuiltinModifierPanels();
  }

  subscribe(listener: ContributionListener): () => void {
    return this.events.subscribe(listener);
  }

  private emit(): void {
    this.listSnapshot = Array.from(this.plugins.values())
      .map((p) => p.state)
      .sort((a, b) => a.source.localeCompare(b.source));
    this.events.emit();
  }

  /** Stable until the next install/enable/status change. */
  list(): PluginRuntimeState[] {
    return this.listSnapshot;
  }

  /**
   * Restore localStorage plugins, then merge host-injected sources
   * (VSCode `molvis.plugins` / Python `plugins=` / MountOpts.plugins).
   * Host sources are enabled and activated; they are also persisted so
   * Settings lists them.
   */
  async restore(hostSources: readonly string[] = []): Promise<void> {
    if (this.restorePromise) return this.restorePromise;
    this.restorePromise = this._restore(hostSources);
    return this.restorePromise;
  }

  private async _restore(hostSources: readonly string[]): Promise<void> {
    const store = loadPluginStore();
    for (const entry of store.entries) {
      this.plugins.set(entry.source, {
        state: {
          source: entry.source,
          enabled: entry.enabled,
          id: entry.id,
          status: entry.enabled ? "idle" : "disabled",
          installedAt: entry.installedAt,
        },
      });
    }
    this.emit();

    // Host inject: ensure each source is present and enabled.
    const normalizedHost = hostSources
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const source of normalizedHost) {
      const existing = this.plugins.get(source);
      if (!existing) {
        const installedAt = new Date().toISOString();
        this.plugins.set(source, {
          state: {
            source,
            enabled: true,
            status: "idle",
            installedAt,
          },
        });
        upsertInstallRecord({ source, enabled: true, installedAt });
      } else if (!existing.state.enabled) {
        this.patchState(source, { enabled: true });
        setInstallEnabled(source, true);
      }
    }
    this.emit();

    const toActivate = new Set<string>();
    for (const [source, active] of this.plugins) {
      if (active.state.enabled) toActivate.add(source);
    }
    for (const source of toActivate) {
      await this.loadAndActivate(source);
    }
  }

  /**
   * Apply additional host sources after restore (e.g. settings change).
   * Idempotent for already-active plugins.
   */
  async applyHostSources(sources: readonly string[]): Promise<void> {
    for (const raw of sources) {
      const source = raw.trim();
      if (!source) continue;
      const existing = this.plugins.get(source);
      if (existing?.state.status === "active") continue;
      if (existing?.state.enabled) {
        await this.loadAndActivate(source);
        continue;
      }
      await this.install(source);
    }
  }

  /** Install from user input (GitHub or URL), enable, and activate. */
  async install(source: string): Promise<void> {
    const sourceKey = source.trim();
    if (!sourceKey) throw new Error("Empty plugin source");

    const installedAt =
      this.plugins.get(sourceKey)?.state.installedAt ??
      new Date().toISOString();

    this.plugins.set(sourceKey, {
      state: {
        source: sourceKey,
        enabled: true,
        status: "loading",
        installedAt,
      },
    });
    upsertInstallRecord({
      source: sourceKey,
      enabled: true,
      installedAt,
    });
    this.emit();

    await this.loadAndActivate(sourceKey);
  }

  async setEnabled(source: string, enabled: boolean): Promise<void> {
    const active = this.plugins.get(source);
    if (!active) return;

    if (!enabled) {
      await this.deactivate(source);
      this.patchState(source, {
        enabled: false,
        status: "disabled",
        error: undefined,
      });
      setInstallEnabled(source, false);
      this.emit();
      return;
    }

    this.patchState(source, { enabled: true });
    setInstallEnabled(source, true);
    await this.loadAndActivate(source);
  }

  async reload(source: string): Promise<void> {
    await this.deactivate(source);
    const active = this.plugins.get(source);
    if (!active?.state.enabled) return;
    await this.loadAndActivate(source);
  }

  async uninstall(source: string): Promise<void> {
    await this.deactivate(source);
    this.plugins.delete(source);
    removeInstallRecord(source);
    this.emit();
  }

  private async deactivate(source: string): Promise<void> {
    const active = this.plugins.get(source);
    if (!active) return;

    try {
      if (active.module?.deactivate && active.api) {
        await active.module.deactivate(active.api);
      }
    } catch (err) {
      console.error(`${HOST_LOG_TAG} deactivate failed for ${source}`, err);
    }

    try {
      active.disposeApi?.();
    } catch (err) {
      console.error(`${HOST_LOG_TAG} dispose failed for ${source}`, err);
    }
    if (active.entryUrl) {
      releasePluginModuleGraph(active.entryUrl);
      active.entryUrl = undefined;
    }
    active.disposeApi = undefined;
    active.api = undefined;
    active.module = undefined;
  }

  private async loadAndActivate(source: string): Promise<void> {
    if (!this.app) {
      this.setError(source, "App not ready");
      return;
    }

    const active = this.plugins.get(source);
    if (!active) return;

    this.patchState(source, { status: "loading", error: undefined });
    this.emit();

    try {
      const resolved = await resolvePluginSource(source);
      const manifest = await fetchPluginManifest(resolved.manifestUrl);
      const entryUrl = resolvePluginEntryUrl(manifest.entry, resolved.baseUrl);
      const mod = await loadPluginModule(entryUrl);

      if (mod.id !== manifest.id) {
        throw new Error(
          `Plugin module id '${mod.id}' does not match manifest id '${manifest.id}'. ` +
            "Contribution ids are namespaced by the manifest id, so a mismatch " +
            "would let this plugin register under another plugin's namespace.",
        );
      }

      // Tear down previous activation if reloading
      await this.deactivate(source);

      const { api, disposeAll } = createPluginAPI(this.app, manifest.id);
      await mod.activate(api);

      active.module = mod;
      active.api = api;
      active.disposeApi = disposeAll;
      active.entryUrl = entryUrl;
      this.patchState(source, {
        id: manifest.id,
        name: manifest.name || mod.name || manifest.id,
        version: manifest.version || mod.version,
        resolvedRef: resolved.resolvedRef,
        status: "active",
        error: undefined,
        enabled: true,
      });
      upsertInstallRecord({
        source,
        enabled: true,
        id: manifest.id,
        installedAt: active.state.installedAt,
      });
      this.emit();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setError(source, message);
    }
  }

  /**
   * Replace a plugin's runtime state with a patched copy.
   *
   * `PluginRuntimeState` is read by React through `useSyncExternalStore`, and
   * the project's immutability invariant applies: mutating `state` in place
   * leaves subscribers holding an object whose fields changed underneath
   * them, so a re-render can be skipped or show stale values.
   */
  private patchState(
    source: string,
    patch: Partial<PluginRuntimeState>,
  ): boolean {
    const active = this.plugins.get(source);
    if (!active) return false;
    active.state = { ...active.state, ...patch };
    return true;
  }

  private setError(source: string, message: string): void {
    if (!this.patchState(source, { status: "error", error: message })) return;
    this.emit();
  }
}

/** Process-wide manager used by the standalone page Settings UI. */
export const pluginManager = new PluginManager();
