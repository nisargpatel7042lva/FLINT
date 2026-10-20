package com.kasrat.alerts

import java.util.Calendar

/**
 * The club board and block ownership, for the background alert check.
 *
 * Copies of `functions/src/board.ts` and `functions/src/city.ts` (which are
 * themselves copies of the app's rules, held together by parity tests). The
 * alert check runs with the app closed, so it cannot call into JS; if these
 * ever disagree with the app, the alert names a different winner than the map.
 * Change one, change all three.
 */

data class ClubRun(val uid: String, val distanceKm: Double, val day: String, val createdAtMs: Long)

data class CityRun(val clubId: String, val clubName: String, val cells: List<String>, val createdAtMs: Long)

data class Owner(var clubId: String, var clubName: String, var runs: Int, val counts: MutableMap<String, Int>)

object ClubLogic {
  private const val DAY_MS = 24 * 60 * 60 * 1000L
  const val CITY_WINDOW_DAYS = 7

  private fun dayKey(c: Calendar) =
    "%04d-%02d-%02d".format(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))

  fun todayKey(now: Long): String = dayKey(Calendar.getInstance().apply { timeInMillis = now })

  /** Monday of the week containing [now], as yyyy-MM-dd. */
  fun weekStartKey(now: Long): String {
    val c = Calendar.getInstance().apply { timeInMillis = now }
    val sinceMonday = (c.get(Calendar.DAY_OF_WEEK) + 5) % 7
    c.add(Calendar.DAY_OF_MONTH, -sinceMonday)
    return dayKey(c)
  }

  /** The week's board, best first. Ties go to whoever got there first. */
  fun weeklyBoard(runs: List<ClubRun>, weekStart: String): List<String> {
    data class Entry(val uid: String, var km: Double, var last: Long)
    val byUid = LinkedHashMap<String, Entry>()
    runs.filter { it.day >= weekStart }.forEach { r ->
      val e = byUid.getOrPut(r.uid) { Entry(r.uid, 0.0, 0L) }
      e.km += r.distanceKm
      if (r.createdAtMs > e.last) e.last = r.createdAtMs
    }
    return byUid.values
      .map { it.also { e -> e.km = Math.round(e.km * 100) / 100.0 } }
      .sortedWith(compareByDescending<Entry> { it.km }.thenBy { it.last }.thenBy { it.uid })
      .map { it.uid }
  }

  /**
   * Who went from behind [me] to ahead of [me] between the two boards.
   *
   * Somebody who has not run this week is not on the board and is never
   * "passed" — the same rule the server used.
   */
  fun passedMe(before: List<String>, after: List<String>, me: String): List<String> {
    val iBefore = before.indexOf(me)
    val iAfter = after.indexOf(me)
    if (iBefore == -1 || iAfter == -1) return emptyList()
    val aheadBefore = before.subList(0, iBefore).toSet()
    return after.subList(0, iAfter).filter { it != me && it !in aheadBefore }
  }

  /**
   * Block owners over the last week: most runs through a block wins, and a
   * challenger must go strictly ahead. A run through a block twice counts once.
   */
  fun owners(runs: List<CityRun>, now: Long): Map<String, Owner> {
    val since = now - CITY_WINDOW_DAYS * DAY_MS
    val out = HashMap<String, Owner>()
    runs.sortedBy { it.createdAtMs }.forEach { run ->
      if (run.createdAtMs < since || run.createdAtMs > now) return@forEach
      run.cells.toSet().forEach { cell ->
        val block = out[cell]
        if (block == null) {
          out[cell] = Owner(run.clubId, run.clubName, 1, mutableMapOf(run.clubId to 1))
        } else {
          val mine = (block.counts[run.clubId] ?: 0) + 1
          block.counts[run.clubId] = mine
          if (run.clubId == block.clubId) {
            block.runs = mine
            block.clubName = run.clubName
          } else if (mine > block.runs) {
            block.clubId = run.clubId
            block.clubName = run.clubName
            block.runs = mine
          }
        }
      }
    }
    return out
  }

  /** Blocks [club] held before and another club holds now, by the club that took them. */
  fun lostBy(before: Map<String, Owner>, after: Map<String, Owner>, club: String): Map<String, Pair<String, Int>> {
    val out = HashMap<String, Pair<String, Int>>()
    before.forEach { (cell, was) ->
      if (was.clubId != club) return@forEach
      val now = after[cell] ?: return@forEach
      if (now.clubId == club) return@forEach
      val prev = out[now.clubId]
      out[now.clubId] = now.clubName to ((prev?.second ?: 0) + 1)
    }
    return out
  }
}
