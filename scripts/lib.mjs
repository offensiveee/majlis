// Shared helpers for the setup and deploy scripts.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG_DIR = path.join(ROOT, ".majlis");

export function args() {
  const out = { _: [] };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) {
      const key = a[i].slice(2);
      const next = a[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a[i]);
  }
  return out;
}

// Runs one of the LG webOS CLI tools from node_modules.
export function ares(tool, toolArgs, opts = {}) {
  const bin = path.join(ROOT, "node_modules", ".bin", tool + (process.platform === "win32" ? ".cmd" : ""));
  if (!fs.existsSync(bin)) throw new Error(`Missing ${tool}. Run "npm install" first.`);
  return run(bin, toolArgs, opts);
}

export function run(cmd, cmdArgs, { capture = false, inherit = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, cmdArgs, { stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
    let out = "", err = "";
    if (!inherit) {
      p.stdout.on("data", (d) => { out += d; if (!capture) process.stdout.write(d); });
      p.stderr.on("data", (d) => { err += d; if (!capture) process.stderr.write(d); });
    }
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error((err || out).trim() || `${cmd} exited with ${code}`))));
  });
}

export function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

export function configPath(name) { return path.join(CONFIG_DIR, `${name}.json`); }
export function loadConfig(name) {
  const p = configPath(name);
  if (!fs.existsSync(p)) throw new Error(`No TV called "${name}". Run: npm run setup -- --name ${name} --ip <tv-ip>`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
export function saveConfig(name, cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(configPath(name), JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

export const step = (n, text) => console.log(`\n\x1b[33m${n}.\x1b[0m ${text}`);
export const ok = (text) => console.log(`   \x1b[32m✓\x1b[0m ${text}`);
