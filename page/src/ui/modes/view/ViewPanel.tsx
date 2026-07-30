import type { Molvis } from "@molvis/stage";
import type React from "react";
import { PipelineTab } from "./PipelineTab";

interface ViewPanelProps {
  app: Molvis | null;
}

export const ViewPanel: React.FC<ViewPanelProps> = ({ app }) => {
  return <PipelineTab app={app} />;
};
