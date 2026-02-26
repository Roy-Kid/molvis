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
import { useState } from "react";
import MolvisWrapper from "./MolvisWrapper";
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

  useBootstrapDemo(app, setCurrentMode);

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
        <TopBar
          app={app}
          currentMode={currentMode}
          onModeChange={handleModeSwitch}
        />

        {/* Main Layout */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Center Area: Viewport + Timeline */}
          <ResizablePanel
            defaultSize={75}
            className="flex flex-col min-w-[300px]"
          >
            <div className="flex-1 relative bg-muted/20 overflow-hidden">
              <MolvisWrapper onMount={setApp} />
            </div>

            {/* Timeline Control Bar - Only show if multiple frames */}
            {app && trajectoryLength > 1 && (
              <div className="h-14 border-t bg-muted/20 shrink-0 z-10">
                <TimelineControl app={app} totalFrames={trajectoryLength} />
              </div>
            )}
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel: Context Sensitive */}
          <ResizablePanel
            defaultSize={25}
            minSize={10}
            maxSize={50}
            collapsible={true}
            collapsedSize={0}
            className="bg-background flex flex-col min-w-0"
          >
            <RightSidebar app={app} currentMode={currentMode} />
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Bottom Status Bar */}
        <div
          className={`h-6 border-t bg-muted/60 flex items-center px-2 text-[10px] shrink-0 ${statusType === "error" ? "text-red-500 font-bold bg-red-100/10" : "text-muted-foreground"}`}
        >
          {statusMessage}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
