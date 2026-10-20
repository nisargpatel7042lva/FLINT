package com.kasrat.alerts

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

/**
 * Debug builds only. Runs the club alert check now instead of in ~15 minutes:
 *   adb shell am broadcast -n com.kasrat/com.kasrat.alerts.CheckNowReceiver
 */
class CheckNowReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    WorkManager.getInstance(context).enqueue(OneTimeWorkRequestBuilder<AlertCheckWorker>().build())
  }
}
