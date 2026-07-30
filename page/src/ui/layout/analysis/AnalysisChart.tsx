import { X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChartPopoutAction } from "@/components/scientific/ChartPopoutAction";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ViewerAction } from "@/components/viewer/ViewerAction";
import { ViewerIconAction } from "@/components/viewer/ViewerIconAction";
import { ViewerOperationState } from "@/components/viewer/ViewerOperationState";
import { cn } from "@/lib/utils";

/**
 * Imperative chart lifecycle used by {@link AnalysisChart}.
 * Each mount of the host (inline or modal) calls `mount` once and
 * `dispose` on teardown — charts that hold Vega views must not share
 * a container across both hosts.
 */
export interface AnalysisChartController {
  mount: (el: HTMLElement) => {
    ready: () => Promise<void>;
    dispose: () => void;
  };
}

interface AnalysisChartProps {
  /** Build the chart into `el`; return a dispose handle. */
  controller: AnalysisChartController;
  /** Re-mount key — change when data/config identity changes. */
  chartKey: string | number;
  title?: string;
  /** Fixed height class for the inline host. Default fills a tall sidebar slot. */
  className?: string;
  /** Extra class on the modal chart area. */
  modalClassName?: string;
}

const MODAL_DEFAULT = { w: 720, h: 520 };
const MODAL_MIN = { w: 360, h: 280 };

/**
 * Bump Vega/molplot axis label + tick font sizes after embed. molplot's
 * AxisConfig.tickfont is typed but not yet wired through the VL builder, so
 * we patch the rendered SVG once and on resize-driven re-embeds via a
 * MutationObserver on the host.
 */
function boostChartFonts(host: HTMLElement, scale = 1.35): void {
  const texts = host.querySelectorAll("svg text");
  for (const node of texts) {
    const el = node as SVGTextElement;
    if (el.dataset.molvisFontBoosted === "1") continue;
    const attr = el.getAttribute("font-size");
    const base = attr ? Number.parseFloat(attr) : Number.NaN;
    if (!Number.isFinite(base) || base <= 0) continue;
    // Axis titles (role-axis-title) get a slightly larger bump than ticks.
    const role = el.closest(".role-axis-title, .role-axis-label, .role-legend");
    const factor = role?.classList.contains("role-axis-title")
      ? scale * 1.1
      : scale;
    el.setAttribute("font-size", String(Math.round(base * factor * 10) / 10));
    el.dataset.molvisFontBoosted = "1";
  }
}

