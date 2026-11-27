package com.asisvpn.client.vpn;

/** Process-wide connection state shared by the plugin and the VpnService (same process). */
public final class VpnRuntime {
    public static final String DISCONNECTED = "Disconnected";
    public static final String PREPARING = "Preparing";
    public static final String CONNECTING = "Connecting";
    public static final String CONNECTED = "Connected";
    public static final String DISCONNECTING = "Disconnecting";
    public static final String ERROR = "Error";

    private static String state = DISCONNECTED;
    private static String errorCode = null;
    private static String errorMessage = null;
    private static long connectedAtMs = 0;
    /** Held in memory only and cleared as soon as the service has read it; it contains credentials. */
    private static String pendingConfig = null;

    /** Loopback controller of the running core (127.0.0.1:port + secret); memory only. */
    private static String controllerAddr = null;
    private static String controllerSecret = null;

    private VpnRuntime() {}

    public static synchronized void setController(String addr, String secret) {
        controllerAddr = addr;
        controllerSecret = secret;
    }

    public static synchronized String getControllerAddr() { return controllerAddr; }
    public static synchronized String getControllerSecret() { return controllerSecret; }

    public static synchronized void set(String newState, String code, String message) {
        state = newState;
        errorCode = ERROR.equals(newState) ? code : null;
        errorMessage = ERROR.equals(newState) ? message : null;
        if (DISCONNECTED.equals(newState) || ERROR.equals(newState)) {
            controllerAddr = null;
            controllerSecret = null;
        }
        if (CONNECTED.equals(newState)) connectedAtMs = System.currentTimeMillis();
        if (!CONNECTED.equals(newState) && !DISCONNECTING.equals(newState)) connectedAtMs = 0;
    }

    public static synchronized String getState() { return state; }
    public static synchronized String getErrorCode() { return errorCode; }
    public static synchronized String getErrorMessage() { return errorMessage; }

    public static synchronized long sessionDurationSec() {
        return connectedAtMs == 0 ? 0 : Math.max(0, (System.currentTimeMillis() - connectedAtMs) / 1000);
    }

    public static synchronized void setPendingConfig(String config) { pendingConfig = config; }

    public static synchronized String takePendingConfig() {
        String c = pendingConfig;
        pendingConfig = null;
        return c;
    }
}
