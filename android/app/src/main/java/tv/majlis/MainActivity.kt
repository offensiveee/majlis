package tv.majlis

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

/**
 * Full-screen home screen: the same web app as on LG (assets/app), in a WebView.
 * The Android-only parts are the MajlisAndroid bridge below and the key forwarding.
 */
class MainActivity : Activity() {

    private lateinit var web: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        HelperService.start(this)

        val assets = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this).apply {
            setBackgroundColor(0xFF140C07.toInt())
            isFocusable = true
            isFocusableInTouchMode = true
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            addJavascriptInterface(Bridge(), "MajlisAndroid")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assets.shouldInterceptRequest(request.url)
            }
            systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        }
        setContentView(web)
        web.loadUrl("https://appassets.androidplatform.net/assets/app/index.html")
        web.requestFocus()
    }

    override fun onResume() {
        super.onResume()
        visible = this
        web.evaluateJavascript("document.dispatchEvent(new Event('webOSRelaunch'))", null)
    }

    override fun onPause() {
        if (visible === this) visible = null
        super.onPause()
    }

    // Opened again from Home or from the phone: just come back to the front.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        web.evaluateJavascript("document.dispatchEvent(new Event('webOSRelaunch'))", null)
    }

    /** Back and the colour buttons don't reach web pages on Android; forward them with LG's key codes. */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val code = when (event.keyCode) {
            KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_ESCAPE -> 461
            KeyEvent.KEYCODE_PROG_RED -> 403
            KeyEvent.KEYCODE_PROG_GREEN -> 404
            KeyEvent.KEYCODE_PROG_YELLOW -> 405
            KeyEvent.KEYCODE_PROG_BLUE -> 406
            else -> return super.dispatchKeyEvent(event)
        }
        if (event.action == KeyEvent.ACTION_DOWN) sendKey(code)
        return true // we are the home screen: Back never leaves it
    }

    fun sendKey(code: Int) {
        runOnUiThread { web.evaluateJavascript("window.__majlisKey && window.__majlisKey($code)", null) }
    }

    fun sendEvent(event: JSONObject) {
        val js = "window.__majlisEvent && window.__majlisEvent(" + event.toString() + ")"
        runOnUiThread { web.evaluateJavascript(js, null) }
    }

    inner class Bridge {
        @JavascriptInterface
        fun launch(id: String): Boolean = Apps.launch(this@MainActivity, id)
    }

    companion object {
        /** The activity while it is on screen, so the helper can talk to the page. */
        @Volatile var visible: MainActivity? = null
    }
}
