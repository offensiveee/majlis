// Background helper for the majlis home screen (runs on the TV, Node 8+).
// - Settings, photos and the phone control page (http://<tv>:8090)
// - Phone remote: arrows/OK/back/home, volume, open apps, messages on screen
// - Prayer reminders shown over any app (TV notification toasts)
// - Sends the Home button back to our screen, lists installed apps
// - Renews Developer Mode and restarts itself after a reboot
// LG blocks most Luna calls for developer apps, so it talks to the TV's own
// remote-control API (SSAP, wss://127.0.0.1:3001) with a key paired during setup.
var Service = require("webos-service");
var WS = require("ws");
var fs = require("fs");
var path = require("path");
var http = require("http");
var https = require("https");
var urlLib = require("url");
var os = require("os");
var adhan = require("./adhan.js");

var VERSION = "4";
var APP_ID = "com.majlis.tv";
var PORT = 8090;
var service = new Service(APP_ID + ".service");

var LG_HOME = ["com.webos.app.home", "com.webos.app.homeconnect", "com.webos.app.launcher"];
var HIDE = /^(com\.webos\.app\.(home|homeconnect|homedashboard|lgchannels|sports|sportsteamsettings|multiviewsettings|notificationcenter|voice|voiceview|livemenu|membership|connectionwizard|quicksettings|tvhotkey|care365|adapp|igallery|lifeonscreen|scheduler|faq|tips|helpguide|remotesetting|softwareupdate|accountsetting|cheeringtv|tvuserguide|webappmanager|picturewizard|search|recommend|channeledit|accessibility|camera|lgtvplus|roomconnect)|com\.palmdts\.devmode|webos\.day|shortcutcopilot|epoxyaisports|amazon\.alexa\.view|disneyplus|com\.majlis\.tv)$/;
var INPUT = /^com\.webos\.app\.(hdmi\d|livetv|externalinput)/;

// ---------- Small helpers ----------
function mkdirp(d) { if (fs.existsSync(d)) return; mkdirp(path.dirname(d)); fs.mkdirSync(d); }
function readJson(f, def) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return def; } }
function writeJson(f, v) { try { fs.writeFileSync(f, JSON.stringify(v)); } catch (e) {} }
function readText(f) { try { return fs.readFileSync(f, "utf8").trim(); } catch (e) { return ""; } }
var log = [];
function note(s) { log.push(new Date().toISOString().slice(11, 19) + " " + s); if (log.length > 60) log.shift(); }

var DATA = path.join(__dirname, "data");
var PHOTOS = path.join(DATA, "photos");
var ICONS = path.join(DATA, "icons");
[PHOTOS, ICONS].forEach(function (d) { try { mkdirp(d); } catch (e) { note("mkdir " + e.code); } });

var STATIC = readJson(path.join(__dirname, "data.json"), { cities: [], stations: [], backgrounds: [] });

// ---------- Settings ----------
var DEFAULTS = {
  majlisName: "المجلس", majlisNameEn: "MAJLIS",
  welcome: "حيّاكم الله", welcomeSub: "أهلاً وسهلاً بضيوفنا الكرام",
  city: "riyadh", theme: "gold", ambientMin: 10, takeover: true, rotate: 0, bg: 0,
  hidden: [], order: [], hiddenBg: [],
  wifi: { ssid: "", pass: "", type: "WPA" }, events: [],
  alertOverlay: true, chime: true, tvToast: true, remind: 10, radio: "",
  ramadanDays: [], // filled in by the home app, which has the Umm al-Qura calendar
  sleepMin: 60,    // turn the TV off after this long without interaction (0 = never)
  adhanAction: "off", adhanLowerTo: 5, adhanSound: "",  // at prayer time over other apps: off | pause | lower
  friday: true, fridayRadio: false,
  accent: "", frame: "palace"
};
var prefsFile = path.join(DATA, "prefs.json");
var prefs = readJson(prefsFile, {});
Object.keys(DEFAULTS).forEach(function (k) { if (prefs[k] === undefined) prefs[k] = JSON.parse(JSON.stringify(DEFAULTS[k])); });
prefs.pin = readText(path.join(__dirname, "pin.txt")) || prefs.pin || String(1000 + Math.floor(Math.random() * 9000));
var rev = 1;
function savePrefs() { rev++; writeJson(prefsFile, prefs); pushEvent({ event: "state", rev: rev }); }

