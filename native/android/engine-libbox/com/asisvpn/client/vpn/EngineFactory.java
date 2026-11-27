package com.asisvpn.client.vpn;

final class EngineFactory {
    private EngineFactory() {}

    static boolean hasCore() { return true; }

    static TunnelEngine create() { return new LibboxTunnelEngine(); }
}
