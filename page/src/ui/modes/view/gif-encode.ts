/**
 * Frontend encoder for turntable exports. The core engine emits a sequence of
 * still-frame data URLs (`app.exportTurntable`); this module assembles them
 * into a downloadable video. Encoding lives here, not in core, so the engine
 * stays free of media-encoding dependencies.
 *
 * Uses the browser-native MediaRecorder + canvas.captureStream pipeline — no
 * third-party encoder dependency. Output is WebM (the format MediaRecorder
 * supports across Chromium/Firefox).
 */

/** A canvas-capture track exposes requestFrame(); it is not in the base lib types. */
interface RequestFrameTrack extends MediaStreamTrack {
  requestFrame?: () => void;
}

const WEBM_MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

function pickMimeType(): string {
  for (const mime of WEBM_MIME_CANDIDATES) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(mime)
    ) {
      return mime;
    }
  }
  return "video/webm";
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode export frame"));
    img.src = dataUrl;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoke on the next tick so the click has consumed the URL.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** True when the browser can encode video (MediaRecorder + canvas capture). */
export function canEncodeVideo(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

/**
 * Encode a sequence of frame data URLs to a WebM video and download it.
 *
 * @param dataUrls Still frames, in playback order (from `app.exportTurntable`).
 * @param opts.fps Playback frame rate (should match the export fps).
 * @param opts.filename Download name; defaults to `molvis-turntable.webm`.
 */
export async function exportFramesToVideo(
  dataUrls: string[],
  opts: { fps: number; filename?: string },
): Promise<void> {
  if (dataUrls.length === 0) return;
  if (!canEncodeVideo()) {
    throw new Error("Video encoding is not supported in this browser");
  }

  const images = await Promise.all(dataUrls.map(loadImage));
  const width = images[0].naturalWidth;
  const height = images[0].naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as RequestFrameTrack;
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, { mimeType });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();
  const frameMs = 1000 / opts.fps;
  for (const img of images) {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    track.requestFrame?.();
    await sleep(frameMs);
  }
  recorder.stop();
  await stopped;

  triggerDownload(
    new Blob(chunks, { type: mimeType }),
    opts.filename ?? "molvis-turntable.webm",
  );
}
