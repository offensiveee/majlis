// Adds an LG TV: registers it with the webOS tools, fetches its developer key,
// pairs the remote-control connection and creates a phone PIN.
//
//   npm run setup -- --name living --ip 192.168.1.40
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import WebSocket from "ws";
import { ROOT, args, ares, ask, saveConfig, step, ok } from "./lib.mjs";

const a = args();
const name = String(a.name || "majlis").replace(/[^\w-]/g, "");
let ip = a.ip;

console.log("\nMajlis · TV setup\n");
if (!ip) ip = await ask("TV IP address (Settings › General › Network on the TV): ");
if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) { console.error("That doesn't look like an IP address."); process.exit(1); }

step(1, `Registering "${name}" (${ip}) with the webOS tools`);
try {
  await ares("ares-setup-device", ["--add", name, "-i", `host=${ip}`, "-i", "port=9922", "-i", "username=prisoner"], { capture: true });
} catch (e) {
  if (!/already exists/i.test(e.message)) throw e;
  await ares("ares-setup-device", ["--modify", name, "-i", `host=${ip}`, "-i", "port=9922", "-i", "username=prisoner"], { capture: true });
}
ok("registered");

step(2, "Developer key");
console.log("   On the TV, open the Developer Mode app and turn on Key Server.");
console.log("   You'll be asked for the passphrase shown in that app.");
await ask("   Press Enter when Key Server is on… ");
await ares("ares-novacom", ["--device", name, "--getkey"], { inherit: true });
ok("key saved");

step(3, "Checking the TV");
const info = await ares("ares-device", ["--device", name, "--system-info"], { capture: true });
const model = (info.match(/modelName : (.*)/) || [])[1] || "LG TV";
const webos = (info.match(/sdkVersion : (.*)/) || [])[1] || "?";
ok(`${model.trim()} · webOS SDK ${webos.trim()}`);
let devmodeToken = "";
try {
  devmodeToken = (await ares("ares-novacom", ["--device", name, "--run", "cat /var/luna/preferences/devmode_enabled"], { capture: true }))
    .split("\n").filter((l) => !/Set target/.test(l)).join("").trim();
} catch (e) { /* older firmware: the helper reads it on the TV instead */ }
ok(devmodeToken ? "Developer Mode token found (the TV renews its session by itself)" : "Developer Mode token not readable here; the TV will try on its own");

step(4, "Remote-control pairing");
console.log("   A prompt will appear on the TV. Choose Accept / Allow.");
const pairing = JSON.parse(fs.readFileSync(path.join(ROOT, "vendor", "lgtv2-pairing.json"), "utf8"));
const ssapKey = await new Promise((resolve, reject) => {
  const ws = new WebSocket(`wss://${ip}:3001`, { rejectUnauthorized: false });
  const timer = setTimeout(() => { ws.close(); reject(new Error("No answer from the TV within 2 minutes.")); }, 120000);
  ws.on("open", () => ws.send(JSON.stringify({ id: "reg", type: "register", payload: pairing })));
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.id !== "reg") return;
    if (m.type === "registered") { clearTimeout(timer); ws.close(); resolve(m.payload["client-key"]); }
    if (m.type === "error") { clearTimeout(timer); ws.close(); reject(new Error("The TV refused the pairing: " + m.error)); }
  });
  ws.on("error", (e) => { clearTimeout(timer); reject(new Error("Couldn't reach the TV on port 3001: " + e.message)); });
});
ok("paired");

const pin = String(crypto.randomInt(1000, 10000));
saveConfig(name, { name, ip, model: model.trim(), webos: webos.trim(), ssapKey, pin, devmodeToken, created: new Date().toISOString() });

console.log(`\n\x1b[32mDone.\x1b[0m Saved to .majlis/${name}.json (keep this file private).`);
console.log(`\nNext:  npm run deploy -- --name ${name}`);
console.log(`Phone: http://${ip}:8090   PIN ${pin}\n`);