// ---------- SSAP client ----------
var PAIRING = readJson(path.join(__dirname, "pairing.json"), {});
var KEY = readText(path.join(__dirname, "ssap-key.txt"));
var ssap = { ws: null, n: 0, cbs: {}, subs: {}, state: "starting" };
var launchPoints = {}, foreground = "";

function ssapSend(type, uri, payload, cb, keep) {
  if (!ssap.ws || ssap.ws.readyState !== 1) { if (cb) cb({ type: "error", error: "not connected", payload: {} }); return; }
  var id = "q" + (++ssap.n);
  if (cb) (keep ? ssap.subs : ssap.cbs)[id] = cb;
  ssap.ws.send(JSON.stringify({ id: id, type: type, uri: uri, payload: payload }));
}
function request(uri, payload, cb) { ssapSend("request", uri, payload || {}, cb); }

function connect() {
  var ws = new WS("wss://127.0.0.1:3001", { rejectUnauthorized: false });
  ssap.ws = ws; ssap.cbs = {}; ssap.subs = {};
  ws.on("open", function () {
    ssap.state = "registering";
    var p = JSON.parse(JSON.stringify(PAIRING));
    if (KEY) p["client-key"] = KEY;
    ws.send(JSON.stringify({ id: "reg", type: "register", payload: p }));
  });
  ws.on("message", function (data) {
    var m; try { m = JSON.parse(data); } catch (e) { return; }
    if (m.id === "reg") {
      if (m.type === "registered") {
        ssap.state = "connected"; note("ssap registered");
        if (m.payload && m.payload["client-key"] && m.payload["client-key"] !== KEY) {
          KEY = m.payload["client-key"];
          try { fs.writeFileSync(path.join(__dirname, "ssap-key.txt"), KEY); } catch (e) {}
        }
        subscribe();
      }
      return;
    }
    var cb = ssap.cbs[m.id];
    if (cb) { delete ssap.cbs[m.id]; cb(m); return; }
    if (ssap.subs[m.id]) ssap.subs[m.id](m);
  });
  ws.on("close", function () { ssap.state = "reconnecting"; pointer.ws = null; setTimeout(connect, 3000); });
  ws.on("error", function (e) { ssap.state = "error " + e.message; });
}

function subscribe() {
  ssapSend("subscribe", "ssap://com.webos.applicationManager/listLaunchPoints", {}, function (m) {
    var p = m.payload || {};
    if (p.launchPoints) { launchPoints = {}; p.launchPoints.forEach(function (lp) { launchPoints[lp.id] = lp; }); note("apps " + p.launchPoints.length); }
    else if (p.change === "added" || p.change === "updated") { launchPoints[p.id] = p; note("app added " + p.id); }
    else if (p.change === "removed") { delete launchPoints[p.id]; note("app removed " + p.id); }
  }, true);
  ssapSend("subscribe", "ssap://com.webos.applicationManager/getForegroundAppInfo", {}, function (m) {
    var id = m.payload && m.payload.appId;
    if (id === undefined || id === foreground) return;
    foreground = id;
    note("foreground " + id);
    if (sleep.ignoreFg && id === APP_ID) sleep.ignoreFg = false;
    else activity("app " + id);
    if (prefs.takeover && LG_HOME.indexOf(id) !== -1) launch(APP_ID);
  }, true);
  ssapSend("subscribe", "ssap://com.webos.service.tvpower/power/getPowerState", {}, function (m) {
    var st = m.payload && m.payload.state;
    if (!st || st === power) return;
    power = st;
    note("power " + st);
    if (st === "Active") activity("power on");
  }, true);
}

