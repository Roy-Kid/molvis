import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingsSection } from "@/ui/layout/SettingsSection";
import { usePluginRuntimeStates } from "../hooks";
import { pluginManager } from "../manager";

/**
 * Settings section: install plugins from GitHub / URL and manage lifecycle.
 *
 * Trust model (product decision): any source is accepted without audit;
 * remote code runs in the page. The UI states this explicitly.
 */
interface PluginsSectionProps {
  sectionId?: string;
}

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
    <SettingsSection
      id={sectionId}
      title="Plugins"
      description={
        <>
          Add a GitHub location (<code className="text-micro">owner/repo</code>{" "}
          pins to the <strong>latest release</strong>; use{" "}
          <code className="text-micro">owner/repo@tag</code> to pin) or any
          HTTPS plugin URL. Remote code runs in this page with full access to
          the viewer — only install sources you trust.
        </>
      }
    >
      <div className="flex gap-2">
        <Input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="owner/repo  or  owner/repo@v1.0.0"
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") void onInstall();
          }}
          disabled={busy}
        />
        <Button
          type="button"
          size="sm"
          className="shrink-0 h-8"
          onClick={() => void onInstall()}
          disabled={busy || !source.trim()}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          <span className="ml-1">Add</span>
        </Button>
      </div>

      {formError && <p className="text-micro text-destructive">{formError}</p>}

      {plugins.length === 0 ? (
        <p className="text-micro text-muted-foreground">
          No plugins installed.
        </p>
      ) : (
        <ul className="space-y-2">
          {plugins.map((p) => (
            <li
              key={p.source}
              className="rounded-control border border-border/70 px-2 py-2 space-y-1"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {p.name ?? p.id ?? p.source}
                    {p.version ? (
                      <span className="ml-1 text-micro text-muted-foreground font-normal">
                        v{p.version}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-micro text-muted-foreground truncate">
                    {p.source}
                  </div>
                </div>
                <Switch
                  checked={p.enabled}
                  onCheckedChange={(checked) => {
                    void pluginManager.setEnabled(p.source, checked);
                  }}
                  aria-label={`Enable ${p.source}`}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <StatusLine status={p.status} error={p.error} />
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5"
                    title="Reload"
                    onClick={() => void pluginManager.reload(p.source)}
                  >
                    <RefreshCw className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-destructive"
                    title="Remove"
                    onClick={() => void pluginManager.uninstall(p.source)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
};

const StatusLine: React.FC<{
  status: string;
  error?: string;
}> = ({ status, error }) => {
  if (status === "error") {
    return (
      <p className="text-micro text-destructive truncate min-w-0" title={error}>
        {error ?? "Error"}
      </p>
    );
  }
  if (status === "loading") {
    return (
      <p className="text-micro text-muted-foreground flex items-center gap-1">
        <Loader2 className="size-3 animate-spin" /> Loading…
      </p>
    );
  }
  if (status === "active") {
    return (
      <p className="text-micro text-emerald-600 dark:text-emerald-400">
        Active
      </p>
    );
  }
  if (status === "disabled") {
    return <p className="text-micro text-muted-foreground">Disabled</p>;
  }
  return <p className="text-micro text-muted-foreground">{status}</p>;
};
