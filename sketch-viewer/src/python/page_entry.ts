import {
  listFragmentTemplates,
  MoleculeLayout,
  SketchComposer,
  type SketchDocument,
} from "@molcrafts/molvis-sketch";
import { createSketchPreview } from "../preview";
import { SketchBoardRpc } from "./board_rpc";
import {
  type BridgeSocket,
  type BridgeStatus,
  SketchPageBridge,
} from "./page_bridge";
import { SketchEditor } from "./sketch_editor";

/**
 * Entry of the sketch page the Python package ships as `molvis/sketch_dist`.
 *
 * Mounts a `SketchComposer` over the whole page. `surface=canvas` drops the
 * tool rails. `surface=preview` is the read-only mode: the MolCrafts preview
 * header (reset view, zoom, fullscreen, PNG / SVG export) and a board a
 * click cannot draw on. `title=` names what it shows. Without a `ws_url` the
 * page is a plain standalone editor.
 */
const search = window.location.search;
const params = new URLSearchParams(search);
const surface = params.get("surface");
const endpoint = SketchPageBridge.readEndpoint(search);
const root = document.getElementById("molvis-sketch-root") ?? document.body;
const composer = new SketchComposer({
  gui: surface !== "canvas",
  mode: surface === "preview" ? "readonly" : "edit",
});
composer.mount(root);
const editor =
  surface !== "canvas" && surface !== "preview"
    ? new SketchEditor(composer)
    : null;
editor?.mount(root);
if (editor) {
  const board = composer.board;
  const storageKey = `molvis-sketch:document:${JSON.stringify(
    endpoint ? [endpoint.wsUrl, endpoint.session] : [],
  )}`;
  try {
    const saved = window.sessionStorage.getItem(storageKey);
    if (saved !== null) {
      board.loadSketchDocument(JSON.parse(saved) as SketchDocument);
      board.fitToView();
    }
  } catch (error) {
    console.warn("Could not restore the Sketch drawing", error);
  }
  // This event includes undo, redo, and document loads. Save synchronously
  // so refreshing immediately after an edit restores the committed contents.
  board.events.on("history-change", () => {
    try {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify(board.getSketchDocument()),
      );
    } catch (error) {
      console.warn("Could not save the Sketch drawing for reload", error);
    }
  });
}
window.addEventListener("beforeunload", () => {
  void editor?.destroy();
});
const theme = params.get("theme");
const preview = createSketchPreview(composer, {
  title: params.get("title") ?? undefined,
  theme: theme === "light" || theme === "dark" ? theme : undefined,
});

if (endpoint) {
  const rpc = new SketchBoardRpc(
    composer.board,
    new MoleculeLayout(),
    listFragmentTemplates,
  );
  let connected = false;
  const onStatus = (status: BridgeStatus): void => {
    if (status.kind === "connecting") {
      preview?.setState({ kind: "loading", message: "Connecting to MolVis…" });
    } else if (status.kind === "ready") {
      connected = true;
      const loaded = composer.board.hasContent();
      preview?.setState(
        loaded
          ? { kind: "ready" }
          : { kind: "loading", message: "Waiting for the drawing…" },
      );
    } else {
      const taken =
        status.code === 1013 || /already bound/.test(status.reason ?? "");
      preview?.setState({
        kind: "error",
        message: taken
          ? "This preview is open in another window. Close it there, then reload this page."
          : connected
            ? "Lost the connection to MolVis. Reload this page to reconnect."
            : "Could not reach MolVis.",
      });
    }
  };
  // A drawing arriving is what makes the board ready to look at.
  composer.board.subscribe(() => {
    if (connected && composer.board.hasContent()) {
      preview?.setState({ kind: "ready" });
    }
  });
  // A browser WebSocket is a BridgeSocket; the cast only narrows its type.
  new SketchPageBridge(
    endpoint,
    rpc,
    (url) => new WebSocket(url) as unknown as BridgeSocket,
    onStatus,
  ).connect();
}
