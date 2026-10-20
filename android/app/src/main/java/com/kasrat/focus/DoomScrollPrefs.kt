package com.kasrat.focus

import android.app.AppOpsManager
import android.content.Context
import android.os.Build
import android.os.Process

/** The doom-scroll check's settings, kept natively so the worker can read them with no JS running. */
class DoomScrollPrefs(context: Context) {
  private val prefs = context.getSharedPreferences("flint_focus", Context.MODE_PRIVATE)

  var enabled: Boolean
    get() = prefs.getBoolean("enabled", false)
    set(v) = prefs.edit().putBoolean("enabled", v).apply()

  var savage: Boolean
    get() = prefs.getBoolean("savage", false)
    set(v) = prefs.edit().putBoolean("savage", v).apply()

  var lastAlertAt: Long
    get() = prefs.getLong("lastAlertAt", 0L)
    set(v) = prefs.edit().putLong("lastAlertAt", v).apply()

  companion object {
    /** Whether the user has granted Usage access to Flint in Settings. */
    fun hasUsageAccess(context: Context): Boolean {
      val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        } else {
          @Suppress("DEPRECATION")
          ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        }
      return mode == AppOpsManager.MODE_ALLOWED
    }
  }
}
