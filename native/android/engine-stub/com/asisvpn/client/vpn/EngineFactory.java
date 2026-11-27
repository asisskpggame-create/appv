package com.asisvpn.client.vpn;

/** Used when libbox.aar could not be built: the app runs, but never pretends to tunnel. */
final class EngineFactory {
    private EngineFactory() {}

    static boolean hasCore() { return false; }

    static TunnelEngine create() {
        return new TunnelEngine() {
            @Override
            public void start(android.net.VpnService service, String configJson) throws EngineException {
                throw new EngineException("ENGINE_LIBBOX_MISSING", "This build does not include the sing-box core.");
            }

            @Override
            public void stop() {}
        };
    }
}