// ---------- Push events to the home app (Luna subscription) ----------
var subscribers = {};
service.register("events", function (msg) {
  if (msg.isSubscription) subscribers[msg.uniqueToken] = msg;
  msg.respond({ returnValue: true, subscribed: !!msg.isSubscription, rev: rev, sleep: sleepInfo() });
}, function (msg) { delete subscribers[msg.uniqueToken]; });
function pushEvent(e) {
  e.returnValue = true;
  Object.keys(subscribers).forEach(function (k) {
    try { subscribers[k].respond(e); } catch (err) { delete subscribers[k]; }
  });
}

// ---------- Sleep timer ----------
// "Interaction" = remote presses on the home screen, switching apps or inputs,
// using the phone page, or turning the TV on. A minute before turning off, the home
// screen shows a countdown; any button cancels it and returns to what was on.
var power = "Active", lastActivity = Date.now();
var sleep = { warning: false, until: 0, prevApp: "", ignoreFg: false, timer: null };
function sleepInfo() { return { warning: sleep.warning, until: sleep.until, sleepMin: prefs.sleepMin, idleMin: Math.floor((Date.now() - lastActivity) / 60000) }; }
function activity(why) {
  lastActivity = Date.now();
  if (!sleep.warning) return;
  sleep.warning = false;
  clearTimeout(sleep.timer);
  note("sleep cancelled (" + why + ")");
  pushEvent({ event: "sleepCancel" });
  if (sleep.prevApp && sleep.prevApp !== APP_ID && LG_HOME.indexOf(sleep.prevApp) === -1) launch(sleep.prevApp);
}
setInterval(function () {
  if (!prefs.sleepMin || sleep.warning || power !== "Active" || ssap.state !== "connected") return;
  if (Date.now() - lastActivity < prefs.sleepMin * 60000) return;
  sleep.warning = true;
  sleep.until = Date.now() + 60000;
  sleep.prevApp = foreground;
  note("sleep warning (idle " + prefs.sleepMin + " min, on " + foreground + ")");
  if (foreground !== APP_ID) { sleep.ignoreFg = true; launch(APP_ID); }
  pushEvent({ event: "sleepWarn", until: sleep.until });
  sleep.timer = setTimeout(function () {
    if (!sleep.warning) return;
    sleep.warning = false;
    note("sleep: turning TV off");
    lastActivity = Date.now();
    request("ssap://system/turnOff", {}, function () {});
  }, 60000);
}, 15000);

function launch(id, cb) { request("ssap://system.launcher/launch", { id: id }, function (m) { if (cb) cb(m.type !== "error"); }); }
function toast(message, cb) { request("ssap://system.notifications/createToast", { message: message }, function (m) { if (cb) cb(m.type !== "error"); }); }

// Remote-control buttons go through LG's pointer input socket.
var pointer = { ws: null, opening: false, queue: [] };
function pointerSend(button) {
  if (pointer.ws && pointer.ws.readyState === 1) { pointer.ws.send("type:button\nname:" + button + "\n\n"); return; }
  pointer.queue.push(button);
  if (pointer.opening) return;
  pointer.opening = true;
  request("ssap://com.webos.service.networkinput/getPointerInputSocket", {}, function (m) {
    var sp = m.payload && m.payload.socketPath;
    if (!sp) { pointer.opening = false; pointer.queue = []; note("pointer: " + (m.error || "no socket")); return; }
    var ws = new WS(sp, { rejectUnauthorized: false });
    ws.on("open", function () {
      pointer.ws = ws; pointer.opening = false;
      var q = pointer.queue; pointer.queue = [];
      q.forEach(function (b) { ws.send("type:button\nname:" + b + "\n\n"); });
    });
    ws.on("close", function () { pointer.ws = null; });
    ws.on("error", function () { pointer.ws = null; pointer.opening = false; });
  });
}

