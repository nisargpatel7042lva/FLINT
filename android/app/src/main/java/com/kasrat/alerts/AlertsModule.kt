package com.kasrat.alerts

import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.google.firebase.auth.FirebaseAuth
import java.util.concurrent.TimeUnit

/** JS switch for the background club alerts ([AlertCheckWorker]). */
class AlertsModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName() = "FlintAlerts"

  /**
   * Makes sure the check is scheduled for the signed-in account. Safe to call
   * on every launch: an existing schedule is kept, not restarted.
   */
  @ReactMethod
  fun start(promise: Promise) {
    val uid = FirebaseAuth.getInstance().currentUser?.uid
    if (uid == null) {
      promise.resolve(false)
      return
    }
    val prefs = AlertPrefs(ctx)
    if (prefs.uid != uid) prefs.resetFor(uid, System.currentTimeMillis())
    WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
      AlertCheckWorker.UNIQUE_NAME,
      ExistingPeriodicWorkPolicy.KEEP,
      PeriodicWorkRequestBuilder<AlertCheckWorker>(15, TimeUnit.MINUTES)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .build(),
    )
    promise.resolve(true)
  }

  /** The city regions to watch for steals: where this person's map is centred. */
  @ReactMethod
  fun setRegions(regions: ReadableArray, promise: Promise) {
    val list = (0 until regions.size()).mapNotNull { regions.getString(it) }
    if (list.isNotEmpty()) AlertPrefs(ctx).regions = list
    promise.resolve(true)
  }

  /** On log out: stop checking. The next account starts its own history. */
  @ReactMethod
  fun stop(promise: Promise) {
    WorkManager.getInstance(ctx).cancelUniqueWork(AlertCheckWorker.UNIQUE_NAME)
    promise.resolve(true)
  }
}
