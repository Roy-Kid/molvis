/**
 * Standalone sketch playground.
 * `npm run dev` in the sketch package.
 *
 * Chrome lives in {@link SketchComposer} (`gui: true` by default) — same
 * pattern as stage's `gui` flag. This file only mounts and seeds a starter.
 */
import "@molcrafts/molvis-core/molrs";
import { SketchComposer } from "../src/index";

const host = document.querySelector<HTMLElement>("#composer");
if (!host) {
  throw new Error("demo DOM missing #composer");
}

const composer = new SketchComposer({ gui: true });
composer.mount(host);

// Starter molecule: benzene
composer.board.setRingTemplate(6, "benzene");
composer.board.placeRingAt(0, 0);
composer.board.fitToView();
composer.board.setTool("bond");

console.info(
  "[sketch demo] SketchComposer gui=true · Space+drag pan · wheel zoom · fragment templates on chem rail",
);
