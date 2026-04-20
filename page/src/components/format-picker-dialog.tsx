import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Molvis } from "@molvis/core";
import {
  FILE_FORMAT_REGISTRY,
  type FileFormat,
  inferFormatFromFilename,
  loadFileContent,
} from "@molvis/core/io";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type PickerReason = "unknown-extension" | "no-extension";

interface PickerState {
  filename: string;
  reason: PickerReason;
}

type PickFormat = (
  filename: string,
  reason: PickerReason,
) => Promise<FileFormat | null>;

const FormatPickerContext = createContext<PickFormat | null>(null);

/**
 * Provides a single shared format-picker dialog to the rest of the app.
 * Any consumer can call `useFormatPicker()` to get an async
 * `pickFormat(filename, reason)` that resolves with the user's pick
 * (or `null` on cancel). The dialog itself is mounted once at the
 * provider root so every ingress point uses the same modal.
 */
export const FormatPickerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<PickerState | null>(null);
  const resolverRef = useRef<((format: FileFormat | null) => void) | null>(
    null,
  );

  const close = useCallback((format: FileFormat | null) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setState(null);
    resolve?.(format);
  }, []);

  const pickFormat = useCallback<PickFormat>((filename, reason) => {
    return new Promise<FileFormat | null>((resolve) => {
      resolverRef.current?.(null);
      resolverRef.current = resolve;
      setState({ filename, reason });
    });
  }, []);

  return (
    <FormatPickerContext.Provider value={pickFormat}>
      {children}
      {state && (
        <FormatPickerDialog
          filename={state.filename}
          reason={state.reason}
          onPick={(format) => close(format)}
          onCancel={() => close(null)}
        />
      )}
    </FormatPickerContext.Provider>
  );
};

/**
 * Returns the `pickFormat(filename, reason)` helper. Throws if called
 * outside a `<FormatPickerProvider>` — that is by design so a silent
 * fallback never reintroduces the old "guess pdb" behavior.
 */
export function useFormatPicker(): PickFormat {
  const value = useContext(FormatPickerContext);
  if (!value) {
    throw new Error(
      "useFormatPicker must be used within <FormatPickerProvider>",
    );
  }
  return value;
}

/**
 * Resolve a FileFormat for `filename` (by extension, otherwise by prompting
 * the user) and call `loadFileContent`. Returns `true` if the load began,
 * `false` if the user cancelled the picker.
 */
export async function loadFileWithFormatPrompt(
  app: Molvis,
  content: string | Record<string, string>,
  filename: string,
  pickFormat: PickFormat,
): Promise<boolean> {
  if (typeof content !== "string") {
    await loadFileContent(app, content, filename);
    return true;
  }

  const inferred = inferFormatFromFilename(filename);
  if (inferred) {
    await loadFileContent(app, content, filename, inferred);
    return true;
  }

  const reason = filename.includes(".") ? "unknown-extension" : "no-extension";
  const picked = await pickFormat(filename, reason);
  if (!picked) {
    return false;
  }
  await loadFileContent(app, content, filename, picked);
  return true;
}

interface FormatPickerDialogProps {
  filename: string;
  reason: PickerReason;
  onPick: (format: FileFormat) => void;
  onCancel: () => void;
}

const FormatPickerDialog: React.FC<FormatPickerDialogProps> = ({
  filename,
  reason,
  onPick,
  onCancel,
}) => {
  const title =
    reason === "no-extension"
      ? "File has no extension"
      : "Unrecognized file extension";
  const describe = useMemo(
    () =>
      reason === "no-extension"
        ? `MolVis couldn't infer a format because "${filename}" has no extension. Pick a parser below.`
        : `MolVis doesn't recognize the extension of "${filename}". Pick the parser you'd like to use.`,
    [filename, reason],
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{describe}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-1.5">
          {FILE_FORMAT_REGISTRY.map((entry) => (
            <li key={entry.format}>
              <button
                type="button"
                onClick={() => onPick(entry.format)}
                className="w-full text-left border rounded-md px-3 py-2 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{entry.label}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {entry.extensions.map((e) => `.${e}`).join(" ")}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {entry.description}
                </div>
              </button>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
