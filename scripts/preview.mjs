// Serves the TV screen on your computer for design work (no TV needed).
// Open the printed address in Chrome at 1920×1080. Add #settings, #radio, #wifi,
// #ambient, #alert, #sleep, #msg or #look=najdi,silver to jump to a screen.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";

const DIR = path.join(ROOT, "src", "app");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".mp4": "video/mp4", ".json": "application/json" };
const port = Number(process.env.PORT || 5173);

http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(DIR, p === "/" ? "index.html" : p);
  if (!file.startsWith(DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Majlis preview: http://localhost:${port}/`));
