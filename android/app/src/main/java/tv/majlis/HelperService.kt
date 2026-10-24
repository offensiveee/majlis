package tv.majlis

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.URL
import kotlin.random.Random

/**
 * The Android counterpart of src/service/service.js: serves the phone app and the same
 * JSON API on port 8090, keeps settings and photos, and handles prayer alerts while
 * another app is on screen.
 */
class HelperService : Service() {

    private val main = Handler(Looper.getMainLooper())
    private lateinit var server: HttpServer
    private lateinit var prefsFile: File
    private lateinit var photosDir: File
    private var prefs = JSONObject()
    private var rev = 1
    private var prayers = JSONArray()          // [{key, name, at}] sent by the home screen
    private var alertNow: JSONObject? = null
    private var message: JSONObject? = null
    private val log = ArrayList<String>()
    private val firedEvents = HashSet<String>()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        goForeground()
        prefsFile = File(filesDir, "prefs.json")
        photosDir = File(filesDir, "photos").apply { mkdirs() }
        prefs = try { JSONObject(prefsFile.readText()) } catch (e: Exception) { JSONObject() }
        if (!prefs.has("pin")) { prefs.put("pin", (1000 + Random.nextInt(9000)).toString()); savePrefs() }
        server = HttpServer(PORT, ::handle).also { it.start() }
        main.postDelayed(object : Runnable {
            override fun run() { checkEvents(); main.postDelayed(this, 20_000) }
        }, 20_000)
        note("helper started")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() { server.shutdown(); super.onDestroy() }

