import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type BackendStatus,
  type BackendTarget,
  useBackendConnection,
} from "@/hooks/useBackendConnection";
import { AlertCircle, Link2, Link2Off, Loader2 } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

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
      className: "text-emerald-500",
    },
    error: {
      label: "Error",
      className: "text-destructive",
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
      className={`flex items-center gap-1 text-[10px] ${className}`}
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

export const BackendSection: React.FC = () => {
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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide">
          Backend
        </div>
        <StatusBadge status={conn.status} />
      </div>

      <div className="space-y-1">
        <Label
          htmlFor="backend-url"
          className="text-[10px] text-muted-foreground"
        >
          Connection URL
        </Label>
        <Input
          id="backend-url"
          className="h-7 text-xs font-mono"
          placeholder="ws://localhost:8765/ws?token=…&session=…"
          value={urlText}
          onChange={(e) => {
            setUrlText(e.target.value);
            if (parseError) setParseError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConnect();
          }}
        />
        {conn.session && (
          <p className="text-[9px] text-muted-foreground truncate">
            session: <span className="font-mono">{conn.session}</span>
          </p>
        )}
      </div>

      {shownError && (
        <div className="flex items-start gap-1 text-[10px] text-destructive">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="break-all">{shownError}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 pt-1">
        <Button
          className="h-7 flex-1 text-xs"
          onClick={onConnect}
          disabled={!canConnect}
        >
          {isConnected ? "Reconnect" : "Connect"}
        </Button>
        <Button
          className="h-7 text-xs"
          variant="outline"
          onClick={() => {
            setUrlText("");
            conn.disconnect();
          }}
          disabled={conn.status === "idle"}
        >
          Disconnect
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground leading-snug">
        Run a Python script with <code>WebSocketTransport</code>; paste the
        printed <code>ws://…</code> URL above and press Connect.
      </p>
    </div>
  );
};
