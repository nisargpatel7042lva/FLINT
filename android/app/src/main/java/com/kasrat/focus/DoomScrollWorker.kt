package com.kasrat.focus

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.kasrat.MainActivity
import com.kasrat.R
import java.util.Calendar

/**
 * Notices doom scrolling and calls it out.
 *
 * Every 15 minutes (the shortest period Android allows for background work)
 * this reads how long short-video and social apps were in the foreground over
 * the last 20 minutes. Past [THRESHOLD_MS] it posts one notification daring
 * the person to drop and do push-ups — tapping it opens the push-up counter.
 *
 * Guardrails:
 *   - opt-in twice: the in-app switch, and Android's own "Usage access"
 *     permission, which only the user can grant in Settings;
 *   - at most once an hour, and never between 22:00 and 07:00;
 *   - nothing leaves the phone. Usage data is read here and thrown away.
 */
class DoomScrollWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

  override suspend fun doWork(): Result {
    val ctx = applicationContext
    val prefs = DoomScrollPrefs(ctx)
    if (!prefs.enabled || !DoomScrollPrefs.hasUsageAccess(ctx)) return Result.success()

    val now = System.currentTimeMillis()
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    if (hour >= 22 || hour < 7) return Result.success()
    if (now - prefs.lastAlertAt < COOLDOWN_MS) return Result.success()

    val scrolled = foregroundMs(ctx, now - WINDOW_MS, now)
    if (scrolled < THRESHOLD_MS) return Result.success()

    prefs.lastAlertAt = now
    notify(ctx, (scrolled / 60_000).toInt(), prefs.savage)
    return Result.success()
  }

  /** Foreground time of the watched apps in [from, to), from usage events. */
  private fun foregroundMs(ctx: Context, from: Long, to: Long): Long {
    val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val events = usm.queryEvents(from, to)
    val openedAt = HashMap<String, Long>()
    var total = 0L
    val e = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(e)
      val pkg = e.packageName ?: continue
      if (pkg !in WATCHED) continue
      when (e.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED -> openedAt[pkg] = e.timeStamp
        UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> {
          val start = openedAt.remove(pkg) ?: from
          total += (e.timeStamp - start).coerceAtLeast(0)
        }
      }
    }
    // Still open right now: count up to the present.
    openedAt.values.forEach { total += (to - it).coerceAtLeast(0) }
    return total
  }

  private fun notify(ctx: Context, minutes: Int, savage: Boolean) {
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL) == null) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL, "Doom scroll check", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "A nudge when you have been scrolling for a while."
        },
      )
    }
    val open =
      PendingIntent.getActivity(
        ctx,
        7,
        Intent(Intent.ACTION_VIEW, Uri.parse("flint://pushups?from=scroll"), ctx, MainActivity::class.java)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
    val title = if (savage) "$minutes minutes of scrolling. Really?" else "$minutes minutes of scrolling"
    val body =
      if (savage) "Doom scrolling is making you lazy. Drop and give me 15 push-ups. Right now."
      else "Time to move? 15 push-ups resets the brain. Tap and Flint will count them."
    nm.notify(
      NOTIFICATION_ID,
      NotificationCompat.Builder(ctx, CHANNEL)
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setContentIntent(open)
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .build(),
    )
  }

  companion object {
    const val UNIQUE_NAME = "flint-doom-scroll"
    private const val CHANNEL = "doom_scroll"
    private const val NOTIFICATION_ID = 4108
    private const val WINDOW_MS = 20 * 60 * 1000L
    private const val THRESHOLD_MS = 15 * 60 * 1000L
    private const val COOLDOWN_MS = 60 * 60 * 1000L

    /** Short-video and social feeds. Messaging apps are deliberately absent. */
    val WATCHED =
      setOf(
        "com.instagram.android",
        "com.google.android.youtube",
        "com.facebook.katana",
        "com.snapchat.android",
        "com.twitter.android",
        "com.zhiliaoapp.musically",
        "in.mohalla.video",
        "in.mohalla.sharechat",
        "com.eterno.shortvideos",
        "com.reddit.frontpage",
      )
  }
}
