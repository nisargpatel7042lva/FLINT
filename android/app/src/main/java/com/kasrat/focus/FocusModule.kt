package com.kasrat.focus

import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.provider.Settings
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.TimeUnit

/**
 * JS access to the doom-scroll check and the push-up counter's sensor.
 *
 * Two small things in one module because both are "the phone notices what
 * your body is doing": one sees too much scrolling, the other sees a chest
 * coming down to the floor.
 */
class FocusModule(private val ctx: ReactApplicationContext) :
  ReactContextBaseJavaModule(ctx), SensorEventListener {

  override fun getName() = "FlintFocus"

  // ── Doom-scroll check ────────────────────────────────────────────────────

  @ReactMethod
  fun getStatus(promise: Promise) {
    val prefs = DoomScrollPrefs(ctx)
    promise.resolve(
      Arguments.createMap().apply {
        putBoolean("enabled", prefs.enabled)
        putBoolean("hasUsageAccess", DoomScrollPrefs.hasUsageAccess(ctx))
      },
    )
  }

  /** Turns the periodic check on or off, and records which voice to use. */
  @ReactMethod
  fun setEnabled(enabled: Boolean, savage: Boolean, promise: Promise) {
    val prefs = DoomScrollPrefs(ctx)
    prefs.enabled = enabled
    prefs.savage = savage
    val wm = WorkManager.getInstance(ctx)
    if (enabled) {
      wm.enqueueUniquePeriodicWork(
        DoomScrollWorker.UNIQUE_NAME,
        ExistingPeriodicWorkPolicy.UPDATE,
        PeriodicWorkRequestBuilder<DoomScrollWorker>(15, TimeUnit.MINUTES).build(),
      )
    } else {
      wm.cancelUniqueWork(DoomScrollWorker.UNIQUE_NAME)
    }
    promise.resolve(true)
  }

  /** The system screen where the user grants Usage access to Flint. */
  @ReactMethod
  fun openUsageAccessSettings(promise: Promise) {
    try {
      val intent =
        Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
          .setData(Uri.parse("package:${ctx.packageName}"))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      // Some OEMs reject the package-scoped form; the plain list still works.
      try {
        ctx.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        promise.resolve(true)
      } catch (e2: Exception) {
        promise.resolve(false)
      }
    }
  }

  // ── Push-up counter (proximity sensor) ───────────────────────────────────

  private val sensors by lazy { ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager }
  private var proximity: Sensor? = null

  @ReactMethod
  fun hasProximity(promise: Promise) {
    promise.resolve(sensors.getDefaultSensor(Sensor.TYPE_PROXIMITY) != null)
  }

  /** Starts sending `FlintProximity` events: `{ near: boolean }`. */
  @ReactMethod
  fun startProximity(promise: Promise) {
    val s = sensors.getDefaultSensor(Sensor.TYPE_PROXIMITY)
    if (s == null) {
      promise.resolve(false)
      return
    }
    proximity = s
    sensors.registerListener(this, s, SensorManager.SENSOR_DELAY_GAME)
    promise.resolve(true)
  }

  @ReactMethod
  fun stopProximity(promise: Promise) {
    sensors.unregisterListener(this)
    proximity = null
    promise.resolve(true)
  }

  override fun onSensorChanged(event: SensorEvent) {
    val s = proximity ?: return
    // Most proximity sensors are binary: 0 when covered, max range when not.
    val near = event.values[0] < minOf(s.maximumRange, 5f)
    ctx.emitDeviceEvent("FlintProximity", Arguments.createMap().apply { putBoolean("near", near) })
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  /**
   * Keeps the screen on while a set is in progress. The phone lies under the
   * person's chest; if the screen timed out halfway through, the counter
   * would go quiet with them mid-rep.
   */
  @ReactMethod
  fun setKeepAwake(on: Boolean, promise: Promise) {
    val activity = ctx.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    activity.runOnUiThread {
      if (on) {
        activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      } else {
        activity.window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      }
    }
    promise.resolve(true)
  }

  // Required by NativeEventEmitter on the JS side.
  @ReactMethod fun addListener(eventName: String) {}

  @ReactMethod fun removeListeners(count: Int) {}

  override fun invalidate() {
    sensors.unregisterListener(this)
    super.invalidate()
  }
}
