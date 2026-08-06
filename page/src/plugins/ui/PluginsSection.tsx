import {
  AlertCircle,
  Check,
  Circle,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { ViewerIconAction } from "@/components/viewer/ViewerIconAction";
import { SettingsSection } from "@/ui/layout/SettingsSection";
import { usePluginRuntimeStates } from "../hooks";
import { pluginManager } from "../manager";

interface PluginsSectionProps {
  sectionId?: string;
}

/**
 * Settings → Plugins: underline field + borderless icon actions only.
 */
export const PluginsSection: React.FC<PluginsSectionProps> = ({
  sectionId,
}) => {
  const plugins = usePluginRuntimeStates();
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const onInstall = useCallback(async () => {
    const value = source.trim();
    if (!value) return;
    setBusy(true);
    setFormError(null);
    try {
      await pluginManager.install(value);
      setSource("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [source]);

  return (
    <SettingsSection id={sectionId} title="Plugins">
      <div className="flex items-end gap-0.5">
        <Input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="owner/repo[@v1.2.3]"
          className="h-control-compact min-w-0 flex-1 rounded-none border-0 border-b border-border bg-transparent px-0 shadow-none focus-visible:border-accent focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter") void onInstall();
          }}
          disabled={busy}
          aria-label="Plugin source (GitHub owner/repo)"
        />
        <ViewerIconAction
          icon={busy ? <Loader2 className="animate-spin" /> : <Plus />}
          label="Add"
          disabled={busy || !source.trim()}
          onClick={() => void onInstall()}
        />
      </div>
      <p className="text-micro text-muted-foreground">
        GitHub repo only — host loads Release assets for you. Local debug:{" "}
        <span className="font-mono">http://127.0.0.1:4173/</span>
      </p>

      {formError ? (
        <p className="truncate text-micro text-destructive" title={formError}>
          {formError}
        </p>
      ) : null}

      {plugins.length === 0 ? null : (
        <ul className="divide-y divide-border">
          {plugins.map((p) => (
            <li
              key={p.source}
              className="flex flex-wrap items-center gap-1 py-1.5 first:pt-0 last:pb-0"
            >
              <StatusIcon status={p.status} error={p.error} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">
                  {p.name ?? p.id ?? p.source}
                  {p.version ? (
                    <span className="ml-1 font-normal text-muted-foreground">
                      {p.version}
                    </span>
                  ) : null}
                </div>
                <div
                  className="truncate font-mono text-micro text-muted-foreground"
                  title={
                    p.resolvedRef && !p.source.includes("@")
                      ? `${p.source} → ${p.resolvedRef}`
                      : p.source
                  }
                >
                  {p.source}
                  {p.resolvedRef && !p.source.includes("@") ? (
                    <span className="text-muted-foreground/80">
                      {" "}
                      @{p.resolvedRef}
                    </span>
                  ) : null}
                </div>
              </div>
              <ViewerIconAction
                icon={<Power />}
                label={p.enabled ? "Disable" : "Enable"}
                selected={p.enabled}
                onClick={() => {
                  void pluginManager.setEnabled(p.source, !p.enabled);
                }}
              />
              <ViewerIconAction
                icon={<RefreshCw />}
                label="Reload"
                onClick={() => void pluginManager.reload(p.source)}
              />
              <ViewerIconAction
                icon={<Trash2 />}
                label="Remove"
                className="text-destructive hover:text-destructive"
                onClick={() => void pluginManager.uninstall(p.source)}
              />
              {/* The reason a plugin failed belongs on screen, not only in a
                  tooltip: a broken bundle otherwise looks like an idle one. */}
              {p.status === "error" && p.error ? (
                <p className="w-full break-words pl-5 font-mono text-micro text-destructive">
                  {p.error}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
};

function StatusIcon({ status, error }: { status: string; error?: string }) {
  if (status === "error") {
    return (
      <span
        className="flex size-control-compact shrink-0 items-center justify-center text-destructive"
        title={error ?? "Error"}
      >
        <AlertCircle className="size-3.5" aria-hidden />
        <span className="sr-only">{error ?? "Error"}</span>
      </span>
    );
  }
  if (status === "loading") {
    return (
      <span
        className="flex size-control-compact shrink-0 items-center justify-center text-muted-foreground"
        title="Loading"
      >
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span
        className="flex size-control-compact shrink-0 items-center justify-center text-accent"
        title="Active"
      >
        <Check className="size-3.5" aria-hidden />
      </span>
    );
  }
  // idle / disabled — hollow circle (not PowerOff)
  return (
    <span
      className="flex size-control-compact shrink-0 items-center justify-center text-muted-foreground"
      title={status === "disabled" ? "Disabled" : "Idle"}
    >
      <Circle className="size-3.5 opacity-50" aria-hidden />
    </span>
  );
}
