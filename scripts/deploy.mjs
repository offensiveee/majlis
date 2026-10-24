// Builds Majlis for one TV and installs it.
//
//   npm run deploy -- --name living          build, install and open
//   npm run deploy -- --name living --build  only build the .ipk
//   npm run remove -- --name living          uninstall from the TV
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT, args, ares, loadConfig, step, ok } from "./lib.mjs";

const APP_ID = "com.majlis.tv";
const a = args();
const name = String(a.name || "majlis");
const cfg = loadConfig(name);

if (a.remove) {
  step(1, `Removing Majlis from "${name}"`);
  await ares("ares-install", ["--device", name, "--remove", APP_ID]);
  ok("removed");
  process.exit(0);
}

const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "build", name);
const copy = (from, to) => fs.cpSync(from, to, { recursive: true });

step(1, "Building");
fs.rmSync(OUT, { recursive: true, force: true });
copy(path.join(SRC, "app"), path.join(OUT, "app"));
copy(path.join(SRC, "service"), path.join(OUT, "service"));

// The helper on the TV reads the same lists as the screen, as plain JSON.
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(SRC, "app", "data.js"), "utf8"), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(SRC, "app", "apps-data.js"), "utf8"), sandbox);
const w = sandbox.window;
const svc = path.join(OUT, "service");
fs.writeFileSync(path.join(svc, "data.json"), JSON.stringify({
  cities: w.MAJLIS_CITIES, stations: w.MAJLIS_STATIONS, backgrounds: w.MAJLIS_BACKGROUNDS, adhans: w.MAJLIS_ADHANS,
  baseApps: w.HOME_APPS.map((x) => ({ id: x.id, title: x.title }))
}));
fs.copyFileSync(path.join(SRC, "app", "lib", "adhan.js"), path.join(svc, "adhan.js"));
copy(path.join(SRC, "app", "backgrounds"), path.join(svc, "builtin-backgrounds"));
copy(path.join(ROOT, "node_modules", "ws7"), path.join(svc, "node_modules", "ws")); // ws 7 still runs on webOS's Node 8
fs.copyFileSync(path.join(ROOT, "vendor", "lgtv2-pairing.json"), path.join(svc, "pairing.json"));

// Per-TV secrets go only into the build, never into src/.
fs.writeFileSync(path.join(svc, "ssap-key.txt"), cfg.ssapKey);
fs.writeFileSync(path.join(svc, "pin.txt"), cfg.pin);
if (cfg.devmodeToken) fs.writeFileSync(path.join(svc, "devmode-token.txt"), cfg.devmodeToken);
ok(`build/${name}`);

step(2, "Packaging");
await ares("ares-package", [path.join(OUT, "app"), svc, "-o", OUT, "--no-minify"], { capture: true });
const ipk = fs.readdirSync(OUT).find((f) => f.endsWith(".ipk"));
ok(ipk);
if (a.build) process.exit(0);

step(3, `Installing on "${name}" (${cfg.ip})`);
await ares("ares-install", ["--device", name, path.join(OUT, ipk)], { capture: true });
ok("installed");
await ares("ares-launch", ["--device", name, APP_ID], { capture: true });
ok("opened");

console.log(`\nPhone: http://${cfg.ip}:8090   PIN ${cfg.pin}\n`);
