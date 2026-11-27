package com.asisvpn.client.vpn;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.VpnService;
import android.os.Build;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.net.URLEncoder;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/** Capacitor side of window.AsisNativeBridge (see src/engine/nativeBridge.ts). */
@CapacitorPlugin(name = "AsisVpn")
public class AsisVpnPlugin extends Plugin {

    @PluginMethod
    public void connect(PluginCall call) {
        String config = call.getString("config");
        if (config == null || config.isEmpty()) {
            call.reject("Missing configuration.", "ENGINE_INVALID_INPUT");
            return;
        }
        if (!EngineFactory.hasCore()) {
            call.reject(
                "This build does not include the sing-box core (libbox.aar), so it cannot open a tunnel.",
                "ENGINE_LIBBOX_MISSING");
            return;
        }
        Intent consent = VpnService.prepare(getContext());
        if (consent != null) {
            // The call is kept by Capacitor and handed back to vpnPermissionResult.
            startActivityForResult(call, consent, "vpnPermissionResult");
        } else {
            startTunnel(call);
        }
    }

    @ActivityCallback
    private void vpnPermissionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() == Activity.RESULT_OK) {
            startTunnel(call);
        } else {
            call.reject("VPN permission was not granted.", "ENGINE_VPN_PERMISSION_DENIED");
        }
    }

    private void startTunnel(final PluginCall call) {
        final String config = call.getString("config");
        int timeout = call.getInt("timeoutSec", 15);
        final long timeoutMs = Math.max(5, Math.min(60, timeout)) * 1000L;

        VpnRuntime.set(VpnRuntime.PREPARING, null, null);
        rememberController(config);
        VpnRuntime.setPendingConfig(config);
        Context ctx = getContext();
        Intent start = new Intent(ctx, AsisVpnService.class).setAction(AsisVpnService.ACTION_START);
        ctx.startService(start);

        new Thread(() -> {
            long deadline = System.currentTimeMillis() + timeoutMs;
            while (System.currentTimeMillis() < deadline) {
                String state = VpnRuntime.getState();
                if (VpnRuntime.CONNECTED.equals(state)) {
                    call.resolve();
                    askNotificationPermissionOnce();
                    return;
                }
                if (VpnRuntime.ERROR.equals(state)) {
                    String code = VpnRuntime.getErrorCode();
                    call.reject(VpnRuntime.getErrorMessage(), code == null ? "ENGINE_START_FAILED" : code);
                    return;
                }
                if (VpnRuntime.DISCONNECTED.equals(state)) {
                    call.reject("The tunnel was closed before it came up.", "ENGINE_START_FAILED");
                    return;
                }
                try {
                    Thread.sleep(150);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    call.reject("Interrupted.", "ENGINE_START_FAILED");
                    return;
                }
            }
            sendStop();
            call.reject("The tunnel did not come up in time.", "ENGINE_CONNECT_TIMEOUT");
        }, "asis-vpn-connect").start();
    }

    private static final String PREFS = "asis_vpn_prefs";
    private static final String PREF_NOTIF_ASKED = "notification_permission_asked";
    private static final String NOTIF_PERMISSION = "android.permission.POST_NOTIFICATIONS";

    /**
     * Android 13+ hides the foreground-service notification until POST_NOTIFICATIONS is granted. Ask once,
     * only AFTER the tunnel is up (so it never stacks on the VPN consent dialog), and never block or fail
     * the connect: the answer is not needed, and a refusal only hides the notification. Asked a single time
     * per install, so a "no" is not nagged about.
     */
    private void askNotificationPermissionOnce() {
        try {
            if (Build.VERSION.SDK_INT < 33) return;
            final Activity activity = getActivity();
            if (activity == null) return;
            if (activity.checkSelfPermission(NOTIF_PERMISSION) == PackageManager.PERMISSION_GRANTED) return;
            final SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            if (prefs.getBoolean(PREF_NOTIF_ASKED, false)) return;
            prefs.edit().putBoolean(PREF_NOTIF_ASKED, true).apply();
            activity.runOnUiThread(() -> {
                try {
                    activity.requestPermissions(new String[] {NOTIF_PERMISSION}, 7102);
                } catch (RuntimeException ignored) {
                    // Not worth failing anything over.
                }
            });
        } catch (RuntimeException ignored) {
            // Same: best effort only.
        }
    }

    private void sendStop() {
        Context ctx = getContext();
        ctx.startService(new Intent(ctx, AsisVpnService.class).setAction(AsisVpnService.ACTION_STOP));
    }

    @PluginMethod
    public void disconnect(final PluginCall call) {
        String state = VpnRuntime.getState();
        if (VpnRuntime.DISCONNECTED.equals(state) || VpnRuntime.ERROR.equals(state)) {
            VpnRuntime.set(VpnRuntime.DISCONNECTED, null, null);
            call.resolve();
            return;
        }
        sendStop();
        new Thread(() -> {
            long deadline = System.currentTimeMillis() + 5000;
            while (System.currentTimeMillis() < deadline
                    && !VpnRuntime.DISCONNECTED.equals(VpnRuntime.getState())) {
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            call.resolve();
        }, "asis-vpn-disconnect").start();
    }

    @PluginMethod
    public void getState(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("state", VpnRuntime.getState());
        ret.put("errorCode", VpnRuntime.getErrorCode());
        ret.put("errorMessage", VpnRuntime.getErrorMessage());
        call.resolve(ret);
    }

    @PluginMethod
    public void getStats(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("sessionDurationSec", VpnRuntime.sessionDurationSec());
        call.resolve(ret);
    }

    /** Remembers the loopback controller (address + secret) from the config, if it has one. */
    private static void rememberController(String config) {
        try {
            JSONObject api = new JSONObject(config).getJSONObject("experimental").getJSONObject("clash_api");
            String addr = api.optString("external_controller", "");
            if (addr.startsWith("127.0.0.1:")) {
                VpnRuntime.setController(addr, api.optString("secret", ""));
                return;
            }
        } catch (Exception ignored) {
            // No controller in this config.
        }
        VpnRuntime.setController(null, null);
    }

    private static final String TEST_URL = "https://www.gstatic.com/generate_204";

    /**
     * GET against the local controller over a plain socket (HTTP/1.0 so the reply is not chunked).
     * A raw socket also avoids Android's cleartext-HTTP policy, which would block http://127.0.0.1.
     * Returns parsed JSON or null on any failure.
     */
    private static JSONObject controllerGet(String path, int readTimeoutMs) {
        String addr = VpnRuntime.getControllerAddr();
        String secret = VpnRuntime.getControllerSecret();
        if (addr == null || !addr.startsWith("127.0.0.1:")) return null;
        int port;
        try {
            port = Integer.parseInt(addr.substring("127.0.0.1:".length()));
        } catch (NumberFormatException e) {
            return null;
        }
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress("127.0.0.1", port), 1500);
            s.setSoTimeout(readTimeoutMs);
            StringBuilder req = new StringBuilder();
            req.append("GET ").append(path).append(" HTTP/1.0\r\nHost: ").append(addr).append("\r\n");
            if (secret != null && !secret.isEmpty()) req.append("Authorization: Bearer ").append(secret).append("\r\n");
            req.append("Connection: close\r\n\r\n");
            s.getOutputStream().write(req.toString().getBytes("UTF-8"));
            s.getOutputStream().flush();

            java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream();
            byte[] chunk = new byte[2048];
            int n;
            while ((n = s.getInputStream().read(chunk)) != -1) {
                buf.write(chunk, 0, n);
                if (buf.size() > 1048576) return null;
            }
            String resp = buf.toString("UTF-8");
            int headerEnd = resp.indexOf("\r\n\r\n");
            if (headerEnd < 0 || !resp.startsWith("HTTP/1.") || !resp.substring(0, resp.indexOf("\r\n")).contains(" 200")) {
                return null;
            }
            return new JSONObject(resp.substring(headerEnd + 4));
        } catch (Exception e) {
            return null;
        }
    }

    /** Last delay from a proxy's history; null when there is none or the last test failed (0). */
    private static Object lastDelay(JSONObject proxy) {
        JSONArray h = proxy == null ? null : proxy.optJSONArray("history");
        if (h == null || h.length() == 0) return JSONObject.NULL;
        JSONObject last = h.optJSONObject(h.length() - 1);
        int d = last == null ? 0 : last.optInt("delay", 0);
        return d > 0 ? (Object) d : JSONObject.NULL;
    }

    /** Whole-call limit for the one-by-one fallback below, so a hung controller cannot add up to minutes. */
    private static final long STATUS_FALLBACK_MS = 6000;

    /**
     * Reads the tunnel status with ONE controller request (GET /proxies returns every outbound with its
     * delay history). If that answer is missing or has no "proxy" group (older/odd controller), it falls
     * back to asking one outbound at a time, but with a total time limit.
     */
    private static JSObject readTunnelStatus() {
        JSONObject everything = controllerGet("/proxies", 3000);
        JSONObject map = everything == null ? null : everything.optJSONObject("proxies");
        JSONObject group = map == null ? null : map.optJSONObject("proxy");
        if (group != null) {
            return statusFrom(group, map);
        }
        return readTunnelStatusOneByOne();
    }

    /** Builds the status object from the "proxy" group; {@code map} (tag -> proxy) may be null. */
    private static JSObject statusFrom(JSONObject group, JSONObject map) {
        JSObject ret = new JSObject();
        JSObject delays = new JSObject();
        ret.put("delays", delays);
        ret.put("available", true);
        JSONArray all = group.optJSONArray("all");
        if (all != null) {
            ret.put("active", group.optString("now", ""));
            for (int i = 0; i < all.length(); i++) {
                String tag = all.optString(i, "");
                if (!tag.matches("^[A-Za-z0-9_-]{1,64}$")) continue;
                delays.put(tag, lastDelay(map == null ? null : map.optJSONObject(tag)));
            }
        } else {
            ret.put("active", "proxy");
            delays.put("proxy", lastDelay(group));
        }
        return ret;
    }

    private static JSObject readTunnelStatusOneByOne() {
        JSObject ret = new JSObject();
        JSObject delays = new JSObject();
        ret.put("delays", delays);
        JSONObject group = controllerGet("/proxies/proxy", 3000);
        if (group == null) {
            ret.put("available", false);
            ret.put("active", JSONObject.NULL);
            return ret;
        }
        JSONArray all = group.optJSONArray("all");
        if (all == null) return statusFrom(group, null);
        ret.put("available", true);
        ret.put("active", group.optString("now", ""));
        final long deadline = System.currentTimeMillis() + STATUS_FALLBACK_MS;
        for (int i = 0; i < all.length(); i++) {
            String tag = all.optString(i, "");
            if (!tag.matches("^[A-Za-z0-9_-]{1,64}$")) continue;
            if (System.currentTimeMillis() >= deadline) {
                delays.put(tag, JSONObject.NULL); // not asked in time: unknown, not a failure
                continue;
            }
            delays.put(tag, lastDelay(controllerGet("/proxies/" + tag, 3000)));
        }
        return ret;
    }

    @PluginMethod
    public void getTunnelStatus(final PluginCall call) {
        new Thread(() -> call.resolve(readTunnelStatus()), "asis-tunnel-status").start();
    }

    /** Forces a fresh latency test through the tunnel, then reports the status. */
    @PluginMethod
    public void runTunnelTest(final PluginCall call) {
        new Thread(() -> {
            try {
                String url = URLEncoder.encode(TEST_URL, "UTF-8");
                JSONObject group = controllerGet("/proxies/proxy", 3000);
                if (group != null && group.optJSONArray("all") != null) {
                    controllerGet("/group/proxy/delay?url=" + url + "&timeout=5000", 12000);
                } else if (group != null) {
                    controllerGet("/proxies/proxy/delay?url=" + url + "&timeout=5000", 8000);
                }
            } catch (Exception ignored) {
                // Fall through to whatever status can still be read.
            }
            call.resolve(readTunnelStatus());
        }, "asis-tunnel-test").start();
    }

    private static final Pattern PROBE_HOST = Pattern.compile("^[A-Za-z0-9.:\\-]{1,253}$");
    private static final int PROBE_MAX_TARGETS = 100;
    /** Hard limit for the whole tcpProbe call, however many targets or slow DNS lookups there are. */
    private static final long PROBE_OVERALL_MS = 20000;

    /**
     * TCP handshake time from this phone to each host:port. Sockets are bound to the
     * physical (non-VPN) network when one exists, so the result is the phone -> server path
     * even while the tunnel is up. Only connect time is measured; DNS is resolved first.
     */
    @PluginMethod
    public void tcpProbe(final PluginCall call) {
        final JSArray targets = call.getArray("targets");
        if (targets == null) {
            call.reject("Missing targets.", "ENGINE_INVALID_INPUT");
            return;
        }
        final int timeoutMs = Math.max(500, Math.min(10000, call.getInt("timeoutMs", 4000)));
        final Context ctx = getContext();
        new Thread(() -> {
            ExecutorService pool = Executors.newFixedThreadPool(8);
            try {
                final Network net = physicalNetwork(ctx);
                int count = Math.min(targets.length(), PROBE_MAX_TARGETS);
                List<Future<JSObject>> futures = new ArrayList<>();
                List<String> ids = new ArrayList<>();
                for (int i = 0; i < count; i++) {
                    JSONObject t = targets.optJSONObject(i);
                    final String id = t == null ? "" : t.optString("id", "");
                    final String host = t == null ? "" : t.optString("host", "");
                    final int port = t == null ? 0 : t.optInt("port", 0);
                    ids.add(id);
                    futures.add(pool.submit(() -> probeOne(net, id, host, port, timeoutMs)));
                }
                final long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(PROBE_OVERALL_MS);
                JSArray results = new JSArray();
                for (int i = 0; i < futures.size(); i++) {
                    Future<JSObject> f = futures.get(i);
                    long left = Math.max(0L, deadline - System.nanoTime());
                    try {
                        results.put(f.get(left, TimeUnit.NANOSECONDS));
                    } catch (TimeoutException te) {
                        f.cancel(true);
                        JSObject r = new JSObject();
                        r.put("id", ids.get(i));
                        r.put("available", false);
                        r.put("latencyMs", JSObject.NULL);
                        r.put("error", "timeout");
                        results.put(r);
                    }
                }
                JSObject ret = new JSObject();
                ret.put("results", results);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Probe failed.", "ENGINE_PROBE_FAILED");
            } finally {
                pool.shutdownNow();
            }
        }, "asis-tcp-probe").start();
    }

    @SuppressWarnings("deprecation")
    private static Network physicalNetwork(Context ctx) {
        try {
            ConnectivityManager cm = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return null;
            Network fallback = null;
            for (Network n : cm.getAllNetworks()) {
                NetworkCapabilities c = cm.getNetworkCapabilities(n);
                if (c == null || c.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) continue;
                if (!c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) continue;
                if (c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) return n;
                if (fallback == null) fallback = n;
            }
            return fallback;
        } catch (Exception e) {
            return null;
        }
    }

    private static JSObject probeOne(Network net, String id, String host, int port, int timeoutMs) {
        JSObject r = new JSObject();
        r.put("id", id);
        if (id.isEmpty() || port < 1 || port > 65535 || !PROBE_HOST.matcher(host).matches()) {
            r.put("available", false);
            r.put("latencyMs", JSObject.NULL);
            r.put("error", "invalid_target");
            return r;
        }
        String error = "unreachable";
        double best = -1;
        try {
            InetAddress[] addrs = net != null ? net.getAllByName(host) : InetAddress.getAllByName(host);
            InetAddress addr = addrs[0];
            for (InetAddress a : addrs) {
                if (a.getAddress().length == 4) {
                    addr = a;
                    break;
                }
            }
            for (int attempt = 0; attempt < 2; attempt++) {
                Socket s = new Socket();
                try {
                    if (net != null) net.bindSocket(s);
                    s.setTcpNoDelay(true);
                    long t0 = System.nanoTime();
                    s.connect(new InetSocketAddress(addr, port), timeoutMs);
                    double ms = (System.nanoTime() - t0) / 1_000_000.0;
                    if (best < 0 || ms < best) best = ms;
                } catch (SocketTimeoutException e) {
                    error = "timeout";
                } catch (IOException e) {
                    error = "unreachable";
                } finally {
                    try {
                        s.close();
                    } catch (IOException ignored) {
                        // nothing to do
                    }
                }
            }
        } catch (UnknownHostException e) {
            error = "dns_failed";
        } catch (Exception e) {
            error = "unreachable";
        }
        if (best >= 0) {
            r.put("available", true);
            r.put("latencyMs", Math.round(best));
        } else {
            r.put("available", false);
            r.put("latencyMs", JSObject.NULL);
            r.put("error", error);
        }
        return r;
    }

    @SuppressWarnings("deprecation")
    @PluginMethod
    public void getInstalledApplications(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        String self = getContext().getPackageName();

        Set<String> browsers = new HashSet<>();
        Intent web = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse("https://example.com"));
        for (ResolveInfo r : pm.queryIntentActivities(web, 0)) {
            browsers.add(r.activityInfo.packageName);
        }

        Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<JSObject> apps = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (ResolveInfo r : pm.queryIntentActivities(launcher, 0)) {
            String pkg = r.activityInfo.packageName;
            if (pkg.equals(self) || !seen.add(pkg)) continue;
            ApplicationInfo info = r.activityInfo.applicationInfo;
            boolean system = (info.flags & ApplicationInfo.FLAG_SYSTEM) != 0
                    && (info.flags & ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0;
            JSObject app = new JSObject();
            app.put("id", pkg);
            app.put("identifier", pkg);
            app.put("name", String.valueOf(r.loadLabel(pm)));
            app.put("category", categoryOf(info, pkg, system, browsers));
            app.put("isSystemApp", system);
            app.put("source", "native_bridge");
            apps.add(app);
        }
        Collections.sort(apps, (a, b) -> a.getString("name", "").compareToIgnoreCase(b.getString("name", "")));

        JSArray list = new JSArray();
        for (JSObject a : apps) list.put(a);
        JSObject ret = new JSObject();
        ret.put("apps", list);
        call.resolve(ret);
    }

    private static String categoryOf(ApplicationInfo info, String pkg, boolean system, Set<String> browsers) {
        if (browsers.contains(pkg)) return "browser";
        if (system) return "system";
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            switch (info.category) {
                case ApplicationInfo.CATEGORY_SOCIAL:
                    return "messaging";
                case ApplicationInfo.CATEGORY_AUDIO:
                case ApplicationInfo.CATEGORY_VIDEO:
                case ApplicationInfo.CATEGORY_IMAGE:
                    return "media";
                default:
                    break;
            }
        }
        return "other";
    }
}