// ---------- Prayer reminders over any app ----------
var PRAYER_AR = { fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
var prayerTimers = [], prayerPlan = [];
function city() {
  var list = STATIC.cities || [];
  for (var i = 0; i < list.length; i++) if (list[i].id === prefs.city) return list[i];
  return list[0] || { lat: 24.7136, lon: 46.6753, method: "UmmAlQura", ar: "الرياض", tz: 180 };
}
function arDigits(n) { return String(n).replace(/\d/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[d]; }); }
// The TV's Node may run in UTC, so local dates use the city's offset (Gulf: no DST).
function local(ts) { return new Date(ts + (city().tz || 180) * 60000); }
function localYmd(ts) { var d = local(ts); return d.getUTCFullYear() + "-" + (d.getUTCMonth() < 9 ? "0" : "") + (d.getUTCMonth() + 1) + "-" + (d.getUTCDate() < 10 ? "0" : "") + d.getUTCDate(); }
function isFriday(ts) { return local(ts).getUTCDay() === 5; }
function localTime(y, m, d, h, min) { return Date.UTC(y, m, d, h, min) - (city().tz || 180) * 60000; }

function schedulePrayers() {
  prayerTimers.forEach(clearTimeout);
  prayerTimers = []; prayerPlan = [];
  var c = city(), now = Date.now();
  var M = adhan.CalculationMethod, params = (M[c.method] || M.UmmAlQura)();
  [0, 1].forEach(function (dayOffset) {
    var l = local(now + dayOffset * 86400000);
    var y = l.getUTCFullYear(), mo = l.getUTCMonth(), dd = l.getUTCDate();
    var t = new adhan.PrayerTimes(new adhan.Coordinates(c.lat, c.lon), new Date(y, mo, dd, 12), params);
    var ymd = localYmd(now + dayOffset * 86400000);
    // Umm al-Qura: in Ramadan Isha is two hours after Maghrib.
    var ramadan = c.method === "UmmAlQura" && (prefs.ramadanDays || []).indexOf(ymd) !== -1;
    Object.keys(PRAYER_AR).forEach(function (k) {
      var at = k === "isha" && ramadan ? t.maghrib.getTime() + 120 * 60000 : t[k].getTime();
      var name = k === "dhuhr" && prefs.friday && isFriday(at) ? "الجمعة" : PRAYER_AR[k];
      if (at > now) {
        prayerPlan.push({ key: k, name: name, at: new Date(at).toISOString() });
        prayerTimers.push(setTimeout(function () { atPrayer(k, name, at); }, at - now));
      }
      var before = (prefs.remind || 0) * 60000;
      if (before && at - before > now) {
        prayerTimers.push(setTimeout(function () {
          if (prefs.tvToast) toast("⏳ باقي " + arDigits(prefs.remind) + " دقائق على أذان " + name);
        }, at - before - now));
      }
    });
    // Friday morning: a gentle reminder at 9:00.
    var fri = localTime(y, mo, dd, 9, 0);
    if (prefs.friday && isFriday(fri) && fri > now) {
      prayerTimers.push(setTimeout(function () {
        showMessage({ text: "جمعة مباركة", sub: "لا تنسوا قراءة سورة الكهف والصلاة على النبي ﷺ", kind: "friday" }, false);
      }, fri - now));
    }
  });
  // Re-plan just after local midnight.
  var l0 = local(now), midnight = localTime(l0.getUTCFullYear(), l0.getUTCMonth(), l0.getUTCDate() + 1, 0, 5);
  prayerTimers.push(setTimeout(schedulePrayers, midnight - now));
  note("prayers planned: " + prayerPlan.length + " for " + (c.en || c.id));
}

