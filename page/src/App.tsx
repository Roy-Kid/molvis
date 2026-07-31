import type { Molvis } from "@molvis/stage";
import { PanelLeft, PanelRight, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BondMappingPickerProvider } from "@/components/bond-column-mapping-dialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FormatPickerProvider } from "@/components/format-picker-dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ExitFullscreenAction } from "@/components/viewer/ExitFullscreenAction";
import { StructureInspector } from "@/components/viewer/StructureInspector";
import { TrajectoryTimeline } from "@/components/viewer/TrajectoryTimeline";
import { ViewerIconAction } from "@/components/viewer/ViewerIconAction";
import { ViewerSidePanel } from "@/components/viewer/ViewerSidePanel";
import { ViewerToolbar } from "@/components/viewer/ViewerToolbar";
import { useDevDemo } from "@/dev/useDevDemo";
import { BackendConnectionProvider } from "@/hooks/useBackendConnection";
import { useBackendStateSync } from "@/hooks/useBackendStateSync";
import { useHostFileBridge } from "@/hooks/useHostFileBridge";
import { useIsNarrow } from "@/hooks/useIsNarrow";
import { useMolvisUiState } from "@/hooks/useMolvisUiState";
import { useStatusMessage } from "@/hooks/useStatusMessage";
import { resolveChrome, useMountOpts } from "@/lib/mount-opts";
import {
  BottomPanelHost,
  CommandPalette,
  PluginDialogHost,
  useCommandPaletteHotkey,
} from "@/plugins";
import {
  isAnalysisPanelOpen,
  resolveViewerPanelLayout,
} from "./lib/viewer-layout";
import MolvisWrapper from "./MolvisWrapper";
import { KeyboardShortcutsDialog } from "./ui/layout/KeyboardShortcutsDialog";
import { LeftShellProvider } from "./ui/layout/LeftShellContext";
import { LeftSidebar } from "./ui/layout/LeftSidebar";
import { StateSyncDialog } from "./ui/layout/StateSyncDialog";
import { CameraTrajectoryOverlay } from "./ui/modes/view/CameraTrajectoryOverlay";

const INLINE_PANEL_BREAKPOINT = 1280;
const COARSE_POINTER_INLINE_PANEL_BREAKPOINT = 1580;

/**
 * Main page application shell for the MolVis viewer.
 *
 * When mounted with `surface: "canvas"`, all chrome is hidden and only the
 * 3D canvas is rendered (useful for embeds that supply their own UI).
 */
