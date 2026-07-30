import type {
  DisplacementVectorsModifier as Core,
  Molvis,
} from "@molvis/stage";
import type React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApplyPipelineOperation } from "@/hooks/useApplyPipelineOperation";

interface Props {
  modifier: Core;
  app: Molvis | null;
  onUpdate: () => void;
}

export const DisplacementVectorsModifier: React.FC<Props> = ({
  modifier,
  app,
  onUpdate,
}) => {
  const { applyPipeline, pipelineRunning } = useApplyPipelineOperation(
    app,
    onUpdate,
    {
      running: "Computing displacements…",
      success: "Displacements updated",
      error: "Could not compute displacements",
    },
  );
  return (
    <fieldset
      disabled={!app || pipelineRunning}
      className="m-0 space-y-3 border-0 p-0"
    >
      <p className="text-micro text-muted-foreground">
        Writes Displacement.X/Y/Z vs a reference trajectory frame. Use Vector
        field to draw.
      </p>
      <div className="space-y-1.5">
        <Label className="text-micro">Reference frame index</Label>
        <Input
          type="number"
          min={0}
          step={1}
          className="h-8 text-xs"
          value={modifier.referenceFrame}
          onChange={(e) => {
            modifier.setReferenceFrame(Number(e.target.value));
            onUpdate();
          }}
          onBlur={() => void applyPipeline()}
        />
      </div>
    </fieldset>
  );
};
