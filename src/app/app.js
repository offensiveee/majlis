(function () {
  "use strict";

  var SERVICE = "http://127.0.0.1:8090";
  var SERVICE_VERSION = "4"; // keep in step with VERSION in service/service.js
  var APP_ID = "com.majlis.tv";

  var CITIES = window.MAJLIS_CITIES || [];
  var STATIONS = window.MAJLIS_STATIONS || [];
  var PRAYERS = window.MAJLIS_PRAYERS || [];
  var THEMES = [{ id: "gold", ar: "ذهبي" }, { id: "emerald", ar: "زمردي" }, { id: "sadu", ar: "سدو أحمر" }];
  var AMBIENT = [0, 5, 10, 15, 30];
  var SLIDESHOW = [0, 10, 30, 60];
  var REMIND = [0, 5, 10, 15];
  var SLEEP = [0, 15, 30, 60, 240];
  var ADHANS = window.MAJLIS_ADHANS || [];
  var ADHAN_ACTIONS = [{ id: "off", ar: "لا شيء" }, { id: "pause", ar: "إيقاف الفيديو مؤقتاً" }, { id: "lower", ar: "خفض الصوت" }];
  var ACCENTS = [{ id: "", ar: "حسب الثيم" }, { id: "silver", ar: "فضي" }, { id: "bronze", ar: "نحاسي" }, { id: "rose", ar: "وردي ذهبي" }, { id: "turquoise", ar: "فيروزي" }, { id: "pearl", ar: "لؤلؤي" }];
  var FRAMES = [{ id: "palace", ar: "قصر" }, { id: "najdi", ar: "نجدي" }, { id: "mashrabiya", ar: "مشربية" }, { id: "arch", ar: "محراب" }, { id: "minimal", ar: "بسيط" }, { id: "none", ar: "بدون" }];

  var DEFAULTS = {
    majlisName: "المجلس", majlisNameEn: "MAJLIS",
    welcome: "حيّاكم الله", welcomeSub: "أهلاً وسهلاً بضيوفنا الكرام",
    city: "riyadh", theme: "gold", ambientMin: 10, takeover: true, rotate: 0, bg: 0,
    hidden: [], order: [], hiddenBg: [],
    wifi: { ssid: "", pass: "", type: "WPA" }, events: [],
    alertOverlay: true, chime: true, tvToast: true, remind: 10, radio: "", ramadanDays: [], sleepMin: 60,
    adhanAction: "off", adhanLowerTo: 5, adhanSound: "", friday: true, fridayRadio: false,
    accent: "", frame: "palace"
  };

  if (window.MAJLIS_CONFIG) for (var ck in window.MAJLIS_CONFIG) DEFAULTS[ck] = window.MAJLIS_CONFIG[ck];
  var $ = function (id) { return document.getElementById(id); };
  var prefs = loadLocalPrefs();
  var serviceUp = false, status = {}, rev = -1;

  // ---------- Small helpers ----------
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function loadLocalPrefs() {
    var p = clone(DEFAULTS);
    try { var s = JSON.parse(localStorage.getItem("prefs")); if (s) for (var k in s) p[k] = s[k]; } catch (e) {}
    return p;
  }
  function savePrefs(keys) {
    try { localStorage.setItem("prefs", JSON.stringify(prefs)); } catch (e) {}
    if (!serviceUp) return;
    var body = {};
    (keys || Object.keys(prefs)).forEach(function (k) { body[k] = prefs[k]; });
    post("/api/prefs", body);
  }
  function get(url, cb) {
    var x = new XMLHttpRequest();
    x.open("GET", (url.indexOf("http") === 0 ? "" : SERVICE) + url);
    x.timeout = 8000;
    x.onload = function () { var j = null; try { j = JSON.parse(x.responseText); } catch (e) {} cb(x.status === 200 ? j : null); };
    x.onerror = x.ontimeout = function () { cb(null); };
    x.send();
  }
  function post(url, body, cb) {
    var x = new XMLHttpRequest();
    x.open("POST", SERVICE + url);
    x.onload = function () { if (cb) cb(x.status === 200); };
    x.onerror = function () { if (cb) cb(false); };
    x.send(JSON.stringify(body || {}));
  }
  function del(url, cb) {
    var x = new XMLHttpRequest();
    x.open("DELETE", SERVICE + url);
    x.onload = function () { if (cb) cb(x.status === 200); };
    x.send();
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function arDigits(n) { return String(n).replace(/\d/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[d]; }); }
  function fmt(locale, opts, d) { try { return new Intl.DateTimeFormat(locale, opts).format(d); } catch (e) { return ""; } }
  function cycle(list, cur, step) { var i = list.indexOf(cur); if (i === -1) i = 0; return list[(i + step + list.length) % list.length]; }
  function city() { for (var i = 0; i < CITIES.length; i++) if (CITIES[i].id === prefs.city) return CITIES[i]; return CITIES[0]; }
  function time12(d) {
    var h = d.getHours() % 12 || 12, m = d.getMinutes();
    return h + ":" + (m < 10 ? "0" : "") + m;
  }
  function ampm(d) { return d.getHours() < 12 ? "ص" : "م"; }

  // ---------- System (LG, Android, Samsung): see platform.js ----------
  var Platform = window.Platform;
  var luna = Platform.luna;
  function launch(item) { Platform.launch(item, function () { toast("تعذر فتح " + item.title); }); }

  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2800);
  }

  // ---------- Keep the screen on ----------
  function keepVideoPlaying() {
    Platform.keepAwake();
    var v = $("keepawake");
    v.muted = true;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }
  setInterval(keepVideoPlaying, 30000);

  // ---------- Texts & theme ----------
  function applyTexts() {
    document.body.className = "theme-" + (prefs.theme || "gold") + (prefs.accent ? " accent-" + prefs.accent : "") + " frame-" + (prefs.frame || "palace");
    $("majlisName").textContent = prefs.majlisName || "";
    $("majlisNameEn").textContent = prefs.majlisNameEn || "";
    $("welcome").textContent = prefs.welcome || "";
    $("welcomeSub").textContent = upcomingEventText() || prefs.welcomeSub || "";
    $("ambWelcome").textContent = prefs.welcome || "";
    $("pCity").textContent = city().ar;
  }

  // A scheduled occasion within the next 24 hours replaces the line under the welcome.
  function upcomingEventText() {
    var now = Date.now(), best = null;
    (prefs.events || []).forEach(function (e) { if (e.at && e.at > now && e.at - now < 86400000 && (!best || e.at < best.at)) best = e; });
    if (!best) return "";
    var ms = best.at - now, m = Math.round(ms / 60000), d = new Date(best.at);
    var rel = m < 60 ? "بعد " + arDigits(m) + " دقيقة" : m < 120 ? "بعد ساعة" : m < 180 ? "بعد ساعتين" : "الساعة " + time12(d) + " " + (d.getHours() < 12 ? "صباحاً" : "مساءً");
    return best.name + " · " + rel;
  }
  // Friday morning: Quran radio on the majlis screen (optional), once.
  var fridayRadioDay = "";
  function fridayRadioTick(now) {
    if (!prefs.fridayRadio || now.getDay() !== 5 || radioPlaying || document.hidden || !prayerTimes.length) return;
    var key = now.toDateString();
    if (fridayRadioDay === key) return;
    if (now > prayerTimes[1].time && now < new Date(prayerTimes[2].time.getTime() - 20 * 60000)) {
      fridayRadioDay = key;
      var i = stationIndex(prefs.radio);
      playStation(STATIONS[i >= 0 ? i : 0]);
    }
  }

  // ---------- Clock & dates ----------
  var lastMinute = -1, lastDay = -1;
  function tick() {
    var d = new Date();
    if (d.getMinutes() !== lastMinute) {
      lastMinute = d.getMinutes();
      $("hm").textContent = time12(d);
      $("ampm").textContent = ampm(d);
      $("ambTime").textContent = time12(d);
      rotateAyah();
      slideshowTick();
      $("welcomeSub").textContent = upcomingEventText() || prefs.welcomeSub || "";
      fridayRadioTick(d);
    }
    if (d.getDate() !== lastDay) {
      lastDay = d.getDate();
      $("dayAr").textContent = fmt("ar-SA", { weekday: "long" }, d);
      $("dayEn").textContent = fmt("en-GB", { weekday: "long" }, d).toUpperCase();
      $("hijri").textContent = fmt("ar-SA-u-ca-islamic-umalqura-nu-arab", { day: "numeric", month: "long", year: "numeric" }, d);
      $("greg").textContent = fmt("en-GB", { day: "numeric", month: "long", year: "numeric" }, d);
      $("ambDate").textContent = $("dayAr").textContent + " · " + $("hijri").textContent;
      computePrayers();
      renderOccasions();
      syncRamadanDays();
    }
    prayerTick(d);
    setTimeout(tick, 1000 - d.getMilliseconds() + 5);
  }

  var ayahIndex = -1;
  function rotateAyah() {
    var list = window.MAJLIS_AYAT || [];
    if (!list.length) return;
    var i = Math.floor(Date.now() / (20 * 60000)) % list.length;
    if (i === ayahIndex) return;
    var first = ayahIndex === -1, el = $("ayah");
    ayahIndex = i;
    $("ambAyah").textContent = list[i];
    if (first) { el.textContent = list[i]; return; }
    el.classList.add("fade");
    setTimeout(function () { el.textContent = list[i]; el.classList.remove("fade"); }, 900);
  }

  // ---------- Prayer times ----------
  var prayerTimes = [];   // [{key, ar, alert, time: Date}] today + tomorrow's fajr
  var alerted = {};
  function methodParams(name) {
    var M = adhan.CalculationMethod;
    var p = (M[name] || M.UmmAlQura)();
    return p;
  }
  function timesFor(date) {
    var c = city();
    var t = new adhan.PrayerTimes(new adhan.Coordinates(c.lat, c.lon), date, methodParams(c.method));
    var list = PRAYERS.map(function (p) { return { key: p.key, ar: p.ar, alert: p.alert, time: t[p.key] }; });
    // Umm al-Qura: in Ramadan Isha is two hours after Maghrib (90 minutes the rest of the year).
    var hp = hijriParts(date);
    if (c.method === "UmmAlQura" && hp && hp.month === 9) list[5].time = new Date(t.maghrib.getTime() + 120 * 60000);
    return list;
  }
  // Tell the helper which days are in Ramadan (its Node has no Hijri calendar).
  function ymd(d) { return d.getFullYear() + "-" + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1) + "-" + (d.getDate() < 10 ? "0" : "") + d.getDate(); }
  function syncRamadanDays() {
    if (!serviceUp) return;
    var days = [], now = Date.now();
    for (var i = 0; i < 400; i++) {
      var d = new Date(now + i * 86400000), p = hijriParts(d);
      if (p && p.month === 9) days.push(ymd(d));
    }
    if (JSON.stringify(days) === JSON.stringify(prefs.ramadanDays || [])) return;
    prefs.ramadanDays = days;
    savePrefs(["ramadanDays"]);
  }
  function computePrayers() {
    if (typeof adhan === "undefined") return;
    var today = new Date(), tomorrow = new Date(today.getTime() + 86400000);
    prayerTimes = timesFor(today);
    if (prefs.friday && today.getDay() === 5) prayerTimes[2].ar = "الجمعة";
    var tf = timesFor(tomorrow)[0];
    tf.tomorrow = true;
    prayerTimes.push(tf);
    var html = "";
    prayerTimes.slice(0, 6).forEach(function (p, i) {
      html += '<div class="p-row ' + p.key + '" data-i="' + i + '"><span class="p-name">' + p.ar + '</span><span class="p-time">' + time12(p.time) + " <small>" + ampm(p.time) + "</small></span></div>";
    });
    $("prayerList").innerHTML = html;
    sendPrayerPlan();
    lastNextKey = "";
    prayerTick(new Date());
  }
  // The Android helper can't calculate prayer times itself, so the screen sends it the week ahead.
  function sendPrayerPlan() {
    if (Platform.id !== "android" || !serviceUp) return;
    var list = [], now = Date.now();
    for (var d = 0; d < 7; d++) {
      var day = new Date(now + d * 86400000);
      timesFor(day).forEach(function (p) {
        if (!p.alert || p.time.getTime() < now) return;
        list.push({ key: p.key, name: p.key === "dhuhr" && prefs.friday && day.getDay() === 5 ? "الجمعة" : p.ar, at: p.time.getTime() });
      });
    }
    post("/api/prayers", { list: list });
  }
  function nextPrayer(now) {
    for (var i = 0; i < prayerTimes.length; i++) {
      var p = prayerTimes[i];
      if (p.key !== "sunrise" && p.time > now) return p;
    }
    return null;
  }
  function countdown(ms) {
    var m = Math.ceil(ms / 60000);
    if (m < 60) return arDigits(m) + " د";
    var h = Math.floor(m / 60), r = m % 60;
    return h + ":" + (r < 10 ? "0" : "") + r;
  }
  var lastNextKey = "";
  function prayerTick(now) {
    if (!prayerTimes.length) return;
    var n = nextPrayer(now);
    if (n) {
      $("nextName").textContent = n.ar;
      $("nextIn").textContent = countdown(n.time - now);
      $("ambNext").textContent = n.ar + " · " + time12(n.time) + " " + ampm(n.time);
      $("ambNextIn").textContent = "بعد " + countdown(n.time - now);
      var key = n.key + n.time.getTime();
      if (key !== lastNextKey) {
        lastNextKey = key;
        // After Isha the next prayer is tomorrow's Fajr: highlight the Fajr row.
        var target = n.tomorrow ? prayerTimes[0] : n;
        var rows = $("prayerList").children;
        for (var i = 0; i < rows.length; i++) {
          var p = prayerTimes[i];
          rows[i].classList.toggle("next", p === target);
          rows[i].classList.toggle("past", p !== target && (n.tomorrow || p.time <= now));
        }
      }
    }
    // Alert at prayer time (within the first minute).
    prayerTimes.forEach(function (p) {
      if (!p.alert) return;
      var id = p.key + p.time.getTime(), diff = now - p.time;
      if (diff >= 0 && diff < 60000 && !alerted[id]) { alerted[id] = true; showPrayerAlert(p); }
    });
  }

  var alertTimer = null;
  function showPrayerAlert(p) {
    if (!prefs.alertOverlay) return;
    $("paName").textContent = p.ar;
    $("paTime").textContent = time12(p.time) + " " + ampm(p.time);
    exitAmbient(); hideMessageCard(true);
    $("prayerAlert").classList.add("show");
    playAdhan();
    clearTimeout(alertTimer);
    alertTimer = setTimeout(hidePrayerAlert, 3 * 60000);
  }
  function hidePrayerAlert() {
    var was = alertOpen();
    $("prayerAlert").classList.remove("show"); clearTimeout(alertTimer);
    stopAdhan();
    if (was && serviceUp) get("/api/alertDone", function () {}); // lets the helper resume what was playing
  }
  // Adhan sound (optional); falls back to the soft chime.
  var radioBeforeAdhan = "";
  function adhanUrl() { for (var i = 0; i < ADHANS.length; i++) if (ADHANS[i].id === prefs.adhanSound) return ADHANS[i].url; return /^https?:/.test(prefs.adhanSound || "") ? prefs.adhanSound : ""; }
  function playAdhan() {
    var u = adhanUrl();
    if (!u) { if (prefs.chime) chime(); return; }
    if (radioPlaying) { radioBeforeAdhan = radioPlaying; stopRadio(); }
    var a = $("adhanAudio");
    a.src = u;
    var p = a.play(); if (p && p.catch) p.catch(function () { if (prefs.chime) chime(); });
  }
  function stopAdhan() {
    var a = $("adhanAudio");
    if (a.getAttribute("src")) { a.pause(); a.removeAttribute("src"); a.load(); }
  }
  $("adhanAudio").addEventListener("ended", function () { setTimeout(hidePrayerAlert, 8000); });
  function alertOpen() { return $("prayerAlert").classList.contains("show"); }

  // A soft three-note chime made with Web Audio (no sound files needed).
  function chime() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      var ctx = new Ctx();
      [523.25, 659.25, 783.99].forEach(function (f, i) {
        var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.55;
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 2.3);
      });
      setTimeout(function () { ctx.close(); }, 4500);
    } catch (e) {}
  }

  // ---------- Occasions (Hijri) ----------
  function hijriParts(d) {
    try {
      var parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric" }).formatToParts(d);
      var o = {};
      parts.forEach(function (p) { o[p.type] = parseInt(p.value, 10); });
      return o;
    } catch (e) { return null; }
  }
  function daysBetween(a, b) {
    var da = new Date(a.getFullYear(), a.getMonth(), a.getDate()), db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((db - da) / 86400000);
  }
  function renderOccasions() {
    var today = new Date(), list = [];
    var hp = hijriParts(today);
    if (hp) {
      (window.MAJLIS_OCCASIONS || []).forEach(function (o) {
        if (hp.month === o.m && (o.m === 9 || hp.day === o.d)) { list.push({ today: true, text: o.during + (o.m === 9 ? " · " + arDigits(hp.day) + " رمضان" : "") }); return; }
        for (var i = 1; i < 400; i++) {
          var d = new Date(today.getTime() + i * 86400000), p = hijriParts(d);
          if (p && p.month === o.m && p.day === o.d) { list.push({ days: i, text: o.ar }); break; }
        }
      });
    }
    (prefs.events || []).forEach(function (e) {
      var parts = String(e.date || "").split("-");
      if (parts.length !== 3) return;
      var d = new Date(+parts[0], +parts[1] - 1, +parts[2]), n = daysBetween(today, d);
      if (n === 0) list.push({ today: true, text: e.name });
      else if (n > 0) list.push({ days: n, text: e.name, custom: true });
    });
    if (prefs.friday && today.getDay() === 5) list.unshift({ today: true, text: "جمعة مباركة", sub: "سورة الكهف" });
    list.sort(function (a, b) { return (a.today ? -1 : a.days) - (b.today ? -1 : b.days); });
    var html = "";
    list.slice(0, 2).forEach(function (o) {
      if (o.today) html += '<div class="ib-item occ today"><div class="o-name">' + esc(o.text) + '</div><div class="o-days">' + esc(o.sub || "اليوم") + "</div></div>";
      else html += '<div class="ib-item occ"><div class="o-name">' + esc(o.text) + '</div><div class="o-days">' +
        (o.days === 1 ? "غداً" : o.days === 2 ? "بعد يومين" : "بعد <b>" + o.days + "</b> " + (o.days <= 10 ? "أيام" : "يوم")) + "</div></div>";
    });
    $("occasions").innerHTML = html;
  }

  // ---------- Weather (Open-Meteo, no key) ----------
  var WEATHER_AR = { 0: "صحو", 1: "صحو غالباً", 2: "غائم جزئياً", 3: "غائم", 45: "ضباب", 48: "ضباب", 51: "رذاذ", 53: "رذاذ", 55: "رذاذ", 61: "مطر خفيف", 63: "مطر", 65: "مطر غزير", 66: "مطر متجمد", 67: "مطر متجمد", 71: "ثلج", 73: "ثلج", 75: "ثلج", 80: "زخات مطر", 81: "زخات مطر", 82: "زخات غزيرة", 95: "عاصفة رعدية", 96: "عاصفة رعدية", 99: "عاصفة رعدية" };
  function weatherIcon(code, day) {
    var sun = '<circle cx="32" cy="32" r="12" fill="#f5c451"/><g stroke="#f5c451" stroke-width="3" stroke-linecap="round"><path d="M32 6v7M32 51v7M6 32h7M51 32h7M13.6 13.6l5 5M45.4 45.4l5 5M13.6 50.4l5-5M45.4 18.6l5-5"/></g>';
    var moon = '<path d="M40 12a20 20 0 1 0 14 30A16 16 0 1 1 40 12z" fill="#f1e2b6"/>';
    var cloud = '<path d="M20 50h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 50z" fill="#e8e1d4"/>';
    var rain = '<g stroke="#8cc6f0" stroke-width="3" stroke-linecap="round"><path d="M24 54l-3 7M34 54l-3 7M44 54l-3 7"/></g>';
    var bolt = '<path d="M34 46l-6 10h6l-3 8 9-12h-6l4-6z" fill="#f5c451"/>';
    var fog = '<g stroke="#e8e1d4" stroke-width="3" stroke-linecap="round"><path d="M12 30h40M8 40h48M14 50h36"/></g>';
    var body;
    if (code === 0 || code === 1) body = day ? sun : moon;
    else if (code === 2) body = '<g transform="translate(-8 -8) scale(.8)">' + (day ? sun : moon) + "</g>" + cloud;
    else if (code === 3) body = cloud;
    else if (code === 45 || code === 48) body = fog;
    else if (code >= 95) body = cloud + bolt;
    else body = cloud + rain;
    return '<svg viewBox="0 0 64 64">' + body + "</svg>";
  }
  function loadWeather() {
    var c = city();
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + c.lat + "&longitude=" + c.lon +
      "&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=4";
    get(url, function (w) {
      if (!w || !w.current) return;
      var code = w.current.weather_code;
      $("wIcon").innerHTML = weatherIcon(code, w.current.is_day === 1);
      $("wTemp").textContent = Math.round(w.current.temperature_2m) + "°";
      $("wDesc").textContent = (WEATHER_AR[code] || "") + " · " + c.ar;
      if (w.daily) $("wRange").textContent = Math.round(w.daily.temperature_2m_max[0]) + "° / " + Math.round(w.daily.temperature_2m_min[0]) + "°";
      $("weather").classList.remove("hidden");
      if (w.daily && w.daily.time) {
        var html = "";
        for (var i = 1; i < Math.min(4, w.daily.time.length); i++) {
          var dd = new Date(w.daily.time[i] + "T12:00:00");
          html += '<div class="amb-day"><div class="d-name">' + fmt("ar-SA", { weekday: "long" }, dd) + '</div><div class="d-icon">' + weatherIcon(w.daily.weather_code[i], true) + '</div><div class="d-temp">' + Math.round(w.daily.temperature_2m_max[i]) + "° <small>" + Math.round(w.daily.temperature_2m_min[i]) + "°</small></div></div>";
        }
        $("ambForecast").innerHTML = html;
      }
    });
  }
  setInterval(loadWeather, 30 * 60000);

  // ---------- Backgrounds ----------
  var backgrounds = [], photos = [];
  function buildBackgrounds() {
    backgrounds = (window.MAJLIS_BACKGROUNDS || []).map(function (b) { return { key: b.file, file: b.file, ar: b.ar, en: b.en, scrim: b.scrim }; });
    photos.forEach(function (p, i) { backgrounds.push({ key: "photo:" + p.name, photo: p.name, file: SERVICE + "/photos/" + encodeURIComponent(p.name), ar: "صورة " + arDigits(i + 1), en: "Photo " + (i + 1), scrim: 0.45 }); });
  }
  function bgHidden(b) { return (prefs.hiddenBg || []).indexOf(b.key) !== -1; }
  function visibleBgs() { var v = backgrounds.filter(function (b) { return !bgHidden(b); }); return v.length ? v : backgrounds.slice(0, 1); }
  function visibleBg(i, step) {
    var n = backgrounds.length;
    for (var t = 0; t < n; t++) { var j = (((i + t * step) % n) + n) % n; if (!bgHidden(backgrounds[j])) return j; }
    return 0;
  }
  var bgLayer = 0, bgShown = "", lastSlide = Date.now();
  function showBackground(i) {
    if (!backgrounds.length) return;
    i = ((i % backgrounds.length) + backgrounds.length) % backgrounds.length;
    prefs.bg = i;
    var b = backgrounds[i];
    if (b.file === bgShown) return;
    bgShown = b.file;
    var img = new Image();
    img.onload = function () {
      var next = $(bgLayer === 0 ? "bgB" : "bgA"), cur = $(bgLayer === 0 ? "bgA" : "bgB");
      next.style.backgroundImage = "url('" + b.file + "')";
      next.classList.add("on"); cur.classList.remove("on");
      bgLayer = 1 - bgLayer;
      $("scrim").style.opacity = b.scrim == null ? 0.5 : b.scrim;
    };
    img.src = b.file;
  }
  function changeBackground(step) {
    lastSlide = Date.now();
    showBackground(visibleBg(prefs.bg + step, step));
    toast(backgrounds[prefs.bg].ar);
    savePrefs(["bg"]);
  }
  function slideshowTick() {
    if (!prefs.rotate || backgrounds.length < 2) return;
    if (Date.now() - lastSlide >= prefs.rotate * 60000) { lastSlide = Date.now(); showBackground(visibleBg(prefs.bg + 1, 1)); savePrefs(["bg"]); }
  }

  // ---------- Apps ----------
  var BASE = window.HOME_APPS || [], BASE_RANK = {};
  BASE.forEach(function (a, i) { BASE_RANK[a.id] = i; });
  var allApps = [], inputs = window.Platform.inputs((window.HOME_INPUTS || []).slice()), serviceApps = null;
  function mergeApps() {
    var byId = {};
    BASE.forEach(function (a) { byId[a.id] = { id: a.id, title: a.title, icon: a.icon, bg: a.bg }; });
    if (serviceApps) {
      var present = {};
      serviceApps.forEach(function (a) {
        present[a.id] = true;
        if (byId[a.id]) byId[a.id].icon2 = a.icon;
        else byId[a.id] = { id: a.id, title: a.title, icon: a.icon, isNew: true };
      });
      Object.keys(byId).forEach(function (id) { if (!present[id]) delete byId[id]; });
    }
    var order = {};
    (prefs.order || []).forEach(function (id, i) { order[id] = i; });
    allApps = Object.keys(byId).map(function (k) { return byId[k]; });
    allApps.sort(function (a, b) {
      var oa = order[a.id], ob = order[b.id];
      if (oa !== undefined || ob !== undefined) { if (oa === undefined) return 1; if (ob === undefined) return -1; return oa - ob; }
      var ra = BASE_RANK[a.id] !== undefined ? BASE_RANK[a.id] : 5000, rb = BASE_RANK[b.id] !== undefined ? BASE_RANK[b.id] : 5000;
      return ra - rb || a.title.localeCompare(b.title);
    });
  }
  function visibleApps() { return allApps.filter(function (a) { return (prefs.hidden || []).indexOf(a.id) === -1; }); }

  // ---------- Main screen focus ----------
  // rows[0] = actions bar, rows[1] = apps, rows[2] = inputs
  var rows = [], focus = { r: 1, c: 0 };
  function tileFor(item, isInput) {
    var el = document.createElement("div");
    el.className = "tile";
    if (!isInput) {
      var src = item.icon || item.icon2;
      if (src) {
        var img = document.createElement("img");
        img.src = src;
        img.onerror = function () {
          if (item.icon2 && img.src.indexOf(item.icon2) === -1) { img.src = item.icon2; return; }
          el.replaceChild(glyph(item), img);
        };
        el.appendChild(img);
      } else el.appendChild(glyph(item));
    }
    var l = document.createElement("div");
    l.className = "label";
    l.textContent = item.title;
    el.appendChild(l);
    return el;
  }
  function glyph(item) { var g = document.createElement("div"); g.className = "glyph"; g.textContent = (item.title || "?").charAt(0); return g; }

  function buildRow(cls, items, isInput) {
    var row = document.createElement("div");
    row.className = "row " + cls;
    var vp = document.createElement("div"); vp.className = "viewport";
    var track = document.createElement("div"); track.className = "track";
    vp.appendChild(track); row.appendChild(vp);
    var r = { el: row, vp: vp, track: track, items: [], offset: 0 };
    var ri = rows.length;
    items.forEach(function (it, ci) {
      var el = tileFor(it, isInput);
      el.addEventListener("mouseenter", function () { if (!overlayOpen()) setFocus(ri, ci); });
      el.addEventListener("click", function () { setFocus(ri, ci); launch(it); });
      track.appendChild(el);
      r.items.push({ data: it, el: el });
    });
    rows.push(r);
    $("rows").appendChild(row);
  }
  function render() {
    var keep = { r: focus.r, c: focus.c };
    $("rows").textContent = "";
    var actionEls = Array.prototype.slice.call(document.querySelectorAll(".action"));
    rows = [{ items: actionEls.map(function (el) { return { el: el, act: el.getAttribute("data-act") }; }) }];
    buildRow("apps", visibleApps(), false);
    if (inputs.length) buildRow("inputs", inputs, true);
    setFocus(keep.r, keep.c);
  }
  function setFocus(r, c) {
    var old = document.querySelector(".actions .focus, .rows .focus");
    if (old) old.classList.remove("focus");
    r = Math.max(0, Math.min(rows.length - 1, r));
    var row = rows[r];
    if (!row.items.length) return;
    c = Math.max(0, Math.min(row.items.length - 1, c));
    focus = { r: r, c: c };
    var el = row.items[c].el;
    el.classList.add("focus");
    if (!row.vp) return;
    // Keep the focused tile inside the row (works right-to-left too).
    var vr = row.vp.getBoundingClientRect(), er = el.getBoundingClientRect(), pad = 40;
    if (er.left < vr.left + pad) row.offset += (vr.left + pad - er.left);
    else if (er.right > vr.right - pad) row.offset -= (er.right - (vr.right - pad));
    if (c === 0) row.offset = 0;
    row.track.style.transform = "translateX(" + row.offset + "px)";
  }
  function activate() {
    var it = rows[focus.r].items[focus.c];
    if (focus.r === 0) return doAction(it.act);
    launch(it.data);
  }
  function doAction(act) {
    if (act === "radio") openOverlay("radio");
    else if (act === "wifi") openOverlay("wifi");
    else if (act === "ambient") enterAmbient();
    else if (act === "bg") changeBackground(1);
    else if (act === "settings") openOverlay("settings");
  }
  // Rows flow right-to-left, so the Right key moves to the previous item.
  function mainKey(k) {
    if (k === 39) setFocus(focus.r, focus.c - 1);
    else if (k === 37) setFocus(focus.r, focus.c + 1);
    else if (k === 38) setFocus(focus.r - 1, focus.r - 1 === 0 ? 0 : focus.c);
    else if (k === 40) setFocus(focus.r + 1, focus.r === 0 ? 0 : focus.c);
    else if (k === 13) activate();
  }

  // ---------- Overlays ----------
  var openId = "";
  function overlayOpen() { return !!openId; }
  function openOverlay(id) {
    openId = id;
    if (id === "wifi") buildWifi();
    if (id === "radio") { radioFocus = Math.max(0, stationIndex(prefs.radio)); buildStations(); }
    if (id === "settings") { settings.i = 0; settings.offset = 0; get("/api/state", function (s) { if (s) status = s.status || status; buildSettings(); }); buildSettings(); }
    $(id).classList.add("show");
  }
  function closeOverlay() {
    if (!openId) return;
    $(openId).classList.remove("show");
    if (openId === "settings") { mergeApps(); render(); }
    openId = "";
  }

  // Guest Wi-Fi
  function wifiEscape(s) { return String(s).replace(/([\\;,:"])/g, "\\$1"); }
  function buildWifi() {
    var w = prefs.wifi || {};
    var body = $("wifi").querySelector(".wifi-body");
    if (!w.ssid) {
      body.innerHTML = Platform.hasHelper
        ? '<div class="wifi-empty">لم تتم إضافة شبكة بعد.<br>أضفها من لوحة التحكم في الجوال:<br><span class="set-big">' + esc(phoneUrl()) + "</span></div>"
        : '<div class="wifi-empty">لم تتم إضافة شبكة بعد.<br>أضفها في ملف majlis.config.json قبل التركيب.</div>';
      return;
    }
    if (!$("wifiQr")) {
      body.innerHTML = '<div id="wifiQr" class="qr"></div><div class="wifi-info"><div class="wifi-hint">امسح الرمز بكاميرا الجوال للاتصال مباشرة</div><div class="wifi-hint en">Scan with your phone camera to join</div><div class="wifi-label">اسم الشبكة · Network</div><div id="wifiSsid" class="wifi-value"></div><div class="wifi-label">كلمة المرور · Password</div><div id="wifiPass" class="wifi-value pass"></div></div>';
    }
    var type = w.pass ? (w.type || "WPA") : "nopass";
    var data = "WIFI:T:" + type + ";S:" + wifiEscape(w.ssid) + ";" + (w.pass ? "P:" + wifiEscape(w.pass) + ";" : "") + ";";
    try {
      qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
      var q = qrcode(0, "M"); q.addData(data); q.make();
      $("wifiQr").innerHTML = q.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
    } catch (e) { $("wifiQr").textContent = ""; }
    $("wifiSsid").textContent = w.ssid;
    $("wifiPass").textContent = w.pass || "بدون كلمة مرور";
  }

  // Quran radio
  var radioFocus = 0, radioPlaying = "";
  function stationIndex(id) { for (var i = 0; i < STATIONS.length; i++) if (STATIONS[i].id === id) return i; return -1; }
  function buildStations() {
    var html = "";
    STATIONS.forEach(function (s, i) {
      html += '<div class="station' + (s.id === radioPlaying ? " playing" : "") + (i === radioFocus ? " focus" : "") + '"><div class="s-name">' + esc(s.ar) + '</div><div class="s-sub">' + esc(s.sub) + "</div></div>";
    });
    $("stations").innerHTML = html;
  }
  function playStation(s) {
    var a = $("radioAudio");
    if (radioPlaying === s.id) { stopRadio(); return; }
    a.src = s.url;
    var p = a.play();
    if (p && p.catch) p.catch(function () { toast("تعذر تشغيل الإذاعة"); });
    radioPlaying = s.id;
    prefs.radio = s.id; savePrefs(["radio"]);
    $("radioNow").textContent = s.ar;
  }
  function stopRadio() {
    var a = $("radioAudio");
    a.pause(); a.removeAttribute("src"); a.load();
    radioPlaying = "";
    $("radioNow").textContent = "";
  }
  $("radioAudio").addEventListener("error", function () { if (radioPlaying) { toast("انقطع البث"); stopRadio(); } });
  function radioKey(k) {
    var cols = 4, n = STATIONS.length;
    if (k === 39) radioFocus = Math.max(0, radioFocus - 1);
    else if (k === 37) radioFocus = Math.min(n - 1, radioFocus + 1);
    else if (k === 38) radioFocus = Math.max(0, radioFocus - cols);
    else if (k === 40) radioFocus = Math.min(n - 1, radioFocus + cols);
    else if (k === 13) playStation(STATIONS[radioFocus]);
    buildStations();
  }

  // ---------- Settings ----------
  var settings = { items: [], i: 0, offset: 0, deleteArm: null };
  function phoneUrl() { return status.ip ? "http://" + status.ip + ":" + (status.port || 8090) : "…"; }
  function onOff(v) { return v ? "مفعّل" : "متوقف"; }
  function sleepLabel(m) { return !m ? "متوقف" : m === 60 ? "بعد ساعة" : m === 240 ? "بعد ٤ ساعات" : "بعد " + arDigits(m) + " دقيقة"; }
  function buildSettings() {
    var list = $("settingsList");
    list.textContent = "";
    settings.items = [];
    function row(cls, html, onKey) {
      var el = document.createElement("div");
      el.className = "set-row " + (cls || "");
      el.innerHTML = html;
      list.appendChild(el);
      settings.items.push({ el: el, key: onKey });
      return el;
    }
    function head(t) { var h = document.createElement("div"); h.className = "set-head"; h.textContent = t; list.appendChild(h); }
    function toggle(label, sub, key, after) {
      row("", '<div class="set-main">' + label + (sub ? '<div class="set-sub">' + sub + "</div>" : "") + '</div><div class="set-val">' + onOff(prefs[key]) + "</div>", function (k) {
        if (k === 13 || k === 37 || k === 39) { prefs[key] = !prefs[key]; savePrefs([key]); if (after) after(); return true; }
      });
    }
    function chooser(label, sub, valText, onStep) {
      row("", '<div class="set-main">' + label + (sub ? '<div class="set-sub">' + sub + "</div>" : "") + '</div><div class="set-val">‹ ' + valText + " ›</div>", function (k) {
        if (k === 13 || k === 37) { onStep(1); return true; }
        if (k === 39) { onStep(-1); return true; }
      });
    }

    if (Platform.hasHelper) head("لوحة التحكم من الجوال");
    if (Platform.hasHelper) row("info", '<div class="set-main">افتح الرابط من جوالك (على نفس الشبكة) للتحكم بكل شيء: الريموت، الصور، الترحيب، الواي فاي، المناسبات<div class="set-big">' + esc(phoneUrl()) + '</div></div><div class="set-val">الرمز<div class="set-big">' + esc(status.pin || "—") + "</div></div>", null);

    head("عام");
    chooser("الثيم", "ألوان الشاشة", (THEMES.filter(function (t) { return t.id === prefs.theme; })[0] || THEMES[0]).ar, function (s) {
      prefs.theme = cycle(THEMES.map(function (t) { return t.id; }), prefs.theme, s); applyTexts(); savePrefs(["theme"]);
    });
    chooser("وضع الهدوء", "عرض الصور والساعة بعد فترة بدون استخدام", prefs.ambientMin ? "بعد " + arDigits(prefs.ambientMin) + " دقائق" : "متوقف", function (s) {
      prefs.ambientMin = cycle(AMBIENT, prefs.ambientMin, s); savePrefs(["ambientMin"]);
    });
    chooser("تغيير الخلفية تلقائياً", "", prefs.rotate ? "كل " + arDigits(prefs.rotate) + " دقيقة" : "متوقف", function (s) {
      prefs.rotate = cycle(SLIDESHOW, prefs.rotate, s); lastSlide = Date.now(); savePrefs(["rotate"]);
    });
    if (Platform.id === "webos") toggle("زر الرئيسية يفتح هذه الشاشة", "بدل شاشة LG", "takeover");
    if (Platform.id === "webos") chooser("إطفاء تلقائي لحفظ الطاقة", "إذا ما فيه استخدام، مع تنبيه قبلها بدقيقة", sleepLabel(prefs.sleepMin), function (s) {
      prefs.sleepMin = cycle(SLEEP, prefs.sleepMin, s); savePrefs(["sleepMin"]);
    });

    head("الشكل");
    chooser("لون الزخارف", "بدل الذهبي", (ACCENTS.filter(function (a) { return a.id === (prefs.accent || ""); })[0] || ACCENTS[0]).ar, function (s) {
      prefs.accent = cycle(ACCENTS.map(function (a) { return a.id; }), prefs.accent || "", s); applyTexts(); savePrefs(["accent"]);
    });
    chooser("الإطار", "زخرفة حول الشاشة", (FRAMES.filter(function (f) { return f.id === (prefs.frame || "palace"); })[0] || FRAMES[0]).ar, function (s) {
      prefs.frame = cycle(FRAMES.map(function (f) { return f.id; }), prefs.frame || "palace", s); applyTexts(); savePrefs(["frame"]);
    });

    head("الصلاة");
    chooser("المدينة", "لمواقيت الصلاة والطقس", city().ar, function (s) {
      prefs.city = cycle(CITIES.map(function (c) { return c.id; }), prefs.city, s); applyTexts(); computePrayers(); loadWeather(); savePrefs(["city"]);
    });
    toggle("تنبيه وقت الصلاة على هذه الشاشة", "", "alertOverlay");
    toggle("صوت التنبيه", "نغمة هادئة", "chime");
    if (Platform.hasHelper) toggle("إشعار على التلفاز أثناء مشاهدة أي تطبيق", "يظهر فوق نتفليكس ويوتيوب وغيرها", "tvToast");
    if (Platform.hasHelper) chooser("وقت الأذان أثناء مشاهدة تطبيق", "يرجع الوضع بعد الأذان", (ADHAN_ACTIONS.filter(function (a) { return a.id === prefs.adhanAction; })[0] || ADHAN_ACTIONS[0]).ar, function (s) {
      prefs.adhanAction = cycle(ADHAN_ACTIONS.map(function (a) { return a.id; }), prefs.adhanAction || "off", s); savePrefs(["adhanAction"]);
    });
    chooser("صوت الأذان", "بدل النغمة الهادئة", (ADHANS.filter(function (a) { return a.id === prefs.adhanSound; })[0] || { ar: "بدون" }).ar, function (s) {
      prefs.adhanSound = cycle([""].concat(ADHANS.map(function (a) { return a.id; })), prefs.adhanSound || "", s); savePrefs(["adhanSound"]);
    });
    toggle("وضع الجمعة", "تذكير بسورة الكهف وتسمية صلاة الجمعة", "friday", function () { computePrayers(); renderOccasions(); });
    toggle("إذاعة القرآن صباح الجمعة", "تشتغل تلقائياً على شاشة المجلس", "fridayRadio");
    if (Platform.hasHelper) chooser("تذكير قبل الأذان", "إشعار قبل موعد الصلاة", prefs.remind ? arDigits(prefs.remind) + " دقائق" : "متوقف", function (s) {
      prefs.remind = cycle(REMIND, prefs.remind, s); savePrefs(["remind"]);
    });

    head("الخلفيات · موافق: إظهار/إخفاء · ◀ مرتين لحذف صورة");
    backgrounds.forEach(function (b, bi) {
      var hidden = bgHidden(b), armed = settings.deleteArm === b.key;
      var val = armed ? "اضغط ◀ مرة ثانية للحذف" : (hidden ? "مخفية" : "ظاهرة") + (bi === prefs.bg ? " · الحالية" : "");
      row((hidden ? "off" : "") + (armed ? " danger" : ""), '<img class="thumb" src="' + esc(b.file) + '"><div class="set-main">' + esc(b.ar) + '</div><div class="set-val">' + val + "</div>", function (k) {
        if (k === 13) {
          settings.deleteArm = null;
          var h = prefs.hiddenBg.indexOf(b.key);
          if (h === -1) prefs.hiddenBg.push(b.key); else prefs.hiddenBg.splice(h, 1);
          if (backgrounds.indexOf(b) === prefs.bg && bgHidden(b)) showBackground(visibleBg(prefs.bg + 1, 1));
          savePrefs(["hiddenBg", "bg"]); return true;
        }
        if (k === 37 && b.photo) {
          if (settings.deleteArm !== b.key) { settings.deleteArm = b.key; return true; }
          settings.deleteArm = null;
          del("/api/photos/" + encodeURIComponent(b.photo), function () { toast("تم حذف الصورة"); loadState(true); });
          return true;
        }
        if (settings.deleteArm) { settings.deleteArm = null; return true; }
      });
    });

    head("التطبيقات · موافق: إظهار/إخفاء · ◀ ▶: تحريك");
    allApps.forEach(function (a) {
      var hidden = prefs.hidden.indexOf(a.id) !== -1, icon = a.icon || a.icon2;
      row(hidden ? "off" : "", (icon ? '<img src="' + esc(icon) + '">' : "") + '<div class="set-main">' + esc(a.title) + (a.isNew ? ' <span class="new">جديد</span>' : "") + '</div><div class="set-val">' + (hidden ? "مخفي" : "ظاهر") + "</div>", function (k) {
        var idx = allApps.indexOf(a);
        if (k === 13) { var h = prefs.hidden.indexOf(a.id); if (h === -1) prefs.hidden.push(a.id); else prefs.hidden.splice(h, 1); savePrefs(["hidden"]); return true; }
        if (k === 37 || k === 39) {
          var to = idx + (k === 39 ? -1 : 1);
          if (to < 0 || to >= allApps.length) return;
          allApps.splice(idx, 1); allApps.splice(to, 0, a);
          prefs.order = allApps.map(function (x) { return x.id; });
          savePrefs(["order"]);
          settings.i += (k === 39 ? -1 : 1);
          return true;
        }
      });
    });
    row("button", '<div class="set-main" style="text-align:center">تم</div>', function (k) { if (k === 13) closeOverlay(); });

    settings.i = Math.max(0, Math.min(settings.items.length - 1, settings.i));
    while (settings.i < settings.items.length - 1 && !settings.items[settings.i].key) settings.i++;
    settingsFocus();
  }
  function settingsFocus() {
    settings.items.forEach(function (it, i) { it.el.classList.toggle("focus", i === settings.i); });
    var el = settings.items[settings.i].el, vp = $("settingsList").parentNode;
    var top = el.offsetTop, h = el.offsetHeight, vh = vp.clientHeight, pad = 90;
    if (top - settings.offset < pad) settings.offset = Math.max(0, top - pad);
    else if (top + h - settings.offset > vh - pad) settings.offset = top + h - vh + pad;
    $("settingsList").style.transform = "translateY(" + (-settings.offset) + "px)";
  }
  function settingsKey(k) {
    if (k === 38 || k === 40) {
      var i = settings.i;
      do { i += (k === 40 ? 1 : -1); } while (i >= 0 && i < settings.items.length && !settings.items[i].key);
      if (i >= 0 && i < settings.items.length) { settings.i = i; settingsFocus(); }
      return;
    }
    var it = settings.items[settings.i];
    if (it && it.key && it.key(k)) buildSettings();
  }

  // ---------- Calm (ambient) mode ----------
  var idleSince = Date.now(), ambientOn = false, ambLayer = 0, ambIndex = 0, ambTimer = null;
  function enterAmbient() {
    if (ambientOn) return;
    closeOverlay();
    ambientOn = true;
    $("ambient").classList.add("show");
    ambIndex = Math.max(0, visibleBgs().indexOf(backgrounds[prefs.bg]));
    nextAmbientImage();
    ambTimer = setInterval(nextAmbientImage, 40000);
  }
  function nextAmbientImage() {
    var list = visibleBgs();
    if (!list.length) return;
    var b = list[ambIndex % list.length];
    ambIndex++;
    var next = $(ambLayer === 0 ? "ambB" : "ambA"), cur = $(ambLayer === 0 ? "ambA" : "ambB");
    next.style.backgroundImage = "url('" + b.file + "')";
    next.classList.remove("on"); void next.offsetWidth;
    next.classList.toggle("alt", ambIndex % 2 === 0);
    next.classList.add("on"); cur.classList.remove("on");
    ambLayer = 1 - ambLayer;
  }
  function exitAmbient() {
    if (!ambientOn) return;
    ambientOn = false;
    clearInterval(ambTimer);
    $("ambient").classList.remove("show");
  }
  setInterval(function () {
    if (!prefs.ambientMin || ambientOn || document.hidden || alertOpen()) return;
    if (Date.now() - idleSince >= prefs.ambientMin * 60000) enterAmbient();
  }, 15000);

  // ---------- Message card (phone messages, occasions, Friday) ----------
  var shownMessage = 0;
  function msgOpen() { return $("msgCard").classList.contains("show"); }
  function showMessageCard(m) {
    if (!m || m.id === shownMessage) return;
    shownMessage = m.id;
    exitAmbient(); closeOverlay();
    var b = backgrounds[prefs.bg];
    $("msgCard").style.backgroundImage = "radial-gradient(ellipse at 50% 45%, rgba(20, 11, 4, .72), rgba(6, 3, 1, .93) 75%)" + (b ? ", url('" + b.file + "')" : "");
    $("mcText").textContent = m.text || "";
    $("mcSub").textContent = m.sub || "";
    $("msgCard").classList.add("show");
  }
  function hideMessageCard(quiet) {
    if (!msgOpen()) return;
    $("msgCard").classList.remove("show");
    if (!quiet && serviceUp) get("/api/message/dismiss", function () {});
  }
  function maybeShowStatus(st) {
    if (!st) return;
    if (st.sleep && st.sleep.warning) showSleepWarning(st.sleep.until);
    if (st.alertNow && st.alertNow.until > Date.now()) {
      var id = st.alertNow.key + st.alertNow.at;
      if (!alerted[id]) { alerted[id] = true; showPrayerAlert({ ar: st.alertNow.name, time: new Date(st.alertNow.at) }); }
    }
    if (st.message && Date.now() - st.message.at < 15 * 60000) showMessageCard(st.message);
  }

  // ---------- Sleep countdown (the helper decides; we only show it) ----------
  var sleepTimer = null;
  function sleepOpen() { return $("sleepWarn").classList.contains("show"); }
  function showSleepWarning(until) {
    exitAmbient(); hidePrayerAlert(); closeOverlay();
    $("sleepWarn").classList.add("show");
    clearInterval(sleepTimer);
    var upd = function () {
      var s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      $("sleepCount").textContent = s;
      if (s === 0) clearInterval(sleepTimer);
    };
    upd();
    sleepTimer = setInterval(upd, 250);
  }
  function hideSleepWarning() { $("sleepWarn").classList.remove("show"); clearInterval(sleepTimer); }

  // Tell the helper about remote presses here (at most every 20 s).
  var lastReport = 0;
  function reportActivity(force) {
    if (!serviceUp || (!force && Date.now() - lastReport < 20000)) return;
    lastReport = Date.now();
    get("/api/activity", function () {});
  }

  // Live events from the helper: phone changes, prayer, messages, sleep countdown.
  function subscribeEvents() {
    Platform.subscribe(function (e) {
      if (e.sleep && e.sleep.warning) showSleepWarning(e.sleep.until);
      if (e.event === "state") loadState(false);
      else if (e.event === "message") showMessageCard(e.message);
      else if (e.event === "prayer" && e.alert) maybeShowStatus({ alertNow: e.alert });
      else if (e.event === "sleepWarn") showSleepWarning(e.until);
      else if (e.event === "sleepCancel") hideSleepWarning();
    });
  }

  // ---------- Keys ----------
  document.addEventListener("keydown", function (e) {
    var k = e.keyCode;
    idleSince = Date.now();
    e.preventDefault();
    if (sleepOpen()) { hideSleepWarning(); reportActivity(true); return; }
    if (msgOpen()) { hideMessageCard(); return; }
    reportActivity(false);
    if (ambientOn) { exitAmbient(); return; }
    if (alertOpen()) { hidePrayerAlert(); return; }
    if (k === 403) { changeBackground(-1); return; }              // red
    if (k === 404) { changeBackground(1); return; }               // green
    if (k === 405) { if (radioPlaying) stopRadio(); else if (stationIndex(prefs.radio) >= 0) playStation(STATIONS[stationIndex(prefs.radio)]); else openOverlay("radio"); return; } // yellow
    if (k === 406) { if (openId === "wifi") closeOverlay(); else { closeOverlay(); openOverlay("wifi"); } return; } // blue
    if (openId) {
      if (Platform.backKeys.indexOf(k) !== -1) { closeOverlay(); return; }
      if (openId === "radio") radioKey(k);
      else if (openId === "settings") settingsKey(k);
      else if (k === 13) closeOverlay();
      return;
    }
    if ([37, 38, 39, 40, 13].indexOf(k) !== -1) mainKey(k);
  });
  document.addEventListener("mousemove", function () { idleSince = Date.now(); });
  document.querySelectorAll(".action").forEach(function (el, i) {
    el.addEventListener("mouseenter", function () { if (!overlayOpen()) setFocus(0, i); });
    el.addEventListener("click", function () { doAction(el.getAttribute("data-act")); });
  });

  // ---------- Helper service ----------
  function startService(tries) {
    if (!Platform.hasHelper) { localApps(); return; }
    Platform.startHelper();
    get("/api/state", function (s) {
      if (!s) { if (tries < 30) setTimeout(function () { startService(tries + 1); }, 1500); return; }
      if (Platform.checksHelperVersion && s.status && s.status.version !== SERVICE_VERSION && tries < 30) {
        Platform.restartHelper();
        setTimeout(function () { startService(tries + 1); }, 2500);
        return;
      }
      serviceUp = true;
      applyState(s, true);
      sendPrayerPlan();
      syncRamadanDays();
      subscribeEvents();
      maybeShowStatus(s.status);
      refreshApps();
    });
  }
  function applyState(s, force) {
    if (!s) return;
    status = s.status || status;
    if (!force && s.rev === rev) return;
    rev = s.rev;
    var oldCity = prefs.city;
    if (s.prefs) for (var k in s.prefs) prefs[k] = s.prefs[k];
    try { localStorage.setItem("prefs", JSON.stringify(prefs)); } catch (e) {}
    photos = s.photos || [];
    var curKey = backgrounds[prefs.bg] ? backgrounds[prefs.bg].key : null;
    buildBackgrounds();
    applyTexts();
    if (prefs.city !== oldCity || force) { computePrayers(); loadWeather(); }
    renderOccasions();
    bgShown = "";
    showBackground(visibleBg(Math.min(prefs.bg, backgrounds.length - 1), 1));
    if (openId === "wifi") buildWifi();
    if (!openId) { mergeApps(); render(); }
  }
  // Without a helper (Samsung), apps come from the system and settings stay on the TV.
  function localApps() {
    Platform.listApps(function (list) {
      if (!list) return;
      serviceApps = list;
      mergeApps();
      if (!openId) render();
    });
  }
  function loadState(force) { get("/api/state", function (s) { if (s) applyState(s, force); }); }
  function refreshApps() {
    get("/api/apps", function (r) {
      if (!r || !r.apps) return;
      var sig = r.apps.map(function (a) { return a.id; }).join(",");
      if (serviceApps && sig === serviceApps.map(function (a) { return a.id; }).join(",")) return;
      serviceApps = r.apps;
      mergeApps();
      if (!openId) render();
    });
  }
  // Pick up changes made from the phone page.
  setInterval(function () { if (serviceUp) { loadState(false); refreshApps(); } }, 20000);

  function resume() {
    lastMinute = -1; lastDay = -1; idleSince = Date.now();
    if (serviceUp) get("/api/state", function (s) { if (s) maybeShowStatus(s.status); });
    keepVideoPlaying();
    exitAmbient();
    closeOverlay();
    if (serviceUp) { loadState(true); refreshApps(); } else startService(0);
    setFocus(1, 0);
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) resume(); });
  document.addEventListener("webOSRelaunch", resume);

  // ---------- Start ----------
  buildBackgrounds();
  applyTexts();
  mergeApps();
  render();
  setFocus(1, 0);
  showBackground(visibleBg(Math.min(prefs.bg, backgrounds.length - 1), 1));
  tick();
  loadWeather();
  keepVideoPlaying();
  startService(0);
  if (location.hash === "#settings") openOverlay("settings");
  if (location.hash === "#wifi") openOverlay("wifi");
  if (location.hash === "#radio") openOverlay("radio");
  if (location.hash === "#ambient") enterAmbient();
  if (location.hash === "#alert") showPrayerAlert({ ar: "العصر", time: new Date() });
  if (location.hash === "#sleep") showSleepWarning(Date.now() + 60000);
  // Preview links for design work: #look=frame,accent,theme,background
  if (location.hash.indexOf("#look=") === 0) {
    var lk = location.hash.slice(6).split(",");
    prefs.frame = lk[0] || "palace"; prefs.accent = lk[1] || ""; prefs.theme = lk[2] || "gold";
    if (lk[3]) { bgShown = ""; showBackground(+lk[3]); }
    applyTexts();
  }
  if (location.hash === "#settings-demo") { status = { ip: "192.168.1.40", port: 8090, pin: "2580" }; openOverlay("settings"); }
  if (location.hash === "#wifi-demo") { prefs.wifi = { ssid: "Majlis-Guest", pass: "welcome1448", type: "WPA" }; openOverlay("wifi"); }
  if (location.hash === "#msg") showMessageCard({ id: 1, text: "حيّاكم الله", sub: "عزيمة العائلة · العشاء جاهز" });
})();
