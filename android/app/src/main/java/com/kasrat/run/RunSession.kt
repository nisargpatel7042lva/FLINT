package com.kasrat.run

import android.content.Context
import android.os.Handler
import android.os.Looper
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * The one run in progress, shared by the service that records it and the
 * module that reports it to JS.
 *
 * Process-wide on purpose: both live in the app process, and a single source
 * of truth is what stops the notification and the screen disagreeing about how
 * far somebody has gone. Everything is mirrored to [RunStore] so the state
 * outlives the process.
 */
object RunSession {
  private val lock = Any()
  private var store: RunStore? = null
  private var meta: RunStore.Meta? = null
  private val points = mutableListOf<RunPoint>()
  private var distanceKm = 0.0
  /** Last position that counted as a real move: what wobble is measured against. */
  private var anchor: RunPoint? = null
  private val main = Handler(Looper.getMainLooper())

  /** The recording service, told when pause state changes. */
  @Volatile var listener: (() -> Unit)? = null

  private fun storeFor(context: Context): RunStore =
    store ?: RunStore(context.applicationContext).also { store = it }

  /** Loads a run left on disk by a previous process, if memory has none. */
  fun ensureLoaded(context: Context) {
    synchronized(lock) {
      if (meta != null) return
      val s = storeFor(context)
      meta = s.readMeta() ?: return
      points.clear()
      points.addAll(s.readPoints())
      distanceKm = measure(points)
    }
  }

  fun begin(context: Context, kind: String, now: Long) {
    synchronized(lock) {
      val m = RunStore.Meta(startedAt = now, pausedMs = 0, pausedSince = 0, segment = 0, kind = kind)
      storeFor(context).begin(m)
      meta = m
      points.clear()
      distanceKm = 0.0
      anchor = null
    }
  }

  fun record(context: Context, lat: Double, lon: Double, time: Long, accuracy: Float, speed: Float) {
    synchronized(lock) {
      val m = meta ?: return
      if (m.pausedSince != 0L) return
      val p = RunPoint(lat, lon, time, accuracy, m.segment, speed)
      // The notification's running total only; JS recomputes properly, with
      // smoothing. Same "real move" rule, so standing still adds nothing here
      // either and the notification never disagrees wildly with the screen.
      val a = anchor
      if (a == null || a.segment != p.segment) {
        anchor = p
      } else if (isRealMove(a, p)) {
        val step = haversineKm(a, p)
        val seconds = (p.time - a.time) / 1000.0
        if (seconds > 0 && step * 1000 / seconds <= 25) distanceKm += step
        anchor = p
      }
      points.add(p)
      storeFor(context).append(p)
    }
  }

  fun pause(context: Context, now: Long) {
    synchronized(lock) {
      val m = meta ?: return
      if (m.pausedSince != 0L) return
      meta = m.copy(pausedSince = now).also { storeFor(context).writeMeta(it) }
    }
    notifyListener()
  }

  fun resume(context: Context, now: Long) {
    synchronized(lock) {
      val m = meta ?: return
      if (m.pausedSince == 0L) return
      meta =
        m.copy(
          pausedMs = m.pausedMs + (now - m.pausedSince),
          pausedSince = 0,
          segment = m.segment + 1,
        ).also { storeFor(context).writeMeta(it) }
    }
    notifyListener()
  }

  /** Ends the run and hands back everything recorded. */
  fun finish(context: Context): Pair<RunStore.Meta, List<RunPoint>>? {
    synchronized(lock) {
      ensureLoaded(context)
      val m = meta ?: return null
      val out = points.toList()
      storeFor(context).clear()
      meta = null
      points.clear()
      distanceKm = 0.0
      anchor = null
      return m to out
    }
  }

  fun isActive(): Boolean = synchronized(lock) { meta != null }

  fun isPaused(): Boolean = synchronized(lock) { (meta?.pausedSince ?: 0L) != 0L }

  fun distanceKm(): Double = synchronized(lock) { distanceKm }

  fun meta(): RunStore.Meta? = synchronized(lock) { meta }

  fun pointsSince(from: Int): List<RunPoint> =
    synchronized(lock) { if (from >= points.size) emptyList() else points.subList(from.coerceAtLeast(0), points.size).toList() }

  fun pointCount(): Int = synchronized(lock) { points.size }

  /**
   * Base time for the notification's chronometer, shifted by paused time so it
   * shows moving time — the same clock the run screen shows.
   */
  fun chronometerBase(): Long = synchronized(lock) {
    val m = meta ?: return System.currentTimeMillis()
    m.startedAt + m.pausedMs
  }

  private fun notifyListener() {
    val l = listener ?: return
    main.post { l() }
  }

  private fun measure(list: List<RunPoint>): Double {
    var total = 0.0
    var a: RunPoint? = null
    for (b in list) {
      val from = a
      if (from == null || from.segment != b.segment) {
        a = b
        continue
      }
      if (!isRealMove(from, b)) continue
      val step = haversineKm(from, b)
      val seconds = (b.time - from.time) / 1000.0
      if (seconds > 0 && step * 1000 / seconds <= 25) total += step
      a = b
    }
    anchor = a
    return total
  }

  /** Mirrors isRealMove in location.ts: past the fix's error radius, and twice that when the chip says still. */
  private fun isRealMove(a: RunPoint, b: RunPoint): Boolean {
    val metres = haversineKm(a, b) * 1000
    val radius = minOf(maxOf(a.accuracy, b.accuracy).toDouble(), 30.0)
    var threshold = maxOf(10.0, radius)
    if (b.speed >= 0f && b.speed < 0.5f) threshold *= 2
    return metres > threshold
  }

  private fun haversineKm(a: RunPoint, b: RunPoint): Double {
    val r = 6371.0
    val dLat = Math.toRadians(b.lat - a.lat)
    val dLon = Math.toRadians(b.lon - a.lon)
    val h =
      sin(dLat / 2).pow(2) +
        sin(dLon / 2).pow(2) * cos(Math.toRadians(a.lat)) * cos(Math.toRadians(b.lat))
    return 2 * r * asin(sqrt(h))
  }
}
