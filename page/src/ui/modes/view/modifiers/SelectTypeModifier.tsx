import type {
  SelectTypeModifier as CoreSelectTypeModifier,
  Molvis,
} from "@molvis/stage";
import type React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApplyPipelineOperation } from "@/hooks/useApplyPipelineOperation";

interface Props {
  modifier: CoreSelectTypeModifier;
  app: Molvis | null;
  onUpdate: () => void;
}

const PIPELINE_COPY = {
  running: "Updating type selection…",
  success: "Type selection updated",
  error: "Could not update type selection",
};

export const SelectTypeModifier: React.FC<Props> = ({
  modifier,
  app,
  onUpdate,
}) => {
  const { applyPipeline, pipelineRunning } = useApplyPipelineOperation(
    app,
    onUpdate,
    PIPELINE_COPY,
  );

  return (
    <fieldset
      disabled={!app || pipelineRunning}
      aria-busy={pipelineRunning}
      className="m-0 space-y-3 border-0 p-0"
    >
      <p className="text-micro text-muted-foreground">
        Select atoms by element and/or type column. Empty lists select nothing.
      </p>
      <div className="space-y-1.5">
        <Label className="text-micro" htmlFor="select-type-elements">
          Elements (comma-separated)
        </Label>
        <Input
          id="select-type-elements"
          className="h-8 text-xs"
          defaultValue={modifier.elements.join(",")}
          placeholder="C, H, O"
          onBlur={(e) => {
            const parts = e.target.value
              .split(/[,\s]+/)
              .map((s) => s.trim())
              .filter(Boolean);
            modifier.elements = parts;
            void applyPipeline();
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-micro" htmlFor="select-type-types">
          Types (comma-separated, stringified)
        </Label>
        <Input
          id="select-type-types"
          className="h-8 text-xs"
          defaultValue={modifier.types.join(",")}
          placeholder="1, 2"
          onBlur={(e) => {
            const parts = e.target.value
              .split(/[,\s]+/)
              .map((s) => s.trim())
              .filter(Boolean);
            modifier.types = parts;
            void applyPipeline();
          }}
        />
      </div>
    </fieldset>
  );
};
