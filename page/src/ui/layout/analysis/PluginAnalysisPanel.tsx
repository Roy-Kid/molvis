import type { AnalysisParamValues, Molvis } from "@molcrafts/molvis-stage";
import type React from "react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getPluginAnalysisSpec,
  pluginSpecToDefinition,
} from "@/plugins/analysis_catalog";
import type { PluginAnalysisResult } from "@/plugins/types";
import { AnalysisAlert } from "./AnalysisAlert";
import { AnalysisPanelShell } from "./AnalysisPanelShell";
import { AnalysisParamsForm } from "./AnalysisParamsForm";
import { AnalysisRunBar } from "./AnalysisRunBar";
import { ResultSection } from "./ResultSection";
import { ResultView } from "./ResultView";

interface PluginAnalysisPanelProps {
  app: Molvis | null;
  analysisId: string;
  scopeSummary?: string;
  children?: React.ReactNode;
}

interface RunState {
  status: "idle" | "running" | "done" | "error";
  result?: PluginAnalysisResult;
  message?: string;
}

/**
 * Runs a page-side plugin analysis registered via `api.analysis.register`.
 * Params use the same form as molrs generic panels; results use `resultKind`
 * or a custom `renderResult` from the plugin.
 */
export const PluginAnalysisPanel: React.FC<PluginAnalysisPanelProps> = ({
  app,
  analysisId,
  scopeSummary,
  children,
}) => {
  const spec = getPluginAnalysisSpec(analysisId);
  const definition = useMemo(
    () => (spec ? pluginSpecToDefinition(spec) : null),
    [spec],
  );

  const [params, setParams] = useState<AnalysisParamValues>(() => {
    if (!definition) return {};
    const init: AnalysisParamValues = {};
    for (const p of definition.params) {
      init[p.key] = p.default;
    }
    return init;
  });
  const [run, setRun] = useState<RunState>({ status: "idle" });

  if (!spec || !definition) {
    return (
      <EmptyState
        density="compact"
        title="Plugin analysis unavailable"
        description={`No active plugin registered analysis '${analysisId}'.`}
      />
    );
  }

  const onRun = async () => {
    if (!app) return;
    setRun({ status: "running" });
    try {
      const result = await spec.run({ app, params });
      setRun({ status: "done", result });
    } catch (err) {
      setRun({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const CustomResult = spec.renderResult;

  return (
    <AnalysisPanelShell
      footer={
        <div className="shrink-0 space-y-2 border-t border-border/70 bg-background/95 px-2 py-2 backdrop-blur">
          {children}
          <AnalysisRunBar
            className="border-0 p-0"
            onRun={() => void onRun()}
            disabled={!app}
            running={run.status === "running"}
            label={`Run ${spec.label}`}
            summary={scopeSummary}
            hint={
              run.status === "error" ? (
                <span className="text-destructive">{run.message}</span>
              ) : undefined
            }
          />
        </div>
      }
    >
      {definition.params.length > 0 && (
        <div className="flex flex-col gap-2 p-2">
          <AnalysisParamsForm
            params={definition.params}
            values={params}
            onChange={setParams}
            disabled={run.status === "running"}
          />
        </div>
      )}

      {run.status === "error" && (
        <AnalysisAlert tone="error">{run.message}</AnalysisAlert>
      )}

      {run.status === "done" && run.result && (
        <ResultSection>
          {CustomResult ? (
            <CustomResult result={run.result} />
          ) : (
            <ResultView
              resultKind={definition.resultKind}
              payload={
                typeof run.result.data === "object" && run.result.data !== null
                  ? (run.result.data as Record<string, unknown>)
                  : { value: run.result.data }
              }
              label={spec.label}
            />
          )}
        </ResultSection>
      )}
    </AnalysisPanelShell>
  );
};
