package com.asisvpn.client.vpn;

import android.content.Intent;
import android.net.VpnService;
import android.util.Log;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AsisVpnService extends VpnService {
    public static final String ACTION_START = "com.asisvpn.client.ACTION_START";
    public static final String ACTION_STOP = "com.asisvpn.client.ACTION_STOP";
    private static final String TAG = "AsisVpnService";

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private TunnelEngine engine;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_START.equals(action)) {
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
        stopEngine();
        if (config == null || config.isEmpty()) {
            VpnRuntime.set(VpnRuntime.ERROR, "ENGINE_INVALID_INPUT", "No configuration was provided.");
            stopSelf();
            return;
        }
        VpnRuntime.set(VpnRuntime.CONNECTING, null, null);
        TunnelEngine next = EngineFactory.create();
        try {
            next.start(this, config);
            engine = next;
            VpnRuntime.set(VpnRuntime.CONNECTED, null, null);
        } catch (EngineException e) {
            next.stop();
            VpnRuntime.set(VpnRuntime.ERROR, e.code, e.getMessage());
            stopSelf();
        } catch (RuntimeException e) {
            Log.e(TAG, "Engine start crashed", e);
            next.stop();
            VpnRuntime.set(VpnRuntime.ERROR, "ENGINE_START_FAILED", String.valueOf(e.getMessage()));
            stopSelf();
        }
    }

    private synchronized void stopAndExit() {
        if (engine != null) VpnRuntime.set(VpnRuntime.DISCONNECTING, null, null);
        stopEngine();
        VpnRuntime.set(VpnRuntime.DISCONNECTED, null, null);
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
        if (VpnRuntime.CONNECTED.equals(VpnRuntime.getState())
                || VpnRuntime.CONNECTING.equals(VpnRuntime.getState())) {
            VpnRuntime.set(VpnRuntime.DISCONNECTED, null, null);
        }
        worker.shutdown();
        super.onDestroy();
    }
}
