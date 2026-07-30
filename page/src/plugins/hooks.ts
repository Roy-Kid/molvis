import { useMemo, useSyncExternalStore } from "react";
import {
  analysisStore,
  modePanelStore,
  settingsSectionStore,
  sidebarPanelStore,
  toolbarActionStore,
} from "./contributions/ui";
import { pluginManager } from "./manager";
import type {
  ModePanelSpec,
  PluginAnalysisSpec,
  PluginRuntimeState,
  SettingsSectionSpec,
  SidebarPanelSpec,
  ToolbarActionSpec,
} from "./types";

export function usePluginRuntimeStates(): PluginRuntimeState[] {
  return useSyncExternalStore(
    (onStoreChange) => pluginManager.subscribe(onStoreChange),
    () => pluginManager.list(),
    () => pluginManager.list(),
  );
}

function useContributionList<T>(store: {
  subscribe: (l: () => void) => () => void;
  list: () => T[];
}): T[] {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.list(),
    () => store.list(),
  );
}

export function usePluginSidebarPanels(): SidebarPanelSpec[] {
  const items = useContributionList(sidebarPanelStore);
  return useMemo(
    () => items.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [items],
  );
}

export function usePluginToolbarActions(): ToolbarActionSpec[] {
  const items = useContributionList(toolbarActionStore);
  return useMemo(
    () => items.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [items],
  );
}

export function usePluginSettingsSections(): SettingsSectionSpec[] {
  const items = useContributionList(settingsSectionStore);
  return useMemo(
    () => items.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [items],
  );
}

export function usePluginAnalyses(): PluginAnalysisSpec[] {
  const items = useContributionList(analysisStore);
  return useMemo(
    () => items.slice().sort((a, b) => a.label.localeCompare(b.label)),
    [items],
  );
}

export function usePluginModePanels(
  mode: string,
): Array<ModePanelSpec & { mode: string }> {
  const items = useContributionList(modePanelStore);
  return useMemo(
    () =>
      items
        .filter((p) => p.mode === mode)
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [items, mode],
  );
}
