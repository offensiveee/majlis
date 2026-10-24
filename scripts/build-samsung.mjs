// Builds Majlis for Samsung (Tizen) TVs.
//
//   npm run samsung                       build the folder build/samsung
//   npm run samsung -- --package          also sign it into Majlis.wgt (needs Tizen Studio)
//   npm run samsung -- --install <ip>     sign and install on the TV at <ip>
//
// Samsung apps can't run a background helper, so there's no phone app on Samsung.
// The name, welcome, city and guest Wi-Fi come from majlis.config.json (copy the example).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ROOT, args, run, step, ok } from "./lib.mjs";

const a = args();
const OUT = path.join(ROOT, "build", "samsung");
const PROFILE = a.profile || process.env.TIZEN_PROFILE || "majlis";

step(1, "Building");
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "src", "app"), OUT, { recursive: true });
fs.rmSync(path.join(OUT, "appinfo.json"), { force: true });
fs.copyFileSync(path.join(ROOT, "samsung", "config.xml"), path.join(OUT, "config.xml"));
fs.copyFileSync(path.join(ROOT, "src", "service", "assets", "icon-512.png"), path.join(OUT, "icon.png"));
// Samsung app IDs come from the TV itself, so start with an empty list.
fs.writeFileSync(path.join(OUT, "apps-data.js"), "window.HOME_APPS = [];\nwindow.HOME_INPUTS = [];\n");

const cfgFile = path.join(ROOT, "majlis.config.json");
const cfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, "utf8")) : {};
fs.writeFileSync(path.join(OUT, "config.js"), "window.MAJLIS_CONFIG = " + JSON.stringify(cfg) + ";\n");
ok(`build/samsung${fs.existsSync(cfgFile) ? " (with majlis.config.json)" : ""}`);

if (!a.package && !a.install) {
  console.log("\nNext: sign and install it with Tizen Studio. See docs/en/install-samsung.md\n");
  process.exit(0);
}

// The Tizen CLI ships with Tizen Studio.
const tizenHome = process.env.TIZEN_STUDIO || path.join(os.homedir(), "tizen-studio");
const bin = (name) => {
  const p = path.join(tizenHome, name === "sdb" ? "tools" : path.join("tools", "ide", "bin"), name + (process.platform === "win32" ? (name === "sdb" ? ".exe" : ".bat") : ""));
  if (!fs.existsSync(p)) throw new Error(`Couldn't find ${name} in ${tizenHome}. Install Tizen Studio or set TIZEN_STUDIO.`);
  return p;
};

step(2, `Signing with the "${PROFILE}" certificate profile`);
await run(bin("tizen"), ["package", "-t", "wgt", "-s", PROFILE, "--", OUT], { inherit: true });
const wgt = fs.readdirSync(OUT).find((f) => f.endsWith(".wgt"));
if (!wgt) throw new Error("No .wgt was produced. Check the certificate profile in Tizen Studio's Certificate Manager.");
ok(wgt);

if (a.install) {
  const ip = String(a.install);
  step(3, `Installing on ${ip}`);
  await run(bin("sdb"), ["connect", ip], { inherit: true });
  const serial = `${ip}:26101`;
  await run(bin("tizen"), ["install", "-n", path.join(OUT, wgt), "-s", serial], { inherit: true });
  await run(bin("tizen"), ["run", "-p", "MajlisTV01.Majlis", "-s", serial], { inherit: true });
  ok("installed and opened");
}
