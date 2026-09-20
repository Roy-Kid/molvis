# VS Code configuration

Settings apply when a Quick look or Stage starts, and again when you change
`molvis.config` / `molvis.settings` (existing views receive `applySettings`).

## `molvis.config`

Stage construction options (`mountMolvis(container, config, settings)`):

```jsonc
{
  "molvis.config": {
    "showUI": true,
    "useRightHandedSystem": true,
    "ui": {
      "showInfoPanel": true,
      "showPerfPanel": false,
      "showContextMenu": true
    },
    "canvas": {
      "antialias": true,
      "alpha": false,
      "stencil": true
    }
  }
}
```

## `molvis.settings`

Runtime camera, grid, and graphics:

```jsonc
{
  "molvis.settings": {
    "showFps": true,
    "cameraRotateSpeed": 1.0,
    "cameraZoomSpeed": 1.5,
    "grid": {
      "enabled": true,
      "size": 100,
      "opacity": 0.3
    },
    "graphics": {
      "fxaa": true,
      "hardwareScaling": 1.0
    }
  }
}
```

Unknown forward-compatible fields are allowed.

## `molvis.plugins`

**Reserved.** Quick look and the Page now run the same shell, so the plugin
runtime is present — but no surface passes this setting to it yet. Kept so
wiring it later needs no schema break.

## Apply changes

After editing config or settings, run **MolVis: Reload View** or reopen the
panel if a view does not pick up the change.

Prefer workspace settings for project conventions; user settings for hardware
preferences.

Continue with [Remote workspaces](remote.md).
