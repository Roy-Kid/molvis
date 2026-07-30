/**
 * Left advanced-panel mode: Analysis charts vs dedicated modifier config.
 *
 * Analysis-nature / mesh-building pipeline modifiers
 * (`usesLeftConfig`) call {@link openLeftForModifier} when **added or
 * selected** so the left column shows **compute** parameters
 * (`surface="compute"`). The pipeline bottom pane shows **draw**
 * parameters only (`surface="draw"`). Pure charts stay in Analysis mode.
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type LeftShellMode = "analysis" | "modifier-config" | "optimize";

export interface LeftShellState {
  mode: LeftShellMode;
  /** Pipeline modifier id when mode is `modifier-config`. */
  modifierId: string | null;
  openLeftForModifier: (modifierId: string) => void;
  closeLeftToAnalysis: () => void;
  setOptimizeMode: () => void;
  setAnalysisMode: () => void;
}

const LeftShellContext = createContext<LeftShellState | null>(null);

export function LeftShellProvider({
  children,
  onOpen,
}: {
  children: ReactNode;
  /** Ensure the left advanced panel is visible (drawer / inline column). */
  onOpen?: () => void;
}) {
  const [mode, setMode] = useState<LeftShellMode>("analysis");
  const [modifierId, setModifierId] = useState<string | null>(null);

  const openLeftForModifier = useCallback(
    (id: string) => {
      setModifierId(id);
      setMode("modifier-config");
      onOpen?.();
    },
    [onOpen],
  );

  const closeLeftToAnalysis = useCallback(() => {
    setModifierId(null);
    setMode("analysis");
  }, []);

  const setOptimizeMode = useCallback(() => {
    setModifierId(null);
    setMode("optimize");
  }, []);

  const setAnalysisMode = useCallback(() => {
    setModifierId(null);
    setMode("analysis");
  }, []);

  const value = useMemo(
    () => ({
      mode,
      modifierId,
      openLeftForModifier,
      closeLeftToAnalysis,
      setOptimizeMode,
      setAnalysisMode,
    }),
    [
      mode,
      modifierId,
      openLeftForModifier,
      closeLeftToAnalysis,
      setOptimizeMode,
      setAnalysisMode,
    ],
  );

  return (
    <LeftShellContext.Provider value={value}>
      {children}
    </LeftShellContext.Provider>
  );
}

export function useLeftShell(): LeftShellState {
  const ctx = useContext(LeftShellContext);
  if (!ctx) {
    throw new Error("useLeftShell must be used within LeftShellProvider");
  }
  return ctx;
}

/** Optional hook for components that may render outside the provider (tests). */
export function useLeftShellOptional(): LeftShellState | null {
  return useContext(LeftShellContext);
}