function ChartMount({
  controller,
  chartKey,
  label,
  className,
}: {
  controller: AnalysisChartController;
  chartKey: string | number;
  label: string;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is the explicit retry trigger for this imperative mount.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    setReady(false);
    setMountError(null);
    // Clear any prior SVG before remount (dispose should already do this).
    // `chartKey` is recorded so identity changes force a full remount.
    el.dataset.chartKey = String(chartKey);
    el.replaceChildren();
    let handle: ReturnType<AnalysisChartController["mount"]>;
    try {
      handle = controller.mount(el);
    } catch (error) {
      setMountError(error instanceof Error ? error.message : String(error));
      return;
    }

    let disposed = false;
    const apply = () => boostChartFonts(el);
    // Initial embed is async; observe for SVG insertion + re-embeds.
    const mo = new MutationObserver(apply);
    mo.observe(el, { childList: true, subtree: true });
    // Also try after a couple of frames in case the embed is already done.
    const t0 = requestAnimationFrame(apply);
    const t1 = window.setTimeout(apply, 50);
    const t2 = window.setTimeout(apply, 200);
    void handle
      .ready()
      .then(() => {
        if (disposed) return;
        apply();
        setReady(true);
      })
      .catch((error) => {
        if (disposed) return;
        setReady(false);
        setMountError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      disposed = true;
      mo.disconnect();
      cancelAnimationFrame(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      handle.dispose();
      el.replaceChildren();
    };
  }, [attempt, controller, chartKey]);

  return (
    <div
      aria-busy={!ready && !mountError}
      className={cn(
        // Fill the allocated box; molplot reads getBoundingClientRect and
        // re-embeds on resize, so a real non-zero size is required.
        "analysis-chart relative h-full w-full min-h-0 min-w-0",
        className,
      )}
    >
      <div
        ref={hostRef}
        role="img"
        aria-label={label}
        className="absolute inset-0 min-h-0 min-w-0"
      />
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/75 p-2 backdrop-blur-sm">
          <ViewerOperationState
            phase={mountError ? "error" : "loading"}
            message={mountError ? "Chart could not render" : "Rendering chart…"}
            detail={mountError ?? undefined}
            action={
              mountError ? (
                <ViewerAction
                  purpose="dismiss"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Retry
                </ViewerAction>
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

type ResizeEdge = "e" | "s" | "se";

/**
 * Shared analysis-panel chart host:
 * - fills its container (callers size the outer box)
 * - bumps axis label/tick fonts for sidebar density
 * - optional pop-out modal with a larger remount of the same chart
 * - modal is drag-resizable from edges / SE corner
 */
export const AnalysisChart: React.FC<AnalysisChartProps> = ({
  controller,
  chartKey,
  title = "Chart",
  className,
  modalClassName,
}) => {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(MODAL_DEFAULT);
  const dragRef = useRef<{
    edge: ResizeEdge;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) setSize(MODAL_DEFAULT);
  }, []);

  const onResizePointerDown = useCallback(
    (edge: ResizeEdge) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      dragRef.current = {
        edge,
        startX: e.clientX,
        startY: e.clientY,
        startW: size.w,
        startH: size.h,
      };
    },
    [size.h, size.w],
  );

  const onResizePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const maxW = Math.min(window.innerWidth - 32, window.innerWidth * 0.96);
    const maxH = Math.min(window.innerHeight - 32, window.innerHeight * 0.92);
    setSize({
      w:
        drag.edge === "s"
          ? drag.startW
          : Math.min(maxW, Math.max(MODAL_MIN.w, drag.startW + dx)),
      h:
        drag.edge === "e"
          ? drag.startH
          : Math.min(maxH, Math.max(MODAL_MIN.h, drag.startH + dy)),
    });
  }, []);

  const onResizePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // capture may already be released
    }
  }, []);

  const resizeByKeyboard = useCallback(
    (edge: ResizeEdge, event: React.KeyboardEvent) => {
      let dw = 0;
      let dh = 0;
      if (edge !== "s") {
        if (event.key === "ArrowRight") dw = 16;
        if (event.key === "ArrowLeft") dw = -16;
      }
      if (edge !== "e") {
        if (event.key === "ArrowDown") dh = 16;
        if (event.key === "ArrowUp") dh = -16;
      }
      if (dw === 0 && dh === 0) return;
      event.preventDefault();
      const maxW = Math.min(window.innerWidth - 32, window.innerWidth * 0.96);
      const maxH = Math.min(window.innerHeight - 32, window.innerHeight * 0.92);
      setSize((current) => ({
        w: Math.min(maxW, Math.max(MODAL_MIN.w, current.w + dw)),
        h: Math.min(maxH, Math.max(MODAL_MIN.h, current.h + dh)),
      }));
    },
    [],
  );

  return (
    <>
      <div
        className={cn(
          // Default inline footprint: full width, tall enough for readable axes.
          // group: pop-out stays hidden until the chart host is hovered/focused.
          "group/chart relative h-56 min-h-chart w-full",
          className,
        )}
      >
        <ChartMount
          controller={controller}
          chartKey={`inline-${chartKey}`}
          label={title}
        />
        <ChartPopoutAction onOpen={() => setOpen(true)} />
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            // Drop the default max-w so our pixel size fully controls layout.
            "flex flex-col gap-2 overflow-hidden p-3 sm:max-w-none",
            modalClassName,
          )}
          style={{
            width: size.w,
            height: size.h,
            maxWidth: "96vw",
            maxHeight: "92vh",
          }}
        >
          <DialogHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 pr-0">
            <DialogTitle className="text-sm font-medium">{title}</DialogTitle>
            <ViewerIconAction
              type="button"
              icon={<X />}
              label="Close chart"
              tooltipSide="left"
              onClick={() => setOpen(false)}
            />
          </DialogHeader>

          <div className="relative min-h-0 w-full flex-1">
            {open && (
              <ChartMount
                controller={controller}
                // Size changes are handled by molplot's ResizeObserver — do
                // not fold size into chartKey or every drag frame remounts.
                chartKey={`modal-${chartKey}`}
                label={title}
                className="h-full min-h-0"
              />
            )}
          </div>

          {/* Resize handles — pointer and keyboard operable. */}
          <hr
            aria-label="Resize chart width"
            aria-orientation="vertical"
            aria-valuemin={MODAL_MIN.w}
            aria-valuemax={
              typeof window === "undefined"
                ? 4096
                : Math.round(window.innerWidth * 0.96)
            }
            aria-valuenow={size.w}
            tabIndex={0}
            className="absolute top-3 right-0 bottom-3 w-2 cursor-ew-resize touch-none border-0"
            onPointerDown={onResizePointerDown("e")}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
            onKeyDown={(event) => resizeByKeyboard("e", event)}
          />
          <hr
            aria-label="Resize chart height"
            aria-orientation="horizontal"
            aria-valuemin={MODAL_MIN.h}
            aria-valuemax={
              typeof window === "undefined"
                ? 4096
                : Math.round(window.innerHeight * 0.92)
            }
            aria-valuenow={size.h}
            tabIndex={0}
            className="absolute right-3 bottom-0 left-3 h-2 cursor-ns-resize touch-none border-0"
            onPointerDown={onResizePointerDown("s")}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
            onKeyDown={(event) => resizeByKeyboard("s", event)}
          />
          <button
            type="button"
            aria-label="Resize chart width and height"
            className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize touch-none border-0 bg-transparent p-0"
            onPointerDown={onResizePointerDown("se")}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
            onKeyDown={(event) => resizeByKeyboard("se", event)}
          >
            {/* Grip mark: two diagonal ticks at the SE corner */}
            <span className="pointer-events-none absolute right-1 bottom-2 block h-px w-3 origin-bottom-right -rotate-45 bg-muted-foreground/60" />
            <span className="pointer-events-none absolute right-1 bottom-1 block h-px w-2 origin-bottom-right -rotate-45 bg-muted-foreground/60" />
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
};
