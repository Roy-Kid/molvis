import type { Molvis } from "@molvis/stage";
import { ChevronDown, ChevronUp } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ViewerIconAction } from "@/components/viewer/ViewerIconAction";
import { cn } from "@/lib/utils";
import {
  getBottomPanelOpenRequest,
  subscribeBottomPanelHost,
} from "../contributions/bottom_panel_host";
import { usePluginBottomPanels } from "../hooks";

const DEFAULT_HEIGHT_PX = 220;
const MIN_HEIGHT_PX = 120;
const MAX_HEIGHT_RATIO = 0.5;

export interface BottomPanelHostProps {
  app: Molvis | null;
  /** When true, host is hidden (fullscreen chrome). */
  hidden?: boolean;
}

/**
 * VS Code–style bottom contribution host for `api.panels` with
 * `position: "bottom"`. Opened from the command palette, not native chrome.
 */
export const BottomPanelHost: React.FC<BottomPanelHostProps> = ({
  app,
  hidden = false,
}) => {
  const panels = usePluginBottomPanels();
  const [expanded, setExpanded] = useState(false);
  const [heightPx, setHeightPx] = useState(DEFAULT_HEIGHT_PX);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const lastHandledSeq = useRef(0);

  useEffect(() => {
    if (panels.length === 0) {
      setActiveId(undefined);
      return;
    }
    setActiveId((current) => {
      if (current && panels.some((p) => p.id === current)) return current;
      return panels[0].id;
    });
  }, [panels]);

  // Command palette (and others) request open/focus via bottom_panel_host.
  useEffect(() => {
    const apply = () => {
      const req = getBottomPanelOpenRequest();
      if (!req || req.seq === lastHandledSeq.current) return;
      if (!panels.some((p) => p.id === req.id)) return;
      lastHandledSeq.current = req.seq;
      setActiveId(req.id);
      setExpanded(true);
    };
    apply();
    return subscribeBottomPanelHost(apply);
  }, [panels]);

  const activeTitle = useMemo(
    () => panels.find((p) => p.id === activeId)?.title ?? "Panel",
    [panels, activeId],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = drag.startY - e.clientY;
      const maxH = Math.round(window.innerHeight * MAX_HEIGHT_RATIO);
      setHeightPx(Math.min(maxH, Math.max(MIN_HEIGHT_PX, drag.startH + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  if (hidden || panels.length === 0) return null;

  return (
    <div
      className="motion-enter-bottom flex shrink-0 flex-col border-t border-border/70 bg-background"
      data-slot="plugin-bottom-panel-host"
    >
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border/50 bg-background/95 px-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-control px-1 py-0.5 text-left text-xs font-medium text-foreground hover:bg-interactive"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{activeTitle}</span>
          <span className="shrink-0 text-micro text-muted-foreground">
            {panels.length > 1 ? `${panels.length} panels` : "bottom"}
          </span>
        </button>
        <ViewerIconAction
          icon={expanded ? <ChevronDown /> : <ChevronUp />}
          label={expanded ? "Collapse bottom panel" : "Expand bottom panel"}
          tooltipSide="top"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0"
        />
      </div>

      {expanded && (
        <>
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-valuenow={heightPx}
            aria-valuemin={MIN_HEIGHT_PX}
            aria-valuemax={Math.round(
              (typeof window !== "undefined" ? window.innerHeight : 800) *
                MAX_HEIGHT_RATIO,
            )}
            tabIndex={0}
            aria-label="Resize bottom panel"
            className="group relative h-1.5 shrink-0 cursor-row-resize bg-border/40 hover:bg-ring/40"
            onPointerDown={(e) => {
              e.preventDefault();
              dragRef.current = { startY: e.clientY, startH: heightPx };
            }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-0.5 w-10 -translate-y-1/2 rounded-full bg-muted-foreground/40 group-hover:bg-ring" />
          </div>
          <div className="min-h-0 overflow-hidden" style={{ height: heightPx }}>
            {panels.length === 1 ? (
              (() => {
                const panel = panels[0];
                const Body = panel.render;
                return (
                  <div className="flex h-full min-h-0 flex-col">
                    <Body app={app} />
                  </div>
                );
              })()
            ) : (
              <Tabs
                value={activeId}
                onValueChange={setActiveId}
                className="flex h-full min-h-0 flex-col gap-0"
              >
                <TabsList
                  variant="line"
                  className="h-8 w-full shrink-0 justify-start rounded-none border-b border-border/50 px-1"
                >
                  {panels.map((p) => (
                    <TabsTrigger
                      key={p.id}
                      value={p.id}
                      className="rounded-none px-3 text-xs"
                    >
                      {p.title}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {panels.map((p) => {
                  const Body = p.render;
                  return (
                    <TabsContent
                      key={p.id}
                      value={p.id}
                      className={cn("mt-0 min-h-0 flex-1 overflow-hidden")}
                    >
                      <Body app={app} />
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </div>
        </>
      )}
    </div>
  );
};
