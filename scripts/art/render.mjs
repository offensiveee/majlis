// Re-renders the built-in backgrounds and the app icon from their SVG sources
// (scripts/art/*.html) with headless Chrome.
//
//   npm run art                 everything
//   npm run art -- sadu dunes   only these
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { run } from "../lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const CHROME = process.env.CHROME || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error("Chrome not found. Set CHROME=/path/to/chrome"); process.exit(1); }

const only = process.argv.slice(2);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "majlis-art-"));
async function shot(html, out, w, h, transparent) {
  await run(CHROME, ["--headless=new", "--hide-scrollbars", "--force-device-scale-factor=1", `--user-data-dir=${tmp}`,
    `--window-size=${w},${h}`, "--virtual-time-budget=4000", ...(transparent ? ["--default-background-color=00000000"] : []),
    `--screenshot=${out}`, "file://" + html], { capture: true });
}

for (const f of fs.readdirSync(HERE).filter((f) => f.endsWith(".html"))) {
  const id = f.replace(".html", "");
  if (only.length && !only.includes(id)) continue;
  if (id === "icon") {
    const png = path.join(tmp, "icon.png");
    await shot(path.join(HERE, f), png, 512, 512, true);
    fs.copyFileSync(png, path.join(ROOT, "src", "service", "assets", "icon-512.png"));
    console.log("icon-512.png (resize it to 80, 130, 180 and 192 for the other sizes)");
  } else {
    const png = path.join(tmp, id + ".png");
    await shot(path.join(HERE, f), png, 1920, 1080, false);
    fs.copyFileSync(png, path.join(ROOT, "src", "app", "backgrounds", id + ".png"));
    console.log(`backgrounds/${id}.png (convert to .jpg at ~82% quality to keep the app small)`);
  }
}
