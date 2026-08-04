import { AlertCircle, Link2, Link2Off, Loader2 } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { ViewerAction } from "@/components/viewer/ViewerAction";
import {
  type BackendStatus,
  type BackendTarget,
  useBackendConnection,
} from "@/hooks/useBackendConnection";
import { SettingsSection } from "./SettingsSection";

const STATUS_COPY: Record<BackendStatus, { label: string; className: string }> =
  {
    idle: {
      label: "Not connected",
      className: "text-muted-foreground",
    },
    connecting: {
      label: "Connecting…",
      className: "text-muted-foreground",
    },
    connected: {
      label: "Connected",
      className: "text-status-completed-foreground",
    },
    error: {
      label: "Error",
      className: "text-status-failed-foreground",
    },
  };

function StatusBadge({ status }: { status: BackendStatus }) {
  const { label, className } = STATUS_COPY[status];
  const Icon =
    status === "connecting"
      ? Loader2
      : status === "connected"
        ? Link2
        : status === "error"
          ? AlertCircle
          : Link2Off;
  return (
    <div
      className={`flex items-center gap-1 text-micro ${className}`}
      aria-live="polite"
    >
      <Icon
        className={`h-3 w-3 ${status === "connecting" ? "animate-spin" : ""}`}
      />
      <span>{label}</span>
    </div>
  );
}

/**
 * Parse a pasted URL of the form ``ws://host:port/ws?token=…&session=…``
 * into a {@link BackendTarget}. Token and session are pulled out of the
 * query string so the browser's hello frame sends them in the right
 * shape; the socket URL keeps the query (harmless) so copy/paste stays
 * idempotent.
 */
function parseConnectionUrl(raw: string): BackendTarget | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed)
    return { error: "Paste the ws:// URL from your Python script." };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: "Not a valid URL." };
  }
  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    return { error: "URL must use ws:// or wss://" };
  }
  const token = parsed.searchParams.get("token") ?? undefined;
  const session = parsed.searchParams.get("session") ?? undefined;
  return { wsUrl: trimmed, token, session };
}

function buildDisplayUrl(conn: {
  wsUrl: string | null;
  token: string | null;
  session: string | null;
}): string {
  if (!conn.wsUrl) return "";
  if (!conn.token && !conn.session) return conn.wsUrl;
  try {
    const url = new URL(conn.wsUrl);
    if (conn.token && !url.searchParams.has("token"))
      url.searchParams.set("token", conn.token);
    if (conn.session && !url.searchParams.has("session"))
      url.searchParams.set("session", conn.session);
    return url.toString();
  } catch {
    return conn.wsUrl;
  }
}

interface BackendSectionProps {
  sectionId?: string;
}

export const BackendSection: React.FC<BackendSectionProps> = ({
  sectionId,
}) => {
  const conn = useBackendConnection();

  const [urlText, setUrlText] = useState<string>(() => buildDisplayUrl(conn));
  const [parseError, setParseError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: conn is a stable hook ref; decomposed deps are intentional
  useEffect(() => {
    setUrlText(buildDisplayUrl(conn));
  }, [conn.wsUrl, conn.token, conn.session]);

  const onConnect = () => {
    const parsed = parseConnectionUrl(urlText);
    if ("error" in parsed) {
      setParseError(parsed.error);
      return;
    }
    setParseError(null);
    conn.connect(parsed);
  };

  const canConnect = urlText.trim().length > 0 && conn.status !== "connecting";
  const isConnected = conn.status === "connected";
  const shownError = parseError ?? conn.error;

  return (
    <SettingsSection
      id={sectionId}
      title="Backend"
      trailing={<StatusBadge status={conn.status} />}
    >
      <div className="space-y-1">
        <Input
          id="backend-url"
          className="h-control-compact text-xs font-mono"
          placeholder="ws://…/ws?token=…&session=…"
          aria-label="Backend WebSocket URL"
          value={urlText}
          onChange={(e) => {
            setUrlText(e.target.value);
            if (parseError) setParseError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConnect();
          }}
        />
        {conn.session ? (
          <p className="truncate font-mono text-micro text-muted-foreground">
            {conn.session}
          </p>
        ) : null}
      </div>

      {shownError && (
        <div className="flex items-start gap-1 text-micro text-status-failed-foreground">
          <AlertCircle className="h-3 w-3 mt-1 shrink-0" />
          <span className="break-all">{shownError}</span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <ViewerAction
          className="flex-1"
          onClick={onConnect}
          disabled={!canConnect}
        >
          {isConnected ? "Reconnect" : "Connect"}
        </ViewerAction>
        <ViewerAction
          purpose="dismiss"
          onClick={() => {
            setUrlText("");
            conn.disconnect();
          }}
          disabled={conn.status === "idle"}
        >
          Disconnect
        </ViewerAction>
      </div>
    </SettingsSection>
  );
};
