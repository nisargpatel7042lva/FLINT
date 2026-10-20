package com.kasrat.alerts

import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.Source
import com.kasrat.MainActivity
import com.kasrat.R
import java.util.concurrent.TimeUnit

/**
 * Club alerts with the app closed, and no server.
 *
 * The push functions need Firebase's paid plan. This does their job from the
 * phone instead: every 15 minutes or so (Android decides; Doze can stretch it)
 * it reads Firestore as the signed-in user — the same reads the open app makes,
 * under the same security rules — and posts a local notification for anything
 * new since the last look:
 *   - a nudge or challenge sent to you;
 *   - someone in your club passing you on this week's board (once a club a day);
 *   - another club taking your club's blocks (once a club every 6 hours).
 *
 * Nothing is sent anywhere. Each source keeps its own "seen up to" mark, so a
 * check that fails halfway repeats nothing and misses nothing next time.
 */
class AlertCheckWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

  override fun doWork(): Result {
    val ctx = applicationContext
    val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return Result.success()
    val prefs = AlertPrefs(ctx)
    if (prefs.uid != uid) {
      // A different account on this phone: start its history from now.
      prefs.resetFor(uid, System.currentTimeMillis())
      return Result.success()
    }
    val db = FirebaseFirestore.getInstance()
    // The open app already pops a banner for each of these.
    val quiet = appInForeground()

    return try {
      val me = get(db.document("users/$uid").get(Source.SERVER))
      val savage = me.getString("tone") == "savage"
      val groups =
        get(db.collection("groups").whereArrayContains("memberIds", uid).get(Source.SERVER)).documents

      checkPokes(db, uid, prefs, quiet)
      checkPassed(db, uid, groups, prefs, savage, quiet)
      checkSteals(db, groups, prefs, savage, quiet)
      Result.success()
    } catch (e: Exception) {
      // Offline, or a timeout. The marks did not move, so next time catches up.
      Log.w(TAG, "alert check failed", e)
      Result.retry()
    }
  }

  private fun checkPokes(db: FirebaseFirestore, uid: String, prefs: AlertPrefs, quiet: Boolean) {
    val since = prefs.pokesSeen
    val docs =
      get(
        db.collection("pokes")
          .whereEqualTo("toUid", uid)
          .orderBy("createdAt", Query.Direction.DESCENDING)
          .limit(10)
          .get(Source.SERVER),
      ).documents
    val fresh = docs.filter { ms(it) > since && it.getBoolean("read") != true }
    if (fresh.isEmpty()) return
    prefs.pokesSeen = fresh.maxOf { ms(it) }
    if (quiet) return

    fresh.take(3).forEach { p ->
      val from = p.getString("fromUid") ?: return@forEach
      val name = nameOf(db, from)
      val (title, body) = AlertCopy.poke(p.getString("kind") ?: "poke", name, p.id)
      post(p.id.hashCode(), title, body, "flint://inbox")
    }
  }

  private fun checkPassed(
    db: FirebaseFirestore,
    uid: String,
    groups: List<DocumentSnapshot>,
    prefs: AlertPrefs,
    savage: Boolean,
    quiet: Boolean,
  ) {
    val now = System.currentTimeMillis()
    val weekStart = ClubLogic.weekStartKey(now)
    val today = ClubLogic.todayKey(now)
    groups.forEach { g ->
      val since = prefs.clubRunsSeen(g.id)
      val runs =
        get(db.collection("groups/${g.id}/runs").whereGreaterThanOrEqualTo("day", weekStart).get(Source.SERVER))
          .documents
          .mapNotNull { d ->
            val u = d.getString("uid") ?: return@mapNotNull null
            val km = d.getDouble("distanceKm") ?: return@mapNotNull null
            val day = d.getString("day") ?: return@mapNotNull null
            ClubRun(u, km, day, ms(d))
          }
      val newest = runs.maxOfOrNull { it.createdAtMs } ?: return@forEach
      if (newest <= since) return@forEach
      prefs.setClubRunsSeen(g.id, newest)

      val before = ClubLogic.weeklyBoard(runs.filter { it.createdAtMs <= since }, weekStart)
      val after = ClubLogic.weeklyBoard(runs, weekStart)
      val passers = ClubLogic.passedMe(before, after, uid)
      if (passers.isEmpty() || quiet || prefs.passedDay(g.id) == today) return@forEach
      prefs.setPassedDay(g.id, today)

      val club = g.getString("name") ?: "your club"
      val (title, body) = AlertCopy.passed(nameOf(db, passers.first()), club, savage)
      post(("passed_" + g.id).hashCode(), title, body, "flint://squad")
    }
  }

  private fun checkSteals(
    db: FirebaseFirestore,
    groups: List<DocumentSnapshot>,
    prefs: AlertPrefs,
    savage: Boolean,
    quiet: Boolean,
  ) {
    val regions = prefs.regions.take(30)
    if (regions.isEmpty() || groups.isEmpty()) return
    val now = System.currentTimeMillis()
    val since = prefs.cityRunsSeen
    val windowStart = Timestamp(java.util.Date(now - ClubLogic.CITY_WINDOW_DAYS * 24 * 60 * 60 * 1000L))
    val runs =
      get(
        db.collection("cityRuns")
          .whereIn("region", regions)
          .whereGreaterThanOrEqualTo("createdAt", windowStart)
          .get(Source.SERVER),
      ).documents.mapNotNull { d ->
        val club = d.getString("clubId") ?: return@mapNotNull null
        @Suppress("UNCHECKED_CAST")
        val cells = (d.get("cells") as? List<Any?>)?.filterIsInstance<String>() ?: return@mapNotNull null
        CityRun(club, d.getString("clubName") ?: "A club", cells, ms(d))
      }
    val newest = runs.maxOfOrNull { it.createdAtMs } ?: return
    if (newest <= since) return
    prefs.cityRunsSeen = newest
    if (quiet) return

    val mine = groups.map { it.id }.toSet()
    val was = ClubLogic.owners(runs.filter { it.createdAtMs <= since }, now)
    val is_ = ClubLogic.owners(runs, now)
    groups.forEach { g ->
      // Blocks lost to a club you are also in are not news to you.
      val lost = ClubLogic.lostBy(was, is_, g.id).filterKeys { it !in mine }
      val (thiefId, taken) = lost.maxByOrNull { it.value.second } ?: return@forEach
      if (now - prefs.stealAt(g.id) < SIX_HOURS) return@forEach
      prefs.setStealAt(g.id, now)
      val (title, body) =
        AlertCopy.steal(taken.first, g.getString("name") ?: "your club", taken.second, savage)
      post(("steal_" + g.id + thiefId).hashCode(), title, body, "flint://city")
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private fun <T> get(task: Task<T>): T = Tasks.await(task, 20, TimeUnit.SECONDS)

  private fun ms(d: DocumentSnapshot): Long = d.getTimestamp("createdAt")?.toDate()?.time ?: 0L

  private val names = HashMap<String, String>()

  private fun nameOf(db: FirebaseFirestore, uid: String): String =
    names.getOrPut(uid) {
      try {
        get(db.document("profiles/$uid").get()).getString("name")?.takeIf { it.isNotBlank() } ?: "A friend"
      } catch (e: Exception) {
        "A friend"
      }
    }

  private fun appInForeground(): Boolean {
    val info = ActivityManager.RunningAppProcessInfo()
    ActivityManager.getMyMemoryState(info)
    return info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
  }

  private fun post(id: Int, title: String, body: String, link: String) {
    val ctx = applicationContext
    if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) return
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL) == null) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL, "Club alerts", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Nudges, challenges, and rivals taking your spot or your blocks."
        },
      )
    }
    val open =
      PendingIntent.getActivity(
        ctx,
        id,
        Intent(Intent.ACTION_VIEW, Uri.parse(link), ctx, MainActivity::class.java)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
    nm.notify(
      id,
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
    const val UNIQUE_NAME = "flint-club-alerts"
    private const val TAG = "FlintAlerts"
    private const val CHANNEL = "club_alerts"
    private const val SIX_HOURS = 6 * 60 * 60 * 1000L
  }
}
