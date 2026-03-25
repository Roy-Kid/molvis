import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TimelineControl } from "@/components/TimelineControl";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useBootstrapDemo } from "@/hooks/useBootstrapDemo";
import { useMolvisUiState } from "@/hooks/useMolvisUiState";
import { useStatusMessage } from "@/hooks/useStatusMessage";
import type { Molvis } from "@molvis/core";
import type React from "react";
import { useEffect, useState } from "react";
import MolvisWrapper from "./MolvisWrapper";
import { KeyboardShortcutsDialog } from "./ui/layout/KeyboardShortcutsDialog";
import { LeftSidebar } from "./ui/layout/LeftSidebar";
import { RightSidebar } from "./ui/layout/RightSidebar";
import { TopBar } from "./ui/layout/TopBar";

/**
 * Main page application shell for the standalone MolVis viewer.
 */
const App: React.FC = () => {
  const [app, setApp] = useState<Molvis | null>(null);
  const { currentMode, setCurrentMode, trajectoryLength } =
    useMolvisUiState(app);
  const { statusMessage, statusType } = useStatusMessage(app);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useBootstrapDemo(app, setCurrentMode);

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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleModeSwitch = (mode: string) => {
    if (!app) {
      return;
    }
    app.setMode(mode);
    setCurrentMode(mode);
  };

  return (
    <ErrorBoundary>
      <div
        className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden"
        onContextMenu={(e) => e.preventDefault()}
      >
        <TopBar app={app} currentMode={currentMode} />

        <ResizablePanelGroup
          orientation="horizontal"
          className="flex-1"
          defaultLayout={{ left: 0, canvas: 74, right: 26 }}
          resizeTargetMinimumSize={{ fine: 20, coarse: 36 }}
        >
          <ResizablePanel
            id="left"
            defaultSize="0%"
            collapsible={true}
            collapsedSize="0%"
            minSize="14%"
            maxSize="38%"
            className="bg-background flex flex-col min-w-0"
          >
            <LeftSidebar app={app} />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            id="canvas"
            defaultSize="74%"
            minSize="35%"
            className="flex flex-col min-w-[360px]"
          >
            <div className="flex-1 relative bg-muted/20 overflow-hidden">
              <MolvisWrapper onMount={setApp} />
            </div>

            {app && trajectoryLength > 1 && (
              <div className="h-9 border-t bg-muted/20 shrink-0 z-10">
                <TimelineControl app={app} totalFrames={trajectoryLength} />
              </div>
            )}
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            id="right"
            defaultSize="26%"
            minSize="15%"
            maxSize="40%"
            collapsible={true}
            collapsedSize="0%"
            className="bg-background flex flex-col min-w-0"
          >
            <RightSidebar
              app={app}
              currentMode={currentMode}
              onModeChange={handleModeSwitch}
            />
          </ResizablePanel>
        </ResizablePanelGroup>

        <div
          className={`h-4 border-t bg-muted/60 flex items-center px-2 text-[9px] shrink-0 ${statusType === "error" ? "text-red-500 font-bold bg-red-100/10" : "text-muted-foreground"}`}
        >
          {statusMessage}
        </div>

        <KeyboardShortcutsDialog
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
        />
      </div>
    </ErrorBoundary>
  );
};

export default App;