// At prayer time. On the majlis screen the app shows the alert itself. Over other apps:
// a notification, plus (if chosen) pausing the video or lowering the volume until the adhan ends.
var alertNow = null, adhanRestore = null, adhanTimer = null;
function atPrayer(k, name, at) {
  alertNow = { key: k, name: name, at: at, until: at + 4 * 60000 };
  if (foreground === APP_ID) { pushEvent({ event: "prayer", alert: alertNow }); return; }
  if (prefs.tvToast) toast("🕌 حان الآن موعد أذان " + name);
  var prev = foreground;
  if (prefs.adhanAction === "pause") {
    request("ssap://media.controls/pause", {}, function () {});
    adhanRestore = { type: "play", app: prev };
    if (prefs.adhanSound) { adhanRestore.relaunch = prev; sleep.ignoreFg = true; launch(APP_ID); }
  } else if (prefs.adhanAction === "lower") {
    request("ssap://audio/getVolume", {}, function (m) {
      var p = m.payload || {}, v = p.volumeStatus ? p.volumeStatus.volume : p.volume;
      var to = prefs.adhanLowerTo || 5;
      if (typeof v === "number" && v > to) {
        adhanRestore = { type: "volume", volume: v, app: prev };
        request("ssap://audio/setVolume", { volume: to }, function () {});
      }
    });
  }
  clearTimeout(adhanTimer);
  adhanTimer = setTimeout(finishAdhan, 4 * 60000);
  note("prayer " + k + " (" + (prefs.adhanAction || "off") + ") on " + prev);
}
function finishAdhan() {
  clearTimeout(adhanTimer);
  alertNow = null;
  var r = adhanRestore; adhanRestore = null;
  if (!r) return;
  if (r.relaunch && r.relaunch !== APP_ID && LG_HOME.indexOf(r.relaunch) === -1) launch(r.relaunch);
  if (r.type === "play") setTimeout(function () { if (foreground === r.app) request("ssap://media.controls/play", {}, function () {}); }, r.relaunch ? 3500 : 0);
  if (r.type === "volume") request("ssap://audio/setVolume", { volume: r.volume }, function () {});
  note("adhan finished, restored " + r.type);
}

// ---------- Messages on the screen ----------
// Shown as a full-screen card on the majlis screen until any button is pressed.
// Over other apps: a notification, and (if asked) switch to the majlis screen to show it.
var message = null;
function showMessage(m, fullscreen) {
  message = { id: Date.now(), text: String(m.text || "").slice(0, 160), sub: String(m.sub || "").slice(0, 200), kind: m.kind || "message", at: Date.now() };
  if (foreground === APP_ID) { pushEvent({ event: "message", message: message }); return; }
  toast((m.kind === "friday" ? "🌿 " : "💬 ") + message.text + (message.sub ? " · " + message.sub : ""));
  if (fullscreen) { sleep.ignoreFg = true; launch(APP_ID); }
}
// Scheduled occasions with a time: show the welcome card when the time comes.
var firedEvents = {};
setInterval(function () {
  var now = Date.now();
  (prefs.events || []).forEach(function (e) {
    if (!e.at || firedEvents[e.at + e.name] || now < e.at || now - e.at > 120000) return;
    firedEvents[e.at + e.name] = true;
    showMessage({ text: prefs.welcome || "حيّاكم الله", sub: e.name, kind: "event" }, !!e.fullscreen);
  });
}, 20000);