const App: React.FC = () => {
  const opts = useMountOpts();
  const chrome = resolveChrome(opts);
  const canvasOnly =
    !chrome.topBar &&
    !chrome.leftSidebar &&
    !chrome.rightSidebar &&
    !chrome.statusBar &&
    !chrome.timeline;

  const [app, setApp] = useState<Molvis | null>(null);
  const { currentMode, setCurrentMode, trajectoryLength } =
    useMolvisUiState(app);
  const { statusMessage, statusType, statusPulse } = useStatusMessage(app);

  // Bind plugin runtime once the engine is ready; restore Settings plugins
  // and host-injected sources (VSCode molvis.plugins / Python plugins=).
  useEffect(() => {
    if (!app) return;
    let cancelled = false;
    const hostPlugins = opts.plugins ?? [];
    void import("@/plugins").then(
      ({ pluginManager, registerBuiltinModifierPanels }) => {
        if (cancelled) return;
        registerBuiltinModifierPanels();
        pluginManager.bindApp(app);
        void pluginManager.restore(hostPlugins);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [app, opts.plugins]);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const openCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, []);
  useCommandPaletteHotkey(openCommandPalette, !canvasOnly);
  // "Fullscreen" = hide all chrome (top bar, sidebars, status, timeline),
  // leaving only the 3D canvas. The canvas panel stays mounted so the engine
  // is never torn down; exit via the floating button or Esc.
  const [uiHidden, setUiHidden] = useState(false);
  // Wide layouts restore the original three-region work surface: Analysis on
  // the left, canvas in the center, and mode tools on the right. Narrow hosts
  // keep the same two panels as edge drawers so the WebGL surface stays useful.
  const [rootRef, isNarrow] = useIsNarrow<HTMLDivElement>(
    INLINE_PANEL_BREAKPOINT,
    COARSE_POINTER_INLINE_PANEL_BREAKPOINT,
  );
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [analysisInlineOpen, setAnalysisInlineOpen] = useState(false);
  const openLeftAdvancedPanel = useCallback(() => {
    setLeftDrawerOpen(true);
    setAnalysisInlineOpen(true);
  }, []);
  const analysisPanelRef = useRef<HTMLElement>(null);
  const toolsPanelRef = useRef<HTMLElement>(null);
  const stateSync = useBackendStateSync(app);
  const showInlineAnalysis = !uiHidden && !isNarrow && chrome.leftSidebar;
  const showInlineTools = !uiHidden && !isNarrow && chrome.rightSidebar;
  const hasInlineSidePanel = showInlineAnalysis || showInlineTools;
  const {
    defaultLayout: defaultPanelLayout,
    analysisSize: defaultAnalysisSize,
    canvasSize: defaultCanvasSize,
    toolsSize: defaultToolsSize,
  } = resolveViewerPanelLayout({
    showAnalysis: showInlineAnalysis,
    showTools: showInlineTools,
  });
  const showTimeline =
    !uiHidden && chrome.timeline && app !== null && trajectoryLength > 1;
  const showBottomBar = !uiHidden && (chrome.statusBar || showTimeline);

  useHostFileBridge(app);
  useDevDemo(app, setCurrentMode, opts);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "?" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        setShortcutsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setUiHidden(false);
        setLeftDrawerOpen(false);
        setRightDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isNarrow) {
      setLeftDrawerOpen(false);
      setRightDrawerOpen(false);
    }
  }, [isNarrow]);

  const handleModeChange = (mode: string) => {
    if (currentMode !== mode) {
      if (app) {
        app.setMode(mode);
      }
      setCurrentMode(mode);
    }
  };

  const handlePanelLayout = (layout: Record<string, number>) => {
    if (layout.analysis !== undefined && analysisPanelRef.current) {
      analysisPanelRef.current.style.width = `${layout.analysis}%`;
      const nextOpen = isAnalysisPanelOpen(layout.analysis);
      setAnalysisInlineOpen((current) =>
        current === nextOpen ? current : nextOpen,
      );
    }
    if (layout.tools !== undefined && toolsPanelRef.current) {
      toolsPanelRef.current.style.width = `${layout.tools}%`;
    }
  };

  if (canvasOnly) {
    return (
      <ErrorBoundary>
        <BackendConnectionProvider
          app={app}
          initial={{
            wsUrl: opts.wsUrl,
            token: opts.token,
            session: opts.session,
          }}
        >
          <FormatPickerProvider>
            <BondMappingPickerProvider>
              <section
                aria-label="MolVis molecular viewer"
                className="h-full w-full bg-background overflow-hidden"
                onContextMenu={(e) => e.preventDefault()}
              >
                <MolvisWrapper onMount={setApp} />
              </section>
              <StateSyncDialog
                open={stateSync.pending !== null}
                summary={stateSync.pending?.summary ?? null}
                feedback={stateSync.feedback}
                onKeepLocal={stateSync.keepLocal}
                onApplyBackend={() => void stateSync.applyBackend()}
                onDismissFeedback={stateSync.dismissFeedback}
              />
            </BondMappingPickerProvider>
          </FormatPickerProvider>
        </BackendConnectionProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <BackendConnectionProvider
        app={app}
        initial={{
          wsUrl: opts.wsUrl,
          token: opts.token,
          session: opts.session,
        }}
      >
        <FormatPickerProvider>
          <BondMappingPickerProvider>
            <LeftShellProvider onOpen={openLeftAdvancedPanel}>
              <section
                ref={rootRef}
                aria-label="MolVis molecular viewer"
                className="relative h-full w-full flex flex-col bg-background text-foreground overflow-hidden"
                onContextMenu={(e) => e.preventDefault()}
              >
                {!uiHidden && chrome.topBar && (
                  <ViewerToolbar
                    app={app}
                    onToggleFullscreen={() => setUiHidden((v) => !v)}
                    narrow={isNarrow}
                  />
                )}

                <div className="relative min-h-0 flex-1">
                  <ResizablePanelGroup
                    orientation="horizontal"
                    className="h-full"
                    defaultLayout={defaultPanelLayout}
                    onLayoutChange={handlePanelLayout}
                    resizeTargetMinimumSize={{ fine: 20, coarse: 44 }}
                  >
                    {showInlineAnalysis && (
                      <ResizablePanel
                        key="analysis"
                        id="analysis"
                        defaultSize={defaultAnalysisSize}
                        collapsible
                        collapsedSize="0%"
                        minSize="12%"
                        maxSize="30%"
                        aria-hidden="true"
                      />
                    )}

                    {showInlineAnalysis && (
                      <ResizableHandle
                        key="handle-analysis"
                        aria-label="Resize analysis panel"
                        className="z-20"
                        withHandle
                      />
                    )}

                    <ResizablePanel
                      key="canvas"
                      id="canvas"
                      defaultSize={defaultCanvasSize}
                      minSize={hasInlineSidePanel ? "70%" : "100%"}
                      className="flex min-w-0 flex-col"
                    >
                      <div className="relative flex-1 overflow-hidden bg-canvas">
                        <MolvisWrapper onMount={setApp} />
                        {uiHidden && <CameraTrajectoryOverlay app={app} />}
                        {uiHidden && (
                          <ExitFullscreenAction
                            onExit={() => setUiHidden(false)}
                          />
                        )}

                        {isNarrow && !uiHidden && (
                          <>
                            {chrome.leftSidebar && (
                              <ViewerIconAction
                                icon={<PanelLeft />}
                                label="Toggle analysis panel"
                                selected={leftDrawerOpen}
                                tooltipSide="right"
                                onClick={() => {
                                  setRightDrawerOpen(false);
                                  setLeftDrawerOpen((open) => !open);
                                }}
                                className="motion-fade-in absolute left-2 top-2 z-10 bg-background/80 backdrop-blur"
                              />
                            )}
                            {chrome.rightSidebar && (
                              <ViewerIconAction
                                icon={<PanelRight />}
                                label="Toggle tool panel"
                                selected={rightDrawerOpen}
                                tooltipSide="left"
                                onClick={() => {
                                  setLeftDrawerOpen(false);
                                  setRightDrawerOpen((open) => !open);
                                }}
                                className="motion-fade-in absolute right-2 top-2 z-10 bg-background/80 backdrop-blur"
                              />
                            )}
                          </>
                        )}
                      </div>
                    </ResizablePanel>

                    {showInlineTools && (
                      <ResizableHandle
                        key="handle-tools"
                        aria-label="Resize tool panel"
                        className="z-20"
                        withHandle
                      />
                    )}

                    {showInlineTools && (
                      <ResizablePanel
                        key="tools"
                        id="tools"
                        defaultSize={defaultToolsSize}
                        minSize="12%"
                        maxSize="30%"
                        aria-hidden="true"
                      />
                    )}
                  </ResizablePanelGroup>

                  {isNarrow && (leftDrawerOpen || rightDrawerOpen) && (
                    <button
                      type="button"
                      aria-label="Close side panel"
                      onClick={() => {
                        setLeftDrawerOpen(false);
                        setRightDrawerOpen(false);
                      }}
                      className="motion-fade-in absolute inset-0 z-20 cursor-default bg-scrim"
                    />
                  )}

                  {chrome.leftSidebar && (
                    <ViewerSidePanel
                      drawer={isNarrow}
                      inlineWidth={defaultAnalysisSize}
                      label="Advanced panel"
                      onClose={() => setLeftDrawerOpen(false)}
                      open={
                        !uiHidden &&
                        (isNarrow ? leftDrawerOpen : analysisInlineOpen)
                      }
                      panelRef={analysisPanelRef}
                      side="left"
                    >
                      <LeftSidebar
                        app={app}
                        headerAction={
                          isNarrow ? (
                            <ViewerIconAction
                              icon={<X />}
                              label="Close advanced panel"
                              tooltipSide="left"
                              data-drawer-close
                              onClick={() => setLeftDrawerOpen(false)}
                              className="shrink-0"
                            />
                          ) : undefined
                        }
                      />
                    </ViewerSidePanel>
                  )}

                  {chrome.rightSidebar && (
                    <ViewerSidePanel
                      drawer={isNarrow}
                      inlineWidth={defaultToolsSize}
                      label="Tool panel"
                      onClose={() => setRightDrawerOpen(false)}
                      open={!uiHidden && (!isNarrow || rightDrawerOpen)}
                      panelRef={toolsPanelRef}
                      side="right"
                    >
                      <StructureInspector
                        app={app}
                        currentMode={currentMode}
                        onModeChange={handleModeChange}
                        headerAction={
                          isNarrow ? (
                            <ViewerIconAction
                              icon={<X />}
                              label="Close tool panel"
                              tooltipSide="left"
                              data-drawer-close
                              onClick={() => setRightDrawerOpen(false)}
                              className="shrink-0"
                            />
                          ) : undefined
                        }
                      />
                    </ViewerSidePanel>
                  )}
                </div>

                <BottomPanelHost app={app} hidden={uiHidden} />

                {showBottomBar && (
                  <div className="motion-enter-bottom flex h-statusbar shrink-0 items-center border-t border-border/70 bg-background">
                    {chrome.statusBar && (
                      <div
                        key={statusPulse}
                        role="status"
                        aria-live={
                          statusType === "error" ? "assertive" : "polite"
                        }
                        className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap px-2 font-mono text-xs tabular-nums transition-colors duration-(--motion-base) ease-standard ${
                          statusType === "error"
                            ? "bg-status-failed-soft font-medium text-status-failed-foreground"
                            : statusType === "success"
                              ? "status-bar-flash-success font-medium text-status-completed-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {statusMessage}
                      </div>
                    )}
                    {showTimeline && (
                      <div
                        className={`h-full min-w-0 ${
                          chrome.statusBar
                            ? "flex-[2] border-l border-border/70"
                            : "flex-1"
                        }`}
                      >
                        <TrajectoryTimeline
                          app={app}
                          totalFrames={trajectoryLength}
                          compact={isNarrow}
                        />
                      </div>
                    )}
                  </div>
                )}

                <PluginDialogHost app={app} />

                <CommandPalette
                  app={app}
                  open={commandPaletteOpen}
                  onOpenChange={setCommandPaletteOpen}
                  onModeChange={handleModeChange}
                />

                <KeyboardShortcutsDialog
                  open={shortcutsOpen}
                  onOpenChange={setShortcutsOpen}
                />

                <StateSyncDialog
                  open={stateSync.pending !== null}
                  summary={stateSync.pending?.summary ?? null}
                  feedback={stateSync.feedback}
                  onKeepLocal={stateSync.keepLocal}
                  onApplyBackend={() => void stateSync.applyBackend()}
                  onDismissFeedback={stateSync.dismissFeedback}
                />
              </section>
            </LeftShellProvider>
          </BondMappingPickerProvider>
        </FormatPickerProvider>
      </BackendConnectionProvider>
    </ErrorBoundary>
  );
};

export default App;
