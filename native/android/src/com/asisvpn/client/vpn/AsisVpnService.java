package com.asisvpn.client.vpn;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.VpnService;
import android.os.Build;
import android.util.Log;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AsisVpnService extends VpnService {
    public static final String ACTION_START = "com.asisvpn.client.ACTION_START";
    public static final String ACTION_STOP = "com.asisvpn.client.ACTION_STOP";
    private static final String TAG = "AsisVpnService";
    private static final String CHANNEL_ID = "asis_vpn_status";
    private static final int NOTIFICATION_ID = 7101;

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private TunnelEngine engine;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_START.equals(action)) {
            enterForeground(false);
            final String config = VpnRuntime.takePendingConfig();
            worker.execute(() -> start(config));
        } else if (ACTION_STOP.equals(action)) {
            worker.execute(this::stopAndExit);
        } else {
            // Restarted by the system without a config: nothing to resume.
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private synchronized void start(String config) {
        if (config == null || config.isEmpty()) {
            // A second START whose config was already taken by the first one (quick double connect):
            // keep the tunnel that is running or coming up instead of tearing it down.
            if (engine != null || VpnRuntime.CONNECTING.equals(VpnRuntime.getState())) {
                Log.w(TAG, "Duplicate start without a configuration ignored");
                return;
            }
            VpnRuntime.set(VpnRuntime.ERROR, "ENGINE_INVALID_INPUT", "No configuration was provided.");
            leaveForeground();
            stopSelf();
            return;
        }
        stopEngine();
        VpnRuntime.set(VpnRuntime.CONNECTING, null, null);
        TunnelEngine next = EngineFactory.create();
        try {
            next.start(this, config);
            engine = next;
            VpnRuntime.set(VpnRuntime.CONNECTED, null, null);
            enterForeground(true);
        } catch (EngineException e) {
            safeStop(next);
            VpnRuntime.set(VpnRuntime.ERROR, e.code, e.getMessage());
            leaveForeground();
            stopSelf();
        } catch (RuntimeException e) {
            Log.e(TAG, "Engine start crashed", e);
            safeStop(next);
            VpnRuntime.set(VpnRuntime.ERROR, "ENGINE_START_FAILED", String.valueOf(e.getMessage()));
            leaveForeground();
            stopSelf();
        }
    }

    /**
     * Keeps the service in the foreground with an ongoing notification so Android is less likely to kill
     * the tunnel when the app goes to the background. Never fatal: if the system refuses (missing
     * permission, background-start limits), the tunnel runs as before, just without the extra protection.
     */
    private void enterForeground(boolean connected) {
        try {
            startForeground(NOTIFICATION_ID, buildNotification(connected));
        } catch (RuntimeException e) {
            Log.w(TAG, "startForeground refused; continuing without a notification", e);
        }
    }

    @SuppressWarnings("deprecation")
    private void leaveForeground() {
        try {
            stopForeground(true);
        } catch (RuntimeException e) {
            Log.w(TAG, "stopForeground failed", e);
        }
    }

    /** Brand icon (ic_stat_asis.png in each res drawable density folder); falls back to a system icon if the resource is absent. */
    private int statusIcon() {
        int id = getResources().getIdentifier("ic_stat_asis", "drawable", getPackageName());
        return id != 0 ? id : android.R.drawable.ic_lock_lock;
    }

    @SuppressWarnings("deprecation")
    private Notification buildNotification(boolean connected) {
        boolean fa = "fa".equals(Locale.getDefault().getLanguage());
        String title = "ASiS VPN";
        String text = connected
                ? (fa ? "متصل هستید" : "Connected")
                : (fa ? "در حال اتصال…" : "Connecting…");
        String stopLabel = fa ? "قطع اتصال" : "Disconnect";

        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, fa ? "وضعیت VPN" : "VPN status", NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
            b = new Notification.Builder(this, CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
        }
        b.setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(statusIcon())
                .setOngoing(true)
                .setOnlyAlertOnce(true);

        int immutable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch != null) {
            b.setContentIntent(PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | immutable));
        }
        Intent stop = new Intent(this, AsisVpnService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 1, stop, PendingIntent.FLAG_UPDATE_CURRENT | immutable);
        b.addAction(new Notification.Action.Builder(null, stopLabel, stopPi).build());
        return b.build();
    }

    /** Stops a half-started engine without letting a failure in stop() hide the original error. */
    private void safeStop(TunnelEngine e) {
        try {
            e.stop();
        } catch (RuntimeException ex) {
            Log.w(TAG, "Engine stop after failed start also failed", ex);
        }
    }

    private synchronized void stopAndExit() {
        if (engine != null) VpnRuntime.set(VpnRuntime.DISCONNECTING, null, null);
        stopEngine();
        VpnRuntime.set(VpnRuntime.DISCONNECTED, null, null);
        leaveForeground();
        stopSelf();
    }

    private void stopEngine() {
        if (engine != null) {
            try {
                engine.stop();
            } catch (RuntimeException e) {
                Log.w(TAG, "Engine stop failed", e);
            }
            engine = null;
        }
    }

    /** The user revoked VPN permission or another VPN app took over. */
    @Override
    public void onRevoke() {
        worker.execute(this::stopAndExit);
    }

    @Override
    public void onDestroy() {
        stopEngine();
        leaveForeground();
        if (VpnRuntime.CONNECTED.equals(VpnRuntime.getState())
                || VpnRuntime.CONNECTING.equals(VpnRuntime.getState())) {
            VpnRuntime.set(VpnRuntime.DISCONNECTED, null, null);
        }
        worker.shutdown();
        super.onDestroy();
    }
}
