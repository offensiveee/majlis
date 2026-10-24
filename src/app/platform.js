// The one place that knows which TV system the screen is running on.
// app.js only talks to window.Platform.
//
//   webos    LG webOS: Luna bus + the helper service on the TV
//   android  Android TV / Google TV / Fire TV: the Majlis Android app (MajlisAndroid bridge + its helper)
//   tizen    Samsung Tizen: no background helper, so settings stay on the TV
//   browser  npm run preview
(function () {
  "use strict";
  var P = { helper: "http://127.0.0.1:8090", backKeys: [461, 8, 27, 10009] };
  P.id = window.PalmServiceBridge ? "webos" : window.MajlisAndroid ? "android" : window.tizen ? "tizen" : "browser";
  P.hasHelper = P.id === "webos" || P.id === "android";

  // ---------- webOS Luna bus ----------
  var bridges = [];
  P.luna = function (uri, params, cb) {
    if (P.id !== "webos") { if (cb) cb(null); return null; }
    var b = new window.PalmServiceBridge();
    bridges.push(b);
    b.onservicecallback = function (msg) {
      if (!params || !params.subscribe) bridges.splice(bridges.indexOf(b), 1);
      var r = null; try { r = JSON.parse(msg); } catch (e) {}
      if (cb) cb(r);
    };
    b.call(uri, JSON.stringify(params || {}));
    return b;
  };

  // ---------- Opening apps ----------
  P.launch = function (item, onError) {
    try {
      if (P.id === "webos") {
        P.luna("luna://com.webos.applicationManager/launch", { id: item.id }, function (r) { if (r && r.returnValue === false && onError) onError(); });
      } else if (P.id === "android") {
        if (!window.MajlisAndroid.launch(item.id) && onError) onError();
      } else if (P.id === "tizen") {
        window.tizen.application.launch(item.id, function () {}, function () { if (onError) onError(); });
      } else if (onError) onError();
    } catch (e) { if (onError) onError(); }
  };

  // Apps for systems without a helper (Samsung). Others get them from the helper.
  P.listApps = function (cb) {
    if (P.id !== "tizen") { cb(null); return; }
    try {
      window.tizen.application.getAppsInfo(function (list) {
        cb(list.filter(function (a) { return a.show !== false && a.id.indexOf("majlis") === -1; })
          .map(function (a) { return { id: a.id, title: a.name, icon: a.iconPath }; }));
      }, function () { cb(null); });
    } catch (e) { cb(null); }
  };

  // TV inputs only make sense on webOS, where they are apps of their own.
  P.inputs = function (defaults) { return P.id === "webos" || P.id === "browser" ? defaults : []; };

  // ---------- Helper ----------
  var APP_ID = "com.majlis.tv";
  P.startHelper = function () { P.luna("luna://" + APP_ID + ".service/start", {}, function () {}); };
  P.restartHelper = function () { P.luna("luna://" + APP_ID + ".service/quit", {}, function () {}); };
  P.checksHelperVersion = P.id === "webos";

  // Live events from the helper (phone changes, prayer, messages, sleep).
  var eventsBridge = null;
  P.subscribe = function (onEvent) {
    if (P.id === "android") { window.__majlisEvent = onEvent; return; }
    if (P.id !== "webos" || eventsBridge) return;
    eventsBridge = P.luna("luna://" + APP_ID + ".service/events", { subscribe: true }, function (e) {
      if (e && e.returnValue === false) { eventsBridge = null; setTimeout(function () { P.subscribe(onEvent); }, 5000); return; }
      if (e) onEvent(e);
    });
  };

  // ---------- Screen on, keys ----------
  P.keepAwake = function () {
    if (P.id === "tizen") { try { window.tizen.power.request("SCREEN", "SCREEN_NORMAL"); } catch (e) {} }
    // webOS: app.js keeps a silent video playing. Android: the app keeps the screen on itself.
  };
  if (P.id === "tizen") {
    ["ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue"].forEach(function (k) {
      try { window.tizen.tvinputdevice.registerKey(k); } catch (e) {}
    });
  }
  // The Android app forwards Back and the colour buttons with this.
  window.__majlisKey = function (code) {
    var e = document.createEvent("Event");
    e.initEvent("keydown", true, true);
    e.keyCode = code; e.which = code;
    document.dispatchEvent(e);
  };

  window.Platform = P;
})();