    private fun goForeground() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val n: Notification = if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "Majlis", NotificationManager.IMPORTANCE_MIN))
            Notification.Builder(this, CHANNEL)
        } else {
            @Suppress("DEPRECATION") Notification.Builder(this)
        }.setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Majlis").setContentText("Phone control is on").build()
        if (Build.VERSION.SDK_INT >= 34) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        else startForeground(1, n)
    }

    // ---------- Settings ----------
    private fun savePrefs() { prefsFile.writeText(prefs.toString()); rev++ }
    private fun publicPrefs(): JSONObject = JSONObject(prefs.toString()).apply { remove("pin") }
    private fun pin(): String = prefs.optString("pin")
    private fun note(s: String) { synchronized(log) { log.add(s); if (log.size > 40) log.removeAt(0) } }

    private fun push(event: JSONObject) { MainActivity.visible?.sendEvent(event.put("returnValue", true)) }

    // ---------- HTTP API ----------
    private fun handle(r: HttpServer.Request): HttpServer.Response {
        val p = r.path
        val allowed = r.local || r.query["pin"] == pin()
        fun json(v: Any, code: Int = 200) = HttpServer.Response.json(v.toString(), code)

        when {
            r.method == "OPTIONS" -> return HttpServer.Response(204, "text/plain", ByteArray(0))
            p == "/" || p == "/index.html" -> return asset("phone/index.html", "text/html; charset=utf-8")
            p == "/manifest.json" -> return HttpServer.Response(200, "application/manifest+json", MANIFEST.toByteArray())
            p.startsWith("/assets/") -> return asset("phone/assets/" + File(p).name, null)
            p.startsWith("/builtin/") -> return asset("app/backgrounds/" + File(p).name, "image/jpeg")
            p.startsWith("/photos/") -> {
                val f = File(photosDir, File(p).name)
                return if (f.exists()) HttpServer.Response(200, if (f.name.endsWith(".png")) "image/png" else "image/jpeg", f.readBytes())
                else json(JSONObject().put("error", "not found"), 404)
            }
            p.startsWith("/icon/") -> {
                val png = Apps.iconPng(this, java.net.URLDecoder.decode(p.removePrefix("/icon/"), "UTF-8"))
                return if (png != null) HttpServer.Response(200, "image/png", png) else json(JSONObject().put("error", "no icon"), 404)
            }
            p == "/api/state" -> return json(JSONObject().put("rev", rev).put("prefs", publicPrefs()).put("photos", listPhotos()).put("status", status(r.local)))
            p == "/api/data" -> return asset("data.json", "application/json")
            p == "/api/apps" -> {
                val apps = JSONArray()
                Apps.list(this).forEach { apps.put(JSONObject().put("id", it.id).put("title", it.title).put("icon", "http://127.0.0.1:$PORT/icon/" + it.id)) }
                return json(JSONObject().put("apps", apps).put("inputs", JSONArray()))
            }
            p == "/api/check" -> return json(JSONObject().put("ok", allowed), if (allowed) 200 else 403)
            p == "/api/photos" && r.method == "GET" -> return json(listPhotos())
        }

        // From here on the request changes something: TV itself or the PIN.
        if (r.local) when (p) {
            "/api/prayers" -> { prayers = JSONObject(r.text()).optJSONArray("list") ?: JSONArray(); schedulePrayers(); return json(JSONObject().put("ok", true)) }
            "/api/message/dismiss" -> { message = null; return json(JSONObject().put("ok", true)) }
            "/api/alertDone" -> { main.post { finishAdhan() }; return json(JSONObject().put("ok", true)) }
            "/api/activity" -> return json(JSONObject().put("ok", true))
        }
        if (!allowed) return json(JSONObject().put("error", "الرمز غير صحيح"), 403)

        when {
            p == "/api/prefs" && r.method == "POST" -> {
                val v = JSONObject(r.text())
                v.keys().forEach { k -> if (k != "pin") prefs.put(k, v.get(k)) }
                savePrefs()
                push(JSONObject().put("event", "state").put("rev", rev))
                return json(JSONObject().put("ok", true).put("rev", rev))
            }
            p == "/api/photos" && r.method == "POST" -> {
                if (r.body.isEmpty()) return json(JSONObject().put("error", "فشل الرفع"), 400)
                return json(JSONObject().put("ok", true).put("name", savePhoto(r.body, r.headers["content-type"].orEmpty().contains("png"))))
            }
            p == "/api/photos/url" && r.method == "POST" -> {
                val url = JSONObject(r.text()).optString("url")
                if (!url.startsWith("http")) return json(JSONObject().put("error", "الرابط لازم يبدأ بـ http"), 400)
                return try {
                    val c = URL(url).openConnection() as HttpURLConnection
                    c.connectTimeout = 15000; c.readTimeout = 15000
                    val type = c.contentType.orEmpty()
                    if (!type.startsWith("image/")) json(JSONObject().put("error", "الرابط ليس صورة"), 400)
                    else json(JSONObject().put("ok", true).put("name", savePhoto(c.inputStream.readBytes(), type.contains("png"))))
                } catch (e: Exception) { json(JSONObject().put("error", "تعذر التحميل"), 400) }
            }
            p.startsWith("/api/photos/") && r.method == "DELETE" -> {
                File(photosDir, File(p).name).delete(); rev++
                push(JSONObject().put("event", "state").put("rev", rev))
                return json(JSONObject().put("ok", true))
            }
            p == "/api/remote" -> {
                val button = r.query["button"].orEmpty().uppercase()
                val a = MainActivity.visible
                if (button == "HOME" || a == null && button != "BACK") { openHome(); return json(JSONObject().put("ok", true)) }
                val code = KEYS[button] ?: return json(JSONObject().put("ok", false))
                a?.sendKey(code)
                return json(JSONObject().put("ok", a != null))
            }
            p == "/api/home" -> { openHome(); return json(JSONObject().put("ok", true)) }
            p == "/api/volume" -> return json(volume(r.query["action"].orEmpty(), r.query["on"] != "0"))
            p == "/api/launch" -> { val ok = Apps.launch(this, r.query["id"].orEmpty()); return json(JSONObject().put("ok", ok), if (ok) 200 else 500) }
            p == "/api/toast" -> {
                val v = JSONObject(r.text())
                main.post { showMessage(v.optString("message"), v.optString("sub"), "message", v.optBoolean("fullscreen")) }
                return json(JSONObject().put("ok", true))
            }
            p == "/api/power" -> return json(JSONObject().put("error", "غير مدعوم على أندرويد"), 501)
        }
        return json(JSONObject().put("error", "not found"), 404)
    }

    private fun asset(path: String, type: String?): HttpServer.Response = try {
        val bytes = assets.open(path).readBytes()
        val t = type ?: when {
            path.endsWith(".png") -> "image/png"; path.endsWith(".woff2") -> "font/woff2"; path.endsWith(".svg") -> "image/svg+xml"
            else -> "application/octet-stream"
        }
        HttpServer.Response(200, t, bytes)
    } catch (e: Exception) { HttpServer.Response.json("{\"error\":\"not found\"}", 404) }

    private fun listPhotos(): JSONArray = JSONArray().apply {
        photosDir.listFiles()?.filter { it.name.matches(Regex(".*\\.(jpe?g|png)$")) }?.sortedBy { it.name }?.forEach { put(JSONObject().put("name", it.name)) }
    }

    private fun savePhoto(bytes: ByteArray, png: Boolean): String {
        val name = "photo-" + System.currentTimeMillis() + if (png) ".png" else ".jpg"
        File(photosDir, name).writeBytes(bytes); rev++
        push(JSONObject().put("event", "state").put("rev", rev))
        return name
    }

    private fun status(local: Boolean): JSONObject {
        val now = System.currentTimeMillis()
        val next = JSONArray()
        for (i in 0 until prayers.length()) {
            val o = prayers.getJSONObject(i)
            if (o.optLong("at") > now && next.length() < 6) next.put(JSONObject().put("key", o.optString("key")).put("name", o.optString("name")).put("at", isoTime(o.optLong("at"))))
        }
        return JSONObject()
            .put("version", "android-1").put("platform", "android").put("ip", ip()).put("port", PORT)
            .put("pin", if (local) pin() else JSONObject.NULL)
            .put("power", "Active")
            .put("nowApp", if (MainActivity.visible != null) JSONObject().put("id", packageName).put("title", "شاشة المجلس") else JSONObject.NULL)
            .put("prayers", next).put("alertNow", alertNow ?: JSONObject.NULL).put("message", message ?: JSONObject.NULL)
            .put("capabilities", JSONObject().put("power", false).put("sleep", false).put("lgMenu", false).put("remoteEverywhere", false))
            .put("log", JSONArray(synchronized(log) { log.toList() }))
    }

    private fun isoTime(ms: Long): String {
        val f = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
        f.timeZone = java.util.TimeZone.getTimeZone("UTC")
        return f.format(java.util.Date(ms))
    }

    private fun ip(): String {
        try {
            for (ni in NetworkInterface.getNetworkInterfaces()) for (a in ni.inetAddresses)
                if (!a.isLoopbackAddress && a is Inet4Address) return a.hostAddress ?: ""
        } catch (e: Exception) { }
        return ""
    }

    private fun openHome() {
        main.post { startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)) }
    }

    // ---------- Volume ----------
    private fun volume(action: String, on: Boolean): JSONObject {
        val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val s = AudioManager.STREAM_MUSIC
        when (action) {
            "up" -> am.adjustStreamVolume(s, AudioManager.ADJUST_RAISE, 0)
            "down" -> am.adjustStreamVolume(s, AudioManager.ADJUST_LOWER, 0)
            "mute" -> am.adjustStreamVolume(s, if (on) AudioManager.ADJUST_MUTE else AudioManager.ADJUST_UNMUTE, 0)
        }
        val max = am.getStreamMaxVolume(s).coerceAtLeast(1)
        val pct = am.getStreamVolume(s) * 100 / max
        val muted = Build.VERSION.SDK_INT >= 23 && am.isStreamMute(s)
        return JSONObject().put("volume", pct).put("muteStatus", muted)
            .put("volumeStatus", JSONObject().put("volume", pct).put("muteStatus", muted))
    }

    // ---------- Prayer alerts over other apps ----------
    private val prayerTimers = ArrayList<Runnable>()

    private fun schedulePrayers() = main.post {
        prayerTimers.forEach { main.removeCallbacks(it) }
        prayerTimers.clear()
        val now = System.currentTimeMillis()
        val remind = prefs.optInt("remind", 10) * 60_000L
        for (i in 0 until prayers.length()) {
            val o = prayers.getJSONObject(i)
            val at = o.optLong("at"); val name = o.optString("name"); val key = o.optString("key")
            if (at > now) later(at - now) { atPrayer(key, name, at) }
            if (remind > 0 && at - remind > now) later(at - remind - now) {
                if (prefs.optBoolean("tvToast", true) && MainActivity.visible == null) toast("⏳ باقي " + arabicDigits(prefs.optInt("remind", 10)) + " دقائق على أذان " + name)
            }
        }
        note("prayers planned: ${prayers.length()}")
    }

    private fun later(delay: Long, block: () -> Unit) {
        val r = Runnable(block); prayerTimers.add(r); main.postDelayed(r, delay)
    }

    private var focusRequest: AudioFocusRequest? = null
    private var savedVolume = -1
    private var adhanPlayer: MediaPlayer? = null
    private val finishRunnable = Runnable { finishAdhan() }

    private fun atPrayer(key: String, name: String, at: Long) {
        alertNow = JSONObject().put("key", key).put("name", name).put("at", at).put("until", at + 4 * 60_000)
        if (MainActivity.visible != null) { push(JSONObject().put("event", "prayer").put("alert", alertNow)); return }
        if (prefs.optBoolean("tvToast", true)) toast("🕌 حان الآن موعد أذان $name")
        val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        when (prefs.optString("adhanAction", "off")) {
            "pause" -> {
                requestFocus(am)
                adhanUrl()?.let { url ->
                    adhanPlayer = MediaPlayer().apply {
                        setAudioStreamType(AudioManager.STREAM_MUSIC)
                        setDataSource(url)
                        setOnPreparedListener { it.start() }
                        setOnCompletionListener { main.postDelayed({ finishAdhan() }, 5000) }
                        setOnErrorListener { _, _, _ -> true }
                        prepareAsync()
                    }
                }
            }
            "lower" -> {
                val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
                val target = max * prefs.optInt("adhanLowerTo", 5) / 100
                savedVolume = am.getStreamVolume(AudioManager.STREAM_MUSIC)
                if (savedVolume > target) am.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0) else savedVolume = -1
            }
        }
        main.removeCallbacks(finishRunnable)
        main.postDelayed(finishRunnable, 4 * 60_000)
        note("prayer $key")
    }

    private fun adhanUrl(): String? {
        val id = prefs.optString("adhanSound")
        if (id.isEmpty()) return null
        return try {
            val list = JSONObject(assets.open("data.json").readBytes().toString(Charsets.UTF_8)).optJSONArray("adhans") ?: return null
            (0 until list.length()).map { list.getJSONObject(it) }.firstOrNull { it.optString("id") == id }?.optString("url")
        } catch (e: Exception) { null }
    }

    @Suppress("DEPRECATION")
    private fun requestFocus(am: AudioManager) {
        if (Build.VERSION.SDK_INT >= 26) {
            val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setOnAudioFocusChangeListener { }.build()
            focusRequest = req
            am.requestAudioFocus(req)
        } else am.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
    }

    /** Ends the adhan: the other app gets audio focus back (and usually resumes), the volume comes back. */
    @Suppress("DEPRECATION")
    private fun finishAdhan() {
        main.removeCallbacks(finishRunnable)
        alertNow = null
        adhanPlayer?.let { try { it.stop() } catch (e: Exception) { }; it.release() }
        adhanPlayer = null
        val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (Build.VERSION.SDK_INT >= 26) focusRequest?.let { am.abandonAudioFocusRequest(it) } else am.abandonAudioFocus(null)
        focusRequest = null
        if (savedVolume >= 0) { am.setStreamVolume(AudioManager.STREAM_MUSIC, savedVolume, 0); savedVolume = -1 }
    }

    // ---------- Messages and occasions ----------
    private fun showMessage(text: String, sub: String, kind: String, fullscreen: Boolean) {
        message = JSONObject().put("id", System.currentTimeMillis()).put("text", text.take(160)).put("sub", sub.take(200))
            .put("kind", kind).put("at", System.currentTimeMillis())
        if (MainActivity.visible != null) { push(JSONObject().put("event", "message").put("message", message)); return }
        toast((if (sub.isNotEmpty()) "$text · $sub" else text))
        if (fullscreen) openHome()
    }

    private fun checkEvents() {
        val now = System.currentTimeMillis()
        val events = prefs.optJSONArray("events") ?: return
        for (i in 0 until events.length()) {
            val e = events.getJSONObject(i)
            val at = e.optLong("at"); val id = "$at" + e.optString("name")
            if (at == 0L || firedEvents.contains(id) || now < at || now - at > 120_000) continue
            firedEvents.add(id)
            showMessage(prefs.optString("welcome", "حيّاكم الله"), e.optString("name"), "event", e.optBoolean("fullscreen"))
        }
    }

    private fun toast(text: String) = main.post { Toast.makeText(this, text, Toast.LENGTH_LONG).show() }

    private fun arabicDigits(n: Int): String = n.toString().map { if (it in '0'..'9') "٠١٢٣٤٥٦٧٨٩"[it - '0'] else it }.joinToString("")

    companion object {
        const val PORT = 8090
        private const val CHANNEL = "majlis"
        private val KEYS = mapOf("UP" to 38, "DOWN" to 40, "LEFT" to 37, "RIGHT" to 39, "ENTER" to 13, "BACK" to 461,
            "RED" to 403, "GREEN" to 404, "YELLOW" to 405, "BLUE" to 406)
        private const val MANIFEST = "{\"name\":\"مجلس\",\"short_name\":\"المجلس\",\"start_url\":\"/\",\"display\":\"standalone\",\"dir\":\"rtl\",\"lang\":\"ar\"," +
            "\"background_color\":\"#120a05\",\"theme_color\":\"#120a05\",\"icons\":[{\"src\":\"/assets/icon-192.png\",\"sizes\":\"192x192\",\"type\":\"image/png\"},{\"src\":\"/assets/icon-512.png\",\"sizes\":\"512x512\",\"type\":\"image/png\"}]}"

        fun start(context: Context) {
            val i = Intent(context, HelperService::class.java)
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(i) else context.startService(i)
        }
    }
}
