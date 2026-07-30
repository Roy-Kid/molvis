import type { Molvis } from "@molvis/stage";
import { createPluginAPI } from "./api/create_api";
import { registerBuiltinModifierPanels } from "./contributions/builtins";
import { fetchPluginManifest, loadPluginModule } from "./loader";
import { resolvePluginSource } from "./resolve";
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

type Listener = () => void;

interface ActivePlugin {
  state: PluginRuntimeState;
  module?: MolvisPluginModule;
  api?: PluginAPI;
  disposeApi?: Disposer;
}

/**
 * Owns plugin install / load / activate lifecycle for one mounted app.
 */
export class PluginManager {
  private app: Molvis | null = null;
  private plugins = new Map<string, ActivePlugin>();
  private listeners = new Set<Listener>();
  private restorePromise: Promise<void> | null = null;
  /** Stable list snapshot for useSyncExternalStore. */
  private listSnapshot: PluginRuntimeState[] = [];

  bindApp(app: Molvis): void {
    this.app = app;
    registerBuiltinModifierPanels();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    this.listSnapshot = Array.from(this.plugins.values())
      .map((p) => p.state)
      .sort((a, b) => a.source.localeCompare(b.source));
    for (const l of this.listeners) {
      try {
        l();
      } catch (err) {
        console.error("[molvis-plugins] listener failed", err);
      }
    }
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
        existing.state.enabled = true;
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
      active.state.enabled = false;
      active.state.status = "disabled";
      active.state.error = undefined;
      setInstallEnabled(source, false);
      this.emit();
      return;
    }

    active.state.enabled = true;
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
      console.error(`[molvis-plugins] deactivate failed for ${source}`, err);
    }

    try {
      active.disposeApi?.();
    } catch (err) {
      console.error(`[molvis-plugins] dispose failed for ${source}`, err);
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

    active.state.status = "loading";
    active.state.error = undefined;
    this.emit();

    try {
      const resolved = await resolvePluginSource(source);
      const manifest = await fetchPluginManifest(resolved.manifestUrl);
      const entryUrl = new URL(manifest.entry, resolved.baseUrl).href;
      const mod = await loadPluginModule(entryUrl);

      if (mod.id !== manifest.id) {
        console.warn(
          `[molvis-plugins] module id '${mod.id}' !== manifest id '${manifest.id}'`,
        );
      }

      // Tear down previous activation if reloading
      await this.deactivate(source);

      const { api, disposeAll } = createPluginAPI(this.app, manifest.id);
      await mod.activate(api);

      active.module = mod;
      active.api = api;
      active.disposeApi = disposeAll;
      active.state = {
        ...active.state,
        id: manifest.id,
        name: manifest.name || mod.name || manifest.id,
        version: manifest.version || mod.version,
        status: "active",
        error: undefined,
        enabled: true,
      };
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

  private setError(source: string, message: string): void {
    const active = this.plugins.get(source);
    if (!active) return;
    active.state.status = "error";
    active.state.error = message;
    this.emit();
  }
}

/** Process-wide manager used by the standalone page Settings UI. */
export const pluginManager = new PluginManager();
