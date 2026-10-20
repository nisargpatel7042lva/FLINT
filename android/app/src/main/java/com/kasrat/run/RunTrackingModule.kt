package com.kasrat.run

import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap

/**
 * JS access to the run recorder.
 *
 * JS pulls points rather than having them pushed: while the app is in the
 * background JS may be asleep, and a pushed event fired then is simply gone.
 * Pulling with an offset means the screen catches up on everything the moment
 * it wakes, with no gap.
 */
class RunTrackingModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName() = "FlintRunTracker"

  @ReactMethod
  fun start(kind: String, promise: Promise) {
    try {
      RunSession.begin(ctx, kind, System.currentTimeMillis())
      RunTrackingService.start(ctx)
      promise.resolve(status())
    } catch (e: Exception) {
      // Android refuses a foreground service started from the background.
      RunSession.finish(ctx)
      promise.reject("start_failed", e.message, e)
    }
  }

  /** Restarts recording for a run recovered from disk after the app died. */
  @ReactMethod
  fun ensureRecording(promise: Promise) {
    try {
      RunSession.ensureLoaded(ctx)
      if (RunSession.isActive()) RunTrackingService.start(ctx)
      promise.resolve(status())
    } catch (e: Exception) {
      promise.reject("start_failed", e.message, e)
    }
  }

  @ReactMethod
  fun pause(promise: Promise) {
    RunSession.pause(ctx, System.currentTimeMillis())
    promise.resolve(status())
  }

  @ReactMethod
  fun resume(promise: Promise) {
    RunSession.resume(ctx, System.currentTimeMillis())
    promise.resolve(status())
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    RunSession.ensureLoaded(ctx)
    promise.resolve(status())
  }

  /** Points from index [from] on, as `[lat, lon, timeMs, accuracy, segment]`. */
  @ReactMethod
  fun pointsSince(from: Int, promise: Promise) {
    RunSession.ensureLoaded(ctx)
    val out = Arguments.createArray()
    RunSession.pointsSince(from).forEach { p ->
      out.pushArray(
        Arguments.createArray().apply {
          pushDouble(p.lat)
          pushDouble(p.lon)
          pushDouble(p.time.toDouble())
          pushDouble(p.accuracy.toDouble())
          pushInt(p.segment)
          pushDouble(p.speed.toDouble())
        },
      )
    }
    promise.resolve(out)
  }

  /** Stops recording and clears the run. JS already holds the points. */
  @ReactMethod
  fun finish(promise: Promise) {
    val ended = RunSession.finish(ctx)
    RunTrackingService.stop(ctx)
    promise.resolve(ended != null)
  }

  @ReactMethod
  fun isBatteryUnrestricted(promise: Promise) {
    val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
    promise.resolve(pm.isIgnoringBatteryOptimizations(ctx.packageName))
  }

  /**
   * Opens the system list where the user can exempt Flint from battery
   * optimisation. A list, not the one-tap dialog: the dialog needs a permission
   * Play only grants to a narrow set of app types.
   */
  @ReactMethod
  fun openBatterySettings(promise: Promise) {
    try {
      val intent =
        Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  private fun status(): WritableMap {
    val m = RunSession.meta()
    return Arguments.createMap().apply {
      putBoolean("active", m != null)
      putBoolean("paused", (m?.pausedSince ?: 0L) != 0L)
      putDouble("startedAt", (m?.startedAt ?: 0L).toDouble())
      putDouble("pausedMs", (m?.pausedMs ?: 0L).toDouble())
      putDouble("pausedSince", (m?.pausedSince ?: 0L).toDouble())
      putString("kind", m?.kind ?: "run")
      putInt("count", RunSession.pointCount())
    }
  }
}
