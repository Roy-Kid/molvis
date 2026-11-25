import { CameraRegular as Camera } from "@fluentui/react-icons";
import type { Molvis } from "@molcrafts/molvis-stage";
import { IconAction } from "@molcrafts/ui";
import { showImageExportDialog } from "@molcrafts/ui-web-components/image-export";
import { useEffect, useRef } from "react";

/** Stage supplies the transparent viewport capture to the shared export UI. */
export function ScreenshotDialog({ app }: { app: Molvis | null }) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    if (!app) return;
    return () => {
      dialog.current?.close();
      dialog.current = null;
    };
  }, [app]);
  return (
    <IconAction
      icon={<Camera />}
      label="Screenshot"
      disabled={!app}
      onClick={() => {
        if (!app || dialog.current?.open) return;
        dialog.current = showImageExportDialog(app.canvas.ownerDocument.body, {
          title: "Screenshot",
          filename: "molvis-screenshot.png",
          initialAspect: 4 / 3,
          capture: async () => ({
            kind: "raster",
            dataUrl: await app.screenshot({
              width: app.canvas.width,
              height: app.canvas.height,
              transparentBackground: true,
              format: "png",
            }),
          }),
        });
      }}
    />
  );
}
