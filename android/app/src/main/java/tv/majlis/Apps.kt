package tv.majlis

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import java.io.ByteArrayOutputStream

/** The TV's launchable apps, their icons, and opening them. */
object Apps {

    data class App(val id: String, val title: String)

    fun list(context: Context): List<App> {
        val pm = context.packageManager
        val seen = LinkedHashMap<String, App>()
        for (category in listOf(Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER)) {
            val intent = Intent(Intent.ACTION_MAIN).addCategory(category)
            @Suppress("DEPRECATION")
            for (info in pm.queryIntentActivities(intent, 0)) {
                val pkg = info.activityInfo.packageName
                if (pkg == context.packageName || seen.containsKey(pkg)) continue
                seen[pkg] = App(pkg, info.loadLabel(pm).toString())
            }
        }
        return seen.values.sortedBy { it.title.lowercase() }
    }

    fun launch(context: Context, id: String): Boolean {
        val pm = context.packageManager
        val intent = pm.getLeanbackLaunchIntentForPackage(id) ?: pm.getLaunchIntentForPackage(id) ?: return false
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try { context.startActivity(intent); true } catch (e: Exception) { false }
    }

    private val iconCache = HashMap<String, ByteArray>()

    /** PNG of the app's TV banner (or its icon), for the home screen and the phone. */
    fun iconPng(context: Context, id: String): ByteArray? = synchronized(iconCache) {
        iconCache[id]?.let { return it }
        val pm = context.packageManager
        val drawable: Drawable = try {
            pm.getApplicationIcon(id)
        } catch (e: PackageManager.NameNotFoundException) { return null }
        val png = toPng(drawable, 192, 192)
        iconCache[id] = png
        png
    }

    private fun toPng(d: Drawable, w: Int, h: Int): ByteArray {
        val bitmap = if (d is BitmapDrawable && d.bitmap != null) d.bitmap else {
            val b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val c = Canvas(b)
            d.setBounds(0, 0, w, h)
            d.draw(c)
            b
        }
        val out = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
        return out.toByteArray()
    }
}
