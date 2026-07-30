import { Badge } from "@/components/ui/badge";

/** Warning-semantic marker for analysis output invalidated by new parameters. */
export const AnalysisFreshnessBadge = () => (
  <Badge
    variant="outline"
    className="h-4 shrink-0 rounded-control border-status-warning/30 bg-status-warning-soft px-1 text-micro font-medium uppercase tracking-wide text-status-warning-foreground"
  >
    outdated
  </Badge>
);
