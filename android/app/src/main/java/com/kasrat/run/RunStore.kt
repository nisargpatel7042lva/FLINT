package com.kasrat.run

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * The run in progress, on disk.
 *
 * Every fix is appended to a file the moment it arrives, so a run survives the
 * process being killed — which on the phones most of our runners carry
 * (Xiaomi, Oppo, Vivo, Realme) is not an edge case but a Tuesday. If the app
 * comes back and finds a run here that no service is recording, it offers to
 * keep it instead of silently losing a 10 km effort.
 *
 * Points are one line each — `lat,lon,timeMs,accuracy,segment` — because
 * appending a line is atomic enough and rewriting a growing JSON array every
 * three seconds is not.
 */
class RunStore(context: Context) {
  private val dir = File(context.filesDir, "run")
  private val pointsFile = File(dir, "points.csv")
  private val metaFile = File(dir, "meta.json")

  data class Meta(
    val startedAt: Long,
    /** Paused time already banked, excluding any pause still running. */
    val pausedMs: Long,
    /** When the current pause began, or 0 while moving. */
    val pausedSince: Long,
    /** Increments on every resume so a pause is never drawn as a line. */
    val segment: Int,
    val kind: String,
  ) {
    fun toJson(): JSONObject =
      JSONObject()
        .put("startedAt", startedAt)
        .put("pausedMs", pausedMs)
        .put("pausedSince", pausedSince)
        .put("segment", segment)
        .put("kind", kind)
  }

  fun hasRun(): Boolean = metaFile.exists()

  fun readMeta(): Meta? {
    if (!metaFile.exists()) return null
    return try {
      val o = JSONObject(metaFile.readText())
      Meta(
        startedAt = o.getLong("startedAt"),
        pausedMs = o.optLong("pausedMs", 0),
        pausedSince = o.optLong("pausedSince", 0),
        segment = o.optInt("segment", 0),
        kind = o.optString("kind", "run"),
      )
    } catch (e: Exception) {
      null
    }
  }

  fun writeMeta(meta: Meta) {
    dir.mkdirs()
    // Write-then-rename so a kill mid-write never leaves half a file behind.
    val tmp = File(dir, "meta.json.tmp")
    tmp.writeText(meta.toJson().toString())
    tmp.renameTo(metaFile)
  }

  fun begin(meta: Meta) {
    clear()
    dir.mkdirs()
    pointsFile.writeText("")
    writeMeta(meta)
  }

  fun append(p: RunPoint) {
    pointsFile.appendText("${p.lat},${p.lon},${p.time},${p.accuracy},${p.segment},${p.speed}\n")
  }

  fun readPoints(): MutableList<RunPoint> {
    if (!pointsFile.exists()) return mutableListOf()
    val out = mutableListOf<RunPoint>()
    pointsFile.forEachLine { line ->
      val f = line.split(',')
      // 5 fields from builds before speed was recorded, 6 since.
      if (f.size == 5 || f.size == 6) {
        try {
          val speed = if (f.size == 6) f[5].toFloat() else -1f
          out.add(RunPoint(f[0].toDouble(), f[1].toDouble(), f[2].toLong(), f[3].toFloat(), f[4].toInt(), speed))
        } catch (_: NumberFormatException) {
          // A torn last line from a kill mid-append. Everything before it is good.
        }
      }
    }
    return out
  }

  fun clear() {
    pointsFile.delete()
    metaFile.delete()
  }

  companion object {
    fun pointsToJson(points: List<RunPoint>, from: Int): JSONArray {
      val arr = JSONArray()
      for (i in from until points.size) {
        val p = points[i]
        arr.put(JSONArray().put(p.lat).put(p.lon).put(p.time).put(p.accuracy.toDouble()).put(p.segment))
      }
      return arr
    }
  }
}

data class RunPoint(
  val lat: Double,
  val lon: Double,
  val time: Long,
  val accuracy: Float,
  val segment: Int,
  /** Metres per second from the GPS chip, or -1 when it reported none. */
  val speed: Float = -1f,
)
