import type { Molvis } from "@molcrafts/molvis-stage";
import { AlertCircle, AlertTriangle, Check, Info, Loader2 } from "lucide-react";
import type React from "react";
import { useStatusMessage } from "@/hooks/useStatusMessage";
import type { StatusReportType } from "@/lib/status-report";
import { cn } from "@/lib/utils";

export interface ViewerStatusBarProps {
  app: Molvis | null;
  className?: string;
}

function ActivityIcon({
  type,
  progress,
}: {
  type: StatusReportType;
  progress?: number;
}) {
  const className = "size-3 shrink-0";
  if (type === "error") {
    return <AlertCircle className={cn(className, "text-status-failed")} />;
  }
  if (type === "warning") {
    return <AlertTriangle className={cn(className, "text-status-warning")} />;
  }
  if (type === "success") {
    return <Check className={cn(className, "text-status-completed")} />;
  }
  if (progress !== undefined) {
    return (
      <Loader2
        className={cn(className, "animate-spin text-muted-foreground")}
      />
    );
  }
  return <Info className={cn(className, "text-muted-foreground")} />;
}

function activityTextClass(type: StatusReportType): string {
  switch (type) {
    case "error":
      return "text-status-failed-foreground";
    case "warning":
      return "text-status-warning-foreground";
    case "success":
      return "text-status-completed-foreground";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Persistent bottom status bar for log, warning, and error messages only.
 * Viewport facts are rendered by ViewerInfoPanel on the canvas.
 */
export const ViewerStatusBar: React.FC<ViewerStatusBarProps> = ({
  app,
  className,
}) => {
  const { activity, dismissActivity } = useStatusMessage(app);

  const hasActivity = activity.text.length > 0;
  const isAlert = activity.type === "error" || activity.type === "warning";

  return (
    <div
      role="status"
      aria-live={activity.type === "error" ? "assertive" : "polite"}
      className={cn(
        "flex h-full min-w-0 flex-1 items-center gap-2 overflow-hidden px-2 font-mono text-micro tabular-nums",
        className,
      )}
    >
      {/* Left — application activity (alerts click-to-dismiss) */}
      {hasActivity && isAlert ? (
        <button
          key={activity.pulse}
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 overflow-hidden border-0 bg-transparent p-0 text-left font-mono text-micro tabular-nums"
          title={`${activity.text} (click to dismiss)`}
          onClick={dismissActivity}
        >
          <ActivityIcon type={activity.type} progress={activity.progress} />
          <span
            className={cn(
              "min-w-0 truncate leading-none",
              activityTextClass(activity.type),
            )}
          >
            {activity.text}
          </span>
        </button>
      ) : (
        <div
          key={activity.pulse}
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
          title={hasActivity ? activity.text : undefined}
        >
          {hasActivity && (
            <>
              <ActivityIcon type={activity.type} progress={activity.progress} />
              <span
                className={cn(
                  "min-w-0 truncate leading-none",
                  activityTextClass(activity.type),
                )}
              >
                {activity.text}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
