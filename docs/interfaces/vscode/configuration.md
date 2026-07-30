# VS Code configuration

The extension exposes two validated objects in user or workspace settings.
They apply when a viewer starts or reloads.

## `molvis.config`

Core construction options control UI availability and canvas creation:

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

Runtime settings tune camera, grid, and graphics behavior:

```jsonc
{
  "molvis.settings": {
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

VS Code validates known fields and offers completion. Unknown forward-compatible
fields are allowed so the extension does not block newer core options.

## `molvis.plugins`

Array of page plugin sources loaded when a viewer starts:

```jsonc
{
  "molvis.plugins": [
    "MolCrafts/molvis-plugin-template@master",
    "alice/my-analysis@v1.0.0"
  ]
}
```

Each entry is `owner/repo[@tag]`, a GitHub URL, or an HTTPS package URL. The
webview injects them as `mount.plugins` for the page plugin runtime. Remote
code runs in the webview with the same trust model as the in-app Plugins
settings.

## Apply changes

Existing webviews do not reconstruct themselves for every settings edit. Run
**MolVis: Reload View** or reopen the editor/workspace after changing config,
settings, or plugins.

Prefer workspace settings for project-specific conventions and user settings
for hardware/performance preferences.

Continue with [Remote workspaces](remote.md).
