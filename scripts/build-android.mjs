// Copies the shared screen and phone app into the Android project's assets.
// GitHub Actions runs this before Gradle; run it yourself before building in Android Studio.
//
//   node scripts/build-android.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT, ok } from "./lib.mjs";

const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "android", "app", "src", "main", "assets");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

fs.cpSync(path.join(SRC, "app"), path.join(OUT, "app"), { recursive: true });
fs.rmSync(path.join(OUT, "app", "appinfo.json"), { force: true }); // webOS only
fs.mkdirSync(path.join(OUT, "phone"), { recursive: true });
fs.copyFileSync(path.join(SRC, "service", "phone.html"), path.join(OUT, "phone", "index.html"));
fs.cpSync(path.join(SRC, "service", "assets"), path.join(OUT, "phone", "assets"), { recursive: true });

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(SRC, "app", "data.js"), "utf8"), sandbox);
const w = sandbox.window;
fs.writeFileSync(path.join(OUT, "data.json"), JSON.stringify({
  cities: w.MAJLIS_CITIES, stations: w.MAJLIS_STATIONS, backgrounds: w.MAJLIS_BACKGROUNDS, adhans: w.MAJLIS_ADHANS, baseApps: []
}));
ok("android/app/src/main/assets");
