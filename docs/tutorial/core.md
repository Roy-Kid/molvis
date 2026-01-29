# Embedding Molvis in Your Web App

Building a web platform for chemists? You need a viewer that doesn't look like it was built in 1998. Let's get Molvis running in a vanilla TypeScript environment.

## What are we doing?

We are going to take an empty HTML `div` and turn it into a full-featured 3D molecular viewer. We will initialize the application, configure it, and load some data.

## Why use the Core library?

The core library gives you full control. Unlike the Jupyter widget which is opinionated for analysis, `@molvis/core` is designed to be a building block. You can skin it, control the camera programmatically, and integrate it deeply into your React, Vue, or Angular application.

## How do we do it?

First, install the package:

```bash
npm install @molvis/core
```

Now, let's write some code. You need an HTML container and a script to mount the app.

**index.html**
```html
<div id="app-container" style="width: 800px; height: 600px;"></div>
```

**index.ts**
```typescript
import { mountMolvis } from "@molvis/core";

// 1. Find your container
const container = document.getElementById("app-container");

if (container) {
  // 2. Mount the application
  // You can pass configuration options here to customize the look and feel.
  const app = mountMolvis(container, {
    backgroundColor: "#1a1a1a",
    showUI: true
  });

  // 3. Start the rendering loop
  app.start();

  console.log("Molvis is running!");

  // 4. Load data (Later)
  // To show something, you'll need a Frame object.
  // app.renderFrame(myFrame);
}
```

That's literally it. You have a running 3D engine.

### A note on Data
To actually see a molecule, you need to pass a `Frame` object to `app.renderFrame()`. Usually, you would load this from a file (using our reader utilities) or construct it using `molrs-wasm`.

```typescript
// Example: Loading a file
import { readFrame } from "@molvis/core";

const frame = await readFrame("path/to/molecule.pdb");
app.renderFrame(frame);
```

Now you're cooking with gas (or whatever molecule you loaded).
