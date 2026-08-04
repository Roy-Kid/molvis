import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const viewportWidth = 1920;
const viewportHeight = 1080;
const outputWidth = 1920;
const outputHeight = 1080;
const outputDir = resolve("artifacts/trailer");
const appUrl = process.env.MOLVIS_RECORD_URL ?? "http://localhost:3000/";
const outputPath = resolve(
  outputDir,
  "molvis-edit-mode-150pct-10s-trailer.webm",
);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: viewportWidth, height: viewportHeight },
  deviceScaleFactor: 1,
  colorScheme: "dark",
  recordVideo: {
    dir: outputDir,
    size: { width: outputWidth, height: outputHeight },
  },
});

const page = await context.newPage();
const video = page.video();
const pause = (milliseconds) => page.waitForTimeout(milliseconds);
const drawBond = async (from, to) => {
  await page.mouse.move(...from);
  await page.mouse.down();
  const steps = 8;
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    await page.mouse.move(
      from[0] + (to[0] - from[0]) * progress,
      from[1] + (to[1] - from[1]) * progress,
    );
    await pause(5);
  }
  await pause(50);
  await page.mouse.up();
};

await page.addInitScript(() => {
  window.__MOLVIS_VSCODE_INIT__ = { mount: { demo: false } };
});

await page.goto(appUrl, {
  waitUntil: "domcontentloaded",
});
await page.addStyleTag({ content: "html { zoom: 1.5; }" });
await page.getByText("Molecular viewer ready").waitFor({ timeout: 20_000 });
await pause(100);

// Start from the empty scene and place a carbon anchor.
await page.getByText("Edit", { exact: true }).click();
await page.getByRole("button", { name: /Choose element/ }).waitFor();
await pause(100);
await page.mouse.click(540, 350);
await pause(80);

// Oxygen + double bond. The endpoint settles onto the editor's snapped guide.
await page.getByRole("button", { name: /Choose element/ }).click();
await pause(80);
await page
  .getByRole("gridcell", { name: "8 Oxygen, O" })
  .evaluate((element) => element.click());
await page.getByRole("button", { name: "Double bond" }).click();
await pause(50);
await drawBond([540, 350], [640, 350]);
await pause(100);

// Nitrogen + single bond, snapped to a second direction.
await page.getByRole("button", { name: /Choose element/ }).waitFor();
await page.getByRole("button", { name: /Choose element/ }).click();
await pause(70);
await page
  .getByRole("gridcell", { name: "7 Nitrogen, N" })
  .evaluate((element) => element.click());
await page.getByRole("button", { name: "Single bond" }).click();
await pause(50);
await drawBond([540, 350], [490, 430]);
await pause(100);

// Triple-bond two existing atoms. Pause over nitrogen so the magnetic target
// feedback is visible before release, then close the triangle.
await page.getByRole("button", { name: "Triple bond" }).click();
await pause(50);
await page.mouse.move(640, 350);
await page.mouse.down();
await page.mouse.move(500, 422, { steps: 12 });
await pause(300);
await page.mouse.move(490, 430, { steps: 4 });
await pause(250);
await page.mouse.up();
await pause(250);

const saveVideo = video.saveAs(outputPath);
await context.close();
await saveVideo;
await browser.close();

console.log(outputPath);
