package com.kasrat.alerts

import android.content.Context

/** What the background alert check has already seen, and where to look. */
class AlertPrefs(ctx: Context) {
  private val p = ctx.getSharedPreferences("flint_alerts", Context.MODE_PRIVATE)

  val uid: String? get() = p.getString("uid", null)

  /** Starts an account's history at [now], so the first check is not a flood of old news. */
  fun resetFor(uid: String, now: Long) {
    val regions = this.regions
    p.edit().clear().putString("uid", uid).putLong("pokesSeen", now).putLong("cityRunsSeen", now)
      .putLong("startedAt", now).putStringSet("regions", regions.toSet()).apply()
  }

  private val startedAt: Long get() = p.getLong("startedAt", System.currentTimeMillis())

  var pokesSeen: Long
    get() = p.getLong("pokesSeen", startedAt)
    set(v) = p.edit().putLong("pokesSeen", v).apply()

  var cityRunsSeen: Long
    get() = p.getLong("cityRunsSeen", startedAt)
    set(v) = p.edit().putLong("cityRunsSeen", v).apply()

  fun clubRunsSeen(club: String): Long = p.getLong("clubRuns_$club", startedAt)

  fun setClubRunsSeen(club: String, v: Long) = p.edit().putLong("clubRuns_$club", v).apply()

  fun passedDay(club: String): String? = p.getString("passedDay_$club", null)

  fun setPassedDay(club: String, day: String) = p.edit().putString("passedDay_$club", day).apply()

  fun stealAt(club: String): Long = p.getLong("stealAt_$club", 0L)

  fun setStealAt(club: String, v: Long) = p.edit().putLong("stealAt_$club", v).apply()

  /** City regions around where this person runs; set by the app's map. */
  var regions: List<String>
    get() = p.getStringSet("regions", emptySet())!!.sorted()
    set(v) = p.edit().putStringSet("regions", v.toSet()).apply()
}
