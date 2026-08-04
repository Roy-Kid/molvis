import type { Molvis } from "@molvis/stage";
import { useEffect, useState } from "react";

/**
 * Center status-bar region: concise hover / selection / measurement context
 * from the stage (`info-text-change`). Empty when nothing is relevant.
 */
export function useViewportContext(app: Molvis | null): string {
  const [context, setContext] = useState("");

  useEffect(() => {
    if (!app) {
      setContext("");
      return;
    }

    const handleInfo = (text: string) => {
      setContext(typeof text === "string" ? text.trim() : "");
    };

    app.events.on("info-text-change", handleInfo);
    return () => {
      app.events.off("info-text-change", handleInfo);
    };
  }, [app]);

  return context;
}
