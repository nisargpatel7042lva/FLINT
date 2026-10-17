package com.kasrat.run

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.kasrat.MainActivity
import com.kasrat.R

/**
 * Records a run while the screen is off.
 *
 * Without this, Android stops delivering location to a backgrounded app within
 * seconds, and every runner locks their phone and puts it in a pocket. A
 * foreground service is the sanctioned way to keep going: it shows an ongoing
 * notification, so the user can always see that Flint is using GPS and tap
 * through to stop it.
 *
 * The JS side stays the authority on what counts — it still runs the teleport
 * and jitter filters over these points. This only has to make sure no fix is
 * missed, and that none is lost if the process dies.
 */
class RunTrackingService : Service() {

  private val fused by lazy { LocationServices.getFusedLocationProviderClient(this) }
  private var lastNotified = 0L

  private val callback =
    object : LocationCallback() {
      override fun onLocationResult(result: LocationResult) {
        result.locations.forEach { loc ->
          if (loc.hasAccuracy() && loc.accuracy > MAX_ACCURACY_M) return@forEach
          RunSession.record(this@RunTrackingService, loc.latitude, loc.longitude, loc.time, loc.accuracy)
        }
        refreshNotification(force = false)
      }
    }

  override fun onBind(intent: Intent?): IBinder? = null

  /**
   * Pause and resume arrive through [RunSession] rather than as intents.
   *
   * Starting a service from the background is restricted on Android 12+, and a
   * pause pressed on the lock screen's way back into the app can land in that
   * window. A listener has no such restriction.
   */
  private val onChange = {
    if (RunSession.isActive()) {
      if (RunSession.isPaused()) stopUpdates() else startUpdates()
      refreshNotification(force = true)
    }
  }

  override fun onCreate() {
    super.onCreate()
    RunSession.listener = onChange
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // A null intent is the system restarting us after a kill. The run is
    // recovered from disk either way.
    RunSession.ensureLoaded(this)

    // Foreground first, unconditionally: Android kills a service that was
    // started as foreground and does not promote itself within seconds.
    goForeground()

    if (!RunSession.isActive()) {
      ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
      stopSelf()
      return START_NOT_STICKY
    }

    if (RunSession.isPaused()) stopUpdates() else startUpdates()
    refreshNotification(force = true)
    // Sticky: if Android kills us mid-run, it brings us back and we carry on.
    return START_STICKY
  }

  override fun onDestroy() {
    if (RunSession.listener === onChange) RunSession.listener = null
    stopUpdates()
    super.onDestroy()
  }

  private fun hasPermission(): Boolean =
    ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
      PackageManager.PERMISSION_GRANTED ||
      ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) ==
      PackageManager.PERMISSION_GRANTED

  private var updating = false

  private fun startUpdates() {
    if (updating || !hasPermission()) return
    val request =
      LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS)
        .setMinUpdateIntervalMillis(FASTEST_MS)
        .setMinUpdateDistanceMeters(MIN_DISTANCE_M)
        .setWaitForAccurateLocation(false)
        .build()
    try {
      fused.requestLocationUpdates(request, callback, Looper.getMainLooper())
      updating = true
    } catch (e: SecurityException) {
      updating = false
    }
  }

  private fun stopUpdates() {
    if (!updating) return
    fused.removeLocationUpdates(callback)
    updating = false
  }

  private fun goForeground() {
    ensureChannel()
    val type =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
    ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type)
  }

  private fun refreshNotification(force: Boolean) {
    val now = System.currentTimeMillis()
    // Redrawing on every fix is wasted battery for a number nobody reads that often.
    if (!force && now - lastNotified < NOTIFY_EVERY_MS) return
    lastNotified = now
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.notify(NOTIFICATION_ID, buildNotification())
  }

  private fun buildNotification(): Notification {
    val open =
      PendingIntent.getActivity(
        this,
        0,
        // Straight to the run screen, wherever the app was left.
        Intent(Intent.ACTION_VIEW, Uri.parse("flint://run"), this, MainActivity::class.java)
          .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
    val paused = RunSession.isPaused()
    val km = String.format("%.2f", RunSession.distanceKm())
    val title = if (paused) "Run paused" else "Run in progress"
    val text = if (paused) "$km km so far. Open Flint to resume." else "$km km"

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_notification)
      .setContentTitle(title)
      .setContentText(text)
      .setContentIntent(open)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_WORKOUT)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .setUsesChronometer(!paused)
      .setWhen(RunSession.chronometerBase())
      .build()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    val channel =
      NotificationChannel(CHANNEL_ID, "Run in progress", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Shows while Flint is recording a run."
        setShowBadge(false)
      }
    nm.createNotificationChannel(channel)
  }

  companion object {
    private const val CHANNEL_ID = "run_tracking"
    private const val NOTIFICATION_ID = 4107

    private const val INTERVAL_MS = 3000L
    private const val FASTEST_MS = 1000L
    private const val MIN_DISTANCE_M = 3f
    private const val NOTIFY_EVERY_MS = 5000L

    /** Same bar the JS side applies. Worse than this is a guess, not a position. */
    private const val MAX_ACCURACY_M = 50f

    fun start(context: Context) {
      ContextCompat.startForegroundService(context, Intent(context, RunTrackingService::class.java))
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, RunTrackingService::class.java))
    }
  }
}
