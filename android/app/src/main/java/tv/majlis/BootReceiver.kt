package tv.majlis

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Starts the helper after the TV boots, so the phone app and prayer alerts work straight away. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) HelperService.start(context)
    }
}