// ---------- HTTP helpers ----------
function fetchBuffer(u, cb, depth) {
  var opts = urlLib.parse(u);
  opts.rejectUnauthorized = false;
  opts.timeout = 15000;
  opts.headers = { "User-Agent": "Mozilla/5.0 (webOS TV)" };
  var mod = u.indexOf("https:") === 0 ? https : http;
  var req = mod.get(opts, function (res) {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (depth || 0) < 4) {
      res.resume(); return fetchBuffer(urlLib.resolve(u, res.headers.location), cb, (depth || 0) + 1);
    }
    if (res.statusCode !== 200) { res.resume(); return cb(new Error("HTTP " + res.statusCode)); }
    var chunks = [], size = 0;
    res.on("data", function (c) { size += c.length; if (size > 20e6) { req.abort(); return; } chunks.push(c); });
    res.on("end", function () { cb(null, Buffer.concat(chunks), res.headers["content-type"] || ""); });
  });
  req.on("error", function (e) { cb(e); });
  req.on("timeout", function () { req.abort(); });
}
function myIp() {
  var nets = os.networkInterfaces();
  for (var k in nets) for (var i = 0; i < nets[k].length; i++) { var a = nets[k][i]; if (a.family === "IPv4" && !a.internal) return a.address; }
  return "";
}
function send(res, code, body, type) {
  res.writeHead(code, { "Content-Type": type || "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE", "Access-Control-Allow-Headers": "Content-Type", "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req, max, cb) {
  var chunks = [], size = 0, done = false;
  req.on("data", function (c) { size += c.length; if (size > max) { done = true; req.destroy(); cb(new Error("too big")); return; } chunks.push(c); });
  req.on("end", function () { if (!done) cb(null, Buffer.concat(chunks)); });
}
function jsonBody(req, cb) { readBody(req, 2e5, function (err, b) { var v = null; try { v = JSON.parse(b); } catch (e) {} cb(v || {}); }); }

function listPhotos() {
  try {
    return fs.readdirSync(PHOTOS).filter(function (f) { return /\.(jpe?g|png|webp)$/i.test(f); }).sort().map(function (f) { return { name: f }; });
  } catch (e) { return []; }
}
function savePhoto(buf, ext) {
  var name = "photo-" + Date.now() + "." + ext;
  fs.writeFileSync(path.join(PHOTOS, name), buf);
  rev++; pushEvent({ event: "state", rev: rev });
  note("photo saved " + name);
  return name;
}
function appsList() {
  var out = { apps: [], inputs: [] };
  Object.keys(launchPoints).forEach(function (id) {
    if (HIDE.test(id)) return;
    var lp = launchPoints[id];
    var item = { id: id, title: lp.title || id, icon: "http://127.0.0.1:" + PORT + "/icon/" + encodeURIComponent(id) };
    if (INPUT.test(id)) out.inputs.push(item); else out.apps.push(item);
  });
  return out;
}
function nowApp() {
  var lp = launchPoints[foreground];
  return foreground ? { id: foreground, title: foreground === APP_ID ? "شاشة المجلس" : lp ? lp.title : foreground } : null;
}
function publicPrefs() { var c = JSON.parse(JSON.stringify(prefs)); delete c.pin; return c; }
function statusInfo(local) {
  return {
    version: VERSION, ip: myIp(), port: PORT, pin: local ? prefs.pin : undefined, ssap: ssap.state, foreground: foreground,
    apps: Object.keys(launchPoints).length, power: power, sleep: sleepInfo(), devmode: devmode,
    alertNow: alertNow, message: message, nowApp: nowApp(), heartbeat: heartbeat.state, prayers: prayerPlan.slice(0, 6), log: log.slice(-30)
  };
}

var EDITABLE = Object.keys(DEFAULTS);
var PAGE = readText(path.join(__dirname, "phone.html"));
var BUILTIN_DIR = path.join(__dirname, "builtin-backgrounds");
var ASSETS = path.join(__dirname, "assets");
var MANIFEST = JSON.stringify({
  name: "المجلس", short_name: "المجلس", start_url: "/", scope: "/", display: "standalone", dir: "rtl", lang: "ar",
  background_color: "#120a05", theme_color: "#120a05",
  icons: [{ src: "/assets/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/assets/icon-512.png", sizes: "512x512", type: "image/png" }]
});

// ---------- HTTP server ----------
http.createServer(function (req, res) {
  var u = urlLib.parse(req.url, true), p = u.pathname, q = u.query;
  var local = (req.socket.remoteAddress || "").indexOf("127.0.0.1") !== -1;
  var allowed = local || q.pin === prefs.pin;
  if (req.method === "OPTIONS") return send(res, 204, "");

  if (p === "/" || p === "/index.html") return send(res, 200, PAGE, "text/html; charset=utf-8");
  if (p === "/manifest.json") return send(res, 200, MANIFEST, "application/manifest+json");
  if (p.indexOf("/assets/") === 0) {
    var af = path.join(ASSETS, path.basename(decodeURIComponent(p.slice(8))));
    if (!fs.existsSync(af)) return send(res, 404, { error: "not found" });
    var ext = path.extname(af).toLowerCase(), types = { ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".jpg": "image/jpeg" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "Cache-Control": "max-age=604800" });
    return res.end(fs.readFileSync(af));
  }
  if (p === "/api/state") return send(res, 200, { rev: rev, prefs: publicPrefs(), photos: listPhotos(), status: statusInfo(local) });
  if (p === "/api/data") return send(res, 200, STATIC);
  if (p === "/api/apps") return send(res, 200, appsList());
  if (p === "/api/check") return send(res, allowed ? 200 : 403, { ok: allowed });

  if (p.indexOf("/icon/") === 0) {
    var id = decodeURIComponent(p.slice(6)), f = path.join(ICONS, id.replace(/[^\w.-]/g, "_") + ".png");
    if (fs.existsSync(f)) return send(res, 200, fs.readFileSync(f), "image/png");
    var lp = launchPoints[id], src = lp && (lp.largeIcon || lp.icon);
    if (!src) return send(res, 404, { error: "no icon" });
    return fetchBuffer(src, function (err, buf) {
      if (err) return send(res, 404, { error: err.message });
      try { fs.writeFileSync(f, buf); } catch (e) {}
      send(res, 200, buf, "image/png");
    });
  }
  if (p.indexOf("/builtin/") === 0) {
    var bf = path.join(BUILTIN_DIR, path.basename(decodeURIComponent(p.slice(9))));
    if (!/\.jpe?g$/i.test(bf) || !fs.existsSync(bf)) return send(res, 404, { error: "not found" });
    return send(res, 200, fs.readFileSync(bf), "image/jpeg");
  }
  if (p.indexOf("/photos/") === 0) {
    var pf = path.join(PHOTOS, path.basename(decodeURIComponent(p.slice(8))));
    if (!fs.existsSync(pf)) return send(res, 404, { error: "not found" });
    return send(res, 200, fs.readFileSync(pf), /\.png$/i.test(pf) ? "image/png" : "image/jpeg");
  }
  if (p === "/api/photos" && req.method === "GET") return send(res, 200, listPhotos());

  // Everything below changes something: TV itself or the PIN.
  if (p === "/api/message/dismiss" && local) { message = null; return send(res, 200, { ok: true }); }
  if (p === "/api/alertDone" && local) { finishAdhan(); return send(res, 200, { ok: true }); }
  if (p === "/api/activity" && local) { activity(q.why || "remote"); return send(res, 200, { ok: true }); }
  if (p.indexOf("/api/") === 0 && !local && allowed) activity("phone");
  if (p.indexOf("/api/") === 0 && !local) note("phone " + req.method + " " + p + (q.action ? " " + q.action : "") + (q.button ? " " + q.button : "") + (allowed ? "" : " (wrong PIN)") + " from " + (req.socket.remoteAddress || "").replace("::ffff:", ""));
  if (!allowed) return send(res, 403, { error: "الرمز غير صحيح" });

  if (p === "/api/prefs" && req.method === "POST") {
    return jsonBody(req, function (v) {
      var replan = false;
      Object.keys(v).forEach(function (k) {
        if (EDITABLE.indexOf(k) === -1) return;
        if (["city", "remind", "tvToast", "ramadanDays", "friday"].indexOf(k) !== -1 && JSON.stringify(prefs[k]) !== JSON.stringify(v[k])) replan = true;
        prefs[k] = v[k];
      });
      savePrefs();
      if (replan) schedulePrayers();
      send(res, 200, { ok: true, rev: rev });
    });
  }
  if (p === "/api/photos" && req.method === "POST") {
    return readBody(req, 25e6, function (err, b) {
      if (err || !b.length) return send(res, 400, { error: "فشل الرفع" });
      send(res, 200, { ok: true, name: savePhoto(b, /png/.test(req.headers["content-type"] || "") ? "png" : "jpg") });
    });
  }
  if (p === "/api/photos/url" && req.method === "POST") {
    return jsonBody(req, function (v) {
      if (!/^https?:\/\//.test(v.url || "")) return send(res, 400, { error: "الرابط لازم يبدأ بـ http" });
      fetchBuffer(v.url, function (e2, buf, type) {
        if (e2) return send(res, 400, { error: "تعذر التحميل: " + e2.message });
        if (!/image\//.test(type)) return send(res, 400, { error: "الرابط ليس صورة" });
        send(res, 200, { ok: true, name: savePhoto(buf, /png/.test(type) ? "png" : "jpg") });
      });
    });
  }
  if (p.indexOf("/api/photos/") === 0 && req.method === "DELETE") {
    var name = path.basename(decodeURIComponent(p.slice(12)));
    try { fs.unlinkSync(path.join(PHOTOS, name)); rev++; pushEvent({ event: "state", rev: rev }); note("photo deleted " + name); } catch (e) {}
    return send(res, 200, { ok: true });
  }
  if (p === "/api/remote") { pointerSend(String(q.button || "").toUpperCase()); return send(res, 200, { ok: true }); }
  if (p === "/api/volume") {
    var a = q.action, uri = a === "up" ? "ssap://audio/volumeUp" : a === "down" ? "ssap://audio/volumeDown" : a === "mute" ? "ssap://audio/setMute" : "ssap://audio/getVolume";
    return request(uri, a === "mute" ? { mute: q.on !== "0" } : {}, function (m) { send(res, 200, m.payload || {}); });
  }
  if (p === "/api/launch") { launch(String(q.id || ""), function (ok) { send(res, ok ? 200 : 500, { ok: ok }); }); return; }
  if (p === "/api/home") { launch(APP_ID, function (ok) { send(res, ok ? 200 : 500, { ok: ok }); }); return; }
  if (p === "/api/toast") { return jsonBody(req, function (v) { showMessage({ text: v.message, sub: v.sub }, !!v.fullscreen); send(res, 200, { ok: true }); }); }
  if (p === "/api/power" && q.action === "off") { request("ssap://system/turnOff", {}, function () { send(res, 200, { ok: true }); }); return; }
  send(res, 404, { error: "not found" });
}).on("error", function (e) { note("http error " + e.code); }).listen(PORT, "0.0.0.0");

// ---------- Luna methods ----------
service.activityManager.create("keepAlive", function () { note("keepalive on"); });
service.register("start", function (msg) { msg.respond({ returnValue: true, version: VERSION, port: PORT }); });
service.register("quit", function (msg) { msg.respond({ returnValue: true }); setTimeout(function () { process.exit(0); }, 200); });

// ---------- Developer Mode renewal (every 12 hours) ----------
var devmode = { last: "", result: "" };
function renewDevmode() {
  var token = readText("/var/luna/preferences/devmode_enabled") || readText(path.join(__dirname, "devmode-token.txt"));
  if (!token) { devmode.result = "no token"; return; }
  fetchBuffer("https://developer.lge.com/secure/ResetDevModeSession.dev?sessionToken=" + encodeURIComponent(token), function (err, buf) {
    devmode.last = new Date().toISOString();
    devmode.result = err ? "error " + err.message : String(buf).slice(0, 120);
    note("devmode renew: " + devmode.result);
  });
}
setTimeout(renewDevmode, 20000);
setInterval(renewDevmode, 12 * 3600 * 1000);

// ---------- Start again after a TV restart ----------
var heartbeat = { state: "" };
service.register("heartbeat", function (msg) { msg.respond({ returnValue: true }); });
service.call("luna://com.palm.activitymanager/create", {
  activity: {
    name: APP_ID + ".heartbeat", description: "Keeps the majlis helper running",
    type: { background: true, persist: true, explicit: true },
    schedule: { interval: "5m" },
    callback: { method: "luna://" + APP_ID + ".service/heartbeat", params: {} }
  },
  start: true, replace: true, subscribe: false
}, function (r) {
  heartbeat.state = r.payload.returnValue ? "ok " + r.payload.activityId : (r.payload.errorText || "failed");
  note("heartbeat activity: " + heartbeat.state);
});

connect();
try { schedulePrayers(); } catch (e) { note("prayers error " + e.message); }
note("service started v" + VERSION);
