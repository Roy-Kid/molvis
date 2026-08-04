import type { Molvis } from "@molvis/stage";
import { X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ViewerIconAction } from "@/components/viewer/ViewerIconAction";
import { usePointerDrag } from "@/hooks/usePointerDrag";
import { cn } from "@/lib/utils";
import {
  RESIZE_KEYBOARD_STEP_PX,
  RESIZE_MAX_HEIGHT_RATIO,
  RESIZE_MIN_HEIGHT_PX,
} from "@/lib/viewer-layout";
import {
  getBottomPanelOpenRequest,
  subscribeBottomPanelHost,
} from "@/plugins/contributions/bottom_panel_host";
import { usePluginBottomPanels } from "@/plugins/hooks";

const DEFAULT_HEIGHT_PX = 220;
const MIN_HEIGHT_PX = RESIZE_MIN_HEIGHT_PX;
const MAX_HEIGHT_RATIO = RESIZE_MAX_HEIGHT_RATIO;
/** Below this height on pointer-up → fully close. */
const CLOSE_HEIGHT_PX = MIN_HEIGHT_PX * 0.55;
/** Pull-up distance from a closed edge that counts as "open intent" on click. */
const CLICK_OPEN_SLOP_PX = 6;

export interface WorkbenchBottomPanelProps {
  app: Molvis | null;
  hidden?: boolean;
}

function clampHeight(px: number): number {
  const maxH = Math.round(window.innerHeight * MAX_HEIGHT_RATIO);
  return Math.min(maxH, Math.max(0, px));
}

/**
 * Native bottom workbench.
 *
 * Single DOM tree for open/closed so the resize hairline never remounts and
 * "flies" when crossing the open threshold. Live height is written to the
 * body element during drag; React state commits on pointer-up.
 */
