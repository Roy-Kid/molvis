import type { Modifier } from "@molvis/stage";
import type { ModifierPanelComponent } from "../types";
import { ContributionStore } from "./store";

export type ModifierPanelMatcher = {
  id: string;
  match: (modifier: Modifier) => boolean;
  component: ModifierPanelComponent;
  /**
   * When true, selecting this modifier opens the left dedicated config page
   * instead of (only) the pipeline bottom properties pane.
   */
  usesLeftConfig?: boolean;
};

const byTypeId = new ContributionStore<ModifierPanelComponent>();
const matchers: ModifierPanelMatcher[] = [];
const matcherListeners = new Set<() => void>();

function emitMatchers(): void {
  for (const l of matcherListeners) {
    try {
      l();
    } catch (err) {
      console.error("[molvis-plugins] matcher listener failed", err);
    }
  }
}

/**
 * Register a property panel for modifiers whose `typeId` (or wrapped
 * plugin kind) equals `typeId`.
 */
export function registerModifierPanel(
  typeId: string,
  component: ModifierPanelComponent,
): () => void {
  return byTypeId.set(typeId, component);
}

/**
 * Register a predicate-based panel (used for built-ins with dynamic names).
 */
export function registerModifierPanelMatcher(
  matcher: ModifierPanelMatcher,
): () => void {
  matchers.push(matcher);
  emitMatchers();
  return () => {
    const idx = matchers.findIndex((m) => m.id === matcher.id);
    if (idx >= 0) {
      matchers.splice(idx, 1);
      emitMatchers();
    }
  };
}

/** Stable type id attached by the plugin API when registering modifiers. */
export const PLUGIN_MODIFIER_TYPE_ID = "__molvisPluginTypeId";

export function getModifierTypeId(modifier: Modifier): string | undefined {
  const tagged = (
    modifier as Modifier & { [PLUGIN_MODIFIER_TYPE_ID]?: string }
  )[PLUGIN_MODIFIER_TYPE_ID];
  if (typeof tagged === "string" && tagged.length > 0) return tagged;
  return undefined;
}

export function resolveModifierPanel(
  modifier: Modifier,
): ModifierPanelComponent | null {
  const typeId = getModifierTypeId(modifier);
  if (typeId) {
    const byId = byTypeId.get(typeId);
    if (byId) return byId;
  }
  // Prefer exact name match for plugins that set name === kind.
  const byName = byTypeId.get(modifier.name);
  if (byName) return byName;

  for (const matcher of matchers) {
    if (matcher.match(modifier)) return matcher.component;
  }
  return null;
}

/** True when the modifier should open the left dedicated config page. */
export function modifierUsesLeftConfig(modifier: Modifier): boolean {
  for (const matcher of matchers) {
    if (matcher.usesLeftConfig && matcher.match(modifier)) return true;
  }
  return false;
}

export function subscribeModifierPanels(listener: () => void): () => void {
  const a = byTypeId.subscribe(listener);
  matcherListeners.add(listener);
  return () => {
    a();
    matcherListeners.delete(listener);
  };
}
