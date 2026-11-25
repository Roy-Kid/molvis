import { sketchTokenCssDefaults } from "../style/tokens";

const STYLE_ID = "molvis-sketch-composer-styles";

/**
 * Inject once-per-document styles for {@link SketchComposer} chrome.
 * Prefixed with `.molvis-sketch-composer` so host pages do not clash.
 *
 * Theming: every surface uses `--msk-*` custom properties. Defaults come
 * from {@link SKETCH_TOKEN_DEFAULTS}; hosts override on an ancestor.
 */
export function ensureComposerStyles(): void {
  if (typeof document === "undefined") return;
  // Always refresh text so HMR / package rebuilds pick up CSS without a full
  // document reload (id-only early return used to leave stale layout rules).
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = COMPOSER_CSS;
}

const COMPOSER_CSS = `
.molvis-sketch-composer {
  --image-export-paper: var(--msk-stage-bg);
  --image-export-ink: var(--msk-ink);
  --image-export-border: var(--msk-sep);
  --image-export-accent: var(--msk-active-ink);
  --image-export-accent-ink: var(--msk-active-fg);
  --image-export-hover: var(--msk-hover);
  --image-export-radius: var(--msk-radius);
  --image-export-font: var(--msk-font);

  /* Token defaults — product hosts override --msk-* on an ancestor. */
  ${sketchTokenCssDefaults()}

  color-scheme: light dark;
  display: grid;
  position: relative;
  /* minmax(0,1fr) so the stage can shrink inside narrow drawers / short hosts;
     auto rails keep their content size without blowing the grid. */
  grid-template-rows: auto minmax(0, 1fr) auto;
  grid-template-columns: auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  min-width: 0;
  border: 1px solid var(--msk-sep);
  border-radius: var(--msk-radius);
  background: var(--msk-rail-bg);
  color: var(--msk-ink);
  font-family: var(--msk-font);
  box-sizing: border-box;
  /* Contain rails; fragment flyouts use fixed/absolute within the rail. */
  overflow: hidden;
}
.molvis-sketch-composer *,
.molvis-sketch-composer *::before,
.molvis-sketch-composer *::after {
  box-sizing: border-box;
}
.molvis-sketch-composer[data-gui="false"] {
  grid-template-rows: minmax(0, 1fr);
  grid-template-columns: minmax(0, 1fr);
  border: none;
  background: var(--msk-stage-bg);
  overflow: hidden;
}
/* The read-only canvas fills the space below its preview header. */
.molvis-sketch-composer[data-readonly="true"] {
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-columns: minmax(0, 1fr);
  /* The host frames a preview; a second border inside it reads as two frames. */
  border: none;
  border-radius: 0;
  background: var(--msk-stage-bg);
}
.molvis-sketch-composer[data-readonly="true"] .molvis-sketch-composer__preview {
  grid-column: 1;
  grid-row: 1;
  min-height: var(--spacing-toolbar-compact, 2.5rem);
}
.molvis-sketch-composer[data-readonly="true"] .molvis-sketch-composer__stage {
  grid-column: 1;
  grid-row: 2;
}
.molvis-sketch-composer[data-disabled="true"] {
  opacity: 0.6;
}
.molvis-sketch-composer__common {
  grid-column: 1 / -1;
  grid-row: 1;
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 0 4px;
  background: var(--msk-rail-bg);
  border-bottom: 1px solid var(--msk-sep);
  height: var(--msk-btn);
  min-height: var(--msk-btn);
  max-height: var(--msk-btn);
  /* Must shrink with the drawer — without min/max-width the bar grows to the
     icon cluster and compact mode never trips (icons clip instead of ⋯). */
  min-width: 0;
  max-width: 100%;
  width: 100%;
  overflow: hidden;
  border-radius: var(--msk-radius) var(--msk-radius) 0 0;
}
/* Wide: show icon cluster. Narrow: hide it and use ⋯ menu instead. */
.molvis-sketch-composer .msk-common-inline {
  display: flex;
  align-items: center;
  gap: 1px;
  min-width: 0;
  flex-shrink: 0;
}
.molvis-sketch-composer .msk-common-overflow {
  display: none;
  position: relative;
  flex-shrink: 0;
}
.molvis-sketch-composer__common[data-compact="true"] .msk-common-inline {
  display: none;
}
.molvis-sketch-composer__common[data-compact="true"] .msk-common-overflow {
  display: flex;
  align-items: center;
}
.molvis-sketch-composer .msk-extra-slot {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
  margin-left: auto;
}
.molvis-sketch-composer__chem {
  grid-column: 1;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  padding: 2px 0;
  background: var(--msk-rail-bg);
  border-right: 1px solid var(--msk-sep);
  width: max(3.125rem, var(--msk-btn));
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--msk-sep) transparent;
  z-index: 2;
}
.molvis-sketch-composer .msk-tool-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 0 0 auto;
  gap: 1px;
  padding: 4px 0;
}
.molvis-sketch-composer .msk-tool-section + .msk-tool-section {
  border-top: 1px solid var(--msk-sep);
}
.molvis-sketch-composer__stage {
  grid-column: 2;
  grid-row: 2;
  position: relative;
  min-width: 0;
  min-height: 0;
  background: var(--msk-stage-bg);
  overflow: hidden;
  z-index: 0;
}
.molvis-sketch-composer[data-gui="false"] .molvis-sketch-composer__stage {
  grid-column: 1;
  grid-row: 1;
}
.molvis-sketch-composer__stage canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  background: var(--msk-stage-bg);
}
.molvis-sketch-composer__stage canvas:focus {
  outline: none;
}
.molvis-sketch-composer__stage canvas:focus-visible {
  outline: 2px solid var(--msk-active-ink);
  outline-offset: -2px;
}
.molvis-sketch-composer__assoc {
  grid-column: 1 / -1;
  grid-row: 3;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  min-height: calc(var(--msk-btn) + 5px);
  max-height: calc(var(--msk-btn) * 2.5);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  background: var(--msk-rail-bg);
  border-top: 1px solid var(--msk-sep);
  border-radius: 0 0 var(--msk-radius) var(--msk-radius);
}
.molvis-sketch-composer__assoc::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}
.molvis-sketch-composer[data-gui="false"] .molvis-sketch-composer__common,
.molvis-sketch-composer[data-gui="false"] .molvis-sketch-composer__chem,
.molvis-sketch-composer[data-gui="false"] .molvis-sketch-composer__assoc {
  display: none;
}
.molvis-sketch-composer[data-overlay-tools="true"] {
  border: 0;
  border-radius: 0;
  background: transparent;
}
.molvis-sketch-composer[data-overlay-tools="true"] .molvis-sketch-composer__stage {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  background: transparent;
}
.molvis-sketch-composer[data-overlay-tools="true"] .molvis-sketch-composer__stage canvas {
  background: transparent;
}
.molvis-sketch-composer[data-overlay-tools="true"] .molvis-sketch-composer__common,
.molvis-sketch-composer[data-overlay-tools="true"] .molvis-sketch-composer__assoc {
  position: relative;
  z-index: 1;
}
.molvis-sketch-composer .msk-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* Match --msk-btn so the chem column is never thinner than the buttons
     (fixed 30px buttons in a 28px column was blowing narrow-panel layout). */
  width: var(--msk-btn);
  height: var(--msk-btn);
  margin: 0;
  padding: 0;
  border: none;
  border-radius: var(--msk-radius);
  background: transparent;
  color: var(--msk-ink);
  cursor: pointer;
  flex-shrink: 0;
  line-height: 0;
}
.molvis-sketch-composer .msk-btn:hover {
  background: var(--msk-hover);
}
.molvis-sketch-composer .msk-btn:focus-visible {
  outline: 2px solid var(--msk-active-ink);
  outline-offset: 1px;
}
.molvis-sketch-composer .msk-btn.active {
  background: var(--msk-active-ink);
  color: var(--msk-active-fg);
}
.molvis-sketch-composer .msk-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.molvis-sketch-composer .msk-btn svg {
  width: calc(var(--msk-btn) * 0.6);
  height: calc(var(--msk-btn) * 0.6);
  max-width: 18px;
  max-height: 18px;
  display: block;
}
.molvis-sketch-composer .msk-btn--preview {
  width: 52px;
  height: 52px;
  padding: 2px;
}
.molvis-sketch-composer .msk-btn--preview svg,
.molvis-sketch-composer .msk-btn--preview img {
  width: 100%;
  height: 100%;
  display: block;
}
.molvis-sketch-composer .msk-sep {
  width: 1px;
  height: calc(var(--msk-btn) * 0.55);
  margin: 0 3px;
  background: var(--msk-sep);
  flex-shrink: 0;
  align-self: center;
}
.molvis-sketch-composer .msk-export {
  position: relative;
  flex-shrink: 0;
}
.molvis-sketch-composer .msk-menu {
  position: absolute;
  z-index: 40;
  top: calc(100% + 3px);
  left: 0;
  display: grid;
  min-width: max-content;
  padding: 4px;
  border: 1px solid var(--msk-sep);
  border-radius: calc(var(--msk-radius) + 2px);
  background: var(--msk-stage-bg);
  color: var(--msk-ink);
  box-shadow: var(--msk-shadow);
}
.molvis-sketch-composer .msk-export > .msk-menu {
  position: fixed;
  z-index: 50;
}
.molvis-sketch-composer .msk-icon-menu,
.molvis-sketch-composer .msk-section-tools.msk-menu {
  display: flex;
  flex-flow: row wrap;
  gap: 1px;
  width: max-content;
  min-width: 0;
  overflow-y: auto;
}
.molvis-sketch-composer .msk-common-overflow-menu {
  width: calc(var(--msk-btn) * 4 + 13px);
  max-width: calc(100vw - 16px);
}
.molvis-sketch-composer .msk-section-tools {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.molvis-sketch-composer .msk-section-trigger {
  position: relative;
}
.molvis-sketch-composer .msk-section-trigger .msk-section-chevron {
  position: absolute;
  right: 1px;
  bottom: 2px;
  width: 8px;
  height: 8px;
}
.molvis-sketch-composer .msk-section-trigger[aria-expanded="true"] {
  background: var(--msk-hover);
  color: var(--msk-ink);
}
.molvis-sketch-composer .msk-section-trigger[hidden],
.molvis-sketch-composer .msk-section-tools[hidden] {
  display: none;
}
.molvis-sketch-composer .msk-section-tools.msk-menu {
  width: calc(var(--msk-btn) * 3 + 12px);
}
.molvis-sketch-composer .msk-figure-variant-trigger {
  position: relative;
  touch-action: manipulation;
  user-select: none;
  -webkit-touch-callout: none;
}
.molvis-sketch-composer .msk-figure-variant-trigger .msk-figure-variant-chevron {
  position: absolute;
  width: 12px;
  height: 12px;
  right: 0;
  bottom: 0;
  padding: 1px;
}
.molvis-sketch-composer .msk-figure-variant-menu [aria-checked="true"] {
  background: var(--msk-active-ink);
  color: var(--msk-active-fg);
}
.molvis-sketch-composer .msk-figure-style {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding-inline: 4px;
}
.molvis-sketch-composer .msk-figure-style label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}
.molvis-sketch-composer .msk-figure-style label > svg,
.molvis-sketch-composer .msk-figure-dialog svg {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}
.molvis-sketch-composer .msk-figure-choices {
  display: flex;
  align-items: center;
  gap: 1px;
}
.molvis-sketch-composer .msk-figure-style input {
  width: 3.65rem;
  min-height: 1.5rem;
  border: 1px solid var(--msk-sep);
  border-radius: var(--msk-radius);
  color: inherit;
  background: var(--msk-stage-bg);
  font: inherit;
}
.molvis-sketch-composer .msk-figure-style input[type="color"] {
  width: 1.6rem;
  padding: 1px;
}
.molvis-sketch-composer .msk-bracket-label {
  position: absolute;
  z-index: 1;
  border: 1px dashed var(--msk-active-ink);
  background: var(--msk-stage-bg);
  color: var(--msk-active-ink);
  cursor: text;
}
.molvis-sketch-composer .msk-bracket-label svg {
  width: 12px;
  height: 12px;
}
.molvis-sketch-composer .msk-bracket-label--filled {
  border-color: transparent;
  background: transparent;
}
.molvis-sketch-composer .msk-bracket-label--filled:hover {
  border-color: var(--msk-active-ink);
  background: transparent;
}
.molvis-sketch-composer .msk-bracket-label--filled svg,
.molvis-sketch-composer .msk-bracket-label[hidden] {
  display: none;
}
.molvis-sketch-composer__stage:has(canvas:active) .msk-bracket-label {
  visibility: hidden;
}
.molvis-sketch-composer .msk-inline-text-editor {
  position: absolute;
  appearance: none;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  outline: none;
  box-shadow: none;
  background: transparent;
  color: transparent;
  -webkit-text-fill-color: transparent;
  letter-spacing: normal;
  white-space: pre;
  overflow: hidden;
  resize: none;
}
.molvis-sketch-composer .msk-inline-text-editor:focus {
  outline: none;
  box-shadow: none;
}
.molvis-sketch-composer .msk-inline-text-editor::selection {
  background: color-mix(in srgb, var(--msk-active-ink) 25%, transparent);
  color: transparent;
}
.molvis-sketch-composer .msk-figure-dialog {
  width: min(28rem, calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  padding: 16px;
  border: 1px solid var(--msk-sep);
  border-radius: var(--msk-radius);
  color: var(--msk-ink);
  background: var(--msk-stage-bg);
  box-shadow: var(--msk-shadow);
  font-size: 0.85rem;
}
.molvis-sketch-composer .msk-figure-dialog::backdrop {
  background: rgb(0 0 0 / 36%);
}
.molvis-sketch-composer .msk-figure-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}
.molvis-sketch-composer .msk-figure-field {
  display: flex;
  align-items: center;
  gap: 6px;
}
.molvis-sketch-composer .msk-figure-wide {
  grid-column: 1 / -1;
}
.molvis-sketch-composer .msk-figure-fields input[type="number"] {
  width: 6em;
  max-width: calc(100% - 22px);
}
.molvis-sketch-composer .msk-figure-fields input[type="color"] {
  width: 2.5em;
  height: 1.6em;
  padding: 0;
}
.molvis-sketch-composer .msk-figure-field input,
.molvis-sketch-composer .msk-figure-fields textarea,
.molvis-sketch-composer .msk-figure-dialog button {
  border: 1px solid var(--msk-sep);
  border-radius: 4px;
  background: var(--msk-rail-bg);
  color: inherit;
  font: inherit;
  padding: 3px 5px;
}
.molvis-sketch-composer .msk-figure-fields textarea {
  resize: vertical;
  width: 100%;
}
.molvis-sketch-composer .msk-figure-dialog .msk-figure-choices {
  flex-wrap: wrap;
}
.molvis-sketch-composer .msk-figure-icon-choice {
  position: relative;
  display: inline-grid;
  place-items: center;
  justify-self: start;
  width: var(--msk-btn);
  height: var(--msk-btn);
  border-radius: var(--msk-radius);
}
.molvis-sketch-composer .msk-figure-icon-choice input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.molvis-sketch-composer .msk-figure-icon-choice:hover {
  background: var(--msk-hover);
}
.molvis-sketch-composer .msk-figure-icon-choice:has(input:checked) {
  background: var(--msk-active-ink);
  color: var(--msk-active-fg);
}
.molvis-sketch-composer .msk-figure-icon-choice:has(input:focus-visible),
.molvis-sketch-composer .msk-figure-dialog button:focus-visible {
  outline: 2px solid var(--msk-active-ink);
  outline-offset: 1px;
}
.molvis-sketch-composer .msk-figure-dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 14px;
}
.molvis-sketch-composer .msk-figure-dialog button {
  display: grid;
  place-items: center;
  width: var(--msk-btn);
  height: var(--msk-btn);
  padding: 0;
  cursor: pointer;
}
.molvis-sketch-composer .msk-figure-dialog button[type="submit"] {
  background: var(--msk-active-ink);
  color: var(--msk-active-fg);
}
/* Fragment category list: structure thumbnails only (no text labels). */
.molvis-sketch-composer .msk-fragment-menu {
  min-width: 0;
  width: max-content;
}
.molvis-sketch-composer .msk-menu[hidden] {
  display: none;
}
.molvis-sketch-composer .msk-menu--flyout {
  /* Viewport-fixed; coordinates set in JS when opened so chem overflow scroll
     does not clip the palette on short/narrow hosts. */
  position: fixed;
  top: 0;
  left: 0;
  min-width: 0;
  max-height: min(70vh, 420px);
  overflow: auto;
  grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
  gap: 2px;
  width: max-content;
  max-width: min(90vw, 320px);
  z-index: 50;
}
.molvis-sketch-composer .msk-submenu {
  position: relative;
}
.molvis-sketch-composer .msk-category-row {
  display: flex;
  align-items: center;
  gap: 2px;
  width: max-content;
  max-width: 100%;
  padding: 3px 4px;
  border: 0;
  border-radius: var(--msk-radius);
  background: transparent;
  color: var(--msk-ink);
  font: inherit;
  cursor: pointer;
  text-align: left;
}
.molvis-sketch-composer .msk-category-row:hover,
.molvis-sketch-composer .msk-category-row:focus-visible,
.molvis-sketch-composer .msk-category-row[aria-expanded="true"] {
  background: var(--msk-hover);
  outline: none;
}
/* Unclassed SVG defaults are huge in flex rows — pin the chevron. */
.molvis-sketch-composer .msk-category-row > svg.msk-chevron {
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  opacity: 0.55;
}
.molvis-sketch-composer .msk-category-preview {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.molvis-sketch-composer .msk-category-preview svg {
  width: 32px;
  height: 32px;
  display: block;
}
/* Atom-tool quick element chips (C H N O …) in the bottom assoc rail. */
.molvis-sketch-composer .msk-element-chip {
  min-width: var(--msk-btn);
  width: auto;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--msk-font);
  letter-spacing: 0.02em;
  line-height: 1;
}
.molvis-sketch-composer .msk-element-chip.active {
  background: var(--msk-active-ink);
  color: var(--msk-active-fg);
}
.molvis-sketch-composer .msk-assoc-color-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  flex-shrink: 0;
}
.molvis-sketch-composer .msk-assoc-color {
  width: 30px;
  height: 28px;
  border: 1px solid var(--msk-sep);
  border-radius: var(--msk-radius);
  padding: 2px;
  background: transparent;
}
.molvis-sketch-composer .msk-assoc-color:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
/* Host actions (React portal) — real flex item on the common rail, not overlay. */
.molvis-sketch-composer .msk-extra-slot {
  display: flex;
  align-items: center;
  gap: 1px;
  margin-left: auto;
  flex-shrink: 0;
  min-height: 30px;
}
`;