export const WorkbenchBottomPanel: React.FC<WorkbenchBottomPanelProps> = ({
  app,
  hidden = false,
}) => {
  const pluginPanels = usePluginBottomPanels();
  const hasProvider = pluginPanels.length > 0;

  const [expanded, setExpanded] = useState(false);
  const [heightPx, setHeightPx] = useState(DEFAULT_HEIGHT_PX);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);

  const bodyRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef(DEFAULT_HEIGHT_PX);
  const expandedRef = useRef(false);
  const lastHandledSeq = useRef(0);

  const paintHeight = useCallback((next: number, open: boolean) => {
    heightRef.current = next;
    expandedRef.current = open;
    const body = bodyRef.current;
    const chrome = chromeRef.current;
    if (body) {
      body.style.height = open ? `${Math.max(next, 0)}px` : "0px";
    }
    if (chrome) {
      chrome.hidden = !open;
      chrome.style.display = open ? "" : "none";
    }
  }, []);

  useEffect(() => {
    heightRef.current = heightPx;
  }, [heightPx]);

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  useEffect(() => {
    if (!hasProvider) {
      setActiveId(undefined);
      setExpanded(false);
      paintHeight(heightRef.current, false);
      return;
    }
    setActiveId((current) => {
      if (current && pluginPanels.some((t) => t.id === current)) return current;
      return pluginPanels[0]?.id;
    });
    if (pluginPanels.some((p) => p.defaultOpen)) {
      setExpanded(true);
      paintHeight(
        heightRef.current < MIN_HEIGHT_PX
          ? DEFAULT_HEIGHT_PX
          : heightRef.current,
        true,
      );
      setHeightPx((h) => (h < MIN_HEIGHT_PX ? DEFAULT_HEIGHT_PX : h));
    }
  }, [hasProvider, pluginPanels, paintHeight]);

  useEffect(() => {
    const apply = () => {
      const req = getBottomPanelOpenRequest();
      if (!req || req.seq === lastHandledSeq.current) return;
      const match = pluginPanels.find(
        (p) =>
          p.id === req.id ||
          p.id.endsWith(`.${req.id}`) ||
          p.id.endsWith(req.id),
      );
      if (!match) return;
      lastHandledSeq.current = req.seq;
      setActiveId(match.id);
      const nextH =
        heightRef.current < MIN_HEIGHT_PX
          ? DEFAULT_HEIGHT_PX
          : heightRef.current;
      setHeightPx(nextH);
      setExpanded(true);
      paintHeight(nextH, true);
    };
    apply();
    return subscribeBottomPanelHost(apply);
  }, [pluginPanels, paintHeight]);

  /**
   * Height this panel had when the current drag began; 0 when it started
   * from the closed edge. The gesture itself lives in usePointerDrag — what
   * stays here is the part that is genuinely this panel's: pixels against
   * the viewport, snap-close, and click-to-open.
   */
  const startHeightRef = useRef(0);

  const { onPointerDown: onHandlePointerDown, dragging } = usePointerDrag({
    onMove: (event, origin) => {
      const raw = startHeightRef.current + (origin.y - event.clientY);
      if (raw < CLOSE_HEIGHT_PX) {
        // Keep the drag alive; paint collapsed so the hairline stays under
        // the cursor.
        paintHeight(heightRef.current || DEFAULT_HEIGHT_PX, false);
        return;
      }
      paintHeight(clampHeight(Math.max(MIN_HEIGHT_PX, raw)), true);
    },
    onEnd: (event, origin) => {
      const startH = startHeightRef.current;
      const delta = origin.y - event.clientY; // up = positive
      const raw = startH + delta;

      // Closed edge: tiny movement = click-to-open at default height.
      if (startH <= 0 && Math.abs(delta) < CLICK_OPEN_SLOP_PX) {
        setExpanded(true);
        setHeightPx(DEFAULT_HEIGHT_PX);
        paintHeight(DEFAULT_HEIGHT_PX, true);
        return;
      }

      if (raw < CLOSE_HEIGHT_PX) {
        setExpanded(false);
        paintHeight(heightRef.current || DEFAULT_HEIGHT_PX, false);
        return;
      }

      const next = clampHeight(Math.max(MIN_HEIGHT_PX, raw));
      setExpanded(true);
      setHeightPx(next);
      paintHeight(next, true);
    },
  });

  const beginResize = (event: React.PointerEvent) => {
    startHeightRef.current = expandedRef.current ? heightRef.current : 0;
    onHandlePointerDown(event);
  };

  const closePanel = useCallback(() => {
    setExpanded(false);
    paintHeight(heightRef.current || DEFAULT_HEIGHT_PX, false);
  }, [paintHeight]);

  if (hidden || !hasProvider) return null;

  const maxH = Math.round(
    (typeof window !== "undefined" ? window.innerHeight : 800) *
      MAX_HEIGHT_RATIO,
  );

  return (
    <div
      className="flex shrink-0 flex-col bg-background"
      data-slot="workbench-bottom-panel"
      data-state={expanded ? "expanded" : "collapsed"}
    >
      {/* <hr> carries role="separator" natively — matches the sibling
          handle in PipelinePropertiesPane rather than re-deriving it. */}
      <hr
        aria-orientation="horizontal"
        aria-valuenow={expanded ? heightPx : 0}
        aria-valuemin={0}
        aria-valuemax={maxH}
        // No aria-expanded: it is not a supported attribute of role="separator".
        // Collapsed state reaches assistive tech via aria-valuenow=0 + the label.
        aria-label={expanded ? "Resize bottom panel" : "Open bottom panel"}
        tabIndex={0}
        data-resizing={dragging ? "true" : undefined}
        className={cn(
          "workbench-split workbench-split-h workbench-split-interactive",
          "z-10 touch-none cursor-row-resize select-none",
          // Closed edge: slightly taller hit target, still a 1px hairline paint.
          !expanded && "h-1 border-0",
        )}
        onPointerDown={beginResize}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!expanded) {
              if (!activeId && pluginPanels[0]) setActiveId(pluginPanels[0].id);
              setExpanded(true);
              setHeightPx(DEFAULT_HEIGHT_PX);
              paintHeight(DEFAULT_HEIGHT_PX, true);
            }
            return;
          }
          if (!expanded) return;
          if (e.key === "ArrowUp") {
            e.preventDefault();
            const next = clampHeight(
              heightRef.current + RESIZE_KEYBOARD_STEP_PX,
            );
            setHeightPx(next);
            paintHeight(next, true);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            const next = heightRef.current - RESIZE_KEYBOARD_STEP_PX;
            if (next < CLOSE_HEIGHT_PX) {
              closePanel();
            } else {
              const clamped = clampHeight(Math.max(MIN_HEIGHT_PX, next));
              setHeightPx(clamped);
              paintHeight(clamped, true);
            }
          }
        }}
      />

      <div
        ref={chromeRef}
        hidden={!expanded}
        className="flex h-6 shrink-0 items-center gap-0.5 px-1"
        style={expanded ? undefined : { display: "none" }}
      >
        <div
          role="tablist"
          aria-label="Bottom panels"
          className="flex h-full min-w-0 flex-1 items-stretch justify-start"
        >
          {pluginPanels.map((p) => {
            const selected = p.id === activeId;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  "relative h-full shrink-0 px-2 text-micro font-medium",
                  "border-0 bg-transparent shadow-none outline-none",
                  "text-muted-foreground hover:text-foreground",
                  "focus-visible:ring-1 focus-visible:ring-ring",
                  selected && "text-accent",
                )}
                onClick={() => setActiveId(p.id)}
              >
                {p.title}
                {selected ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-1.5 bottom-0 h-px bg-accent"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        <ViewerIconAction
          icon={<X />}
          label="Close panel"
          tooltipSide="top"
          onClick={closePanel}
          className="size-6 shrink-0"
        />
      </div>

      <div
        ref={bodyRef}
        className="min-h-0 overflow-hidden"
        style={{ height: expanded ? heightPx : 0 }}
      >
        {pluginPanels.map((p) => {
          const Body = p.render;
          const active = p.id === activeId;
          return (
            <div
              key={p.id}
              hidden={!active}
              className="h-full min-h-0 overflow-hidden bg-background"
            >
              {active && (expanded || dragging) ? <Body app={app} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
