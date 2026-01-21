# Change: Add performance FPS panel

## Why
Provide a quick visual indicator of rendering performance without opening dev tools.

## What Changes
- Add a PerfPanel overlay at the bottom-right with the same styling as other panels
- Update the render loop to refresh the FPS display using `engine.getFps()`
- Add a configuration toggle to enable or disable the PerfPanel

## Impact
- Affected specs: ui-components
- Affected code: core/src/gui, core/src/core/world.ts, core/src/core/config.ts
