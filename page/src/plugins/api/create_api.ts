import {
  commands,
  type Modifier,
  ModifierRegistry,
  type Molvis,
  type Overlay,
  type PluginModeFactory,
  registerRpcExtensionHandler,
} from "@molvis/stage";
import { openPluginDialog } from "../contributions/dialog_host";
import {
  PLUGIN_MODIFIER_TYPE_ID,
  registerModifierPanel,
} from "../contributions/modifier_panels";
import {
  registerAnalysis,
  registerDialog,
  registerModePanel,
  registerModeTab,
  registerPanel,
  registerSettingsSection,
  registerToolbarAction,
} from "../contributions/ui";
import { pluginStorageNamespace } from "../storage";
import type {
  CommandToolbarOptions,
  Disposer,
  ModePanelSpec,
  PluginAnalysisSpec,
  PluginAPI,
  PluginCommandFn,
  PluginDialogSpec,
  PluginLogger,
  PluginPanelSpec,
  PluginRpcHandler,
  SettingsSectionSpec,
} from "../types";

export interface CreatedPluginAPI {
  api: PluginAPI;
  disposeAll: () => void;
}

function makeLogger(pluginId: string): PluginLogger {
  const tag = `[plugin:${pluginId}]`;
  return {
    info: (...args) => console.info(tag, ...args),
    warn: (...args) => console.warn(tag, ...args),
    error: (...args) => console.error(tag, ...args),
  };
}

function tagModifier(modifier: Modifier, kind: string): Modifier {
  Object.defineProperty(modifier, PLUGIN_MODIFIER_TYPE_ID, {
    value: kind,
    enumerable: false,
    configurable: true,
  });
  return modifier;
}

function ns(pluginId: string, id: string, sep = "."): string {
  if (id.includes(sep) || id.startsWith("plugin.")) return id;
  return `plugin.${pluginId}${sep}${id}`;
}

export function createPluginAPI(
  app: Molvis,
  pluginId: string,
): CreatedPluginAPI {
  const disposers: Disposer[] = [];
  const track = (d: Disposer): void => {
    disposers.push(d);
  };

  const api: PluginAPI = {
    app,
    pluginId,
    log: makeLogger(pluginId),
    storage: pluginStorageNamespace(pluginId),

    modifiers: {
      register(kind, category, factory, options) {
        const wrapped = () => tagModifier(factory(), kind);
        ModifierRegistry.register(kind, category, wrapped);
        track(() => {
          ModifierRegistry.unregister(kind);
        });
        if (options?.panel) {
          track(registerModifierPanel(kind, options.panel));
        }
      },
    },

    modes: {
      register(id: string, factory: PluginModeFactory, options) {
        const mm = app.modeManager;
        if (!mm) {
          throw new Error("Cannot register mode on a headless app");
        }
        const namespaced = ns(pluginId, id);
        track(mm.registerPluginMode(namespaced, factory));
        if (options?.panel) {
          const panelId = options.panel.id.includes(".")
            ? options.panel.id
            : ns(pluginId, options.panel.id);
          track(
            registerModePanel(namespaced, { ...options.panel, id: panelId }),
          );
        }
        if (options?.tab) {
          track(
            registerModeTab({
              mode: namespaced,
              label: options.tab.label,
              icon: options.tab.icon,
              order: options.tab.order,
            }),
          );
        }
      },
      registerToolsPanel(mode: string, spec: ModePanelSpec) {
        const id = spec.id.includes(".") ? spec.id : ns(pluginId, spec.id);
        track(registerModePanel(mode, { ...spec, id }));
      },
    },

    analysis: {
      register(spec: PluginAnalysisSpec) {
        const id = ns(pluginId, spec.id);
        track(registerAnalysis({ ...spec, id }));
      },
    },

    commands: {
      register<A, R>(
        name: string,
        fn: PluginCommandFn<A, R>,
        options?: { toolbar?: CommandToolbarOptions },
      ) {
        const fullName = ns(pluginId, name);
        commands.register(fullName, fn as PluginCommandFn);
        track(() => {
          commands.unregister(fullName);
        });
        if (options?.toolbar) {
          const tb = options.toolbar;
          const toolbarId = tb.id ? ns(pluginId, tb.id) : `${fullName}.toolbar`;
          const args = tb.args;
          const opensDialog = tb.opensDialog
            ? tb.opensDialog.includes(".") ||
              tb.opensDialog.startsWith("plugin.")
              ? tb.opensDialog
              : ns(pluginId, tb.opensDialog)
            : undefined;
          track(
            registerToolbarAction({
              id: toolbarId,
              label: tb.label,
              icon: tb.icon,
              order: tb.order,
              isVisible: tb.isVisible,
              onClick: (a) => {
                void fn(a, args as A);
                if (opensDialog) {
                  openPluginDialog(opensDialog);
                }
              },
            }),
          );
        }
      },
    },

    dialogs: {
      register(spec: PluginDialogSpec) {
        const id = ns(pluginId, spec.id);
        track(registerDialog({ ...spec, id }));
      },
    },

    panels: {
      register(spec: PluginPanelSpec) {
        if (spec.position !== "bottom") {
          throw new Error(
            `Plugin panel position '${String(spec.position)}' is not supported (v1: bottom only)`,
          );
        }
        const id = ns(pluginId, spec.id);
        track(registerPanel({ ...spec, id }));
      },
    },

    overlays: {
      add(overlay: Overlay) {
        app.overlayManager.add(overlay);
        track(() => {
          try {
            app.overlayManager.remove(overlay.id);
          } catch {
            /* already gone */
          }
        });
      },
    },

    settings: {
      registerSection(spec: SettingsSectionSpec) {
        const id = ns(pluginId, spec.id);
        track(registerSettingsSection({ ...spec, id }));
      },
    },

    rpc: {
      registerMethod(name: string, handler: PluginRpcHandler) {
        const fullName = name.startsWith("plugin.")
          ? name
          : `plugin.${pluginId}.${name}`;
        track(
          registerRpcExtensionHandler(fullName, (params, _buffers) =>
            handler(params, { app }),
          ),
        );
      },
    },
  };

  return {
    api,
    disposeAll: () => {
      for (let i = disposers.length - 1; i >= 0; i--) {
        try {
          disposers[i]();
        } catch (err) {
          console.error(`[plugin:${pluginId}] dispose failed`, err);
        }
      }
      disposers.length = 0;
    },
  };
}
