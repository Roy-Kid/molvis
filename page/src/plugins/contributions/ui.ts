import type {
  ModePanelSpec,
  PluginAnalysisSpec,
  SettingsSectionSpec,
  SidebarPanelSpec,
  ToolbarActionSpec,
} from "../types";
import { ContributionStore } from "./store";

export const sidebarPanelStore = new ContributionStore<SidebarPanelSpec>();
export const toolbarActionStore = new ContributionStore<ToolbarActionSpec>();
export const settingsSectionStore =
  new ContributionStore<SettingsSectionSpec>();
export const analysisStore = new ContributionStore<PluginAnalysisSpec>();

/** Keyed as `${mode}::${panelId}`. */
export const modePanelStore = new ContributionStore<
  ModePanelSpec & { mode: string }
>();

export function registerSidebarPanel(spec: SidebarPanelSpec): () => void {
  return sidebarPanelStore.set(spec.id, spec);
}

export function registerToolbarAction(spec: ToolbarActionSpec): () => void {
  return toolbarActionStore.set(spec.id, spec);
}

export function registerSettingsSection(spec: SettingsSectionSpec): () => void {
  return settingsSectionStore.set(spec.id, spec);
}

export function registerAnalysis(spec: PluginAnalysisSpec): () => void {
  return analysisStore.set(spec.id, spec);
}

export function registerModePanel(
  mode: string,
  spec: ModePanelSpec,
): () => void {
  const key = `${mode}::${spec.id}`;
  return modePanelStore.set(key, { ...spec, mode });
}

export function listModePanels(
  mode: string,
): Array<ModePanelSpec & { mode: string }> {
  return modePanelStore
    .list()
    .filter((p) => p.mode === mode)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
